import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logError } from './log';

const CHANNEL_ID = 'jagkan';
const REMINDER_ID = 'jk-daily-reminder';

let configured = false;

/** Show notifications while the app is open, too. Call once at startup. */
export function configureNotifications(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'JagKan!',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch (error) {
    logError('notifications.permission', error);
    return false;
  }
}

/** Expo push token for the parent's device (cloud mode). Returns null in simulators/Expo Go. */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    if (!(await requestNotificationPermission())) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    logError('notifications.token', error);
    return null;
  }
}

/** Daily local reminder so the family remembers to play (spec 1: "påminnelser sker automatiskt"). */
export async function scheduleDailyReminder(hour: number, title: string, body: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
    if (!(await requestNotificationPermission())) return;
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title, body, data: { url: '/' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL_ID },
    });
  } catch (error) {
    logError('notifications.schedule', error);
  }
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
}

/** Show a notification right away (used for on-device events). */
export async function notifyNow(title: string, body: string, url: string): Promise<void> {
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({ content: { title, body, data: { url } }, trigger: null });
  } catch (error) {
    logError('notifications.now', error);
  }
}

/** Subscribe to taps on notifications; the callback receives the deep link (e.g. /approve/123). */
export function onNotificationTap(callback: (url: string) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') callback(url);
  });
  return () => subscription.remove();
}
