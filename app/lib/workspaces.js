// Comprehensive language registry (38+ languages), media detection, workspace templates, and developer metadata

export const MEDIA_EXT_TO_KIND = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  ico: 'image',
  avif: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  m4v: 'video',
  ogv: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  aac: 'audio',
  flac: 'audio',
};

export const FILE_EXT_TO_LANG = {
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'css',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'jsx',
  ts: 'ts',
  tsx: 'tsx',
  py: 'python',
  pyw: 'python',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  dart: 'dart',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  lua: 'lua',
  r: 'r',
  pl: 'perl',
  pm: 'perl',
  hs: 'haskell',
  scala: 'scala',
  erl: 'erlang',
  ex: 'erlang',
  exs: 'erlang',
  jl: 'julia',
  groovy: 'groovy',
  clj: 'clojure',
  cljs: 'clojure',
  asm: 'asm',
  s: 'asm',
  pas: 'pascal',
  f90: 'fortran',
  f: 'fortran',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  svg: 'svg',
  md: 'markdown',
  markdown: 'markdown',
  tex: 'latex',
  conf: 'nginx',
  txt: 'text',
};

export const LANG_META = {
  html: { label: 'HTML', ext: 'html', runnable: true, preview: true, color: 'text-orange-500 dark:text-orange-400', starter: '<!DOCTYPE html>\n<html lang="ar" dir="rtl">\n<head>\n  <meta charset="UTF-8" />\n  <title>صفحة جديدة</title>\n</head>\n<body>\n  <h1>مرحباً</h1>\n</body>\n</html>\n' },
  css: { label: 'CSS', ext: 'css', runnable: true, preview: true, color: 'text-sky-500 dark:text-sky-400', starter: 'body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n}\n' },
  scss: { label: 'SCSS / Sass', ext: 'scss', runnable: false, preview: false, color: 'text-pink-500 dark:text-pink-400', starter: '$primary: #0ea5e9;\n\n.card {\n  border: 1px solid $primary;\n  padding: 16px;\n}\n' },
  js: { label: 'JavaScript', ext: 'js', runnable: true, preview: false, color: 'text-amber-500 dark:text-amber-400', starter: "console.log('Hello from JavaScript!');\n" },
  jsx: { label: 'JSX / React', ext: 'jsx', runnable: true, preview: false, color: 'text-cyan-500 dark:text-cyan-400', starter: "const App = () => 'Hello JSX';\nconsole.log(App());\n" },
  ts: { label: 'TypeScript', ext: 'ts', runnable: true, preview: false, color: 'text-blue-500 dark:text-blue-400', starter: 'interface User {\n  name: string;\n  role: string;\n}\n\nconst greet = (user: User): string => `مرحباً ${user.name} (${user.role})`;\nconsole.log(greet({ name: "أحمد", role: "Developer" }));\n' },
  tsx: { label: 'TSX / TypeScript React', ext: 'tsx', runnable: true, preview: false, color: 'text-blue-500 dark:text-blue-400', starter: 'type Item = { id: number; title: string };\nconst items: Item[] = [{ id: 1, title: "CodeLab" }];\nconsole.log(items);\n' },
  python: { label: 'Python', ext: 'py', runnable: true, preview: false, color: 'text-emerald-500 dark:text-emerald-400', starter: 'def main():\n    print("Hello from Python!")\n\nif __name__ == "__main__":\n    main()\n' },
  c: { label: 'C', ext: 'c', runnable: true, preview: false, color: 'text-indigo-500 dark:text-indigo-400', starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello from C!" << endl;\n  return 0;\n}\n' },
  cpp: { label: 'C++', ext: 'cpp', runnable: true, preview: false, color: 'text-indigo-500 dark:text-indigo-400', starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello from C++!" << endl;\n  return 0;\n}\n' },
  csharp: { label: 'C#', ext: 'cs', runnable: false, preview: false, color: 'text-violet-500 dark:text-violet-400', starter: 'using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello from C#!");\n  }\n}\n' },
  java: { label: 'Java', ext: 'java', runnable: true, preview: false, color: 'text-rose-500 dark:text-rose-400', starter: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello from Java!");\n  }\n}\n' },
  kotlin: { label: 'Kotlin', ext: 'kt', runnable: false, preview: false, color: 'text-purple-500 dark:text-purple-400', starter: 'fun main() {\n  val message = "Hello from Kotlin!"\n  println(message)\n}\n' },
  swift: { label: 'Swift', ext: 'swift', runnable: false, preview: false, color: 'text-orange-500 dark:text-orange-400', starter: 'import Foundation\n\nfunc greet(name: String) -> String {\n  return "Hello, \\(name)!"\n}\nprint(greet(name: "Swift"))\n' },
  go: { label: 'Go', ext: 'go', runnable: false, preview: false, color: 'text-cyan-500 dark:text-cyan-400', starter: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Go!")\n}\n' },
  rust: { label: 'Rust', ext: 'rs', runnable: false, preview: false, color: 'text-orange-600 dark:text-orange-400', starter: 'fn main() {\n    let lang = "Rust";\n    println!("Hello from {}!", lang);\n}\n' },
  php: { label: 'PHP', ext: 'php', runnable: false, preview: false, color: 'text-indigo-400', starter: '<?php\n$name = "CodeLab";\necho "Hello from $name!\\n";\n' },
  ruby: { label: 'Ruby', ext: 'rb', runnable: false, preview: false, color: 'text-red-500 dark:text-red-400', starter: 'def greet(name)\n  "Hello, #{name}!"\nend\n\nputs greet("Ruby")\n' },
  dart: { label: 'Dart', ext: 'dart', runnable: false, preview: false, color: 'text-sky-500 dark:text-sky-400', starter: 'void main() {\n  print("Hello from Dart!");\n}\n' },
  sql: { label: 'SQL', ext: 'sql', runnable: false, preview: false, color: 'text-amber-600 dark:text-amber-400', starter: 'SELECT id, username, created_at\nFROM users\nWHERE active = 1\nORDER BY created_at DESC;\n' },
  bash: { label: 'Bash / Shell', ext: 'sh', runnable: false, preview: false, color: 'text-lime-600 dark:text-lime-400', starter: '#!/usr/bin/env bash\necho "Hello from Bash"\n' },
  powershell: { label: 'PowerShell', ext: 'ps1', runnable: false, preview: false, color: 'text-blue-500 dark:text-blue-400', starter: '$name = "CodeLab"\nWrite-Output "Hello from $name"\n' },
  lua: { label: 'Lua', ext: 'lua', runnable: false, preview: false, color: 'text-indigo-500 dark:text-indigo-400', starter: 'local function greet(name)\n  print("Hello " .. name)\nend\n\ngreet("Lua")\n' },
  r: { label: 'R', ext: 'r', runnable: false, preview: false, color: 'text-blue-600 dark:text-blue-400', starter: 'nums <- c(10, 20, 30, 40)\nprint(mean(nums))\n' },
  perl: { label: 'Perl', ext: 'pl', runnable: false, preview: false, color: 'text-teal-500 dark:text-teal-400', starter: 'use strict;\nuse warnings;\nprint "Hello from Perl!\\n";\n' },
  haskell: { label: 'Haskell', ext: 'hs', runnable: false, preview: false, color: 'text-purple-500 dark:text-purple-400', starter: 'main :: IO ()\nmain = putStrLn "Hello from Haskell!"\n' },
  scala: { label: 'Scala', ext: 'scala', runnable: false, preview: false, color: 'text-red-500 dark:text-red-400', starter: 'object Main extends App {\n  println("Hello from Scala!")\n}\n' },
  erlang: { label: 'Erlang / Elixir', ext: 'erl', runnable: false, preview: false, color: 'text-fuchsia-500 dark:text-fuchsia-400', starter: '-module(main).\n-export([start/0]).\n\nstart() ->\n  io:format("Hello from Erlang!~n").\n' },
  julia: { label: 'Julia', ext: 'jl', runnable: false, preview: false, color: 'text-emerald-500 dark:text-emerald-400', starter: 'function greet(name)\n    println("Hello from $name!")\nend\n\ngreet("Julia")\n' },
  groovy: { label: 'Groovy', ext: 'groovy', runnable: false, preview: false, color: 'text-sky-600 dark:text-sky-400', starter: 'println "Hello from Groovy!"\n' },
  clojure: { label: 'Clojure', ext: 'clj', runnable: false, preview: false, color: 'text-green-500 dark:text-green-400', starter: '(defn greet [name]\n  (str "Hello, " name "!"))\n\n(println (greet "Clojure"))\n' },
  asm: { label: 'Assembly (GAS)', ext: 'asm', runnable: false, preview: false, color: 'text-slate-500 dark:text-slate-400', starter: '.global _start\n.text\n_start:\n    mov $60, %rax\n    xor %rdi, %rdi\n    syscall\n' },
  pascal: { label: 'Pascal', ext: 'pas', runnable: false, preview: false, color: 'text-amber-500 dark:text-amber-400', starter: 'program Hello;\nbegin\n  writeln(\'Hello from Pascal!\');\nend.\n' },
  fortran: { label: 'Fortran', ext: 'f90', runnable: false, preview: false, color: 'text-indigo-400', starter: 'program hello\n  print *, "Hello from Fortran!"\nend program hello\n' },
  json: { label: 'JSON', ext: 'json', runnable: false, preview: false, color: 'text-teal-500 dark:text-teal-400', starter: '{\n  "name": "codelab-project",\n  "version": "1.0.0"\n}\n' },
  yaml: { label: 'YAML', ext: 'yaml', runnable: false, preview: false, color: 'text-rose-400', starter: 'name: codelab\nservices:\n  web:\n    port: 3000\n' },
  toml: { label: 'TOML', ext: 'toml', runnable: false, preview: false, color: 'text-orange-400', starter: '[package]\nname = "codelab"\nversion = "0.1.0"\n' },
  xml: { label: 'XML', ext: 'xml', runnable: false, preview: false, color: 'text-orange-500 dark:text-orange-400', starter: '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <item>CodeLab</item>\n</root>\n' },
  svg: { label: 'SVG', ext: 'svg', runnable: true, preview: true, color: 'text-amber-500 dark:text-amber-400', starter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" width="200" height="120">\n  <rect width="200" height="120" rx="12" fill="#0f172a"/>\n  <circle cx="100" cy="60" r="32" fill="#0ea5e9"/>\n</svg>\n' },
  markdown: { label: 'Markdown', ext: 'md', runnable: true, preview: true, color: 'text-slate-500 dark:text-slate-400', starter: '# عنوان المستند\n\nاكتب ملاحظاتك هنا باستخدام **Markdown**.\n' },
  dockerfile: { label: 'Dockerfile', ext: 'Dockerfile', runnable: false, preview: false, color: 'text-sky-500 dark:text-sky-400', starter: 'FROM node:22-slim\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]\n' },
  nginx: { label: 'Nginx Config', ext: 'conf', runnable: false, preview: false, color: 'text-emerald-500 dark:text-emerald-400', starter: 'server {\n  listen 80;\n  server_name example.com;\n}\n' },
  latex: { label: 'LaTeX', ext: 'tex', runnable: false, preview: false, color: 'text-teal-600 dark:text-teal-400', starter: '\\documentclass{article}\n\\begin{document}\nHello from LaTeX!\n\\end{document}\n' },
  text: { label: 'Plain Text', ext: 'txt', runnable: false, preview: false, color: 'text-slate-500 dark:text-slate-400', starter: '' },
};

export const ALL_LANGUAGE_OPTIONS = Object.entries(LANG_META).map(([id, info]) => ({
  id,
  ...info,
}));

export function detectMediaKind(path = '', entry) {
  if (entry && typeof entry === 'object' && entry.__media) {
    if (entry.mime?.startsWith('image/')) return 'image';
    if (entry.mime?.startsWith('video/')) return 'video';
    if (entry.mime?.startsWith('audio/')) return 'audio';
  }
  const clean = path.split('/').pop() || '';
  const idx = clean.lastIndexOf('.');
  if (idx === -1) return null;
  return MEDIA_EXT_TO_KIND[clean.slice(idx + 1).toLowerCase()] || null;
}

export function detectLang(path = '') {
  const clean = (path.split('/').pop() || '').trim();
  if (/^dockerfile$/i.test(clean)) return 'dockerfile';
  const idx = clean.lastIndexOf('.');
  if (idx === -1) return 'text';
  const ext = clean.slice(idx + 1).toLowerCase();
  if (MEDIA_EXT_TO_KIND[ext]) return MEDIA_EXT_TO_KIND[ext];
  return FILE_EXT_TO_LANG[ext] || 'text';
}

export function getLangMeta(lang) {
  if (lang === 'image') return { label: 'Image', ext: 'png', runnable: false, preview: true, color: 'text-emerald-500 dark:text-emerald-400' };
  if (lang === 'video') return { label: 'Video', ext: 'mp4', runnable: false, preview: true, color: 'text-purple-500 dark:text-purple-400' };
  if (lang === 'audio') return { label: 'Audio', ext: 'mp3', runnable: false, preview: true, color: 'text-pink-500 dark:text-pink-400' };
  return LANG_META[lang] || LANG_META.text;
}

export const WORKSPACE_TEMPLATES = [
  {
    id: 'web-app',
    name: 'مشروع ويب متكامل (HTML / CSS / JS)',
    description: 'ملفات HTML وCSS وJavaScript مرتبطة تلقائياً مع دعم الصور والفيديو والصوت',
    entryFile: 'index.html',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تطبيق ويب | CodeLab</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="card">
    <h1>مرحباً بك في CodeLab IDE</h1>
    <p>يمكنك تعديل الملفات أو رفع صور وفيديو وصوت من الشجرة الجانبية واستخدامها مباشرة هنا.</p>
    <div class="actions">
      <button id="inc-btn">العداد: <span id="count">0</span></button>
      <button id="log-btn" class="secondary">طباعة في Console</button>
    </div>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
      'styles.css': `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f172a;
  color: #f8fafc;
}

.card {
  width: 100%;
  max-width: 460px;
  padding: 28px;
  border-radius: 14px;
  background: #1e293b;
  border: 1px solid #334155;
}

h1 {
  margin: 0 0 10px;
  font-size: 1.5rem;
}

p {
  margin: 0 0 20px;
  color: #94a3b8;
  line-height: 1.7;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

button {
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  background: #0ea5e9;
  color: #082f49;
  transition: opacity 0.15s ease;
}

button:hover {
  opacity: 0.9;
}

button.secondary {
  background: #334155;
  color: #f8fafc;
}`,
      'app.js': `let count = 0;

const countEl = document.getElementById('count');
const incBtn = document.getElementById('inc-btn');
const logBtn = document.getElementById('log-btn');

incBtn?.addEventListener('click', () => {
  count += 1;
  countEl.textContent = String(count);
  console.log('تم تحديث العداد إلى:', count);
});

logBtn?.addEventListener('click', () => {
  console.info('الحالة الحالية للمشروع:', { count, time: new Date().toLocaleTimeString() });
});

console.log('تم تحميل التطبيق بنجاح');`,
      'README.md': `# مشروع ويب\n\n- \`index.html\`: نقطة الدخول الرئيسية.\n- \`styles.css\`: التنسيقات وتُربط تلقائياً داخل المعاينة.\n- \`app.js\`: المنطق البرمجي.\n`,
    },
  },
  {
    id: 'typescript-lab',
    name: 'مشروع TypeScript',
    description: 'كتابة وتشغيل TypeScript مباشرة في المتصفح مع فحص الأنواع',
    entryFile: 'main.ts',
    files: {
      'main.ts': `interface Task {
  id: number;
  title: string;
  done: boolean;
}

function summarize(tasks: Task[]): string {
  const completed = tasks.filter((t) => t.done).length;
  return \`المكتمل: \${completed} من \${tasks.length}\`;
}

const list: Task[] = [
  { id: 1, title: 'إعداد البيئة', done: true },
  { id: 2, title: 'كتابة الكود', done: true },
  { id: 3, title: 'الاختبار النهائي', done: false },
];

console.log(summarize(list));
console.log(list);`,
    },
  },
  {
    id: 'python-lab',
    name: 'مشروع Python',
    description: 'ملفات Python متعددة مع دعم استيراد الوحدات وقراءة JSON',
    entryFile: 'main.py',
    files: {
      'main.py': `import json
from math_utils import factorial, is_prime

with open("config.json", "r", encoding="utf-8") as f:
    cfg = json.load(f)

print(f"المشروع: {cfg['project']}")
nums = [2, 3, 4, 5, 11, 15, 17]
primes = [n for n in nums if is_prime(n)]
print("الأعداد الأولية:", primes)
print("مضروب 6 =", factorial(6))`,
      'math_utils.py': `def factorial(n: int) -> int:
    if n <= 1:
        return 1
    return n * factorial(n - 1)


def is_prime(n: int) -> bool:
    if n < 2:
        return False
    for i in range(2, int(n ** 0.5) + 1):
        if n % i == 0:
            return False
    return True`,
      'config.json': `{
  "project": "CodeLab Python Workspace",
  "precision": 4,
  "items": [10, 20, 30]
}`,
    },
  },
  {
    id: 'multi-lang-polyglot',
    name: 'مساحة عمل متعددة اللغات',
    description: 'ملفات جاهزة بلغات Go وRust وSQL وC++ وJava وPHP في مشروع واحد',
    entryFile: 'main.go',
    files: {
      'main.go': LANG_META.go.starter,
      'main.rs': LANG_META.rust.starter,
      'query.sql': LANG_META.sql.starter,
      'main.cpp': LANG_META.cpp.starter,
      'Main.java': LANG_META.java.starter,
      'index.php': LANG_META.php.starter,
    },
  },
  {
    id: 'cpp-program',
    name: 'برنامج C++',
    description: 'محرر C++ مع تشغيل سريع وفحص الأخطاء',
    entryFile: 'main.cpp',
    files: {
      'main.cpp': `#include <iostream>
using namespace std;

int fibonacci(int n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
  for (int i = 0; i < 8; i++) {
    cout << fibonacci(i) << " ";
  }
  cout << endl;
  return 0;
}`,
    },
  },
  {
    id: 'java-program',
    name: 'برنامج Java',
    description: 'محرر Java لكتابة الكلاسات والدوال وتشغيلها',
    entryFile: 'Main.java',
    files: {
      'Main.java': `public class Main {
  static int sumRange(int start, int end) {
    int total = 0;
    for (int i = start; i <= end; i++) {
      total += i;
    }
    return total;
  }

  public static void main(String[] args) {
    System.out.println("مجموع الأعداد من 1 إلى 10:");
    System.out.println(sumRange(1, 10));
  }
}`,
    },
  },
];

export const DEV = {
  name: 'محمود مدحت',
  phone: '01040630335',
  wa: 'https://wa.me/201040630335',
  bio: 'مطور برمجيات شغوف ببناء أدوات وتجارب برمجية عملية وسريعة للمطورين.',
  tech: ['React', 'Next.js', 'TypeScript', 'Python', 'C++', 'Java', 'Tailwind', 'Node.js'],
};
