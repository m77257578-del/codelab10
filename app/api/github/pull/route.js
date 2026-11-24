// Server-side endpoint to inspect branches and pull files from a linked GitHub repository

import { decryptSession } from '../../../lib/serverCrypto';
import {
  validateGitHubBranch,
  validateGitHubFilePath,
  validateGitHubOwner,
  validateGitHubRepo,
} from '../../../lib/githubSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PULL_FILES = 1000;
const MAX_FILE_BYTES = 512 * 1024;
const MEDIA_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|ico|avif|mp4|webm|mov|m4v|ogv|mp3|wav|ogg|m4a|aac|flac)$/i;

function inferMediaMime(path) {
  const ext = path.split('.').pop()?.toLowerCase() || 'png';
  if (['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)) {
    return `video/${ext === 'mov' ? 'quicktime' : ext === 'm4v' ? 'mp4' : ext === 'ogv' ? 'ogg' : ext}`;
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return `audio/${ext === 'mp3' ? 'mpeg' : ext === 'm4a' ? 'mp4' : ext}`;
  }
  if (ext === 'jpg') return 'image/jpeg';
  if (ext === 'ico') return 'image/x-icon';
  return `image/${ext}`;
}

async function ghFetch(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CodeLab-IDE',
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {}
  return { ok: res.ok, status: res.status, data: json };
}

export async function GET(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const sessionToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const session = decryptSession(sessionToken);

    if (!session?.accessToken || !session?.login) {
      return Response.json({ error: 'GitHub authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const owner = validateGitHubOwner(searchParams.get('owner') || session.login);
    const repo = validateGitHubRepo(searchParams.get('repo') || '');
    const requestedBranch = searchParams.get('branch');
    const branchesOnly = searchParams.get('branchesOnly') === '1';

    if (!owner || !repo) {
      return Response.json({ error: 'Invalid repository owner or name.' }, { status: 400 });
    }

    const token = session.accessToken;
    const repoRes = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
    if (!repoRes.ok) {
      return Response.json(
        { error: repoRes.data?.message || 'Repository not found or inaccessible.' },
        { status: repoRes.status || 404 }
      );
    }

    const defaultBranch = repoRes.data.default_branch || 'main';
    const branch = requestedBranch ? validateGitHubBranch(requestedBranch) : defaultBranch;
    if (!branch) {
      return Response.json({ error: 'Invalid branch name.' }, { status: 400 });
    }

    const branchesRes = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=50`,
      token
    );
    const branchNames = Array.isArray(branchesRes.data)
      ? branchesRes.data.map((b) => b?.name).filter(Boolean)
      : [defaultBranch];
    if (!branchNames.includes(branch)) branchNames.unshift(branch);

    const repoMeta = {
      fullName: repoRes.data.full_name || `${owner}/${repo}`,
      owner: repoRes.data.owner?.login || owner,
      name: repoRes.data.name || repo,
      defaultBranch,
      branch,
      private: Boolean(repoRes.data.private),
      description: repoRes.data.description || '',
      htmlUrl: repoRes.data.html_url || `https://github.com/${owner}/${repo}`,
    };

    if (branchesOnly) {
      return Response.json({
        repo: repoMeta,
        branches: branchNames,
      });
    }

    // Fetch git ref + tree for selected branch (empty repos return 404/409 gracefully)
    const refRes = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, '/')}`,
      token
    );
    if (!refRes.ok || !refRes.data?.object?.sha) {
      return Response.json({
        repo: repoMeta,
        branches: branchNames,
        files: {},
        headSha: null,
        truncated: false,
      });
    }

    const headSha = refRes.data.object.sha;
    const treeRes = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${headSha}?recursive=1`,
      token
    );
    if (!treeRes.ok) {
      return Response.json(
        { error: treeRes.data?.message || 'Failed to read repository tree.' },
        { status: treeRes.status || 400 }
      );
    }

    const allBlobs = Array.isArray(treeRes.data?.tree)
      ? treeRes.data.tree.filter((item) => {
          if (item?.type !== 'blob' || !item?.sha) return false;
          const clean = validateGitHubFilePath(item.path);
          if (!clean) return false;
          if ((item.size || 0) > MAX_FILE_BYTES) return false;
          return true;
        })
      : [];

    const truncated = Boolean(treeRes.data?.truncated) || allBlobs.length > MAX_PULL_FILES;
    const selectedBlobs = allBlobs.slice(0, MAX_PULL_FILES);

    const files = {};
    // Fetch blobs in small parallel batches to stay fast and polite to GitHub API
    const batchSize = 8;
    for (let i = 0; i < selectedBlobs.length; i += batchSize) {
      const batch = selectedBlobs.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (item) => {
          const cleanPath = validateGitHubFilePath(item.path);
          if (!cleanPath) return null;
          const blobRes = await ghFetch(
            `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`,
            token
          );
          if (!blobRes.ok || typeof blobRes.data?.content !== 'string') return null;
          const base64Clean = blobRes.data.content.replace(/\n/g, '');
          if (MEDIA_EXT_RE.test(cleanPath)) {
            const mime = inferMediaMime(cleanPath);
            return [
              cleanPath,
              {
                __media: true,
                mime,
                size: item.size || Math.floor((base64Clean.length * 3) / 4),
                name: cleanPath.split('/').pop(),
                dataUrl: `data:${mime};base64,${base64Clean}`,
              },
            ];
          }
          const decodedText = Buffer.from(base64Clean, 'base64').toString('utf8');
          // Skip binary non-media files containing null bytes
          if (decodedText.includes('\0')) return null;
          return [cleanPath, decodedText];
        })
      );
      for (const pair of results) {
        if (pair) files[pair[0]] = pair[1];
      }
    }

    return Response.json({
      repo: repoMeta,
      branches: branchNames,
      files,
      headSha,
      truncated,
    });
  } catch (err) {
    return Response.json({ error: err?.message || 'Failed to pull repository.' }, { status: 500 });
  }
}
