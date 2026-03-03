import GitGateway from '../implementation';

// Minimal config object for constructing GitGateway
function createConfig(overrides = {}) {
  return {
    backend: {
      name: 'git-gateway',
      branch: 'main',
      ...overrides,
    },
    media_folder: 'static/images',
  };
}

// We need to suppress the side effects of the module (netlifyIdentity initialization)
// by ensuring window.netlifyIdentity is not set, which is the default in jsdom.

describe('GitGateway', () => {
  describe('constructor', () => {
    it('should store useOnePreview from options', () => {
      const gw = new GitGateway(createConfig(), { useOnePreview: true });
      expect(gw.useOnePreview).toBe(true);
    });

    it('should default useOnePreview to false', () => {
      const gw = new GitGateway(createConfig());
      expect(gw.useOnePreview).toBe(false);
    });

    it('should store previewBranch from options', () => {
      const gw = new GitGateway(createConfig(), { previewBranch: 'staging' });
      expect(gw.previewBranch).toBe('staging');
    });

    it('should default previewBranch to preview', () => {
      const gw = new GitGateway(createConfig());
      expect(gw.previewBranch).toBe('preview');
    });

    it('should include useOnePreview and previewBranch in options object', () => {
      const gw = new GitGateway(createConfig(), {
        useOnePreview: true,
        previewBranch: 'my-preview',
      });
      expect(gw.options.useOnePreview).toBe(true);
      expect(gw.options.previewBranch).toBe('my-preview');
    });
  });

  describe('one_preview delegation methods', () => {
    let gw;

    beforeEach(() => {
      gw = new GitGateway(createConfig(), { useOnePreview: true });
    });

    it('should delegate getOnePreviewChanges to backend', async () => {
      const mockChanges = [
        { path: 'content/post.md', newFile: false, deleted: false, renamed: false },
      ];
      gw.backend = {
        getOnePreviewChanges: jest.fn().mockResolvedValue(mockChanges),
      };

      const result = await gw.getOnePreviewChanges();
      expect(gw.backend.getOnePreviewChanges).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockChanges);
    });

    it('should delegate publishOnePreview to backend', async () => {
      gw.backend = {
        publishOnePreview: jest.fn().mockResolvedValue(undefined),
      };

      await gw.publishOnePreview();
      expect(gw.backend.publishOnePreview).toHaveBeenCalledTimes(1);
    });
  });
});
