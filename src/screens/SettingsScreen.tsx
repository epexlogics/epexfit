/**
 * SettingsScreen
 *
 * Sections:
 * - Appearance  : dark / light mode toggle
 * - Units       : metric / imperial (stored at @epexfit_unit_system)
 * - Notifications: toggle types + times
 * - Privacy     : analytics toggle
 * - Linked accounts: Google OAuth (shows connected state)
 * - Data        : clear cache, export, delete account
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import AppIcon from '../components/AppIcon';
import { borderRadius, spacing } from '../constants/theme';
import { UNIT_SYSTEM_KEY, type UnitSystem } from '../utils/units';

// ── Constants ──────────────────────────────────────────────────────────────

export { UNIT_SYSTEM_KEY, type UnitSystem };
export const PRIVACY_KEY     = '@epexfit_privacy_analytics';
export const NOTIF_PREF_KEY  = '@epexfit_notif_preferences';

export interface NotifPreferences {
  workoutReminder: boolean;
  workoutReminderTime: string;   // 'HH:MM' 24-h
  streakAlert: boolean;
  weeklyReport: boolean;
  goalProgress: boolean;
}

const DEFAULT_NOTIF: NotifPreferences = {
  workoutReminder: true,
  workoutReminderTime: '08:00',
  streakAlert: true,
  weeklyReport: true,
  goalProgress: true,
};

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={sS.section}>
      <Text style={[sS.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[sS.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  right,
  destructive = false,
  showChevron = false,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
  showChevron?: boolean;
}) {
  const { colors, accent } = useTheme();
  return (
    <TouchableOpacity
      style={sS.row}
      onPress={onPress}
      disabled={!onPress && !right}
      activeOpacity={0.7}
    >
      <AppIcon name={icon} size={20} color={destructive ? colors.error : accent} />
      <Text style={[sS.rowLabel, { color: destructive ? colors.error : colors.text }]}>{label}</Text>
      {value ? <Text style={[sS.rowValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      {right}
      {showChevron && <AppIcon name="chevron-right" size={16} color={colors.textDisabled} />}
    </TouchableOpacity>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[sS.divider, { backgroundColor: colors.divider }]} />;
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const { show } = useToast();
  const navigation = useNavigation();

  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [darkMode, setDarkMode] = useState(true);
  const [privacyAnalytics, setPrivacyAnalytics] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState<NotifPreferences>(DEFAULT_NOTIF);
  const [clearingCache, setClearingCache] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);

  // ── Load persisted settings ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [unit, privacy, notif] = await Promise.all([
        AsyncStorage.getItem(UNIT_SYSTEM_KEY),
        AsyncStorage.getItem(PRIVACY_KEY),
        AsyncStorage.getItem(NOTIF_PREF_KEY),
      ]);
      if (unit) setUnitSystem(unit as UnitSystem);
      if (privacy !== null) setPrivacyAnalytics(privacy === 'true');
      if (notif) {
        try { setNotifPrefs(JSON.parse(notif)); } catch {}
      }

      // Check Google OAuth link via Supabase identities
      // Lazy import to avoid hard coupling
      try {
        const { supabase } = await import('../services/supabase');
        const { data: { user: u } } = await supabase.auth.getUser();
        const identities = u?.identities ?? [];
        setGoogleLinked(identities.some((i) => i.provider === 'google'));
      } catch {}
    })();
  }, []);

  // ── Persist helpers ──────────────────────────────────────────────────────
  const toggleUnit = useCallback(async (val: UnitSystem) => {
    setUnitSystem(val);
    await AsyncStorage.setItem(UNIT_SYSTEM_KEY, val);
    show({ message: `Units switched to ${val}`, variant: 'success', duration: 2000 });
  }, [show]);

  const toggleNotifPref = useCallback(async (key: keyof NotifPreferences, val: boolean) => {
    const updated = { ...notifPrefs, [key]: val };
    setNotifPrefs(updated);
    await AsyncStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(updated));
  }, [notifPrefs]);

  const togglePrivacy = useCallback(async (val: boolean) => {
    setPrivacyAnalytics(val);
    await AsyncStorage.setItem(PRIVACY_KEY, String(val));
  }, []);

  // ── Dark mode ────────────────────────────────────────────────────────────
  // ThemeContext already persists the value; we just fire the toggle.
  const { toggleTheme, isDark } = useTheme() as ReturnType<typeof useTheme> & { toggleTheme?: () => void; isDark?: boolean };

  // ── Clear cache ──────────────────────────────────────────────────────────
  const handleClearCache = useCallback(async () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all offline-cached data. Your account and logged data are safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter((k) => k.startsWith('@epexfit_cache'));
              await AsyncStorage.multiRemove(cacheKeys);
              show({ message: `Cleared ${cacheKeys.length} cached items`, variant: 'success' });
            } catch (err) {
              show({ message: 'Failed to clear cache', variant: 'error' });
            } finally {
              setClearingCache(false);
            }
          },
        },
      ],
    );
  }, [show]);

  // ── Google link ──────────────────────────────────────────────────────────
  const handleLinkGoogle = useCallback(async () => {
    try {
      const { supabase } = await import('../services/supabase');
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (err) {
      show({ message: 'Google link failed. Try again.', variant: 'error' });
    }
  }, [show]);

  // ── Delete account ───────────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Type DELETE in the next step would confirm. For now this routes to support.',
              [{ text: 'Contact Support', onPress: () => Linking.openURL('mailto:support@epexfit.com?subject=Account%20Deletion%20Request') }, { text: 'Cancel', style: 'cancel' }],
            );
          },
        },
      ],
    );
  }, []);

  // ── Export Data ──────────────────────────────────────────────────────────
  const [exportingData, setExportingData] = useState(false);
  const handleExportData = useCallback(async () => {
    if (!user) return;
    setExportingData(true);
    try {
      const { supabase } = await import('../services/supabase');
      const [{ data: workouts }, { data: foodLogs }, { data: dailyLogs }, { data: activities }] =
        await Promise.all([
          supabase.from('workouts').select('*').eq('user_id', user.id),
          supabase.from('food_logs').select('*').eq('user_id', user.id),
          supabase.from('daily_logs').select('*').eq('user_id', user.id),
          supabase.from('activities').select('*').eq('user_id', user.id),
        ]);
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        userId: user.id,
        workouts: workouts ?? [],
        foodLogs: foodLogs ?? [],
        dailyLogs: dailyLogs ?? [],
        activities: activities ?? [],
      };
      const json = JSON.stringify(exportPayload, null, 2);
      const fileUri = `${FileSystem.cacheDirectory}epexfit_export_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export EpexFit Data',
          UTI: 'public.json',
        });
      } else {
        show({ message: 'Sharing is not available on this device.', variant: 'error' });
      }
    } catch (err: any) {
      show({ message: err?.message ?? 'Export failed. Please try again.', variant: 'error' });
    } finally {
      setExportingData(false);
    }
  }, [user, show]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[sS.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <AppIcon name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[sS.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={sS.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <Section title="APPEARANCE">
          <Row
            icon="weather-night"
            label="Dark Mode"
            right={
              <Switch
                value={isDark ?? true}
                onValueChange={() => toggleTheme?.()}
                trackColor={{ false: colors.border, true: '#22D3EE55' }}
                thumbColor={isDark ? '#22D3EE' : colors.textDisabled}
              />
            }
          />
        </Section>

        {/* Units */}
        <Section title="UNITS">
          <Row
            icon="ruler"
            label="Metric (km, kg)"
            right={
              <Switch
                value={unitSystem === 'metric'}
                onValueChange={(v) => toggleUnit(v ? 'metric' : 'imperial')}
                trackColor={{ false: colors.border, true: '#22D3EE55' }}
                thumbColor={unitSystem === 'metric' ? '#22D3EE' : colors.textDisabled}
              />
            }
          />
          <Divider />
          <Row
            icon="flag"
            label="Imperial (mi, lb)"
            right={
              <Switch
                value={unitSystem === 'imperial'}
                onValueChange={(v) => toggleUnit(v ? 'imperial' : 'metric')}
                trackColor={{ false: colors.border, true: '#22D3EE55' }}
                thumbColor={unitSystem === 'imperial' ? '#22D3EE' : colors.textDisabled}
              />
            }
          />
        </Section>

        {/* Notifications */}
        <Section title="NOTIFICATIONS">
          <Row
            icon="dumbbell"
            label="Workout Reminder"
            value={notifPrefs.workoutReminder ? notifPrefs.workoutReminderTime : ''}
            right={
              <Switch
                value={notifPrefs.workoutReminder}
                onValueChange={(v) => toggleNotifPref('workoutReminder', v)}
                trackColor={{ false: colors.border, true: '#22D3EE55' }}
                thumbColor={notifPrefs.workoutReminder ? '#22D3EE' : colors.textDisabled}
              />
            }
          />
          <Divider />
          <Row
            icon="fire"
            label="Streak Alerts"
            right={
              <Switch
                value={notifPrefs.streakAlert}
                onValueChange={(v) => toggleNotifPref('streakAlert', v)}
                trackColor={{ false: colors.border, true: '#22D3EE55' }}
                thumbColor={notifPrefs.streakAlert ? '#22D3EE' : colors.textDisabled}
              />
            }
          />
          <Divider />
          <Row
            icon="chart-bar"
            label="Weekly Report"
            right={
              <Switch
                value={notifPrefs.weeklyReport}
                onValueChange={(v) => toggleNotifPref('weeklyReport', v)}
                trackColor={{ false: colors.border, true: '#22D3EE55' }}
                thumbColor={notifPrefs.weeklyReport ? '#22D3EE' : colors.textDisabled}
              />
            }
          />
          <Divider />
          <Row
            icon="target"
            label="Goal Progress"
            right={
              <Switch
                value={notifPrefs.goalProgress}
                onValueChange={(v) => toggleNotifPref('goalProgress', v)}
                trackColor={{ false: colors.border, true: '#22D3EE55' }}
                thumbColor={notifPrefs.goalProgress ? '#22D3EE' : colors.textDisabled}
              />
            }
          />
        </Section>

        {/* Privacy */}
        <Section title="PRIVACY">
          <Row
            icon="shield-check"
            label="Analytics & Crash Reports"
            right={
              <Switch
                value={privacyAnalytics}
                onValueChange={togglePrivacy}
                trackColor={{ false: colors.border, true: '#22D3EE55' }}
                thumbColor={privacyAnalytics ? '#22D3EE' : colors.textDisabled}
              />
            }
          />
        </Section>

        {/* Linked Accounts */}
        <Section title="LINKED ACCOUNTS">
          <Row
            icon="google"
            label="Google"
            value={googleLinked ? 'Connected' : 'Not linked'}
            onPress={googleLinked ? undefined : handleLinkGoogle}
            right={
              googleLinked ? (
                <View style={[sS.badge, { backgroundColor: '#22C55E22' }]}>
                  <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '700' }}>✓ Linked</Text>
                </View>
              ) : (
                <View style={[sS.badge, { backgroundColor: '#22D3EE22' }]}>
                  <Text style={{ color: '#22D3EE', fontSize: 12, fontWeight: '700' }}>Link →</Text>
                </View>
              )
            }
          />
        </Section>

        {/* Data */}
        <Section title="DATA & STORAGE">
          <Row
            icon="broom"
            label="Clear Offline Cache"
            onPress={handleClearCache}
            showChevron={!clearingCache}
            right={
              clearingCache ? <ActivityIndicator size="small" color={colors.textSecondary} /> : undefined
            }
          />
          <Divider />
          <Row
            icon="export"
            label="Export My Data"
            onPress={handleExportData}
            showChevron={!exportingData}
            right={exportingData ? <ActivityIndicator size="small" color={colors.textSecondary} /> : undefined}
          />
        </Section>

        {/* Account */}
        <Section title="ACCOUNT">
          <Row
            icon="logout"
            label="Sign Out"
            onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ])}
          />
          <Divider />
          <Row
            icon="delete"
            label="Delete Account"
            destructive
            onPress={handleDeleteAccount}
          />
        </Section>

        <Text style={[sS.version, { color: colors.textDisabled }]}>
          EpexFit v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const sS = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: spacing.md, paddingBottom: 120 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: borderRadius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowValue: { fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  version: { fontSize: 12, textAlign: 'center', marginTop: 32, marginBottom: 8 },
});
