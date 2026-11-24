import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_EDITOR_GROUPS,
  closeEditorGroup,
  closeTabInGroup,
  createInitialGroups,
  moveTabBetweenGroups,
  normalizeGroups,
  openFileInGroup,
  removeFileFromGroups,
  renameFileInGroups,
  splitEditorGroup,
} from './editorGroups';

const SAMPLE_FILES = {
  'index.html': '<h1>Hi</h1>',
  'styles.css': 'body {}',
  'app.js': 'console.log(1);',
  'notes.md': '# Notes',
};

test('splitEditorGroup opens a different open tab in the new side-by-side group', () => {
  const { groups } = createInitialGroups(['index.html', 'styles.css', 'app.js'], 'index.html');
  const res = splitEditorGroup(groups, 'group-1', undefined, SAMPLE_FILES);

  assert.equal(res.didSplit, true);
  assert.equal(res.groups.length, 2);
  assert.equal(res.groups[0].activeFile, 'index.html');
  assert.equal(res.groups[1].activeFile, 'styles.css');
  assert.equal(res.activeGroupId, res.groups[1].id);
});

test('splitEditorGroup opens explicit target file in adjacent group without duplicating beyond max', () => {
  const { groups } = createInitialGroups(['index.html'], 'index.html');
  const firstSplit = splitEditorGroup(groups, 'group-1', 'app.js', SAMPLE_FILES);
  assert.equal(firstSplit.groups.length, 2);
  assert.equal(firstSplit.groups[1].activeFile, 'app.js');

  // Calling open-to-side again when 2 groups exist reuses the adjacent group
  const secondOpen = splitEditorGroup(firstSplit.groups, 'group-1', 'styles.css', SAMPLE_FILES);
  assert.equal(secondOpen.groups.length, 2);
  assert.equal(secondOpen.groups[1].activeFile, 'styles.css');
  assert.deepEqual(secondOpen.groups[1].tabs, ['app.js', 'styles.css']);
});

test('splitEditorGroup respects MAX_EDITOR_GROUPS cap', () => {
  let state = createInitialGroups(['index.html', 'styles.css', 'app.js'], 'index.html');
  for (let i = 0; i < 5; i++) {
    state = splitEditorGroup(state.groups, state.activeGroupId, undefined, SAMPLE_FILES);
  }
  assert.equal(state.groups.length, MAX_EDITOR_GROUPS);
});

test('closeTabInGroup closes empty split group automatically when multiple groups exist', () => {
  const initial = [
    { id: 'group-1', tabs: ['index.html'], activeFile: 'index.html' },
    { id: 'group-2', tabs: ['styles.css'], activeFile: 'styles.css' },
  ];
  const res = closeTabInGroup(initial, 'group-2', 'styles.css', 'group-2');
  assert.equal(res.groups.length, 1);
  assert.equal(res.activeGroupId, 'group-1');
});

test('closeEditorGroup closes split pane and preserves remaining group', () => {
  const initial = [
    { id: 'group-1', tabs: ['index.html'], activeFile: 'index.html' },
    { id: 'group-2', tabs: ['styles.css'], activeFile: 'styles.css' },
  ];
  const res = closeEditorGroup(initial, 'group-2', 'group-2');
  assert.equal(res.groups.length, 1);
  assert.equal(res.groups[0].id, 'group-1');
  assert.equal(res.activeGroupId, 'group-1');
});

test('moveTabBetweenGroups splits a multi-tab single group or moves across split groups', () => {
  const single = createInitialGroups(['index.html', 'styles.css'], 'index.html');
  const moved = moveTabBetweenGroups(single.groups, 'group-1', 'styles.css', SAMPLE_FILES);
  assert.equal(moved.groups.length, 2);
  assert.deepEqual(moved.groups[0].tabs, ['index.html']);
  assert.deepEqual(moved.groups[1].tabs, ['styles.css']);
  assert.equal(moved.activeGroupId, moved.groups[1].id);
});

test('renameFileInGroups and removeFileFromGroups update all split groups cleanly', () => {
  const split = [
    { id: 'group-1', tabs: ['index.html', 'styles.css'], activeFile: 'styles.css' },
    { id: 'group-2', tabs: ['styles.css', 'app.js'], activeFile: 'styles.css' },
  ];
  const renamed = renameFileInGroups(split, 'styles.css', 'theme.css');
  assert.equal(renamed[0].activeFile, 'theme.css');
  assert.equal(renamed[1].activeFile, 'theme.css');

  const removed = removeFileFromGroups(renamed, 'theme.css', { 'index.html': '', 'app.js': '' }, 'group-2');
  assert.equal(removed.groups[0].activeFile, 'index.html');
  assert.equal(removed.groups[1].activeFile, 'app.js');

  const cleared = removeFileFromGroups(removed.groups, 'index.html', {}, 'group-1');
  assert.equal(cleared.groups.length, 1);
  assert.equal(cleared.groups[0].activeFile, '');
  assert.deepEqual(cleared.groups[0].tabs, []);
});

test('normalizeGroups filters deleted files and recovers empty workspace', () => {
  const normEmpty = normalizeGroups([], {}, 'group-99');
  assert.equal(normEmpty.groups.length, 1);
  assert.equal(normEmpty.groups[0].activeFile, '');

  const opened = openFileInGroup(
    [{ id: 'group-1', tabs: ['index.html'], activeFile: 'index.html' }],
    'group-1',
    'app.js'
  );
  assert.deepEqual(opened[0].tabs, ['index.html', 'app.js']);
  assert.equal(opened[0].activeFile, 'app.js');
});
