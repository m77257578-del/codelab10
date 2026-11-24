// Server-only cryptographic helpers for OAuth state signing and encrypted session tokens

import crypto from 'node:crypto';

function getMasterKey() {
  if (!globalThis.__codelabMasterKey) {
    const envSecret = process.env.SESSION_SECRET;
    if (envSecret && envSecret.length >= 16) {
      globalThis.__codelabMasterKey = crypto.createHash('sha256').update(envSecret).digest();
    } else {
      globalThis.__codelabMasterKey = crypto.randomBytes(32);
    }
  }
  return globalThis.__codelabMasterKey;
}

export function encryptSession(payload) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptSession(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const key = getMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted);
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function signState(payload) {
  const key = getMasterKey();
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyState(stateToken) {
  try {
    if (!stateToken || typeof stateToken !== 'string') return null;
    const dot = stateToken.lastIndexOf('.');
    if (dot === -1) return null;
    const body = stateToken.slice(0, dot);
    const sig = stateToken.slice(dot + 1);
    const key = getMasterKey();
    const expected = crypto.createHmac('sha256', key).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
