// On-device diagnostics, Arabic runtime error explainer, and code formatter

export function diagnose(code, lang) {
  const d = [];
  const add = (line, why, fix, severity = 'error') => d.push({ line, why, fix, severity });
  if (typeof code !== 'string' || !code.trim()) return d;

  if (lang === 'json') {
    try {
      JSON.parse(code);
    } catch (e) {
      const m = String(e.message);
      const posMatch = m.match(/position (\d+)/);
      let line = 1;
      if (posMatch) {
        line = code.slice(0, Number(posMatch[1])).split('\n').length;
      }
      add(line, `صيغة JSON غير صالحة: ${m}`, 'تأكد من الفواصل وعلامات التنصيص المزدوجة " وعدم وجود فاصلة أخيرة زائدة');
    }
    return d;
  }

  if (lang === 'html') {
    const V = 'area base br col embed hr img input link meta source track wbr !doctype'.split(' ');
    const st = [];
    const cleaned = code.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    const re = /<(\/?)([a-zA-Z!][\w-]*)[^>]*?>/g;
    const ln = (i) => cleaned.slice(0, i).split('\n').length;
    let m;
    while ((m = re.exec(cleaned))) {
      const t = m[2].toLowerCase();
      if (V.includes(t) || m[0].endsWith('/>')) continue;
      if (!m[1]) st.push([t, ln(m.index)]);
      else {
        const p = st.pop();
        if (!p || p[0] !== t) {
          add(ln(m.index), `الوسم </${t}> لا يطابق ${p ? '<' + p[0] + '>' : 'أي وسم مفتوح'}`, 'أغلق الوسوم بنفس ترتيب فتحها');
          if (p) st.push(p);
        }
      }
    }
    st.forEach(([t, l]) => add(l, `الوسم <${t}> لم يُغلق`, `أضف </${t}> في المكان المناسب`));
    return d;
  }

  if (lang === 'sql') {
    let inSingle = false;
    let parens = 0;
    const lines = code.split('\n');
    lines.forEach((ln, i) => {
      for (let idx = 0; idx < ln.length; idx++) {
        const ch = ln[idx];
        if (ch === '-' && ln[idx + 1] === '-' && !inSingle) break;
        if (ch === "'" && ln[idx - 1] !== '\\') inSingle = !inSingle;
        else if (!inSingle) {
          if (ch === '(') parens++;
          else if (ch === ')') {
            parens--;
            if (parens < 0) {
              add(i + 1, "قوس ')' لا يطابق قوس فتح", 'راجع الأقواس في الاستعلام');
              parens = 0;
            }
          }
        }
      }
    });
    if (inSingle) add(lines.length, 'نص SQL مفتوح ولم يُغلق بعلامة تنصيص مفردة', "أغلق النص بـ '");
    if (parens > 0) add(lines.length, 'يوجد قوس ( مفتوح ولم يُغلق في SQL', 'أضف ) لإغلاق القوس');
    return d;
  }

  const BRACE_LANGS = new Set(['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'python', 'c', 'cpp', 'java', 'csharp', 'kotlin', 'swift', 'go', 'rust', 'php', 'dart', 'scala']);
  if (!BRACE_LANGS.has(lang)) return d;

  const lines = code.split('\n');
  const st = [];
  const pr = { ')': '(', ']': '[', '}': '{' };
  const nz = lines.map((l, i) => [l, i]).filter(([l]) => l.trim());

  lines.forEach((ln, i) => {
    let s = ln.replace(/`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, 'S');
    if (lang === 'python') s = s.replace(/#.*/, '');
    else if (lang === 'css') s = s.replace(/\/\*[\s\S]*?\*\//g, '');
    else s = s.replace(/\/\/.*/, '');

    if (/["']/.test(s) && !['js', 'jsx', 'ts', 'tsx', 'rust', 'php'].includes(lang)) {
      add(i + 1, 'نص (string) لم تُغلق علامة التنصيص الخاصة به', 'أغلق النص بنفس علامة التنصيص التي بدأ بها');
    }
    for (const ch of s) {
      if ('([{'.includes(ch)) st.push([ch, i + 1]);
      else if (pr[ch]) {
        const p = st.pop();
        if (!p || p[0] !== pr[ch]) {
          add(i + 1, `القوس '${ch}' لا يطابق قوس فتح`, 'راجع أزواج الأقواس ( ) [ ] { }');
        }
      }
    }
    const tr = s.trim();
    const nx = (nz.find(([, j]) => j > i) || [''])[0].trim();
    const pv = [...nz].reverse().find(([, j]) => j < i);

    if (lang === 'python') {
      if (/^(def|if|elif|else|for|while|class|try|except|with)\b/.test(tr) && !tr.endsWith(':')) {
        add(i + 1, 'ينقص النقطتان : في نهاية السطر', `اكتب ${tr}:`);
      }
      if (/^print\s+[\w"']/.test(tr)) {
        add(i + 1, 'دالة print تحتاج أقواساً', 'اكتب print( ... )');
      }
      if (/^(if|while|elif)\b[^=]*[^=!<>]=[^=]/.test(tr)) {
        add(i + 1, 'استخدمت = (إسناد) بدل == (مقارنة)', 'استبدل = بـ ==');
      }
      if (pv && tr && pv[0].trim().endsWith(':') && ln.match(/^\s*/)[0].length <= pv[0].match(/^\s*/)[0].length) {
        add(i + 1, 'السطر بعد النقطتين يجب أن يكون مُزاحاً للداخل', 'أضف مسافتين أو أربع في بداية السطر');
      }
    } else if (lang === 'css') {
      if (/^[\w-]+\s*:\s*[^;{}]+$/.test(tr)) {
        add(i + 1, 'ينقص ; في نهاية الخاصية', 'أضف ; في نهاية السطر');
      }
      if (/^[\w-]+\s+[^:{};]+;$/.test(tr)) {
        add(i + 1, 'ينقص النقطتان : بين اسم الخاصية وقيمتها', 'اكتب الخاصية: القيمة;');
      }
    } else {
      if (/^(if|while)\s*\([^=!<>]*[^=!<>]=[^=][^)]*\)/.test(tr)) {
        add(i + 1, 'استخدمت = (إسناد) داخل الشرط بدل == (مقارنة)', 'استبدل = بـ ==');
      }
      if (
        (lang === 'cpp' || lang === 'java') &&
        tr &&
        !/[;{}(,:+\-*/&|=?]$/.test(tr) &&
        !/^(#|\/\*|\*|if\b|for\b|while\b|else\b|\)|public|private|protected|class|using|import|package)/.test(tr) &&
        !nx.startsWith('{')
      ) {
        add(i + 1, 'ينقص ; في نهاية السطر', 'أضف ; في نهاية الجملة');
      }
      if (lang === 'java' && /\bstring\s+\w+/.test(tr)) add(i + 1, 'اسم النوع string يجب أن يكون String بحرف كبير', 'اكتب String');
      if (lang === 'java' && /\bsystem\.out/.test(tr)) add(i + 1, 'اسم System يجب أن يبدأ بحرف كبير', 'اكتب System.out.println');
    }
  });

  st.forEach(([c, l]) => add(l, `القوس '${c}' مفتوح ولم يُغلق`, 'أضف قوس الإغلاق المناسب'));
  if (lang === 'cpp' && /\bcout\b/.test(code) && !/#include\s*<iostream>/.test(code)) {
    add(1, 'تستخدم cout بدون تضمين المكتبة', 'أضف #include <iostream> في أول الملف');
  }
  if (lang === 'java' && !/class\s+\w+/.test(code)) {
    add(1, 'لا يوجد class', 'كل كود جافا يجب أن يكون داخل class');
  }
  if (lang === 'js' && !d.length) {
    try {
      new Function(code);
    } catch (e) {
      const m = e.message;
      if (!/Cannot use import statement|Unexpected token 'export'/.test(m)) {
        add(
          1,
          /end of input/.test(m)
            ? 'الكود ناقص: قوس أو } لم يُغلق'
            : /missing \)/.test(m)
              ? 'قوس ) ناقص'
              : /Unexpected token|Invalid or unexpected/.test(m)
                ? 'رمز غير متوقع (فاصلة أو قوس أو علامة تنصيص ناقصة أو زائدة)'
                : m,
          'راجع الأسطر الأخيرة وتأكد من اكتمال الأقواس والنصوص'
        );
      }
    }
  }
  return d;
}

export const arJs = (m) => {
  const s = String(m || '');
  if (/NameError: name '(\w+)'/.test(s)) return `الاسم ${s.match(/NameError: name '(\w+)'/)[1]} غير معرّف: تأكد من كتابته صحيحاً أو عرّفه قبل استخدامه`;
  if (/ZeroDivisionError/.test(s)) return 'قسمة على صفر';
  if (/IndentationError/.test(s)) return 'خطأ في الإزاحة (المسافات) داخل الكود';
  if (/SyntaxError: /.test(s)) return 'خطأ في بناء الجملة (قوس أو نقطتان أو علامة تنصيص ناقصة)';
  if (/TypeError: /.test(s)) return 'تعارض في الأنواع (مثلاً استدعاء قيمة ليست دالة أو جمع نص مع رقم)';
  if (/(\w+) is not defined/.test(s)) return `المتغير أو الدالة ${s.match(/(\w+) is not defined/)[1]} غير معرّفة`;
  if (/null|undefined/.test(s)) return 'محاولة قراءة خاصية من قيمة فارغة (null أو undefined)';
  return s;
};

export function formatCode(code, lang, tabSize = 2) {
  const indentUnit = ' '.repeat(tabSize);
  if (lang === 'json') {
    try {
      return JSON.stringify(JSON.parse(code), null, tabSize);
    } catch {
      return code;
    }
  }
  if (lang === 'css') {
    const raw = code
      .replace(/\r/g, '')
      .replace(/\s*\{\s*/g, ' {\n')
      .replace(/\s*;\s*/g, ';\n')
      .replace(/\s*\}\s*/g, '\n}\n\n');
    let depth = 0;
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l, idx, arr) => l || (arr[idx - 1] && arr[idx - 1] !== ''))
      .map((l) => {
        if (l.startsWith('}')) depth = Math.max(0, depth - 1);
        const res = l ? indentUnit.repeat(depth) + l : '';
        if (l.endsWith('{')) depth += 1;
        return res;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  if (lang === 'sql') {
    const KEYWORDS = /\b(select|distinct|from|where|and|or|not|in|like|is|null|insert|into|values|update|set|delete|create|table|if|exists|drop|alter|add|primary|key|foreign|references|inner|left|right|join|on|group|by|having|order|asc|desc|limit|offset|as|count|sum|avg|min|max|show|tables)\b/gi;
    return code
      .replace(/\r/g, '')
      .split('\n')
      .map((line) =>
        line
          .replace(/\t/g, indentUnit)
          .replace(/\s+$/, '')
          .replace(/'[^']*'|([^']+)/g, (m, nonStr) =>
            nonStr ? nonStr.replace(KEYWORDS, (kw) => kw.toUpperCase()) : m
          )
      )
      .join('\n')
      .trimEnd();
  }
  if (['html', 'xml', 'svg'].includes(lang)) {
    const voidTags = new Set('area base br col embed hr img input link meta param source track wbr !doctype'.split(' '));
    const tokens = code.replace(/\r/g, '').replace(/>\s+</g, '>\n<').split('\n');
    let depth = 0;
    return tokens
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((line) => {
        const isClosing = /^<\//.test(line);
        if (isClosing) depth = Math.max(0, depth - 1);
        const out = indentUnit.repeat(depth) + line;
        const openMatch = line.match(/^<([a-zA-Z][\w-]*)(?:\s|>|$)/);
        if (
          openMatch &&
          !voidTags.has(openMatch[1].toLowerCase()) &&
          !line.endsWith('/>') &&
          !new RegExp(`</${openMatch[1]}>\\s*$`, 'i').test(line)
        ) {
          depth += 1;
        }
        return out;
      })
      .join('\n');
  }
  if (['js', 'jsx', 'ts', 'tsx', 'php', 'c', 'cpp', 'csharp', 'java', 'kotlin', 'swift', 'go', 'rust', 'dart', 'scala'].includes(lang)) {
    let depth = 0;
    return code
      .replace(/\r/g, '')
      .split('\n')
      .map((raw) => {
        const t = raw.trim();
        if (!t) return '';
        if (/^[}\])]/.test(t)) depth = Math.max(0, depth - 1);
        const out = indentUnit.repeat(depth) + t;
        const opens = (t.match(/\{/g) || []).length;
        const closes = (t.match(/\}/g) || []).length;
        const net = opens - closes;
        if (/^[}\])]/.test(t)) depth = Math.max(0, depth + net + 1);
        else depth = Math.max(0, depth + net);
        return out;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }
  return code
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\t/g, indentUnit).replace(/\s+$/, ''))
    .join('\n')
    .trimEnd();
}
