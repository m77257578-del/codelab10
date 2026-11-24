import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeMediaDataUrl,
  getAssetMimeType,
  getPreviewSnapshot,
  injectBaseHref,
  resolveSnapshotAsset,
  sanitizePreviewId,
  savePreviewSnapshot,
} from './previewServerStore.js';

test('sanitizePreviewId cleans invalid characters and enforces safe slugs', () => {
  assert.equal(sanitizePreviewId('my project / test!'), 'my-project-test');
  assert.equal(sanitizePreviewId(''), 'codelab-live');
  assert.equal(sanitizePreviewId('next-app_v2.1'), 'next-app_v2.1');
});

test('getAssetMimeType and decodeMediaDataUrl handle web assets and binary media', () => {
  assert.equal(getAssetMimeType('styles.css'), 'text/css; charset=utf-8');
  assert.equal(getAssetMimeType('app.tsx'), 'application/javascript; charset=utf-8');
  assert.equal(getAssetMimeType('data.json'), 'application/json; charset=utf-8');
  assert.equal(getAssetMimeType('hero.png'), 'image/png');

  const pngStub = Buffer.from('fakepng').toString('base64');
  const decoded = decodeMediaDataUrl(`data:image/png;base64,${pngStub}`);
  assert.equal(decoded.mime, 'image/png');
  assert.equal(decoded.buffer.toString('utf8'), 'fakepng');
});

test('savePreviewSnapshot, getPreviewSnapshot, and resolveSnapshotAsset serve no-HTML multi-file routes and assets', () => {
  const files = {
    'app/globals.css': 'body { background: #0f172a; }',
    'app/page.jsx': 'export default function Home() { return <h1>Home Page</h1>; }',
    'app/about/page.jsx': 'export default function About() { return <h1>About Route</h1>; }',
    'data/users.json': '{"users":["Ali","Sara"]}',
    'assets/logo.png': {
      __media: true,
      mime: 'image/png',
      dataUrl: `data:image/png;base64,${Buffer.from('PNGDATA').toString('base64')}`,
    },
  };

  const snap = savePreviewSnapshot('test-site-101', {
    html: '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>',
    files,
    activeFile: 'app/page.jsx',
    locale: 'en',
  });

  assert.equal(snap.id, 'test-site-101');
  const loaded = getPreviewSnapshot('test-site-101');
  assert.ok(loaded);

  const jsonAsset = resolveSnapshotAsset(loaded, 'data/users.json');
  assert.equal(jsonAsset.contentType, 'application/json; charset=utf-8');
  assert.match(jsonAsset.body, /"Ali"/);

  const cssAsset = resolveSnapshotAsset(loaded, 'app/globals.css');
  assert.equal(cssAsset.contentType, 'text/css; charset=utf-8');
  assert.match(cssAsset.body, /#0f172a/);

  const mediaAsset = resolveSnapshotAsset(loaded, 'assets/logo.png');
  assert.equal(mediaAsset.contentType, 'image/png');
  assert.equal(mediaAsset.body.toString('utf8'), 'PNGDATA');

  const aboutPage = resolveSnapshotAsset(loaded, 'about');
  assert.equal(aboutPage.contentType, 'text/html; charset=utf-8');
  assert.match(aboutPage.body, /About Route/);

  const injected = injectBaseHref('<html><head><title>x</title></head></html>', '/preview/test-site-101/');
  assert.match(injected, /<base href="\/preview\/test-site-101\/">/);
});
