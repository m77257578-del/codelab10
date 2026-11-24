// Code execution engine: Multi-file Web preview with media asset resolution, JS/TS/JSX worker, Pyodide + offline Python, C/C++/Java

import { transform } from 'sucrase';
import { isMediaEntry } from './storage';
import {
  MINI_REACT_RUNTIME,
  buildEmptyBodyObserver,
  compileWorkspaceBundle,
  detectJsxOrReact,
  escapeHtml,
  escapeInlineScript,
  isStyleFile,
  pickScriptEntry,
  preprocessCss,
  transpileModuleCode,
} from './previewBundler';

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

// Local JSON validator & formatter runner
export function runJson(code) {
  try {
    const parsed = JSON.parse(code);
    const kind = Array.isArray(parsed)
      ? `Array (${parsed.length} items)`
      : parsed !== null && typeof parsed === 'object'
        ? `Object (${Object.keys(parsed).length} keys)`
        : typeof parsed;
    return { out: `[JSON Valid · ${kind}]\n${JSON.stringify(parsed, null, 2)}` };
  } catch (e) {
    return { err: `صيغة JSON غير صالحة: ${e.message}` };
  }
}

// Lightweight local in-memory SQL engine (offline)
function splitSqlArgs(str) {
  const res = [];
  let cur = '';
  let q = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (q) {
      cur += ch;
      if (ch === q && str[i - 1] !== '\\') q = '';
      continue;
    }
    if (ch === "'" || ch === '"') {
      q = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      res.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) res.push(cur.trim());
  return res;
}

function parseSqlLiteral(raw) {
  const t = String(raw || '').trim();
  if (/^null$/i.test(t)) return null;
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1).replace(/\\'/g, "'").replace(/''/g, "'");
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function evalSqlWhere(row, whereClause) {
  if (!whereClause) return true;
  const orParts = whereClause.split(/\s+OR\s+/i);
  return orParts.some((orPart) => {
    const andParts = orPart.split(/\s+AND\s+/i);
    return andParts.every((cond) => {
      const c = cond.trim().replace(/^\(+|\)+$/g, '').trim();
      let m;
      if ((m = c.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i))) return row[m[1]] !== null && row[m[1]] !== undefined;
      if ((m = c.match(/^(\w+)\s+IS\s+NULL$/i))) return row[m[1]] === null || row[m[1]] === undefined;
      if ((m = c.match(/^(\w+)\s+IN\s*\(([^)]+)\)$/i))) {
        const list = splitSqlArgs(m[2]).map(parseSqlLiteral);
        return list.includes(row[m[1]]);
      }
      if ((m = c.match(/^(\w+)\s+LIKE\s+(.+)$/i))) {
        const pat = String(parseSqlLiteral(m[2]) || '');
        const regex = new RegExp('^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
        return regex.test(String(row[m[1]] ?? ''));
      }
      if ((m = c.match(/^(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/))) {
        const lhs = row[m[1]];
        const op = m[2];
        const rhs = parseSqlLiteral(m[3]);
        if (op === '=') return lhs == rhs;
        if (op === '!=' || op === '<>') return lhs != rhs;
        if (op === '>') return Number(lhs) > Number(rhs);
        if (op === '<') return Number(lhs) < Number(rhs);
        if (op === '>=') return Number(lhs) >= Number(rhs);
        if (op === '<=') return Number(lhs) <= Number(rhs);
      }
      return true;
    });
  });
}

function formatSqlTable(columns, rows) {
  if (!rows.length) return `(0 rows)`;
  const cols = columns.length ? columns : Object.keys(rows[0]);
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? 'NULL').length))
  );
  const sep = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const fmtRow = (vals) =>
    '| ' + vals.map((v, i) => String(v ?? 'NULL').padEnd(widths[i])).join(' | ') + ' |';
  return [sep, fmtRow(cols), sep, ...rows.map((r) => fmtRow(cols.map((c) => r[c]))), sep, `(${rows.length} rows)`].join('\n');
}

