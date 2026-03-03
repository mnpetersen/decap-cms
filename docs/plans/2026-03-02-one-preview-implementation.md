# `one_preview` Publish Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `one_preview` publish mode that commits all edits to a shared preview branch and provides a "Publish" button to merge preview into main via PR.

**Architecture:** Strategy pattern — extract backend git primitives, wrap editorial workflow as one strategy, add one_preview as a second strategy. Backends implement primitives; strategies orchestrate them.

**Tech Stack:** TypeScript, React, Redux (with Immutable.js), Jest, GitHub REST API

**Design Doc:** `docs/plans/2026-03-02-one-preview-publish-mode-design.md`

---

## Phase 1: Configuration & Constants

### Task 1: Add ONE_PREVIEW constant and update config schema

**Files:**
- Modify: `packages/decap-cms-core/src/constants/publishModes.ts`
- Modify: `packages/decap-cms-core/src/constants/configSchema.js:184-188`
- Test: `packages/decap-cms-core/src/reducers/__tests__/config.spec.js`

**Step 1: Write failing test for ONE_PREVIEW config validation**

In `packages/decap-cms-core/src/reducers/__tests__/config.spec.js`, add a test that validates `publish_mode: 'one_preview'` is accepted by the config schema. Look at existing tests in this file for patterns — they use `validateConfig` from the config actions.

```javascript
it('should not throw an error when publish_mode is "one_preview"', () => {
  expect(() => {
    validateConfig({
      backend: { name: 'github' },
      media_folder: 'static/media',
      collections: [{ name: 'posts', label: 'Posts', files: [{ name: 'test', label: 'Test', file: 'test.md', fields: [{ name: 'title', label: 'Title', widget: 'string' }] }] }],
      publish_mode: 'one_preview',
    });
  }).not.toThrow();
});

it('should not throw an error when preview_branch is set with one_preview mode', () => {
  expect(() => {
    validateConfig({
      backend: { name: 'github' },
      media_folder: 'static/media',
      collections: [{ name: 'posts', label: 'Posts', files: [{ name: 'test', label: 'Test', file: 'test.md', fields: [{ name: 'title', label: 'Title', widget: 'string' }] }] }],
      publish_mode: 'one_preview',
      preview_branch: 'staging',
    });
  }).not.toThrow();
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest packages/decap-cms-core/src/reducers/__tests__/config.spec.js --no-coverage -t "one_preview"`
Expected: FAIL — `one_preview` is not in the enum

**Step 3: Add ONE_PREVIEW constant**

In `packages/decap-cms-core/src/constants/publishModes.ts`, add after line 5:

```typescript
export const ONE_PREVIEW = 'one_preview';
```

**Step 4: Update config schema enum and add preview_branch**

In `packages/decap-cms-core/src/constants/configSchema.js`, change lines 184-188:

```javascript
publish_mode: {
  type: 'string',
  enum: ['simple', 'editorial_workflow', 'one_preview', ''],
  examples: ['editorial_workflow'],
},
preview_branch: {
  type: 'string',
},
```

**Step 5: Run test to verify it passes**

Run: `npx jest packages/decap-cms-core/src/reducers/__tests__/config.spec.js --no-coverage -t "one_preview"`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/decap-cms-core/src/constants/publishModes.ts packages/decap-cms-core/src/constants/configSchema.js packages/decap-cms-core/src/reducers/__tests__/config.spec.js
git commit -m "feat: add one_preview publish mode constant and config schema"
```

---

### Task 2: Add config selectors for one_preview

**Files:**
- Modify: `packages/decap-cms-core/src/reducers/config.ts:34-36`
- Test: `packages/decap-cms-core/src/reducers/__tests__/config.spec.js`

**Step 1: Write failing tests for selectors**

```javascript
import { selectUseOnePreview, selectPreviewBranch } from '../config';

describe('selectUseOnePreview', () => {
  it('should return true when publish_mode is one_preview', () => {
    expect(selectUseOnePreview({ publish_mode: 'one_preview' })).toBe(true);
  });

  it('should return false when publish_mode is editorial_workflow', () => {
    expect(selectUseOnePreview({ publish_mode: 'editorial_workflow' })).toBe(false);
  });

  it('should return false when publish_mode is simple', () => {
    expect(selectUseOnePreview({ publish_mode: 'simple' })).toBe(false);
  });
});

