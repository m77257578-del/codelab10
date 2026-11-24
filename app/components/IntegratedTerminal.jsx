'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Hammer, Play, ShieldCheck, Trash2 } from 'lucide-react';
import { executeTerminalLine, getTerminalCompletions } from '../lib/terminalEngine';
import { sanitizeProjectName } from '../lib/storage';

export default function IntegratedTerminal({
  projectName,
  files,
  activeFile,
  onUpdateFiles,
  onOpenFile,
  onRefreshPreview,
  onExportZip,
}) {
  const [entries, setEntries] = useState([
    {
      id: 'welcome',
      level: 'info',
      text: 'CodeLab Terminal ready — type "help", "npm run build", "lint", "node app.js", or "python main.py".',
    },
  ]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('');
  const [virtualDirs, setVirtualDirs] = useState(() => new Set());
  const [envVars, setEnvVars] = useState({});
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [running, setRunning] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, running]);

  const promptLabel = `codelab:~/${sanitizeProjectName(projectName)}${cwd ? `/${cwd}` : ''}$`;

  const runCommand = useCallback(
    async (rawCmd) => {
      const cmd = String(rawCmd || '').trim();
      if (!cmd || running) return;

      const stamp = Date.now();
      setEntries((prev) => [
        ...prev,
        { id: `cmd-${stamp}-${Math.random()}`, level: 'prompt', prompt: promptLabel, text: cmd },
      ]);
      setHistory((prev) => (prev[prev.length - 1] === cmd ? prev : [...prev.slice(-49), cmd]));
      setHistoryIdx(-1);
      setInput('');
      setRunning(true);

      try {
        const res = await executeTerminalLine(cmd, {
          projectName,
          files,
          activeFile,
          cwd,
          virtualDirs,
          env: envVars,
          history,
          onUpdateFiles,
        });

        if (res.clear) {
          setEntries([]);
        } else if (res.lines.length > 0) {
          setEntries((prev) => [
            ...prev,
            ...res.lines.map((l, idx) => ({
              id: `out-${stamp}-${idx}-${Math.random()}`,
              level: l.level,
              text: l.text,
            })),
          ]);
        }

        if (res.cwd !== undefined) setCwd(res.cwd);
        if (res.virtualDirs) setVirtualDirs(res.virtualDirs);
        if (res.env) setEnvVars(res.env);
        if (res.openFile) onOpenFile?.(res.openFile);
        if (res.refreshPreview) onRefreshPreview?.();
        if (res.triggerZip) onExportZip?.();
      } catch (err) {
        setEntries((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, level: 'error', text: String(err?.message || err) },
        ]);
      } finally {
        setRunning(false);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    },
    [
      running,
      promptLabel,
      projectName,
      files,
      activeFile,
      cwd,
      virtualDirs,
      envVars,
      history,
      onUpdateFiles,
      onOpenFile,
      onRefreshPreview,
      onExportZip,
    ]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInput(history[nextIdx]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      if (historyIdx >= history.length - 1) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx]);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const candidates = getTerminalCompletions(input, files, cwd);
      if (candidates.length === 1) {
        const match = candidates[0];
        const parts = input.split(/(\s+)/);
        if (parts.length > 0 && !/\s+$/.test(input)) {
          parts[parts.length - 1] = match;
          setInput(parts.join(''));
        } else {
          setInput(input + match);
        }
      } else if (candidates.length > 1) {
        setEntries((prev) => [
          ...prev,
          { id: `cmp-${Date.now()}`, level: 'muted', text: candidates.join('   ') },
        ]);
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setEntries([]);
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      setEntries((prev) => [
        ...prev,
        { id: `cc-${Date.now()}`, level: 'prompt', prompt: promptLabel, text: `${input}^C` },
      ]);
      setInput('');
    }
  };

  const renderLineText = (entry) => {
    // Allow clicking file:line references from lint/build/grep output
    const match = entry.text.match(/^\s*([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+):(\d+)\b(.*)$/);
    if (match && files[match[1]] !== undefined) {
      const [, filePath, lineNo, rest] = match;
      return (
        <span className="whitespace-pre-wrap break-words">
          <button
            type="button"
            onClick={() => onOpenFile?.(filePath, Number(lineNo))}
            className="underline decoration-dotted hover:text-sky-400 font-semibold"
          >
            {filePath}:{lineNo}
          </button>
          {rest}
        </span>
      );
    }
    return <pre className="whitespace-pre-wrap break-words font-mono m-0">{entry.text}</pre>;
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col bg-[#080d17] text-slate-200 font-mono text-xs"
      dir="ltr"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Quick Build & Script Bar */}
      <div
        className="h-7 shrink-0 flex items-center justify-between gap-2 px-2.5 border-b border-slate-800/80 bg-[#0b1220] overflow-x-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={running}
            onClick={() => runCommand('npm run build')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 transition-colors"
          >
            <Hammer className="w-3 h-3" />
            <span>npm run build</span>
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => runCommand('lint')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>lint</span>
          </button>
          <button
            type="button"
            disabled={running || !activeFile}
            onClick={() => runCommand(`run ${activeFile}`)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 disabled:opacity-40 transition-colors"
          >
            <Play className="w-3 h-3" />
            <span>run {activeFile?.split('/').pop()}</span>
          </button>
        </div>

        <button
          type="button"
          title="Clear terminal (Ctrl+L)"
          onClick={() => setEntries([])}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 shrink-0"
        >
          <Trash2 className="w-3 h-3" />
          <span>clear</span>
        </button>
      </div>

      {/* Scrollable Terminal Buffer */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-2.5 space-y-1 leading-5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={
              entry.level === 'prompt'
                ? 'flex items-baseline gap-2 text-slate-100'
                : entry.level === 'error'
                  ? 'text-rose-400'
                  : entry.level === 'warn'
                    ? 'text-amber-300'
                    : entry.level === 'success'
                      ? 'text-emerald-400'
                      : entry.level === 'info'
                        ? 'text-sky-300'
                        : entry.level === 'muted'
                          ? 'text-slate-500'
                          : 'text-slate-200'
            }
          >
            {entry.level === 'prompt' ? (
              <>
                <span className="text-emerald-400 font-semibold shrink-0">{entry.prompt}</span>
                <span className="break-all">{entry.text}</span>
              </>
            ) : (
              renderLineText(entry)
            )}
          </div>
        ))}
        {running && <div className="text-sky-400 animate-pulse">Executing...</div>}
      </div>

      {/* Interactive Command Prompt */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runCommand(input);
        }}
        className="h-8 shrink-0 flex items-center gap-2 px-2.5 border-t border-slate-800 bg-[#060a12]"
      >
        <span className="text-emerald-400 font-semibold shrink-0 select-none">{promptLabel}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Type a command (e.g. npm run build, node app.js, ls, help)..."
          className="flex-1 min-w-0 bg-transparent text-slate-100 placeholder:text-slate-600 outline-none"
        />
      </form>
    </div>
  );
}
