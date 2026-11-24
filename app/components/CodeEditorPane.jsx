'use client';

import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab, indentMore, redo, toggleComment, undo } from '@codemirror/commands';
import { autocompletion, snippet, startCompletion } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { search, searchKeymap, openSearchPanel } from '@codemirror/search';
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
      return sql();
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

const darkHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword, t.definitionKeyword], color: '#c084fc' },
  { tag: [t.operator, t.punctuation, t.separator], color: '#94a3b8' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#34d399' },
  { tag: [t.number, t.integer, t.float, t.unit], color: '#fb923c' },
  { tag: [t.bool, t.null, t.atom], color: '#f472b6' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#38bdf8' },
  { tag: [t.definition(t.variableName), t.variableName], color: '#e2e8f0' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: '#7dd3fc' },
  { tag: [t.className, t.typeName, t.namespace], color: '#fbbf24' },
  { tag: [t.tagName, t.angleBracket], color: '#f87171' },
  { tag: [t.attributeName], color: '#fbbf24' },
  { tag: [t.attributeValue], color: '#34d399' },
  { tag: [t.color], color: '#f472b6' },
  { tag: [t.heading], color: '#38bdf8', fontWeight: '600' },
  { tag: [t.invalid], color: '#ef4444', textDecoration: 'underline' },
]);

const lightHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword, t.definitionKeyword], color: '#7c3aed' },
  { tag: [t.operator, t.punctuation, t.separator], color: '#475569' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#059669' },
  { tag: [t.number, t.integer, t.float, t.unit], color: '#c2410c' },
  { tag: [t.bool, t.null, t.atom], color: '#be185d' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#0284c7' },
  { tag: [t.definition(t.variableName), t.variableName], color: '#0f172a' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: '#0369a1' },
  { tag: [t.className, t.typeName, t.namespace], color: '#b45309' },
  { tag: [t.tagName, t.angleBracket], color: '#dc2626' },
  { tag: [t.attributeName], color: '#b45309' },
  { tag: [t.attributeValue], color: '#059669' },
  { tag: [t.color], color: '#be185d' },
  { tag: [t.heading], color: '#0284c7', fontWeight: '600' },
  { tag: [t.invalid], color: '#dc2626', textDecoration: 'underline' },
]);

const lightEditorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#ffffff', color: '#0f172a' },
    '.cm-content': { caretColor: '#0284c7' },
    '.cm-gutters': { backgroundColor: '#f8fafc', color: '#64748b', borderRight: '1px solid #e2e8f0' },
    '.cm-activeLine': { backgroundColor: 'rgba(14, 165, 233, 0.06)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0f172a' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(14, 165, 233, 0.18)' },
    '.cm-tooltip': { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '8px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#0284c7', color: '#ffffff' },
  },
  { dark: false }
);

const darkEditorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#0b1120', color: '#e2e8f0' },
    '.cm-content': { caretColor: '#38bdf8' },
    '.cm-gutters': { backgroundColor: '#0f172a', color: '#64748b', borderRight: '1px solid #1e293b' },
    '.cm-activeLine': { backgroundColor: 'rgba(56, 189, 248, 0.06)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(56, 189, 248, 0.12)', color: '#e2e8f0' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(56, 189, 248, 0.22)' },
    '.cm-tooltip': { backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '8px', boxShadow: '0 12px 32px rgba(2, 6, 23, 0.55)' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#0369a1', color: '#ffffff' },
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
  onCursorChange,
  onFocusChange,
  editorRefOut,
  onRunShortcut,
}) {
  const viewRef = useRef(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const extensions = useMemo(() => {
    const langExt = getLangExtension(lang);
    const completionSource = createLanguageCompletionSource(lang, filesRef);

    const localLinter = linter(
      (view) => {
        const text = view.state.doc.toString();
        const issues = diagnose(text, lang);
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
      search({ top: true }),
      lintGutter(),
      localLinter,
      keymap.of([
        indentWithTab,
        ...searchKeymap,
        ...lintKeymap,
        {
          key: 'Mod-Enter',
          run: () => {
            onRunShortcut?.();
            return true;
          },
        },
      ]),
      EditorView.domEventHandlers({
        focus: () => {
          onFocusChange?.(true);
        },
        blur: () => {
          onFocusChange?.(false);
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          const selected = Math.abs(update.state.selection.main.to - update.state.selection.main.from);
          onCursorChange?.({
            line: line.number,
            col: head - line.from + 1,
            selected,
            lines: update.state.doc.lines,
          });
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
  }, [lang, theme, fontSize, tabSize, wordWrap, onCursorChange, onFocusChange, onRunShortcut]);

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
    <div className="h-full w-full overflow-hidden bg-white dark:bg-[#0b1120]" dir="ltr">
      <CodeMirror
        value={typeof value === 'string' ? value : ''}
        height="100%"
        className="h-full"
        theme={theme === 'dark' ? darkEditorTheme : lightEditorTheme}
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(view) => {
          viewRef.current = view;
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
  );
}
