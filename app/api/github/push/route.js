// Server-side GitHub repository creator & multi-file atomic Git Data API pusher

import { decryptSession } from '../../../lib/serverCrypto';

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
    const rawRepo = String(body?.repoName || '').trim();
    const repoName = rawRepo.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!repoName || !/^[a-zA-Z0-9._-]{1,100}$/.test(repoName)) {
      return Response.json(
        { error: 'اسم المستودع غير صالح. استخدم حروفاً إنجليزية أو أرقاماً أو (-) أو (_).' },
        { status: 400 }
      );
    }

    const description = String(body?.description || 'Created and pushed from CodeLab IDE').slice(0, 300);
    const isPrivate = Boolean(body?.isPrivate);
    const commitMessage = String(body?.commitMessage || 'Push project from CodeLab IDE').slice(0, 200);
    const files = body?.files;

    if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
      return Response.json({ error: 'لا توجد ملفات لرفعها إلى GitHub.' }, { status: 400 });
    }

    const token = session.accessToken;
    const owner = session.login;

    // 1. Check if repo exists; create if missing
    let repoInfo = await ghFetch(`https://api.github.com/repos/${owner}/${repoName}`, token);
    if (!repoInfo.ok && repoInfo.status === 404) {
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

    const branch = repoInfo.data.default_branch || 'main';
    const repoUrl = repoInfo.data.html_url || `https://github.com/${owner}/${repoName}`;

    // Prepare file entries
    const entries = Object.entries(files)
      .map(([rawPath, content]) => {
        const cleanPath = rawPath.replace(/^\/+/, '').trim();
        if (!cleanPath || cleanPath.includes('..')) return null;
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

    if (!entries.length) {
      return Response.json({ error: 'لا توجد ملفات صالحة للرفع.' }, { status: 400 });
    }

    // 2. Ensure repo has an initial commit/branch (empty repos reject /git/blobs until first file exists)
    let refRes = await ghFetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${branch}`, token);
    let headCommitSha = refRes.ok ? refRes.data?.object?.sha : null;
    let remainingEntries = entries;

    if (!headCommitSha) {
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
          repoUrl,
          commitUrl: initRes.data?.commit?.html_url || repoUrl,
          filesCount: 1,
        });
      }
      remainingEntries = entries.slice(1);
    }

    // 3. Create blobs for remaining files and build atomic Git tree + commit
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
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`,
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
      repoUrl,
      commitUrl: `${repoUrl}/commit/${commitRes.data.sha}`,
      filesCount: entries.length,
    });
  } catch (err) {
    return Response.json({ error: err?.message || 'حدث خطأ أثناء الرفع إلى GitHub.' }, { status: 500 });
  }
}
