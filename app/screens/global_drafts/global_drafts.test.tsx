// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Database} from '@nozbe/watermelondb';
import {act, fireEvent} from '@testing-library/react-native';
import React from 'react';

import {renderWithEverything} from '@test/intl-test-helper';
import TestHelper from '@test/test_helper';

import {GlobalDraftsAndScheduledPosts} from './index';

jest.mock('@hooks/device', () => ({
    useWindowDimensions: jest.fn(() => ({width: 800, height: 600})),
    useIsTablet: jest.fn().mockReturnValue(false),
}));

describe('screens/global_drafts', () => {
    let database: Database;

    beforeAll(async () => {
        const server = await TestHelper.setupServerDatabase();
        database = server.database;
    });

    it('should render drafts list when scheduled posts is disabled', async () => {
        const {getByTestId, queryByTestId} = renderWithEverything(
            <GlobalDraftsAndScheduledPosts
                draftsCount={0}
                scheduledPostCount={0}
            />,
            {database},
        );

        expect(getByTestId('global_drafts.screen')).toBeVisible();
        expect(queryByTestId('draft_tab_container')).not.toBeVisible();
    });

    it('should render tabs when scheduled posts is enabled', async () => {
        const {getByTestId} = renderWithEverything(
            <GlobalDraftsAndScheduledPosts
                draftsCount={1}
                scheduledPostCount={1}
                scheduledPostsEnabled={true}
            />,
            {database},
        );

        await act(async () => {
            await TestHelper.wait(200); // Wait until the badge renders
        });

        expect(getByTestId('draft_tab_container')).toBeVisible();
        expect(getByTestId('draft_tab')).toBeVisible();
        expect(getByTestId('scheduled_post_tab')).toBeVisible();
    });

    it('should switch between tabs', async () => {
        const {getByTestId} = renderWithEverything(
            <GlobalDraftsAndScheduledPosts
                draftsCount={1}
                scheduledPostCount={1}
                scheduledPostsEnabled={true}
            />,
            {database},
        );

        const draftTab = getByTestId('draft_tab');
        const scheduledTab = getByTestId('scheduled_post_tab');
        const tabbedContents = getByTestId('tabbed_contents');

        await act(async () => {
            fireEvent(tabbedContents, 'layout', {
                nativeEvent: {layout: {width: 300}}, // Simulated width change
            });
            await TestHelper.wait(200); // Wait until the badge renders
        });

        // Initially drafts list should be visible
        const draftsList = getByTestId('draft_list_container');
        expect(draftsList.props.style[0].transform[0].translateX).toBe(0);

        // And scheduled posts tab should not be visible
        const scheduledPostsList = getByTestId('scheduled_posts_list_container');
        expect(scheduledPostsList.props.style[0].transform[0].translateX).toBe(300);

        // Switch to scheduled posts
        act(() => {
            fireEvent.press(scheduledTab);
        });

        // Scheduled posts list should now be visible
        expect(scheduledPostsList.props.style[0].transform[0].translateX).toBe(0);

        // And draft tab not be visible
        expect(draftsList.props.style[0].transform[0].translateX).toBe(-300);

        // Switch back to drafts
        act(() => {
            fireEvent.press(draftTab);
        });

        // Drafts list should be visible again
        expect(draftsList.props.style[0].transform[0].translateX).toBe(0);

        // And scheduled posts tab should not be visible again
        expect(scheduledPostsList.props.style[0].transform[0].translateX).toBe(300);
    });
});
