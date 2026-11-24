// In-browser multi-file bundler, offline React/JSX runtime shim, and empty-body live preview support

import { transform } from 'sucrase';
import { isMediaEntry } from './storage';

export function escapeInlineScript(code = '') {
  return String(code).replace(/<\/(script)/gi, '<\\/$1');
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isScriptFile(path = '') {
  return /\.(js|mjs|cjs|jsx|ts|tsx)$/i.test(path);
}

export function isStyleFile(path = '') {
  return /\.(css|scss|sass|less)$/i.test(path);
}

export function isHtmlFile(path = '') {
  return /\.(html|htm)$/i.test(path);
}

export function isNonAppWorkspaceFile(path = '') {
  const p = String(path || '');
  return (
    /(?:^|\/)(?:dist|node_modules|\.next|\.git)\//i.test(p) ||
    /^app\/api\//i.test(p) ||
    /\.(?:test|spec)\.[^/]+$/i.test(p) ||
    /^(?:next|tailwind|postcss|vite|eslint|jest|vitest|babel)\.config\.[^/]+$/i.test(p) ||
    /-copy\d*\.(?:js|mjs|cjs|jsx|ts|tsx)$/i.test(p)
  );
}

// Lightweight offline Tailwind-compatible utility baseline for JSX/HTML classes without network access
export const TAILWIND_SHIM_CSS = `
.flex{display:flex}.inline-flex{display:inline-flex}.grid{display:grid}.block{display:block}.inline-block{display:inline-block}.hidden{display:none}
.flex-col{flex-direction:column}.flex-row{flex-direction:row}.flex-wrap{flex-wrap:wrap}.flex-1{flex:1 1 0%}
.items-center{align-items:center}.items-start{align-items:flex-start}.items-end{align-items:flex-end}
.justify-center{justify-content:center}.justify-between{justify-content:space-between}.justify-end{justify-content:flex-end}
.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-5{gap:1.25rem}.gap-6{gap:1.5rem}.gap-8{gap:2rem}
.space-y-2>*+*{margin-top:.5rem}.space-y-3>*+*{margin-top:.75rem}.space-y-4>*+*{margin-top:1rem}.space-y-6>*+*{margin-top:1.5rem}
.p-2{padding:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}.p-5{padding:1.25rem}.p-6{padding:1.5rem}.p-8{padding:2rem}
.px-2{padding-left:.5rem;padding-right:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}.px-6{padding-left:1.5rem;padding-right:1.5rem}
.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-1\\.5{padding-top:.375rem;padding-bottom:.375rem}.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-4{padding-top:1rem;padding-bottom:1rem}.py-8{padding-top:2rem;padding-bottom:2rem}
.m-0{margin:0}.mx-auto{margin-left:auto;margin-right:auto}.mt-2{margin-top:.5rem}.mt-4{margin-top:1rem}.mt-6{margin-top:1.5rem}.mb-2{margin-bottom:.5rem}.mb-4{margin-bottom:1rem}.mb-6{margin-bottom:1.5rem}
.w-full{width:100%}.h-full{height:100%}.min-h-screen{min-height:100vh}.max-w-md{max-width:28rem}.max-w-lg{max-width:32rem}.max-w-xl{max-width:36rem}.max-w-2xl{max-width:42rem}.max-w-4xl{max-width:56rem}.max-w-6xl{max-width:72rem}
.rounded{border-radius:.25rem}.rounded-md{border-radius:.375rem}.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-2xl{border-radius:1rem}.rounded-full{border-radius:9999px}
.border{border-width:1px;border-style:solid;border-color:#e2e8f0}.border-slate-200{border-color:#e2e8f0}.border-slate-700{border-color:#334155}.border-slate-800{border-color:#1e293b}
.shadow{box-shadow:0 1px 3px rgba(0,0,0,.1)}.shadow-md{box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}.shadow-lg{box-shadow:0 10px 15px -3px rgba(0,0,0,.1)}.shadow-xl{box-shadow:0 20px 25px -5px rgba(0,0,0,.1)}
.text-xs{font-size:.75rem;line-height:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-base{font-size:1rem;line-height:1.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}
.font-medium{font-weight:500}.font-semibold{font-weight:600}.font-bold{font-weight:700}.font-mono{font-family:ui-monospace,monospace}.text-center{text-align:center}
.bg-white{background-color:#fff}.bg-slate-50{background-color:#f8fafc}.bg-slate-100{background-color:#f1f5f9}.bg-slate-800{background-color:#1e293b}.bg-slate-900{background-color:#0f172a}.bg-slate-950{background-color:#020617}
.bg-sky-500{background-color:#0ea5e9}.bg-sky-600{background-color:#0284c7}.bg-blue-600{background-color:#2563eb}.bg-emerald-500{background-color:#10b981}.bg-emerald-600{background-color:#059669}.bg-rose-500{background-color:#f43f5e}.bg-amber-500{background-color:#f59e0b}
.text-white{color:#fff}.text-slate-900{color:#0f172a}.text-slate-700{color:#334155}.text-slate-600{color:#475569}.text-slate-500{color:#64748b}.text-slate-400{color:#94a3b8}.text-slate-300{color:#cbd5e1}.text-slate-100{color:#f1f5f9}.text-sky-500{color:#0ea5e9}.text-sky-400{color:#38bdf8}.text-emerald-500{color:#10b981}.text-rose-500{color:#f43f5e}
.cursor-pointer{cursor:pointer}.transition{transition:all .15s ease}.hover\\:opacity-90:hover{opacity:.9}
`;

// Basic SCSS/Tailwind CSS preprocessing (strips @tailwind directives, // comments, resolves simple $variables)
export function preprocessCss(code = '', path = '') {
  let out = String(code || '')
    .replace(/^\s*@tailwind\s+[^;]+;\s*$/gim, '')
    .replace(/^\s*@import\s+["']tailwindcss(?:\/[^"']*)?["']\s*;?\s*$/gim, '');
  if (!/\.(scss|sass)$/i.test(path)) return out;
  const vars = {};
  out = out.replace(/\/\/.*$/gm, '');
  out = out.replace(/^\s*(\$[\w-]+)\s*:\s*([^;]+);/gm, (_, name, val) => {
    vars[name] = val.trim();
    return '';
  });
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(k.replace('$', '\\$') + '\\b', 'g');
    out = out.replace(re, v);
  }
  return out;
}

