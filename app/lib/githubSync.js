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

export function normalizeGitHubRepoName(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/\.git$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function suggestGitHubRepoName(projectName = '') {
  const cleaned = normalizeGitHubRepoName(projectName);
  if (cleaned && validateGitHubRepo(cleaned)) {
    return cleaned;
  }
  return 'my-codelab-project';
}

export function extractMediaBase64(entry) {
  if (!entry || typeof entry !== 'object' || !entry.__media || typeof entry.dataUrl !== 'string') {
    return null;
  }
  const comma = entry.dataUrl.indexOf(',');
  if (comma === -1) return null;
  const meta = entry.dataUrl.slice(0, comma);
  const body = entry.dataUrl.slice(comma + 1);
  if (/;base64/i.test(meta)) return body.replace(/\s+/g, '');
  try {
    return Buffer.from(decodeURIComponent(body), 'utf8').toString('base64');
  } catch {
    return Buffer.from(body, 'utf8').toString('base64');
  }
}

export function pickInitialSeedEntry(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  let bestIdx = 0;
  let bestScore = Infinity;
  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    const len = typeof item?.content === 'string' ? item.content.length : 0;
    const isText = item?.encoding === 'utf-8';
    const isNonEmpty = len > 0;
    // Prefer smallest non-empty UTF-8 file so empty-repo initialization via PUT /contents is tiny and fast
    let score = len;
    if (!isText) score += 10_000_000;
    if (!isNonEmpty) score += 1_000_000;
    if (/^(readme\.md|index\.html?|package\.json)$/i.test(item?.path || '')) {
      score = Math.max(0, score - 500);
    }
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return {
    first: entries[bestIdx],
    rest: entries.filter((_, idx) => idx !== bestIdx),
  };
}

export function formatGitHubApiError({ status = 400, data = {}, phase = 'push', isPrivate = false, locale = 'ar' } = {}) {
  const isEn = locale === 'en';
  const rawMessage = String(data?.message || '').trim();
  const detailMessages = Array.isArray(data?.errors)
    ? data.errors
        .map((e) => (typeof e === 'string' ? e : e?.message || (e?.field ? `${e.field}: ${e.code || 'invalid'}` : '')))
        .filter(Boolean)
    : [];
  const combined = [rawMessage, ...detailMessages].join(' ').toLowerCase();

  if (status === 401 || /bad credentials|requires authentication/i.test(combined)) {
    return isEn
      ? 'GitHub session expired or token is invalid. Please reconnect your GitHub account.'
      : 'انتهت جلسة GitHub أو رمز الوصول غير صالح. يرجى إعادة ربط حسابك على GitHub.';
  }

  if (combined.includes('name already exists')) {
    return isEn
      ? 'A repository with this name already exists on your GitHub account. Choose a different name or link the existing repository.'
      : 'يوجد مستودع بهذا الاسم بالفعل على حسابك في GitHub. اختر اسماً مختلفاً أو اربط المستودع القائم.';
  }

  if (status === 403 || combined.includes('resource not accessible') || combined.includes('insufficient') || combined.includes('scope')) {
    if (phase === 'createRepo') {
      if (isPrivate) {
        return isEn
          ? 'Your GitHub token does not have permission to create a private repository. Grant full "repo" scope (or "Administration: Read & write" for fine-grained tokens), or create a public repository.'
          : 'رمز GitHub الحالي لا يملك صلاحية إنشاء مستودع خاص. فعّل صلاحية "repo" الكاملة (أو Administration: Read & write)، أو أنشئ مستودعاً عاماً.';
      }
      return isEn
        ? 'Your GitHub token lacks permission to create repositories. Make sure the token has "repo" scope (Classic PAT) or "Administration + Contents: Read & write" (Fine-grained PAT).'
        : 'رمز GitHub الحالي لا يملك صلاحية إنشاء مستودعات. تأكد من تفعيل صلاحية "repo" (في Classic PAT) أو "Administration و Contents: Read & write" (في Fine-grained PAT).';
    }
    return isEn
      ? 'Your GitHub token lacks write permission ("repo" or "Contents: Read & write") for this repository.'
      : 'رمز GitHub الحالي لا يملك صلاحية الكتابة ("repo" أو "Contents: Read & write") على هذا المستودع.';
  }

  if (status === 404) {
    if (phase === 'createRepo') {
      return isEn
        ? 'Could not create or access the new repository on GitHub. Check that your token has "repo" creation permission.'
        : 'تعذر إنشاء أو الوصول إلى المستودع الجديد على GitHub. تأكد من أن رمز الوصول يمتلك صلاحية إنشاء المستودعات (repo).';
    }
    return isEn
      ? 'Repository or branch was not found on GitHub, or your token does not have access to it.'
      : 'المستودع أو الفرع غير موجود على GitHub، أو لا يملك رمزك صلاحية الوصول إليه.';
  }

  if (status === 422 && detailMessages.length > 0) {
    const detailsText = detailMessages.join(' · ');
    return isEn
      ? `GitHub rejected the request: ${detailsText}`
      : `رفض GitHub الطلب: ${detailsText}`;
  }

  if (rawMessage) {
    return rawMessage;
  }

  return isEn ? 'An error occurred while pushing to GitHub.' : 'حدث خطأ أثناء الرفع إلى GitHub.';
}

