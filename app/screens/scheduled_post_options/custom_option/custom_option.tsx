// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {View} from 'react-native';

import {useTheme} from '@context/theme';
import DateTimeSelector from '@screens/custom_status_clear_after/components/date_time_selector';
import PickerOption from '@screens/post_priority_picker/components/picker_option';
import {makeStyleSheetFromTheme} from "@utils/theme";
import type {Moment} from "moment-timezone";

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        dateTimePickerContainer: {
            display: 'flex',
            borderWidth: 1,
            borderColor: 'black',
        },
    };
});

type Props = {
    userTimezone: string;
}

export function ScheduledPostCustomOption({userTimezone}: Props) {
    const intl = useIntl();
    const theme = useTheme();

    const [selectedCustomTime, setSelectedCustomTime] = useState<Moment | null>(null);
    const [showDateTimePicker, setShowDateTimePicker] = useState(false);

    const onClick = useCallback(() => {
        setShowDateTimePicker((show) => !show);
    }, []);

    const handleCustomTimeChange = useCallback((selectedTime: Moment) => {
        setSelectedCustomTime(selectedTime);
    }, []);

    return (
        <View>
            <PickerOption
                key='scheduledPostOptionCustom'
                label={intl.formatMessage({id: 'scheduled_post.picker.custom', defaultMessage: 'Custom Time'})}
                // description={selectedCustomTime?.toLocaleString()}
                action={onClick}
            />
            {showDateTimePicker && (
                <DateTimeSelector
                    handleChange={handleCustomTimeChange}
                    theme={theme}
                    timezone={userTimezone}
                />
            )}
        </View>
    );
}
