'use client';
// CodeLab | كود لاب — Next.js 14 (App Router) single-file app. Put this file at app/page.js
import { useState, useEffect, useRef, useCallback } from 'react';

/* ===== Config ===== */
const GEMINI_MODEL = 'gemini-2.0-flash';
const LANGS = { html: 'HTML', css: 'CSS', js: 'JavaScript', python: 'Python', cpp: 'C++', java: 'Java' };
const STARTERS = {
  html: '<h1>مرحباً بك في CodeLab</h1>\n<button id="b">اضغط هنا</button>',
  css: 'body { background: #1e1b4b; color: #fde68a; font-family: sans-serif; }\nh1 { text-align: center; }',
  js: "console.log('مرحباً من CodeLab');\nlet a = 5, b = 3;\nconsole.log('المجموع:', a + b);",
  python: 'name = "CodeLab"\nprint("Hello " + name)',
  cpp: '#include <iostream>\nint main() {\n  std::cout << "Hello";\n  return 0;\n}',
  java: 'public class Main {\n  public static void main(String[] a) {\n    System.out.println("Hello");\n  }\n}',
};
const KW = /\b(function|const|let|var|return|if|else|for|while|class|import|def|print|int|void|public|static|new|include|true|false|null|None|and|or|not|in|try|catch)\b/g;
/* ===== AI client (talks to app/api/ai/route.js; the Gemini key stays on the server) ===== */
async function api(action, body = {}) {
  try { const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) }); return await r.json(); } catch { return null; }
}
const askAI = (prompt, history = [], parts = []) => api('ai', { prompt, history, parts });

