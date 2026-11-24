// Pure helpers for tracking saved workspace changes against linked GitHub repositories

const VALID_SEGMENT_RE = /^[a-zA-Z0-9._-]{1,100}$/;
const VALID_BRANCH_RE = /^[a-zA-Z0-9._/-]{1,120}$/;

// Fast deterministic 64-bit FNV-1a style fingerprint (compact for localStorage snapshots)
export function hashString(input = '') {
  const str = String(input);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}:${str.length}`;
}

export function validateGitHubFilePath(rawPath) {
  if (typeof rawPath !== 'string') return null;
  const clean = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!clean || clean.includes('\0') || clean.includes('..') || clean.endsWith('/')) return null;
  const parts = clean.split('/');
  if (parts.some((seg) => !seg || seg === '.' || seg === '..' || seg === '.git')) return null;
  return clean;
}

export function validateGitHubOwner(owner) {
  if (typeof owner !== 'string') return null;
  const clean = owner.trim();
  if (!clean || clean === '.' || clean === '..' || clean.includes('..')) return null;
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(clean) ? clean : null;
}

export function validateGitHubRepo(repo) {
  if (typeof repo !== 'string') return null;
  const clean = repo.trim().replace(/\.git$/i, '');
  if (!clean || clean === '.' || clean === '..' || clean.includes('..')) return null;
  return VALID_SEGMENT_RE.test(clean) ? clean : null;
}

export function validateGitHubBranch(branch) {
  if (typeof branch !== 'string') return null;
  const clean = branch.trim().replace(/^refs\/heads\//, '');
  if (!clean || clean.startsWith('/') || clean.endsWith('/') || clean.includes('..') || clean.includes('//')) {
    return null;
  }
  return VALID_BRANCH_RE.test(clean) ? clean : null;
}

export function parseRepoSlug(input, fallbackOwner = '') {
  const raw = String(input || '').trim();
  if (!raw || raw.includes('..')) return null;

  const isGitHubUrl = /^https?:\/\/(www\.)?github\.com\//i.test(raw);
  let cleaned = raw
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');

  const parts = cleaned.split('/').filter(Boolean);
  if (parts.some((p) => p === '.' || p === '..')) return null;

  if (parts.length === 2 || (isGitHubUrl && parts.length >= 2)) {
    const owner = validateGitHubOwner(parts[0]);
    const repo = validateGitHubRepo(parts[1]);
    if (!owner || !repo) return null;
    return { owner, repo, fullName: `${owner}/${repo}` };
  }

  if (parts.length === 1 && fallbackOwner) {
    const owner = validateGitHubOwner(fallbackOwner);
    const repo = validateGitHubRepo(parts[0]);
    if (!owner || !repo) return null;
    return { owner, repo, fullName: `${owner}/${repo}` };
  }

  return null;
}

export function getEntrySignature(entry) {
  if (typeof entry === 'string') {
    return `t:${hashString(entry)}`;
  }
  if (entry && typeof entry === 'object' && entry.__media === true && typeof entry.dataUrl === 'string') {
    return `m:${hashString(entry.dataUrl)}`;
  }
  return null;
}

export function buildGitHubSnapshot(files = {}) {
  const snapshot = {};
  if (!files || typeof files !== 'object') return snapshot;
  for (const [rawPath, entry] of Object.entries(files)) {
    const path = validateGitHubFilePath(rawPath);
    if (!path) continue;
    const sig = getEntrySignature(entry);
    if (sig) snapshot[path] = sig;
  }
  return snapshot;
}

export function computeGitHubChanges(currentFiles = {}, syncedSnapshot = null) {
  const normalizedCurrent = {};
  if (currentFiles && typeof currentFiles === 'object') {
    for (const [rawPath, entry] of Object.entries(currentFiles)) {
      const path = validateGitHubFilePath(rawPath);
      const sig = getEntrySignature(entry);
      if (path && sig) normalizedCurrent[path] = sig;
    }
  }

  const hasBaseline = Boolean(
    syncedSnapshot && typeof syncedSnapshot === 'object' && Object.keys(syncedSnapshot).length > 0
  );

  const added = [];
  const modified = [];
  const deleted = [];
  const unchanged = [];

  if (!hasBaseline) {
    for (const path of Object.keys(normalizedCurrent).sort((a, b) => a.localeCompare(b))) {
      added.push(path);
    }
  } else {
    for (const path of Object.keys(normalizedCurrent).sort((a, b) => a.localeCompare(b))) {
      if (syncedSnapshot[path] === undefined) {
        added.push(path);
      } else if (syncedSnapshot[path] !== normalizedCurrent[path]) {
        modified.push(path);
      } else {
        unchanged.push(path);
      }
    }
    for (const path of Object.keys(syncedSnapshot).sort((a, b) => a.localeCompare(b))) {
      if (normalizedCurrent[path] === undefined) {
        deleted.push(path);
      }
    }
  }

  const changes = [
    ...modified.map((path) => ({ path, status: 'modified' })),
    ...added.map((path) => ({ path, status: 'added' })),
    ...deleted.map((path) => ({ path, status: 'deleted' })),
  ].sort((a, b) => a.path.localeCompare(b.path));

  const statusMap = {};
  for (const c of changes) {
    statusMap[c.path] = c.status;
  }

  return {
    hasBaseline,
    added,
    modified,
    deleted,
    unchanged,
    changes,
    statusMap,
    totalChanges: changes.length,
  };
}
