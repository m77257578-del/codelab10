'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileCode2, Terminal, Search } from 'lucide-react';

export default function CommandPalette({ open, onClose, files, onSelectFile, commands }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fileItems = Object.keys(files)
      .filter((p) => !q || p.toLowerCase().includes(q))
      .map((path) => ({
        id: `file:${path}`,
        kind: 'file',
        label: path,
        hint: 'فتح الملف',
        action: () => onSelectFile(path),
      }));
    const cmdItems = commands
      .filter((c) => !q || c.label.toLowerCase().includes(q) || (c.shortcut || '').toLowerCase().includes(q))
      .map((c) => ({
        id: `cmd:${c.id}`,
        kind: 'cmd',
        label: c.label,
        hint: c.shortcut || '',
        action: c.action,
      }));
    return [...cmdItems, ...fileItems];
  }, [query, files, commands, onSelectFile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (items.length ? (i + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="اكتب اسم ملف أو أمر..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 outline-none"
          />
          <span className="text-[11px] font-mono text-slate-400">Esc</span>
        </div>

        <div className="max-h-80 overflow-auto p-1.5 space-y-0.5">
          {items.length ? (
            items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-start transition-colors ${
                  idx === selectedIndex
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.kind === 'file' ? (
                    <FileCode2 className="w-4 h-4 text-sky-500 shrink-0" />
                  ) : (
                    <Terminal className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className={`truncate ${item.kind === 'file' ? 'font-mono text-xs' : ''}`} dir={item.kind === 'file' ? 'ltr' : 'rtl'}>
                    {item.label}
                  </span>
                </div>
                {item.hint && <span className="text-xs font-mono text-slate-400 shrink-0">{item.hint}</span>}
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-6">لا توجد نتائج مطابقة</p>
          )}
        </div>
      </div>
    </div>
  );
}
