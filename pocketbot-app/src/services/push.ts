/**
 * Expo push notification service.
 *
 * Handles permission requests, token registration with the pocketbot server,
 * and incoming notification handling.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { ServerConnection } from './storage';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request push notification permissions and get the Expo push token.
 * Returns null if permissions denied or not on a physical device.
 */
export async function getExpoPushToken(): Promise<string | null> {
  // Push only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check / request permissions
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    return tokenData.data; // "ExponentPushToken[...]"
  } catch (e) {
    console.error('Failed to get push token:', e);
    return null;
  }
}

/**
 * Register the push token with the pocketbot server.
 */
export async function registerPushToken(
  conn: ServerConnection,
  token: string,
): Promise<boolean> {
  try {
    const base = conn.url.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (conn.secret) {
      headers['Authorization'] = `Bearer ${conn.secret}`;
    }
    const res = await fetch(`${base}/api/push/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Unregister the push token from the pocketbot server.
 */
export async function unregisterPushToken(
  conn: ServerConnection,
  token: string,
): Promise<boolean> {
  try {
    const base = conn.url.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (conn.secret) {
      headers['Authorization'] = `Bearer ${conn.secret}`;
    }
    const res = await fetch(`${base}/api/push/register`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Set up the Android notification channel (required for Android 8+).
 */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'pocketbot',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0ea5e9',
    });
  }
}

/**
 * Add a listener for when a notification is tapped (app opened from notification).
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
