/**
 * notificationStorage.ts — Persistent notification inbox
 *
 * Stores push notification payloads in AsyncStorage so users can
 * review them later in NotificationInboxScreen.
 *
 * Integration:
 *   In your Notifications.addNotificationReceivedListener callback:
 *     await notificationStorage.save(notification);
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────────────────

export type NotifType =
  | 'workout_reminder'
  | 'streak'
  | 'goal_achieved'
  | 'social_like'
  | 'social_comment'
  | 'weekly_report'
  | 'system';

export interface StoredNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  receivedAt: number; // unix ms
  isRead: boolean;
  /** Deep-link target, e.g. 'WorkoutDetail' */
  navigateTo?: string;
  navigateParams?: Record<string, unknown>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STORE_KEY = '@epexfit_notif_inbox';
const MAX_STORED = 100;

// ── Helpers ────────────────────────────────────────────────────────────────

async function readAll(): Promise<StoredNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredNotification[];
  } catch {
    return [];
  }
}

async function persist(items: StoredNotification[]): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(items));
}

// ── Public API ─────────────────────────────────────────────────────────────

export const notificationStorage = {
  /**
   * Save a new incoming notification. Trims to MAX_STORED.
   */
  async save(notif: Omit<StoredNotification, 'isRead'>): Promise<void> {
    const all = await readAll();
    const entry: StoredNotification = { ...notif, isRead: false };
    // Prepend newest first, cap at MAX_STORED
    const updated = [entry, ...all].slice(0, MAX_STORED);
    await persist(updated);
  },

  /**
   * Get all stored notifications (newest first).
   */
  async getAll(): Promise<StoredNotification[]> {
    return readAll();
  },

  /**
   * Count unread notifications.
   */
  async unreadCount(): Promise<number> {
    const all = await readAll();
    return all.filter((n) => !n.isRead).length;
  },

  /**
   * Mark a single notification as read.
   */
  async markRead(id: string): Promise<void> {
    const all = await readAll();
    const updated = all.map((n) =>
      n.id === id ? { ...n, isRead: true } : n,
    );
    await persist(updated);
  },

  /**
   * Mark all notifications as read.
   */
  async markAllRead(): Promise<void> {
    const all = await readAll();
    const updated = all.map((n) => ({ ...n, isRead: true }));
    await persist(updated);
  },

  /**
   * Delete a single notification.
   */
  async delete(id: string): Promise<void> {
    const all = await readAll();
    await persist(all.filter((n) => n.id !== id));
  },

  /**
   * Clear all stored notifications.
   */
  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORE_KEY);
  },
};
