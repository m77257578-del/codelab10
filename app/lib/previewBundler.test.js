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

test('pickScriptEntry keeps full app preview when editing helper/component/layout/json files without HTML', () => {
  const files = {
    'package.json': '{"name":"demo-app"}',
    'src/App.jsx': `import Header from './components/Header';
import { formatTitle } from './utils/format';
export default function App() { return <div><Header title={formatTitle('CodeLab')} /></div>; }`,
    'src/components/Header.jsx': `export default function Header({ title }) { return <h1>{title}</h1>; }`,
    'src/utils/format.js': `export const formatTitle = (t) => t.toUpperCase();`,
    'src/styles.css': `h1 { color: skyblue; }`,
  };
  assert.equal(pickScriptEntry(files, 'src/components/Header.jsx'), 'src/App.jsx');
  assert.equal(pickScriptEntry(files, 'src/utils/format.js'), 'src/App.jsx');
  assert.equal(pickScriptEntry(files, 'src/styles.css'), 'src/App.jsx');
  assert.equal(pickScriptEntry(files, 'package.json'), 'src/App.jsx');

  const docFromHelper = buildWebPreviewDoc(files, 'src/utils/format.js', true, 'ar');
  assert.match(docFromHelper, /src\/App\.jsx/);
  assert.match(docFromHelper, /src\/components\/Header\.jsx/);
  assert.match(docFromHelper, /h1 \{ color: skyblue; \}/);
});

test('buildWebPreviewDoc links non-imported sibling JS/TS helpers and CSS when no HTML exists', () => {
  const files = {
    'theme.css': `.badge { color: #38bdf8; }`,
    'helpers.ts': `function formatGreeting(name: string): string { return "Hello " + name; }`,
    'app.js': `const box = document.createElement('div'); box.className = 'badge'; box.textContent = formatGreeting('World'); document.body.appendChild(box);`,
  };
  const doc = buildWebPreviewDoc(files, 'app.js', true, 'en');
  assert.match(doc, /<style>[\s\S]*\.badge \{ color: #38bdf8; \}[\s\S]*<\/style>/);
  assert.match(doc, /<script data-file="helpers\.ts">[\s\S]*function formatGreeting\(name\)/);
  assert.match(doc, /formatGreeting\('World'\)/);
});

test('buildWebPreviewDoc composes Next.js app/layout.js + app/page.js + app/globals.css without HTML', () => {
  const files = {
    'app/globals.css': `@tailwind base;\n@tailwind utilities;\n.hero { padding: 24px; }`,
    'app/layout.js': `export default function RootLayout({ children }) { return <html lang="ar"><body className="bg-slate-900 text-white">{children}</body></html>; }`,
    'app/page.js': `export default function HomePage() { return <main className="hero flex gap-4"><h1>Next App</h1></main>; }`,
  };
  const doc = buildWebPreviewDoc(files, 'app/layout.js', false, 'ar');
  assert.match(doc, /data-codelab-body/);
  assert.match(doc, /data-codelab-tw="true"/);
  assert.match(doc, /\.hero \{ padding: 24px; \}/);
  assert.doesNotMatch(doc, /@tailwind base;/);
  assert.match(doc, /codelab-empty-preview-fallback/);
});

test('buildWebPreviewDoc auto-links unlinked CSS and script when HTML lacks <link>/<script> and avoids duplicates when linked', () => {
  const unlinkedFiles = {
    'index.html': `<!DOCTYPE html><html><head><title>App</title></head><body><div id="root"></div></body></html>`,
    'styles.css': `.card { border: 1px solid #ccc; }`,
    'App.jsx': `export default function App() { return <div className="card">Auto Linked</div>; }`,
  };
  const unlinkedDoc = buildWebPreviewDoc(unlinkedFiles, 'index.html', true, 'en');
  assert.match(unlinkedDoc, /\.card \{ border: 1px solid #ccc; \}/);
  assert.match(unlinkedDoc, /Auto Linked/);

  const linkedFiles = {
    'index.html': `<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><div id="app"></div><script src="app.js"></script></body></html>`,
    'styles.css': `.card { color: red; }`,
    'app.js': `console.log('once');`,
  };
  const linkedDoc = buildWebPreviewDoc(linkedFiles, 'index.html', true, 'en');
  assert.equal((linkedDoc.match(/data-file="app\.js"/g) || []).length, 1);
  assert.equal((linkedDoc.match(/data-file="styles\.css"/g) || []).length, 1);
});

