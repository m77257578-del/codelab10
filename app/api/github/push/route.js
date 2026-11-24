// Server-side GitHub repository creator & incremental multi-file atomic Git Data API pusher

import { decryptSession } from '../../../lib/serverCrypto';
import {
  validateGitHubBranch,
  validateGitHubFilePath,
  validateGitHubOwner,
  validateGitHubRepo,
} from '../../../lib/githubSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ghFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
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
}

function extractMediaBase64(entry) {
  if (!entry || typeof entry !== 'object' || !entry.__media || typeof entry.dataUrl !== 'string') {
    return null;
  }
  const comma = entry.dataUrl.indexOf(',');
  if (comma === -1) return null;
  const meta = entry.dataUrl.slice(0, comma);
  const body = entry.dataUrl.slice(comma + 1);
  if (/;base64/i.test(meta)) return body;
  return Buffer.from(decodeURIComponent(body), 'utf8').toString('base64');
}

export async function POST(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const sessionToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const session = decryptSession(sessionToken);

    if (!session?.accessToken || !session?.login) {
      return Response.json({ error: 'يرجى تسجيل الدخول بحساب GitHub أولاً.' }, { status: 401 });
    }

    const body = await req.json();
    const owner = validateGitHubOwner(String(body?.owner || session.login));
    const rawRepo = String(body?.repoName || '').trim();
    const cleanedRepo = rawRepo.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    const repoName = validateGitHubRepo(cleanedRepo);
    if (!owner || !repoName) {
      return Response.json(
        { error: 'اسم المستودع غير صالح. استخدم حروفاً إنجليزية أو أرقاماً أو (-) أو (_).' },
        { status: 400 }
      );
    }

    const createIfMissing = body?.createIfMissing !== false;
    const requestedBranch = body?.branch ? validateGitHubBranch(String(body.branch)) : null;
    if (body?.branch && !requestedBranch) {
      return Response.json({ error: 'Invalid target branch name.' }, { status: 400 });
    }

    const description = String(body?.description || 'Created and pushed from CodeLab IDE').slice(0, 300);
    const isPrivate = Boolean(body?.isPrivate);
    const commitMessage = String(body?.commitMessage || 'Update files from CodeLab IDE').slice(0, 200);
    const files = body?.files && typeof body.files === 'object' ? body.files : {};
    const rawDeleted = Array.isArray(body?.deletedPaths) ? body.deletedPaths : [];

    // Prepare file entries (added/modified) and deleted paths
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
      return Response.json({ error: 'لا توجد ملفات أو تعديلات لرفعها إلى GitHub.' }, { status: 400 });
    }

    const token = session.accessToken;

    // 1. Check if repo exists; create if missing and allowed (only under authenticated user's account)
    let repoInfo = await ghFetch(`https://api.github.com/repos/${owner}/${repoName}`, token);
    if (!repoInfo.ok && repoInfo.status === 404) {
      if (!createIfMissing || owner.toLowerCase() !== session.login.toLowerCase()) {
        return Response.json(
          { error: 'المستودع المرتبط غير موجود أو لا تملك صلاحية الوصول إليه.' },
          { status: 404 }
        );
      }
      repoInfo = await ghFetch('https://api.github.com/user/repos', token, {
        method: 'POST',
        body: JSON.stringify({
          name: repoName,
          description,
          private: isPrivate,
          auto_init: false,
        }),
      });
    }

    if (!repoInfo.ok) {
      return Response.json(
        { error: repoInfo.data?.message || 'تعذر إنشاء أو فتح المستودع على GitHub.' },
        { status: repoInfo.status || 400 }
      );
    }

    const defaultBranch = repoInfo.data.default_branch || 'main';
    const branch = requestedBranch || defaultBranch;
    const repoUrl = repoInfo.data.html_url || `https://github.com/${owner}/${repoName}`;
    const fullName = repoInfo.data.full_name || `${owner}/${repoName}`;
    const encodedBranch = encodeURIComponent(branch).replace(/%2F/g, '/');

    // 2. Resolve target branch head commit SHA
    let refRes = await ghFetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${encodedBranch}`,
      token
    );
    let headCommitSha = refRes.ok ? refRes.data?.object?.sha : null;
    let remainingEntries = entries;

    // If target branch does not exist yet, check whether defaultBranch exists (create branch from it) or repo is empty
    if (!headCommitSha && branch !== defaultBranch) {
      const baseRefRes = await ghFetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${encodeURIComponent(defaultBranch).replace(/%2F/g, '/')}`,
        token
      );
      if (baseRefRes.ok && baseRefRes.data?.object?.sha) {
        const createBranchRes = await ghFetch(
          `https://api.github.com/repos/${owner}/${repoName}/git/refs`,
          token,
          {
            method: 'POST',
            body: JSON.stringify({
              ref: `refs/heads/${branch}`,
              sha: baseRefRes.data.object.sha,
            }),
          }
        );
        if (createBranchRes.ok) {
          headCommitSha = baseRefRes.data.object.sha;
        }
      }
    }

    // Empty repo initialization (Git Data API rejects /git/blobs on an unborn branch)
    if (!headCommitSha) {
      if (!entries.length) {
        return Response.json(
          { error: 'لا يمكن حذف ملفات من مستودع فارغ.' },
          { status: 400 }
        );
      }
      const first = entries[0];
      const firstBase64 =
        first.encoding === 'base64' ? first.content : Buffer.from(first.content, 'utf8').toString('base64');
      const initRes = await ghFetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(first.path).replace(/%2F/g, '/')}`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: entries.length === 1 ? commitMessage : `Initialize repository with ${first.path}`,
            content: firstBase64,
            branch,
          }),
        }
      );

      if (!initRes.ok) {
        return Response.json(
          { error: initRes.data?.message || 'تعذر تهيئة الفرع الأولي في المستودع.' },
          { status: initRes.status || 400 }
        );
      }

      headCommitSha = initRes.data?.commit?.sha;
      if (entries.length === 1) {
        return Response.json({
          ok: true,
          fullName,
          owner: repoInfo.data.owner?.login || owner,
          repo: repoInfo.data.name || repoName,
          branch,
          private: Boolean(repoInfo.data.private),
          repoUrl,
          commitUrl: initRes.data?.commit?.html_url || repoUrl,
          commitSha: headCommitSha,
          filesCount: 1,
          deletedCount: 0,
        });
      }
      remainingEntries = entries.slice(1);
    }

    // 3. Create blobs for changed/added files + build atomic Git tree (including deletions via sha: null)
    const headCommitInfo = await ghFetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits/${headCommitSha}`,
      token
    );
    const baseTreeSha = headCommitInfo.ok ? headCommitInfo.data?.tree?.sha : undefined;

    const treeItems = [];
    for (const item of remainingEntries) {
      const blobRes = await ghFetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({
          content: item.content,
          encoding: item.encoding,
        }),
      });
      if (!blobRes.ok || !blobRes.data?.sha) {
        return Response.json(
          { error: blobRes.data?.message || `فشل رفع الملف: ${item.path}` },
          { status: blobRes.status || 400 }
        );
      }
      treeItems.push({
        path: item.path,
        mode: '100644',
        type: 'blob',
        sha: blobRes.data.sha,
      });
    }

    // Only delete paths that actually exist in the target branch tree to avoid GitHub tree errors
    if (deletedPaths.length > 0 && baseTreeSha) {
      const existingTreeRes = await ghFetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/trees/${baseTreeSha}?recursive=1`,
        token
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
      return Response.json({
        ok: true,
        fullName,
        owner: repoInfo.data.owner?.login || owner,
        repo: repoInfo.data.name || repoName,
        branch,
        private: Boolean(repoInfo.data.private),
        repoUrl,
        commitUrl: `${repoUrl}/commit/${headCommitSha}`,
        commitSha: headCommitSha,
        filesCount: 0,
        deletedCount: 0,
      });
    }

    const treeRes = await ghFetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    });
    if (!treeRes.ok || !treeRes.data?.sha) {
      return Response.json(
        { error: treeRes.data?.message || 'فشل إنشاء شجرة الملفات على GitHub.' },
        { status: treeRes.status || 400 }
      );
    }

    const commitRes = await ghFetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage,
        tree: treeRes.data.sha,
        parents: [headCommitSha],
      }),
    });
    if (!commitRes.ok || !commitRes.data?.sha) {
      return Response.json(
        { error: commitRes.data?.message || 'فشل حفظ Commit على GitHub.' },
        { status: commitRes.status || 400 }
      );
    }

    const updateRef = await ghFetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${encodedBranch}`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify({ sha: commitRes.data.sha }),
      }
    );

    if (!updateRef.ok) {
      return Response.json(
        { error: updateRef.data?.message || 'فشل تحديث الفرع بعد الرفع.' },
        { status: updateRef.status || 400 }
      );
    }

    return Response.json({
      ok: true,
      fullName,
      owner: repoInfo.data.owner?.login || owner,
      repo: repoInfo.data.name || repoName,
      branch,
      private: Boolean(repoInfo.data.private),
      repoUrl,
      commitUrl: `${repoUrl}/commit/${commitRes.data.sha}`,
      commitSha: commitRes.data.sha,
      filesCount: entries.length,
      deletedCount: treeItems.filter((item) => item.sha === null).length,
    });
  } catch (err) {
    return Response.json({ error: err?.message || 'حدث خطأ أثناء الرفع إلى GitHub.' }, { status: 500 });
  }
}
