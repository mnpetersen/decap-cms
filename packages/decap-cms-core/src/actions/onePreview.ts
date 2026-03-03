import { currentBackend } from '../backend';
import { addNotification } from './notifications';

import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { State } from '../types/redux';
import type { FileDiff } from 'decap-cms-lib-util';

/*
 * Constant Declarations
 */
export const ONE_PREVIEW_CHANGES_REQUEST = 'ONE_PREVIEW_CHANGES_REQUEST';
export const ONE_PREVIEW_CHANGES_SUCCESS = 'ONE_PREVIEW_CHANGES_SUCCESS';
export const ONE_PREVIEW_CHANGES_FAILURE = 'ONE_PREVIEW_CHANGES_FAILURE';

export const ONE_PREVIEW_PUBLISH_REQUEST = 'ONE_PREVIEW_PUBLISH_REQUEST';
export const ONE_PREVIEW_PUBLISH_SUCCESS = 'ONE_PREVIEW_PUBLISH_SUCCESS';
export const ONE_PREVIEW_PUBLISH_FAILURE = 'ONE_PREVIEW_PUBLISH_FAILURE';

/*
 * Simple Action Creators (Internal)
 */

function onePreviewChangesRequest() {
  return {
    type: ONE_PREVIEW_CHANGES_REQUEST,
  };
}

function onePreviewChangesSuccess(changes: Array<Record<string, unknown>>) {
  return {
    type: ONE_PREVIEW_CHANGES_SUCCESS,
    payload: { changes },
  };
}

function onePreviewChangesFailure(error: Error) {
  return {
    type: ONE_PREVIEW_CHANGES_FAILURE,
    payload: { error },
  };
}

function onePreviewPublishRequest() {
  return {
    type: ONE_PREVIEW_PUBLISH_REQUEST,
  };
}

function onePreviewPublishSuccess() {
  return {
    type: ONE_PREVIEW_PUBLISH_SUCCESS,
  };
}

function onePreviewPublishFailure(error: Error) {
  return {
    type: ONE_PREVIEW_PUBLISH_FAILURE,
    payload: { error },
  };
}

/*
 * Helpers
 */

function getChangeType(diff: FileDiff): 'added' | 'deleted' | 'modified' {
  if (diff.newFile) return 'added';
  if (diff.deleted) return 'deleted';
  return 'modified';
}

function mapDiffToEntryChange(diff: FileDiff, collections: State['collections']) {
  const changeType = getChangeType(diff);
  let collectionName: string | null = null;
  let slug: string | null = null;

  collections.forEach((collection, name) => {
    const folder = collection.get('folder') as string | undefined;
    if (folder && diff.path.startsWith(folder + '/')) {
      collectionName = name as string;
      // Extract slug: remove folder prefix and file extension
      const relativePath = diff.path.slice(folder.length + 1);
      slug = relativePath.replace(/\.[^/.]+$/, '');
    }
  });

  return {
    changeType,
    path: diff.path,
    collection: collectionName,
    slug,
    newFile: diff.newFile,
    deleted: diff.deleted,
    renamed: diff.renamed,
    oldPath: diff.oldPath,
  };
}

/*
 * Exported Thunk Action Creators
 */

export function loadOnePreviewChanges() {
  return async (dispatch: ThunkDispatch<State, {}, AnyAction>, getState: () => State) => {
    const state = getState();
    const backend = currentBackend(state.config);

    dispatch(onePreviewChangesRequest());

    try {
      const diffs = await backend.getOnePreviewChanges();
      const changes = diffs.map(diff => mapDiffToEntryChange(diff, state.collections));
      dispatch(onePreviewChangesSuccess(changes));
    } catch (error) {
      dispatch(
        addNotification({
          message: {
            key: 'ui.toast.onFailToLoadEntries',
            details: error,
          },
          type: 'error',
          dismissAfter: 8000,
        }),
      );
      dispatch(onePreviewChangesFailure(error));
    }
  };
}

export function publishOnePreview() {
  return async (dispatch: ThunkDispatch<State, {}, AnyAction>, getState: () => State) => {
    const state = getState();
    const backend = currentBackend(state.config);

    dispatch(onePreviewPublishRequest());

    try {
      await backend.publishOnePreview();
      dispatch(
        addNotification({
          message: {
            key: 'ui.toast.entryPublished',
          },
          type: 'success',
          dismissAfter: 4000,
        }),
      );
      dispatch(onePreviewPublishSuccess());
    } catch (error) {
      dispatch(
        addNotification({
          message: {
            key: 'ui.toast.onFailToPublishEntry',
            details: error,
          },
          type: 'error',
          dismissAfter: 8000,
        }),
      );
      dispatch(onePreviewPublishFailure(error));
    }
  };
}
