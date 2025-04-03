// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import JPush from 'jpush-react-native'; // 使用 JPush 模块
import {DeviceEventEmitter, Platform} from 'react-native';
import {requestNotifications} from 'react-native-permissions';

import {storeDeviceToken} from '@actions/app/global';
import {markChannelAsViewed} from '@actions/local/channel';
import {updateThread} from '@actions/local/thread';
import {backgroundNotification, openNotification} from '@actions/remote/notifications';
import {isCallsStartedMessage} from '@calls/utils';
import {Device, Events, Navigation, PushNotification, Screens} from '@constants';
import DatabaseManager from '@database/manager';
import {getServerDisplayName} from '@queries/app/servers';
import {getCurrentChannelId} from '@queries/servers/system';
import {getIsCRTEnabled, getThreadById} from '@queries/servers/thread';
import {showOverlay} from '@screens/navigation';
import EphemeralStore from '@store/ephemeral_store';
import NavigationStore from '@store/navigation_store';
import {isBetaApp} from '@utils/general';
import {isTablet} from '@utils/helpers';
import {logDebug, logInfo} from '@utils/log';
import {convertToNotificationData} from '@utils/notification';

class PushNotifications {
    configured = false;
    subscriptions = [];

    /**
     * 初始化推送服务，添加 JPush 事件监听器
     * @param {boolean} register - 是否执行权限注册（iOS 需要请求通知权限）
     */
    init(register) {
        // 移除之前添加的监听
        this.subscriptions.forEach((sub) => {
            if (sub && sub.remove) {
                sub.remove();
            }
        });
        this.subscriptions = [];

        // 初始化 JPush（注意：参数请根据实际情况调整）
        JPush.init({appKey: 'c336f3ea4ca4f63a92b8728c', channel: 'dev', production: 1});

        // 添加连接状态监听
        const connectListener = () => {
            // 获取注册 ID，并存储设备 token（Android 和 iOS 均可）
            JPush.getRegistrationID((registrationID) => {
                if (!this.configured) {
                    this.configured = true;
                    let prefix;
                    if (Platform.OS === 'ios') {
                        prefix = Device.PUSH_NOTIFY_APPLE_REACT_NATIVE;
                        if (isBetaApp) {
                            prefix = `${prefix}beta`;
                        }
                    } else {
                        prefix = Device.PUSH_NOTIFY_ANDROID_REACT_NATIVE + '_jpush';
                    }
                    const token = `${prefix}-v2:${registrationID.registerID}`;
                    storeDeviceToken(token);
                    logDebug('Notification token registered', token);
                    this.requestNotificationReplyPermissions();
                }
            });
        };
        JPush.addConnectEventListener(connectListener);
        const notificationListener = (result) => {
            const notification = convertToNotificationData(result, false);

            // 当用户点击通知时标记为用户交互
            notification.userInteraction = true;
            this.processNotification(notification);
        };
        JPush.addNotificationListener(notificationListener);
        const customMessageListener = (result) => {
            const notification = convertToNotificationData(result, false);
            this.processNotification(notification);
        };
        JPush.addCustomMessageListener(customMessageListener);

        // 添加应用内消息监听
        // 添加 tag/alias 事件监听
        if (register) {
            this.registerIfNeeded();
        }
    }

    async registerIfNeeded() {
        if (Platform.OS === 'ios') {
            await requestNotifications(['alert', 'sound', 'badge']);
        }

        // 对于 JPush，初始化时会自动注册，无需额外调用
    }

    /**
     * 回复功能（iOS 下 react-native-notifications 需要设置，但 JPush 不要求此配置）
     */
    createReplyCategory = () => {
        // 可根据需要实现自定义回复逻辑，目前不做处理
        return null;
    };

    getServerUrlFromNotification = async (notification) => {
        const {payload} = notification;
        if (!payload?.channel_id && (!payload?.server_url || !payload.server_id)) {
            return payload?.server_url;
        }
        let serverUrl = payload.server_url;
        if (!serverUrl && payload.server_id) {
            serverUrl = await DatabaseManager.getServerUrlFromIdentifier(payload.server_id);
        }
        return serverUrl;
    };

