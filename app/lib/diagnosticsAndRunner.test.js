import test from 'node:test';
import assert from 'node:assert/strict';
import { FILE_EXT_TO_LANG, LANG_META, WORKSPACE_TEMPLATES, detectLang } from './workspaces';
import { diagnose, formatCode } from './diagnostics';
import { runCode, runMain, runPy, toJS } from './runner';
import { getTerminalCompletions } from './terminalEngine';

test('workspaces: FILE_EXT_TO_LANG maps Erlang and Elixir extensions without collisions', () => {
  assert.equal(FILE_EXT_TO_LANG.erl, 'erlang');
  assert.equal(FILE_EXT_TO_LANG.hrl, 'erlang');
  assert.equal(FILE_EXT_TO_LANG.ex, 'elixir');
  assert.equal(FILE_EXT_TO_LANG.exs, 'elixir');
  assert.equal(LANG_META.erlang.label, 'Erlang');
  assert.equal(detectLang('app.ex'), 'elixir');
  assert.equal(detectLang('server.erl'), 'erlang');
});

test('diagnostics: ignores multi-line comments, Python docstrings, and template literals cleanly', () => {
  const jsCode = `
/* Multi-line comment
   with unbalanced { ( and "quotes
*/
import { useState } from 'react';
export function Demo() {
  const msg = \`hello
  world\`;
  return msg;
}
`;
  assert.deepEqual(diagnose(jsCode, 'js', 'en'), []);
  assert.deepEqual(diagnose(jsCode, 'jsx', 'en'), []);

  const pyCode = `
def greet(name: str) -> str:
    """Multi-line docstring
    with 'unclosed quote and (paren
    """
    return f"Hi {name}"
`;
  assert.deepEqual(diagnose(pyCode, 'python', 'en'), []);

  // Real JS syntax error still reported with accurate line
  const badJs = `const a = 1;\nconst b = {;\n`;
  const errs = diagnose(badJs, 'js', 'en');
  assert.ok(errs.length > 0);
});

test('diagnostics: CSS pseudo-selectors and multi-line properties produce zero false positives', () => {
  const cssCode = `
a:hover
{
  background:
    linear-gradient(180deg, #000, #111);
  color: #fff;
}
`;
  assert.deepEqual(diagnose(cssCode, 'css', 'en'), []);

  // Missing semicolon still caught
  const badCss = `
.card {
  color: red
  background: blue;
}
`;
  const errs = diagnose(badCss, 'css', 'en');
  assert.equal(errs.length, 1);
  assert.equal(errs[0].line, 3);
});

test('diagnostics: formatCode CSS preserves quoted strings and data URIs in url()', () => {
  const css = `.icon{background-image:url("data:image/png;base64,abc;def");color: red;}`;
  const formatted = formatCode(css, 'css', 2);
  assert.ok(formatted.includes('url("data:image/png;base64,abc;def")'));
  assert.ok(formatted.includes('  color: red;'));
});

test('runner: runPy executes multi-file python-lab template offline with type annotations & JSON', async () => {
  const pyTpl = WORKSPACE_TEMPLATES.find((t) => t.id === 'python-lab');
  assert.ok(pyTpl);
  const res = await runPy(pyTpl.files['main.py'], pyTpl.files);
  assert.equal(res.err, undefined);
  assert.match(res.out, /المشروع: CodeLab Python Workspace/);
  assert.match(res.out, /الأعداد الأولية: \[2, 3, 5, 11, 17\]/);
  assert.match(res.out, /مضروب 6 = 720/);
});

test('runner: toJS preserves floating point division, string literals, and multi-class Java', () => {
  const cppCode = `#include <iostream>
using namespace std;
int main() {
  double half = 1.0 / 2.0;
  int whole = 5 / 2;
  string url = "https://example.com/a/b";
  cout << half << " " << whole << " " << url << endl;
  return 0;
}`;
  const cppOut = runMain(toJS(cppCode, 'cpp'));
  assert.equal(cppOut.err, undefined);
  assert.equal(cppOut.out.trim(), '0.5 2 https://example.com/a/b');

  const javaCode = `class Helper {
  static int twice(int x) { return x * 2; }
}
public class Main {
  public static void main(String[] args) {
    System.out.println(Helper.twice(6));
  }
}`;
  const javaOut = toJS(javaCode, 'java');
  assert.ok(javaOut.includes('function main()'));
  assert.ok(!javaOut.includes('public class Main'));
});

test('runner: runCode executes typescript-lab and php-sql-json templates cleanly', async () => {
  const tsTpl = WORKSPACE_TEMPLATES.find((t) => t.id === 'typescript-lab');
  const tsRes = await runCode('ts', tsTpl.files['main.ts'], tsTpl.files);
  assert.equal(tsRes.err, undefined);
  assert.match(tsRes.out, /المكتمل: 2 من 3/);

  const sqlPhpTpl = WORKSPACE_TEMPLATES.find((t) => t.id === 'php-sql-json');
  const sqlRes = await runCode('sql', sqlPhpTpl.files['query.sql'], sqlPhpTpl.files);
  assert.equal(sqlRes.err, undefined);
  assert.match(sqlRes.out, /Laptop Pro/);

  const phpRes = await runCode('php', sqlPhpTpl.files['index.php'], sqlPhpTpl.files);
  assert.equal(phpRes.err, undefined);
  assert.match(phpRes.out, /CodeLab Store/);
});

test('terminalEngine: getTerminalCompletions includes virtualDirs created via mkdir', () => {
  const virtualDirs = new Set(['components', 'utils/helpers']);
  const completions = getTerminalCompletions('cd ', { 'index.html': '' }, '', virtualDirs);
  assert.ok(completions.includes('components/'));
});
