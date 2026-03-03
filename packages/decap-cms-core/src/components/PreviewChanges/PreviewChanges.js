import PropTypes from 'prop-types';
import React, { Component } from 'react';
import ImmutablePropTypes from 'react-immutable-proptypes';
import styled from '@emotion/styled';
import { translate } from 'react-polyglot';
import { connect } from 'react-redux';
import { Loader, lengths, components, buttons } from 'decap-cms-ui-default';

import { ONE_PREVIEW } from '../../constants/publishModes';
import { loadOnePreviewChanges, publishOnePreview } from '../../actions/onePreview';
import PreviewChangesList from './PreviewChangesList';

const PreviewChangesContainer = styled.div`
  padding: ${lengths.pageMargin} 0;
  min-height: 100vh;
`;

const PreviewChangesTop = styled.div`
  ${components.cardTop};
`;

const PreviewChangesTopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PreviewChangesTopHeading = styled.h1`
  ${components.cardTopHeading};
`;

const PreviewChangesTopDescription = styled.p`
  ${components.cardTopDescription};
`;

const PublishButton = styled.button`
  ${buttons.button};
  ${buttons.medium};
  ${buttons.green};
  &[disabled] {
    ${buttons.disabled};
  }
`;

const EmptyMessage = styled.p`
  padding: 40px 0;
  text-align: center;
  font-size: 16px;
  color: #798291;
`;

class PreviewChanges extends Component {
  static propTypes = {
    isOnePreview: PropTypes.bool.isRequired,
    isFetching: PropTypes.bool,
    isPublishing: PropTypes.bool,
    changes: ImmutablePropTypes.list,
    loadOnePreviewChanges: PropTypes.func.isRequired,
    publishOnePreview: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired,
  };

  componentDidMount() {
    // Manually validate PropTypes - React 19 breaking change
    PropTypes.checkPropTypes(PreviewChanges.propTypes, this.props, 'prop', 'PreviewChanges');

    const { loadOnePreviewChanges, isOnePreview } = this.props;
    if (isOnePreview) {
      loadOnePreviewChanges();
    }
  }

  handlePublish = () => {
    const { publishOnePreview, t } = this.props;
    if (window.confirm(t('previewChanges.publishConfirm'))) {
      publishOnePreview();
    }
  };

  render() {
    const { isOnePreview, isFetching, isPublishing, changes, t } = this.props;

    if (!isOnePreview) return null;
    if (isFetching) return <Loader active>{t('previewChanges.loading')}</Loader>;

    const hasChanges = changes && changes.size > 0;

    return (
      <PreviewChangesContainer>
        <PreviewChangesTop>
          <PreviewChangesTopRow>
            <PreviewChangesTopHeading>{t('previewChanges.title')}</PreviewChangesTopHeading>
            <PublishButton disabled={!hasChanges || isPublishing} onClick={this.handlePublish}>
              {isPublishing ? t('previewChanges.publishing') : t('previewChanges.publish')}
            </PublishButton>
          </PreviewChangesTopRow>
          <PreviewChangesTopDescription>
            {hasChanges
              ? `${changes.size} file(s) changed on preview branch.`
              : t('previewChanges.noChanges')}
          </PreviewChangesTopDescription>
        </PreviewChangesTop>
        {hasChanges ? (
          <PreviewChangesList changes={changes} />
        ) : (
          <EmptyMessage>{t('previewChanges.noChanges')}</EmptyMessage>
        )}
      </PreviewChangesContainer>
    );
  }
}

function mapStateToProps(state) {
  const { config, onePreview } = state;
  const isOnePreview = config.publish_mode === ONE_PREVIEW;
  const returnObj = { isOnePreview };

  if (isOnePreview) {
    returnObj.isFetching = onePreview.get('isFetching', false);
    returnObj.isPublishing = onePreview.get('isPublishing', false);
    returnObj.changes = onePreview.get('changes');
  }

  return returnObj;
}

export default connect(mapStateToProps, {
  loadOnePreviewChanges,
  publishOnePreview,
})(translate()(PreviewChanges));
