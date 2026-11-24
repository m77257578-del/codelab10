// Pure workspace file/folder CRUD helpers with path normalization & validation

import { detectLang, getLangMeta } from './workspaces';

export function normalizeWorkspacePath(rawPath = '') {
  const cleaned = String(rawPath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (!cleaned) return '';
  const segments = cleaned.split('/').filter(Boolean);
  if (segments.some((seg) => seg === '.' || seg === '..')) return '';
  return segments.join('/');
}

export function createWorkspaceFile(files = {}, rawPath, initialContent) {
  const clean = normalizeWorkspacePath(rawPath);
  if (!clean) {
    return { ok: false, reason: 'invalid', path: '', files };
  }
  if (files[clean] !== undefined) {
    return { ok: false, reason: 'exists', path: clean, files };
  }
  const detected = detectLang(clean);
  const starter =
    initialContent !== undefined ? initialContent : getLangMeta(detected).starter || '';
  return {
    ok: true,
    path: clean,
    files: { ...files, [clean]: starter },
  };
}

export function renameWorkspaceFile(files = {}, oldPath, rawNewPath) {
  const cleanOld = normalizeWorkspacePath(oldPath);
  const cleanNew = normalizeWorkspacePath(rawNewPath);
  if (!cleanOld || !cleanNew || files[cleanOld] === undefined) {
    return { ok: false, reason: 'invalid', oldPath: cleanOld, newPath: cleanNew, files };
  }
  if (cleanOld === cleanNew) {
    return { ok: false, reason: 'unchanged', oldPath: cleanOld, newPath: cleanNew, files };
  }
  if (files[cleanNew] !== undefined) {
    return { ok: false, reason: 'exists', oldPath: cleanOld, newPath: cleanNew, files };
  }
  const next = { ...files };
  next[cleanNew] = next[cleanOld];
  delete next[cleanOld];
  return {
    ok: true,
    oldPath: cleanOld,
    newPath: cleanNew,
    files: next,
  };
}

export function deleteWorkspaceFile(files = {}, targetPath) {
  if (!targetPath || files[targetPath] === undefined) {
    return { ok: false, files };
  }
  const next = { ...files };
  delete next[targetPath];
  return { ok: true, path: targetPath, files: next };
}

export function deleteWorkspaceFolder(files = {}, folderPrefix) {
  const cleanPrefix = normalizeWorkspacePath(folderPrefix);
  if (!cleanPrefix) return { ok: false, removedPaths: [], files };
  const prefixWithSlash = `${cleanPrefix}/`;
  const removedPaths = [];
  const next = {};
  for (const [path, entry] of Object.entries(files)) {
    if (path === cleanPrefix || path.startsWith(prefixWithSlash)) {
      removedPaths.push(path);
    } else {
      next[path] = entry;
    }
  }
  if (removedPaths.length === 0) {
    return { ok: false, removedPaths: [], files };
  }
  return { ok: true, removedPaths, files: next };
}

export function renameWorkspaceFolder(files = {}, oldPrefix, rawNewPrefix) {
  const cleanOld = normalizeWorkspacePath(oldPrefix);
  const cleanNew = normalizeWorkspacePath(rawNewPrefix);
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) {
    return { ok: false, reason: 'invalid', renamedMap: {}, files };
  }
  const oldWithSlash = `${cleanOld}/`;
  const newWithSlash = `${cleanNew}/`;
  const toMove = Object.keys(files).filter((p) => p.startsWith(oldWithSlash));
  if (toMove.length === 0) {
    return { ok: false, reason: 'empty', renamedMap: {}, files };
  }
  // Check for collisions before mutating
  for (const src of toMove) {
    const dest = newWithSlash + src.slice(oldWithSlash.length);
    if (files[dest] !== undefined && !dest.startsWith(oldWithSlash)) {
      return { ok: false, reason: 'exists', renamedMap: {}, files };
    }
  }
  const next = { ...files };
  const renamedMap = {};
  for (const src of toMove) {
    const dest = newWithSlash + src.slice(oldWithSlash.length);
    renamedMap[src] = dest;
    next[dest] = next[src];
    delete next[src];
  }
  return { ok: true, renamedMap, oldPrefix: cleanOld, newPrefix: cleanNew, files: next };
}
