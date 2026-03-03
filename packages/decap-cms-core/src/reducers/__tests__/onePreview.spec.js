import { Map, List, fromJS } from 'immutable';

import onePreview from '../onePreview';
import {
  ONE_PREVIEW_CHANGES_REQUEST,
  ONE_PREVIEW_CHANGES_SUCCESS,
  ONE_PREVIEW_CHANGES_FAILURE,
  ONE_PREVIEW_PUBLISH_REQUEST,
  ONE_PREVIEW_PUBLISH_SUCCESS,
  ONE_PREVIEW_PUBLISH_FAILURE,
} from '../../actions/onePreview';
import { CONFIG_SUCCESS } from '../../actions/config';

describe('onePreview reducer', () => {
  it('should return the default state for unknown action', () => {
    const state = onePreview(undefined, { type: 'UNKNOWN_ACTION' });
    expect(state).toEqual(Map());
  });

  it('should initialize state on CONFIG_SUCCESS when publish_mode is one_preview', () => {
    const action = {
      type: CONFIG_SUCCESS,
      payload: { publish_mode: 'one_preview' },
    };
    const state = onePreview(undefined, action);
    expect(state).toEqual(Map({ changes: List(), isFetching: false, isPublishing: false }));
  });

  it('should not initialize state on CONFIG_SUCCESS when publish_mode is not one_preview', () => {
    const action = {
      type: CONFIG_SUCCESS,
      payload: { publish_mode: 'editorial_workflow' },
    };
    const state = onePreview(undefined, action);
    expect(state).toEqual(Map());
  });

  it('should set isFetching to true on ONE_PREVIEW_CHANGES_REQUEST', () => {
    const initialState = Map({ changes: List(), isFetching: false, isPublishing: false });
    const action = { type: ONE_PREVIEW_CHANGES_REQUEST };
    const state = onePreview(initialState, action);
    expect(state.get('isFetching')).toBe(true);
  });

  it('should set isFetching to false and store changes on ONE_PREVIEW_CHANGES_SUCCESS', () => {
    const initialState = Map({ changes: List(), isFetching: true, isPublishing: false });
    const changes = [
      { changeType: 'modified', path: 'content/posts/hello.md', collection: 'posts', slug: 'hello' },
      { changeType: 'added', path: 'content/posts/new.md', collection: 'posts', slug: 'new' },
    ];
    const action = {
      type: ONE_PREVIEW_CHANGES_SUCCESS,
      payload: { changes },
    };
    const state = onePreview(initialState, action);
    expect(state.get('isFetching')).toBe(false);
    expect(state.get('changes')).toEqual(fromJS(changes));
  });

  it('should set isFetching to false on ONE_PREVIEW_CHANGES_FAILURE', () => {
    const initialState = Map({ changes: List(), isFetching: true, isPublishing: false });
    const action = {
      type: ONE_PREVIEW_CHANGES_FAILURE,
      payload: { error: new Error('failed') },
    };
    const state = onePreview(initialState, action);
    expect(state.get('isFetching')).toBe(false);
  });

  it('should set isPublishing to true on ONE_PREVIEW_PUBLISH_REQUEST', () => {
    const initialState = Map({ changes: List(), isFetching: false, isPublishing: false });
    const action = { type: ONE_PREVIEW_PUBLISH_REQUEST };
    const state = onePreview(initialState, action);
    expect(state.get('isPublishing')).toBe(true);
  });

  it('should set isPublishing to false and clear changes on ONE_PREVIEW_PUBLISH_SUCCESS', () => {
    const changes = fromJS([
      { changeType: 'modified', path: 'content/posts/hello.md' },
    ]);
    const initialState = Map({ changes, isFetching: false, isPublishing: true });
    const action = { type: ONE_PREVIEW_PUBLISH_SUCCESS };
    const state = onePreview(initialState, action);
    expect(state.get('isPublishing')).toBe(false);
    expect(state.get('changes')).toEqual(List());
  });

  it('should set isPublishing to false on ONE_PREVIEW_PUBLISH_FAILURE', () => {
    const initialState = Map({ changes: List(), isFetching: false, isPublishing: true });
    const action = {
      type: ONE_PREVIEW_PUBLISH_FAILURE,
      payload: { error: new Error('publish failed') },
    };
    const state = onePreview(initialState, action);
    expect(state.get('isPublishing')).toBe(false);
  });
});
