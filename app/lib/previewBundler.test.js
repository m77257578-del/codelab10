import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileWorkspaceBundle,
  detectJsxOrReact,
  pickScriptEntry,
  preprocessCss,
  resolveModulePath,
} from './previewBundler';
import { buildWebPreviewDoc } from './runner';

test('resolveModulePath handles relative, extensionless, and @/ alias paths', () => {
  const files = {
    'src/App.tsx': 'export default function App() { return null; }',
    'src/components/Card.jsx': 'export function Card() { return null; }',
    'src/utils/index.ts': 'export const x = 1;',
  };
  assert.equal(resolveModulePath('./components/Card', 'src/App.tsx', files), 'src/components/Card.jsx');
  assert.equal(resolveModulePath('@/components/Card', 'src/App.tsx', files), 'src/components/Card.jsx');
  assert.equal(resolveModulePath('./utils', 'src/App.tsx', files), 'src/utils/index.ts');
  assert.equal(resolveModulePath('react', 'src/App.tsx', files), null);
});

test('pickScriptEntry prefers active script file or standard React/JS entrypoints', () => {
  const files = {
    'styles.css': 'body { color: red; }',
    'src/App.tsx': 'export default function App() { return <h1>Hi</h1>; }',
  };
  assert.equal(pickScriptEntry(files, 'styles.css'), 'src/App.tsx');
  assert.equal(pickScriptEntry({ 'app.js': 'console.log(1)', 'index.js': 'console.log(2)' }, 'app.js'), 'app.js');
});

test('buildWebPreviewDoc previews HTML with empty body cleanly with empty-body observer', () => {
  const files = {
    'index.html': '<!DOCTYPE html><html><head><title>Empty</title></head><body></body></html>',
  };
  const doc = buildWebPreviewDoc(files, 'index.html', true, 'ar');
  assert.match(doc, /codelab-empty-preview-fallback/);
  assert.match(doc, /MutationObserver/);
  assert.doesNotMatch(doc, /لا يوجد ملف HTML/);
});

test('buildWebPreviewDoc previews HTML fragment without <html> or <body> tags', () => {
  const files = {
    'snippet.html': '<script>console.log("hi");</script>',
  };
  const doc = buildWebPreviewDoc(files, 'snippet.html', true, 'en');
  assert.match(doc, /<body>/);
  assert.match(doc, /codelab-empty-preview-fallback/);
});

test('buildWebPreviewDoc previews React JSX/TSX workspace even with NO HTML file', () => {
  const files = {
    'App.tsx': `import React, { useState } from 'react';
import { Badge } from './Badge';
import './styles.css';
export default function App() {
  const [n, setN] = useState(0);
  return <div className="box"><Badge /><button onClick={() => setN(n + 1)}>{n}</button></div>;
}`,
    'Badge.tsx': `export function Badge() { return <span>Live</span>; }`,
    'styles.css': `.box { padding: 16px; }`,
  };
  const doc = buildWebPreviewDoc(files, 'App.tsx', true, 'ar');
  assert.match(doc, /window\.React = React/);
  assert.match(doc, /<div id="root"><\/div>/);
  assert.match(doc, /\.box \{ padding: 16px; \}/);
  assert.match(doc, /React\.createElement/);
  assert.doesNotMatch(doc, /لا يوجد ملف HTML/);
});

test('buildWebPreviewDoc previews plain JS/TS without HTML and includes console bridge & fallback', () => {
  const files = {
    'main.ts': `const msg: string = "Hello TS"; console.log(msg);`,
  };
  const doc = buildWebPreviewDoc(files, 'main.ts', true, 'en');
  assert.match(doc, /const msg = "Hello TS"/);
  assert.match(doc, /codelab-empty-preview-fallback/);
  assert.doesNotMatch(doc, /No HTML file found/);
});

test('buildWebPreviewDoc previews standalone CSS/SCSS without HTML', () => {
  const files = {
    'theme.scss': `$accent: #0ea5e9;\nbutton { background: $accent; }`,
  };
  const doc = buildWebPreviewDoc(files, 'theme.scss', true, 'en');
  assert.match(doc, /background: #0ea5e9;/);
  assert.match(doc, /Live CSS Preview/);
});

test('buildWebPreviewDoc previews JSON without HTML cleanly', () => {
  const files = {
    'config.json': '{"app":"CodeLab","ok":true}',
  };
  const doc = buildWebPreviewDoc(files, 'config.json', true, 'en');
  assert.match(doc, /Valid JSON/);
  assert.match(doc, /&quot;app&quot;: &quot;CodeLab&quot;/);
});

test('compileWorkspaceBundle escapes </script> inside module code safely', () => {
  const files = {
    'app.js': 'const s = "</script><script>alert(1)</script>"; console.log(s);',
  };
  const { runtimeScript } = compileWorkspaceBundle(files, 'app.js');
  // Only the closing tag at the very end should be unescaped </script>
  const occurrences = runtimeScript.match(/<\/script>/gi) || [];
  assert.equal(occurrences.length, 1);
  assert.equal(detectJsxOrReact('export default function App() { return <div>Hi</div>; }', 'App.js'), true);
  assert.equal(preprocessCss('$c: red; a { color: $c; }', 'a.scss').trim(), 'a { color: red; }');
});
