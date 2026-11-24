'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import CodeMinimap from './CodeMinimap';
import { getMobileBarConfig } from '../lib/completions';
import CodeMirror from '@uiw/react-codemirror';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, keymap } from '@codemirror/view';
import {
  copyLineDown,
  copyLineUp,
  deleteLine,
  indentMore,
  indentWithTab,
  moveLineDown,
  moveLineUp,
  redo,
  toggleComment,
  undo,
} from '@codemirror/commands';
import { acceptCompletion, autocompletion, snippet, startCompletion } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
  selectNextOccurrence,
  selectSelectionMatches,
} from '@codemirror/search';
import { linter, lintGutter, lintKeymap } from '@codemirror/lint';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sass } from '@codemirror/lang-sass';
import { javascript, javascriptLanguage, scopeCompletionSource } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';

import { csharp, kotlin, scala, dart } from '@codemirror/legacy-modes/mode/clike';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { r } from '@codemirror/legacy-modes/mode/r';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { erlang } from '@codemirror/legacy-modes/mode/erlang';
import { julia } from '@codemirror/legacy-modes/mode/julia';
import { groovy } from '@codemirror/legacy-modes/mode/groovy';
import { clojure } from '@codemirror/legacy-modes/mode/clojure';
import { gas } from '@codemirror/legacy-modes/mode/gas';
import { pascal } from '@codemirror/legacy-modes/mode/pascal';
import { fortran } from '@codemirror/legacy-modes/mode/fortran';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { stex } from '@codemirror/legacy-modes/mode/stex';

import { diagnose } from '../lib/diagnostics';
import { createLanguageCompletionSource } from '../lib/completions';
import { useI18n } from '../lib/LocaleContext';

function getLangExtension(lang) {
  switch (lang) {
    case 'html':
      return html({ autoCloseTags: true, matchClosingTags: true });
    case 'css':
      return css();
    case 'scss':
      return sass();
    case 'js':
      return typeof window !== 'undefined'
        ? [javascript({ jsx: true }), javascriptLanguage.data.of({ autocomplete: scopeCompletionSource(window) })]
        : javascript({ jsx: true });
    case 'jsx':
      return javascript({ jsx: true });
    case 'ts':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'python':
      return python();
    case 'c':
    case 'cpp':
      return cpp();
    case 'java':
      return java();
    case 'rust':
      return rust();
    case 'go':
      return go();
    case 'php':
      return php();
    case 'sql':
      return sql({ upperCaseKeywords: true });
    case 'xml':
    case 'svg':
      return xml();
    case 'yaml':
      return yaml();
    case 'json':
      return json();
    case 'markdown':
      return markdown();
    case 'csharp':
      return StreamLanguage.define(csharp);
    case 'kotlin':
      return StreamLanguage.define(kotlin);
    case 'scala':
      return StreamLanguage.define(scala);
    case 'dart':
      return StreamLanguage.define(dart);
    case 'ruby':
      return StreamLanguage.define(ruby);
    case 'swift':
      return StreamLanguage.define(swift);
    case 'bash':
      return StreamLanguage.define(shell);
    case 'powershell':
      return StreamLanguage.define(powerShell);
    case 'lua':
      return StreamLanguage.define(lua);
    case 'r':
      return StreamLanguage.define(r);
    case 'perl':
      return StreamLanguage.define(perl);
    case 'haskell':
      return StreamLanguage.define(haskell);
    case 'erlang':
      return StreamLanguage.define(erlang);
    case 'julia':
      return StreamLanguage.define(julia);
    case 'groovy':
      return StreamLanguage.define(groovy);
    case 'clojure':
      return StreamLanguage.define(clojure);
    case 'asm':
      return StreamLanguage.define(gas);
    case 'pascal':
      return StreamLanguage.define(pascal);
    case 'fortran':
      return StreamLanguage.define(fortran);
    case 'toml':
      return StreamLanguage.define(toml);
    case 'dockerfile':
      return StreamLanguage.define(dockerFile);
    case 'nginx':
      return StreamLanguage.define(nginx);
    case 'latex':
      return StreamLanguage.define(stex);
    default:
      return [];
  }
}