/* ===== Code runners: JS (worker), Python (Pyodide), C++/Java (translated to JS for simple programs) ===== */
const PRE = 'let buf="";const __w=(...a)=>{buf+=a.join("")};const __l=(...a)=>{buf+=a.join("")+"\\n"};const console={log:(...a)=>{buf+=a.join(" ")+"\\n"}};';
const runMain = (src, pre = PRE) => { try { return { out: new Function(pre + src + '\nreturn buf;')() }; } catch (e) { return { err: e.message }; } };
const runWorker = (src, ms = 3000, pre = PRE) => new Promise((res) => {
  let w;
  try { w = new Worker(URL.createObjectURL(new Blob([`onmessage=()=>{try{postMessage({out:(new Function(${JSON.stringify(pre + src + '\nreturn buf;')}))()})}catch(e){postMessage({err:e.message})}}`]))); } catch { return res(runMain(src, pre)); }
  const t = setTimeout(() => { w.terminate(); res({ err: 'الكود يعمل بلا توقف (حلقة لا نهائية؟)' }); }, ms);
  w.onmessage = (e) => { clearTimeout(t); w.terminate(); res(e.data); };
  w.onerror = () => { clearTimeout(t); w.terminate(); res(runMain(src, pre)); };
  w.postMessage(1);
});
/* ===== Built-in Python engine: translates beginner Python to JS so Python always runs (even offline) ===== */
const PYPRE = 'let buf="";const __r=(x)=>typeof x==="string"?"\'"+x+"\'":__s(x);const __s=(x)=>x===true?"True":x===false?"False":x==null?"None":Array.isArray(x)?"["+x.map(__r).join(", ")+"]":typeof x==="object"?"{"+Object.entries(x).map(([k,v])=>__r(k)+": "+__r(v)).join(", ")+"}":String(x);const print=(...a)=>{buf+=a.map(__s).join(" ")+"\\n"};const __pe=(a,e)=>{buf+=a.map(__s).join(" ")+e};const range=(a,b,c=1)=>{if(b===undefined){b=a;a=0}const o=[];if(c>0)for(let i=a;i<b;i+=c)o.push(i);else for(let i=a;i>b;i+=c)o.push(i);return o};const len=(x)=>x.length;const str=__s;const int=(x)=>Math.trunc(Number(x));const float=Number;const abs=Math.abs;const round=(x,n=0)=>Number(x.toFixed(n));const max=(...a)=>Math.max(...(a.length===1?a[0]:a));const min=(...a)=>Math.min(...(a.length===1?a[0]:a));const sum=(a)=>a.reduce((x,y)=>x+y,0);const sorted=(a)=>[...a].sort((x,y)=>x>y?1:x<y?-1:0);const enumerate=(a)=>[...a].map((x,i)=>[i,x]);const __in=(a,b)=>Array.isArray(b)||typeof b==="string"?b.includes(a):a in b;const __fd=(a,b)=>Math.floor(a/b);const math={...Math,pi:Math.PI};const input=()=>{throw new Error("input() غير مدعوم هنا")};';
function tern(e) {
  let d = 0, ifAt = -1, elseAt = -1;
  for (let i = 0; i < e.length; i++) { const c = e[i]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (d === 0 && ifAt < 0 && e.startsWith(' if ', i)) ifAt = i; else if (d === 0 && ifAt >= 0 && elseAt < 0 && e.startsWith(' else ', i)) elseAt = i; }
  if (ifAt >= 0 && elseAt > ifAt) return `(${tern(e.slice(ifAt + 4, elseAt))}) ? (${tern(e.slice(0, ifAt))}) : (${tern(e.slice(elseAt + 6))})`;
  return e.replace(/\(([^()]*)\)/g, (m, g) => '(' + tern(g) + ')');
}
function pyToJS(src) {
  const STR = /([fFrRbB]?(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'))/g;
  const OP = '(?:[\\w.\\u0001\\u0002]+(?:\\([^()]*\\))?|\\([^()]*\\))', O1 = '[\\w.\\u0001\\u0002]+';
  const conv = (e) => {
    const strs = [];
    let t = e.replace(STR, (m) => { strs.push(m); return '\u0001' + (strs.length - 1) + '\u0002'; });
    t = t.replace(new RegExp(`(${O1})\\s+not\\s+in\\s+(\\[[^\\]]*\\])`, 'g'), '!__in($1, $2)').replace(new RegExp(`(${O1})\\s+in\\s+(\\[[^\\]]*\\])`, 'g'), '__in($1, $2)')
      .replace(new RegExp(`(${O1})\\s+not\\s+in\\s+(${O1})`, 'g'), '!__in($1, $2)').replace(new RegExp(`(${O1})\\s+in\\s+(${O1})`, 'g'), '__in($1, $2)')
      .replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
      .replace(/\bis\s+not\b/g, '!==').replace(/\bis\b/g, '===').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!')
      .replace(new RegExp(`(${OP})\\s*//\\s*(${OP})`, 'g'), '__fd($1, $2)')
      .replace(/(\u0001\d+\u0002)\s*\*\s*([\w.]+)/g, '$1.repeat($2)').replace(/([\w.]+)\s*\*\s*(\u0001\d+\u0002)/g, '$2.repeat($1)')
      .replace(/(\u0001\d+\u0002)\.join\(([^()]*)\)/g, '$2.join($1)')
      .replace(/\.append\(/g, '.push(').replace(/\.upper\(\)/g, '.toUpperCase()').replace(/\.lower\(\)/g, '.toLowerCase()').replace(/\.strip\(\)/g, '.trim()')
      .replace(/\.startswith\(/g, '.startsWith(').replace(/\.endswith\(/g, '.endsWith(').replace(/\.replace\(/g, '.replaceAll(')
      .replace(/\.sort\(\)/g, '.sort((a,b)=>a>b?1:a<b?-1:0)').replace(/([\w.]+)\.items\(\)/g, 'Object.entries($1)').replace(/([\w.]+)\.keys\(\)/g, 'Object.keys($1)').replace(/([\w.]+)\.values\(\)/g, 'Object.values($1)')
      .replace(/lambda\s*([\w,\s]*):\s*([^,)]+)/g, '(($1) => ($2))');
    t = tern(t);
    return t.replace(/\u0001(\d+)\u0002/g, (m, i) => {
      const x = strs[i];
      if (/^[fF]/.test(x)) return '`' + x.slice(2, -1).replace(/`/g, '\\`').replace(/\{([^{}:!]+)(?::\.(\d+)f)?\}/g, (mm, ex, n) => (n ? '${(' + conv(ex) + ').toFixed(' + n + ')}' : '${__s(' + conv(ex) + ')}')) + '`';
      return /^[rRbB]/.test(x) ? x.slice(1) : x;
    });
  };
  const cutComment = (l) => { let q = '', i = 0; for (; i < l.length; i++) { const c = l[i]; if (q) { if (c === '\\') i++; else if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (c === '#') break; } return l.slice(0, i); };
  const colon = (t) => { let d = 0, q = ''; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '\\') i++; else if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ':' && d === 0) return i; } return -1; };
  const stmt = (t) => {
    let m;
    if ((m = t.match(/^print\((.*),\s*end\s*=\s*(".*?"|'.*?')\s*\)$/))) return `__pe([${conv(m[1])}], ${m[2]});`;
    if ((m = t.match(/^return\b\s*(.*)$/))) return `return ${m[1] ? conv(m[1]) : ''};`;
    if (t === 'pass') return ';';
    if (t === 'break' || t === 'continue') return t + ';';
    if (/^(import|from|global|nonlocal)\b/.test(t)) return '';
    if ((m = t.match(/^(\w+)\s*\/\/=\s*(.+)$/))) return `${m[1]} = __fd(${m[1]}, ${conv(m[2])});`;
    if ((m = t.match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*=(?!=)\s*(.+)$/))) return m[1].includes(',') ? `var [${m[1]}] = [${conv(m[2])}];` : `var ${m[1]} = ${conv(m[2])};`;
    return `${conv(t)};`;
  };
  const out = [], stack = [0]; let open = false;
  for (const raw of src.replace(/\r/g, '').replace(/\t/g, '    ').split('\n')) {
    const ln = cutComment(raw).replace(/\s+$/, ''); if (!ln.trim()) continue;
    const ind = ln.match(/^ */)[0].length, t = ln.trim();
    if (open) { if (ind <= stack[stack.length - 1]) throw new Error('IndentationError: يجب إزاحة السطر بعد النقطتين'); stack.push(ind); open = false; }
    while (ind < stack[stack.length - 1]) { stack.pop(); out.push('}'); }
    if (ind !== stack[stack.length - 1]) throw new Error('IndentationError: إزاحة غير متناسقة');
    const m = t.match(/^(if|elif|else|while|for|def|try|except|finally)\b/);
    if (!m) { out.push(stmt(t)); continue; }
    const ci = colon(t); if (ci < 0) throw new Error('SyntaxError: ينقص : في نهاية السطر');
    const head = t.slice(0, ci).trim(), body = t.slice(ci + 1).trim(), kw = m[1];
    let js;
    if (kw === 'if') js = `if (${conv(head.slice(2))}) {`;
    else if (kw === 'elif') js = `else if (${conv(head.slice(4))}) {`;
    else if (kw === 'while') js = `while (${conv(head.slice(5))}) {`;
    else if (kw === 'else') js = 'else {';
    else if (kw === 'try') js = 'try {';
    else if (kw === 'finally') js = 'finally {';
    else if (kw === 'except') js = 'catch (__e) {';
    else if (kw === 'def') { const d = head.match(/^def\s+(\w+)\s*\((.*)\)$/); if (!d) throw new Error('SyntaxError: تعريف دالة غير صحيح'); js = `function ${d[1]}(${d[2]}) {`; }
    else { const f = head.match(/^for\s+(.+?)\s+in\s+(.+)$/); if (!f) throw new Error('SyntaxError: حلقة for غير صحيحة'); js = `for (var ${f[1].includes(',') ? '[' + f[1] + ']' : f[1]} of ${conv(f[2])}) {`; }
    if (/^(elif|else|except|finally)$/.test(kw) && out[out.length - 1] === '}') { out.pop(); js = '} ' + js; }
    out.push(js);
    if (body) { body.split(/;\s*/).filter(Boolean).forEach((b) => out.push(stmt(b))); out.push('}'); } else open = true;
  }
  if (open) throw new Error('IndentationError: ينقص محتوى بعد النقطتين');
  while (stack.length > 1) { stack.pop(); out.push('}'); }
  return out.join('\n');
}
let pyo = null, pyLoading = null;
const PYO = ['https://cdn.jsdelivr.net/pyodide/v0.26.4/full/', 'https://cdn.jsdelivr.net/npm/pyodide@0.26.4/', 'https://pyodide-cdn2.iodide.io/v0.26.4/full/'];
const loadScript = (src) => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('تعذر تحميل ' + src)); document.head.appendChild(el); });
async function getPy() {
  if (pyo) return pyo;
  pyLoading ||= (async () => { let last; for (const base of PYO) { try { if (!window.loadPyodide) await loadScript(base + 'pyodide.js'); return await window.loadPyodide({ indexURL: base }); } catch (e) { last = e; } } throw last; })();
  try { pyo = await pyLoading; } catch (e) { pyLoading = null; throw e; }
  return pyo;
}
async function runPy(code) {
  if (pyo) {
    try { let o = ''; pyo.setStdout({ batched: (x) => (o += x + '\n') }); pyo.setStderr({ batched: () => {} }); await pyo.runPythonAsync(code); return { out: o }; }
    catch (e) { return { err: String(e.message).split('\n').filter(Boolean).slice(-1)[0] }; }
  }
  getPy().catch(() => {}); // يحمّل Python الكامل في الخلفية للمرات القادمة
  let js; try { js = pyToJS(code); } catch (e) { return { noRun: true, err: e.message }; }
  return { ...(await runWorker(js, 3000, PYPRE)), internal: true };
}
function toJS(code, lang) {
  let s = code.replace(/\/\/.*$/gm, '').replace(/#include.*|using namespace.*|^\s*import .*;|^\s*package .*;/gm, '').replace(/std::/g, '');
  if (lang === 'java') s = s.replace(/(public\s+)?class\s+\w+\s*\{/, '').replace(/\}\s*$/, '').replace(/(public\s+)?static\s+void\s+main\s*\([^)]*\)/, 'function main()');
  else s = s.replace(/int\s+main\s*\(\s*\)/, 'function main()');
  const T = 'int|long|double|float|bool|boolean|String|string';
  s = s.replace(new RegExp(`\\b(?:static\\s+)?(?:${T}|void)\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*\\{`, 'g'), (m, n, p) => `function ${n}(${p.replace(new RegExp(`\\b(?:${T})\\s+`, 'g'), '')}) {`);
  s = s.replace(new RegExp(`\\b(?:${T}|auto)\\s+(\\w+)\\s*(=|;)`, 'g'), 'let $1 $2');
  s = s.replace(/cout\s*((?:<<[^;]+)+);/g, (m, ch) => `__w(${ch.split('<<').slice(1).map((x) => (x.trim() === 'endl' ? '"\\n"' : x.trim())).join(', ')});`);
  s = s.replace(/System\.out\.println\(/g, '__l(').replace(/System\.out\.print\(/g, '__w(');
  s = s.replace(/(\b\w+\b)\s*\/\s*(\b\w+\b)/g, 'Math.trunc($1 / $2)');
  return /function main\(/.test(s) ? s + '\nmain();' : s;
}
async function runCode(lang, code) {
  if (lang === 'python') return runPy(code);
  const r = await runWorker(lang === 'js' ? code : toJS(code, lang));
  return r;
}
const TT = ['المتغيرات والجمع', 'الضرب والطرح', 'أولوية العمليات', 'الحلقات for', 'الشرط داخل الحلقة', 'الدوال', 'القسمة والباقي', 'الحلقات المتداخلة', 'الدوال التكرارية: المضروب', 'الدوال التكرارية: فيبوناتشي'];
const LES = [
  'المتغير صندوق يحفظ قيمة باسم. نعرّف متغيرين ثم نجمعهما بعلامة + ونطبع الناتج.',
  'نستخدم * للضرب و - للطرح. الضرب يُحسب قبل الطرح تلقائياً.',
  'للعمليات أولوية: الأقواس أولاً ثم الضرب والقسمة ثم الجمع والطرح. الأقواس تغيّر الترتيب.',
  'الحلقة for تكرر أمراً عدة مرات. هنا نمرّ على الأعداد من 1 إلى K ونجمعها في متغير.',
  'نضع شرطاً if داخل الحلقة لننفّذ الجمع فقط عندما يتحقق الشرط. % يعطي باقي القسمة.',
  'الدالة مجموعة أوامر لها اسم. نستدعيها بالاسم وتعطينا قيمة ترجعها عبر return.',
  'القسمة الصحيحة تعطي الجزء الصحيح من الناتج، و % يعطي الباقي. لكل لغة طريقتها.',
  'نضع حلقة داخل حلقة. الحلقة الداخلية تُنفَّذ كاملة لكل دورة من الخارجية.',
  'الدالة التكرارية تنادي نفسها بقيمة أصغر حتى تصل لحالة التوقف. المضروب: n! = n × (n-1)!',
  'متتالية فيبوناتشي: كل رقم هو مجموع الرقمين قبله. الدالة تنادي نفسها مرتين.',
];
const norm = (q) => q.toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const FAQ0 = [
  ['مطور|محمود|مدحت|صاحب المنصه|مين عمل|مين صمم|من صنع|من صمم|\\bdeveloper\\b|\\bcreator\\b|\\bowner\\b|who (made|built|created)|qui a (cree|fait)', 'المطور هو محمود مدحت. للتواصل معه: واتساب 01040630335 (زر واتساب في صفحة بروفايل المطور).', 'The developer is Mahmoud Medhat. Contact him on WhatsApp: +20 104 063 0335 (button on the Developer Profile page).'],
  ['بايثون|بيثون|\\bpython\\b', 'Python يعمل في المنصة: المحرك الداخلي يشغّل الأكواد البسيطة فوراً، ويُحمَّل Python الكامل في الخلفية لأول مرة.', 'Python runs in the platform: the built-in engine runs simple code instantly while full Python loads in the background.'],
  ['دمج|\\bmerge\\b', 'في HTML وCSS وJS كل تبويب يعرض نتيجته وحده. اضغط 🔗 دمج النتائج لعرض الثلاثة معاً.', 'In HTML/CSS/JS each tab shows its own result. Press 🔗 Merge to see all three together.'],
  ['متصفح|فتح|رابط|\\bbrowser\\b|\\bopen\\b', 'زر ↗ فتح في المتصفح يفتح نتيجة الكود في تبويب جديد لتجربته كصفحة كاملة.', 'The ↗ Open in browser button opens your result in a new tab so you can try it as a full page.'],
  ['تثبيت|تطبيق|\\binstall\\b|\\bapp\\b', 'اضغط 📲 تثبيت أعلى الصفحة، أو من قائمة المتصفح اختر «تثبيت التطبيق».', 'Tap 📲 Install at the top, or choose "Install app" from the browser menu.'],
  ['مستوي|مستويات|ليفل|\\blevels?\\b', 'في كل لغة 100 مستوى: شرح، ثم تمرين تكتبه في المحرر، ثم اختبار سريع. المستوى التالي يُفتح بعد نجاحك.', 'Each language has 100 levels: a lesson, a coding exercise in the editor, then a quick quiz. The next level unlocks after you pass.'],
  ['خطا|غلط|\\berrors?\\b|\\bbug\\b|exception|erreur', 'اضغط تشغيل وستشرح لك المنصة مكان الخطأ وسببه وحله. أكثر الأخطاء: نقص ; أو قوس غير مغلق أو اسم متغير خاطئ.', 'Press Run and the platform explains where the error is, why, and how to fix it. Common ones: missing ;, unclosed bracket, wrong variable name.'],
  ['تشغيل|شغل|المحرر|نتيج|\\brun\\b|editor|result', 'اكتب كودك في المحرر واضغط ▶ تشغيل. النتيجة تظهر في Terminal أو في المعاينة، وإن كان فيه خطأ يظهر سببه وحله.', 'Write code in the editor and press ▶ Run. Output shows in the Terminal or preview; errors come with a fix.'],
  ['ذكاء|جيميناي|gemini|\\bai\\b|صور|ملف|رفع|upload|image', 'الذكاء الداخلي يجيب عن المنصة والأساسيات فقط. الدردشة الكاملة ورفع الصور والملفات وكتابة الأكواد تعمل مع Gemini عندما يكون متاحاً.', 'The built-in assistant only covers the platform and basics. Full chat, image/file upload and code writing work with Gemini when it is available.'],
  ['متغير|\\bvariables?\\b', 'المتغير صندوق يحفظ قيمة باسم، مثل a = 5 في Python أو let a = 5; في JavaScript.', 'A variable is a named box that stores a value, e.g. a = 5 in Python or let a = 5; in JavaScript.'],
  ['حلقه|لوب|\\bloops?\\b|\\bfor\\b|\\bwhile\\b', 'الحلقة تكرر أمراً عدة مرات، مثل for i in range(5) في Python أو for (let i = 0; i < 5; i++) في JavaScript.', 'A loop repeats code, e.g. for i in range(5) in Python or for (let i = 0; i < 5; i++) in JavaScript.'],
  ['داله|دوال|\\bfunctions?\\b|\\bdef\\b|fonction', 'الدالة مجموعة أوامر لها اسم تستدعيها وقت الحاجة، وقد تأخذ مدخلات وترجع قيمة.', 'A function is a named group of statements you call when needed; it can take inputs and return a value.'],
  ['شرط|\\bif\\b|condition', 'الشرط if ينفّذ أمراً فقط إذا تحقق شرط معين، ويمكن إضافة else لحالة عدم التحقق.', 'An if statement runs code only when a condition is true; add else for the other case.'],
  ['html|وسم|\\btags?\\b', 'HTML يبني هيكل الصفحة بوسوم مثل h1 و p و a.', 'HTML builds the page structure with tags like h1, p and a.'],
  ['css|تنسيق|\\bstyle\\b', 'CSS ينسّق شكل الصفحة: الألوان والأحجام والمسافات والتخطيط.', 'CSS styles the page: colors, sizes, spacing and layout.'],
  ['مرحبا|اهلا|السلام|هلا|\\bhello\\b|\\bhi\\b|\\bhey\\b|bonjour|salut|hola', 'أهلاً بك في كود لاب! اسألني عن المنصة أو البرمجة.', 'Welcome to CodeLab! Ask me about the platform or programming.'],
];
const FAQ = FAQ0.map(([p, a, e]) => [new RegExp(norm(p), 'i'), a, e]);
const localAnswer = (q) => {
  const en = (q.match(/[a-z]/gi) || []).length > (q.match(/[\u0600-\u06FF]/g) || []).length, f = FAQ.find(([re]) => re.test(norm(q)));
  return f ? (en ? f[2] : f[1]) : en ? 'I am the built-in assistant. I can answer questions about the platform (levels, editor, install) and programming basics (variables, loops, conditions, functions). Gemini handles the rest when it is available.' : 'أنا المساعد الداخلي. أجيب عن استخدام المنصة (المستويات، المحرر، التثبيت) وأساسيات البرمجة (متغيرات، حلقات، شروط، دوال). الأسئلة الأوسع تجيب عنها Gemini عندما يكون متاحاً.';
};

/* ===== Level generator: 100 progressive levels per language, answers computed by code ===== */
const MK = {
html: `a|ينشئ رابطاً|<a href="#">رابط</a>
h1|هو أكبر عنوان|<h1>عنوان</h1>
p|يكتب فقرة نصية|<p>نص</p>
img|يعرض صورة|<img src="a.png" alt="x">
br|ينزل لسطر جديد|<br>
ul|ينشئ قائمة نقطية|<ul><li>1</li></ul>
ol|ينشئ قائمة مرقمة|<ol><li>1</li></ol>
div|يجمع عناصر في حاوية|<div class="box">..</div>
span|يلف جزءاً من النص|<span>نص</span>
button|ينشئ زراً|<button>اضغط</button>
input|ينشئ حقل إدخال|<input type="text">
form|ينشئ نموذجاً لإرسال البيانات|<form action="/go"></form>
table|ينشئ جدولاً|<table><tr><td>1</td></tr></table>
strong|يجعل النص عريضاً ومهماً|<strong>مهم</strong>
em|يجعل النص مائلاً|<em>نص</em>
hr|يرسم خطاً أفقياً|<hr>
label|يربط نصاً بحقل إدخال|<label for="n">الاسم</label>
textarea|ينشئ مربع نص كبير|<textarea rows="3"></textarea>
select|ينشئ قائمة منسدلة|<select><option>1</option></select>
video|يعرض فيديو|<video src="v.mp4" controls></video>
audio|يشغل صوتاً|<audio src="a.mp3" controls></audio>
header|يمثل رأس الصفحة|<header>..</header>
nav|يحتوي روابط التنقل|<nav><a href="#">1</a></nav>
main|يحتوي المحتوى الرئيسي|<main>..</main>
section|يقسم الصفحة إلى أقسام|<section>..</section>
article|يمثل مقالاً مستقلاً|<article>..</article>
footer|يمثل ذيل الصفحة|<footer>..</footer>
canvas|يرسم رسوماً بالجافاسكريبت|<canvas id="c"></canvas>
iframe|يضمّن صفحة داخل صفحة|<iframe src="p.html"></iframe>
script|يضيف كود جافاسكريبت|<script src="a.js"></script>
link|يربط ملف CSS|<link rel="stylesheet" href="s.css">
meta|يحدد بيانات الصفحة مثل الترميز|<meta charset="utf-8">
title|يحدد عنوان التبويب|<title>موقعي</title>
details|ينشئ محتوى قابلاً للطي|<details><summary>أكثر</summary></details>`,
css: `color|يغير لون النص|color: red;
background|يغير خلفية العنصر|background: #222;
font-size|يحدد حجم الخط|font-size: 18px;
margin|يضبط المسافة الخارجية|margin: 10px;
padding|يضبط المسافة الداخلية|padding: 10px;
border|يضيف إطاراً|border: 1px solid red;
border-radius|يدوّر الحواف|border-radius: 12px;
width|يحدد العرض|width: 200px;
height|يحدد الارتفاع|height: 100px;
display|يغير طريقة عرض العنصر|display: flex;
justify-content|يوزع عناصر flex أفقياً|justify-content: center;
align-items|يحاذي عناصر flex عمودياً|align-items: center;
flex-direction|يغير اتجاه flex|flex-direction: column;
gap|يضع مسافة بين عناصر flex أو grid|gap: 8px;
grid-template-columns|يحدد أعمدة الشبكة|grid-template-columns: 1fr 1fr;
position|يحدد نوع التموضع|position: absolute;
top|يزيح العنصر من الأعلى|top: 10px;
z-index|يرتب العناصر فوق بعضها|z-index: 5;
opacity|يتحكم في الشفافية|opacity: 0.5;
box-shadow|يضيف ظلاً للعنصر|box-shadow: 0 4px 8px #000;
text-align|يحاذي النص|text-align: center;
font-weight|يجعل الخط عريضاً|font-weight: bold;
line-height|يحدد تباعد الأسطر|line-height: 1.6;
overflow|يتحكم في المحتوى الزائد|overflow: hidden;
cursor|يغير شكل المؤشر|cursor: pointer;
transition|يجعل التغيير سلساً|transition: all 0.3s;
transform|يدوّر أو يكبّر العنصر|transform: rotate(45deg);
animation|يشغل حركة معرّفة بـ keyframes|animation: spin 2s infinite;
@media|يطبق أنماطاً حسب حجم الشاشة|@media (max-width: 600px) { }
:hover|يطبق نمطاً عند مرور المؤشر|a:hover { color: red; }
::before|يضيف محتوى قبل العنصر|p::before { content: "★"; }
var(--x)|يستخدم متغير CSS|color: var(--main);
backdrop-filter|يضبب ما خلف العنصر|backdrop-filter: blur(8px);
object-fit|يحدد كيفية ملء الصورة لإطارها|object-fit: cover;`,
};
const rnd = (n, k) => { const x = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const pk = (n, k, lo, hi) => lo + Math.floor(rnd(n, k) * (hi - lo + 1));
function genLevel(lang, n) {
  let q, ans, opts, spec;
  if (lang === 'html' || lang === 'css') {
    const E = MK[lang].split('\n').map((l) => l.split('|')), i = Math.min(33, Math.floor((n - 1) / 3)), f = (n - 1) % 3, e = E[i];
    const o1 = E[(i + 11) % 34], o2 = E[(i + 23) % 34], w = lang === 'html' ? 'وسم' : 'خاصية أو أمر';
    if (f === 0) { q = `أي ${w} ${e[1]}؟`; opts = [e[0], o1[0], o2[0]]; }
    else if (f === 1) { q = `ماذا يفعل ${e[0]}؟`; opts = [e[1], o1[1], o2[1]]; }
    else { q = `أي كود صحيح ${e[1]}؟`; opts = [e[2], e[2].slice(0, -1), e[2].replace(/[:"=]/, '')]; if (opts[2] === e[2]) opts[2] = e[2] + '}'; }
    ans = opts[0];
    const keys = [e[0], i > 0 && E[i - 1][0], i > 1 && E[i - 2][0]].slice(0, f + 1).filter(Boolean);
    spec = { title: e[0], lesson: `${e[0]} — ${e[1]}.\n\nمثال:\n${e[2]}`, task: lang === 'html' ? `اكتب كود HTML يستخدم الوسوم: ${keys.map((k) => `<${k}>`).join(' و ')}` : `اكتب كود CSS يستخدم: ${keys.join(' و ')}`, starter: lang === 'html' ? '<!-- اكتب هنا -->' : '/* اكتب هنا */', need: keys, solution: [e[2], i > 0 && E[i - 1][2], i > 1 && E[i - 2][2]].slice(0, f + 1).filter(Boolean).join('\n') };
  } else {
    const J = lang === 'js', P = lang === 'python';
    const D = (a, v) => (P ? `${a} = ${v}` : J ? `let ${a} = ${v};` : `int ${a} = ${v};`);
    const PR = (x) => ({ js: `console.log(${x});`, python: `print(${x})`, cpp: `cout << ${x};`, java: `System.out.println(${x});` })[lang];
    const FN = (body) => (P ? `def f(x): return ${body}` : J ? `function f(x) { return ${body}; }` : `${lang === 'java' ? 'static ' : ''}int f(int x) { return ${body}; }`);
    const TN = (c, y, no) => (P ? `${y} if ${c} else ${no}` : `${c} ? ${y} : ${no}`);
    const FOR = (v, from, to, body) => (P ? `for ${v} in range(${from}, ${to}):\n    ${body}` : `for (${J ? 'let' : 'int'} ${v} = ${from}; ${v} < ${to}; ${v}++) ${body};`);
    const CM = P ? '# اكتب هنا' : '// اكتب هنا';
    const wrap = (fn, body) => (J || P ? [...fn, ...body].join('\n') : lang === 'cpp' ? `#include <iostream>\nusing namespace std;\n${fn.join('\n')}\nint main() {\n${body.map((x) => '  ' + x).join('\n')}\n  return 0;\n}` : `public class Main {\n${fn.map((x) => '  ' + x).join('\n')}\n  public static void main(String[] args) {\n${body.map((x) => '    ' + x).join('\n')}\n  }\n}`);
    const build = (bd, { a, b, c, K, M, m, z }) => {
      let L, v, T, fn = [], body = [CM];
      if (bd === 0) { L = [D('a', a), D('b', b), PR('a + b')]; v = a + b; T = `عرّف a = ${a} و b = ${b} ثم اطبع ناتج جمعهما.`; }
      else if (bd === 1) { L = [D('a', a), D('b', b), D('c', c), PR('a * b - c')]; v = a * b - c; T = `عرّف a = ${a} و b = ${b} و c = ${c} ثم اطبع ناتج a * b - c.`; }
      else if (bd === 2) { L = [D('a', a), D('b', b), D('c', c), PR('(a + b) * c - a')]; v = (a + b) * c - a; T = `عرّف a = ${a} و b = ${b} و c = ${c} ثم اطبع ناتج (a + b) * c - a.`; }
      else if (bd === 3) { L = [D('s', 0), FOR('i', 1, K + 1, 's += i'), PR('s')]; v = (K * (K + 1)) / 2; T = `اكتب حلقة تجمع الأعداد من 1 إلى ${K} داخل المتغير s ثم اطبع s.`; body = [D('s', 0), CM]; }
      else if (bd === 4) { L = [D('s', 0), FOR('i', 1, K + 1, P ? `if i % ${m} == 0: s += i` : `if (i % ${m} == 0) s += i`), PR('s')]; v = 0; for (let i = 1; i <= K; i++) if (i % m === 0) v += i; T = `اكتب حلقة من 1 إلى ${K} تجمع في s الأعداد التي تقبل القسمة على ${m} فقط، ثم اطبع s.`; body = [D('s', 0), CM]; }
      else if (bd === 5) { L = [FN(`x * ${a} + ${b}`), PR(`f(${c})`)]; v = c * a + b; T = `الدالة f جاهزة وتحسب x * ${a} + ${b}. استدعِ f(${c}) واطبع النتيجة.`; fn = [L[0]]; }
      else if (bd === 6) { L = [D('a', a), D('b', b), PR(P ? 'a // b + a % b' : J ? 'Math.floor(a / b) + a % b' : 'a / b + a % b')]; v = Math.floor(a / b) + (a % b); T = `عرّف a = ${a} و b = ${b} ثم اطبع (ناتج القسمة الصحيحة a على b) + (باقي القسمة).`; }
      else if (bd === 7) { L = [D('c', 0), FOR('i', 0, K, P ? `for j in range(0, ${M}):\n        if (i + j) % 2 == 0: c += 1` : `for (${J ? 'let' : 'int'} j = 0; j < ${M}; j++) if ((i + j) % 2 == 0) c++`), PR('c')]; v = 0; for (let i = 0; i < K; i++) for (let j = 0; j < M; j++) if ((i + j) % 2 === 0) v++; T = `اكتب حلقتين متداخلتين: i من 0 إلى ${K - 1} و j من 0 إلى ${M - 1}، وزِد العداد c كلما كان i + j زوجياً، ثم اطبع c.`; body = [D('c', 0), CM]; }
      else if (bd === 8) { L = [FN(TN('x <= 1', '1', 'x * f(x - 1)')), PR(`f(${K}) + ${z}`)]; let fa = 1; for (let i = 2; i <= K; i++) fa *= i; v = fa + z; T = `الدالة f تحسب المضروب (factorial). اطبع f(${K}) + ${z}.`; fn = [L[0]]; }
      else { L = [FN(TN('x < 2', 'x', 'f(x - 1) + f(x - 2)')), PR(`f(${K})`)]; let x = 0, y = 1; for (let i = 0; i < K; i++) [x, y] = [y, x + y]; v = x; T = `الدالة f تحسب متتالية فيبوناتشي. اطبع f(${K}).`; fn = [L[0]]; }
      return { L, v, T, fn, body };
    };
    const bd = Math.floor((n - 1) / 10), t = (n - 1) % 10;
    const p = { a: bd === 6 ? 20 + t * 6 + pk(n, 1, 0, 5) : 2 + t * 3 + pk(n, 1, 0, 2), b: bd === 6 ? pk(n, 2, 3, 9) : pk(n, 2, 2, 5 + t), c: pk(n, 3, 2, 4 + t), K: bd === 3 ? 3 + t * 2 + pk(n, 4, 0, 1) : bd === 4 ? 6 + t * 2 + pk(n, 4, 0, 1) : bd === 7 ? 3 + t : bd === 8 ? pk(n, 4, 3, 7) : 6 + t, M: pk(n, 5, 3, 7), m: pk(n, 6, 2, 3), z: 1 + t };
    const r = build(bd, p), ex = build(bd, { a: 3, b: 2, c: 4, K: 4, M: 3, m: 2, z: 1 });
    ans = r.v; q = `ما ناتج هذا الكود؟\n${r.L.join('\n')}`; opts = [ans, ans + 1 + (n % 3), ans - 2 - (n % 2)];
    spec = { title: TT[bd], lesson: `${LES[bd]}\n\nالطباعة في ${LANGS[lang]}: ${PR('x')}\n\nمثال:\n${ex.L.join('\n')}\n← الناتج: ${ex.v}`, task: r.T, starter: wrap(r.fn, r.body), solution: wrap(r.fn, r.L.filter((x) => !r.fn.includes(x))), expect: String(r.v) };
  }
  const k = Math.floor(rnd(n, 9) * 3), r = opts.map((_, j) => String(opts[(j + k) % 3]));
  return [q, r, r.indexOf(String(ans)), spec];
}
const PHOTO = 'data:image/jpeg;base64,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';
const DEV = { name: 'محمود مدحت', phone: '01040630335', wa: 'https://wa.me/201040630335', bio: 'مطور برمجيات شغوف بتعليم البرمجة بطريقة ممتعة ومبسطة للجميع.', tech: ['React', 'Next.js', 'Python', 'C++', 'Java', 'Tailwind', 'Node.js', 'Git'] };

/* ===== Helpers ===== */
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
function usePersist(key, init) {
  const [v, setV] = useState(init);
  const ready = useRef(false);
  useEffect(() => { try { const s = localStorage.getItem(key); if (s) setV(JSON.parse(s)); } catch {} ready.current = true; }, [key]);
  useEffect(() => { if (ready.current) try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV];
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function highlight(code, lang) {
  let t = esc(code);
  if (lang === 'html') return t.replace(/(&lt;\/?[\w-]+)|(\s[\w-]+=)|("[^"]*")|(&gt;)/g, (m, a, b, c, d) => a || d ? `<i class="t1">${m}</i>` : b ? `<i class="t2">${m}</i>` : `<i class="t3">${m}</i>`);
  if (lang === 'css') return t.replace(/([\w-]+)(\s*:)|([.#][\w-]+)|(\d+[a-z%]*)/g, (m, p, c, s, n) => p ? `<i class="t2">${p}</i>${c}` : s ? `<i class="t1">${m}</i>` : `<i class="t4">${m}</i>`);
  const cm = lang === 'python' ? '#.*' : '\\/\\/.*';
  return t.replace(new RegExp(`(${cm})|("(?:[^"\\\\]|\\\\.)*"|'[^']*')|(\\b\\d+\\b)`, 'g'), (m, c, s, n) => c ? `<i class="t5">${m}</i>` : s ? `<i class="t3">${m}</i>` : `<i class="t4">${m}</i>`).replace(/(<i class="t\d">.*?<\/i>)|\b(function|const|let|var|return|if|else|for|while|class|import|def|print|int|void|public|static|new|include|true|false|null|None|and|or|not|in|try|catch)\b/g, (m, k, w) => k ? k : `<i class="t1">${w}</i>`);
}
/* ===== On-device diagnostics (no network): finds errors and explains them in Arabic ===== */
function diagnose(code, lang) {
  const d = [], add = (line, why, fix) => d.push({ line, why, fix });
  const lines = code.split('\n');
  if (lang === 'html') {
    const V = 'area base br col embed hr img input link meta source track wbr'.split(' '), st = [], re = /<(\/?)([a-zA-Z][\w-]*)[^>]*?>/g, ln = (i) => code.slice(0, i).split('\n').length;
    let m;
    while ((m = re.exec(code))) {
      const t = m[2].toLowerCase(); if (V.includes(t) || m[0].endsWith('/>')) continue;
      if (!m[1]) st.push([t, ln(m.index)]);
      else { const p = st.pop(); if (!p || p[0] !== t) { add(ln(m.index), `الوسم </${t}> لا يطابق ${p ? '<' + p[0] + '>' : 'أي وسم مفتوح'}`, 'أغلق الوسوم بنفس ترتيب فتحها'); if (p) st.push(p); } }
    }
    st.forEach(([t, l]) => add(l, `الوسم <${t}> لم يُغلق`, `أضف </${t}> في المكان المناسب`));
    return d;
  }
  const st = [], pr = { ')': '(', ']': '[', '}': '{' }, nz = lines.map((l, i) => [l, i]).filter(([l]) => l.trim());
  lines.forEach((ln, i) => {
    let s = ln.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, 'S');
    if (lang === 'python') s = s.replace(/#.*/, ''); else if (lang !== 'css') s = s.replace(/\/\/.*/, '');
    if (/["'`]/.test(s)) add(i + 1, 'نص (string) لم تُغلق علامة التنصيص الخاصة به', 'أغلق النص بنفس علامة التنصيص التي بدأ بها');
    for (const ch of s) { if ('([{'.includes(ch)) st.push([ch, i + 1]); else if (pr[ch]) { const p = st.pop(); if (!p || p[0] !== pr[ch]) add(i + 1, `القوس '${ch}' لا يطابق قوس فتح`, 'راجع أزواج الأقواس ( ) [ ] { }'); } }
    const tr = s.trim(), nx = (nz.find(([, j]) => j > i) || [''])[0].trim(), pv = [...nz].reverse().find(([, j]) => j < i);
    if (lang === 'python') {
      if (/^(def|if|elif|else|for|while|class|try|except|with)\b/.test(tr) && !tr.endsWith(':')) add(i + 1, 'ينقص النقطتان : في نهاية السطر', `اكتب ${tr}:`);
      if (/^print\s+[\w"']/.test(tr)) add(i + 1, 'دالة print تحتاج أقواساً', 'اكتب print( ... )');
      if (/^(if|while|elif)\b[^=]*[^=!<>]=[^=]/.test(tr)) add(i + 1, 'استخدمت = (إسناد) بدل == (مقارنة)', 'استبدل = بـ ==');
      if (pv && tr && pv[0].trim().endsWith(':') && ln.match(/^\s*/)[0].length <= pv[0].match(/^\s*/)[0].length) add(i + 1, 'السطر بعد النقطتين يجب أن يكون مُزاحاً للداخل', 'أضف مسافتين أو أربع في بداية السطر');
    } else if (lang === 'css') {
      if (/^[\w-]+\s*:\s*[^;{}]+$/.test(tr)) add(i + 1, 'ينقص ; في نهاية الخاصية', 'أضف ; في نهاية السطر');
      if (/^[\w-]+\s+[^:{};]+;$/.test(tr)) add(i + 1, 'ينقص النقطتان : بين اسم الخاصية وقيمتها', 'اكتب الخاصية: القيمة;');
    } else {
      if (/^(if|while)\s*\([^=!<>]*[^=!<>]=[^=][^)]*\)/.test(tr)) add(i + 1, 'استخدمت = (إسناد) داخل الشرط بدل == (مقارنة)', 'استبدل = بـ ==');
      if (lang !== 'js' && tr && !/[;{}(,:+\-*/&|=?]$/.test(tr) && !/^(#|\/\*|\*|if\b|for\b|while\b|else\b|\)|public|private|protected|class|using|import|package)/.test(tr) && !nx.startsWith('{')) add(i + 1, 'ينقص ; في نهاية السطر', 'أضف ; في نهاية الجملة');
      if (lang === 'java' && /\bstring\s+\w+/.test(tr)) add(i + 1, 'اسم النوع string يجب أن يكون String بحرف كبير', 'اكتب String');
      if (lang === 'java' && /\bsystem\.out/.test(tr)) add(i + 1, 'اسم System يجب أن يبدأ بحرف كبير', 'اكتب System.out.println');
    }
  });
  st.forEach(([c, l]) => add(l, `القوس '${c}' مفتوح ولم يُغلق`, 'أضف قوس الإغلاق المناسب'));
  if (lang === 'cpp' && /\bcout\b/.test(code) && !/#include\s*<iostream>/.test(code)) add(1, 'تستخدم cout بدون تضمين المكتبة', 'أضف #include <iostream> في أول الملف');
  if (lang === 'java' && !/class\s+\w+/.test(code)) add(1, 'لا يوجد class', 'كل كود جافا يجب أن يكون داخل class');
  if (lang === 'js' && !d.length) { try { new Function(code); } catch (e) { const m = e.message; add(0, /end of input/.test(m) ? 'الكود ناقص: قوس أو } لم يُغلق' : /missing \)/.test(m) ? 'قوس ) ناقص' : /Unexpected token|Invalid or unexpected/.test(m) ? 'رمز غير متوقع (فاصلة أو قوس أو علامة تنصيص ناقصة أو زائدة)' : m, 'راجع الأسطر الأخيرة قبل الخطأ وتأكد من اكتمال الأقواس والنصوص'); } }
  return d;
}
const fmtDiag = (d) => `📍 ${d.file ? d.file + ' · ' : ''}${d.line ? 'سطر ' + d.line : 'مكان الخطأ غير محدد'}\n🔎 السبب: ${d.why}\n🛠 الحل: ${d.fix}`;
const arJs = (m) => (/NameError: name '(\w+)'/.test(m) ? `الاسم ${m.match(/NameError: name '(\w+)'/)[1]} غير معرّف: تأكد من كتابته صحيحاً أو عرّفه قبل استخدامه` : /ZeroDivisionError/.test(m) ? 'قسمة على صفر' : /IndentationError/.test(m) ? 'خطأ في الإزاحة (المسافات) داخل الكود' : /SyntaxError: /.test(m) ? 'خطأ في بناء الجملة (قوس أو نقطتان أو علامة تنصيص ناقصة)' : /TypeError: /.test(m) ? 'تعارض في الأنواع (مثلاً جمع نص مع رقم)' : /(\w+) is not defined/.test(m) ? `الاسم ${m.match(/(\w+) is not defined/)[1]} غير معرّف: تأكد من كتابته صحيحاً أو عرّفه قبل استخدامه` : /null|undefined/.test(m) ? 'تحاول استخدام عنصر غير موجود (غالباً الـ id غير مطابق لما في HTML)' : m);
/* ===== UI atoms ===== */
const glass = 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_30px_-8px_rgba(168,85,247,.45)]';
const btn = 'px-4 py-2 rounded-xl font-bold transition active:scale-95';
const grad = 'bg-gradient-to-l from-fuchsia-600 to-violet-600 hover:brightness-125 text-white';
const Modal = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
    <div className={`${glass} bg-slate-900/90 w-full max-w-md p-6 cm`} onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>
);

/* ===== Editor ===== */
function Editor({ onError, inject }) {
  const [lang, setLang] = useState('html');
  const [codes, setCodes] = usePersist('cl_codes', STARTERS);
  const [tab, setTab] = useState('html'); // web sub-tab
  const [out, setOut] = useState([]);
  const [run, setRun] = useState(0);
  const [pdoc, setPdoc] = useState('');
  const [merge, setMerge] = useState(false);
  const logs = useRef([]);
  const ta = useRef(null), pre = useRef(null), gut = useRef(null);
  const web = ['html', 'css', 'js'].includes(lang);
  const cur = web ? tab : lang;
  const code = codes[cur] ?? '';
  const set = (v) => setCodes((c) => ({ ...c, [cur]: v }));
  useEffect(() => { if (!inject) return; setLang(inject.lang); if (['html', 'css', 'js'].includes(inject.lang)) setTab(inject.lang); setCodes((c) => ({ ...c, [inject.lang]: inject.code })); }, [inject]);
  const put = useCallback((text, caret = text.length) => {
    const el = ta.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    set(code.slice(0, a) + text + code.slice(b));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + caret; });
  }, [code, cur]);
  const PAIRS = { '{': '}', '[': ']', '(': ')', '<': '>', '"': '"' };
  const onKey = (e) => {
    const el = e.target, nx = code[el.selectionStart];
    if (Object.values(PAIRS).includes(e.key) && nx === e.key) { e.preventDefault(); requestAnimationFrame(() => (el.selectionStart = el.selectionEnd = el.selectionStart + 1)); el.selectionStart++; return; }
    if (PAIRS[e.key]) { e.preventDefault(); put(e.key + PAIRS[e.key], 1); }
    if (e.key === 'Tab') { e.preventDefault(); put('  '); }
  };
  useEffect(() => {
    const h = (e) => {
      if (e.data?.cl === 'log') { logs.current.push(e.data.m); setOut(['✔ النتيجة:', ...logs.current]); }
      if (e.data?.cl === 'err') { const dg = [{ line: e.data.l, why: arJs(e.data.m), fix: 'راجع هذا السطر في تبويب JS وتأكد من الأسماء والـ id', file: 'JS' }]; setOut([`✖ ${dg[0].why} (سطر ${e.data.l})`]); onError(codes.js, 'JavaScript', dg); }
    };
    window.addEventListener('message', h); return () => window.removeEventListener('message', h);
  }, [codes.js, onError]);
  const CAP = `<script>(()=>{const s=(t,m)=>parent.postMessage({cl:t,m:String(m)},'*');const f=(a)=>a.map((x)=>{if(typeof x==='object'){try{return JSON.stringify(x)}catch(e){}}return String(x)}).join(' ');console.log=(...a)=>s('log',f(a));console.info=console.log;console.error=(...a)=>s('log','✖ '+f(a));console.warn=(...a)=>s('log','⚠ '+f(a));window.onerror=(m,u,l)=>{parent.postMessage({cl:'err',m,l},'*')};})()<\/script>`;
  const doRun = async () => {
    const keys = web ? (merge ? ['html', 'css', 'js'] : [cur]) : [];
    const ds = web ? keys.flatMap((k) => diagnose(codes[k], k).map((x) => ({ ...x, file: k.toUpperCase() }))) : diagnose(code, lang);
    if (web) {
      const sample = '<h1>عنوان</h1><p>فقرة نصية</p><a href="#">رابط</a> <button>زر</button><div class="box">صندوق</div>';
      const body = merge ? `<style>${codes.css}</style>${codes.html}<script>${codes.js}<\/script>` : cur === 'html' ? codes.html : cur === 'css' ? `${sample}<style>${codes.css}</style>` : `<script>${codes.js}<\/script>`;
      logs.current = []; setRun((n) => n + 1);
      setPdoc(`<html dir="rtl"><head>${CAP}</head><body>${body}</body></html>`);
    }
    if (ds.length) { setOut(ds.map((x) => `✖ ${x.file ? x.file + ' · ' : ''}${x.line ? 'سطر ' + x.line : ''}: ${x.why}`)); onError(code, LANGS[lang], ds); return; }
    if (web) { setOut([merge || cur === 'js' ? '✔ تم التشغيل — لا يوجد ناتج مطبوع (استخدم console.log لطباعة نتيجة)' : '✔ تم عرض النتيجة في المعاينة']); return; }
    setOut([lang === 'python' && !pyo ? '… جارٍ تحميل Python لأول مرة (قد يستغرق نصف دقيقة)' : '… جارٍ التشغيل']);
    const r = await runCode(lang, code);
    if (r.noRun) return setOut([r.err]);
    if (r.err) { const dg = [{ line: 0, why: arJs(r.err), fix: 'راجع منطق الكود وأسماء المتغيرات' }]; setOut([`✖ ${dg[0].why}`]); onError(code, LANGS[lang], dg); return; }
    setOut(['✔ النتيجة:', ...(r.out || '(لا يوجد ناتج مطبوع)').trimEnd().split('\n'), ...(r.internal ? ['ℹ️ نُفّذ بمحرك Python الداخلي للمنصة'] : [])]);
  };
  const openTab = () => {
    if (!pdoc) return alert('اضغط ▶ تشغيل أولاً ثم افتح النتيجة في المتصفح.');
    if (!merge && cur === 'js') return alert('JavaScript وحده بلا واجهة. فعّل 🔗 دمج النتائج لفتحه مع HTML وCSS.');
    window.open(URL.createObjectURL(new Blob([pdoc.replace(CAP, '')], { type: 'text/html' })), '_blank');
  };
  const srcDoc = pdoc;
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-3 gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        {Object.entries(LANGS).map(([k, v]) => <button key={k} onClick={() => { setLang(k); if (['html', 'css', 'js'].includes(k)) setTab(k); }} className={`${btn} text-sm ${lang === k || (web && k === tab && false) ? grad : 'bg-white/5 text-slate-300'}`}>{v}</button>)}
        <button onClick={doRun} className={`${btn} bg-emerald-500 text-black mr-auto`}>▶ تشغيل</button>
      </div>
      {web && <div className="flex gap-2">{['html', 'css', 'js'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded-lg text-sm ${tab === t ? 'bg-amber-400 text-black font-bold' : 'bg-white/5 text-slate-300'}`}>{t.toUpperCase()}</button>)}<button onClick={() => setMerge(!merge)} className={`px-3 py-1 rounded-lg text-sm mr-auto ${merge ? 'bg-emerald-500 text-black font-bold' : 'bg-white/10'}`}>🔗 دمج النتائج{merge ? ' ✔' : ''}</button><button onClick={openTab} className="px-3 py-1 rounded-lg text-sm bg-white/10">↗ فتح في المتصفح</button></div>}
      <div className={`flex-1 grid gap-3 min-h-0 ${web ? 'md:grid-cols-2' : ''}`}>
        <div className={`${glass} relative overflow-hidden min-h-[220px]`} dir="ltr">
          <div ref={gut} aria-hidden className="ed absolute left-0 top-0 bottom-0 overflow-hidden text-right select-none" style={{ width: 44, color: '#64748b', paddingLeft: 4, paddingRight: 8 }}>{code.split('\n').map((_, i) => i + 1).join('\n')}</div>
          <pre ref={pre} aria-hidden style={{ paddingLeft: 52 }} className="ed absolute inset-0 m-0 overflow-hidden" dangerouslySetInnerHTML={{ __html: highlight(code, cur) + '\n' }} />
          <textarea ref={ta} value={code} spellCheck={false} onChange={(e) => set(e.target.value)} onKeyDown={onKey}
            onScroll={(e) => { pre.current.scrollTop = e.target.scrollTop; pre.current.scrollLeft = e.target.scrollLeft; gut.current.scrollTop = e.target.scrollTop; }}
            style={{ paddingLeft: 52 }} className="ed absolute inset-0 w-full h-full bg-transparent text-transparent caret-amber-300 resize-none outline-none" />
        </div>
        {web ? <iframe key={run} sandbox="allow-scripts allow-modals" srcDoc={srcDoc} className="w-full h-full min-h-[220px] rounded-2xl bg-white" title="preview" /> : null}
      </div>
      <div className={`${glass} p-3 h-28 overflow-auto text-sm font-mono text-emerald-300`} dir="ltr">{out.length ? out.map((l, i) => <div key={i} className={l.startsWith('✖') ? 'text-rose-400' : ''}>{l}</div>) : <span className="text-slate-500">Terminal ›</span>}</div>
      <div className="flex gap-1 overflow-x-auto md:hidden" dir="ltr">
        {['{', '}', '[', ']', '<', '>', ';', '=', '"', ':'].map((c) => <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={() => (PAIRS[c] ? put(c + PAIRS[c], 1) : put(c))} className="min-w-10 h-10 rounded-lg bg-violet-900/60 text-amber-200 font-mono text-lg">{c}</button>)}
      </div>
    </div>
  );
}

/* ===== Levels ===== */
function Levels({ user, setUser }) {
  const [lang, setLang] = useState('js');
  const [active, setActive] = useState(null);
  const done = user.progress?.[lang] || 0;
  const tier = (n) => (n <= 33 ? ['مبتدئ', 'bg-emerald-500'] : n <= 66 ? ['متوسط', 'bg-amber-400'] : ['متقدم', 'bg-fuchsia-500']);
  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap gap-2">{Object.entries(LANGS).map(([k, v]) => <button key={k} onClick={() => setLang(k)} className={`${btn} text-sm ${lang === k ? grad : 'bg-white/5 text-slate-300'}`}>{v}</button>)}</div>
      <p className="text-slate-300">تقدمك: <b className="text-amber-300">{done}</b> / 100</p>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
          const open = n <= done + 1, ok = n <= done, [tn, tc] = tier(n);
          return <button key={n} disabled={!open} onClick={() => setActive(n)} title={tn}
            className={`relative aspect-square rounded-xl grid place-items-center font-bold border ${ok ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : open ? 'border-fuchsia-400 text-white pulse' : 'bg-white/5 border-white/10 text-slate-600'}`}>
            {open ? n : '🔒'}<span className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full ${tc}`} /></button>;
        })}
      </div>
      <div className="flex gap-4 text-xs text-slate-400"><span>🟢 مبتدئ 1–33</span><span>🟡 متوسط 34–66</span><span>🟣 متقدم 67–100</span></div>
      {active && <LevelPlay key={lang + active} lang={lang} n={active} q={genLevel(lang, active)} spec={genLevel(lang, active)[3]} tier={tier(active)} onClose={() => setActive(null)}
        onDone={() => { setUser((u) => ({ ...u, progress: { ...u.progress, [lang]: Math.max(u.progress?.[lang] || 0, active) } })); setActive(null); }} />}
    </div>
  );
}

/* ===== Profile with 3D tilt cards ===== */
function Tilt({ children }) {
  const [s, setS] = useState('');
  return <div onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setS(`perspective(600px) rotateY(${((e.clientX - r.left) / r.width - 0.5) * 24}deg) rotateX(${-((e.clientY - r.top) / r.height - 0.5) * 24}deg) scale(1.06)`); }} onMouseLeave={() => setS('')} style={{ transform: s, transition: 'transform .15s' }} className={`${glass} p-4 text-center font-bold text-amber-200`}>{children}</div>;
}
function Profile() {
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6 text-center">
      <div className="w-36 h-36 mx-auto rounded-full p-1 bg-gradient-to-tr from-fuchsia-500 via-amber-400 to-emerald-400">
        <img src={PHOTO} alt={DEV.name} className="w-full h-full rounded-full object-cover" /></div>
      <h1 className="text-3xl font-black">{DEV.name}</h1>
      <p className="text-slate-300 max-w-xl mx-auto leading-8">{DEV.bio}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{DEV.tech.map((t) => <Tilt key={t}>{t}</Tilt>)}</div>
      <a href={DEV.wa} target="_blank" rel="noopener noreferrer" className={`${btn} inline-flex items-center gap-2 bg-emerald-500 text-black`}>💬 واتساب · <span dir="ltr">{DEV.phone}</span></a>
    </div>
  );
}

function CodeBox({ value, onChange, lang }) {
  const pre = useRef(null), gut = useRef(null);
  return (
    <div className={`${glass} relative overflow-hidden h-64`} dir="ltr">
      <div ref={gut} aria-hidden className="ed absolute left-0 top-0 bottom-0 overflow-hidden text-right select-none" style={{ width: 44, color: '#64748b', paddingLeft: 4, paddingRight: 8 }}>{value.split('\n').map((_, i) => i + 1).join('\n')}</div>
          <pre ref={pre} aria-hidden style={{ paddingLeft: 52 }} className="ed absolute inset-0 m-0 overflow-hidden" dangerouslySetInnerHTML={{ __html: highlight(value, lang) + '\n' }} />
      <textarea value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)} onScroll={(e) => { pre.current.scrollTop = e.target.scrollTop; pre.current.scrollLeft = e.target.scrollLeft; gut.current.scrollTop = e.target.scrollTop; }}
        onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); const el = e.target, st = el.selectionStart; onChange(value.slice(0, st) + '  ' + value.slice(el.selectionEnd)); requestAnimationFrame(() => (el.selectionStart = el.selectionEnd = st + 2)); } }}
        style={{ paddingLeft: 52 }} className="ed absolute inset-0 w-full h-full bg-transparent text-transparent caret-amber-300 resize-none outline-none" />
    </div>
  );
}

// One level = lesson -> coding exercise in the language editor -> quick quiz
function LevelPlay({ lang, n, q: quiz, spec, tier, onClose, onDone }) {
  const [step, setStep] = useState(0), [code, setCode] = useState(spec.starter), [out, setOut] = useState(''), [ok, setOk] = useState(false), [pick, setPick] = useState(null), [pdoc, setPdoc] = useState('');
  const web = lang === 'html' || lang === 'css';
  const [txt, ...rest] = spec.lesson.split('\n\nمثال:\n'), ex = rest.join('');
  const run = async () => {
    setOk(false); setOut('… جارٍ التشغيل');
    const ds = diagnose(code, lang);
    if (ds.length) return setOut(ds.map(fmtDiag).join('\n\n'));
    if (web) {
      setPdoc(lang === 'html' ? code : `<style>${code}</style><h1>عنوان</h1><p>فقرة</p><a href="#">رابط</a><button>زر</button><div class="box">صندوق</div>`);
      const dom = new DOMParser().parseFromString(code, 'text/html');
      const miss = spec.need.filter((k) => (lang === 'html' ? !dom.querySelector(k) : !(/^[a-z-]+$/.test(k) ? new RegExp('(^|[\\s;{])' + k + '\\s*:').test(code) : code.includes(k === 'var(--x)' ? 'var(--' : k))));
      if (miss.length) return setOut('ينقص استخدام: ' + miss.join('، '));
      setOk(true); return setOut('✔ ممتاز! التمرين صحيح.');
    }
    const r = await runCode(lang, code);
    if (r.noRun) return setOut(r.err);
    if (r.err) return setOut('📍 خطأ أثناء التشغيل\n🔎 السبب: ' + arJs(r.err) + '\n🛠 الحل: راجع منطق الكود وأسماء المتغيرات');
    const got = (r.out || '').trim();
    if (got === spec.expect) { setOk(true); setOut(`✔ ممتاز! الناتج ${got} صحيح.`); } else setOut(`الناتج الحالي: ${got || '(لا شيء مطبوع)'}\nالمطلوب: ${spec.expect}\nراجع الكود وحاول مجدداً.`);
  };
  const [qq, opts, right] = quiz;
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 overflow-auto p-4"><div className="max-w-2xl mx-auto space-y-3">
      <div className="flex justify-between items-center"><span className={`text-xs px-2 py-1 rounded-full text-black ${tier[1]}`}>مستوى {n} · {tier[0]} · {LANGS[lang]}</span><button onClick={onClose} className={`${btn} bg-white/10`}>✕</button></div>
      <h2 className="text-2xl font-black text-amber-300">{spec.title}</h2>
      <div className="flex gap-2 text-xs">{['١ الشرح', '٢ التطبيق', '٣ الاختبار'].map((x, i) => <span key={x} className={`px-2 py-1 rounded-full ${step === i ? 'bg-fuchsia-600 text-white' : 'bg-white/10'}`}>{x}</span>)}</div>
      {step === 0 && <>
        <div className={`${glass} p-4 leading-8 whitespace-pre-wrap`}>{txt}</div>
        {ex && <pre dir="ltr" className="bg-black/40 rounded-xl p-3 text-sm text-emerald-300 overflow-auto font-mono">{ex}</pre>}
        <button onClick={() => setStep(1)} className={`${btn} ${grad} w-full`}>ابدأ التمرين ←</button></>}
      {step === 1 && <>
        <div className={`${glass} p-3 whitespace-pre-wrap`}>🎯 {spec.task}</div>
        <CodeBox value={code} onChange={setCode} lang={lang} />
        <div className="flex gap-2"><button onClick={run} className={`${btn} bg-emerald-500 text-black flex-1`}>▶ تشغيل وفحص</button><button onClick={() => setCode(spec.solution)} className={`${btn} bg-white/10`}>💡 الحل</button></div>
        {out && <pre className={`${glass} p-3 text-sm whitespace-pre-wrap ${ok ? 'text-emerald-300' : 'text-amber-200'}`}>{out}</pre>}
        {web && pdoc && <iframe sandbox="allow-scripts" srcDoc={pdoc} className="w-full h-48 rounded-2xl bg-white" title="preview" />}
        {ok && <button onClick={() => setStep(2)} className={`${btn} ${grad} w-full`}>التالي: الاختبار السريع ←</button>}</>}
      {step === 2 && <>
        <h3 className="text-lg font-bold">{qq.split('\n')[0]}</h3>
        {qq.includes('\n') && <pre dir="ltr" className="bg-black/40 rounded-xl p-3 text-sm text-emerald-300 overflow-auto font-mono">{qq.split('\n').slice(1).join('\n')}</pre>}
        <div className="space-y-2">{opts.map((t, i) => <button key={i} dir="auto" onClick={() => { setPick(i); if (i === right) setTimeout(onDone, 700); else setTimeout(() => setPick(null), 900); }} className={`w-full p-3 rounded-xl border text-start font-mono ${pick === i ? (i === right ? 'bg-emerald-500/30 border-emerald-400' : 'bg-rose-500/30 border-rose-400') : 'bg-white/5 border-white/10'}`}>{t}</button>)}</div></>}
    </div></div>
  );
}

const LMAP = { html: 'html', css: 'css', js: 'js', javascript: 'js', python: 'python', py: 'python', cpp: 'cpp', 'c++': 'cpp', java: 'java' };
const b64 = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f); });
const shrink = (f, max = 1280) => new Promise((res) => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.8).split(',')[1]); }; img.src = URL.createObjectURL(f); });
function Reply({ text, onUse }) {
  const parts = text.split(/```(\w+)?\n?([\s\S]*?)```/g), nodes = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]) nodes.push(<div key={i} className="whitespace-pre-wrap">{parts[i]}</div>);
    if (i + 2 < parts.length) {
      const lg = LMAP[(parts[i + 1] || '').toLowerCase()], cd = parts[i + 2].replace(/\n$/, '');
      nodes.push(<div key={i + 1} className="my-2 rounded-xl bg-black/50 overflow-hidden" dir="ltr"><pre className="p-2 text-xs text-emerald-300 overflow-auto font-mono">{cd}</pre><div className="flex gap-2 p-1 bg-white/5"><button onClick={() => navigator.clipboard?.writeText(cd)} className="text-xs px-2 py-1 rounded bg-white/10">نسخ</button>{lg && <button onClick={() => onUse(lg, cd)} className="text-xs px-2 py-1 rounded bg-emerald-500 text-black">▶ جرّبه في المحرر</button>}</div></div>);
    }
  }
  return <>{nodes}</>;
}
function Chat({ ai, setAi, onUse }) {
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState([]), [t, setT] = useState(''), [busy, setBusy] = useState(false), [file, setFile] = useState(null);
  const live = ai.on && !ai.quota;
  const pick = async (f) => {
    if (!f) return;
    if (f.type.startsWith('image/')) setFile({ name: f.name, mime: 'image/jpeg', data: await shrink(f) });
    else if (f.type === 'application/pdf') { if (f.size > 2.5e6) return alert('الملف أكبر من 2.5 ميجا'); setFile({ name: f.name, mime: 'application/pdf', data: await b64(f) }); }
    else setFile({ name: f.name, text: (await f.text()).slice(0, 20000) });
  };
  const send = async () => {
    if ((!t.trim() && !file) || busy) return;
    const shown = t + (file ? `\n📎 ${file.name}` : ''), h = [...msgs, { role: 'user', text: shown }];
    setMsgs(h); setT(''); setBusy(true);
    const prompt = t + (file?.text ? `\n\n[الملف ${file.name}]\n${file.text}` : ''), parts = file?.data ? [{ mime: file.mime, data: file.data }] : [];
    setFile(null);
    const r = live ? await askAI(prompt, msgs, parts) : null;
    if (r?.quota) setAi((a) => ({ ...a, quota: true }));
    const reply = r?.text || (r?.quota ? '⚠️ انتهى الحد المجاني لـ Gemini، سأجيب بالذكاء الداخلي (محدود).\n\n' : '') + localAnswer(t);
    setMsgs([...h, { role: 'model', text: reply }]); setBusy(false);
  };
  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label="الذكاء الاصطناعي" className="fixed right-3 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full text-2xl grid place-items-center bg-gradient-to-br from-fuchsia-600 to-violet-600 shadow-[0_0_22px_#d946efaa] active:scale-95">🤖</button>
      {open && (
        <div className={`${glass} bg-slate-900/95 fixed inset-x-3 bottom-3 top-20 sm:left-auto sm:w-[30rem] z-50 flex flex-col p-3`}>
          <div className="flex justify-between items-center mb-2"><b className="text-amber-300">{live ? '✨ Gemini' : '🧠 الذكاء الداخلي (محدود)'}</b><button onClick={() => setOpen(false)} aria-label="إغلاق" className="w-9 h-9 rounded-full bg-white/10 text-2xl leading-none">×</button></div>
          <div className="flex-1 overflow-auto space-y-2 text-sm">{msgs.length === 0 && <p className="text-slate-500">اسألني بأي لغة عن المنصة أو البرمجة، واطلب مني أكواداً{live ? '، وارفع صوراً أو ملفات' : ''}.</p>}
            {msgs.map((m, i) => <div key={i} className={`p-2 rounded-xl ${m.role === 'user' ? 'bg-violet-700/50 whitespace-pre-wrap' : 'bg-white/10'}`}>{m.role === 'user' ? m.text : <Reply text={m.text} onUse={onUse} />}</div>)}{busy && <p className="text-slate-500">...</p>}</div>
          {file && <p className="text-xs text-amber-300 mt-1">📎 {file.name} <button onClick={() => setFile(null)} className="text-rose-400">حذف</button></p>}
          <div className="flex gap-2 mt-2 items-center">
            <label className={`w-10 h-10 grid place-items-center rounded-xl bg-white/10 text-lg cursor-pointer ${live ? '' : 'opacity-40'}`} onClick={(e) => { if (!live) { e.preventDefault(); alert('رفع الصور والملفات يعمل مع Gemini فقط، وهو غير متاح الآن.'); } }}>📎<input type="file" className="hidden" accept="image/*,.pdf,.txt,.js,.py,.html,.css,.java,.cpp,.json,.md" disabled={!live} onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} /></label>
            <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="اكتب سؤالك" className="flex-1 bg-black/30 rounded-xl p-2 outline-none" /><button onClick={send} className={`${btn} bg-emerald-500 text-black`}>إرسال</button></div>
        </div>)}
    </>
  );
}

