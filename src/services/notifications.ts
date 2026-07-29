import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { getSubscriptions, getSIPs, getSetting } from './db';

// Check if running inside Expo Go store client sandbox (where expo-notifications is disabled in SDK 53+)
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.warn('expo-notifications initialization skipped:', error);
  }
}

/**
 * Request user permission for push/local notifications
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || !Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Reschedule all active bill, subscription, and SIP payment reminders
 */
export async function rescheduleAllReminders(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  try {
    const enabled = await getSetting('bill_reminders_enabled', 'true');
    if (enabled !== 'true') {
      // Cancel all existing scheduled bill/SIP notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      // Re-schedule daily logger if enabled
      await syncDailyLoggingReminder();
      return;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Clear previous bill/SIP notifications before rescheduling
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allScheduled) {
      if (notification.content.data?.type === 'bill_reminder' || notification.content.data?.type === 'sip_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    const now = new Date();

    // 1. Schedule Subscription Billing Reminders
    const subscriptions = await getSubscriptions();
    for (const sub of subscriptions) {
      if (sub.status !== 'active') continue;

      const dueDate = new Date(sub.next_billing_date);
      // Schedule reminder 1 day prior at 9:00 AM
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      reminderDate.setHours(9, 0, 0, 0);

      if (reminderDate > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💳 Bill Reminder: ${sub.name}`,
            body: `Your payment of $${sub.amount.toFixed(2)} for ${sub.name} is due tomorrow (${sub.next_billing_date}).`,
            data: { type: 'bill_reminder', id: sub.id },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
          },
        });
      }
    }

    // 2. Schedule SIP Payment Reminders
    const sips = await getSIPs();
    for (const sip of sips) {
      if (sip.status !== 'active') continue;

      const dueDate = new Date(sip.next_date);
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      reminderDate.setHours(9, 0, 0, 0);

      if (reminderDate > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `📈 SIP Payment Reminder: ${sip.name}`,
            body: `Your SIP installment of $${sip.amount.toFixed(2)} for ${sip.name} is scheduled for tomorrow (${sip.next_date}).`,
            data: { type: 'sip_reminder', id: sip.id },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
          },
        });
      }
    }

    // Sync daily reminder
    await syncDailyLoggingReminder();
  } catch (error) {
    console.error('Error rescheduling notification reminders:', error);
  }
}

/**
 * Configure or update daily expense logging notification
 */
export async function syncDailyLoggingReminder(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  try {
    const dailyEnabled = await getSetting('daily_reminder_enabled', 'false');
    const reminderTime = await getSetting('daily_reminder_time', '20:00'); // Default 8:00 PM

    // First cancel previous daily logger notification
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allScheduled) {
      if (notification.content.data?.type === 'daily_logger') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    if (dailyEnabled === 'true') {
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) return;

      const [hoursStr, minutesStr] = reminderTime.split(':');
      const hour = parseInt(hoursStr || '20', 10);
      const minute = parseInt(minutesStr || '0', 10);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📝 Daily Pocket Flow Check-in',
          body: 'Take 30 seconds to log your expenses and track your daily financial goals!',
          data: { type: 'daily_logger' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    }
  } catch (error) {
    console.error('Error syncing daily logging reminder:', error);
  }
}
