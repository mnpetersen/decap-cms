# Design: `one_preview` Publish Mode

## Overview

A new publish mode where all CMS edits are committed to a single shared preview branch. A dedicated "Preview Changes" page shows pending changes and provides a "Publish" button that creates and merges a PR from the preview branch to the main branch.

## Configuration

```yaml
backend:
  name: github
  repo: owner/repo
  branch: main              # production branch (default: main)

publish_mode: one_preview

preview_branch: preview      # default: 'preview'
```

- `publish_mode: one_preview` enables the mode
- `preview_branch` defaults to `"preview"` if not specified
- The existing `branch` config serves as the production/target branch
- Config validation ensures `preview_branch !== branch`

## Architecture: Strategy Pattern

### Motivation

The existing editorial workflow has branching, PR, and publish logic wired directly into each backend implementation. To support multiple publish modes without scattering mode-specific logic across every backend, we extract git operations into a primitives interface and add a strategy layer on top.

### Layers

```
Redux Actions
    │
    ▼
PublishStrategy (new abstraction)
    │
    ├── EditorialWorkflowStrategy
    └── OnePreviewStrategy
    │
    ▼
Backend Primitives (formalized interface)
    │
    ▼
Concrete Backends (GitHub, GitLab, Bitbucket, etc.)
```

### Backend Primitives Interface

```typescript
interface BackendPrimitives {
  commitToBranch(files: FileChange[], branch: string, message: string): Promise<void>;
  createPR(head: string, base: string, title: string, body: string): Promise<PR>;
  mergePR(pr: PR): Promise<void>;
  diffBranches(source: string, target: string): Promise<FileDiff[]>;
  rebaseBranch(branch: string, onto: string): Promise<void>;
  getBranchFile(path: string, branch: string): Promise<string>;
  branchExists(branch: string): Promise<boolean>;
}
```

All backends that support editorial workflow already perform these operations. The work is extracting them into a consistent interface.

### Primitive Usage by Strategy

| Primitive | Editorial Workflow | One Preview |
|---|---|---|
| `commitToBranch` | Commit to `cms/{collection}/{slug}` | Commit to `preview` |
| `createPR` | PR per entry branch to main | Single PR preview to main |
| `mergePR` | Merge individual entry PR | Merge the preview PR |
| `diffBranches` | Not used | preview vs main |
| `rebaseBranch` | Rebase entry branch on main | Rebase preview on main |
| `branchExists` | Check entry branch | Check preview branch exists |

## OnePreview Strategy Behavior

### Saving an Entry

1. User edits and clicks Save
2. Strategy checks if preview branch exists; creates it from main HEAD if not
3. Commits the entry directly to the preview branch
4. No per-entry branches, no PRs, no status tracking

### Viewing Pending Changes

1. Strategy calls `diffBranches(preview, main)` to get changed files
2. Maps changed files to CMS entries using file paths and collection config
3. Displays list: collection name, entry title, change type (Added/Modified/Deleted)
4. If no diff, shows "No pending changes"

### Publishing

1. User clicks "Publish" on the Preview Changes page
2. Strategy calls `createPR(preview, main, "Publish preview changes")`
3. Strategy calls `mergePR(pr)` to merge immediately
4. Strategy calls `rebaseBranch(preview, main)` to reset preview to a clean state
5. UI shows success

### Reverting Changes

- v1: all-or-nothing only (no selective revert of individual entries)
- Selective revert deferred to a future enhancement

## Frontend UI

### Preview Changes Page

- Nav link "Preview Changes" appears when `publish_mode: one_preview` (replaces "Workflow" link)
- Page contents:
  - List of entries differing between preview and main
  - Each row: collection name, entry title, change type badge (Added/Modified/Deleted)
  - Clicking a row navigates to the entry editor
  - "Publish" button at the top (disabled when no changes)
  - Empty state: "No pending changes to publish"

### Editor Toolbar

- Behaves like simple mode: just a "Save" button
- No status dropdown, no per-entry publish button
- Saving commits directly to the preview branch

### Redux State

```typescript
onePreview: {
  changes: List<{
    collection: string;
    slug: string;
    title: string;
    changeType: 'added' | 'modified' | 'deleted';
    path: string;
  }>;
  isFetching: boolean;
  isPublishing: boolean;
}
```

## Error Handling

### Preview branch doesn't exist

On first save, if the preview branch doesn't exist, create it from main HEAD. `branchExists()` check before each save.

### Merge conflicts

If the PR merge fails due to conflicts between preview and main, show an error: "Preview branch has conflicts with main. Please resolve before publishing." No auto-resolution.

### Empty publish

If preview and main are identical, disable the Publish button and show "No pending changes."

### Concurrent editors

Multiple users can save to the preview branch simultaneously. Git handles commit-level conflicts via retry (existing backend behavior). No additional locking for v1.

### Preview branch deleted externally

Next save recreates the branch from main. Changes page shows "No pending changes."

## Implementation Phases

### Phase 1: Extract Backend Primitives

Extract the primitives interface from existing editorial workflow backend code. Each backend gets a thin adapter mapping its API calls to the primitives interface. No behavior changes.

### Phase 2: Editorial Workflow Strategy

Wrap existing editorial workflow logic in an `EditorialWorkflowStrategy` that calls backend primitives. Verify no regressions in editorial workflow behavior.

### Phase 3: OnePreview Strategy + UI

Implement `OnePreviewStrategy` using the same primitives. Build the Preview Changes page, wire up config, and add the new Redux state.

## Backends

All backends that support editorial workflow will support one_preview through the primitives interface. GitHub is the primary development target; others follow since they already support the needed operations.
