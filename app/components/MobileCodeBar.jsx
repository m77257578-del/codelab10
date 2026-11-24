'use client';

import { useMemo, useState } from 'react';
import { Undo2, Redo2, ChevronLeft, ChevronRight, Braces, Grid2X2, X, IndentIncrease, ChevronUp, ChevronDown } from 'lucide-react';
import { getMobileBarConfig } from '../lib/completions';
import { useI18n } from '../lib/LocaleContext';

export default function MobileCodeBar({ lang, editorApiRef, compact = false }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [showQuickStrip, setShowQuickStrip] = useState(false);
  const config = useMemo(() => getMobileBarConfig(lang), [lang]);

  const keepFocus = (e) => {
    e.preventDefault();
  };

  const stripVisible = !compact || showQuickStrip;

  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0f172a] select-none z-20">
      {/* Expandable full tags / properties drawer for the active language */}
      {expanded && (
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-2.5 max-h-44 overflow-y-auto">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {t('langTagsHeader', lang.toUpperCase(), config.quickItems.length)}
            </span>
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => setExpanded(false)}
              aria-label={t('closeListAria')}
              className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" dir="ltr">
            {config.quickItems.map((item) => (
              <button
                key={`${item.label}-${item.detail}`}
                type="button"
                onMouseDown={keepFocus}
                onClick={() => {
                  editorApiRef.current?.insertSnippet(item.tpl);
                  setExpanded(false);
                }}
                className="flex flex-col items-start px-2.5 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-500 active:bg-sky-500/15 text-left transition-colors min-h-[40px]"
              >
                <span className="text-xs font-mono font-semibold text-sky-700 dark:text-sky-300 truncate w-full">
                  {item.label}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full">{item.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Optional Row 1: Language-specific tags / properties / snippets (auto-hidden when typing to maximize editor visibility) */}
      {stripVisible && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 border-b border-slate-200/70 dark:border-slate-800/70 overflow-x-auto no-scrollbar"
          dir="ltr"
        >
          {config.quickItems.map((item) => (
            <button
              key={item.label}
              type="button"
              title={item.detail}
              onMouseDown={keepFocus}
              onClick={() => editorApiRef.current?.insertSnippet(item.tpl)}
              className="h-7 px-2 rounded-md font-mono text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 active:bg-sky-600 active:text-white whitespace-nowrap shrink-0 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Compact Single Row: Tags drawer, Autocomplete, Navigation & Symbols */}
      <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto no-scrollbar" dir="ltr">
        <button
          type="button"
          title={t('langTagsBtnTitle')}
          onMouseDown={keepFocus}
          onClick={() => setExpanded((v) => !v)}
          className={`inline-flex items-center gap-1 px-2 h-8 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
            expanded
              ? 'bg-sky-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Grid2X2 className="w-3.5 h-3.5" />
          <span>{config.quickItems.length}+</span>
        </button>

        {compact && (
          <button
            type="button"
            title={showQuickStrip ? t('hideQuickStripTitle') : t('showQuickStripTitle')}
            onMouseDown={keepFocus}
            onClick={() => setShowQuickStrip((v) => !v)}
            className="h-8 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 grid place-items-center shrink-0"
          >
            {showQuickStrip ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          title={t('autocompleteTitle')}
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.triggerAutocomplete()}
          className="h-8 px-2 rounded-md bg-sky-600 text-white text-[11px] font-medium inline-flex items-center gap-1 shrink-0 active:bg-sky-500"
        >
          <Braces className="w-3.5 h-3.5" />
          <span>{t('autocompleteBtn')}</span>
        </button>

        <button
          type="button"
          title="Tab"
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.indent()}
          className="h-8 px-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono inline-flex items-center gap-1 shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <IndentIncrease className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          title={t('undoTitle')}
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.undo()}
          className="h-8 w-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          title={t('redoTitle')}
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.redo()}
          className="h-8 w-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          title={t('moveCursorLeftTitle')}
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.moveCursor(-1)}
          className="h-8 w-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          title={t('moveCursorRightTitle')}
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.moveCursor(1)}
          className="h-8 w-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

        {config.symbols.map((sym) => (
          <button
            key={sym}
            type="button"
            onMouseDown={keepFocus}
            onClick={() => editorApiRef.current?.insertSymbol(sym)}
            className="h-8 min-w-[32px] px-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-xs font-semibold shrink-0 active:bg-sky-600 active:text-white transition-colors"
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
