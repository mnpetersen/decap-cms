import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { fromJS } from 'immutable';

import * as actions from '../onePreview';

jest.mock('../../backend');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('onePreview actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadOnePreviewChanges', () => {
    it('should dispatch request and success actions on successful load', () => {
      const { currentBackend } = require('../../backend');

      const diffs = [
        { path: 'content/posts/hello.md', newFile: false, deleted: false, renamed: false },
        { path: 'content/posts/new-post.md', newFile: true, deleted: false, renamed: false },
        { path: 'content/posts/removed.md', newFile: false, deleted: true, renamed: false },
      ];

      const backend = {
        getOnePreviewChanges: jest.fn().mockResolvedValue(diffs),
      };

      currentBackend.mockReturnValue(backend);

      const store = mockStore({
        config: fromJS({ publish_mode: 'one_preview' }),
        collections: fromJS({
          posts: { name: 'posts', folder: 'content/posts' },
        }),
      });

      return store.dispatch(actions.loadOnePreviewChanges()).then(() => {
        const dispatched = store.getActions();
        expect(dispatched).toHaveLength(2);
        expect(dispatched[0]).toEqual({
          type: 'ONE_PREVIEW_CHANGES_REQUEST',
        });
        expect(dispatched[1]).toEqual({
          type: 'ONE_PREVIEW_CHANGES_SUCCESS',
          payload: {
            changes: [
              {
                changeType: 'modified',
                path: 'content/posts/hello.md',
                collection: 'posts',
                slug: 'hello',
                newFile: false,
                deleted: false,
                renamed: false,
                oldPath: undefined,
              },
              {
                changeType: 'added',
                path: 'content/posts/new-post.md',
                collection: 'posts',
                slug: 'new-post',
                newFile: true,
                deleted: false,
                renamed: false,
                oldPath: undefined,
              },
              {
                changeType: 'deleted',
                path: 'content/posts/removed.md',
                collection: 'posts',
                slug: 'removed',
                newFile: false,
                deleted: true,
                renamed: false,
                oldPath: undefined,
              },
            ],
          },
        });
      });
    });

    it('should dispatch request and failure actions on error', () => {
      const { currentBackend } = require('../../backend');

      const error = new Error('failed to load changes');
      const backend = {
        getOnePreviewChanges: jest.fn().mockRejectedValue(error),
      };

      currentBackend.mockReturnValue(backend);

      const store = mockStore({
        config: fromJS({ publish_mode: 'one_preview' }),
        collections: fromJS({
          posts: { name: 'posts', folder: 'content/posts' },
        }),
      });

      return store.dispatch(actions.loadOnePreviewChanges()).then(() => {
        const dispatched = store.getActions();
        expect(dispatched).toHaveLength(3);
        expect(dispatched[0]).toEqual({
          type: 'ONE_PREVIEW_CHANGES_REQUEST',
        });
        expect(dispatched[1]).toEqual({
          type: 'NOTIFICATION_SEND',
          payload: {
            message: { key: 'ui.toast.onFailToLoadEntries', details: error },
            type: 'error',
            dismissAfter: 8000,
          },
        });
        expect(dispatched[2]).toEqual({
          type: 'ONE_PREVIEW_CHANGES_FAILURE',
          payload: { error },
        });
      });
    });

    it('should handle files not matching any collection', () => {
      const { currentBackend } = require('../../backend');

      const diffs = [
        { path: 'some/unknown/path.md', newFile: false, deleted: false, renamed: false },
      ];

      const backend = {
        getOnePreviewChanges: jest.fn().mockResolvedValue(diffs),
      };

      currentBackend.mockReturnValue(backend);

      const store = mockStore({
        config: fromJS({ publish_mode: 'one_preview' }),
        collections: fromJS({
          posts: { name: 'posts', folder: 'content/posts' },
        }),
      });

      return store.dispatch(actions.loadOnePreviewChanges()).then(() => {
        const dispatched = store.getActions();
        expect(dispatched[1].payload.changes[0].collection).toBeNull();
        expect(dispatched[1].payload.changes[0].slug).toBeNull();
      });
    });
  });

  describe('publishOnePreview', () => {
    it('should dispatch request and success actions on successful publish', () => {
      const { currentBackend } = require('../../backend');

      const backend = {
        publishOnePreview: jest.fn().mockResolvedValue(),
      };

      currentBackend.mockReturnValue(backend);

      const store = mockStore({
        config: fromJS({ publish_mode: 'one_preview' }),
      });

      return store.dispatch(actions.publishOnePreview()).then(() => {
        const dispatched = store.getActions();
        expect(dispatched).toHaveLength(3);
        expect(dispatched[0]).toEqual({
          type: 'ONE_PREVIEW_PUBLISH_REQUEST',
        });
        expect(dispatched[1]).toEqual({
          type: 'NOTIFICATION_SEND',
          payload: {
            message: { key: 'ui.toast.entryPublished' },
            type: 'success',
            dismissAfter: 4000,
          },
        });
        expect(dispatched[2]).toEqual({
          type: 'ONE_PREVIEW_PUBLISH_SUCCESS',
        });
      });
    });

    it('should dispatch request and failure actions on error', () => {
      const { currentBackend } = require('../../backend');

      const error = new Error('failed to publish');
      const backend = {
        publishOnePreview: jest.fn().mockRejectedValue(error),
      };

      currentBackend.mockReturnValue(backend);

      const store = mockStore({
        config: fromJS({ publish_mode: 'one_preview' }),
      });

      return store.dispatch(actions.publishOnePreview()).then(() => {
        const dispatched = store.getActions();
        expect(dispatched).toHaveLength(3);
        expect(dispatched[0]).toEqual({
          type: 'ONE_PREVIEW_PUBLISH_REQUEST',
        });
        expect(dispatched[1]).toEqual({
          type: 'NOTIFICATION_SEND',
          payload: {
            message: { key: 'ui.toast.onFailToPublishEntry', details: error },
            type: 'error',
            dismissAfter: 8000,
          },
        });
        expect(dispatched[2]).toEqual({
          type: 'ONE_PREVIEW_PUBLISH_FAILURE',
          payload: { error },
        });
      });
    });
  });
});
