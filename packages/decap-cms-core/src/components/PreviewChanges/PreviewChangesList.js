import PropTypes from 'prop-types';
import React from 'react';
import ImmutablePropTypes from 'react-immutable-proptypes';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Link } from 'react-router-dom';
import { colors, lengths } from 'decap-cms-ui-default';

const ListContainer = styled.div`
  margin-top: 20px;
`;

const ListTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const ListHeaderRow = styled.tr`
  border-bottom: 2px solid ${colors.textFieldBorder};
`;

const ListHeaderCell = styled.th`
  text-align: left;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
  color: ${colors.text};
  text-transform: uppercase;
`;

const ListRow = styled.tr`
  border-bottom: 1px solid ${colors.textFieldBorder};

  &:hover {
    background-color: ${colors.activeBackground};
  }
`;

const ListCell = styled.td`
  padding: 12px 14px;
  font-size: 14px;
  color: ${colors.text};
`;

const EntryLink = styled(Link)`
  color: ${colors.active};
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

const badgeStyles = {
  added: css`
    background-color: #dff0d8;
    color: #3c763d;
  `,
  modified: css`
    background-color: #fcf8e3;
    color: #8a6d3b;
  `,
  deleted: css`
    background-color: #f2dede;
    color: #a94442;
  `,
};

const ChangeTypeBadge = styled.span`
  display: inline-block;
  padding: 2px 10px;
  border-radius: ${lengths.borderRadius};
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
  ${props => badgeStyles[props.changeType] || badgeStyles.modified};
`;

class PreviewChangesList extends React.Component {
  static propTypes = {
    changes: ImmutablePropTypes.list.isRequired,
  };

  componentDidMount() {
    // Manually validate PropTypes - React 19 breaking change
    PropTypes.checkPropTypes(
      PreviewChangesList.propTypes,
      this.props,
      'prop',
      'PreviewChangesList',
    );
  }

  render() {
    const { changes } = this.props;

    return (
      <ListContainer>
        <ListTable>
          <thead>
            <ListHeaderRow>
              <ListHeaderCell>Status</ListHeaderCell>
              <ListHeaderCell>Entry</ListHeaderCell>
              <ListHeaderCell>Collection</ListHeaderCell>
              <ListHeaderCell>Path</ListHeaderCell>
            </ListHeaderRow>
          </thead>
          <tbody>
            {changes.map((change, idx) => {
              const changeType = change.get('changeType');
              const collection = change.get('collection');
              const slug = change.get('slug');
              const path = change.get('path');

              const title = slug || path;
              const hasLink = collection && slug && changeType !== 'deleted';

              return (
                <ListRow key={idx}>
                  <ListCell>
                    <ChangeTypeBadge changeType={changeType}>{changeType}</ChangeTypeBadge>
                  </ListCell>
                  <ListCell>
                    {hasLink ? (
                      <EntryLink to={`/collections/${collection}/entries/${slug}`}>
                        {title}
                      </EntryLink>
                    ) : (
                      title
                    )}
                  </ListCell>
                  <ListCell>{collection || '-'}</ListCell>
                  <ListCell>{path}</ListCell>
                </ListRow>
              );
            })}
          </tbody>
        </ListTable>
      </ListContainer>
    );
  }
}

export default PreviewChangesList;