export function detectJsxOrReact(code = '', path = '') {
  if (/\.(jsx|tsx)$/i.test(path)) return true;
  if (/import\s+[^;]*\bfrom\s+['"]react(?:-dom(?:\/client)?)?['"]/i.test(code)) return true;
  if (/React\.createElement|createRoot\s*\(|ReactDOM\.render\s*\(/.test(code)) return true;
  if (/export\s+default\s+(?:function\s+[A-Z]\w*|\([^)]*\)\s*=>)|function\s+(?:App|Page|Home|Main|RootLayout)\s*\(/.test(code) && /return\s*\(?\s*</.test(code)) {
    return true;
  }
  return false;
}

export function detectTailwindUsage(files = {}) {
  for (const [path, entry] of Object.entries(files)) {
    if (typeof entry !== 'string' || isNonAppWorkspaceFile(path)) continue;
    if (isStyleFile(path) && /@tailwind\b|@import\s+["']tailwindcss["']/i.test(entry)) return true;
    if (
      (isHtmlFile(path) || isScriptFile(path)) &&
      /(?:class|className)\s*=\s*["'][^"']*\b(?:flex|grid|bg-|text-|p-|px-|py-|m-|mx-|my-|rounded|shadow|border|gap-|w-|h-)/i.test(entry)
    ) {
      return true;
    }
  }
  return false;
}

const PREFERRED_SCRIPT_ENTRIES = [
  'src/main.tsx',
  'src/main.jsx',
  'src/main.ts',
  'src/main.js',
  'src/index.tsx',
  'src/index.jsx',
  'src/index.ts',
  'src/index.js',
  'src/App.tsx',
  'src/App.jsx',
  'src/App.ts',
  'src/App.js',
  'app/page.tsx',
  'app/page.jsx',
  'app/page.js',
  'main.tsx',
  'main.jsx',
  'main.ts',
  'main.js',
  'App.tsx',
  'App.jsx',
  'App.ts',
  'App.js',
  'app.tsx',
  'app.jsx',
  'app.ts',
  'app.js',
  'index.tsx',
  'index.jsx',
  'index.ts',
  'index.js',
];

function isSupportingScript(path = '', files = {}) {
  if (!path) return false;
  if (/^(?:src\/|app\/)?(?:components?|lib|utils?|helpers?|hooks?|context|services?|store|types?|styles?|data)\//i.test(path)) {
    return true;
  }
  if (/^(?:src\/|app\/)?layout\.(?:tsx|jsx|ts|js)$/i.test(path)) return true;

  // Check if another workspace script explicitly imports this file
  for (const [otherPath, otherCode] of Object.entries(files)) {
    if (otherPath === path || typeof otherCode !== 'string' || !isScriptFile(otherPath)) continue;
    const importRe = /(?:from\s+|import\s+|require\s*\(\s*|import\s*\(\s*)(['"])([^'"]+)\1/g;
    let m;
    while ((m = importRe.exec(otherCode)) !== null) {
      if (resolveModulePath(m[2], otherPath, files) === path) {
        return true;
      }
    }
  }

  // If file has no side-effect execution (no createRoot, ReactDOM.render, document., window., console.), treat as supporting module
  const code = files[path] || '';
  const hasSideEffects = /(?:createRoot\s*\(|ReactDOM\.render\s*\(|document\.|window\.|console\.)/.test(code);
  const exportsDefaultComponent = /export\s+default\s+/.test(code) && detectJsxOrReact(code, path);
  if (!hasSideEffects && !exportsDefaultComponent) return true;

  return false;
}

export function pickScriptEntry(files = {}, activeFile = '') {
  let preferredEntry = '';
  for (const candidate of PREFERRED_SCRIPT_ENTRIES) {
    if (typeof files[candidate] === 'string') {
      preferredEntry = candidate;
      break;
    }
  }
  if (!preferredEntry) {
    preferredEntry =
      Object.keys(files).find((k) => /\.(tsx|jsx)$/i.test(k) && typeof files[k] === 'string' && !isNonAppWorkspaceFile(k) && !/layout\./i.test(k)) ||
      Object.keys(files).find((k) => isScriptFile(k) && typeof files[k] === 'string' && !isNonAppWorkspaceFile(k) && !isSupportingScript(k, files)) ||
      Object.keys(files).find((k) => isScriptFile(k) && typeof files[k] === 'string' && !isNonAppWorkspaceFile(k)) ||
      Object.keys(files).find((k) => isScriptFile(k) && typeof files[k] === 'string') ||
      '';
  }

  if (activeFile && isScriptFile(activeFile) && typeof files[activeFile] === 'string' && !isNonAppWorkspaceFile(activeFile)) {
    if (PREFERRED_SCRIPT_ENTRIES.includes(activeFile)) {
      return activeFile;
    }
    if (preferredEntry && preferredEntry !== activeFile && isSupportingScript(activeFile, files)) {
      return preferredEntry;
    }
    return activeFile;
  }

  return preferredEntry;
}

export function resolveModulePath(specifier, fromPath, files = {}) {
  if (!specifier || typeof specifier !== 'string') return null;
  if (/^(https?:|data:|blob:)/i.test(specifier)) return null;

  let basePath = specifier;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const dirParts = String(fromPath || '').split('/').slice(0, -1);
    const relParts = specifier.split('/');
    for (const seg of relParts) {
      if (!seg || seg === '.') continue;
      if (seg === '..') dirParts.pop();
      else dirParts.push(seg);
    }
    basePath = dirParts.join('/');
  } else if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
    basePath = specifier.slice(2);
  } else if (specifier.startsWith('/')) {
    basePath = specifier.slice(1);
  } else {
    return null; // bare package specifier (react, lucide-react, etc.)
  }

  const exts = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json', '.css', '.scss', '.svg'];
  const candidates = [];
  for (const ext of exts) {
    candidates.push(basePath + ext);
    if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
      candidates.push('src/' + basePath + ext);
    }
  }
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    candidates.push(basePath + '/index' + ext);
    if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
      candidates.push('src/' + basePath + '/index' + ext);
    }
  }

  for (const c of candidates) {
    if (files[c] !== undefined) return c;
  }
  return null;
}

export function transpileModuleCode(code, filePath = 'index.js') {
  try {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'js';
    const transforms = ['imports'];
    if (ext === 'ts' || ext === 'tsx') transforms.push('typescript');
    if (ext === 'jsx' || ext === 'tsx' || ext === 'js' || ext === 'mjs') {
      if (ext === 'jsx' || ext === 'tsx' || /<[A-Za-z>]/.test(code)) {
        transforms.push('jsx');
      }
    }
    return transform(code, {
      transforms,
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    }).code;
  } catch (err) {
    const msg = err?.message || 'Syntax error';
    return `throw new SyntaxError(${JSON.stringify(`${filePath}: ${msg}`)});`;
  }
}

// Synchronous, 100% offline-capable React 18 compatible runtime for JSX/TSX preview inside iframe
export const MINI_REACT_RUNTIME = `<script>(()=>{
  if (window.React && window.ReactDOM) return;
  const Fragment = Symbol.for('codelab.fragment');
  let hookIdx = 0;
  let currentInst = null;
  let rootContainer = null;
  let rootVNode = null;
  const instances = new WeakMap();
  let renderScheduled = false;

  function createElement(type, props, ...children) {
    const flat = [];
    const pushChild = (c) => {
      if (Array.isArray(c)) c.forEach(pushChild);
      else if (c !== null && c !== undefined && typeof c !== 'boolean') flat.push(c);
    };
    children.forEach(pushChild);
    const finalProps = props ? Object.assign({}, props) : {};
    if (flat.length === 1) finalProps.children = flat[0];
    else if (flat.length > 1) finalProps.children = flat;
    return { $$typeof: Symbol.for('codelab.element'), type, props: finalProps, key: finalProps.key ?? null };
  }

  function normalizeChildren(c) {
    if (c === null || c === undefined || typeof c === 'boolean') return [];
    if (Array.isArray(c)) return c.flatMap(normalizeChildren);
    return [c];
  }

  class Component {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(partial) {
      const next = typeof partial === 'function' ? partial(this.state, this.props) : partial;
      this.state = Object.assign({}, this.state, next);
      scheduleRerender();
    }
    render() { return null; }
  }

  function createContext(defaultValue) {
    const ctx = { _current: defaultValue, Provider: ({ value, children }) => { ctx._current = value; return createElement(Fragment, null, children); }, Consumer: ({ children }) => typeof children === 'function' ? children(ctx._current) : null };
    return ctx;
  }

  function getHookSlot() {
    if (!currentInst) return {};
    const i = hookIdx++;
    if (!currentInst.hooks[i]) currentInst.hooks[i] = {};
    return currentInst.hooks[i];
  }

  function depsChanged(prev, next) {
    if (!prev || !next) return true;
    if (prev.length !== next.length) return true;
    for (let i = 0; i < next.length; i++) {
      if (!Object.is(prev[i], next[i])) return true;
    }
    return false;
  }

  function useState(init) {
    const slot = getHookSlot();
    if (!slot.init) {
      slot.val = typeof init === 'function' ? init() : init;
      slot.init = true;
      slot.set = (next) => {
        const computed = typeof next === 'function' ? next(slot.val) : next;
        if (!Object.is(slot.val, computed)) {
          slot.val = computed;
          scheduleRerender();
        }
      };
    }
    return [slot.val, slot.set];
  }

  function useReducer(reducer, initArg, initFn) {
    const slot = getHookSlot();
    if (!slot.init) {
      slot.val = initFn ? initFn(initArg) : initArg;
      slot.init = true;
      slot.dispatch = (action) => {
        const next = reducer(slot.val, action);
        if (!Object.is(slot.val, next)) {
          slot.val = next;
          scheduleRerender();
        }
      };
    }
    return [slot.val, slot.dispatch];
  }

  function useRef(init) {
    const slot = getHookSlot();
    if (!slot.init) { slot.ref = { current: init }; slot.init = true; }
    return slot.ref;
  }

  function useMemo(fn, deps) {
    const slot = getHookSlot();
    if (!slot.init || depsChanged(slot.deps, deps)) {
      slot.val = fn();
      slot.deps = deps;
      slot.init = true;
    }
    return slot.val;
  }

  function useCallback(fn, deps) {
    return useMemo(() => fn, deps);
  }

  function useEffect(fn, deps) {
    const slot = getHookSlot();
    if (!slot.init || depsChanged(slot.deps, deps)) {
      slot.deps = deps;
      slot.init = true;
      pendingEffects.push(() => {
        if (typeof slot.cleanup === 'function') { try { slot.cleanup(); } catch {} }
        const res = fn();
        slot.cleanup = typeof res === 'function' ? res : null;
      });
    }
  }

  function useContext(ctx) {
    return ctx ? ctx._current : undefined;
  }

  const pendingEffects = [];
  const hookStore = new Map();

  function getInst(key) {
    if (!hookStore.has(key)) hookStore.set(key, { hooks: [] });
    return hookStore.get(key);
  }

  const SVG_TAGS = new Set(['svg','path','circle','rect','line','polygon','polyline','ellipse','g','defs','linearGradient','stop','text']);
  const UNITLESS = new Set(['opacity','zIndex','fontWeight','lineHeight','flex','flexGrow','flexShrink','order','zoom','scale','columnCount','fillOpacity','strokeOpacity','strokeWidth']);

  function setProp(el, k, v) {
    if (k === 'children' || k === 'key') return;
    if (k === 'ref' && v && typeof v === 'object') { v.current = el; return; }
    if (k === 'ref' && typeof v === 'function') { v(el); return; }
    if (k === 'dangerouslySetInnerHTML' && v && v.__html != null) { el.innerHTML = v.__html; return; }
    if (k === 'className') { el.setAttribute('class', v || ''); return; }
    if (k === 'htmlFor') { el.setAttribute('for', v || ''); return; }
    if (k === 'style' && v && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sv == null) continue;
        if (sk.startsWith('--')) el.style.setProperty(sk, String(sv));
        else el.style[sk] = typeof sv === 'number' && !UNITLESS.has(sk) ? sv + 'px' : String(sv);
      }
      return;
    }
    if (/^on[A-Z]/.test(k) && typeof v === 'function') {
      const ev = k.slice(2).toLowerCase();
      el.addEventListener(ev === 'doubleclick' ? 'dblclick' : ev, v);
      if (ev === 'change' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.addEventListener('input', v);
      }
      return;
    }
    if (typeof v === 'boolean') {
      if (v) el.setAttribute(k, '');
      if (k in el) el[k] = v;
      return;
    }
    if (v != null) {
      if (k === 'value' && 'value' in el) el.value = v;
      else el.setAttribute(k, String(v));
    }
  }

  function renderNode(vnode, pathKey = '0', inSvg = false) {
    if (vnode === null || vnode === undefined || typeof vnode === 'boolean') {
      return document.createDocumentFragment();
    }
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      return document.createTextNode(String(vnode));
    }
    if (Array.isArray(vnode)) {
      const frag = document.createDocumentFragment();
      vnode.forEach((child, idx) => frag.appendChild(renderNode(child, pathKey + '.' + idx, inSvg)));
      return frag;
    }
    if (vnode.type === Fragment) {
      const frag = document.createDocumentFragment();
      normalizeChildren(vnode.props?.children).forEach((child, idx) => frag.appendChild(renderNode(child, pathKey + '.f' + idx, inSvg)));
      return frag;
    }
    if (typeof vnode.type === 'function') {
      if (vnode.type.prototype && vnode.type.prototype.isReactComponent) {
        const inst = new vnode.type(vnode.props);
        return renderNode(inst.render(), pathKey + '.c', inSvg);
      }
      const prevInst = currentInst;
      const prevIdx = hookIdx;
      currentInst = getInst(pathKey + ':' + (vnode.type.name || 'fn'));
      hookIdx = 0;
      let out = null;
      try {
        out = vnode.type(vnode.props || {});
      } finally {
        currentInst = prevInst;
        hookIdx = prevIdx;
      }
      return renderNode(out, pathKey + '.0', inSvg);
    }
    const props = vnode.props || {};
    if (vnode.type === 'head' || vnode.type === 'meta' || vnode.type === 'link') {
      return document.createDocumentFragment();
    }
    if (vnode.type === 'title') {
      const text = normalizeChildren(props.children).map((c) => typeof c === 'string' || typeof c === 'number' ? String(c) : '').join('');
      if (text) document.title = text;
      return document.createDocumentFragment();
    }
    if (vnode.type === 'html' || vnode.type === 'body') {
      if (vnode.type === 'html') {
        if (props.lang) document.documentElement.lang = props.lang;
        if (props.dir) document.documentElement.dir = props.dir;
      }
      if (vnode.type === 'body' && props.className) {
        document.body.className = props.className;
      }
      const wrapper = document.createElement('div');
      wrapper.setAttribute(vnode.type === 'html' ? 'data-codelab-html' : 'data-codelab-body', 'true');
      if (props.className) wrapper.setAttribute('class', props.className);
      if (props.style) setProp(wrapper, 'style', props.style);
      normalizeChildren(props.children).forEach((child, idx) => wrapper.appendChild(renderNode(child, pathKey + '.' + idx, inSvg)));
      return wrapper;
    }
    const isSvg = inSvg || vnode.type === 'svg' || SVG_TAGS.has(vnode.type);
    const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', vnode.type) : document.createElement(vnode.type);
    for (const [k, v] of Object.entries(props)) setProp(el, k, v);
    if (!props.dangerouslySetInnerHTML) {
      normalizeChildren(props.children).forEach((child, idx) => el.appendChild(renderNode(child, pathKey + '.' + idx, isSvg)));
    }
    return el;
  }

  function commitRender() {
    if (!rootContainer || rootVNode === undefined) return;
    pendingEffects.length = 0;
    const active = document.activeElement;
    const activeId = active && active.id ? active.id : null;
    const activeInputIdx = !activeId && active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && rootContainer.contains(active)
      ? Array.from(rootContainer.querySelectorAll('input,textarea,select')).indexOf(active)
      : -1;
    const selStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    try {
      const dom = renderNode(rootVNode, 'root', false);
      rootContainer.innerHTML = '';
      rootContainer.appendChild(dom);
      const focusTarget = activeId
        ? document.getElementById(activeId)
        : activeInputIdx >= 0
          ? rootContainer.querySelectorAll('input,textarea,select')[activeInputIdx]
          : null;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
        if (selStart !== null && typeof focusTarget.setSelectionRange === 'function') {
          try { focusTarget.setSelectionRange(selStart, selStart); } catch {}
        }
      }
      const effects = pendingEffects.splice(0);
      setTimeout(() => effects.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }), 0);
    } catch (err) {
      console.error(err);
      rootContainer.innerHTML = '<div style="padding:16px;border-radius:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;font-family:monospace;font-size:13px;"><strong>Render Error:</strong> ' + String(err && err.message ? err.message : err) + '</div>';
    }
  }

  function scheduleRerender() {
    if (renderScheduled) return;
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      commitRender();
    });
  }

  Component.prototype.isReactComponent = true;

  const React = {
    version: '18.3.1-codelab',
    Fragment,
    Component,
    PureComponent: Component,
    createElement,
    jsx: (type, props, key) => createElement(type, key !== undefined ? Object.assign({}, props, { key }) : props),
    jsxs: (type, props, key) => createElement(type, key !== undefined ? Object.assign({}, props, { key }) : props),
    jsxDEV: (type, props, key) => createElement(type, key !== undefined ? Object.assign({}, props, { key }) : props),
    cloneElement: (el, props, ...children) => createElement(el.type, Object.assign({}, el.props, props), ...(children.length ? children : [el.props?.children])),
    isValidElement: (el) => Boolean(el && typeof el === 'object' && el.$$typeof === Symbol.for('codelab.element')),
    createContext,
    useState,
    useReducer,
    useRef,
    useMemo,
    useCallback,
    useEffect,
    useLayoutEffect: useEffect,
    useContext,
    memo: (c) => c,
    forwardRef: (fn) => (props) => fn(props, props?.ref || null),
    StrictMode: Fragment,
    Suspense: ({ children }) => createElement(Fragment, null, children),
    Children: {
      map: (c, fn) => normalizeChildren(c).map(fn),
      forEach: (c, fn) => normalizeChildren(c).forEach(fn),
      toArray: (c) => normalizeChildren(c),
      count: (c) => normalizeChildren(c).length,
    },
  };

  const ReactDOM = {
    render(vnode, container) {
      window.__codelabMounted = true;
      rootContainer = container;
      rootVNode = vnode;
      commitRender();
    },
    createRoot(container) {
      return {
        render(vnode) {
          window.__codelabMounted = true;
          rootContainer = container;
          rootVNode = vnode;
          commitRender();
        },
        unmount() {
          window.__codelabMounted = false;
          if (container) container.innerHTML = '';
        },
      };
    },
  };

  window.React = React;
  window.ReactDOM = ReactDOM;
  window.__codelabReactLoaded = true;
})();<\/script>`;

// Smart runtime observer: if <body> has no visible elements after scripts execute, render live console/status preview and auto-dismiss on DOM mutations
export function buildEmptyBodyObserver(activeFile = '', locale = 'ar') {
  const isEn = locale === 'en';
  const labels = {
    file: activeFile || 'index.html',
    consoleTitle: isEn ? 'Live Execution Output' : 'مخرجات التشغيل الحية',
    readyTitle: isEn ? 'Live Preview Active' : 'المعاينة الحية نشطة',
    readyDesc: isEn
      ? 'This document currently has no visible elements inside <body>. Any DOM updates or console output will appear here automatically.'
      : 'لا يحتوي وسم <body> في هذا الملف على عناصر مرئية حالياً. أي عناصر أو مخرجات يتم إنشاؤها برمجياً ستظهر هنا تلقائياً.',
    stylesActive: isEn ? 'CSS styles loaded' : 'تنسيقات CSS نشطة',
  };

  return `<script>(()=>{
  const LABELS = ${escapeInlineScript(JSON.stringify(labels))};
  const FALLBACK_ID = 'codelab-empty-preview-fallback';

  function hasVisibleContent() {
    const body = document.body;
    if (!body) return false;
    const IGNORED = new Set(['SCRIPT','STYLE','LINK','META','TITLE','NOSCRIPT','TEMPLATE']);
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) {
        const parent = node.parentElement;
        if (!parent) continue;
        if (parent.closest && parent.closest('#' + FALLBACK_ID)) continue;
        if (IGNORED.has(parent.tagName)) continue;
        if (node.nodeValue && node.nodeValue.trim().length > 0) return true;
      } else if (node.nodeType === 1) {
        if (node.id === FALLBACK_ID || (node.closest && node.closest('#' + FALLBACK_ID))) continue;
        if (IGNORED.has(node.tagName)) continue;
        if (['IMG','SVG','CANVAS','VIDEO','AUDIO','IFRAME','INPUT','BUTTON','TEXTAREA','SELECT','HR'].includes(node.tagName)) {
          return true;
        }
        const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        if (rect && rect.width > 0 && rect.height > 0) {
          const cs = window.getComputedStyle ? window.getComputedStyle(node) : null;
          if (!cs || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function renderFallback() {
    if (!document.body) return;
    if (hasVisibleContent()) {
      const existing = document.getElementById(FALLBACK_ID);
      if (existing) existing.remove();
      return;
    }
    if (document.getElementById(FALLBACK_ID)) return;

    const logs = Array.isArray(window.__codelabLogs) ? window.__codelabLogs : [];
    const wrap = document.createElement('div');
    wrap.id = FALLBACK_ID;
    wrap.setAttribute('style', 'position:fixed;inset:0;overflow:auto;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#e2e8f0;');

    const card = document.createElement('div');
    card.setAttribute('style', 'width:100%;max-width:560px;background:rgba(15,23,42,0.85);border:1px solid rgba(148,163,184,0.22);border-radius:12px;padding:20px;box-shadow:0 12px 32px rgba(0,0,0,0.35);');

    const header = document.createElement('div');
    header.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(148,163,184,0.16);');
    const title = document.createElement('div');
    title.setAttribute('style', 'font-weight:700;font-size:14px;color:#38bdf8;');
    title.textContent = logs.length ? LABELS.consoleTitle : LABELS.readyTitle;

    const badge = document.createElement('span');
    badge.setAttribute('style', 'font-family:ui-monospace,monospace;font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(56,189,248,0.14);color:#7dd3fc;');
    badge.textContent = LABELS.file;
    header.appendChild(title);
    header.appendChild(badge);
    card.appendChild(header);

    if (logs.length) {
      const pre = document.createElement('pre');
      pre.setAttribute('dir', 'ltr');
      pre.setAttribute('style', 'margin:0;padding:12px;border-radius:8px;background:#020617;border:1px solid rgba(51,65,85,0.7);font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.6;overflow:auto;max-height:60vh;white-space:pre-wrap;word-break:break-word;');
      logs.forEach((entry) => {
        const line = document.createElement('div');
        const col = entry.level === 'error' ? '#f87171' : entry.level === 'warn' ? '#fbbf24' : entry.level === 'info' ? '#60a5fa' : '#4ade80';
        line.setAttribute('style', 'color:' + col + ';padding:2px 0;');
        line.textContent = (entry.level === 'error' ? '✖ ' : entry.level === 'warn' ? '⚠ ' : '› ') + entry.m;
        pre.appendChild(line);
      });
      card.appendChild(pre);
    } else {
      const p = document.createElement('p');
      p.setAttribute('style', 'margin:0;font-size:13px;line-height:1.65;color:#cbd5e1;');
      p.textContent = LABELS.readyDesc;
      card.appendChild(p);
      if (document.styleSheets && document.styleSheets.length > 0) {
        const pill = document.createElement('div');
        pill.setAttribute('style', 'margin-top:12px;display:inline-block;font-size:11px;padding:4px 10px;border-radius:6px;background:rgba(16,185,129,0.14);color:#6ee7b7;border:1px solid rgba(16,185,129,0.28);');
        pill.textContent = '✓ ' + LABELS.stylesActive + ' (' + document.styleSheets.length + ')';
        card.appendChild(pill);
      }
    }

    wrap.appendChild(card);
    document.body.appendChild(wrap);
  }

  function scheduleCheck() {
    requestAnimationFrame(() => setTimeout(renderFallback, 120));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleCheck);
  } else {
    scheduleCheck();
  }

  if (typeof MutationObserver !== 'undefined') {
    const startObs = () => {
      if (!document.body) return;
      const obs = new MutationObserver((mutations) => {
        const externalMutation = mutations.some((m) => {
          const target = m.target;
          if (target && target.id === FALLBACK_ID) return false;
          if (target && target.closest && target.closest('#' + FALLBACK_ID)) return false;
          for (const n of m.addedNodes || []) {
            if (n.id === FALLBACK_ID) return false;
          }
          return true;
        });
        if (externalMutation && hasVisibleContent()) {
          const existing = document.getElementById(FALLBACK_ID);
          if (existing) existing.remove();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.body) startObs();
    else document.addEventListener('DOMContentLoaded', startObs);
  }
})();<\/script>`;
}

export function transpileClassicScript(code, filePath = 'script.js') {
  try {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'js';
    const transforms = [];
    if (ext === 'ts' || ext === 'tsx') transforms.push('typescript');
    if (ext === 'jsx' || ext === 'tsx' || (/<[A-Za-z>]/.test(code) && detectJsxOrReact(code, filePath))) {
      transforms.push('jsx');
    }
    if (transforms.length === 0) return code;
    return transform(code, {
      transforms,
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    }).code;
  } catch (err) {
    const msg = err?.message || 'Syntax error';
    return `console.error(${JSON.stringify(`${filePath}: ${msg}`)});`;
  }
}

// Compile workspace script modules starting from entryPath into an inline CommonJS bundle script + optional global sibling scripts
export function compileWorkspaceBundle(
  files = {},
  entryPath = '',
  resolveMediaUrl = () => null,
  resolveCssUrls = (s) => s,
  options = {}
) {
  const visited = new Set();
  const modules = {};
  const extraCss = [];

  // Detect Next.js App Router layout wrapper when previewing app/page.*
  let nextLayoutPath = '';
  if (/^app\/page\.(?:tsx|jsx|ts|js)$/i.test(entryPath)) {
    nextLayoutPath =
      ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js', 'app/layout.ts'].find(
        (p) => typeof files[p] === 'string'
      ) || '';
  }

  function visit(path) {
    if (!path || visited.has(path)) return;
    visited.add(path);
    const entry = files[path];
    if (typeof entry !== 'string') {
      if (isMediaEntry(entry)) {
        modules[path] = `module.exports = ${JSON.stringify(entry.dataUrl)};`;
      }
      return;
    }
    if (isStyleFile(path)) {
      extraCss.push(`/* ${path} */\n${resolveCssUrls(preprocessCss(entry, path))}`);
      modules[path] = 'module.exports = {};';
      return;
    }
    if (/\.json$/i.test(path)) {
      modules[path] = `module.exports = ${entry || 'null'};`;
      return;
    }
    if (/\.svg$/i.test(path)) {
      const url = resolveMediaUrl(path) || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(entry)}`;
      modules[path] = `module.exports = ${JSON.stringify(url)};`;
      return;
    }

    const importRe = /(?:from\s+|import\s+|require\s*\(\s*|import\s*\(\s*)(['"])([^'"]+)\1/g;
    let match;
    while ((match = importRe.exec(entry)) !== null) {
      const resolved = resolveModulePath(match[2], path, files);
      if (resolved) visit(resolved);
    }

    modules[path] = transpileModuleCode(entry, path);
  }

  visit(entryPath);
  if (nextLayoutPath) visit(nextLayoutPath);

  const resolutionMap = {};
  for (const fromPath of visited) {
    const src = files[fromPath];
    if (typeof src !== 'string') continue;
    const importRe = /(?:from\s+|import\s+|require\s*\(\s*|import\s*\(\s*)(['"])([^'"]+)\1/g;
    let m;
    while ((m = importRe.exec(src)) !== null) {
      const resolved = resolveModulePath(m[2], fromPath, files);
      if (resolved) {
        resolutionMap[`${fromPath}::${m[2]}`] = resolved;
      }
    }
  }

  // Sibling global scripts (without import/export) when linking a multi-file workspace without HTML
  const siblingGlobals = [];
  if (options.includeSiblingGlobals !== false) {
    for (const [path, content] of Object.entries(files)) {
      if (visited.has(path) || typeof content !== 'string' || !isScriptFile(path)) continue;
      if (isNonAppWorkspaceFile(path)) continue;
      const usesModuleSyntax = /^\s*(?:import|export)\s+/m.test(content) || /\brequire\s*\(/.test(content);
      if (!usesModuleSyntax) {
        siblingGlobals.push({ path, code: transpileClassicScript(content, path) });
      }
    }
  }

  const preludeScript = siblingGlobals
    .map(({ path, code }) => `<script data-file="${escapeHtml(path)}">\n${escapeInlineScript(code)}\n<\/script>`)
    .join('\n');

  const entrySource = typeof files[entryPath] === 'string' ? files[entryPath] : '';
  const entryHasJsx = detectJsxOrReact(entrySource, entryPath);

  const runtimeScript = `<script>(()=>{
  const process = window.process || { env: { NODE_ENV: 'development' } };
  const MODULES = {
${Object.entries(modules)
  .map(([p, code]) => `    ${JSON.stringify(p)}: function(module, exports, require, __filename) {\n${escapeInlineScript(code)}\n    }`)
  .join(',\n')}
  };
  const RES_MAP = ${escapeInlineScript(JSON.stringify(resolutionMap))};
  const CACHE = {};
  const ENTRY = ${JSON.stringify(entryPath)};
  const LAYOUT_ENTRY = ${JSON.stringify(nextLayoutPath)};
  const ENTRY_HAS_JSX = ${JSON.stringify(entryHasJsx)};

  function makeStubIcon(name) {
    return function IconStub(props) {
      const React = window.React;
      const size = (props && props.size) || 16;
      const cls = (props && props.className) || '';
      return React.createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        className: cls, 'aria-label': name,
      }, React.createElement('circle', { cx: 12, cy: 12, r: 9 }));
    };
  }

  function makeMotionProxy() {
    const STRIP = new Set(['initial','animate','exit','transition','variants','whileHover','whileTap','whileInView','viewport','layout','layoutId']);
    return new Proxy({}, {
      get: (_, tag) => function MotionEl(props) {
        const React = window.React;
        const clean = {};
        if (props) {
          for (const [k, v] of Object.entries(props)) {
            if (!STRIP.has(k)) clean[k] = v;
          }
        }
        return React.createElement(String(tag), clean);
      },
    });
  }

  function makeRequire(fromPath) {
    return function require(spec) {
      if (spec === 'react' || spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') return window.React;
      if (spec === 'react-dom' || spec === 'react-dom/client') return window.ReactDOM;
      if (spec === 'motion/react' || spec === 'framer-motion') {
        const React = window.React;
        return {
          __esModule: true,
          motion: makeMotionProxy(),
          AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
        };
      }
      if (spec === 'next/link') {
        const React = window.React;
        return { __esModule: true, default: ({ href, children, ...rest }) => React.createElement('a', Object.assign({ href: href || '#' }, rest), children) };
      }
      if (spec === 'next/image') {
        const React = window.React;
        return { __esModule: true, default: ({ src, alt, fill, priority, unoptimized, ...rest }) => React.createElement('img', Object.assign({ src: src || '', alt: alt || '' }, rest)) };
      }
      if (spec === 'next/head') {
        const React = window.React;
        return { __esModule: true, default: ({ children }) => React.createElement(React.Fragment, null, children) };
      }
      if (spec === 'next/navigation' || spec === 'next/router') {
        const router = { push: () => {}, replace: () => {}, back: () => {}, refresh: () => {}, pathname: '/' };
        return { useRouter: () => router, usePathname: () => '/', useSearchParams: () => new URLSearchParams(), useParams: () => ({}) };
      }
      if (spec === 'lucide-react') {
        return new Proxy({}, { get: (_, prop) => makeStubIcon(String(prop)) });
      }
      if (spec === 'clsx' || spec === 'classnames') {
        const fn = (...args) => args.flat(Infinity).filter(Boolean).join(' ');
        return Object.assign(fn, { __esModule: true, default: fn, clsx: fn });
      }
      if (spec === 'tailwind-merge') {
        const twMerge = (...args) => args.filter(Boolean).join(' ');
        return { twMerge };
      }

      const target = RES_MAP[fromPath + '::' + spec] || (MODULES[spec] ? spec : null);
      if (!target || !MODULES[target]) {
        console.warn('Module not bundled:', spec);
        return {};
      }
      if (CACHE[target]) return CACHE[target].exports;
      const mod = { exports: {} };
      CACHE[target] = mod;
      MODULES[target](mod, mod.exports, makeRequire(target), target);
      return mod.exports;
    };
  }

  try {
    const req = makeRequire(ENTRY);
    const exp = req(ENTRY);
    const rootEl = document.getElementById('root') || document.getElementById('app');
    const candidate = exp && (exp.default || exp.App || exp.Page || exp.Home || (typeof exp === 'function' ? exp : null));
    const looksLikeComponent =
      candidate &&
      window.React &&
      window.ReactDOM &&
      (window.React.isValidElement(candidate) ||
        (typeof candidate === 'function' &&
          (candidate.prototype?.isReactComponent ||
            ENTRY_HAS_JSX ||
            /\.(jsx|tsx)$/i.test(ENTRY) ||
            /^[A-Z]/.test(candidate.name || ''))));
    if (!window.__codelabMounted && rootEl && rootEl.childNodes.length === 0 && looksLikeComponent) {
      let el = typeof candidate === 'function' ? window.React.createElement(candidate, null) : candidate;
      if (LAYOUT_ENTRY && MODULES[LAYOUT_ENTRY]) {
        const layoutMod = req(LAYOUT_ENTRY);
        const LayoutComp = layoutMod && (layoutMod.default || layoutMod.RootLayout);
        if (typeof LayoutComp === 'function') {
          el = window.React.createElement(LayoutComp, null, el);
        }
      }
      if (window.React.isValidElement(el)) {
        window.ReactDOM.createRoot(rootEl).render(el);
      }
    }
  } catch (err) {
    console.error(err);
  }
})();<\/script>`;

  return { runtimeScript, preludeScript, extraCss: extraCss.join('\n'), bundledPaths: visited };
}