describe('selectPreviewBranch', () => {
  it('should return configured preview_branch', () => {
    expect(selectPreviewBranch({ preview_branch: 'staging' })).toBe('staging');
  });

  it('should default to "preview" when not configured', () => {
    expect(selectPreviewBranch({})).toBe('preview');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest packages/decap-cms-core/src/reducers/__tests__/config.spec.js --no-coverage -t "selectUseOnePreview|selectPreviewBranch"`
Expected: FAIL — functions don't exist yet

**Step 3: Implement selectors**

In `packages/decap-cms-core/src/reducers/config.ts`, add:

```typescript
import { EDITORIAL_WORKFLOW, ONE_PREVIEW } from '../constants/publishModes';

export function selectUseOnePreview(state: CmsConfig) {
  return state.publish_mode === ONE_PREVIEW;
}

export function selectPreviewBranch(state: CmsConfig) {
  return state.preview_branch || 'preview';
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest packages/decap-cms-core/src/reducers/__tests__/config.spec.js --no-coverage -t "selectUseOnePreview|selectPreviewBranch"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/decap-cms-core/src/reducers/config.ts packages/decap-cms-core/src/reducers/__tests__/config.spec.js
git commit -m "feat: add config selectors for one_preview mode"
```

---

## Phase 2: Backend Primitives Interface

### Task 3: Define BackendPrimitives interface

**Files:**
- Modify: `packages/decap-cms-lib-util/src/implementation.ts`

**Step 1: Add the BackendPrimitives interface**

In `packages/decap-cms-lib-util/src/implementation.ts`, add after the existing types (before the `Implementation` interface at line 138):

```typescript
export interface FileDiff {
  path: string;
  oldPath?: string;
  newFile: boolean;
  deleted: boolean;
  renamed: boolean;
}

export interface GitPR {
  number: number;
  head: string;
  labels?: string[];
}

export interface BackendPrimitives {
  /** Commit file changes to a specific branch */
  commitToBranch(
    files: { path: string; raw: string | null; sha?: string | null }[],
    branch: string,
    message: string,
  ): Promise<string>; // returns commit SHA

  /** Create a pull request from head branch to base branch */
  createPR(head: string, base: string, title: string, body: string): Promise<GitPR>;

  /** Merge an existing pull request */
  mergePR(pr: GitPR): Promise<void>;

  /** Get file differences between two branches */
  diffBranches(head: string, base: string): Promise<FileDiff[]>;

  /** Rebase a branch onto another branch */
  rebaseBranch(branch: string, onto: string): Promise<void>;

  /** Check if a branch exists */
  branchExists(branch: string): Promise<boolean>;

  /** Create a branch from a given ref */
  createBranch(branch: string, fromRef: string): Promise<void>;

  /** Get the HEAD SHA of a branch */
  getBranchSHA(branch: string): Promise<string>;
}
```

**Step 2: Export from package index**

Check `packages/decap-cms-lib-util/src/index.ts` and ensure `BackendPrimitives`, `FileDiff`, `GitPR` are exported.

**Step 3: Commit**

```bash
git add packages/decap-cms-lib-util/src/implementation.ts packages/decap-cms-lib-util/src/index.ts
git commit -m "feat: define BackendPrimitives interface for strategy pattern"
```

---

### Task 4: Implement GitHub backend primitives adapter

**Files:**
- Create: `packages/decap-cms-backend-github/src/GitHubPrimitives.ts`
- Test: `packages/decap-cms-backend-github/src/__tests__/GitHubPrimitives.spec.js`

This adapter wraps the existing `API` class methods into the `BackendPrimitives` interface. It delegates to existing methods — no new API calls.

**Step 1: Write failing tests**

Create `packages/decap-cms-backend-github/src/__tests__/GitHubPrimitives.spec.js`:

```javascript
import GitHubPrimitives from '../GitHubPrimitives';

describe('GitHubPrimitives', () => {
  let api;
  let primitives;

  beforeEach(() => {
    api = {
      getDefaultBranch: jest.fn(),
      updateTree: jest.fn(),
      commit: jest.fn(),
      patchBranch: jest.fn(),
      createPR: jest.fn(),
      mergePR: jest.fn(),
      getDifferences: jest.fn(),
      rebaseBranch: jest.fn(),
      getBranch: jest.fn(),
      createBranch: jest.fn(),
      branch: 'main',
    };
    primitives = new GitHubPrimitives(api);
  });

  describe('branchExists', () => {
    it('should return true when branch exists', async () => {
      api.getBranch.mockResolvedValue({ name: 'preview' });
      expect(await primitives.branchExists('preview')).toBe(true);
    });

    it('should return false when branch does not exist', async () => {
      api.getBranch.mockRejectedValue(new Error('Not Found'));
      expect(await primitives.branchExists('preview')).toBe(false);
    });
  });

  describe('diffBranches', () => {
    it('should return mapped file diffs', async () => {
      api.getDifferences.mockResolvedValue({
        files: [
          { filename: 'content/posts/hello.md', status: 'added', patch: '...' },
          { filename: 'content/posts/world.md', status: 'modified', patch: '...' },
        ],
      });
      const diffs = await primitives.diffBranches('preview', 'main');
      expect(diffs).toEqual([
        { path: 'content/posts/hello.md', newFile: true, deleted: false, renamed: false },
        { path: 'content/posts/world.md', newFile: false, deleted: false, renamed: false },
      ]);
    });
  });

  describe('createPR', () => {
    it('should create PR and return GitPR shape', async () => {
      api.createPR.mockResolvedValue({ number: 42, head: { sha: 'abc' }, labels: [] });
      const pr = await primitives.createPR('preview', 'main', 'Publish', 'body');
      expect(api.createPR).toHaveBeenCalledWith('Publish', 'preview', 'main', 'body');
      expect(pr).toEqual({ number: 42, head: 'abc', labels: [] });
    });
  });

  describe('mergePR', () => {
    it('should delegate to api.mergePR', async () => {
      api.mergePR.mockResolvedValue(undefined);
      await primitives.mergePR({ number: 42, head: 'abc' });
      expect(api.mergePR).toHaveBeenCalledWith({ number: 42, head: { sha: 'abc' } });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest packages/decap-cms-backend-github/src/__tests__/GitHubPrimitives.spec.js --no-coverage`
Expected: FAIL — module doesn't exist

**Step 3: Implement GitHubPrimitives**

Create `packages/decap-cms-backend-github/src/GitHubPrimitives.ts`:

```typescript
import type { BackendPrimitives, FileDiff, GitPR } from 'decap-cms-lib-util';
import type API from './API';

export default class GitHubPrimitives implements BackendPrimitives {
  api: API;

  constructor(api: API) {
    this.api = api;
  }

  async commitToBranch(
    files: { path: string; raw: string | null; sha?: string | null }[],
    branch: string,
    message: string,
  ): Promise<string> {
    const branchData = await this.api.getBranch(branch);
    const treeFiles = files.map(f => ({
      path: f.path,
      sha: f.raw === null ? null : undefined,
      ...(f.raw !== null ? { raw: f.raw } : {}),
    }));
    const changeTree = await this.api.updateTree(branchData.commit.sha, treeFiles, branch);
    const commit = await this.api.commit(message, changeTree);
    await this.api.patchBranch(branch, commit.sha);
    return commit.sha;
  }

  async createPR(head: string, base: string, title: string, body: string): Promise<GitPR> {
    const pr = await this.api.createPR(title, head, base, body);
    return {
      number: pr.number,
      head: pr.head.sha,
      labels: pr.labels?.map((l: any) => l.name) || [],
    };
  }

  async mergePR(pr: GitPR): Promise<void> {
    await this.api.mergePR({ number: pr.number, head: { sha: pr.head } });
  }

  async diffBranches(head: string, base: string): Promise<FileDiff[]> {
    const { files } = await this.api.getDifferences(base, head);
    return (files || []).map(file => ({
      path: file.filename,
      oldPath: file.previous_filename,
      newFile: file.status === 'added',
      deleted: file.status === 'removed',
      renamed: file.status === 'renamed',
    }));
  }

  async rebaseBranch(branch: string, onto: string): Promise<void> {
    await this.api.rebaseBranch(branch);
  }

  async branchExists(branch: string): Promise<boolean> {
    try {
      await this.api.getBranch(branch);
      return true;
    } catch (e) {
      return false;
    }
  }

  async createBranch(branch: string, fromRef: string): Promise<void> {
    await this.api.createBranch(branch, fromRef);
  }

  async getBranchSHA(branch: string): Promise<string> {
    const branchData = await this.api.getBranch(branch);
    return branchData.commit.sha;
  }
}
```

Note: The exact API method signatures may need adjustment — check `API.ts` method signatures for `createPR`, `getDifferences`, `getBranch`, `createBranch` parameters. The implementation above shows the pattern; the engineer should verify each delegation matches the actual API method.

**Step 4: Run tests to verify they pass**

Run: `npx jest packages/decap-cms-backend-github/src/__tests__/GitHubPrimitives.spec.js --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/decap-cms-backend-github/src/GitHubPrimitives.ts packages/decap-cms-backend-github/src/__tests__/GitHubPrimitives.spec.js
git commit -m "feat: implement GitHub backend primitives adapter"
```

---

### Task 5: Repeat primitives adapter for other backends

**Files:**
- Create: `packages/decap-cms-backend-gitlab/src/GitLabPrimitives.ts`
- Create: `packages/decap-cms-backend-bitbucket/src/BitbucketPrimitives.ts`
- Create: `packages/decap-cms-backend-gitea/src/GiteaPrimitives.ts`
- Create: `packages/decap-cms-backend-azure/src/AzurePrimitives.ts`
- Create: `packages/decap-cms-backend-git-gateway/src/GitGatewayPrimitives.ts`
- Tests for each

Follow the same pattern as Task 4 for each backend. Each adapter wraps the backend's existing API class. The method names and API shapes differ per backend, but the `BackendPrimitives` interface is the same.

**Key differences per backend:**
- **GitLab**: Uses `merge_requests` instead of `pulls`, `createMergeRequest` instead of `createPR`
- **Bitbucket**: Uses Bitbucket REST API v2 — `pullrequests` endpoint
- **Gitea**: Similar to GitHub API but different endpoints
- **Azure**: Uses Azure DevOps REST API
- **Git Gateway**: Proxies through Netlify Git Gateway — may need to add new gateway endpoints

**Step 1-4 per backend:** Write tests, implement adapter, verify tests pass.

**Step 5: Commit each backend separately**

```bash
git commit -m "feat: implement GitLab backend primitives adapter"
git commit -m "feat: implement Bitbucket backend primitives adapter"
# etc.
```

---

## Phase 3: OnePreview Backend Integration

### Task 6: Add one_preview support to Backend class

**Files:**
- Modify: `packages/decap-cms-core/src/backend.ts:290-365`
- Test: Add test in appropriate test file

The `Backend` class needs to:
1. Detect `one_preview` mode from config
2. Initialize the primitives adapter from the implementation
3. Route `persistEntry` calls to the preview branch when in one_preview mode

**Step 1: Write failing test**

Test that when `publish_mode` is `one_preview`, `persistEntry` calls the implementation's `persistEntry` with the preview branch, not the main branch.

**Step 2: Modify Backend constructor**

In `packages/decap-cms-core/src/backend.ts`, update the constructor to pass `useOnePreview` and `previewBranch` to the implementation:

```typescript
import { selectUseOnePreview, selectPreviewBranch } from './reducers/config';

// In constructor:
const useOnePreview = selectUseOnePreview(this.config);
const previewBranch = selectPreviewBranch(this.config);

this.implementation = implementation.init(this.config, {
  useWorkflow: selectUseWorkflow(this.config),
  useOnePreview,
  previewBranch,
  updateUserCredentials: this.updateUserCredentials,
  initialWorkflowStatus: status.first(),
});
```

**Step 3: Add one_preview persist method**

```typescript
async persistOnePreviewEntry(args: PersistArgs) {
  // Same as persistEntry but targets the preview branch
  return this.persistEntry({ ...args, useOnePreview: true });
}
```

**Step 4: Add one_preview publish method**

```typescript
async publishOnePreview() {
  return this.implementation.publishOnePreview!();
}
```

**Step 5: Add one_preview changes method**

```typescript
async getOnePreviewChanges() {
  return this.implementation.getOnePreviewChanges!();
}
```

**Step 6: Run tests, verify pass**

**Step 7: Commit**

```bash
git add packages/decap-cms-core/src/backend.ts
git commit -m "feat: add one_preview support to Backend class"
```

---

### Task 7: Add one_preview methods to Implementation interface

**Files:**
- Modify: `packages/decap-cms-lib-util/src/implementation.ts:138-208`

**Step 1: Add one_preview methods to the Implementation interface**

```typescript
// Add to Implementation interface:
getOnePreviewChanges?: () => Promise<FileDiff[]>;
publishOnePreview?: () => Promise<void>;
```

**Step 2: Commit**

```bash
git add packages/decap-cms-lib-util/src/implementation.ts
git commit -m "feat: add one_preview methods to Implementation interface"
```

---

### Task 8: Implement one_preview in GitHub backend

**Files:**
- Modify: `packages/decap-cms-backend-github/src/implementation.tsx`
- Modify: `packages/decap-cms-backend-github/src/API.ts`
- Test: `packages/decap-cms-backend-github/src/__tests__/implementation.spec.js`

**Step 1: Write failing test for persistEntry in one_preview mode**

```javascript
describe('one_preview mode', () => {
  it('should persist entry to preview branch', async () => {
    // Setup implementation with useOnePreview: true, previewBranch: 'preview'
    // Mock API methods
    // Call persistEntry
    // Assert commit was made to 'preview' branch, not 'main'
  });
});
```

**Step 2: Implement one_preview in GitHub implementation.tsx**

In the `init()` method, store `useOnePreview` and `previewBranch` from options.

In `persistEntry()`, when `useOnePreview` is true:
- Use the primitives adapter to commit to the preview branch
- If preview branch doesn't exist, create it from main first

```typescript
async persistEntry(entry: Entry, opts: PersistOptions) {
  if (this.useOnePreview) {
    return this.persistToPreviewBranch(entry, opts);
  }
  // ... existing logic
}

private async persistToPreviewBranch(entry: Entry, opts: PersistOptions) {
  const primitives = new GitHubPrimitives(this.api!);

  // Ensure preview branch exists
  const exists = await primitives.branchExists(this.previewBranch);
  if (!exists) {
    const mainSHA = await primitives.getBranchSHA(this.branch);
    await primitives.createBranch(this.previewBranch, mainSHA);
  }

  // Build file list from entry
  const files = entry.dataFiles.map(f => ({ path: f.path, raw: f.raw }));
  for (const asset of entry.assets) {
    const raw = await asset.toBase64!();
    files.push({ path: asset.path, raw });
  }

  await primitives.commitToBranch(files, this.previewBranch, opts.commitMessage);
}
```

**Step 3: Implement getOnePreviewChanges**

```typescript
async getOnePreviewChanges(): Promise<FileDiff[]> {
  const primitives = new GitHubPrimitives(this.api!);
  const exists = await primitives.branchExists(this.previewBranch);
  if (!exists) return [];
  return primitives.diffBranches(this.previewBranch, this.branch);
}
```

**Step 4: Implement publishOnePreview**

```typescript
async publishOnePreview(): Promise<void> {
  const primitives = new GitHubPrimitives(this.api!);
  const pr = await primitives.createPR(
    this.previewBranch,
    this.branch,
    'Publish preview changes',
    'Automated publish from Decap CMS one_preview mode',
  );
  await primitives.mergePR(pr);
  await primitives.rebaseBranch(this.previewBranch, this.branch);
}
```

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git add packages/decap-cms-backend-github/src/implementation.tsx packages/decap-cms-backend-github/src/API.ts packages/decap-cms-backend-github/src/__tests__/implementation.spec.js
git commit -m "feat: implement one_preview mode in GitHub backend"
```

---

## Phase 4: Redux State Management

### Task 9: Create onePreview Redux actions and reducer

**Files:**
- Create: `packages/decap-cms-core/src/actions/onePreview.ts`
- Create: `packages/decap-cms-core/src/reducers/onePreview.ts`
- Create: `packages/decap-cms-core/src/actions/__tests__/onePreview.spec.js`
- Create: `packages/decap-cms-core/src/reducers/__tests__/onePreview.spec.js`

**Step 1: Write failing reducer test**

```javascript
import { Map, List, fromJS } from 'immutable';
import reducer from '../onePreview';
import {
  ONE_PREVIEW_CHANGES_REQUEST,
  ONE_PREVIEW_CHANGES_SUCCESS,
  ONE_PREVIEW_CHANGES_FAILURE,
  ONE_PREVIEW_PUBLISH_REQUEST,
  ONE_PREVIEW_PUBLISH_SUCCESS,
  ONE_PREVIEW_PUBLISH_FAILURE,
} from '../../actions/onePreview';

describe('onePreview reducer', () => {
  it('should return initial state', () => {
    const state = reducer(undefined, { type: 'UNKNOWN' });
    expect(state).toEqual(Map({ changes: List(), isFetching: false, isPublishing: false }));
  });

  it('should set isFetching on changes request', () => {
    const state = reducer(undefined, { type: ONE_PREVIEW_CHANGES_REQUEST });
    expect(state.get('isFetching')).toBe(true);
  });

  it('should store changes on success', () => {
    const changes = [
      { path: 'content/posts/hello.md', collection: 'posts', slug: 'hello', title: 'Hello', changeType: 'added' },
    ];
    const state = reducer(undefined, { type: ONE_PREVIEW_CHANGES_SUCCESS, payload: { changes } });
    expect(state.get('isFetching')).toBe(false);
    expect(state.get('changes').toJS()).toEqual(changes);
  });

  it('should set isPublishing on publish request', () => {
    const state = reducer(undefined, { type: ONE_PREVIEW_PUBLISH_REQUEST });
    expect(state.get('isPublishing')).toBe(true);
  });

  it('should clear changes on publish success', () => {
    const initial = Map({ changes: List([{ path: 'a.md' }]), isFetching: false, isPublishing: true });
    const state = reducer(initial, { type: ONE_PREVIEW_PUBLISH_SUCCESS });
    expect(state.get('isPublishing')).toBe(false);
    expect(state.get('changes').size).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest packages/decap-cms-core/src/reducers/__tests__/onePreview.spec.js --no-coverage`
Expected: FAIL — module doesn't exist

**Step 3: Implement action constants and creators**

Create `packages/decap-cms-core/src/actions/onePreview.ts`:

```typescript
import { currentBackend } from '../backend';
import type { ThunkDispatch } from 'redux-thunk';
import type { AnyAction } from 'redux';
import type { State } from '../types/redux';

export const ONE_PREVIEW_CHANGES_REQUEST = 'ONE_PREVIEW_CHANGES_REQUEST';
export const ONE_PREVIEW_CHANGES_SUCCESS = 'ONE_PREVIEW_CHANGES_SUCCESS';
export const ONE_PREVIEW_CHANGES_FAILURE = 'ONE_PREVIEW_CHANGES_FAILURE';

export const ONE_PREVIEW_PUBLISH_REQUEST = 'ONE_PREVIEW_PUBLISH_REQUEST';
export const ONE_PREVIEW_PUBLISH_SUCCESS = 'ONE_PREVIEW_PUBLISH_SUCCESS';
export const ONE_PREVIEW_PUBLISH_FAILURE = 'ONE_PREVIEW_PUBLISH_FAILURE';

export function loadOnePreviewChanges() {
  return async (dispatch: ThunkDispatch<State, undefined, AnyAction>, getState: () => State) => {
    const state = getState();
    const backend = currentBackend(state.config);

    dispatch({ type: ONE_PREVIEW_CHANGES_REQUEST });
    try {
      const diffs = await backend.getOnePreviewChanges();

      // Map file diffs to entry changes using collection config
      const collections = state.collections;
      const changes = diffs.map(diff => {
        let changeType: 'added' | 'modified' | 'deleted' = 'modified';
        if (diff.newFile) changeType = 'added';
        if (diff.deleted) changeType = 'deleted';

        // Find which collection this file belongs to
        let collection = '';
        let slug = '';
        let title = diff.path;

        collections.forEach((col: any) => {
          const folder = col.get('folder');
          if (folder && diff.path.startsWith(folder)) {
            collection = col.get('name');
            slug = diff.path.slice(folder.length + 1).replace(/\.[^.]+$/, '');
            title = slug;
          }
        });

        return { path: diff.path, collection, slug, title, changeType };
      });

      dispatch({ type: ONE_PREVIEW_CHANGES_SUCCESS, payload: { changes } });
    } catch (error) {
      dispatch({ type: ONE_PREVIEW_CHANGES_FAILURE, payload: { error } });
    }
  };
}

export function publishOnePreview() {
  return async (dispatch: ThunkDispatch<State, undefined, AnyAction>, getState: () => State) => {
    const state = getState();
    const backend = currentBackend(state.config);

    dispatch({ type: ONE_PREVIEW_PUBLISH_REQUEST });
    try {
      await backend.publishOnePreview();
      dispatch({ type: ONE_PREVIEW_PUBLISH_SUCCESS });
    } catch (error) {
      dispatch({ type: ONE_PREVIEW_PUBLISH_FAILURE, payload: { error } });
    }
  };
}
```

**Step 4: Implement reducer**

Create `packages/decap-cms-core/src/reducers/onePreview.ts`:

```typescript
import { Map, List, fromJS } from 'immutable';

import {
  ONE_PREVIEW_CHANGES_REQUEST,
  ONE_PREVIEW_CHANGES_SUCCESS,
  ONE_PREVIEW_CHANGES_FAILURE,
  ONE_PREVIEW_PUBLISH_REQUEST,
  ONE_PREVIEW_PUBLISH_SUCCESS,
  ONE_PREVIEW_PUBLISH_FAILURE,
} from '../actions/onePreview';
import { CONFIG_SUCCESS } from '../actions/config';
import { ONE_PREVIEW } from '../constants/publishModes';

const initialState = Map({ changes: List(), isFetching: false, isPublishing: false });

export default function onePreviewReducer(state = initialState, action: any) {
  switch (action.type) {
    case CONFIG_SUCCESS: {
      const publishMode = action.payload && action.payload.publish_mode;
      if (publishMode === ONE_PREVIEW) {
        return initialState;
      }
      return state;
    }
    case ONE_PREVIEW_CHANGES_REQUEST:
      return state.set('isFetching', true);
    case ONE_PREVIEW_CHANGES_SUCCESS:
      return state.set('isFetching', false).set('changes', fromJS(action.payload.changes));
    case ONE_PREVIEW_CHANGES_FAILURE:
      return state.set('isFetching', false);
    case ONE_PREVIEW_PUBLISH_REQUEST:
      return state.set('isPublishing', true);
    case ONE_PREVIEW_PUBLISH_SUCCESS:
      return state.set('isPublishing', false).set('changes', List());
    case ONE_PREVIEW_PUBLISH_FAILURE:
      return state.set('isPublishing', false);
    default:
      return state;
  }
}
```

**Step 5: Register reducer in root reducer**

Find the root reducer file (likely `packages/decap-cms-core/src/reducers/index.ts`) and add `onePreview` to the combined reducers.

**Step 6: Run tests, verify pass**

Run: `npx jest packages/decap-cms-core/src/reducers/__tests__/onePreview.spec.js --no-coverage`
Expected: PASS

**Step 7: Write and run action tests**

Follow the pattern in `actions/__tests__/editorialWorkflow.spec.js` — use `redux-mock-store` to test action dispatching.

**Step 8: Commit**

```bash
git add packages/decap-cms-core/src/actions/onePreview.ts packages/decap-cms-core/src/reducers/onePreview.ts packages/decap-cms-core/src/reducers/index.ts packages/decap-cms-core/src/actions/__tests__/onePreview.spec.js packages/decap-cms-core/src/reducers/__tests__/onePreview.spec.js
git commit -m "feat: add onePreview Redux actions and reducer"
```

---

## Phase 5: Frontend UI

### Task 10: Create PreviewChanges page component

**Files:**
- Create: `packages/decap-cms-core/src/components/PreviewChanges/PreviewChanges.js`
- Create: `packages/decap-cms-core/src/components/PreviewChanges/PreviewChangesList.js`

**Step 1: Create PreviewChanges container component**

```jsx
import React from 'react';
import { connect } from 'react-redux';
import { translate } from 'react-polyglot';

import { ONE_PREVIEW } from '../../constants/publishModes';
import { loadOnePreviewChanges, publishOnePreview } from '../../actions/onePreview';
import PreviewChangesList from './PreviewChangesList';

class PreviewChanges extends React.Component {
  componentDidMount() {
    const { loadChanges, isOnePreview } = this.props;
    if (isOnePreview) {
      loadChanges();
    }
  }

  handlePublish = () => {
    if (window.confirm(this.props.t('previewChanges.publishConfirm'))) {
      this.props.publishAll();
    }
  };

  render() {
    const { changes, isFetching, isPublishing, t } = this.props;
    const hasChanges = changes && changes.size > 0;

    return (
      <div>
        <h1>{t('previewChanges.title')}</h1>
        <button
          disabled={!hasChanges || isPublishing}
          onClick={this.handlePublish}
        >
          {isPublishing ? t('previewChanges.publishing') : t('previewChanges.publish')}
        </button>
        {isFetching ? (
          <p>{t('previewChanges.loading')}</p>
        ) : hasChanges ? (
          <PreviewChangesList changes={changes} />
        ) : (
          <p>{t('previewChanges.noChanges')}</p>
        )}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    isOnePreview: state.config.publish_mode === ONE_PREVIEW,
    changes: state.onePreview.get('changes'),
    isFetching: state.onePreview.get('isFetching'),
    isPublishing: state.onePreview.get('isPublishing'),
  };
}

const mapDispatchToProps = {
  loadChanges: loadOnePreviewChanges,
  publishAll: publishOnePreview,
};

export default connect(mapStateToProps, mapDispatchToProps)(translate()(PreviewChanges));
```

**Step 2: Create PreviewChangesList component**

```jsx
import React from 'react';
import { Link } from 'react-router-dom';

function changeTypeBadge(changeType) {
  const colors = { added: '#28a745', modified: '#0366d6', deleted: '#d73a49' };
  return (
    <span style={{ color: colors[changeType] || '#586069', fontWeight: 'bold' }}>
      {changeType.charAt(0).toUpperCase() + changeType.slice(1)}
    </span>
  );
}

export default function PreviewChangesList({ changes }) {
  return (
    <ul>
      {changes.map((change, idx) => {
        const collection = change.get('collection');
        const slug = change.get('slug');
        const title = change.get('title');
        const changeType = change.get('changeType');
        const path = collection && slug ? `/collections/${collection}/entries/${slug}` : null;

        return (
          <li key={idx}>
            {changeTypeBadge(changeType)}
            {' '}
            {path ? <Link to={path}>{title}</Link> : title}
            {collection && <span> ({collection})</span>}
          </li>
        );
      })}
    </ul>
  );
}
```

Note: Style these components using the existing styled-components patterns from the codebase (check `Workflow.js` for reference). The above is the structural skeleton.

**Step 3: Commit**

```bash
git add packages/decap-cms-core/src/components/PreviewChanges/
git commit -m "feat: add PreviewChanges page component"
```

---

### Task 11: Add navigation and routing for PreviewChanges

**Files:**
- Modify: `packages/decap-cms-core/src/components/App/App.js:177-213`
- Modify: `packages/decap-cms-core/src/components/App/Header.js:212-219`

**Step 1: Add hasOnePreview to App.js**

In `packages/decap-cms-core/src/components/App/App.js`, around line 177:

```javascript
import { ONE_PREVIEW } from '../../constants/publishModes';
import PreviewChanges from '../PreviewChanges/PreviewChanges';

// In the component:
const hasOnePreview = publishMode === ONE_PREVIEW;
```

Pass `hasOnePreview` to `<Header>`.

Add route alongside the workflow route (around line 213):

```jsx
{hasOnePreview ? <Route path="/preview-changes" component={PreviewChanges} /> : null}
```

**Step 2: Add nav link to Header.js**

In `packages/decap-cms-core/src/components/App/Header.js`, after the workflow nav link (around line 219):

```jsx
{hasOnePreview && (
  <li>
    <AppHeaderNavLink to="/preview-changes" activeClassName="header-link-active">
      <Icon type="workflow" />
      {t('app.header.previewChanges')}
    </AppHeaderNavLink>
  </li>
)}
```

**Step 3: Add i18n strings**

Find the locales file (likely `packages/decap-cms-locales/src/en/index.js`) and add:

```javascript
previewChanges: {
  title: 'Preview Changes',
  publish: 'Publish All Changes',
  publishing: 'Publishing...',
  publishConfirm: 'Are you sure you want to publish all preview changes to the main branch?',
  loading: 'Loading changes...',
  noChanges: 'No pending changes to publish.',
},
```

Also add to `app.header`:
```javascript
previewChanges: 'Preview Changes',
```

**Step 4: Commit**

```bash
git add packages/decap-cms-core/src/components/App/App.js packages/decap-cms-core/src/components/App/Header.js packages/decap-cms-locales/
git commit -m "feat: add routing and navigation for PreviewChanges page"
```

---

### Task 12: Modify EditorToolbar for one_preview mode

**Files:**
- Modify: `packages/decap-cms-core/src/components/Editor/EditorToolbar.js:640-688`
- Modify: `packages/decap-cms-core/src/components/Editor/withWorkflow.js`

**Step 1: Add hasOnePreview to EditorToolbar**

In `EditorToolbar.js`, the render method (line 671) currently does:
```jsx
{hasWorkflow ? this.renderWorkflowControls() : this.renderSimpleControls()}
```

Change to:
```jsx
{hasWorkflow
  ? this.renderWorkflowControls()
  : hasOnePreview
    ? this.renderSimpleControls()
    : this.renderSimpleControls()}
```

Actually, since one_preview uses simple-style controls (just a Save button), it uses `renderSimpleControls()` — the same as simple mode. So we just need to make sure `hasWorkflow` is `false` when in one_preview mode. Check that `hasWorkflow` is derived from `config.publish_mode === EDITORIAL_WORKFLOW` (not just "any non-simple mode").

**Step 2: Update withWorkflow.js for one_preview**

In `packages/decap-cms-core/src/components/Editor/withWorkflow.js`, the `mapStateToProps` at line 11 checks:
```javascript
const isEditorialWorkflow = state.config.publish_mode === EDITORIAL_WORKFLOW;
```

This already correctly excludes one_preview — no change needed here.

However, we need a `withOnePreview` HOC (or modify `withWorkflow`) that overrides `persistEntry` to use the preview branch:

Create `packages/decap-cms-core/src/components/Editor/withOnePreview.js`:

```javascript
import React from 'react';
import { connect } from 'react-redux';

import { ONE_PREVIEW } from '../../constants/publishModes';

function mapStateToProps(state) {
  return {
    isOnePreview: state.config.publish_mode === ONE_PREVIEW,
  };
}

function mergeProps(stateProps, dispatchProps, ownProps) {
  // In one_preview mode, persistEntry already routes to preview branch
  // via the Backend class, so no override needed here.
  // This HOC just passes the isOnePreview flag.
  return {
    ...ownProps,
    ...stateProps,
  };
}

export default function withOnePreview(Editor) {
  return connect(mapStateToProps, null, mergeProps)(
    class OnePreviewEditor extends React.Component {
      render() {
        return <Editor {...this.props} />;
      }
    },
  );
}
```

Wire this into the Editor component composition where `withWorkflow` is applied.

**Step 3: Commit**

```bash
git add packages/decap-cms-core/src/components/Editor/
git commit -m "feat: editor toolbar and HOC support for one_preview mode"
```

---

### Task 13: Update Backend.persistEntry to route to preview branch

**Files:**
- Modify: `packages/decap-cms-core/src/backend.ts`

The `Backend.persistEntry` method needs to know when we're in one_preview mode so it passes the preview branch to the implementation. Review `backend.ts` line ~400-500 where `persistEntry` is implemented.

When `useOnePreview` is true:
- Call `this.implementation.persistEntry(entry, { ...opts, branch: this.previewBranch })`
- OR the implementation already knows from init that it should target the preview branch

Since we configured `useOnePreview` and `previewBranch` in the implementation's `init()` call (Task 6), the implementation itself routes to the correct branch. The Backend class may not need changes here — verify by checking the implementation flow.

**Step 1: Verify the flow works end-to-end with a manual test or integration test**

**Step 2: Commit if changes needed**

---

### Task 14: Integration testing

**Files:**
- Modify or create integration tests

**Step 1: Write an integration test for the full one_preview flow**

Using the test patterns from `editorialWorkflow.spec.js`:

```javascript
describe('onePreview actions', () => {
  it('should load preview changes', async () => {
    const { currentBackend } = require('../../backend');
    const backend = {
      getOnePreviewChanges: jest.fn().mockResolvedValue([
        { path: 'content/posts/hello.md', newFile: true, deleted: false, renamed: false },
      ]),
    };
    currentBackend.mockReturnValue(backend);

    const store = mockStore({
      config: fromJS({ publish_mode: 'one_preview', preview_branch: 'preview' }),
      collections: fromJS({ posts: { name: 'posts', folder: 'content/posts' } }),
      onePreview: Map({ changes: List(), isFetching: false, isPublishing: false }),
    });

    await store.dispatch(loadOnePreviewChanges());
    const actions = store.getActions();
    expect(actions[0].type).toBe('ONE_PREVIEW_CHANGES_REQUEST');
    expect(actions[1].type).toBe('ONE_PREVIEW_CHANGES_SUCCESS');
    expect(actions[1].payload.changes[0].changeType).toBe('added');
  });

  it('should publish all preview changes', async () => {
    const { currentBackend } = require('../../backend');
    const backend = {
      publishOnePreview: jest.fn().mockResolvedValue(undefined),
    };
    currentBackend.mockReturnValue(backend);

    const store = mockStore({
      config: fromJS({ publish_mode: 'one_preview' }),
      onePreview: Map({ changes: List([{ path: 'a.md' }]), isFetching: false, isPublishing: false }),
    });

    await store.dispatch(publishOnePreview());
    const actions = store.getActions();
    expect(actions[0].type).toBe('ONE_PREVIEW_PUBLISH_REQUEST');
    expect(actions[1].type).toBe('ONE_PREVIEW_PUBLISH_SUCCESS');
    expect(backend.publishOnePreview).toHaveBeenCalled();
  });
});
```

**Step 2: Run all tests**

Run: `npx jest --no-coverage`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/decap-cms-core/src/actions/__tests__/onePreview.spec.js
git commit -m "test: add integration tests for one_preview workflow"
```

---

## Phase 6: Verification & Cleanup

### Task 15: Verify editorial workflow is unaffected

**Step 1: Run all existing editorial workflow tests**

```bash
npx jest packages/decap-cms-core/src/actions/__tests__/editorialWorkflow.spec.js --no-coverage
npx jest packages/decap-cms-backend-github/src/__tests__/ --no-coverage
```

Expected: All PASS — no regressions

**Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: All PASS

**Step 3: Manual smoke test**

If a dev server is available (`yarn start` or similar), verify:
1. `publish_mode: editorial_workflow` still works as before
2. `publish_mode: simple` still works as before
3. `publish_mode: one_preview` shows "Preview Changes" nav link
4. Saving an entry in one_preview mode commits to the preview branch
5. The Preview Changes page shows the diff
6. Publishing creates and merges a PR

**Step 4: Commit any fixes**

---

### Task 16: Implement primitives for remaining backends

Repeat the pattern from Task 4 and Task 8 for each remaining backend:
- GitLab
- Bitbucket
- Gitea
- Azure
- Git Gateway

Each backend needs:
1. A primitives adapter (wrapping existing API)
2. `persistEntry` routing to preview branch when `useOnePreview` is true
3. `getOnePreviewChanges()` implementation
4. `publishOnePreview()` implementation
5. Tests

This is the largest task by volume but follows a mechanical pattern established in Tasks 4 and 8.

---

## Summary of Commits

1. `feat: add one_preview publish mode constant and config schema`
2. `feat: add config selectors for one_preview mode`
3. `feat: define BackendPrimitives interface for strategy pattern`
4. `feat: implement GitHub backend primitives adapter`
5. `feat: implement [backend] backend primitives adapter` (x5)
6. `feat: add one_preview support to Backend class`
7. `feat: add one_preview methods to Implementation interface`
8. `feat: implement one_preview mode in GitHub backend`
9. `feat: add onePreview Redux actions and reducer`
10. `feat: add PreviewChanges page component`
11. `feat: add routing and navigation for PreviewChanges page`
12. `feat: editor toolbar and HOC support for one_preview mode`
13. `test: add integration tests for one_preview workflow`
14. `feat: implement one_preview for remaining backends`
