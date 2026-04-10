/**
 * NotificationInboxScreen
 *
 * - Lists all stored push notifications (read/unread)
 * - Unread shown with accent-coloured left border + bold text
 * - Tap → mark read + navigate to relevant screen
 * - Swipe-to-delete (using Pressable long-press fallback for simplicity)
 * - "Mark all read" + "Clear all" actions in header
 * - Bell badge with unread count (used in MainNavigator tab)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import dayjs from '../utils/dayjs';
import { useTheme } from '../context/ThemeContext';
import AppIcon from '../components/AppIcon';
import EmptyState from '../components/EmptyState';
import {
  notificationStorage,
  StoredNotification,
  NotifType,
} from '../services/notificationStorage';
import { borderRadius, spacing } from '../constants/theme';
import { TAB_BAR_HEIGHT } from '../constants/layout';

// PRODUCTION FIX: relativeTime plugin ki jagah pure JS — Hermes safe
function timeAgo(date: string | Date | number): string {
  const now = Date.now();
  const then = typeof date === 'number' ? date : new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}


// ── Metadata ───────────────────────────────────────────────────────────────

const TYPE_META: Record<NotifType, { icon: string; color: string; label: string }> = {
  workout_reminder: { icon: 'dumbbell',     color: '#22D3EE', label: 'Workout' },
  streak:           { icon: 'fire',         color: '#FB923C', label: 'Streak'  },
  goal_achieved:    { icon: 'target',       color: '#4ADE80', label: 'Goal'    },
  social_like:      { icon: 'heart',        color: '#FB7185', label: 'Like'    },
  social_comment:   { icon: 'comment',      color: '#A78BFA', label: 'Comment' },
  weekly_report:    { icon: 'chart-bar',    color: '#38BDF8', label: 'Report'  },
  system:           { icon: 'information',  color: '#94A3B8', label: 'System'  },
};

// ── Bell Badge (export for use in tab bar) ─────────────────────────────────

export function BellBadge({ count }: { count: number }) {
  const { accent } = useTheme();
  if (count === 0) return null;
  return (
    <View style={[bb.badge, { backgroundColor: accent }]}>
      <Text style={bb.text}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

const bb = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  text: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

// ── Notification Card ──────────────────────────────────────────────────────

function NotifCard({
  item,
  onPress,
  onDelete,
}: {
  item: StoredNotification;
  onPress: (n: StoredNotification) => void;
  onDelete: (id: string) => void;
}) {
  const { colors, accent } = useTheme();
  const meta = TYPE_META[item.type] ?? TYPE_META.system;

  return (
    <TouchableOpacity
      style={[
        nC.card,
        {
          backgroundColor: item.isRead ? colors.surface : colors.surfaceElevated,
          borderColor: item.isRead ? colors.border : meta.color + '50',
          borderLeftColor: item.isRead ? colors.border : meta.color,
          borderLeftWidth: item.isRead ? StyleSheet.hairlineWidth : 3,
        },
      ]}
      onPress={() => onPress(item)}
      onLongPress={() =>
        Alert.alert('Delete Notification', 'Remove this notification?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
        ])
      }
      activeOpacity={0.75}
    >
      <View style={[nC.iconWrap, { backgroundColor: meta.color + '18' }]}>
        <AppIcon name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={nC.titleRow}>
          <Text
            style={[
              nC.title,
              { color: colors.text, fontWeight: item.isRead ? '500' : '700' },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {!item.isRead && (
            <View style={[nC.unreadDot, { backgroundColor: accent }]} />
          )}
        </View>
        <Text style={[nC.body, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[nC.time, { color: colors.textDisabled }]}>
          {timeAgo(item.receivedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const nC = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: spacing.md,
    marginBottom: 8,
    padding: 14,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  body: { fontSize: 13, lineHeight: 18 },
  time: { fontSize: 11 },
});

// ── Screen ─────────────────────────────────────────────────────────────────

export default function NotificationInboxScreen() {
  const { colors, accent } = useTheme();
  const navigation = useNavigation<any>();
  const [notifs, setNotifs] = useState<StoredNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const all = await notificationStorage.getAll();
    setNotifs(all);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handlePress = useCallback(async (n: StoredNotification) => {
    await notificationStorage.markRead(n.id);
    setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    if (n.navigateTo) {
      navigation.navigate(n.navigateTo, n.navigateParams ?? {});
    }
  }, [navigation]);

  const handleDelete = useCallback(async (id: string) => {
    await notificationStorage.delete(id);
    setNotifs((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    await notificationStorage.markAllRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear All', 'Remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await notificationStorage.clearAll();
          setNotifs([]);
        },
      },
    ]);
  }, []);

  const unread = notifs.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={[iS.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <AppIcon name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={iS.headerCenter}>
          <Text style={[iS.headerTitle, { color: colors.text }]}>Notifications</Text>
          {unread > 0 && (
            <View style={[iS.badge, { backgroundColor: accent }]}>
              <Text style={iS.badgeText}>{unread}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {unread > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <AppIcon name="check-all" size={22} color={accent} />
            </TouchableOpacity>
          )}
          {notifs.length > 0 && (
            <TouchableOpacity onPress={handleClearAll}>
              <AppIcon name="delete-sweep" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={notifs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotifCard item={item} onPress={handlePress} onDelete={handleDelete} />
        )}
        contentContainerStyle={[
          { paddingTop: 12, paddingBottom: TAB_BAR_HEIGHT + 24 },
          notifs.length === 0 && { flex: 1 },
        ]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <EmptyState
            icon="bell-off"
            title="No notifications yet"
            message="Your workout reminders, streak alerts, and social activity will appear here."
          />
        }
      />
    </SafeAreaView>
  );
}

const iS = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
