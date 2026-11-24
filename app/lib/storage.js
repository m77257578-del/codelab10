// IndexedDB workspace persistence + pure-JS offline ZIP project exporter

const DB_NAME = 'codelab_ide_db';
const STORE_NAME = 'workspace';
const FILES_KEY = 'files_v2';
const PROJECT_NAME_KEY = 'codelab_project_name_v1';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadWorkspaceFiles() {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(FILES_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveWorkspaceFiles(files) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(files, FILES_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export function loadProjectName() {
  try {
    return localStorage.getItem(PROJECT_NAME_KEY) || 'my-codelab-project';
  } catch {
    return 'my-codelab-project';
  }
}

export function saveProjectName(name) {
  try {
    localStorage.setItem(PROJECT_NAME_KEY, name);
  } catch {}
}

export function isMediaEntry(entry) {
  return Boolean(entry && typeof entry === 'object' && entry.__media === true);
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function sanitizeProjectName(raw = '') {
  const clean = String(raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');
  return clean || 'my-codelab-project';
}

// CRC-32 lookup table for standard ZIP archives
const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dataUrlToUint8Array(dataUrl) {
  try {
    const comma = dataUrl.indexOf(',');
    if (comma === -1) return new Uint8Array(0);
    const meta = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      const bin = atob(body);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    }
    return new TextEncoder().encode(decodeURIComponent(body));
  } catch {
    return new Uint8Array(0);
  }
}

// Build a real uncompressed ZIP Blob with UTF-8 filenames (works 100% offline)
export function buildProjectZip(projectName, files) {
  const folder = sanitizeProjectName(projectName);
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const [path, entry] of Object.entries(files || {})) {
    const cleanPath = path.replace(/^\/+/, '');
    if (!cleanPath) continue;
    const fullNameBytes = enc.encode(`${folder}/${cleanPath}`);
    const dataBytes = isMediaEntry(entry)
      ? dataUrlToUint8Array(entry.dataUrl || '')
      : enc.encode(typeof entry === 'string' ? entry : '');
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + filename)
    const lfh = new Uint8Array(30 + fullNameBytes.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // compression: 0 = store
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x5421, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, fullNameBytes.length, true);
    lv.setUint16(28, 0, true);
    lfh.set(fullNameBytes, 30);

    parts.push(lfh, dataBytes);

    // Central directory header (46 bytes + filename)
    const cdh = new Uint8Array(46 + fullNameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, fullNameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cdh.set(fullNameBytes, 46);

    central.push(cdh);
    offset += lfh.length + dataBytes.length;
  }

  let cdSize = 0;
  for (const c of central) {
    parts.push(c);
    cdSize += c.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);
  parts.push(eocd);

  return new Blob(parts, { type: 'application/zip' });
}
