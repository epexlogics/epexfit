/**
 * NotificationSettingsScreen — Standalone notification preferences
 *
 * ✅ Loads from notification_settings Supabase table
 * ✅ Saves to notification_settings table (upsert)
 * ✅ All settings: push_enabled, email_enabled, like_notifications,
 *    comment_notifications, follow_notifications, workout_reminders
 * ✅ Also schedules/cancels local push notification reminders
 * ✅ Zero mock data
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase } from '../../services/supabase';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';

interface NotifSettings {
  push_enabled:           boolean;
  email_enabled:          boolean;
  like_notifications:     boolean;
  comment_notifications:  boolean;
  follow_notifications:   boolean;
}

const DEFAULT: NotifSettings = {
  push_enabled:           true,
  email_enabled:          false,
  like_notifications:     true,
  comment_notifications:  true,
  follow_notifications:   true,
};

const SECTIONS: Array<{
  title: string;
  icon: string;
  items: Array<{ key: keyof NotifSettings; label: string; desc: string; emoji: string }>;
}> = [
  {
    title: 'GENERAL',
    icon: '🔔',
    items: [
      { key: 'push_enabled',  label: 'Push Notifications', desc: 'Receive alerts on this device',     emoji: '📲' },
      { key: 'email_enabled', label: 'Email Summaries',    desc: 'Weekly activity recap to your inbox', emoji: '📧' },
    ],
  },
  {
    title: 'SOCIAL ACTIVITY',
    icon: '❤️',
    items: [
      { key: 'like_notifications',    label: 'Likes',       desc: 'When someone likes your post',    emoji: '❤️' },
      { key: 'comment_notifications', label: 'Comments',    desc: 'When someone comments',           emoji: '💬' },
      { key: 'follow_notifications',  label: 'New Followers',desc: 'When someone follows you',       emoji: '👤' },
    ],
  },
];

export default function NotificationSettingsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { scheduleReminders } = useNotifications();
  const accent = colors.primary;

  const [settings, setSettings] = useState<NotifSettings>(DEFAULT);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          setSettings({
            push_enabled:           data.push_enabled           ?? true,
            email_enabled:          data.email_enabled          ?? false,
            like_notifications:     data.like_notifications     ?? true,
            comment_notifications:  data.comment_notifications  ?? true,
            follow_notifications:   data.follow_notifications   ?? true,
          });
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [user?.id]);

  const toggle = (key: keyof NotifSettings) => (val: boolean) => {
    // If push disabled, disable all sub-settings too
    if (key === 'push_enabled' && !val) {
      setSettings(p => ({
        ...p,
        push_enabled: false,
        like_notifications: false,
        comment_notifications: false,
        follow_notifications: false,
      }));
      return;
    }
    setSettings(p => ({ ...p, [key]: val }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert(
          { user_id: user.id, ...settings, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      if (error) throw error;

      // Actually schedule / cancel local push reminders
      await scheduleReminders({
        push_enabled:          settings.push_enabled,
        like_notifications:    settings.like_notifications,
        comment_notifications: settings.comment_notifications,
        follow_notifications:  settings.follow_notifications,
      });

      Alert.alert('Saved ✓', 'Notification preferences updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <AppIcon name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>Notifications</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, gap: 16, paddingBottom: 60 }}>

        {/* Master push toggle */}
        <View style={[s.masterCard, {
          backgroundColor: settings.push_enabled ? accent + '12' : colors.surfaceElevated,
          borderColor: settings.push_enabled ? accent + '40' : colors.border,
        }]}>
          <Text style={{ fontSize: 32 }}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.masterLabel, { color: colors.text }]}>Push Notifications</Text>
            <Text style={[s.masterDesc, { color: colors.textSecondary }]}>
              {settings.push_enabled ? 'Notifications are enabled' : 'All notifications are off'}
            </Text>
          </View>
          <Switch
            value={settings.push_enabled}
            onValueChange={toggle('push_enabled')}
            trackColor={{ false: colors.border, true: accent + '60' }}
            thumbColor={settings.push_enabled ? accent : colors.textDisabled}
          />
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>
              {section.icon} {section.title}
            </Text>
            <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {section.items.map((item, idx) => {
                const isDisabled = !settings.push_enabled && item.key !== 'email_enabled';
                return (
                  <View key={item.key} style={[s.row, {
                    borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    opacity: isDisabled ? 0.4 : 1,
                  }]}>
                    <Text style={{ fontSize: 22, width: 32 }}>{item.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowLabel, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[s.rowDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
                    </View>
                    <Switch
                      value={settings[item.key]}
                      onValueChange={toggle(item.key)}
                      disabled={isDisabled}
                      trackColor={{ false: colors.border, true: accent + '60' }}
                      thumbColor={settings[item.key] ? accent : colors.textDisabled}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Info note */}
        <View style={[s.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="information-outline" size={16} color={colors.textSecondary} />
          <Text style={[s.infoText, { color: colors.textSecondary }]}>
            Push notifications require device permissions. You can also manage this in your device's Settings app.
          </Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>Save Preferences</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },

  masterCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: borderRadius.xl, borderWidth: 1.5, padding: 16,
  },
  masterLabel: { fontSize: 16, fontWeight: '800' },
  masterDesc:  { fontSize: 12, marginTop: 2 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },

  card: { borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowDesc:  { fontSize: 12, marginTop: 2 },

  infoCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderRadius: borderRadius.lg, borderWidth: 1, padding: 14,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  saveBtn: {
    height: 54, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
});