    handleClearNotification = async (notification) => {
        const {payload} = notification;
        const serverUrl = await this.getServerUrlFromNotification(notification);
        if (serverUrl && payload?.channel_id) {
            const database = DatabaseManager.serverDatabases[serverUrl]?.database;
            if (database) {
                const isCRTEnabled = await getIsCRTEnabled(database);
                if (isCRTEnabled && payload.root_id) {
                    const thread = await getThreadById(database, payload.root_id);
                    if (thread?.isFollowing) {
                        const data = {
                            unread_mentions: 0,
                            unread_replies: 0,
                            last_viewed_at: Date.now(),
                        };
                        updateThread(serverUrl, payload.root_id, data);
                    }
                } else {
                    markChannelAsViewed(serverUrl, payload.channel_id);
                }
            }
        }
    };

    handleInAppNotification = async (serverUrl, notification) => {
        const {payload} = notification;
        if (isCallsStartedMessage(payload)) {
            return;
        }
        const database = DatabaseManager.serverDatabases[serverUrl]?.database;
        if (database) {
            const isTabletDevice = isTablet();
            const displayName = await getServerDisplayName(serverUrl);
            const channelId = await getCurrentChannelId(database);
            const isCRTEnabled = await getIsCRTEnabled(database);
            let serverName;
            if (Object.keys(DatabaseManager.serverDatabases).length > 1) {
                serverName = displayName;
            }
            const isThreadNotification = Boolean(payload?.root_id);
            const isSameChannelNotification = payload?.channel_id === channelId;
            const isSameThreadNotification = isThreadNotification && payload?.root_id === EphemeralStore.getCurrentThreadId();
            let isInChannelScreen = NavigationStore.getVisibleScreen() === Screens.CHANNEL;
            if (isTabletDevice) {
                isInChannelScreen = NavigationStore.getVisibleTab() === Screens.HOME;
            }
            const isInThreadScreen = NavigationStore.getVisibleScreen() === Screens.THREAD;
            const condition1 = !isInChannelScreen && !isInThreadScreen;
            const condition2 = isInChannelScreen && (!isSameChannelNotification || (isCRTEnabled && isThreadNotification));
            const condition3 = isInThreadScreen && !isSameThreadNotification;
            if (condition1 || condition2 || condition3) {
                DeviceEventEmitter.emit(Navigation.NAVIGATION_SHOW_OVERLAY);
                const screen = Screens.IN_APP_NOTIFICATION;
                const passProps = {
                    notification,
                    serverName,
                    serverUrl,
                };
                showOverlay(screen, passProps);
            }
        }
    };

    handleMessageNotification = async (notification) => {
        const {payload, foreground, userInteraction} = notification;
        const serverUrl = await this.getServerUrlFromNotification(notification);
        if (serverUrl) {
            if (foreground) {
                this.handleInAppNotification(serverUrl, notification);
            } else if (userInteraction && !payload?.userInfo?.local) {
                openNotification(serverUrl, notification);
            } else {
                backgroundNotification(serverUrl, notification);
            }
        }
    };

    handleSessionNotification = async (notification) => {
        logInfo('Session expired notification');
        const serverUrl = await this.getServerUrlFromNotification(notification);
        if (serverUrl) {
            if (notification.userInteraction) {
                DeviceEventEmitter.emit(Events.SESSION_EXPIRED, serverUrl);
            } else {
                DeviceEventEmitter.emit(Events.SERVER_LOGOUT, {serverUrl});
            }
        }
    };

    processNotification = async (notification) => {
        const {payload} = notification;
        if (payload) {
            switch (payload.type) {
                case PushNotification.NOTIFICATION_TYPE.CLEAR:
                    this.handleClearNotification(notification);
                    break;
                case PushNotification.NOTIFICATION_TYPE.MESSAGE:
                    this.handleMessageNotification(notification);
                    break;
                case PushNotification.NOTIFICATION_TYPE.SESSION:
                    this.handleSessionNotification(notification);
                    break;
                default:
                    break;
            }
        }
    };

    cancelScheduleNotification = (notificationId) => {
        JPush.removeLocalNotification(notificationId);
    };

    requestNotificationReplyPermissions = () => {
        // 极光推送不需要设置类似 react-native-notifications 中的回复权限
    };
}

export default new PushNotifications();
