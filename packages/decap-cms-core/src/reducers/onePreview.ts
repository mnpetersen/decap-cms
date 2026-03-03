import { Map, List, fromJS } from 'immutable';

import { ONE_PREVIEW } from '../constants/publishModes';
import {
  ONE_PREVIEW_CHANGES_REQUEST,
  ONE_PREVIEW_CHANGES_SUCCESS,
  ONE_PREVIEW_CHANGES_FAILURE,
  ONE_PREVIEW_PUBLISH_REQUEST,
  ONE_PREVIEW_PUBLISH_SUCCESS,
  ONE_PREVIEW_PUBLISH_FAILURE,
} from '../actions/onePreview';
import { CONFIG_SUCCESS } from '../actions/config';

const initialState = Map({ changes: List(), isFetching: false, isPublishing: false });

function onePreview(state = Map(), action: { type: string; payload?: Record<string, unknown> }) {
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
      return state.withMutations(map => {
        map.set('isFetching', false);
        map.set('changes', fromJS(action.payload!.changes));
      });

    case ONE_PREVIEW_CHANGES_FAILURE:
      return state.set('isFetching', false);

    case ONE_PREVIEW_PUBLISH_REQUEST:
      return state.set('isPublishing', true);

    case ONE_PREVIEW_PUBLISH_SUCCESS:
      return state.withMutations(map => {
        map.set('isPublishing', false);
        map.set('changes', List());
      });

    case ONE_PREVIEW_PUBLISH_FAILURE:
      return state.set('isPublishing', false);

    default:
      return state;
  }
}

export default onePreview;
