// Server-side GitHub repository creation & atomic Git Data API push orchestrator with retry resilience

import {
  extractMediaBase64,
  formatGitHubApiError,
  normalizeGitHubRepoName,
  pickInitialSeedEntry,
  validateGitHubBranch,
  validateGitHubFilePath,
  validateGitHubOwner,
  validateGitHubRepo,
} from './githubSync';

const TRANSIENT_GITHUB_STATUSES = new Set([404, 409, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [350, 750, 1400];
const INLINE_TREE_TEXT_LIMIT = 256 * 1024;
const BLOB_BATCH_SIZE = 5;

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveRequestOrigin(req) {
  const fromEnv = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  try {
    const rawHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
      .split(',')[0]
      .trim();
    const rawProto = (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
    if (rawHost && /^[a-zA-Z0-9.-]+(:\d+)?$/.test(rawHost)) {
      const proto = rawProto === 'http' || rawProto === 'https'
        ? rawProto
        : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawHost)
          ? 'http'
          : 'https';
      return `${proto}://${rawHost}`;
    }
  } catch {}
  return new URL(req.url).origin;
}

async function ghFetch(url, token, options = {}, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, {
      ...options,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CodeLab-IDE',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {}
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      networkError: true,
      data: { message: err?.message || 'Network request to GitHub failed.' },
    };
  }
}

async function ghFetchWithRetry(
  url,
  token,
  options = {},
  {
    fetchImpl = fetch,
    sleepImpl = defaultSleep,
    retryStatuses = TRANSIENT_GITHUB_STATUSES,
    delays = RETRY_DELAYS_MS,
  } = {}
) {
  let result = await ghFetch(url, token, options, fetchImpl);
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (result.ok) return result;
    const shouldRetry = result.networkError || retryStatuses.has(result.status);
    if (!shouldRetry) return result;
    await sleepImpl(delays[attempt]);
    result = await ghFetch(url, token, options, fetchImpl);
  }
  return result;
}

