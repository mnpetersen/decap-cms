import GitHubPrimitives from '../GitHubPrimitives';

describe('GitHubPrimitives', () => {
  function createMockApi(overrides = {}) {
    return {
      getBranch: jest.fn(),
      updateTree: jest.fn(),
      commit: jest.fn(),
      patchBranch: jest.fn(),
      createPR: jest.fn(),
      mergePR: jest.fn(),
      getDifferences: jest.fn(),
      rebaseBranch: jest.fn(),
      createBranch: jest.fn(),
      uploadBlob: jest.fn(),
      branch: 'main',
      ...overrides,
    };
  }

  describe('branchExists', () => {
    it('should return true when branch exists', async () => {
      const api = createMockApi();
      api.getBranch.mockResolvedValue({ name: 'my-branch', commit: { sha: 'abc123' } });
      const primitives = new GitHubPrimitives(api);

      const result = await primitives.branchExists('my-branch');

      expect(result).toBe(true);
      expect(api.getBranch).toHaveBeenCalledTimes(1);
      expect(api.getBranch).toHaveBeenCalledWith('my-branch');
    });

    it('should return false when branch does not exist (404)', async () => {
      const api = createMockApi();
      const error = new Error('Not Found');
      error.status = 404;
      api.getBranch.mockRejectedValue(error);
      const primitives = new GitHubPrimitives(api);

      const result = await primitives.branchExists('nonexistent-branch');

      expect(result).toBe(false);
      expect(api.getBranch).toHaveBeenCalledTimes(1);
      expect(api.getBranch).toHaveBeenCalledWith('nonexistent-branch');
    });
  });

  describe('getBranchSHA', () => {
    it('should extract SHA from branch data', async () => {
      const api = createMockApi();
      api.getBranch.mockResolvedValue({
        name: 'main',
        commit: { sha: 'abc123def456' },
      });
      const primitives = new GitHubPrimitives(api);

      const sha = await primitives.getBranchSHA('main');

      expect(sha).toBe('abc123def456');
      expect(api.getBranch).toHaveBeenCalledTimes(1);
      expect(api.getBranch).toHaveBeenCalledWith('main');
    });
  });

  describe('createBranch', () => {
    it('should delegate to api.createBranch', async () => {
      const api = createMockApi();
      api.createBranch.mockResolvedValue({ ref: 'refs/heads/new-branch' });
      const primitives = new GitHubPrimitives(api);

      await primitives.createBranch('new-branch', 'abc123');

      expect(api.createBranch).toHaveBeenCalledTimes(1);
      expect(api.createBranch).toHaveBeenCalledWith('new-branch', 'abc123');
    });
  });

  describe('diffBranches', () => {
    it('should map API response to FileDiff[] correctly', async () => {
      const api = createMockApi();
      api.getDifferences.mockResolvedValue({
        files: [
          { filename: 'added-file.md', status: 'added', sha: 'sha1' },
          { filename: 'modified-file.md', status: 'modified', sha: 'sha2' },
          { filename: 'removed-file.md', status: 'removed', sha: 'sha3' },
          {
            filename: 'new-name.md',
            status: 'renamed',
            sha: 'sha4',
            previous_filename: 'old-name.md',
          },
        ],
      });
      const primitives = new GitHubPrimitives(api);

      const diffs = await primitives.diffBranches('feature', 'main');

      expect(api.getDifferences).toHaveBeenCalledTimes(1);
      expect(api.getDifferences).toHaveBeenCalledWith('main', 'feature');

      expect(diffs).toEqual([
        { path: 'added-file.md', newFile: true, deleted: false, renamed: false },
        { path: 'modified-file.md', newFile: false, deleted: false, renamed: false },
        { path: 'removed-file.md', newFile: false, deleted: true, renamed: false },
        {
          path: 'new-name.md',
          oldPath: 'old-name.md',
          newFile: false,
          deleted: false,
          renamed: true,
        },
      ]);
    });

    it('should handle empty files list', async () => {
      const api = createMockApi();
      api.getDifferences.mockResolvedValue({ files: [] });
      const primitives = new GitHubPrimitives(api);

      const diffs = await primitives.diffBranches('feature', 'main');

      expect(diffs).toEqual([]);
    });

    it('should handle undefined files', async () => {
      const api = createMockApi();
      api.getDifferences.mockResolvedValue({});
      const primitives = new GitHubPrimitives(api);

      const diffs = await primitives.diffBranches('feature', 'main');

      expect(diffs).toEqual([]);
    });
  });

  describe('createPR', () => {
    it('should create PR and return GitPR shape', async () => {
      const api = createMockApi();
      api.createPR.mockResolvedValue({
        number: 42,
        head: { sha: 'head-sha-123' },
        labels: [{ name: 'decap-cms/draft' }, { name: 'bug' }],
      });
      const primitives = new GitHubPrimitives(api);

      const result = await primitives.createPR('feature-branch', 'main', 'My PR Title', 'PR body');

      expect(api.createPR).toHaveBeenCalledTimes(1);
      expect(api.createPR).toHaveBeenCalledWith('My PR Title', 'feature-branch');

      expect(result).toEqual({
        number: 42,
        head: 'head-sha-123',
        labels: ['decap-cms/draft', 'bug'],
      });
    });

    it('should handle PR with no labels', async () => {
      const api = createMockApi();
      api.createPR.mockResolvedValue({
        number: 1,
        head: { sha: 'sha1' },
        labels: [],
      });
      const primitives = new GitHubPrimitives(api);

      const result = await primitives.createPR('branch', 'main', 'title', 'body');

      expect(result).toEqual({
        number: 1,
        head: 'sha1',
        labels: [],
      });
    });
  });

  describe('mergePR', () => {
    it('should delegate to api.mergePR with correct shape', async () => {
      const api = createMockApi();
      api.mergePR.mockResolvedValue({});
      const primitives = new GitHubPrimitives(api);

      const pr = { number: 42, head: 'head-sha-123', labels: ['some-label'] };
      await primitives.mergePR(pr);

      expect(api.mergePR).toHaveBeenCalledTimes(1);
      expect(api.mergePR).toHaveBeenCalledWith({
        number: 42,
        head: { sha: 'head-sha-123' },
        labels: [{ name: 'some-label' }],
      });
    });

    it('should handle PR without labels', async () => {
      const api = createMockApi();
      api.mergePR.mockResolvedValue({});
      const primitives = new GitHubPrimitives(api);

      const pr = { number: 10, head: 'sha-abc' };
      await primitives.mergePR(pr);

      expect(api.mergePR).toHaveBeenCalledTimes(1);
      expect(api.mergePR).toHaveBeenCalledWith({
        number: 10,
        head: { sha: 'sha-abc' },
        labels: [],
      });
    });
  });

  describe('commitToBranch', () => {
    it('should call uploadBlob, getBranch, updateTree, commit, patchBranch in order', async () => {
      const api = createMockApi();
      const callOrder = [];

      api.uploadBlob.mockImplementation(file => {
        callOrder.push('uploadBlob');
        file.sha = `blob-sha-${file.path}`;
        return Promise.resolve(file);
      });
      api.getBranch.mockImplementation(() => {
        callOrder.push('getBranch');
        return Promise.resolve({ commit: { sha: 'branch-head-sha' } });
      });
      api.updateTree.mockImplementation(() => {
        callOrder.push('updateTree');
        return Promise.resolve({ sha: 'tree-sha', parentSha: 'branch-head-sha' });
      });
      api.commit.mockImplementation(() => {
        callOrder.push('commit');
        return Promise.resolve({ sha: 'new-commit-sha' });
      });
      api.patchBranch.mockImplementation(() => {
        callOrder.push('patchBranch');
        return Promise.resolve({});
      });

      const primitives = new GitHubPrimitives(api);

      const files = [
        { path: 'content/post.md', raw: '# Hello' },
        { path: 'static/image.png', raw: 'binary-data' },
      ];

      const commitSha = await primitives.commitToBranch(files, 'my-branch', 'Add post');

      expect(commitSha).toBe('new-commit-sha');

      // uploadBlob should be called for each file
      expect(api.uploadBlob).toHaveBeenCalledTimes(2);

      // getBranch should be called with the branch name
      expect(api.getBranch).toHaveBeenCalledTimes(1);
      expect(api.getBranch).toHaveBeenCalledWith('my-branch');

      // updateTree should be called with the branch head SHA and the files
      expect(api.updateTree).toHaveBeenCalledTimes(1);
      expect(api.updateTree).toHaveBeenCalledWith(
        'branch-head-sha',
        expect.arrayContaining([
          expect.objectContaining({ path: 'content/post.md' }),
          expect.objectContaining({ path: 'static/image.png' }),
        ]),
      );

      // commit should be called with the message and the tree
      expect(api.commit).toHaveBeenCalledTimes(1);
      expect(api.commit).toHaveBeenCalledWith('Add post', {
        sha: 'tree-sha',
        parentSha: 'branch-head-sha',
      });

      // patchBranch should be called with the branch name and the commit SHA
      expect(api.patchBranch).toHaveBeenCalledTimes(1);
      expect(api.patchBranch).toHaveBeenCalledWith('my-branch', 'new-commit-sha');

      // Verify order: uploads happen first, then getBranch, updateTree, commit, patchBranch
      expect(callOrder).toEqual([
        'uploadBlob',
        'uploadBlob',
        'getBranch',
        'updateTree',
        'commit',
        'patchBranch',
      ]);
    });

    it('should handle files with null raw (deletions)', async () => {
      const api = createMockApi();
      api.uploadBlob.mockImplementation(file => {
        file.sha = 'blob-sha';
        return Promise.resolve(file);
      });
      api.getBranch.mockResolvedValue({ commit: { sha: 'head-sha' } });
      api.updateTree.mockResolvedValue({ sha: 'tree-sha', parentSha: 'head-sha' });
      api.commit.mockResolvedValue({ sha: 'commit-sha' });
      api.patchBranch.mockResolvedValue({});

      const primitives = new GitHubPrimitives(api);

      const files = [{ path: 'content/deleted.md', raw: null }];

      await primitives.commitToBranch(files, 'branch', 'Delete file');

      // Null raw files (deletions) should not be uploaded as blobs
      expect(api.uploadBlob).toHaveBeenCalledTimes(0);

      // updateTree should have the file with sha: null
      expect(api.updateTree).toHaveBeenCalledWith('head-sha', [
        { path: 'content/deleted.md', sha: null },
      ]);
    });
  });

  describe('rebaseBranch', () => {
    it('should delegate to api.rebaseBranch', async () => {
      const api = createMockApi();
      api.rebaseBranch.mockResolvedValue({ sha: 'rebased-sha' });
      const primitives = new GitHubPrimitives(api);

      await primitives.rebaseBranch('feature-branch', 'main');

      expect(api.rebaseBranch).toHaveBeenCalledTimes(1);
      expect(api.rebaseBranch).toHaveBeenCalledWith('feature-branch');
    });
  });
});
