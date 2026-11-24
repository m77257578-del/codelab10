// Integrated workspace shell, script runner, and build engine for CodeLab IDE

import { arJs, diagnose, formatCode } from './diagnostics';
import { buildWebPreviewDoc, runCode, runPy, runWorker, transpileTSOrJSX } from './runner';
import { isMediaEntry, sanitizeProjectName } from './storage';
import { detectLang } from './workspaces';

export const TERMINAL_COMMANDS = [
  'help',
  'clear',
  'cls',
  'pwd',
  'ls',
  'll',
  'cd',
  'cat',
  'head',
  'tail',
  'wc',
  'echo',
  'touch',
  'mkdir',
  'rm',
  'cp',
  'mv',
  'grep',
  'find',
  'open',
  'code',
  'run',
  'node',
  'tsx',
  'npx',
  'python',
  'python3',
  'py',
  'php',
  'sql',
  'npm',
  'build',
  'vite',
  'tsc',
  'lint',
  'check',
  'format',
  'prettier',
  'dev',
  'preview',
  'serve',
  'zip',
  'export',
  'env',
  'whoami',
  'date',
  'uname',
  'history',
];

export function normalizePath(cwd = '', rawTarget = '') {
  const target = String(rawTarget || '').trim();
  if (!target || target === '.') return cwd;
  if (target === '/' || target === '~') return '';

  const baseParts = target.startsWith('/') || target.startsWith('~/')
    ? []
    : (cwd ? cwd.split('/').filter(Boolean) : []);

  const cleaned = target.replace(/^~\/?/, '').replace(/^\/+/, '');
  for (const part of cleaned.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }
  return baseParts.join('/');
}

function getAllDirs(files, virtualDirs) {
  const dirs = new Set(['']);
  for (const d of virtualDirs) {
    if (d) dirs.add(d);
  }
  for (const path of Object.keys(files)) {
    const parts = path.split('/').filter(Boolean);
    let cur = '';
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur ? `${cur}/${parts[i]}` : parts[i];
      dirs.add(cur);
    }
  }
  return dirs;
}

function listDirectory(files, virtualDirs, dirPath) {
  const prefix = dirPath ? `${dirPath}/` : '';
  const dirSet = new Set();
  const fileItems = [];

  for (const d of virtualDirs) {
    if (!d) continue;
    if (dirPath === '' && !d.includes('/')) dirSet.add(d);
    else if (prefix && d.startsWith(prefix)) {
      const rest = d.slice(prefix.length);
      if (rest) dirSet.add(rest.split('/')[0]);
    }
  }

  for (const [path, entry] of Object.entries(files)) {
    if (prefix && !path.startsWith(prefix)) continue;
    const rest = prefix ? path.slice(prefix.length) : path;
    if (!rest) continue;
    if (rest.includes('/')) {
      dirSet.add(rest.split('/')[0]);
    } else {
      const size = isMediaEntry(entry)
        ? Number(entry.size || 0)
        : new TextEncoder().encode(String(entry || '')).length;
      fileItems.push({
        name: rest,
        path,
        isMedia: isMediaEntry(entry),
        size,
      });
    }
  }

  const dirs = [...dirSet].sort().map((name) => ({ name, isDir: true }));
  fileItems.sort((a, b) => a.name.localeCompare(b.name));
  return { dirs, files: fileItems };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function splitCommandChain(raw) {
  const segments = [];
  let current = '';
  let quote = '';
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (quote) {
      if (ch === '\\' && quote === '"' && i + 1 < raw.length) {
        current += ch + raw[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = '';
      current += ch;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      i += 1;
      continue;
    }
    if (ch === '&' && raw[i + 1] === '&') {
      segments.push({ cmd: current.trim(), op: '&&' });
      current = '';
      i += 2;
      continue;
    }
    if (ch === ';') {
      segments.push({ cmd: current.trim(), op: ';' });
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current.trim()) {
    segments.push({ cmd: current.trim(), op: null });
  }
  return segments;
}

function tokenizeCommand(raw, env = {}) {
  const tokens = [];
  let cur = '';
  let quote = '';
  let hasToken = false;

  const expand = (str) =>
    str.replace(/\$(\w+)|\$\{(\w+)\}/g, (_, a, b) => {
      const key = a || b;
      return env[key] !== undefined ? String(env[key]) : '';
    });

  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) {
        quote = '';
        i += 1;
        continue;
      }
      if (ch === '\\' && quote === '"' && i + 1 < raw.length) {
        const nxt = raw[i + 1];
        cur += nxt === 'n' ? '\n' : nxt === 't' ? '\t' : nxt;
        hasToken = true;
        i += 2;
        continue;
      }
      if (quote === '"' && ch === '$') {
        const rest = raw.slice(i);
        const m = rest.match(/^\$(\w+)|\$\{(\w+)\}/);
        if (m) {
          const key = m[1] || m[2];
          cur += env[key] !== undefined ? String(env[key]) : '';
          hasToken = true;
          i += m[0].length;
          continue;
        }
      }
      cur += ch;
      hasToken = true;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      hasToken = true;
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasToken) {
        tokens.push(cur);
        cur = '';
        hasToken = false;
      }
      i += 1;
      continue;
    }
    if (ch === '>' && !hasToken) {
      if (raw[i + 1] === '>') {
        tokens.push('>>');
        i += 2;
      } else {
        tokens.push('>');
        i += 1;
      }
      continue;
    }
    if (ch === '>' && hasToken) {
      tokens.push(cur);
      cur = '';
      hasToken = false;
      continue;
    }
    if (ch === '\\' && i + 1 < raw.length) {
      cur += raw[i + 1];
      hasToken = true;
      i += 2;
      continue;
    }
    if (ch === '$') {
      const m = raw.slice(i).match(/^\$(\w+)|\$\{(\w+)\}/);
      if (m) {
        cur += expand(m[0]);
        hasToken = true;
        i += m[0].length;
        continue;
      }
    }
    cur += ch;
    hasToken = true;
    i += 1;
  }
  if (hasToken) tokens.push(cur);

  // Extract output redirection (> or >>)
  let redirect = null;
  const cleanTokens = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];
    if ((t === '>' || t === '>>') && idx + 1 < tokens.length) {
      redirect = { mode: t, target: tokens[idx + 1] };
      idx += 1;
    } else {
      cleanTokens.push(t);
    }
  }

  return { tokens: cleanTokens, redirect };
}

