// Code execution engine: Multi-file Web preview with media asset resolution, JS/TS/JSX worker, Pyodide + offline Python, C/C++/Java

import { transform } from 'sucrase';
import { isMediaEntry } from './storage';

const PRE =
  'let buf="";const __w=(...a)=>{buf+=a.join("")};const __l=(...a)=>{buf+=a.join("")+"\\n"};const console={log:(...a)=>{buf+=a.join(" ")+"\\n"},info:(...a)=>{buf+=a.join(" ")+"\\n"},warn:(...a)=>{buf+="[warn] "+a.join(" ")+"\\n"},error:(...a)=>{buf+="[error] "+a.join(" ")+"\\n"}};';

export function runMain(src, pre = PRE) {
  try {
    return { out: new Function(pre + src + '\nreturn buf;')() };
  } catch (e) {
    return { err: e.message };
  }
}

export function runWorker(src, ms = 3000, pre = PRE) {
  return new Promise((res) => {
    let w;
    try {
      w = new Worker(
        URL.createObjectURL(
          new Blob([
            `onmessage=()=>{try{postMessage({out:(new Function(${JSON.stringify(pre + src + '\nreturn buf;')}))()})}catch(e){postMessage({err:e.message})}}`,
          ])
        )
      );
    } catch {
      return res(runMain(src, pre));
    }
    const t = setTimeout(() => {
      w.terminate();
      res({ err: 'الكود يعمل بلا توقف (مهلة 3 ثوانٍ — حلقة لا نهائية؟)' });
    }, ms);
    w.onmessage = (e) => {
      clearTimeout(t);
      w.terminate();
      res(e.data);
    };
    w.onerror = () => {
      clearTimeout(t);
      w.terminate();
      res(runMain(src, pre));
    };
    w.postMessage(1);
  });
}

// Built-in Python-to-JS engine (instant offline fallback while Pyodide loads)
const PYPRE =
  'let buf="";const __r=(x)=>typeof x==="string"?"\'"+x+"\'":__s(x);const __s=(x)=>x===true?"True":x===false?"False":x==null?"None":Array.isArray(x)?"["+x.map(__r).join(", ")+"]":typeof x==="object"?"{"+Object.entries(x).map(([k,v])=>__r(k)+": "+__r(v)).join(", ")+"}":String(x);const print=(...a)=>{buf+=a.map(__s).join(" ")+"\\n"};const __pe=(a,e)=>{buf+=a.map(__s).join(" ")+e};const range=(a,b,c=1)=>{if(b===undefined){b=a;a=0}const o=[];if(c>0)for(let i=a;i<b;i+=c)o.push(i);else for(let i=a;i>b;i+=c)o.push(i);return o};const len=(x)=>x.length;const str=__s;const int=(x)=>Math.trunc(Number(x));const float=Number;const abs=Math.abs;const round=(x,n=0)=>Number(x.toFixed(n));const max=(...a)=>Math.max(...(a.length===1?a[0]:a));const min=(...a)=>Math.min(...(a.length===1?a[0]:a));const sum=(a)=>a.reduce((x,y)=>x+y,0);const sorted=(a)=>[...a].sort((x,y)=>x>y?1:x<y?-1:0);const enumerate=(a)=>[...a].map((x,i)=>[i,x]);const __in=(a,b)=>Array.isArray(b)||typeof b==="string"?b.includes(a):a in b;const __fd=(a,b)=>Math.floor(a/b);const math={...Math,pi:Math.PI};const input=()=>{throw new Error("input() غير مدعوم في وضع التشغيل غير المتزامن")};';

function tern(e) {
  let d = 0;
  let ifAt = -1;
  let elseAt = -1;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) d--;
    else if (d === 0 && ifAt < 0 && e.startsWith(' if ', i)) ifAt = i;
    else if (d === 0 && ifAt >= 0 && elseAt < 0 && e.startsWith(' else ', i)) elseAt = i;
  }
  if (ifAt >= 0 && elseAt > ifAt) {
    return `(${tern(e.slice(ifAt + 4, elseAt))}) ? (${tern(e.slice(0, ifAt))}) : (${tern(e.slice(elseAt + 6))})`;
  }
  return e.replace(/\(([^()]*)\)/g, (m, g) => '(' + tern(g) + ')');
}

