// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Plugin, System, User} from '@support/server_api';
import {siteOneUrl} from '@support/test_config';

beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log('Setup started *************************');

    // Login as sysadmin and reset server configuration
    await System.apiCheckSystemHealth(siteOneUrl);
    await User.apiAdminLogin(siteOneUrl);
    await Plugin.apiDisableNonPrepackagedPlugins(siteOneUrl);

    // Add wait time before launching the app
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await device.launchApp({
        newInstance: true,
        launchArgs: {detoxPrintBusyIdleResources: 'YES'},
        permissions: {
            notifications: 'YES',
            camera: 'YES',
            medialibrary: 'YES',
            photos: 'YES',
        },
    });
});
