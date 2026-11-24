// Server-side in-memory + temp-dir store for live local preview URLs (/preview/<id>)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWebPreviewDoc } from './runner';
import { preprocessCss, transpileModuleCode, transpileClassicScript, isScriptFile, isStyleFile } from './previewBundler';

const STORE_DIR = path.join(os.tmpdir(), 'codelab-previews');
const MAX_SNAPSHOTS = 60;

function getStoreMap() {
  if (!globalThis.__codelabPreviewStore) {
    globalThis.__codelabPreviewStore = new Map();
  }
  return globalThis.__codelabPreviewStore;
}

export function sanitizePreviewId(raw = '') {
  const clean = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return clean || 'codelab-live';
}

export function getAssetMimeType(filePath = '') {
  const ext = String(filePath).split('.').pop()?.toLowerCase() || '';
  const map = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    scss: 'text/css; charset=utf-8',
    sass: 'text/css; charset=utf-8',
    less: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    cjs: 'application/javascript; charset=utf-8',
    jsx: 'application/javascript; charset=utf-8',
    ts: 'application/javascript; charset=utf-8',
    tsx: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    avif: 'image/avif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    md: 'text/markdown; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

export function decodeMediaDataUrl(dataUrl = '') {
  try {
    const str = String(dataUrl || '');
    const comma = str.indexOf(',');
    if (comma === -1) return null;
    const meta = str.slice(0, comma);
    const body = str.slice(comma + 1);
    const mimeMatch = meta.match(/^data:([^;]+)/i);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    if (/;base64/i.test(meta)) {
      return { buffer: Buffer.from(body, 'base64'), mime };
    }
    return { buffer: Buffer.from(decodeURIComponent(body), 'utf8'), mime };
  } catch {
    return null;
  }
}

export function savePreviewSnapshot(rawId, payload = {}) {
  const id = sanitizePreviewId(rawId);
  const map = getStoreMap();

  const snapshot = {
    id,
    html: typeof payload.html === 'string' ? payload.html : '',
    files: payload.files && typeof payload.files === 'object' ? payload.files : {},
    activeFile: typeof payload.activeFile === 'string' ? payload.activeFile : '',
    projectName: typeof payload.projectName === 'string' ? payload.projectName : 'my-codelab-project',
    locale: payload.locale === 'en' ? 'en' : 'ar',
    updatedAt: Date.now(),
  };

  if (map.has(id)) map.delete(id);
  map.set(id, snapshot);
  while (map.size > MAX_SNAPSHOTS) {
    const oldest = map.keys().next().value;
    if (oldest) map.delete(oldest);
    else break;
  }

  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(path.join(STORE_DIR, `${id}.json`), JSON.stringify(snapshot), 'utf8');
  } catch {
    // Ignore tmpfs write failures in read-only environments
  }

  return snapshot;
}

export function getPreviewSnapshot(rawId) {
  const id = sanitizePreviewId(rawId);
  const map = getStoreMap();
  if (map.has(id)) return map.get(id);

  try {
    const filePath = path.join(STORE_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        map.set(id, parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore read/parse errors
  }

  return null;
}

export function injectBaseHref(html = '', baseHref = '/') {
  if (!html || typeof html !== 'string') return '';
  if (/<base\b/i.test(html)) return html;
  const tag = `<base href="${String(baseHref).replace(/"/g, '&quot;')}">`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b([^>]*)>/i, `<head$1>${tag}`);
  }
  return `${tag}${html}`;
}

export function resolveSnapshotAsset(snapshot, rawAssetPath = '') {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const files = snapshot.files || {};
  const clean = String(rawAssetPath || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  if (!clean || clean.includes('..')) return null;

  // 1. Direct file or basename match
  let matchedKey =
    files[clean] !== undefined
      ? clean
      : Object.keys(files).find((k) => k === clean || k.endsWith('/' + clean));

  if (matchedKey) {
    const entry = files[matchedKey];
    if (entry && typeof entry === 'object' && entry.__media && entry.dataUrl) {
      const decoded = decodeMediaDataUrl(entry.dataUrl);
      if (decoded) {
        return { body: decoded.buffer, contentType: entry.mime || decoded.mime };
      }
    }
    if (typeof entry === 'string') {
      if (/\.(html|htm)$/i.test(matchedKey)) {
        const html = buildWebPreviewDoc(files, matchedKey, false, snapshot.locale || 'ar', {
          baseHref: `/preview/${snapshot.id}/`,
        });
        return { body: html, contentType: 'text/html; charset=utf-8' };
      }
      if (isStyleFile(matchedKey)) {
        return {
          body: preprocessCss(entry, matchedKey),
          contentType: 'text/css; charset=utf-8',
        };
      }
      if (isScriptFile(matchedKey)) {
        const isModule = /^\s*(?:import|export)\s+/m.test(entry) || /\.(jsx|tsx|mjs)$/i.test(matchedKey);
        const code = isModule
          ? transpileModuleCode(entry, matchedKey)
          : transpileClassicScript(entry, matchedKey);
        return { body: code, contentType: 'application/javascript; charset=utf-8' };
      }
      return { body: entry, contentType: getAssetMimeType(matchedKey) };
    }
  }

  // 2. Sub-page route lookup (e.g. /preview/<id>/about -> about.html or app/about/page.jsx)
  const routeCandidates = [
    `${clean}.html`,
    `${clean}.htm`,
    `${clean}/index.html`,
    `${clean}/index.htm`,
    `app/${clean}/page.tsx`,
    `app/${clean}/page.jsx`,
    `app/${clean}/page.js`,
    `src/app/${clean}/page.tsx`,
    `src/app/${clean}/page.jsx`,
    `src/app/${clean}/page.js`,
    `pages/${clean}.tsx`,
    `pages/${clean}.jsx`,
    `pages/${clean}.js`,
  ];
  const pageMatch = routeCandidates.find((c) => typeof files[c] === 'string');
  if (pageMatch) {
    const html = buildWebPreviewDoc(files, pageMatch, false, snapshot.locale || 'ar', {
      baseHref: `/preview/${snapshot.id}/`,
    });
    return { body: html, contentType: 'text/html; charset=utf-8' };
  }

  // 3. SPA fallback for extensionless client routes when the project has HTML or JS app
  if (!clean.includes('.') && snapshot.html) {
    return {
      body: injectBaseHref(snapshot.html, `/preview/${snapshot.id}/`),
      contentType: 'text/html; charset=utf-8',
    };
  }

  return null;
}