export async function executeGitHubPush({
  session,
  body,
  fetchImpl = fetch,
  sleepImpl = defaultSleep,
} = {}) {
  const locale = body?.locale === 'en' ? 'en' : 'ar';
  const isEn = locale === 'en';

  if (!session?.accessToken || !session?.login) {
    return {
      status: 401,
      payload: {
        error: isEn
          ? 'Please sign in with your GitHub account first.'
          : 'يرجى تسجيل الدخول بحساب GitHub أولاً.',
      },
    };
  }

  const owner = validateGitHubOwner(String(body?.owner || session.login));
  const cleanedRepo = normalizeGitHubRepoName(body?.repoName || '');
  const repoName = validateGitHubRepo(cleanedRepo);
  if (!owner || !repoName) {
    return {
      status: 400,
      payload: {
        error: isEn
          ? 'Invalid repository name. Use English letters, numbers, dots, hyphens (-), or underscores (_).'
          : 'اسم المستودع غير صالح. استخدم حروفاً إنجليزية أو أرقاماً أو (-) أو (_).',
      },
    };
  }

  const createNew = Boolean(body?.createNew);
  const createIfMissing = body?.createIfMissing !== false;
  const requestedBranch = body?.branch ? validateGitHubBranch(String(body.branch)) : null;
  if (body?.branch && !requestedBranch) {
    return {
      status: 400,
      payload: {
        error: isEn ? 'Invalid target branch name.' : 'اسم الفرع المستهدف غير صالح.',
      },
    };
  }

  const description = String(body?.description || 'Created and pushed from CodeLab IDE').slice(0, 300);
  const isPrivate = Boolean(body?.isPrivate);
  const commitMessage = String(body?.commitMessage || 'Update files from CodeLab IDE').slice(0, 200);
  const files = body?.files && typeof body.files === 'object' ? body.files : {};
  const rawDeleted = Array.isArray(body?.deletedPaths) ? body.deletedPaths : [];

  const entries = Object.entries(files)
    .map(([rawPath, content]) => {
      const cleanPath = validateGitHubFilePath(rawPath);
      if (!cleanPath) return null;
      const b64 = extractMediaBase64(content);
      if (b64 !== null) {
        return { path: cleanPath, content: b64, encoding: 'base64' };
      }
      return {
        path: cleanPath,
        content: typeof content === 'string' ? content : '',
        encoding: 'utf-8',
      };
    })
    .filter(Boolean);

  const entryPathSet = new Set(entries.map((e) => e.path));
  const deletedPaths = Array.from(
    new Set(
      rawDeleted
        .map((p) => validateGitHubFilePath(String(p || '')))
        .filter((p) => p && !entryPathSet.has(p))
    )
  );

  if (!entries.length && !deletedPaths.length) {
    return {
      status: 400,
      payload: {
        error: isEn
          ? 'No files or changes found to push to GitHub.'
          : 'لا توجد ملفات أو تعديلات لرفعها إلى GitHub.',
      },
    };
  }

  const token = session.accessToken;
  let newlyCreatedRepo = false;

  // 1. Check if repo exists; create if missing and allowed (only under authenticated user's account)
  let repoInfo = await ghFetch(`https://api.github.com/repos/${owner}/${repoName}`, token, {}, fetchImpl);

  if (repoInfo.ok && createNew) {
    return {
      status: 409,
      payload: {
        error: isEn
          ? `Repository "${owner}/${repoName}" already exists on GitHub. Choose a new name or switch to "Link Existing Repo".`
          : `المستودع "${owner}/${repoName}" موجود بالفعل على حسابك في GitHub. اختر اسماً جديداً أو استخدم تبويب «ربط مستودع قائم».`,
      },
    };
  }

  if (!repoInfo.ok && repoInfo.status === 404) {
    if (!createIfMissing || owner.toLowerCase() !== session.login.toLowerCase()) {
      return {
        status: 404,
        payload: {
          error: isEn
            ? 'Linked repository was not found or you do not have access to it.'
            : 'المستودع المرتبط غير موجود أو لا تملك صلاحية الوصول إليه.',
        },
      };
    }
    repoInfo = await ghFetch(
      'https://api.github.com/user/repos',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          name: repoName,
          description,
          private: isPrivate,
          auto_init: false,
        }),
      },
      fetchImpl
    );
    if (repoInfo.ok) {
      newlyCreatedRepo = true;
    }
  }

  if (!repoInfo.ok) {
    return {
      status: repoInfo.status || 400,
      payload: {
        error: formatGitHubApiError({
          status: repoInfo.status,
          data: repoInfo.data,
          phase: 'createRepo',
          isPrivate,
          locale,
        }),
      },
    };
  }

  const canonicalOwner = repoInfo.data?.owner?.login || owner;
  const canonicalRepo = repoInfo.data?.name || repoName;
  const defaultBranch = repoInfo.data?.default_branch || 'main';
  const branch = requestedBranch || defaultBranch;
  const repoUrl = repoInfo.data?.html_url || `https://github.com/${canonicalOwner}/${canonicalRepo}`;
  const fullName = repoInfo.data?.full_name || `${canonicalOwner}/${canonicalRepo}`;
  const encodedBranch = encodeURIComponent(branch).replace(/%2F/g, '/');

  // 2. Resolve target branch head commit SHA (skip redundant check for brand-new empty repo)
  let headCommitSha = null;
  let baseTreeSha = undefined;
  let remainingEntries = entries;

  if (!newlyCreatedRepo) {
    const refRes = await ghFetch(
      `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/ref/heads/${encodedBranch}`,
      token,
      {},
      fetchImpl
    );
    headCommitSha = refRes.ok ? refRes.data?.object?.sha : null;

    // If target branch does not exist yet, check whether defaultBranch exists and branch from it
    if (!headCommitSha && branch !== defaultBranch) {
      const baseRefRes = await ghFetch(
        `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/ref/heads/${encodeURIComponent(defaultBranch).replace(/%2F/g, '/')}`,
        token,
        {},
        fetchImpl
      );
      if (baseRefRes.ok && baseRefRes.data?.object?.sha) {
        const createBranchRes = await ghFetch(
          `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/refs`,
          token,
          {
            method: 'POST',
            body: JSON.stringify({
              ref: `refs/heads/${branch}`,
              sha: baseRefRes.data.object.sha,
            }),
          },
          fetchImpl
        );
        if (createBranchRes.ok) {
          headCommitSha = baseRefRes.data.object.sha;
        }
      }
    }
  }

  // Empty repo initialization (Git Data API rejects /git/blobs and /git/trees on an unborn branch)
  if (!headCommitSha) {
    const picked = pickInitialSeedEntry(entries);
    if (!picked) {
      return {
        status: 400,
        payload: {
          error: isEn
            ? 'Cannot delete files from an empty repository.'
            : 'لا يمكن حذف ملفات من مستودع فارغ.',
        },
      };
    }

    const { first, rest } = picked;
    const firstBase64 =
      first.encoding === 'base64' ? first.content : Buffer.from(first.content, 'utf8').toString('base64');

    const initUrl = `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/contents/${encodeURIComponent(first.path).replace(/%2F/g, '/')}`;
    const initRes = await ghFetchWithRetry(
      initUrl,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: rest.length === 0 ? commitMessage : `Initialize repository with ${first.path}`,
          content: firstBase64,
          branch,
        }),
      },
      { fetchImpl, sleepImpl }
    );

    if (!initRes.ok) {
      return {
        status: initRes.status || 400,
        payload: {
          error: formatGitHubApiError({
            status: initRes.status,
            data: initRes.data,
            phase: newlyCreatedRepo ? 'createRepo' : 'push',
            isPrivate,
            locale,
          }),
        },
      };
    }

    headCommitSha = initRes.data?.commit?.sha;
    baseTreeSha = initRes.data?.commit?.tree?.sha;

    if (rest.length === 0) {
      return {
        status: 200,
        payload: {
          ok: true,
          fullName,
          owner: canonicalOwner,
          repo: canonicalRepo,
          branch,
          private: Boolean(repoInfo.data?.private),
          repoUrl,
          commitUrl: initRes.data?.commit?.html_url || repoUrl,
          commitSha: headCommitSha,
          filesCount: 1,
          deletedCount: 0,
        },
      };
    }
    remainingEntries = rest;
  }

  // 3. Resolve base tree SHA if not already provided by initial PUT /contents response
  if (!baseTreeSha && headCommitSha) {
    const headCommitInfo = await ghFetchWithRetry(
      `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/commits/${headCommitSha}`,
      token,
      {},
      { fetchImpl, sleepImpl }
    );
    if (!headCommitInfo.ok || !headCommitInfo.data?.tree?.sha) {
      return {
        status: headCommitInfo.status || 500,
        payload: {
          error: formatGitHubApiError({
            status: headCommitInfo.status,
            data: headCommitInfo.data,
            phase: 'push',
            isPrivate,
            locale,
          }),
        },
      };
    }
    baseTreeSha = headCommitInfo.data.tree.sha;
  }

  // 4. Build tree entries (inline content for small UTF-8 text files; batched /git/blobs for base64/large files)
  const treeItems = [];
  const blobEntries = [];

  for (const item of remainingEntries) {
    if (item.encoding === 'utf-8' && Buffer.byteLength(item.content, 'utf8') <= INLINE_TREE_TEXT_LIMIT) {
      treeItems.push({
        path: item.path,
        mode: '100644',
        type: 'blob',
        content: item.content,
      });
    } else {
      blobEntries.push(item);
    }
  }

  for (let i = 0; i < blobEntries.length; i += BLOB_BATCH_SIZE) {
    const batch = blobEntries.slice(i, i + BLOB_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const blobRes = await ghFetchWithRetry(
          `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/blobs`,
          token,
          {
            method: 'POST',
            body: JSON.stringify({
              content: item.content,
              encoding: item.encoding,
            }),
          },
          { fetchImpl, sleepImpl }
        );
        return { item, blobRes };
      })
    );

    for (const { item, blobRes } of batchResults) {
      if (!blobRes.ok || !blobRes.data?.sha) {
        return {
          status: blobRes.status || 400,
          payload: {
            error:
              formatGitHubApiError({
                status: blobRes.status,
                data: blobRes.data,
                phase: 'push',
                isPrivate,
                locale,
              }) || (isEn ? `Failed to upload file: ${item.path}` : `فشل رفع الملف: ${item.path}`),
          },
        };
      }
      treeItems.push({
        path: item.path,
        mode: '100644',
        type: 'blob',
        sha: blobRes.data.sha,
      });
    }
  }

  // Only delete paths that actually exist in the target branch tree to avoid GitHub tree errors
  if (deletedPaths.length > 0 && baseTreeSha) {
    const existingTreeRes = await ghFetchWithRetry(
      `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/trees/${baseTreeSha}?recursive=1`,
      token,
      {},
      { fetchImpl, sleepImpl }
    );
    const existingSet = new Set(
      Array.isArray(existingTreeRes.data?.tree)
        ? existingTreeRes.data.tree.filter((n) => n?.type === 'blob').map((n) => n.path)
        : []
    );
    for (const delPath of deletedPaths) {
      if (existingSet.has(delPath)) {
        treeItems.push({
          path: delPath,
          mode: '100644',
          type: 'blob',
          sha: null,
        });
      }
    }
  }

  if (!treeItems.length) {
    return {
      status: 200,
      payload: {
        ok: true,
        fullName,
        owner: canonicalOwner,
        repo: canonicalRepo,
        branch,
        private: Boolean(repoInfo.data?.private),
        repoUrl,
        commitUrl: `${repoUrl}/commit/${headCommitSha}`,
        commitSha: headCommitSha,
        filesCount: 0,
        deletedCount: 0,
      },
    };
  }

  const treeRes = await ghFetchWithRetry(
    `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/trees`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    },
    { fetchImpl, sleepImpl }
  );
  if (!treeRes.ok || !treeRes.data?.sha) {
    return {
      status: treeRes.status || 400,
      payload: {
        error: formatGitHubApiError({
          status: treeRes.status,
          data: treeRes.data,
          phase: 'push',
          isPrivate,
          locale,
        }),
      },
    };
  }

  const commitRes = await ghFetchWithRetry(
    `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/commits`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage,
        tree: treeRes.data.sha,
        parents: headCommitSha ? [headCommitSha] : [],
      }),
    },
    { fetchImpl, sleepImpl }
  );
  if (!commitRes.ok || !commitRes.data?.sha) {
    return {
      status: commitRes.status || 400,
      payload: {
        error: formatGitHubApiError({
          status: commitRes.status,
          data: commitRes.data,
          phase: 'push',
          isPrivate,
          locale,
        }),
      },
    };
  }

  let updateRef = await ghFetchWithRetry(
    `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/refs/heads/${encodedBranch}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitRes.data.sha }),
    },
    { fetchImpl, sleepImpl }
  );

  // Fallback: create branch ref if PATCH returned 404/422 because ref wasn't yet visible
  if (!updateRef.ok && (updateRef.status === 404 || updateRef.status === 422)) {
    updateRef = await ghFetch(
      `https://api.github.com/repos/${canonicalOwner}/${canonicalRepo}/git/refs`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: commitRes.data.sha,
        }),
      },
      fetchImpl
    );
  }

  if (!updateRef.ok) {
    return {
      status: updateRef.status || 400,
      payload: {
        error: formatGitHubApiError({
          status: updateRef.status,
          data: updateRef.data,
          phase: 'push',
          isPrivate,
          locale,
        }),
      },
    };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      fullName,
      owner: canonicalOwner,
      repo: canonicalRepo,
      branch,
      private: Boolean(repoInfo.data?.private),
      repoUrl,
      commitUrl: `${repoUrl}/commit/${commitRes.data.sha}`,
      commitSha: commitRes.data.sha,
      filesCount: entries.length,
      deletedCount: treeItems.filter((item) => item.sha === null).length,
    },
  };
}