function pyToJS(src) {
  const STR = /([fFrRbB]?(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'))/g;
  const OP = '(?:[\\w.\\u0001\\u0002]+(?:\\([^()]*\\))?|\\([^()]*\\))';
  const O1 = '[\\w.\\u0001\\u0002]+';
  const conv = (e) => {
    const strs = [];
    let t = e.replace(STR, (m) => {
      strs.push(m);
      return '\u0001' + (strs.length - 1) + '\u0002';
    });
    t = t
      .replace(new RegExp(`(${O1})\\s+not\\s+in\\s+(\\[[^\\]]*\\])`, 'g'), '!__in($1, $2)')
      .replace(new RegExp(`(${O1})\\s+in\\s+(\\[[^\\]]*\\])`, 'g'), '__in($1, $2)')
      .replace(new RegExp(`(${O1})\\s+not\\s+in\\s+(${O1})`, 'g'), '!__in($1, $2)')
      .replace(new RegExp(`(${O1})\\s+in\\s+(${O1})`, 'g'), '__in($1, $2)')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bis\s+not\b/g, '!==')
      .replace(/\bis\b/g, '===')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\b/g, '!')
      .replace(new RegExp(`(${OP})\\s*//\\s*(${OP})`, 'g'), '__fd($1, $2)')
      .replace(/(\u0001\d+\u0002)\s*\*\s*([\w.]+)/g, '$1.repeat($2)')
      .replace(/([\w.]+)\s*\*\s*(\u0001\d+\u0002)/g, '$2.repeat($1)')
      .replace(/(\u0001\d+\u0002)\.join\(([^()]*)\)/g, '$2.join($1)')
      .replace(/\.append\(/g, '.push(')
      .replace(/\.upper\(\)/g, '.toUpperCase()')
      .replace(/\.lower\(\)/g, '.toLowerCase()')
      .replace(/\.strip\(\)/g, '.trim()')
      .replace(/\.startswith\(/g, '.startsWith(')
      .replace(/\.endswith\(/g, '.endsWith(')
      .replace(/\.replace\(/g, '.replaceAll(')
      .replace(/\.sort\(\)/g, '.sort((a,b)=>a>b?1:a<b?-1:0)')
      .replace(/([\w.]+)\.items\(\)/g, 'Object.entries($1)')
      .replace(/([\w.]+)\.keys\(\)/g, 'Object.keys($1)')
      .replace(/([\w.]+)\.values\(\)/g, 'Object.values($1)')
      .replace(/lambda\s*([\w,\s]*):\s*([^,)]+)/g, '(($1) => ($2))');
    t = tern(t);
    return t.replace(/\u0001(\d+)\u0002/g, (m, i) => {
      const x = strs[i];
      if (/^[fF]/.test(x)) {
        return (
          '`' +
          x
            .slice(2, -1)
            .replace(/`/g, '\\`')
            .replace(/\{([^{}:!]+)(?::\.(\d+)f)?\}/g, (mm, ex, n) =>
              n ? '${(' + conv(ex) + ').toFixed(' + n + ')}' : '${__s(' + conv(ex) + ')}'
            ) +
          '`'
        );
      }
      return /^[rRbB]/.test(x) ? x.slice(1) : x;
    });
  };
  const cutComment = (l) => {
    let q = '';
    let i = 0;
    for (; i < l.length; i++) {
      const c = l[i];
      if (q) {
        if (c === '\\') i++;
        else if (c === q) q = '';
      } else if (c === '"' || c === "'") q = c;
      else if (c === '#') break;
    }
    return l.slice(0, i);
  };
  const colon = (t) => {
    let d = 0;
    let q = '';
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) {
        if (c === '\\') i++;
        else if (c === q) q = '';
      } else if (c === '"' || c === "'") q = c;
      else if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c)) d--;
      else if (c === ':' && d === 0) return i;
    }
    return -1;
  };
  const stmt = (t) => {
    let m;
    if ((m = t.match(/^print\((.*),\s*end\s*=\s*(".*?"|'.*?')\s*\)$/))) return `__pe([${conv(m[1])}], ${m[2]});`;
    if ((m = t.match(/^return\b\s*(.*)$/))) return `return ${m[1] ? conv(m[1]) : ''};`;
    if (t === 'pass') return ';';
    if (t === 'break' || t === 'continue') return t + ';';
    if (/^(import|from|global|nonlocal)\b/.test(t)) return '';
    if ((m = t.match(/^(\w+)\s*\/\/=\s*(.+)$/))) return `${m[1]} = __fd(${m[1]}, ${conv(m[2])});`;
    if ((m = t.match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*=(?!=)\s*(.+)$/))) {
      return m[1].includes(',') ? `var [${m[1]}] = [${conv(m[2])}];` : `var ${m[1]} = ${conv(m[2])};`;
    }
    return `${conv(t)};`;
  };
  const out = [];
  const stack = [0];
  let open = false;
  for (const raw of src.replace(/\r/g, '').replace(/\t/g, '    ').split('\n')) {
    const ln = cutComment(raw).replace(/\s+$/, '');
    if (!ln.trim()) continue;
    const ind = ln.match(/^ */)[0].length;
    const t = ln.trim();
    if (open) {
      if (ind <= stack[stack.length - 1]) throw new Error('IndentationError: يجب إزاحة السطر بعد النقطتين');
      stack.push(ind);
      open = false;
    }
    while (ind < stack[stack.length - 1]) {
      stack.pop();
      out.push('}');
    }
    if (ind !== stack[stack.length - 1]) throw new Error('IndentationError: إزاحة غير متناسقة');
    const m = t.match(/^(if|elif|else|while|for|def|try|except|finally)\b/);
    if (!m) {
      out.push(stmt(t));
      continue;
    }
    const ci = colon(t);
    if (ci < 0) throw new Error('SyntaxError: ينقص : في نهاية السطر');
    const head = t.slice(0, ci).trim();
    const body = t.slice(ci + 1).trim();
    const kw = m[1];
    let js;
    if (kw === 'if') js = `if (${conv(head.slice(2))}) {`;
    else if (kw === 'elif') js = `else if (${conv(head.slice(4))}) {`;
    else if (kw === 'while') js = `while (${conv(head.slice(5))}) {`;
    else if (kw === 'else') js = 'else {';
    else if (kw === 'try') js = 'try {';
    else if (kw === 'finally') js = 'finally {';
    else if (kw === 'except') js = 'catch (__e) {';
    else if (kw === 'def') {
      const d = head.match(/^def\s+(\w+)\s*\((.*)\)$/);
      if (!d) throw new Error('SyntaxError: تعريف دالة غير صحيح');
      js = `function ${d[1]}(${d[2]}) {`;
    } else {
      const f = head.match(/^for\s+(.+?)\s+in\s+(.+)$/);
      if (!f) throw new Error('SyntaxError: حلقة for غير صحيحة');
      js = `for (var ${f[1].includes(',') ? '[' + f[1] + ']' : f[1]} of ${conv(f[2])}) {`;
    }
    if (/^(elif|else|except|finally)$/.test(kw) && out[out.length - 1] === '}') {
      out.pop();
      js = '} ' + js;
    }
    out.push(js);
    if (body) {
      body
        .split(/;\s*/)
        .filter(Boolean)
        .forEach((b) => out.push(stmt(b)));
      out.push('}');
    } else open = true;
  }
  if (open) throw new Error('IndentationError: ينقص محتوى بعد النقطتين');
  while (stack.length > 1) {
    stack.pop();
    out.push('}');
  }
  return out.join('\n');
}

