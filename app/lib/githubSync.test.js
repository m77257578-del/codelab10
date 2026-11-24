import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGitHubSnapshot,
  computeGitHubChanges,
  parseRepoSlug,
  validateGitHubBranch,
  validateGitHubFilePath,
} from './githubSync.js';

test('computeGitHubChanges treats all files as added when no baseline snapshot exists', () => {
  const files = {
    'index.html': '<h1>Hi</h1>',
    'app.js': 'console.log(1);',
  };
  const res = computeGitHubChanges(files, null);
  assert.equal(res.hasBaseline, false);
  assert.deepEqual(res.added, ['app.js', 'index.html']);
  assert.deepEqual(res.modified, []);
  assert.deepEqual(res.deleted, []);
  assert.equal(res.totalChanges, 2);
});

test('computeGitHubChanges detects added, modified, deleted, and unchanged files accurately', () => {
  const initialFiles = {
    'index.html': '<h1>V1</h1>',
    'styles.css': 'body { color: #000; }',
    'old.js': 'console.log("old");',
    'logo.png': { __media: true, mime: 'image/png', dataUrl: 'data:image/png;base64,AAA=' },
  };
  const snapshot = buildGitHubSnapshot(initialFiles);

  // Immediately after sync: zero changes
  const clean = computeGitHubChanges(initialFiles, snapshot);
  assert.equal(clean.hasBaseline, true);
  assert.equal(clean.totalChanges, 0);

  // Edit index.html, remove old.js, add new.ts, modify media dataUrl
  const updatedFiles = {
    'index.html': '<h1>V2</h1>',
    'styles.css': 'body { color: #000; }',
    'new.ts': 'export const ok = true;',
    'logo.png': { __media: true, mime: 'image/png', dataUrl: 'data:image/png;base64,BBB=' },
  };
  const diff = computeGitHubChanges(updatedFiles, snapshot);
  assert.deepEqual(diff.modified, ['index.html', 'logo.png']);
  assert.deepEqual(diff.added, ['new.ts']);
  assert.deepEqual(diff.deleted, ['old.js']);
  assert.deepEqual(diff.unchanged, ['styles.css']);
  assert.equal(diff.totalChanges, 4);
  assert.equal(diff.statusMap['index.html'], 'modified');
  assert.equal(diff.statusMap['new.ts'], 'added');
  assert.equal(diff.statusMap['old.js'], 'deleted');
});

test('parseRepoSlug and GitHub validators accept valid inputs and reject traversal', () => {
  assert.deepEqual(parseRepoSlug('octocat/hello-world'), {
    owner: 'octocat',
    repo: 'hello-world',
    fullName: 'octocat/hello-world',
  });
  assert.deepEqual(parseRepoSlug('https://github.com/octocat/demo.git'), {
    owner: 'octocat',
    repo: 'demo',
    fullName: 'octocat/demo',
  });
  assert.deepEqual(parseRepoSlug('my-repo', 'mahmoud'), {
    owner: 'mahmoud',
    repo: 'my-repo',
    fullName: 'mahmoud/my-repo',
  });
  assert.equal(parseRepoSlug('../etc/passwd'), null);

  assert.equal(validateGitHubBranch('feature/new-ui'), 'feature/new-ui');
  assert.equal(validateGitHubBranch('../bad'), null);
  assert.equal(validateGitHubBranch('refs/heads/main'), 'main');

  assert.equal(validateGitHubFilePath('/src/app.js'), 'src/app.js');
  assert.equal(validateGitHubFilePath('../secret.txt'), null);
  assert.equal(validateGitHubFilePath('.git/config'), null);
});
