import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REMINDER_SETTINGS_KEY = '@epexfit_reminder_settings';
const LAST_NOTIF_KEY        = '@epexfit_last_notif_ts';
const MIN_NOTIF_GAP_MS      = 3 * 60 * 60 * 1000;

export interface ReminderSettings {
  dailyMotivation: boolean;
  goalReminders: boolean;
  walking:  { enabled: boolean; time: string };
  workout:  { enabled: boolean; time: string };
  water:    { enabled: boolean; time: string };
  protein:  { enabled: boolean; time: string };
  fiber:    { enabled: boolean; time: string };
}

export interface SmartNotifParams {
  stepsToday:     number;
  stepGoal:       number;
  streak:         number;
  distanceToday?: number;
  distanceGoal?:  number;
  waterToday?:    number;
  waterGoal?:     number;
  lastActiveDate?: string;
}

export class NotificationService {

  async requestPermissionsAndCheck(): Promise<boolean> {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return false;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('epexfit', {
          name: 'EpexFit Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#F5C842',
        });
      }
      return true;
    } catch { return false; }
  }

  private async canSendNotif(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(LAST_NOTIF_KEY);
      if (!raw) return true;
      const { ts, count, date } = JSON.parse(raw);
      const today = new Date().toISOString().split('T')[0];
      if (date !== today) return true;
      if (count >= 2) return false;
      if (Date.now() - ts < MIN_NOTIF_GAP_MS) return false;
      return true;
    } catch { return true; }
  }

  private async recordNotifSent(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const raw = await AsyncStorage.getItem(LAST_NOTIF_KEY);
      const prev = raw ? JSON.parse(raw) : { ts: 0, count: 0, date: '' };
      const count = prev.date === today ? prev.count + 1 : 1;
      await AsyncStorage.setItem(LAST_NOTIF_KEY, JSON.stringify({ ts: Date.now(), count, date: today }));
    } catch {}
  }

  async sendImmediate(title: string, body: string, data?: Record<string, any>): Promise<void> {
    const ok = await this.requestPermissionsAndCheck();
    if (!ok) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {} },
      trigger: null,
    });
    await this.recordNotifSent();
  }

  async evaluateAndSend(params: SmartNotifParams): Promise<void> {
    const ok = await this.requestPermissionsAndCheck();
    if (!ok) return;
    if (!(await this.canSendNotif())) return;

    const hour = new Date().getHours();

    if (hour >= 20 && params.stepsToday < params.stepGoal && params.streak > 0) {
      const remaining = params.stepGoal - params.stepsToday;
      await this.sendImmediate(
        `🔥 ${params.streak}-day streak at risk!`,
        `${remaining.toLocaleString()} steps left to protect your streak. A 15-min walk does it.`
      );
      return;
    }

    if (hour === 15) {
      const expectedByNow = params.stepGoal * (hour / 24);
      if (params.stepsToday < expectedByNow * 0.5) {
        const behind = Math.round(expectedByNow - params.stepsToday);
        await this.sendImmediate(
          "⚡ You're behind pace",
          `${behind.toLocaleString()} steps behind for the day. A quick walk brings you back on track.`
        );
        return;
      }
    }

    if (hour >= 10 && hour <= 20 && (params.waterToday ?? 0) < (params.waterGoal ?? 8) * 0.5) {
      const glassesLeft = (params.waterGoal ?? 8) - (params.waterToday ?? 0);
      if (glassesLeft > 2) {
        await this.sendImmediate(
          '💧 Stay hydrated',
          `Drink ${glassesLeft} more glasses today to hit your water goal.`
        );
        return;
      }
    }

    if (params.lastActiveDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(params.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince >= 2 && hour >= 9 && hour <= 20) {
        await this.sendImmediate(
          "👋 It's been a while",
          `${daysSince} days since your last activity. Even 10 minutes counts — let's go!`
        );
        return;
      }
    }

    if (params.stepsToday >= params.stepGoal - 500 && params.stepsToday < params.stepGoal) {
      const left = params.stepGoal - params.stepsToday;
      await this.sendImmediate(
        '🎯 Almost there!',
        `Only ${left} steps to hit your daily goal. One short walk away!`
      );
      return;
    }
  }

  async scheduleWeeklyReport(params: {
    totalSteps: number;
    totalDistKm: number;
    activeDays: number;
    streak: number;
    bestDay: string;
  }): Promise<void> {
    const ok = await this.requestPermissionsAndCheck();
    if (!ok) return;

    const body = [
      `${params.totalSteps.toLocaleString()} steps · ${params.totalDistKm.toFixed(1)} km`,
      `${params.activeDays}/7 active days · ${params.streak} day streak 🔥`,
      params.bestDay ? `Best day: ${params.bestDay}` : '',
    ].filter(Boolean).join('\n');

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Your Week in Review',
        body,
        data: { type: 'weekly_report' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1,
        hour: 9,
        minute: 0,
      },
    });
  }

  async notifyBadgeUnlocked(badgeLabel: string, badgeIcon: string): Promise<void> {
    await this.sendImmediate(
      `${badgeIcon} New Badge Unlocked!`,
      `You earned "${badgeLabel}". Keep it up!`
    );
  }

  async getReminderSettings(): Promise<ReminderSettings | null> {
    try {
      const raw = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async scheduleReminders(settings: ReminderSettings): Promise<void> {
    try {
      const ok = await this.requestPermissionsAndCheck();
      if (!ok) return;
      await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
      await Notifications.cancelAllScheduledNotificationsAsync();

      const reminders = [
        { key: 'walking', title: '🚶 Time for a walk!',  body: 'Stay active — a 10-minute walk keeps the streak alive.' },
        { key: 'workout', title: '💪 Workout time!',      body: 'Your session is scheduled. Ready to crush it?' },
        { key: 'water',   title: '💧 Hydration check',    body: "How's your water intake? Hit those 8 glasses!" },
        { key: 'protein', title: '🥩 Protein reminder',   body: "Don't miss your protein goal today." },
        { key: 'fiber',   title: '🌿 Fiber reminder',     body: 'Add some veggies or fruit to hit your fiber goal.' },
      ];

      for (const r of reminders) {
        const s = settings[r.key as keyof ReminderSettings] as { enabled: boolean; time: string };
        if (!s?.enabled || !s.time) continue;
        const [hours, minutes] = s.time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;
        await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, data: { type: r.key } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hours,
            minute: minutes,
          },
        });
      }
    } catch (e) { console.error('scheduleReminders error:', e); }
  }

  getDefaultReminderSettings(): ReminderSettings {
    return {
      dailyMotivation: true, goalReminders: true,
      walking: { enabled: true, time: '09:00' },
      workout: { enabled: true, time: '17:00' },
      water:   { enabled: true, time: '12:00' },
      protein: { enabled: true, time: '15:00' },
      fiber:   { enabled: true, time: '19:00' },
    };
  }
}

export const notificationService = new NotificationService();