let pyo = null;
let pyLoading = null;
const PYO = [
  'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
  'https://cdn.jsdelivr.net/npm/pyodide@0.26.4/',
  'https://pyodide-cdn2.iodide.io/v0.26.4/full/',
];
const loadScript = (src) =>
  new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = res;
    el.onerror = () => rej(new Error('تعذر تحميل ' + src));
    document.head.appendChild(el);
  });

export function isPyodideReady() {
  return !!pyo;
}

export async function getPy() {
  if (pyo) return pyo;
  pyLoading ||= (async () => {
    let last;
    for (const base of PYO) {
      try {
        if (!window.loadPyodide) await loadScript(base + 'pyodide.js');
        return await window.loadPyodide({ indexURL: base });
      } catch (e) {
        last = e;
      }
    }
    throw last;
  })();
  try {
    pyo = await pyLoading;
  } catch (e) {
    pyLoading = null;
    throw e;
  }
  return pyo;
}

function syncWorkspaceToPyodide(py, files = {}) {
  try {
    for (const [path, content] of Object.entries(files)) {
      if (isMediaEntry(content)) continue;
      if (typeof content !== 'string') continue;
      const parts = path.split('/').filter(Boolean);
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur += '/' + parts[i];
        try {
          py.FS.mkdir(cur);
        } catch {}
      }
      py.FS.writeFile('/' + parts.join('/'), content);
    }
    try {
      py.FS.chdir('/');
    } catch {}
  } catch {}
}

