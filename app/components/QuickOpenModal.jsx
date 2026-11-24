'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { detectLang } from '../lib/workspaces';
import LanguageIcon from './LanguageIcon';
import { useI18n } from '../lib/LocaleContext';

export default function QuickOpenModal({ open, onClose, files, onSelectFile }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const fileItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.keys(files)
      .filter((p) => !q || p.toLowerCase().includes(q))
      .map((path) => ({
        path,
        lang: detectLang(path),
        action: () => onSelectFile(path),
      }));
  }, [query, files, onSelectFile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (fileItems.length ? (i + 1) % fileItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (fileItems.length ? (i - 1 + fileItems.length) % fileItems.length : 0));
      } else if (e.key === 'Enter' && fileItems[selectedIndex]) {
        e.preventDefault();
        fileItems[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, fileItems, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3.5 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-sky-500 shrink-0" />
          <input
            autoFocus
            dir="ltr"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t('quickOpenPlaceholder')}
            className="flex-1 bg-transparent text-sm font-mono text-slate-900 dark:text-slate-100 outline-none"
          />
          <span className="text-[11px] font-mono text-slate-400">Ctrl+P</span>
        </div>

        <div className="max-h-80 overflow-auto p-1.5 space-y-0.5" dir="ltr">
          {fileItems.length ? (
            fileItems.map((item, idx) => (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                  idx === selectedIndex
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <LanguageIcon lang={item.lang} size={15} />
                  <span className="truncate">{item.path}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{t('quickOpenHint')}</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">{t('noMatchingFiles')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