function readPackageJson(files) {
  const raw = files['package.json'];
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getTerminalCompletions(input, files = {}, cwd = '') {
  const trimmedStart = input.trimStart();
  const parts = trimmedStart.split(/\s+/);
  const trailingSpace = /\s$/.test(input);

  // Completing first word (command)
  if (parts.length <= 1 && !trailingSpace) {
    const prefix = parts[0] || '';
    return TERMINAL_COMMANDS.filter((c) => c.startsWith(prefix)).sort();
  }

  // Completing npm scripts
  if (
    (parts[0] === 'npm' && parts[1] === 'run' && (parts.length === 2 && trailingSpace || parts.length === 3 && !trailingSpace))
  ) {
    const pkg = readPackageJson(files);
    const defaults = ['build', 'dev', 'lint', 'format', 'test', 'start'];
    const custom = pkg?.scripts ? Object.keys(pkg.scripts) : [];
    const all = [...new Set([...defaults, ...custom])];
    const prefix = trailingSpace ? '' : (parts[2] || '');
    return all.filter((s) => s.startsWith(prefix)).sort();
  }

  // Completing file/directory path in current cwd
  const currentArg = trailingSpace ? '' : parts[parts.length - 1] || '';
  const lastSlash = currentArg.lastIndexOf('/');
  const dirPart = lastSlash >= 0 ? currentArg.slice(0, lastSlash) : '';
  const namePrefix = lastSlash >= 0 ? currentArg.slice(lastSlash + 1) : currentArg;
  const targetDir = dirPart ? normalizePath(cwd, dirPart) : cwd;

  const { dirs, files: fileItems } = listDirectory(files, new Set(), targetDir);
  const candidates = [
    ...dirs.map((d) => (dirPart ? `${dirPart}/${d.name}/` : `${d.name}/`)),
    ...fileItems.map((f) => (dirPart ? `${dirPart}/${f.name}` : f.name)),
  ];
  return candidates.filter((c) => c.slice(dirPart ? dirPart.length + 1 : 0).startsWith(namePrefix));
}

export async function executeTerminalLine(rawLine, ctx, depth = 0) {
  const line = String(rawLine || '').trim();
  const out = [];
  const push = (level, text) => {
    if (text !== undefined && text !== null) {
      out.push({ level, text: String(text) });
    }
  };

  if (!line) return { lines: out, exitCode: 0 };
  if (depth > 6) {
    push('error', 'Error: maximum script recursion depth exceeded.');
    return { lines: out, exitCode: 1 };
  }

  // Working copies of mutable workspace state
  let files = { ...ctx.files };
  let virtualDirs = new Set(ctx.virtualDirs || []);
  let cwd = ctx.cwd || '';
  let env = {
    PROJECT: sanitizeProjectName(ctx.projectName),
    PWD: cwd ? `/${cwd}` : '/',
    HOME: '/',
    USER: 'developer',
    FILE: ctx.activeFile || '',
    NODE_ENV: 'development',
    ...(ctx.env || {}),
  };

  let filesMutated = false;
  let clearRequested = false;
  let openFileTarget = null;
  let refreshPreview = false;
  let triggerZip = false;
  let lastExitCode = 0;

  const syncFiles = () => {
    if (filesMutated) {
      ctx.onUpdateFiles(files);
      filesMutated = false;
    }
  };

  const segments = splitCommandChain(line);

  for (const seg of segments) {
    const { tokens, redirect } = tokenizeCommand(seg.cmd, env);
    if (tokens.length === 0) continue;

    const cmd = tokens[0];
    const args = tokens.slice(1);
    const segOut = [];
    const write = (level, text) => {
      if (text !== undefined && text !== null) {
        segOut.push({ level, text: String(text) });
      }
    };

    const runSingle = async () => {
      // Built-in env assignment: export KEY=VAL
      if (cmd === 'export' && args[0] && args[0].includes('=')) {
        for (const pair of args) {
          const eq = pair.indexOf('=');
          if (eq > 0) {
            const k = pair.slice(0, eq);
            const v = pair.slice(eq + 1);
            env[k] = v;
          }
        }
        return 0;
      }

      if (cmd === 'clear' || cmd === 'cls') {
        clearRequested = true;
        return 0;
      }

      if (cmd === 'help') {
        write('info', 'CodeLab Integrated Terminal — Built-in Commands:');
        write('stdout', [
          '  Navigation & Files : pwd, ls, ll, cd <dir>, cat <file>, head, tail, wc, grep, find',
          '  File Operations    : touch <file>, mkdir <dir>, cp <src> <dst>, mv <src> <dst>, rm <file>, echo "..." > file',
          '  Open in Editor     : open <file>  |  code <file>',
          '  Run Scripts        : node <file>  |  node -e "js"  |  tsx <file>  |  python <file>  |  python -c "py"  |  run [file]',
          '  Build & Tooling    : npm run build  |  build  |  lint  |  check  |  format  |  npm init -y  |  dev  |  zip',
          '  Shell & Utilities  : env, export K=V, whoami, date, history, clear',
        ].join('\n'));
        return 0;
      }

      if (cmd === 'pwd') {
        write('stdout', cwd ? `/${cwd}` : '/');
        return 0;
      }

      if (cmd === 'whoami') {
        write('stdout', env.USER || 'developer');
        return 0;
      }

      if (cmd === 'date') {
        write('stdout', new Date().toString());
        return 0;
      }

      if (cmd === 'uname') {
        write('stdout', 'CodeLab-OS 1.0.0 WebAssembly/Worker x86_64');
        return 0;
      }

      if (cmd === 'env') {
        Object.entries(env).forEach(([k, v]) => write('stdout', `${k}=${v}`));
        return 0;
      }

      if (cmd === 'history') {
        (ctx.history || []).forEach((h, i) => write('stdout', `  ${String(i + 1).padStart(3)}  ${h}`));
        return 0;
      }

      if (cmd === 'echo') {
        write('stdout', args.join(' '));
        return 0;
      }

      if (cmd === 'cd') {
        const target = args[0] || '/';
        const next = normalizePath(cwd, target);
        const dirs = getAllDirs(files, virtualDirs);
        if (next === '' || dirs.has(next)) {
          cwd = next;
          env.PWD = cwd ? `/${cwd}` : '/';
          return 0;
        }
        write('error', `cd: ${target}: No such directory`);
        return 1;
      }

      if (cmd === 'ls' || cmd === 'll' || cmd === 'dir') {
        const showLong = cmd === 'll' || args.includes('-l') || args.includes('-la') || args.includes('-al');
        const pathArg = args.find((a) => !a.startsWith('-')) || '';
        const targetDir = pathArg ? normalizePath(cwd, pathArg) : cwd;
        const dirs = getAllDirs(files, virtualDirs);
        if (targetDir && !dirs.has(targetDir)) {
          if (files[targetDir] !== undefined) {
            const entry = files[targetDir];
            const sz = isMediaEntry(entry) ? Number(entry.size || 0) : String(entry).length;
            write('stdout', showLong ? `-rw-r--r--  ${formatBytes(sz).padStart(8)}  ${targetDir}` : targetDir);
            return 0;
          }
          write('error', `ls: cannot access '${pathArg}': No such file or directory`);
          return 1;
        }
        const { dirs: subDirs, files: fileItems } = listDirectory(files, virtualDirs, targetDir);
        if (subDirs.length === 0 && fileItems.length === 0) {
          write('muted', '(empty directory)');
          return 0;
        }
        if (showLong) {
          for (const d of subDirs) {
            write('info', `drwxr-xr-x         -  ${d.name}/`);
          }
          for (const f of fileItems) {
            const kind = f.isMedia ? ' [media]' : '';
            write('stdout', `-rw-r--r--  ${formatBytes(f.size).padStart(8)}  ${f.name}${kind}`);
          }
        } else {
          const names = [...subDirs.map((d) => `${d.name}/`), ...fileItems.map((f) => f.name)];
          write('stdout', names.join('   '));
        }
        return 0;
      }

      if (cmd === 'cat' || cmd === 'head' || cmd === 'tail') {
        const nFlagIdx = args.indexOf('-n');
        let lineLimit = 10;
        let fileArg = args[0];
        if (nFlagIdx !== -1 && args[nFlagIdx + 1]) {
          lineLimit = Math.max(1, Number(args[nFlagIdx + 1]) || 10);
          fileArg = args.find((_, i) => i !== nFlagIdx && i !== nFlagIdx + 1);
        }
        if (!fileArg) {
          write('error', `${cmd}: missing file operand`);
          return 1;
        }
        const resolved = normalizePath(cwd, fileArg);
        if (files[resolved] === undefined) {
          write('error', `${cmd}: ${fileArg}: No such file`);
          return 1;
        }
        const entry = files[resolved];
        if (isMediaEntry(entry)) {
          write('info', `[binary media: ${entry.name || resolved} (${entry.mime}, ${formatBytes(entry.size || 0)})]`);
          return 0;
        }
        const content = String(entry);
        if (cmd === 'cat') {
          write('stdout', content);
        } else {
          const rows = content.split('\n');
          const sliced = cmd === 'head' ? rows.slice(0, lineLimit) : rows.slice(-lineLimit);
          write('stdout', sliced.join('\n'));
        }
        return 0;
      }

      if (cmd === 'wc') {
        const fileArg = args[0];
        if (!fileArg) {
          write('error', 'wc: missing file operand');
          return 1;
        }
        const resolved = normalizePath(cwd, fileArg);
        if (files[resolved] === undefined) {
          write('error', `wc: ${fileArg}: No such file`);
          return 1;
        }
        const entry = files[resolved];
        if (isMediaEntry(entry)) {
          write('stdout', `0 0 ${entry.size || 0} ${fileArg}`);
          return 0;
        }
        const text = String(entry);
        const linesCount = text ? text.split('\n').length : 0;
        const wordsCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        const bytesCount = new TextEncoder().encode(text).length;
        write('stdout', `  ${linesCount}  ${wordsCount}  ${bytesCount} ${fileArg}`);
        return 0;
      }

      if (cmd === 'touch') {
        if (!args.length) {
          write('error', 'touch: missing file operand');
          return 1;
        }
        for (const a of args) {
          const p = normalizePath(cwd, a);
          if (!p) continue;
          if (files[p] === undefined) {
            files[p] = '';
            filesMutated = true;
          }
        }
        return 0;
      }

      if (cmd === 'mkdir') {
        const targets = args.filter((a) => !a.startsWith('-'));
        if (!targets.length) {
          write('error', 'mkdir: missing operand');
          return 1;
        }
        for (const a of targets) {
          const p = normalizePath(cwd, a);
          if (p) virtualDirs.add(p);
        }
        return 0;
      }

      if (cmd === 'rm') {
        const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr');
        const targets = args.filter((a) => !a.startsWith('-'));
        if (!targets.length) {
          write('error', 'rm: missing operand');
          return 1;
        }
        let code = 0;
        for (const a of targets) {
          const p = normalizePath(cwd, a);
          if (files[p] !== undefined) {
            if (Object.keys(files).length <= 1) {
              write('error', 'rm: cannot remove the last file in workspace');
              code = 1;
              continue;
            }
            delete files[p];
            filesMutated = true;
            continue;
          }
          if (recursive) {
            const prefix = p ? `${p}/` : '';
            const matching = Object.keys(files).filter((k) => k.startsWith(prefix));
            if (matching.length > 0 && matching.length < Object.keys(files).length) {
              matching.forEach((k) => delete files[k]);
              virtualDirs.delete(p);
              filesMutated = true;
              continue;
            }
            if (virtualDirs.has(p)) {
              virtualDirs.delete(p);
              continue;
            }
          }
          write('error', `rm: cannot remove '${a}': No such file or directory`);
          code = 1;
        }
        return code;
      }

      if (cmd === 'cp' || cmd === 'mv') {
        if (args.length < 2) {
          write('error', `${cmd}: missing source or destination operand`);
          return 1;
        }
        const src = normalizePath(cwd, args[0]);
        const dst = normalizePath(cwd, args[1]);
        if (files[src] === undefined) {
          write('error', `${cmd}: cannot stat '${args[0]}': No such file`);
          return 1;
        }
        files[dst] = files[src];
        if (cmd === 'mv') delete files[src];
        filesMutated = true;
        return 0;
      }

      if (cmd === 'grep') {
        if (!args.length) {
          write('error', 'grep: usage: grep <pattern> [file]');
          return 1;
        }
        const pattern = args[0];
        const target = args[1] ? normalizePath(cwd, args[1]) : null;
        let matches = 0;
        const pool = target ? [[target, files[target]]] : Object.entries(files);
        for (const [path, entry] of pool) {
          if (typeof entry !== 'string') continue;
          entry.split('\n').forEach((row, idx) => {
            if (row.toLowerCase().includes(pattern.toLowerCase())) {
              matches += 1;
              write('stdout', `${path}:${idx + 1}: ${row.trim()}`);
            }
          });
        }
        if (matches === 0) write('muted', `(no matches for "${pattern}")`);
        return matches > 0 ? 0 : 1;
      }

      if (cmd === 'find') {
        const needle = (args[0] || '').toLowerCase();
        const prefix = cwd ? `${cwd}/` : '';
        const list = Object.keys(files).filter((k) => {
          if (prefix && !k.startsWith(prefix)) return false;
          return !needle || k.toLowerCase().includes(needle);
        });
        if (!list.length) {
          write('muted', '(no matching files)');
          return 0;
        }
        list.sort().forEach((p) => write('stdout', p));
        return 0;
      }

      if (cmd === 'open' || cmd === 'code') {
        if (!args[0]) {
          write('error', `${cmd}: specify a filename`);
          return 1;
        }
        const target = normalizePath(cwd, args[0]);
        if (files[target] === undefined) {
          write('error', `${cmd}: ${args[0]} not found`);
          return 1;
        }
        openFileTarget = target;
        write('success', `Opened ${target} in editor.`);
        return 0;
      }

      if (cmd === 'zip' || cmd === 'export') {
        triggerZip = true;
        write('success', `Preparing ZIP archive for "${sanitizeProjectName(ctx.projectName)}"...`);
        return 0;
      }

      // Script Runners: node, tsx, npx, python, python3, py, run
      if (cmd === 'node' || cmd === 'tsx') {
        if (args[0] === '-v' || args[0] === '--version') {
          write('stdout', 'v20.18.0 (CodeLab WebWorker Runtime)');
          return 0;
        }
        if (args[0] === '-e' || args[0] === '-p') {
          const inlineCode = args.slice(1).join(' ');
          if (!inlineCode) {
            write('error', 'node: missing inline script');
            return 1;
          }
          const src = args[0] === '-p' ? `console.log(${inlineCode});` : inlineCode;
          const res = await runWorker(src);
          if (res.err) {
            write('error', arJs(res.err));
            return 1;
          }
          if (res.out) write('stdout', res.out.trimEnd());
          return 0;
        }
        const targetArg = args[0] || ctx.activeFile;
        const resolved = normalizePath(cwd, targetArg);
        const entry = files[resolved];
        if (typeof entry !== 'string') {
          write('error', `node: cannot find module '${targetArg}'`);
          return 1;
        }
        let codeToRun = entry;
        const lang = detectLang(resolved);
        if (lang === 'ts' || lang === 'tsx' || lang === 'jsx' || cmd === 'tsx') {
          try {
            codeToRun = transpileTSOrJSX(entry, lang === 'jsx' ? 'jsx' : 'tsx');
          } catch (e) {
            write('error', `CompileError in ${resolved}: ${e.message}`);
            return 1;
          }
        }
        const res = await runWorker(codeToRun);
        if (res.err) {
          write('error', arJs(res.err));
          return 1;
        }
        const trimmed = (res.out || '').trimEnd();
        if (trimmed) write('stdout', trimmed);
        else write('muted', '(finished with no stdout)');
        return 0;
      }

      if (cmd === 'npx') {
        if (args[0] === 'tsx' && args[1]) {
          return await runDelegated(`tsx ${args.slice(1).join(' ')}`);
        }
        if (args[0] === 'tsc') {
          return await runDelegated(`tsc ${args.slice(1).join(' ')}`);
        }
        if (args[0] === 'vite') {
          return await runDelegated(`vite ${args.slice(1).join(' ')}`);
        }
        if (args[0] === 'prettier') {
          return await runDelegated(`prettier ${args.slice(1).join(' ')}`);
        }
        write('error', `npx: command '${args[0] || ''}' is not installed in workspace.`);
        return 1;
      }

      if (cmd === 'python' || cmd === 'python3' || cmd === 'py') {
        if (args[0] === '--version' || args[0] === '-V') {
          write('stdout', 'Python 3.12.1 (CodeLab Pyodide/Local Engine)');
          return 0;
        }
        if (args[0] === '-c') {
          const inlinePy = args.slice(1).join(' ');
          if (!inlinePy) {
            write('error', `${cmd}: argument expected for the -c option`);
            return 1;
          }
          const res = await runPy(inlinePy, files);
          if (res.err) {
            write('error', arJs(res.err));
            return 1;
          }
          if (res.out) write('stdout', res.out.trimEnd());
          if (res.stderr) write('warn', res.stderr);
          return 0;
        }
        const targetArg = args[0] || ctx.activeFile;
        const resolved = normalizePath(cwd, targetArg);
        const entry = files[resolved];
        if (typeof entry !== 'string') {
          write('error', `${cmd}: can't open file '${targetArg}': No such file`);
          return 1;
        }
        const res = await runPy(entry, files);
        if (res.err) {
          write('error', arJs(res.err));
          return 1;
        }
        const trimmed = (res.out || '').trimEnd();
        if (trimmed) write('stdout', trimmed);
        else write('muted', '(finished with no stdout)');
        if (res.stderr) write('warn', res.stderr);
        return 0;
      }

      if (cmd === 'php' || cmd === 'sql') {
        if (args[0] === '-v' || args[0] === '--version') {
          write('stdout', cmd === 'php' ? 'PHP 8.3 (CodeLab Local Sandbox)' : 'SQLite/ANSI SQL (CodeLab In-Memory Engine)');
          return 0;
        }
        if ((cmd === 'php' && args[0] === '-r') || (cmd === 'sql' && args[0] === '-e')) {
          const inlineSrc = args.slice(1).join(' ');
          if (!inlineSrc) {
            write('error', `${cmd}: missing inline code`);
            return 1;
          }
          const res = await runCode(cmd, inlineSrc, files);
          if (res.err) {
            write('error', arJs(res.err));
            return 1;
          }
          if (res.out) write('stdout', res.out.trimEnd());
          return 0;
        }
        const targetArg = args[0] || ctx.activeFile;
        const resolved = normalizePath(cwd, targetArg);
        const entry = files[resolved];
        if (typeof entry !== 'string') {
          write('error', `${cmd}: cannot open '${targetArg}': No such file`);
          return 1;
        }
        const res = await runCode(cmd, entry, files);
        if (res.err) {
          write('error', arJs(res.err));
          return 1;
        }
        const trimmed = (res.out || '').trimEnd();
        if (trimmed) write('stdout', trimmed);
        else write('muted', '(finished with no stdout)');
        return 0;
      }

      if (cmd === 'run') {
        const targetArg = args[0] || ctx.activeFile;
        const resolved = normalizePath(cwd, targetArg);
        if (files[resolved] === undefined) {
          write('error', `run: '${targetArg}' not found`);
          return 1;
        }
        const lang = detectLang(resolved);
        if (lang === 'html' || lang === 'css' || lang === 'svg' || lang === 'markdown') {
          refreshPreview = true;
          write('success', `Live preview rebuilt for ${resolved}.`);
          return 0;
        }
        const content = files[resolved];
        if (typeof content !== 'string') {
          write('error', `run: '${resolved}' is a binary media asset`);
          return 1;
        }
        const res = await runCode(lang, content, files);
        if (res.noRun || res.err) {
          write('error', arJs(res.err));
          return 1;
        }
        const trimmed = (res.out || '').trimEnd();
        if (trimmed) write('stdout', trimmed);
        else write('muted', '(finished with no stdout)');
        return 0;
      }

      // Build, Lint, Format, Dev, Package Manager
      if (cmd === 'lint' || cmd === 'check' || (cmd === 'tsc' && args.includes('--noEmit'))) {
        let errorCount = 0;
        let checked = 0;
        for (const [path, content] of Object.entries(files)) {
          if (typeof content !== 'string' || path.startsWith('dist/')) continue;
          checked += 1;
          const lang = detectLang(path);
          const diags = diagnose(content, lang);
          for (const d of diags) {
            errorCount += 1;
            write('error', `${path}:${d.line}  ${d.why}`);
          }
          if (lang === 'ts' || lang === 'tsx' || lang === 'jsx') {
            try {
              transpileTSOrJSX(content, lang);
            } catch (e) {
              errorCount += 1;
              write('error', `${path}:1  TypeScript/JSX syntax error: ${e.message}`);
            }
          }
        }
        if (errorCount === 0) {
          write('success', `Checked ${checked} files — 0 errors found.`);
          return 0;
        }
        write('error', `Found ${errorCount} error(s) across workspace.`);
        return 1;
      }

      if (cmd === 'format' || cmd === 'prettier') {
        const targets = args.filter((a) => !a.startsWith('-'));
        const list = targets.length
          ? targets.map((t) => normalizePath(cwd, t)).filter((p) => typeof files[p] === 'string')
          : Object.keys(files).filter((p) => typeof files[p] === 'string' && !p.startsWith('dist/'));
        if (!list.length) {
          write('error', `${cmd}: no matching code files found`);
          return 1;
        }
        let updated = 0;
        for (const p of list) {
          const lang = detectLang(p);
          const next = formatCode(files[p], lang, 2);
          if (next !== files[p]) {
            files[p] = next;
            filesMutated = true;
            updated += 1;
          }
        }
        write('success', `Formatted ${list.length} file(s) (${updated} updated).`);
        return 0;
      }

      if (cmd === 'build' || (cmd === 'vite' && args[0] === 'build') || cmd === 'tsc') {
        const startedAt = performance.now();
        const dryRun = args.includes('--dry-run');
        const force = args.includes('--force');

        write('info', `Building project "${sanitizeProjectName(ctx.projectName)}"...`);
        const sourceFiles = Object.fromEntries(
          Object.entries(files).filter(([k]) => !k.startsWith('dist/'))
        );

        let errorCount = 0;
        let compiledCount = 0;
        for (const [path, content] of Object.entries(sourceFiles)) {
          if (typeof content !== 'string') continue;
          compiledCount += 1;
          const lang = detectLang(path);
          const diags = diagnose(content, lang);
          for (const d of diags) {
            errorCount += 1;
            write('error', `  ${path}:${d.line}  ${d.why}`);
          }
          if (lang === 'ts' || lang === 'tsx' || lang === 'jsx') {
            try {
              transpileTSOrJSX(content, lang);
            } catch (e) {
              errorCount += 1;
              write('error', `  ${path}:1  ${e.message}`);
            }
          }
        }

        if (errorCount > 0 && !force) {
          write('error', `Build failed with ${errorCount} error(s). Fix errors or run "build --force".`);
          return 1;
        }

        const hasHtml = Object.keys(sourceFiles).some((k) => /\.(html|htm)$/i.test(k));
        if (hasHtml) {
          const entryHtml = sourceFiles['index.html'] !== undefined
            ? 'index.html'
            : Object.keys(sourceFiles).find((k) => /\.(html|htm)$/i.test(k));
          const bundleHtml = buildWebPreviewDoc(sourceFiles, entryHtml, false);
          const bytes = new TextEncoder().encode(bundleHtml).length;
          if (!dryRun) {
            files['dist/index.html'] = bundleHtml;
            filesMutated = true;
            refreshPreview = true;
          }
          const ms = Math.max(1, Math.round(performance.now() - startedAt));
          write('stdout', `  dist/index.html  ${formatBytes(bytes)}  (${compiledCount} source files bundled)`);
          write('success', `Build succeeded in ${ms}ms.`);
          return 0;
        }

        const tsOrJsEntry =
          (ctx.activeFile && /\.(ts|tsx|jsx|js)$/i.test(ctx.activeFile) && sourceFiles[ctx.activeFile] ? ctx.activeFile : null) ||
          Object.keys(sourceFiles).find((k) => /\.(ts|tsx|jsx|js)$/i.test(k));

        if (tsOrJsEntry) {
          const lang = detectLang(tsOrJsEntry);
          const raw = sourceFiles[tsOrJsEntry];
          const compiled =
            lang === 'ts' || lang === 'tsx' || lang === 'jsx' ? transpileTSOrJSX(raw, lang) : raw;
          const bytes = new TextEncoder().encode(compiled).length;
          if (!dryRun) {
            files['dist/bundle.js'] = compiled;
            filesMutated = true;
          }
          const ms = Math.max(1, Math.round(performance.now() - startedAt));
          write('stdout', `  dist/bundle.js  ${formatBytes(bytes)}  (from ${tsOrJsEntry})`);
          write('success', `Build succeeded in ${ms}ms.`);
          return 0;
        }

        const ms = Math.max(1, Math.round(performance.now() - startedAt));
        write('success', `Verified ${compiledCount} file(s) in ${ms}ms (no bundle output required).`);
        return 0;
      }

      if (cmd === 'dev' || cmd === 'preview' || cmd === 'serve') {
        refreshPreview = true;
        write('success', 'Development preview updated and opened.');
        return 0;
      }

      if (cmd === 'npm') {
        const sub = args[0] || '';
        if (sub === '-v' || sub === '--version') {
          write('stdout', '10.9.0');
          return 0;
        }
        if (sub === 'init') {
          const pkgObj = {
            name: sanitizeProjectName(ctx.projectName),
            version: '1.0.0',
            private: true,
            scripts: {
              dev: 'preview',
              build: 'build',
              lint: 'lint',
              format: 'format',
              test: 'lint',
            },
          };
          files['package.json'] = JSON.stringify(pkgObj, null, 2);
          filesMutated = true;
          write('success', 'Wrote package.json to workspace root.');
          return 0;
        }
        if (sub === 'ls' || sub === 'list') {
          const pkg = readPackageJson(files);
          write('info', `${pkg?.name || sanitizeProjectName(ctx.projectName)}@${pkg?.version || '1.0.0'}`);
          const scripts = pkg?.scripts || { dev: 'preview', build: 'build', lint: 'lint', format: 'format' };
          write('stdout', 'Scripts:');
          Object.entries(scripts).forEach(([k, v]) => write('stdout', `  ${k}: ${v}`));
          return 0;
        }
        if (sub === 'run' && !args[1]) {
          const pkg = readPackageJson(files);
          const scripts = {
            dev: 'preview',
            build: 'build',
            lint: 'lint',
            format: 'format',
            ...(pkg?.scripts || {}),
          };
          write('info', 'Available scripts:');
          Object.entries(scripts).forEach(([k, v]) => write('stdout', `  ${k} -> ${v}`));
          return 0;
        }

        const scriptName = sub === 'run' ? args[1] : sub;
        const pkg = readPackageJson(files);
        const customScript = pkg?.scripts?.[scriptName];
        if (customScript && !/^\s*npm\s+run\s+/.test(customScript)) {
          write('info', `> ${scriptName}: ${customScript}`);
          return await runDelegated(customScript);
        }

        if (scriptName === 'build') return await runDelegated(`build ${args.slice(sub === 'run' ? 2 : 1).join(' ')}`);
        if (scriptName === 'lint' || scriptName === 'test' || scriptName === 'check') return await runDelegated('lint');
        if (scriptName === 'format') return await runDelegated('format');
        if (scriptName === 'dev' || scriptName === 'start' || scriptName === 'preview') return await runDelegated('dev');

        write('error', `npm error Missing script: "${scriptName || sub}"`);
        return 1;
      }

      // Direct shortcut: typing a filename like `./app.js` executes it
      if (cmd.startsWith('./') || cmd.endsWith('.js') || cmd.endsWith('.ts') || cmd.endsWith('.py')) {
        const target = normalizePath(cwd, cmd);
        if (files[target] !== undefined) {
          return await runDelegated(`run ${target}`);
        }
      }

      write('error', `sh: ${cmd}: command not found. Type "help" for available commands.`);
      return 1;
    };

    const runDelegated = async (subCmd) => {
      syncFiles();
      const nested = await executeTerminalLine(
        subCmd,
        {
          ...ctx,
          files,
          virtualDirs,
          cwd,
          env,
          onUpdateFiles: (next) => {
            files = { ...next };
            filesMutated = true;
          },
        },
        depth + 1
      );
      nested.lines.forEach((l) => segOut.push(l));
      if (nested.cwd !== undefined) cwd = nested.cwd;
      if (nested.clear) clearRequested = true;
      if (nested.openFile) openFileTarget = nested.openFile;
      if (nested.refreshPreview) refreshPreview = true;
      if (nested.triggerZip) triggerZip = true;
      return nested.exitCode;
    };

    lastExitCode = await runSingle();

    // Handle output redirection (> / >>)
    if (redirect && redirect.target) {
      const targetPath = normalizePath(cwd, redirect.target);
      const textOut = segOut.map((l) => l.text).join('\n');
      if (redirect.mode === '>>' && typeof files[targetPath] === 'string' && files[targetPath]) {
        files[targetPath] = `${files[targetPath]}\n${textOut}`;
      } else {
        files[targetPath] = textOut;
      }
      filesMutated = true;
      write('muted', `wrote output to ${targetPath}`);
    } else {
      segOut.forEach((l) => out.push(l));
    }

    if (seg.op === '&&' && lastExitCode !== 0) {
      break;
    }
  }

  syncFiles();

  return {
    lines: out,
    exitCode: lastExitCode,
    cwd,
    virtualDirs,
    env,
    clear: clearRequested,
    openFile: openFileTarget,
    refreshPreview,
    triggerZip,
  };
}