function createIndentGuides(tabSize = 2) {
  const step = Math.max(2, tabSize || 2);
  const guideMark = Decoration.mark({ class: 'cm-indent-guide' });

  const buildGuides = (view) => {
    const builder = new RangeSetBuilder();
    const seenLines = new Set();
    for (const { from, to } of view.visibleRanges) {
      let pos = from;
      while (pos <= to) {
        const line = view.state.doc.lineAt(pos);
        if (!seenLines.has(line.number)) {
          seenLines.add(line.number);
          const match = line.text.match(/^[ ]+/);
          if (match) {
            const len = match[0].length;
            for (let i = 0; i + step <= len; i += step) {
              builder.add(line.from + i, line.from + i + step, guideMark);
            }
          }
        }
        if (line.to >= to) break;
        pos = line.to + 1;
      }
    }
    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildGuides(view);
      }
      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildGuides(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}

// Authentic VS Code Dark+ Syntax Highlighting
const darkHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#6A9955', fontStyle: 'italic' },
  { tag: [t.controlKeyword, t.moduleKeyword], color: '#C586C0' },
  { tag: [t.keyword, t.operatorKeyword, t.definitionKeyword], color: '#569CD6' },
  { tag: [t.operator, t.punctuation, t.separator], color: '#D4D4D4' },
  { tag: [t.string, t.special(t.string)], color: '#CE9178' },
  { tag: [t.regexp], color: '#D16969' },
  { tag: [t.number, t.integer, t.float, t.unit], color: '#B5CEA8' },
  { tag: [t.bool, t.null, t.atom], color: '#569CD6' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#DCDCAA' },
  { tag: [t.definition(t.variableName), t.variableName], color: '#9CDCFE' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: '#9CDCFE' },
  { tag: [t.className, t.typeName, t.namespace], color: '#4EC9B0' },
  { tag: [t.tagName], color: '#569CD6' },
  { tag: [t.angleBracket], color: '#808080' },
  { tag: [t.attributeName], color: '#9CDCFE' },
  { tag: [t.attributeValue], color: '#CE9178' },
  { tag: [t.color], color: '#CE9178' },
  { tag: [t.heading], color: '#569CD6', fontWeight: '600' },
  { tag: [t.invalid], color: '#F44747', textDecoration: 'underline' },
]);

// Authentic VS Code Light+ Syntax Highlighting
const lightHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#008000', fontStyle: 'italic' },
  { tag: [t.controlKeyword, t.moduleKeyword], color: '#AF00DB' },
  { tag: [t.keyword, t.operatorKeyword, t.definitionKeyword], color: '#0000FF' },
  { tag: [t.operator, t.punctuation, t.separator], color: '#000000' },
  { tag: [t.string, t.special(t.string)], color: '#A31515' },
  { tag: [t.regexp], color: '#811F3F' },
  { tag: [t.number, t.integer, t.float, t.unit], color: '#098658' },
  { tag: [t.bool, t.null, t.atom], color: '#0000FF' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#795E26' },
  { tag: [t.definition(t.variableName), t.variableName], color: '#001080' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: '#001080' },
  { tag: [t.className, t.typeName, t.namespace], color: '#267F99' },
  { tag: [t.tagName], color: '#800000' },
  { tag: [t.angleBracket], color: '#800000' },
  { tag: [t.attributeName], color: '#E50000' },
  { tag: [t.attributeValue], color: '#0000FF' },
  { tag: [t.color], color: '#0451A5' },
  { tag: [t.heading], color: '#800000', fontWeight: '600' },
  { tag: [t.invalid], color: '#CD3131', textDecoration: 'underline' },
]);

const lightEditorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#ffffff', color: '#000000' },
    '.cm-content': { caretColor: '#000000' },
    '.cm-gutters': { backgroundColor: '#ffffff', color: '#237893', borderRight: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.03)', outline: '1px solid rgba(0, 0, 0, 0.04)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#0b216f', fontWeight: '600' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#add6ff' },
    '.cm-tooltip': { backgroundColor: '#f3f3f3', border: '1px solid #c8c8c8', color: '#333333', borderRadius: '3px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.14)' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#0060c0', color: '#ffffff' },
  },
  { dark: false }
);

const darkEditorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#1e1e1e', color: '#d4d4d4' },
    '.cm-content': { caretColor: '#aeafad' },
    '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#858585', borderRight: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.04)', outline: '1px solid #282828' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#c6c6c6' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#264f78' },
    '.cm-tooltip': { backgroundColor: '#252526', border: '1px solid #454545', color: '#cccccc', borderRadius: '3px', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#04395e', color: '#ffffff' },
  },
  { dark: true }
);

const PAIR_MAP = {
  '(': '()',
  '[': '[]',
  '{': '{}',
  '"': '""',
  "'": "''",
  '`': '``',
};

export default function CodeEditorPane({
  value,
  onChange,
  lang,
  files,
  theme,
  fontSize,
  tabSize,
  wordWrap,
  showMinimap = true,
  onCursorChange,
  onFocusChange,
  editorRefOut,
  onRunShortcut,
}) {
  const { locale, t } = useI18n();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [minimapViewport, setMinimapViewport] = useState({ firstVisibleLine: 1, lastVisibleLine: 30 });
  const [activeLine, setActiveLine] = useState(1);
  const config = useMemo(() => getMobileBarConfig(lang), [lang]);
  const viewRef = useRef(null);
  const scrollCleanupRef = useRef(null);
  const rafRef = useRef(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const cursorCbRef = useRef(onCursorChange);
  cursorCbRef.current = onCursorChange;
  const focusCbRef = useRef(onFocusChange);
  focusCbRef.current = onFocusChange;
  const runCbRef = useRef(onRunShortcut);
  runCbRef.current = onRunShortcut;

  const minimapDiagnostics = useMemo(
    () => diagnose(typeof value === 'string' ? value : '', lang, locale),
    [value, lang, locale]
  );

  const scheduleViewportSync = useCallback((view) => {
    if (!view || typeof requestAnimationFrame === 'undefined') return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const scrollDOM = view.scrollDOM;
      if (!scrollDOM) return;
      const doc = view.state.doc;
      const topBlock = view.lineBlockAtHeight(Math.max(0, scrollDOM.scrollTop));
      const bottomY = Math.max(scrollDOM.scrollTop + 1, scrollDOM.scrollTop + scrollDOM.clientHeight - 4);
      const bottomBlock = view.lineBlockAtHeight(bottomY);
      const firstVisibleLine = doc.lineAt(topBlock.from).number;
      const lastVisibleLine = doc.lineAt(bottomBlock.to).number;
      setMinimapViewport((prev) =>
        prev.firstVisibleLine === firstVisibleLine && prev.lastVisibleLine === lastVisibleLine
          ? prev
          : { firstVisibleLine, lastVisibleLine }
      );
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      scrollCleanupRef.current?.();
    };
  }, []);

  const extensions = useMemo(() => {
    const langExt = getLangExtension(lang);
    const completionSource = createLanguageCompletionSource(lang, filesRef);

    const localLinter = linter(
      (view) => {
        const text = view.state.doc.toString();
        const issues = diagnose(text, lang, locale);
        const totalLines = view.state.doc.lines;
        return issues.map((item) => {
          const lineNum = Math.min(Math.max(1, item.line || 1), totalLines);
          const lineInfo = view.state.doc.line(lineNum);
          return {
            from: lineInfo.from,
            to: Math.max(lineInfo.from, lineInfo.to),
            severity: item.severity === 'warning' ? 'warning' : 'error',
            message: `${item.why} — ${item.fix}`,
          };
        });
      },
      { delay: 350 }
    );

    const exts = [
      langExt,
      EditorState.languageData.of(() => [{ autocomplete: completionSource }]),
      autocompletion({
        activateOnTyping: true,
        activateOnTypingDelay: 50,
        icons: true,
        maxRenderedOptions: 25,
        closeOnBlur: false,
        defaultKeymap: true,
      }),
      syntaxHighlighting(theme === 'dark' ? darkHighlightStyle : lightHighlightStyle),
      indentUnit.of(' '.repeat(tabSize)),
      createIndentGuides(tabSize),
      search({ top: true }),
      highlightSelectionMatches({ minSelectionLength: 2, wholeWords: true }),
      lintGutter(),
      localLinter,
      keymap.of([
        { key: 'Tab', run: acceptCompletion },
        indentWithTab,
        { key: 'Ctrl-Space', run: startCompletion },
        { key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
        { key: 'Mod-Shift-l', run: selectSelectionMatches, preventDefault: true },
        { key: 'Alt-ArrowUp', run: moveLineUp, preventDefault: true },
        { key: 'Alt-ArrowDown', run: moveLineDown, preventDefault: true },
        { key: 'Shift-Alt-ArrowUp', run: copyLineUp, preventDefault: true },
        { key: 'Shift-Alt-ArrowDown', run: copyLineDown, preventDefault: true },
        { key: 'Mod-Shift-k', run: deleteLine, preventDefault: true },
        { key: 'Mod-/', run: toggleComment, preventDefault: true },
        ...searchKeymap,
        ...lintKeymap,
        {
          key: 'Mod-Enter',
          run: () => {
            runCbRef.current?.();
            return true;
          },
        },
      ]),
      EditorView.scrollMargins.of(() => ({ top: 24, bottom: 32 })),
      EditorView.domEventHandlers({
        focus: () => {
          focusCbRef.current?.(true);
        },
        blur: () => {
          focusCbRef.current?.(false);
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          const selected = Math.abs(update.state.selection.main.to - update.state.selection.main.from);
          setActiveLine(line.number);
          cursorCbRef.current?.({
            line: line.number,
            col: head - line.from + 1,
            selected,
            lines: update.state.doc.lines,
          });
        }
        if (update.docChanged || update.viewportChanged || update.geometryChanged) {
          scheduleViewportSync(update.view);
        }
      }),
      EditorView.theme({
        '&': { fontSize: `${fontSize}px`, height: '100%' },
        '.cm-scroller': { fontSize: `${fontSize}px` },
      }),
    ];

    if (wordWrap) {
      exts.push(EditorView.lineWrapping);
    }
    return exts;
  }, [lang, locale, theme, fontSize, tabSize, wordWrap, scheduleViewportSync]);

  useEffect(() => {
    if (editorRefOut) {
      editorRefOut.current = {
        openFind: () => {
          if (viewRef.current) {
            viewRef.current.focus();
            openSearchPanel(viewRef.current);
          }
        },
        jumpToLine: (lineNum) => {
          const v = viewRef.current;
          if (!v) return;
          const safe = Math.min(Math.max(1, lineNum || 1), v.state.doc.lines);
          const line = v.state.doc.line(safe);
          v.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
          });
          v.focus();
        },
        focus: () => viewRef.current?.focus(),
        blur: () => viewRef.current?.contentDOM?.blur(),
        triggerAutocomplete: () => {
          const v = viewRef.current;
          if (!v) return;
          v.focus();
          startCompletion(v);
        },
        undo: () => {
          const v = viewRef.current;
          if (!v) return;
          undo(v);
          v.focus();
        },
        redo: () => {
          const v = viewRef.current;
          if (!v) return;
          redo(v);
          v.focus();
        },
        toggleComment: () => {
          const v = viewRef.current;
          if (!v) return;
          toggleComment(v);
          v.focus();
        },
        indent: () => {
          const v = viewRef.current;
          if (!v) return;
          indentMore(v);
          v.focus();
        },
        moveCursor: (delta) => {
          const v = viewRef.current;
          if (!v) return;
          const { head } = v.state.selection.main;
          const next = Math.min(Math.max(0, head + delta), v.state.doc.length);
          v.dispatch({
            selection: { anchor: next },
            effects: EditorView.scrollIntoView(next),
          });
          v.focus();
        },
        insertSymbol: (sym) => {
          const v = viewRef.current;
          if (!v) return;
          const { from, to } = v.state.selection.main;
          const paired = from === to && PAIR_MAP[sym];
          if (paired) {
            v.dispatch({
              changes: { from, to, insert: paired },
              selection: { anchor: from + 1 },
              effects: EditorView.scrollIntoView(from + 1),
            });
          } else {
            v.dispatch({
              changes: { from, to, insert: sym },
              selection: { anchor: from + sym.length },
              effects: EditorView.scrollIntoView(from + sym.length),
            });
          }
          v.focus();
        },
        insertSnippet: (tpl) => {
          const v = viewRef.current;
          if (!v) return;
          const { from, to } = v.state.selection.main;
          const fn = snippet(tpl);
          fn(v, null, from, to);
          v.focus();
        },
      };
    }
  }, [editorRefOut]);

  return (
    <div
      className="h-full w-full overflow-hidden bg-white dark:bg-[#1e1e1e] flex flex-col"
      dir="ltr"
    >
      {showShortcuts && (
        <div className="shrink-0 bg-slate-100 dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 p-2 flex items-center justify-between gap-2 z-10 select-none">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 px-1 whitespace-nowrap">
              {t('shortcutsPrefix', lang.toUpperCase())}
            </span>
            {config.symbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  editorRefOut?.current?.insertSymbol?.(sym);
                }}
                className="h-7 min-w-[28px] px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-xs font-semibold shrink-0 hover:bg-sky-600 hover:text-white transition-colors"
              >
                {sym}
              </button>
            ))}
            {config.quickItems.slice(0, 10).map((item) => (
              <button
                key={item.label}
                type="button"
                title={item.detail}
                onClick={() => {
                  editorRefOut?.current?.insertSnippet?.(item.tpl);
                }}
                className="h-7 px-2 rounded font-mono text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 hover:bg-sky-600 hover:text-white whitespace-nowrap shrink-0 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowShortcuts(false)}
            title={t('hideShortcutsTitle')}
            className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0">
          <CodeMirror
            value={typeof value === 'string' ? value : ''}
            height="100%"
            className="h-full"
            theme={theme === 'dark' ? darkEditorTheme : lightEditorTheme}
            extensions={extensions}
            onChange={onChange}
            onCreateEditor={(view) => {
              viewRef.current = view;
              scrollCleanupRef.current?.();
              const onScroll = () => scheduleViewportSync(view);
              view.scrollDOM.addEventListener('scroll', onScroll, { passive: true });
              scrollCleanupRef.current = () => {
                view.scrollDOM?.removeEventListener('scroll', onScroll);
              };
              scheduleViewportSync(view);
            }}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: false,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
            tabSize,
          }}
        />
        </div>
        {showMinimap && (
          <CodeMinimap
            code={typeof value === 'string' ? value : ''}
            theme={theme}
            viewport={minimapViewport}
            activeLine={activeLine}
            diagnostics={minimapDiagnostics}
            onScrollToRatio={(ratio) => {
              const v = viewRef.current;
              if (!v?.scrollDOM) return;
              const maxScroll = Math.max(0, v.scrollDOM.scrollHeight - v.scrollDOM.clientHeight);
              v.scrollDOM.scrollTop = Math.round(ratio * maxScroll);
              scheduleViewportSync(v);
            }}
            onWheelScroll={(deltaY) => {
              const v = viewRef.current;
              if (!v?.scrollDOM) return;
              v.scrollDOM.scrollTop += deltaY;
            }}
          />
        )}
      </div>
    </div>
  );
}