export function runSql(code, files = {}) {
  const tables = {};
  // Seed JSON array files in workspace as virtual tables
  for (const [path, entry] of Object.entries(files)) {
    if (typeof entry === 'string' && /\.json$/i.test(path)) {
      try {
        const data = JSON.parse(entry);
        if (Array.isArray(data) && data.length && typeof data[0] === 'object') {
          const tName = path.split('/').pop().replace(/\.json$/i, '').replace(/[^\w]/g, '_');
          tables[tName] = { columns: Object.keys(data[0]), rows: data.map((r) => ({ ...r })) };
        }
      } catch {}
    }
  }

  // Fallback sample users table if user immediately runs SELECT * FROM users
  const ensureFallbackUsers = () => {
    if (!tables.users) {
      tables.users = {
        columns: ['id', 'username', 'active', 'created_at'],
        rows: [
          { id: 1, username: 'ahmed', active: 1, created_at: '2026-01-10' },
          { id: 2, username: 'sara', active: 1, created_at: '2026-02-14' },
          { id: 3, username: 'omar', active: 0, created_at: '2026-03-01' },
        ],
      };
    }
  };

  // Strip SQL comments outside quotes and split by ;
  let cleaned = '';
  let q = '';
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (q) {
      cleaned += ch;
      if (ch === q && code[i - 1] !== '\\') q = '';
      continue;
    }
    if (ch === "'" || ch === '"') {
      q = ch;
      cleaned += ch;
      continue;
    }
    if (ch === '-' && code[i + 1] === '-') {
      while (i < code.length && code[i] !== '\n') i++;
      cleaned += '\n';
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 1;
      continue;
    }
    cleaned += ch;
  }

  const stmts = [];
  let cur = '';
  q = '';
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (q) {
      cur += ch;
      if (ch === q && cleaned[i - 1] !== '\\') q = '';
      continue;
    }
    if (ch === "'" || ch === '"') {
      q = ch;
      cur += ch;
      continue;
    }
    if (ch === ';') {
      if (cur.trim()) stmts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) stmts.push(cur.trim());

  const out = [];
  try {
    for (const rawStmt of stmts) {
      const stmt = rawStmt.replace(/\s+/g, ' ').trim();
      let m;

      if (/^SHOW\s+TABLES$/i.test(stmt)) {
        const names = Object.keys(tables);
        out.push(formatSqlTable(['table_name'], names.map((n) => ({ table_name: n }))));
        continue;
      }

      if ((m = stmt.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?(\w+)[`"']?$/i))) {
        delete tables[m[1]];
        out.push(`Table '${m[1]}' dropped.`);
        continue;
      }

      if ((m = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\((.+)\)$/i))) {
        const tName = m[1];
        const colDefs = splitSqlArgs(m[2]);
        const columns = colDefs
          .filter((d) => !/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(d))
          .map((d) => d.trim().split(/\s+/)[0].replace(/[`"']/g, ''));
        tables[tName] = { columns, rows: [] };
        out.push(`Table '${tName}' created (${columns.length} columns).`);
        continue;
      }

      if ((m = stmt.match(/^INSERT\s+INTO\s+[`"']?(\w+)[`"']?\s*(?:\(([^)]+)\))?\s*VALUES\s*(.+)$/i))) {
        const tName = m[1];
        const tbl = tables[tName];
        if (!tbl) return { err: `SQL Error: Table '${tName}' does not exist.` };
        const cols = m[2] ? splitSqlArgs(m[2]).map((c) => c.replace(/[`"']/g, '')) : tbl.columns;
        const tuples = [];
        let depth = 0;
        let start = -1;
        let tq = '';
        const valsStr = m[3];
        for (let i = 0; i < valsStr.length; i++) {
          const ch = valsStr[i];
          if (tq) {
            if (ch === tq && valsStr[i - 1] !== '\\') tq = '';
            continue;
          }
          if (ch === "'" || ch === '"') tq = ch;
          else if (ch === '(') {
            if (depth === 0) start = i + 1;
            depth++;
          } else if (ch === ')') {
            depth--;
            if (depth === 0 && start >= 0) {
              tuples.push(valsStr.slice(start, i));
              start = -1;
            }
          }
        }
        for (const tuple of tuples) {
          const vals = splitSqlArgs(tuple).map(parseSqlLiteral);
          const row = {};
          cols.forEach((c, idx) => {
            row[c] = vals[idx] !== undefined ? vals[idx] : null;
          });
          tbl.rows.push(row);
        }
        out.push(`Inserted ${tuples.length} row(s) into '${tName}'.`);
        continue;
      }

      if ((m = stmt.match(/^UPDATE\s+[`"']?(\w+)[`"']?\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i))) {
        const tName = m[1];
        if (tName === 'users') ensureFallbackUsers();
        const tbl = tables[tName];
        if (!tbl) return { err: `SQL Error: Table '${tName}' does not exist.` };
        const sets = splitSqlArgs(m[2]).map((s) => {
          const [col, ...rest] = s.split('=');
          return [col.trim().replace(/[`"']/g, ''), parseSqlLiteral(rest.join('='))];
        });
        let updated = 0;
        for (const r of tbl.rows) {
          if (evalSqlWhere(r, m[3])) {
            for (const [c, v] of sets) r[c] = v;
            updated++;
          }
        }
        out.push(`Updated ${updated} row(s) in '${tName}'.`);
        continue;
      }

      if ((m = stmt.match(/^DELETE\s+FROM\s+[`"']?(\w+)[`"']?(?:\s+WHERE\s+(.+))?$/i))) {
        const tName = m[1];
        if (tName === 'users') ensureFallbackUsers();
        const tbl = tables[tName];
        if (!tbl) return { err: `SQL Error: Table '${tName}' does not exist.` };
        const before = tbl.rows.length;
        tbl.rows = tbl.rows.filter((r) => !evalSqlWhere(r, m[2]));
        out.push(`Deleted ${before - tbl.rows.length} row(s) from '${tName}'.`);
        continue;
      }

      if ((m = stmt.match(/^SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM\s+[`"']?(\w+)[`"']?(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i))) {
        const distinct = !!m[1];
        const selectPart = m[2].trim();
        const tName = m[3];
        if (tName === 'users') ensureFallbackUsers();
        const tbl = tables[tName];
        if (!tbl) return { err: `SQL Error: Table '${tName}' does not exist.` };

        let rows = tbl.rows.filter((r) => evalSqlWhere(r, m[4]));

        if (m[5]) {
          const [ordCol, ordDir] = m[5].trim().split(/\s+/);
          const desc = /^DESC$/i.test(ordDir || '');
          rows = [...rows].sort((a, b) => {
            const va = a[ordCol];
            const vb = b[ordCol];
            if (va === vb) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
            return desc ? -cmp : cmp;
          });
        }

        const selFields = splitSqlArgs(selectPart);
        const hasAgg = selFields.some((f) => /^(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(f));

        let resultCols = [];
        let resultRows = [];

        if (hasAgg) {
          const aggRow = {};
          for (const f of selFields) {
            const am = f.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(\*|\w+)\s*\)(?:\s+AS\s+(\w+))?$/i);
            if (!am) continue;
            const fn = am[1].toUpperCase();
            const col = am[2];
            const alias = am[3] || `${fn}(${col})`;
            resultCols.push(alias);
            if (fn === 'COUNT') {
              aggRow[alias] = col === '*' ? rows.length : rows.filter((r) => r[col] !== null && r[col] !== undefined).length;
            } else {
              const nums = rows.map((r) => Number(r[col])).filter((n) => !Number.isNaN(n));
              if (fn === 'SUM') aggRow[alias] = nums.reduce((a, b) => a + b, 0);
              else if (fn === 'AVG') aggRow[alias] = nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : null;
              else if (fn === 'MIN') aggRow[alias] = nums.length ? Math.min(...nums) : null;
              else if (fn === 'MAX') aggRow[alias] = nums.length ? Math.max(...nums) : null;
            }
          }
          resultRows = [aggRow];
        } else {
          if (selectPart === '*') {
            resultCols = tbl.columns;
            resultRows = rows.map((r) => ({ ...r }));
          } else {
            const mappings = selFields.map((f) => {
              const asMatch = f.match(/^(\w+)\s+AS\s+(\w+)$/i);
              return asMatch ? [asMatch[1], asMatch[2]] : [f.replace(/[`"']/g, ''), f.replace(/[`"']/g, '')];
            });
            resultCols = mappings.map(([, alias]) => alias);
            resultRows = rows.map((r) => {
              const obj = {};
              for (const [src, alias] of mappings) obj[alias] = r[src];
              return obj;
            });
          }
        }

        if (distinct) {
          const seen = new Set();
          resultRows = resultRows.filter((r) => {
            const key = JSON.stringify(r);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }

        if (m[6]) {
          resultRows = resultRows.slice(0, Number(m[6]));
        }

        out.push(formatSqlTable(resultCols, resultRows));
        continue;
      }

      return { err: `SQL Syntax Error: Unsupported or invalid statement "${stmt}"` };
    }
    return { out: out.join('\n\n') };
  } catch (e) {
    return { err: `SQL Error: ${e.message}` };
  }
}

// Built-in client-side PHP interpreter (offline WebWorker sandbox)
const PHPPRE =
  'let buf="";const __s=(x)=>x===true?"1":x===false?"":x==null?"":Array.isArray(x)||typeof x==="object"?JSON.stringify(x):String(x);const __echo=(...a)=>{buf+=a.map(__s).join("")};const print_r=(x)=>{buf+=JSON.stringify(x,null,2)+"\\n"};const var_dump=(x)=>{buf+=typeof x+"("+__s(x)+")\\n"};const count=(x)=>Array.isArray(x)?x.length:x&&typeof x==="object"?Object.keys(x).length:0;const strlen=(s)=>String(s).length;const strtoupper=(s)=>String(s).toUpperCase();const strtolower=(s)=>String(s).toLowerCase();const trim=(s)=>String(s).trim();const implode=(sep,arr)=>Array.isArray(arr)?arr.join(sep):Object.values(arr||{}).join(sep);const explode=(sep,s)=>String(s).split(sep);const array_push=(a,...v)=>{a.push(...v);return a.length};const array_map=(fn,a)=>a.map(fn);const array_filter=(a,fn)=>a.filter(fn||Boolean);const array_keys=(a)=>Object.keys(a||{});const array_values=(a)=>Object.values(a||{});const in_array=(v,a)=>Array.isArray(a)?a.includes(v):Object.values(a||{}).includes(v);const json_encode=(v)=>JSON.stringify(v);const json_decode=(s,assoc)=>JSON.parse(s);const range=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(i);return o};const round=Math.round;const abs=Math.abs;const max=Math.max;const min=Math.min;const is_array=(x)=>Array.isArray(x)||(x!==null&&typeof x==="object");const is_string=(x)=>typeof x==="string";const is_numeric=(x)=>!isNaN(Number(x));const isset=(...a)=>a.every((x)=>x!==undefined&&x!==null);const empty=(x)=>!x||(Array.isArray(x)&&x.length===0);const __entries=(x)=>Array.isArray(x)?x.map((v,i)=>[i,v]):Object.entries(x||{});const __vals=(x)=>Array.isArray(x)?x:Object.values(x||{});';

function phpToJS(code) {
  let src = code
    .replace(/<\?php\s*/gi, '')
    .replace(/<\?=\s*/g, 'echo ')
    .replace(/\?>/g, '');

  // Extract string literals & comments first so transforms don't corrupt text
  const tokens = [];
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const q = ch;
      let s = q;
      i++;
      while (i < src.length) {
        const c = src[i];
        s += c;
        if (c === '\\' && i + 1 < src.length) {
          i++;
          s += src[i];
        } else if (c === q) {
          i++;
          break;
        }
        i++;
      }
      if (q === '"') {
        const inner = s
          .slice(1, -1)
          .replace(/`/g, '\\`')
          .replace(/\{\$(\w+(?:\[[^\]]+\])?)\}|(?<!\\)\$(\w+)/g, (_, braced, simple) => '${$' + (braced || simple) + '}');
        tokens.push('`' + inner + '`');
      } else {
        tokens.push(s);
      }
      out += `\u0001${tokens.length - 1}\u0002`;
      continue;
    }
    out += ch;
    i++;
  }

  // Convert PHP array(...) and associative [...] syntax
  out = out.replace(/\barray\s*\(/g, '[').replace(/\belseif\b/g, 'else if');

  // Convert [k => v, ...] to {k: v, ...}
  out = out.replace(/\[([^\[\]]*=>[^\[\]]*)\]/g, (_, body) => {
    return '{' + body.replace(/=>/g, ':') + '}';
  });
  // Second pass for nested associative arrays
  out = out.replace(/\[([^\[\]]*=>[^\[\]]*)\]/g, (_, body) => {
    return '{' + body.replace(/=>/g, ':') + '}';
  });

  // Convert foreach ($arr as $k => $v) and foreach ($arr as $v)
  out = out
    .replace(/foreach\s*\(\s*([^)]+?)\s+as\s+(\$\w+)\s*=>\s*(\$\w+)\s*\)/g, 'for (let [$2, $3] of __entries($1))')
    .replace(/foreach\s*\(\s*([^)]+?)\s+as\s+(\$\w+)\s*\)/g, 'for (let $2 of __vals($1))');

  // Convert .= and string concatenation . outside decimal numbers
  out = out
    .replace(/\.=/g, '+=')
    .replace(/->/g, '.')
    .replace(/([^\d\s])\s*\.\s*([^\d\s])/g, '$1 + $2')
    .replace(/(\))\s*\.\s*/g, '$1 + ')
    .replace(/\s*\.\s*(\()/g, ' + $1');

  // Convert echo / print statements
  out = out
    .replace(/\becho\s+([^;]+);/g, '__echo($1);')
    .replace(/\bprint\s+([^;]+);/g, '__echo($1);');

  // Restore string literals
  return out.replace(/\u0001(\d+)\u0002/g, (_, idx) => tokens[Number(idx)]);
}

export async function runPhp(code) {
  try {
    const js = phpToJS(code);
    return await runWorker(js, 3000, PHPPRE);
  } catch (e) {
    return { err: `PHP Error: ${e.message}` };
  }
}

export async function runCode(lang, code, files = {}, locale = 'ar') {
  if (lang === 'python') return runPy(code, files);
  if (lang === 'json') return runJson(code);
  if (lang === 'sql') return runSql(code, files);
  if (lang === 'php') return runPhp(code);
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
  return {
    noRun: true,
    err:
      locale === 'en'
        ? 'Direct browser execution is not available for this language; use the editor for coding and formatting.'
        : 'التشغيل المباشر في المتصفح غير متاح لهذه اللغة؛ استخدم المحرر للكتابة والتنسيق.',
  };
}

export const CONSOLE_BRIDGE = `<script>(()=>{
  const post=(cl,payload)=>{try{parent.postMessage({cl,...payload},'*')}catch(e){}};
  const fmt=(a)=>a.map((x)=>{if(x instanceof Error)return x.stack||x.message;if(typeof x==='object'&&x!==null){try{return JSON.stringify(x,null,2)}catch(e){}}return String(x)}).join(' ');
  window.__codelabLogs=[];
  const pushLog=(level,m)=>{window.__codelabLogs.push({level,m});if(window.__codelabLogs.length>200)window.__codelabLogs.shift();};
  console.log=(...a)=>{const m=fmt(a);pushLog('log',m);post('log',{level:'log',m})};
  console.info=(...a)=>{const m=fmt(a);pushLog('info',m);post('log',{level:'info',m})};
  console.warn=(...a)=>{const m=fmt(a);pushLog('warn',m);post('log',{level:'warn',m})};
  console.error=(...a)=>{const m=fmt(a);pushLog('error',m);post('log',{level:'error',m})};
  console.clear=()=>{window.__codelabLogs=[];post('clear',{})};
  window.onerror=(m,u,l,c)=>{pushLog('error',String(m));post('err',{m:String(m),l:l||0,c:c||0})};
  window.onunhandledrejection=(e)=>{const msg='Unhandled Promise: '+String(e.reason);pushLog('error',msg);post('err',{m:msg,l:0,c:0})};
  const makeMemStorage=()=>{const s=new Map();return{getItem:(k)=>s.has(String(k))?s.get(String(k)):null,setItem:(k,v)=>s.set(String(k),String(v)),removeItem:(k)=>s.delete(String(k)),clear:()=>s.clear(),key:(i)=>Array.from(s.keys())[i]??null,get length(){return s.size}}};
  try{const _t=window.localStorage;void _t.length}catch{try{Object.defineProperty(window,'localStorage',{value:makeMemStorage(),configurable:true})}catch{}}
  try{const _s=window.sessionStorage;void _s.length}catch{try{Object.defineProperty(window,'sessionStorage',{value:makeMemStorage(),configurable:true})}catch{}}
  try{
    const origPush=history.pushState.bind(history);
    const origReplace=history.replaceState.bind(history);
    history.pushState=(...a)=>{try{return origPush(...a)}catch{}};
    history.replaceState=(...a)=>{try{return origReplace(...a)}catch{}};
  }catch{}
})();<\/script>`;

// Resolve local CSS, JS/TS/JSX/TSX, and Media assets (images, videos, audio, SVG) against workspace files
export function buildWebPreviewDoc(files, activeFile = '', injectBridge = true, locale = 'ar') {
  const dir = locale === 'en' ? 'ltr' : 'rtl';
  const isEn = locale === 'en';
  const safeFiles = files && typeof files === 'object' ? files : {};

  const resolveEntry = (refPath) => {
    if (!refPath || /^(https?:|data:|blob:|mailto:|#)/i.test(refPath)) return null;
    const clean = refPath.split('?')[0].split('#')[0].replace(/^\.\//, '').replace(/^\//, '');
    if (safeFiles[clean] !== undefined) return { path: clean, entry: safeFiles[clean] };
    const match = Object.keys(safeFiles).find((k) => k === clean || k.endsWith('/' + clean));
    return match ? { path: match, entry: safeFiles[match] } : null;
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
    String(cssText || '').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q, ref) => {
      const url = resolveMediaUrl(ref);
      return url ? `url("${url}")` : full;
    });

  const bridge = injectBridge ? CONSOLE_BRIDGE : '';
  const emptyObserver = injectBridge ? buildEmptyBodyObserver(activeFile, locale) : '';
  const activeExt = (activeFile || '').split('.').pop()?.toLowerCase() || '';
  const activeEntry = safeFiles[activeFile];

  // Direct preview when viewing a media file or SVG
  if (isMediaEntry(activeEntry)) {
    const kind = activeEntry.mime?.split('/')[0];
    const body =
      kind === 'image'
        ? `<img src="${activeEntry.dataUrl}" alt="${escapeHtml(activeFile)}" style="max-width:100%;max-height:90vh;border-radius:8px;object-fit:contain;" />`
        : kind === 'video'
          ? `<video src="${activeEntry.dataUrl}" controls style="max-width:100%;max-height:90vh;border-radius:8px;"></video>`
          : `<audio src="${activeEntry.dataUrl}" controls style="width:100%;max-width:460px;"></audio>`;
    return `<!DOCTYPE html><html><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090d16;padding:24px;">${body}</body></html>`;
  }

  if (activeExt === 'svg' && typeof activeEntry === 'string') {
    return `<!DOCTYPE html><html><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090d16;padding:24px;">${activeEntry}</body></html>`;
  }

  // Direct preview when viewing Markdown
  if ((activeExt === 'md' || activeExt === 'markdown') && typeof activeEntry === 'string') {
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
    return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;max-width:740px;margin:0 auto;padding:28px;line-height:1.75;color:#0f172a;background:#fff}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace}h1,h2,h3{margin-top:1.4em}</style></head><body>${md}</body></html>`;
  }

  const htmlPath =
    activeExt === 'html' || activeExt === 'htm'
      ? activeFile
      : safeFiles['index.html'] !== undefined
        ? 'index.html'
        : Object.keys(safeFiles).find((k) => /^index\.html?$/i.test(k.split('/').pop())) ||
          Object.keys(safeFiles).find((k) => /\.(html|htm)$/i.test(k));

  // No HTML file in workspace: bundle JS/TS/JSX/TSX/React/CSS directly or preview structured files cleanly
  if (!htmlPath) {
    const scriptEntry = pickScriptEntry(safeFiles, activeFile);

    // Collect workspace stylesheets (all .css/.scss if active is css or script workspace without html)
    const workspaceStyles = Object.entries(safeFiles)
      .filter(([p, v]) => isStyleFile(p) && typeof v === 'string')
      .map(([p, v]) => `/* ${p} */\n${resolveCssUrls(preprocessCss(v, p))}`)
      .join('\n');

    // Pure CSS/SCSS preview when no JS/TS/JSX/TSX entry is active or present
    if (isStyleFile(activeFile) && typeof activeEntry === 'string' && !scriptEntry) {
      const cssOnly = resolveCssUrls(preprocessCss(activeEntry, activeFile));
      const hTitle = isEn ? 'Live CSS Preview' : 'معاينة تنسيقات CSS الحية';
      const hSub = isEn
        ? 'All rules targeting body, headings, buttons, inputs, and .card update here in real time.'
        : 'تُطبّق قواعد CSS على العناصر هنا مباشرةً دون الحاجة إلى ملف HTML.';
      const btnA = isEn ? 'Primary Button' : 'زر أساسي';
      const btnB = isEn ? 'Secondary' : 'زر ثانوي';
      return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8">${bridge}<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f8fafc;color:#0f172a}.card{max-width:520px;margin:0 auto;padding:24px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 6px 20px rgba(15,23,42,.08)}.actions{display:flex;gap:10px;margin-top:16px}button{padding:9px 16px;border-radius:8px;border:0;background:#0ea5e9;color:#fff;font-weight:600;cursor:pointer}button.secondary{background:#e2e8f0;color:#0f172a}</style><style data-file="${escapeHtml(activeFile)}">${cssOnly}</style></head><body><main class="card container"><h1>${hTitle}</h1><p>${hSub}</p><div class="actions"><button class="btn">${btnA}</button><button class="btn secondary">${btnB}</button></div></main></body></html>`;
    }

    // JS / TS / JSX / TSX / React app preview without an HTML file
    if (scriptEntry && (isStyleFile(activeFile) || /\.(js|mjs|cjs|jsx|ts|tsx)$/i.test(activeFile) || !activeFile)) {
      const { runtimeScript, extraCss } = compileWorkspaceBundle(
        safeFiles,
        scriptEntry,
        resolveMediaUrl,
        resolveCssUrls
      );
      const needsReact =
        /\.(jsx|tsx)$/i.test(scriptEntry) ||
        Object.entries(safeFiles).some(([p, v]) => typeof v === 'string' && detectJsxOrReact(v, p));
      const reactScript = needsReact ? MINI_REACT_RUNTIME : '';
      const mergedCss = [workspaceStyles, extraCss].filter(Boolean).join('\n');
      const baseStyles = `body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#ffffff;color:#0f172a;min-height:100vh}*,*::before,*::after{box-sizing:border-box}`;

      return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(scriptEntry)}</title>${bridge}<style>${baseStyles}</style>${mergedCss ? `<style>${mergedCss}</style>` : ''}${reactScript}</head><body><div id="root"></div><div id="app"></div>${runtimeScript}${emptyObserver}</body></html>`;
    }

    // JSON structured preview when no HTML exists
    if (activeExt === 'json' && typeof activeEntry === 'string') {
      let badge = isEn ? 'Valid JSON' : 'JSON صالح';
      let bodyText = activeEntry;
      let isErr = false;
      try {
        const parsed = JSON.parse(activeEntry);
        bodyText = JSON.stringify(parsed, null, 2);
      } catch (e) {
        isErr = true;
        badge = isEn ? `Invalid JSON: ${e.message}` : `خطأ JSON: ${e.message}`;
      }
      return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8">${bridge}<style>body{margin:0;padding:20px;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.tag{font-size:12px;padding:3px 10px;border-radius:999px;background:${isErr ? '#7f1d1d' : '#064e3b'};color:${isErr ? '#fecaca' : '#6ee7b7'}}pre{margin:0;padding:16px;border-radius:10px;background:#020617;border:1px solid #334155;overflow:auto;font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.6}</style></head><body><div class="head"><strong>${escapeHtml(activeFile)}</strong><span class="tag">${escapeHtml(badge)}</span></div><pre dir="ltr">${escapeHtml(bodyText)}</pre></body></html>`;
    }

    // Any other non-HTML workspace: if a script entry exists, run it; otherwise render clean source preview
    if (scriptEntry) {
      const { runtimeScript, extraCss } = compileWorkspaceBundle(
        safeFiles,
        scriptEntry,
        resolveMediaUrl,
        resolveCssUrls
      );
      const needsReact =
        /\.(jsx|tsx)$/i.test(scriptEntry) ||
        Object.entries(safeFiles).some(([p, v]) => typeof v === 'string' && detectJsxOrReact(v, p));
      const reactScript = needsReact ? MINI_REACT_RUNTIME : '';
      const mergedCss = [workspaceStyles, extraCss].filter(Boolean).join('\n');
      return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8">${bridge}<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif}</style>${mergedCss ? `<style>${mergedCss}</style>` : ''}${reactScript}</head><body><div id="root"></div><div id="app"></div>${runtimeScript}${emptyObserver}</body></html>`;
    }

    const previewTitle = escapeHtml(activeFile || (isEn ? 'Workspace Preview' : 'معاينة الملف'));
    const previewHint = isEn
      ? 'Previewing file source. Use Run (Ctrl+Enter) for terminal execution.'
      : 'معاينة محتوى الملف. استخدم زر التشغيل (Ctrl+Enter) لتنفيذ المخرجات في وحدة التحكم.';
    const contentText = typeof activeEntry === 'string' ? activeEntry : '';
    return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8">${bridge}<style>body{margin:0;padding:20px;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13px}.hint{font-size:12px;color:#94a3b8;margin:0 0 12px}pre{margin:0;padding:14px;border-radius:8px;background:#020617;border:1px solid #334155;font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.55;overflow:auto;white-space:pre-wrap}</style></head><body><div class="card"><div class="top"><strong>${previewTitle}</strong><span>${escapeHtml(activeExt.toUpperCase() || 'FILE')}</span></div><p class="hint">${previewHint}</p><pre dir="ltr">${escapeHtml(contentText)}</pre></div></body></html>`;
  }

  let html = typeof safeFiles[htmlPath] === 'string' ? safeFiles[htmlPath] : '';
  let needsReactRuntime = false;
  const bundledStyles = [];

  // Inline local <link rel="stylesheet" href="..."> regardless of attribute order
  html = html.replace(/<link\b([^>]*)>/gi, (full, attrs) => {
    if (!/rel=["']?stylesheet["']?/i.test(attrs)) return full;
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return full;
    const href = hrefMatch[1];
    if (/^https?:\/\//i.test(href)) return full;
    const found = resolveEntry(href);
    return found && typeof found.entry === 'string'
      ? `<style data-file="${escapeHtml(href)}">\n${resolveCssUrls(preprocessCss(found.entry, found.path))}\n</style>`
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

  // Inline local <script src="..."> (supports classic JS, ES modules, TS, JSX, TSX)
  html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (full, attrs) => {
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) return full;
    const src = srcMatch[1];
    if (/^https?:\/\//i.test(src)) return full;
    const found = resolveEntry(src);
    if (!found || typeof found.entry !== 'string') return full;

    const code = found.entry;
    const isMod = /\btype=["']?(?:module|text\/babel|text\/jsx|text\/tsx|text\/typescript)["']?/i.test(attrs);
    const hasImportsOrJsx =
      isMod ||
      /\.(ts|tsx|jsx|mjs)$/i.test(found.path) ||
      /^\s*(?:import|export)\s+/m.test(code) ||
      detectJsxOrReact(code, found.path);

    if (hasImportsOrJsx) {
      if (detectJsxOrReact(code, found.path) || /\.(jsx|tsx)$/i.test(found.path)) {
        needsReactRuntime = true;
      }
      const { runtimeScript, extraCss } = compileWorkspaceBundle(
        safeFiles,
        found.path,
        resolveMediaUrl,
        resolveCssUrls
      );
      if (extraCss) bundledStyles.push(extraCss);
      return runtimeScript;
    }

    return `<script data-file="${escapeHtml(src)}">\n${escapeInlineScript(code)}\n<\/script>`;
  });

  // Transpile inline <script> blocks if they use module/JSX/TS syntax
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/\bsrc=/i.test(attrs) || !body.trim()) return full;
    const explicitType = /\btype=["']?(?:module|text\/babel|text\/jsx|text\/tsx|text\/typescript)["']?/i.test(attrs);
    const hasJsxOrTs = explicitType || /^\s*(?:import|export)\s+/m.test(body);
    if (!hasJsxOrTs) return full;
    if (detectJsxOrReact(body, 'inline.tsx') || /text\/(?:babel|jsx|tsx)/i.test(attrs)) {
      needsReactRuntime = true;
    }
    const transpiled = transpileModuleCode(body, explicitType ? 'inline.tsx' : 'inline.js');
    return `<script>(()=>{const module={exports:{}};const exports=module.exports;const require=(s)=>s==='react'||s==='react/jsx-runtime'?window.React:s==='react-dom'||s==='react-dom/client'?window.ReactDOM:{};\n${escapeInlineScript(transpiled)}\n})();<\/script>`;
  });

  const headInjections = [
    bridge,
    bundledStyles.length ? `<style>${bundledStyles.join('\n')}</style>` : '',
    needsReactRuntime ? MINI_REACT_RUNTIME : '',
  ]
    .filter(Boolean)
    .join('\n');

  const hasHtmlTag = /<html\b/i.test(html);
  const hasBodyTag = /<body\b/i.test(html);

  if (!hasHtmlTag && !hasBodyTag) {
    html = `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8">${headInjections}</head><body>${html}${emptyObserver}</body></html>`;
    return html;
  }

  if (headInjections) {
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${headInjections}`);
    else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${headInjections}</head>`);
    else html = `<head>${headInjections}</head>${html}`;
  }

  if (!hasBodyTag) {
    if (/<\/html>/i.test(html)) html = html.replace(/<\/html>/i, `<body>${emptyObserver}</body></html>`);
    else html += `<body>${emptyObserver}</body>`;
  } else if (emptyObserver) {
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${emptyObserver}\n</body>`);
    else html += emptyObserver;
  }

  return html;
}
