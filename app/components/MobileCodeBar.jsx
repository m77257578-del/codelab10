'use client';

import { useMemo, useState } from 'react';
import { Undo2, Redo2, ChevronLeft, ChevronRight, Sparkles, Grid2X2, X, IndentIncrease } from 'lucide-react';
import { getMobileBarConfig } from '../lib/completions';

export default function MobileCodeBar({ lang, editorApiRef }) {
  const [expanded, setExpanded] = useState(false);
  const config = useMemo(() => getMobileBarConfig(lang), [lang]);

  const keepFocus = (e) => {
    e.preventDefault();
  };

  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0f172a] select-none z-20">
      {/* Expandable full tags / properties drawer for the active language */}
      {expanded && (
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] p-2 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              وسوم وخصائص {lang.toUpperCase()} ({config.quickItems.length})
            </span>
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => setExpanded(false)}
              aria-label="إغلاق القائمة"
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

      {/* Row 1: Language-specific tags / properties / snippets */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-200/80 dark:border-slate-800/80 overflow-x-auto"
        dir="ltr"
      >
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => setExpanded((v) => !v)}
          className={`inline-flex items-center gap-1 px-2.5 h-8 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
            expanded
              ? 'bg-sky-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Grid2X2 className="w-3.5 h-3.5" />
          <span>{config.quickItems.length}+</span>
        </button>

        {config.quickItems.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.detail}
            onMouseDown={keepFocus}
            onClick={() => editorApiRef.current?.insertSnippet(item.tpl)}
            className="h-8 px-2.5 rounded-md font-mono text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 active:bg-sky-600 active:text-white whitespace-nowrap shrink-0 transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Row 2: Essential navigation + coding symbols right above phone keyboard */}
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto" dir="ltr">
        <button
          type="button"
          title="إكمال تلقائي"
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.triggerAutocomplete()}
          className="h-9 px-2.5 rounded-md bg-sky-600 text-white text-xs font-medium inline-flex items-center gap-1 shrink-0 active:bg-sky-500"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>إكمال</span>
        </button>

        <button
          type="button"
          title="Tab"
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.indent()}
          className="h-9 px-2.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono inline-flex items-center gap-1 shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <IndentIncrease className="w-3.5 h-3.5" />
          <span>Tab</span>
        </button>

        <button
          type="button"
          title="تراجع"
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.undo()}
          className="h-9 w-9 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="إعادة"
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.redo()}
          className="h-9 w-9 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="تحريك المؤشر يساراً"
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.moveCursor(-1)}
          className="h-9 w-9 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="تحريك المؤشر يميناً"
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.moveCursor(1)}
          className="h-9 w-9 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="تعليق السطر"
          onMouseDown={keepFocus}
          onClick={() => editorApiRef.current?.toggleComment()}
          className="h-9 px-2.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono text-xs font-semibold shrink-0 active:bg-slate-200 dark:active:bg-slate-700"
        >
          //
        </button>

        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

        {config.symbols.map((sym) => (
          <button
            key={sym}
            type="button"
            onMouseDown={keepFocus}
            onClick={() => editorApiRef.current?.insertSymbol(sym)}
            className="h-9 min-w-[36px] px-2.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-sm font-semibold shrink-0 active:bg-sky-600 active:text-white transition-colors"
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
