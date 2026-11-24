import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGitHubSnapshot,
  computeGitHubChanges,
  extractMediaBase64,
  formatGitHubApiError,
  normalizeGitHubRepoName,
  parseRepoSlug,
  pickInitialSeedEntry,
  suggestGitHubRepoName,
  validateGitHubBranch,
  validateGitHubFilePath,
} from './githubSync.js';
import { executeGitHubPush } from './githubPushService.js';

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

test('suggestGitHubRepoName and normalizeGitHubRepoName handle Arabic and punctuation safely', () => {
  assert.equal(suggestGitHubRepoName('تطبيق ويب جديد'), 'my-codelab-project');
  assert.equal(suggestGitHubRepoName('My Cool App!'), 'My-Cool-App');
  assert.equal(normalizeGitHubRepoName('  ---demo.git  '), 'demo');
  assert.equal(normalizeGitHubRepoName('مشروع 123'), '123');
});

test('extractMediaBase64 handles base64 and malformed percent characters in SVG data URLs', () => {
  assert.equal(
    extractMediaBase64({ __media: true, dataUrl: 'data:image/png;base64,QUJD' }),
    'QUJD'
  );
  const svgB64 = extractMediaBase64({
    __media: true,
    dataUrl: 'data:image/svg+xml;utf8,<svg width="100%"></svg>',
  });
  assert.equal(Buffer.from(svgB64, 'base64').toString('utf8'), '<svg width="100%"></svg>');
});

test('pickInitialSeedEntry prefers small non-empty text files over binary media', () => {
  const picked = pickInitialSeedEntry([
    { path: 'video.mp4', content: 'A'.repeat(50000), encoding: 'base64' },
    { path: '.gitkeep', content: '', encoding: 'utf-8' },
    { path: 'index.html', content: '<h1>Hello</h1>', encoding: 'utf-8' },
  ]);
  assert.equal(picked.first.path, 'index.html');
  assert.deepEqual(
    picked.rest.map((r) => r.path),
    ['video.mp4', '.gitkeep']
  );
});

test('formatGitHubApiError returns actionable Arabic and English messages', () => {
  assert.match(
    formatGitHubApiError({
      status: 403,
      data: { message: 'Resource not accessible by personal access token' },
      phase: 'createRepo',
      isPrivate: true,
      locale: 'ar',
    }),
    /مستودع خاص/
  );
  assert.match(
    formatGitHubApiError({
      status: 422,
      data: {
        message: 'Repository creation failed.',
        errors: [{ message: 'name already exists on this account' }],
      },
      phase: 'createRepo',
      locale: 'en',
    }),
    /already exists/i
  );
});

function mockJsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(data);
    },
  };
}

test('executeGitHubPush retries GitHub propagation lag when creating and initializing a new multi-file repo', async () => {
  const calls = [];
  let putAttempts = 0;

  const fakeFetch = async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    calls.push(`${method} ${url}`);

    if (method === 'GET' && url === 'https://api.github.com/repos/octocat/new-app') {
      return mockJsonResponse(404, { message: 'Not Found' });
    }
    if (method === 'POST' && url === 'https://api.github.com/user/repos') {
      return mockJsonResponse(201, {
        name: 'new-app',
        full_name: 'octocat/new-app',
        default_branch: 'main',
        private: false,
        html_url: 'https://github.com/octocat/new-app',
        owner: { login: 'octocat' },
      });
    }
    if (method === 'PUT' && url.startsWith('https://api.github.com/repos/octocat/new-app/contents/')) {
      putAttempts++;
      if (putAttempts === 1) return mockJsonResponse(404, { message: 'Not Found' });
      if (putAttempts === 2) return mockJsonResponse(409, { message: 'Git Repository is empty.' });
      return mockJsonResponse(201, {
        commit: {
          sha: 'init_commit_sha',
          html_url: 'https://github.com/octocat/new-app/commit/init_commit_sha',
          tree: { sha: 'init_tree_sha' },
        },
      });
    }
    if (method === 'POST' && url === 'https://api.github.com/repos/octocat/new-app/git/blobs') {
      return mockJsonResponse(201, { sha: 'media_blob_sha' });
    }
    if (method === 'POST' && url === 'https://api.github.com/repos/octocat/new-app/git/trees') {
      const parsed = JSON.parse(options.body);
      assert.equal(parsed.base_tree, 'init_tree_sha');
      assert.equal(parsed.tree.length, 2);
      assert.equal(parsed.tree.find((t) => t.path === 'app.js')?.content, 'console.log(1);');
      assert.equal(parsed.tree.find((t) => t.path === 'logo.png')?.sha, 'media_blob_sha');
      return mockJsonResponse(201, { sha: 'final_tree_sha' });
    }
    if (method === 'POST' && url === 'https://api.github.com/repos/octocat/new-app/git/commits') {
      const parsed = JSON.parse(options.body);
      assert.deepEqual(parsed.parents, ['init_commit_sha']);
      return mockJsonResponse(201, { sha: 'final_commit_sha' });
    }
    if (method === 'PATCH' && url === 'https://api.github.com/repos/octocat/new-app/git/refs/heads/main') {
      return mockJsonResponse(200, { object: { sha: 'final_commit_sha' } });
    }
    throw new Error(`Unexpected call: ${method} ${url}`);
  };

  const result = await executeGitHubPush({
    session: { accessToken: 'tok_123', login: 'octocat' },
    body: {
      owner: 'octocat',
      repoName: 'new-app',
      createNew: true,
      createIfMissing: true,
      commitMessage: 'Initial commit',
      files: {
        'logo.png': { __media: true, mime: 'image/png', dataUrl: 'data:image/png;base64,QUJD' },
        'index.html': '<h1>Hi</h1>',
        'app.js': 'console.log(1);',
      },
      locale: 'ar',
    },
    fetchImpl: fakeFetch,
    sleepImpl: async () => {},
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.fullName, 'octocat/new-app');
  assert.equal(result.payload.filesCount, 3);
  assert.equal(result.payload.commitSha, 'final_commit_sha');
  assert.equal(putAttempts, 3);
  assert.equal(calls.some((c) => c.includes('/git/commits/init_commit_sha')), false);
});

test('executeGitHubPush rejects createNew when repository already exists with 409', async () => {
  const fakeFetch = async (url) => {
    if (url === 'https://api.github.com/repos/octocat/existing-repo') {
      return mockJsonResponse(200, { full_name: 'octocat/existing-repo', default_branch: 'main' });
    }
    throw new Error(`Unexpected call: ${url}`);
  };

  const result = await executeGitHubPush({
    session: { accessToken: 'tok_123', login: 'octocat' },
    body: {
      owner: 'octocat',
      repoName: 'existing-repo',
      createNew: true,
      files: { 'index.html': '<h1>Hi</h1>' },
      locale: 'ar',
    },
    fetchImpl: fakeFetch,
    sleepImpl: async () => {},
  });

  assert.equal(result.status, 409);
  assert.match(result.payload.error, /موجود بالفعل/);
});

test('executeGitHubPush handles network errors gracefully without throwing', async () => {
  const failingFetch = async () => {
    throw new TypeError('fetch failed');
  };

  const result = await executeGitHubPush({
    session: { accessToken: 'tok_123', login: 'octocat' },
    body: {
      owner: 'octocat',
      repoName: 'new-app',
      createNew: true,
      files: { 'index.html': '<h1>Hi</h1>' },
      locale: 'ar',
    },
    fetchImpl: failingFetch,
    sleepImpl: async () => {},
  });

  assert.equal(result.status, 502);
  assert.ok(result.payload.error);
});
