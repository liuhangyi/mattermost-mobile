// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase, withObservables} from '@nozbe/watermelondb/react';

import {observeCurrentUser} from '@queries/servers/user';
import {ScheduledPostCoreOptions} from '@screens/scheduled_post_options/core_options/core_options';

import type {WithDatabaseArgs} from '@typings/database/database';

const enhanced = withObservables([], ({database}: WithDatabaseArgs) => {
    return {
        currentUser: observeCurrentUser(database),
    };
});

export default withDatabase(enhanced(ScheduledPostCoreOptions));
