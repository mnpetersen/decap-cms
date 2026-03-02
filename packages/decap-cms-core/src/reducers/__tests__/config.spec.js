import { configLoaded, configLoading, configFailed } from '../../actions/config';
import config, { selectLocale, selectUseOnePreview, selectPreviewBranch } from '../config';

describe('config', () => {
  it('should handle an empty state', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore config reducer doesn't accept empty action
    expect(config(undefined, {})).toEqual({ isFetching: true });
  });

  it('should handle an update', () => {
    expect(
      config({ isFetching: true }, configLoaded({ locale: 'fr', backend: { name: 'proxy' } })),
    ).toEqual({
      locale: 'fr',
      backend: { name: 'proxy' },
      isFetching: false,
      error: undefined,
    });
  });

  it('should mark the config as loading', () => {
    expect(config({ isFetching: false }, configLoading())).toEqual({ isFetching: true });
  });

  it('should handle an error', () => {
    expect(
      config({ isFetching: true }, configFailed(new Error('Config could not be loaded'))),
    ).toEqual({
      error: 'Error: Config could not be loaded',
      isFetching: false,
    });
  });

  it('should default to "en" locale', () => {
    expect(selectLocale({})).toEqual('en');
  });
});

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