/* ===== Root ===== */
export default function CodeLab() {
  const [screen, setScreen] = useState('editor'); // currentScreen
  const [user, setUser] = usePersist('cl_user', { progress: {} });
  const [theme, setTheme] = usePersist('cl_theme', 'dark');
  const [explain, setExplain] = useState(null);
  const [ai, setAi] = useState({ on: false, quota: false });
  const [inst, setInst] = useState(null);
  const [inject, setInject] = useState(null);
  const geminiOn = ai.on && !ai.quota;
  useEffect(() => {
    api('status').then((x) => x && setAi({ on: !!x.ai, quota: !!x.quota }));
    if (location.hash === '#light' || location.hash === '#dark') setTheme(location.hash.slice(1));
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/api/ai?sw=1', { scope: '/' }).catch(() => {});
    const h = (e) => { e.preventDefault(); setInst(e); };
    window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const onError = useCallback(async (code, lang, diags) => {
    const local = diags.map(fmtDiag).join('\n\n');
    if (!geminiOn) return setExplain({ text: local, local: true });
    setExplain({ loading: true });
    const r = await askAI(`اللغة: ${lang}\nالأخطاء: ${diags.map((x) => `سطر ${x.line}: ${x.why}`).join('; ')}\nالكود:\n${code}\nاشرح بالعربية وباختصار: مكان الخطأ، سببه، وطريقة إصلاحه.`);
    if (r?.quota) setAi((a) => ({ ...a, quota: true }));
    setExplain(r?.text ? { text: r.text } : { text: local, local: true });
  }, [geminiOn]);
  const items = [['editor', 'محرر الأكواد'], ['levels', 'الـ 100 مستوى'], ['profile', 'بروفايل المطور']];
  return (
    <div dir="rtl" className={`min-h-screen text-slate-100 app ${theme === 'light' ? 'light' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&family=JetBrains+Mono&display=swap');
        .app{font-family:Tajawal,sans-serif;background:radial-gradient(900px 500px at 85% -10%,#4c1d95aa,transparent),radial-gradient(700px 400px at 0% 100%,#86198f55,transparent),#0b0816}
        .ed{font:14px/1.6 'JetBrains Mono',monospace;padding:14px;white-space:pre;tab-size:2;color:#e2e8f0}
        textarea.ed{-webkit-text-fill-color:transparent}
        .t1{color:#c084fc;font-style:normal}.t2{color:#fbbf24;font-style:normal}.t3{color:#34d399;font-style:normal}.t4{color:#f0abfc;font-style:normal}.t5{color:#64748b;font-style:normal}
        .pulse{animation:p 2s infinite}@keyframes p{50%{box-shadow:0 0 18px #d946ef}}

        .light.app{color-scheme:light;background:radial-gradient(900px 500px at 85% -10%,#ddd6fe,transparent),radial-gradient(700px 400px at 0% 100%,#fbcfe8,transparent),#f8f7ff;color:#1e1b4b}
        .light .text-slate-100,.light .text-slate-200,.light .text-slate-300{color:#1e1b4b}
        .light .text-slate-400,.light .text-slate-500,.light .text-slate-600{color:#475569}
        .light .bg-white\\/5{background:#ffffffb3}.light .bg-white\\/10{background:#ede9fe}
        .light .bg-slate-900\\/90,.light .bg-slate-900\\/95,.light .bg-slate-950\\/70,.light .bg-slate-950\\/95{background:#fffffff2}
        .light .bg-black\\/30,.light .bg-black\\/40{background:#f1f5f9}.light .bg-violet-900\\/60{background:#ddd6fe}
        .light .border-white\\/10,.light .border-white\\/5{border-color:#c4b5fd}
        .light .text-amber-300,.light .text-amber-200{color:#b45309}.light .text-emerald-300{color:#047857}
        .light button.pulse{color:#86198f}.light .ed{color:#1e293b}.light textarea.ed{color:transparent}
        .light .t1{color:#7c3aed}.light .t2{color:#b45309}.light .t3{color:#047857}.light .t4{color:#a21caf}.light .t5{color:#94a3b8}
        .light pre.text-emerald-300{color:#047857}
        @media(prefers-reduced-motion:reduce){.pulse{animation:none}}
      `}</style>
      <nav className="sticky top-0 z-30 h-16 flex items-center gap-3 px-4 bg-slate-950/70 backdrop-blur-xl border-b border-white/10 overflow-x-auto">
        <span className="font-black text-xl bg-gradient-to-l from-amber-300 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent whitespace-nowrap">كود لاب | CodeLab</span>
        <div className="flex gap-1 mr-auto">{items.map(([k, v]) => <button key={k} onClick={() => setScreen(k)} className={`px-3 py-2 rounded-xl text-sm whitespace-nowrap transition ${screen === k ? grad : 'text-slate-300 hover:bg-white/10'}`}>{v}</button>)}</div>
        <button onClick={() => { if (inst) { inst.prompt(); setInst(null); } else alert('لتثبيت التطبيق: من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».'); }} className="px-3 py-2 rounded-xl bg-emerald-500 text-black whitespace-nowrap text-sm">📲 تثبيت</button>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="px-3 py-2 rounded-xl bg-white/10 whitespace-nowrap" aria-label="تبديل الوضع">{theme === 'light' ? '🌙 داكن' : '☀️ فاتح'}</button>
        <span className="text-xs whitespace-nowrap text-slate-400">{geminiOn ? '✨ Gemini' : '🧠 ذكاء داخلي'}</span>
      </nav>
      <main>
        {screen === 'editor' && <Editor onError={onError} inject={inject} />}
        {screen === 'levels' && <Levels user={user} setUser={setUser} />}
        {screen === 'profile' && <Profile />}
      </main>
      <Chat ai={ai} setAi={setAi} onUse={(lang, code) => { setInject({ lang, code, id: Date.now() }); setScreen('editor'); }} />
      {explain && (
        <Modal onClose={() => setExplain(null)}>
          <h3 className="font-black text-amber-300 mb-2">🔍 شرح الخطأ</h3>
          <div className="whitespace-pre-wrap leading-7 text-sm max-h-80 overflow-auto">{explain.loading ? 'جارٍ التحليل...' : explain.text}</div>
          {explain.local && <p className="text-xs text-slate-500 mt-2">🧠 تحليل محلي يعمل على جهازك</p>}
          <button onClick={() => setExplain(null)} className={`${btn} ${grad} w-full mt-3`}>فهمت</button>
        </Modal>)}
    </div>
  );
}