export async function runPy(code, files = {}) {
  if (pyo) {
    try {
      syncWorkspaceToPyodide(pyo, files);
      let o = '';
      let errBuf = '';
      pyo.setStdout({ batched: (x) => (o += x + '\n') });
      pyo.setStderr({ batched: (x) => (errBuf += x + '\n') });
      await pyo.runPythonAsync(code);
      return { out: o, stderr: errBuf.trim() };
    } catch (e) {
      return { err: String(e.message).split('\n').filter(Boolean).slice(-1)[0] };
    }
  }
  getPy().catch(() => {});
  let js;
  try {
    js = pyToJS(code);
  } catch (e) {
    return { noRun: true, err: e.message };
  }
  return { ...(await runWorker(js, 3000, PYPRE)), internal: true };
}

function toJS(code, lang) {
  let s = code
    .replace(/\/\/.*$/gm, '')
    .replace(/#include.*|using namespace.*|^\s*import .*;|^\s*package .*;/gm, '')
    .replace(/std::/g, '');
  if (lang === 'java') {
    s = s
      .replace(/(public\s+)?class\s+\w+\s*\{/, '')
      .replace(/\}\s*$/, '')
      .replace(/(public\s+)?static\s+void\s+main\s*\([^)]*\)/, 'function main()');
  } else {
    s = s.replace(/int\s+main\s*\(\s*\)/, 'function main()');
  }
  const T = 'int|long|double|float|bool|boolean|String|string';
  s = s.replace(
    new RegExp(`\\b(?:static\\s+)?(?:${T}|void)\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*\\{`, 'g'),
    (m, n, p) => `function ${n}(${p.replace(new RegExp(`\\b(?:${T})\\s+`, 'g'), '')}) {`
  );
  s = s.replace(new RegExp(`\\b(?:${T}|auto)\\s+(\\w+)\\s*(=|;)`, 'g'), 'let $1 $2');
  s = s.replace(/cout\s*((?:<<[^;]+)+);/g, (m, ch) =>
    `__w(${ch
      .split('<<')
      .slice(1)
      .map((x) => (x.trim() === 'endl' ? '"\\n"' : x.trim()))
      .join(', ')});`
  );
  s = s.replace(/System\.out\.println\(/g, '__l(').replace(/System\.out\.print\(/g, '__w(');
  s = s.replace(/(\b\w+\b)\s*\/\s*(\b\w+\b)/g, 'Math.trunc($1 / $2)');
  return /function main\(/.test(s) ? s + '\nmain();' : s;
}

export function transpileTSOrJSX(code, lang) {
  const transforms = lang === 'jsx' ? ['jsx'] : ['typescript', 'jsx'];
  return transform(code, { transforms }).code;
}

export async function runCode(lang, code, files = {}) {
  if (lang === 'python') return runPy(code, files);
  if (lang === 'ts' || lang === 'tsx' || lang === 'jsx') {
    try {
      const js = transpileTSOrJSX(code, lang);
      return await runWorker(js);
    } catch (e) {
      return { err: e.message };
    }
  }
  if (lang === 'js') return runWorker(code);
  if (lang === 'c' || lang === 'cpp' || lang === 'java') {
    return runWorker(toJS(code, lang === 'c' ? 'cpp' : lang));
  }
  return { noRun: true, err: 'التشغيل المباشر في المتصفح غير متاح لهذه اللغة؛ استخدم المحرر للكتابة والتنسيق.' };
}

export const CONSOLE_BRIDGE = `<script>(()=>{
  const post=(cl,payload)=>parent.postMessage({cl,...payload},'*');
  const fmt=(a)=>a.map((x)=>{if(x instanceof Error)return x.stack||x.message;if(typeof x==='object'&&x!==null){try{return JSON.stringify(x,null,2)}catch(e){}}return String(x)}).join(' ');
  console.log=(...a)=>post('log',{level:'log',m:fmt(a)});
  console.info=(...a)=>post('log',{level:'info',m:fmt(a)});
  console.warn=(...a)=>post('log',{level:'warn',m:fmt(a)});
  console.error=(...a)=>post('log',{level:'error',m:fmt(a)});
  console.clear=()=>post('clear',{});
  window.onerror=(m,u,l,c)=>post('err',{m:String(m),l:l||0,c:c||0});
  window.onunhandledrejection=(e)=>post('err',{m:'Unhandled Promise: '+String(e.reason),l:0,c:0});
})();<\/script>`;

// Resolve local CSS, JS/TS, and Media assets (images, videos, audio, SVG) against workspace files
export function buildWebPreviewDoc(files, activeFile, injectBridge = true) {
  const resolveEntry = (refPath) => {
    if (!refPath || /^(https?:|data:|blob:|mailto:|#)/i.test(refPath)) return null;
    const clean = refPath.split('?')[0].split('#')[0].replace(/^\.\//, '').replace(/^\//, '');
    if (files[clean] !== undefined) return { path: clean, entry: files[clean] };
    const match = Object.keys(files).find((k) => k === clean || k.endsWith('/' + clean));
    return match ? { path: match, entry: files[match] } : null;
  };

  const resolveMediaUrl = (refPath) => {
    const found = resolveEntry(refPath);
    if (!found) return null;
    if (isMediaEntry(found.entry)) return found.entry.dataUrl;
    if (/\.svg$/i.test(found.path) && typeof found.entry === 'string') {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(found.entry)}`;
    }
    return null;
  };

  const resolveCssUrls = (cssText) =>
    cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q, ref) => {
      const url = resolveMediaUrl(ref);
      return url ? `url("${url}")` : full;
    });

  const bridge = injectBridge ? CONSOLE_BRIDGE : '';
  const activeExt = activeFile.split('.').pop()?.toLowerCase();
  const activeEntry = files[activeFile];

  // Direct preview when viewing a media file or SVG
  if (isMediaEntry(activeEntry)) {
    const kind = activeEntry.mime?.split('/')[0];
    const body =
      kind === 'image'
        ? `<img src="${activeEntry.dataUrl}" alt="${activeFile}" style="max-width:100%;max-height:90vh;border-radius:8px;object-fit:contain;" />`
        : kind === 'video'
          ? `<video src="${activeEntry.dataUrl}" controls style="max-width:100%;max-height:90vh;border-radius:8px;"></video>`
          : `<audio src="${activeEntry.dataUrl}" controls style="width:100%;max-width:460px;"></audio>`;
    return `<!DOCTYPE html><html><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090d16;padding:24px;">${body}</body></html>`;
  }

  if (activeExt === 'svg' && typeof activeEntry === 'string') {
    return `<!DOCTYPE html><html><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090d16;padding:24px;">${activeEntry}</body></html>`;
  }

  // Direct preview when viewing Markdown
  if (activeExt === 'md' && typeof activeEntry === 'string') {
    const md = activeEntry
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.*)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '<br/><br/>');
    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;max-width:740px;margin:0 auto;padding:28px;line-height:1.75;color:#0f172a;background:#fff}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace}h1,h2,h3{margin-top:1.4em}</style></head><body>${md}</body></html>`;
  }

  const htmlPath =
    activeExt === 'html' || activeExt === 'htm'
      ? activeFile
      : files['index.html'] !== undefined
        ? 'index.html'
        : Object.keys(files).find((k) => /\.(html|htm)$/i.test(k));

  if (!htmlPath) {
    const cssContent = activeExt === 'css' && typeof activeEntry === 'string' ? resolveCssUrls(activeEntry) : '';
    const jsContent = activeExt === 'js' && typeof activeEntry === 'string' ? activeEntry : '';
    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">${bridge}<style>${cssContent}</style></head><body><div class="card"><h1>معاينة سريعة</h1><p>لا يوجد ملف HTML في مساحة العمل الحالية.</p><button>زر تجريبي</button></div><script>${jsContent}<\/script></body></html>`;
  }

  let html = typeof files[htmlPath] === 'string' ? files[htmlPath] : '';

  // Inline local <link rel="stylesheet" href="...">
  html = html.replace(/<link\b([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (full, a, href) => {
    if (!/rel=["']?stylesheet["']?/i.test(full) || /^https?:\/\//i.test(href)) return full;
    const found = resolveEntry(href);
    return found && typeof found.entry === 'string'
      ? `<style data-file="${href}">\n${resolveCssUrls(found.entry)}\n</style>`
      : full;
  });

  // Resolve inline <style> url(...) references
  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, cssBody) => {
    return `<style${attrs}>${resolveCssUrls(cssBody)}</style>`;
  });

  // Resolve local media src attributes on img, video, audio, source, track
  html = html.replace(
    /<(img|video|audio|source|track)\b([^>]*?\s)src=["']([^"']+)["']([^>]*)>/gi,
    (full, tag, before, src, after) => {
      const mediaUrl = resolveMediaUrl(src);
      return mediaUrl ? `<${tag}${before}src="${mediaUrl}"${after}>` : full;
    }
  );

  // Resolve poster="..." on <video>
  html = html.replace(/<video\b([^>]*?\s)poster=["']([^"']+)["']([^>]*)>/gi, (full, before, poster, after) => {
    const mediaUrl = resolveMediaUrl(poster);
    return mediaUrl ? `<video${before}poster="${mediaUrl}"${after}>` : full;
  });

  // Inline local <script src="..."> (also transpiles .ts/.tsx/.jsx)
  html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*?)>\s*<\/script>/gi, (full, a, src) => {
    if (/^https?:\/\//i.test(src)) return full;
    const found = resolveEntry(src);
    if (!found || typeof found.entry !== 'string') return full;
    let code = found.entry;
    if (/\.(ts|tsx|jsx)$/i.test(found.path)) {
      try {
        const ext = found.path.split('.').pop().toLowerCase();
        code = transpileTSOrJSX(code, ext);
      } catch {}
    }
    return `<script data-file="${src}">\n${code}\n<\/script>`;
  });

  if (bridge) {
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${bridge}`);
    else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${bridge}</head>`);
    else html = `<head>${bridge}</head>${html}`;
  }

  return html;
}
