import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspaceFile,
  deleteWorkspaceFile,
  deleteWorkspaceFolder,
  normalizeWorkspacePath,
  renameWorkspaceFile,
  renameWorkspaceFolder,
} from './workspaceFiles';

test('normalizeWorkspacePath sanitizes slashes and blocks traversal', () => {
  assert.equal(normalizeWorkspacePath(' /src//utils/helper.js/ '), 'src/utils/helper.js');
  assert.equal(normalizeWorkspacePath('src\\app.ts'), 'src/app.ts');
  assert.equal(normalizeWorkspacePath('../secret.js'), '');
  assert.equal(normalizeWorkspacePath('   '), '');
});

test('createWorkspaceFile creates file with starter content and rejects duplicates', () => {
  const initial = { 'index.html': '<h1>Hi</h1>' };
  const created = createWorkspaceFile(initial, 'src/notes.js');
  assert.equal(created.ok, true);
  assert.equal(created.path, 'src/notes.js');
  assert.equal(typeof created.files['src/notes.js'], 'string');

  const dup = createWorkspaceFile(created.files, '/src/notes.js');
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'exists');
});

test('renameWorkspaceFile renames file cleanly and rejects collisions', () => {
  const initial = { 'notes.js': 'console.log(1);', 'app.js': 'console.log(2);' };
  const renamed = renameWorkspaceFile(initial, 'notes.js', 'utils/helpers.js');
  assert.equal(renamed.ok, true);
  assert.equal(renamed.files['notes.js'], undefined);
  assert.equal(renamed.files['utils/helpers.js'], 'console.log(1);');

  const collision = renameWorkspaceFile(renamed.files, 'utils/helpers.js', 'app.js');
  assert.equal(collision.ok, false);
  assert.equal(collision.reason, 'exists');
});

test('deleteWorkspaceFile removes file without mutating original object', () => {
  const initial = { 'a.js': '1', 'b.js': '2' };
  const res = deleteWorkspaceFile(initial, 'a.js');
  assert.equal(res.ok, true);
  assert.deepEqual(res.files, { 'b.js': '2' });
  assert.equal(initial['a.js'], '1');
});

test('deleteWorkspaceFolder and renameWorkspaceFolder update nested files safely', () => {
  const initial = {
    'src/a.js': 'a',
    'src/sub/b.js': 'b',
    'index.html': 'html',
  };
  const renamed = renameWorkspaceFolder(initial, 'src', 'lib');
  assert.equal(renamed.ok, true);
  assert.deepEqual(renamed.files, {
    'lib/a.js': 'a',
    'lib/sub/b.js': 'b',
    'index.html': 'html',
  });

  const deleted = deleteWorkspaceFolder(renamed.files, 'lib');
  assert.equal(deleted.ok, true);
  assert.deepEqual(deleted.removedPaths.sort(), ['lib/a.js', 'lib/sub/b.js']);
  assert.deepEqual(deleted.files, { 'index.html': 'html' });
});
