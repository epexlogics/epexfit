import React, { useEffect, useState } from 'react';
import {
  Alert, Platform, RefreshControl, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AppIcon from '../../components/AppIcon';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { notificationService } from '../../services/notifications';
import { databaseService } from '../../services/database';
import { recalculateStreak, getUnlockedBadgeIds } from '../../services/streaks';
import { calculateAPS } from '../../utils/performanceScore';
import { BADGE_DEFINITIONS } from '../../constants/badges';
import { borderRadius, spacing } from '../../constants/theme';
import moment from 'moment';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 100 : 88;

export default function ProfileScreen() {
  const { user, signOut, updateProfile, deleteAccount } = useAuth();
  const { colors, setMode, mode } = useTheme();
  const { scheduleReminders } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: user?.fullName ?? '',
    height: user?.height?.toString() ?? '',
    weight: user?.weight?.toString() ?? '',
  });
  const [streak, setStreak] = useState(0);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<string[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [apsScore, setApsScore] = useState(0);

  const [reminderSettings, setReminderSettings] = useState({
    dailyMotivation: true,
    goalReminders: true,
    walking:  { enabled: true, time: '09:00' },
    workout:  { enabled: true, time: '17:00' },
    water:    { enabled: true, time: '12:00' },
    protein:  { enabled: true, time: '15:00' },
    fiber:    { enabled: true, time: '19:00' },
  });

  const loadData = async () => {
    if (!user) return;
    const [saved, s, badgeIds, { data: acts }] = await Promise.all([
      notificationService.getReminderSettings(),
      recalculateStreak(user.id),
      getUnlockedBadgeIds(user.id),
      databaseService.getActivities(user.id),
    ]);
    if (saved) setReminderSettings(saved);
    setStreak(s);
    setUnlockedBadgeIds(badgeIds);
    const acts_ = acts ?? [];
    setTotalActivities(acts_.length);
    setTotalDistance(acts_.reduce((sum, a) => sum + (a.distance ?? 0), 0));

    // APS from today's log
    const { data: log } = await databaseService.getDailyLog(user.id, new Date());
    const aps = calculateAPS({
      plannedWorkouts: 5, completedWorkouts: acts_.filter(a => moment(a.startTime).isSame(moment(), 'week')).length,
      stepGoal: 10000, stepsToday: log?.steps ?? 0,
      calGoal: 500, calBurned: log?.calories ?? 0,
      proteinGoal: 120, proteinActual: log?.protein ?? 0,
      waterGoal: 8, waterActual: log?.water ?? 0,
      sleepHours: log?.sleep ?? 0, mood: log?.mood ?? 3,
    });
    setApsScore(aps.total);
  };

  useEffect(() => { loadData(); }, [user?.id]);
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const handleSaveProfile = async () => {
    const { success, error } = await updateProfile({
      fullName: editForm.fullName,
      height: parseFloat(editForm.height) || undefined,
      weight: parseFloat(editForm.weight) || undefined,
    });
    if (success) { setIsEditing(false); Alert.alert('Saved', 'Profile updated'); }
    else Alert.alert('Error', error?.message || 'Failed to update profile');
  };

  const handleSignOut = () => Alert.alert('Sign Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
  ]);

  const handleDeleteAccount = () => Alert.alert(
    'Delete Account',
    'This permanently deletes your account and all data. Cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { success, error } = await deleteAccount();
        if (!success) Alert.alert('Error', error?.message ?? 'Failed to delete account.');
      }},
    ]
  );

  const handleSaveReminders = async () => {
    await scheduleReminders(reminderSettings);
    await notificationService.scheduleReminders(reminderSettings);
    Alert.alert('Saved', 'Reminders updated');
  };

  const getBMI = () => {
    if (!user?.height || !user?.weight) return null;
    const h = user.height / 100;
    return (user.weight / (h * h)).toFixed(1);
  };
  const getBMICategory = () => {
    const bmi = parseFloat(getBMI() ?? '0');
    if (!bmi) return 'N/A';
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const REMINDER_KEYS = ['walking', 'workout', 'water', 'protein', 'fiber'] as const;
  const REMINDER_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    walking: { label: 'Walking',  icon: 'walk',       color: '#6C8EFF' },
    workout: { label: 'Workout',  icon: 'dumbbell',   color: colors.primary },
    water:   { label: 'Water',    icon: 'water',      color: '#4D9FFF' },
    protein: { label: 'Protein',  icon: 'food-steak', color: '#C084FC' },
    fiber:   { label: 'Fiber',    icon: 'leaf',       color: '#4ADE80' },
  };

  const accent = colors.primary;
  const unlockedCount = unlockedBadgeIds.length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 20, padding: spacing.md }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}
    >
      {/* Profile Hero */}
      <View style={[styles.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
          <View style={[styles.avatarWrap, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: 80, height: 80, borderRadius: 28 }} />
            ) : (
              <Text style={[styles.avatarLetter, { color: accent }]}>
                {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
              </Text>
            )}
            <View style={styles.cameraOverlay}><Text style={{ fontSize: 14 }}>📷</Text></View>
          </View>
        </TouchableOpacity>

        {!isEditing ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.fullName}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            {/* Streak badge */}
            {streak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: '#FF6B0020', borderColor: '#FF6B0050' }]}>
                <Text style={{ fontSize: 16 }}>🔥</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#FF9500' }}>{streak}</Text>
                <Text style={{ fontSize: 11, color: '#FF9500', fontWeight: '600' }}>day streak</Text>
              </View>
            )}
            <TouchableOpacity style={[styles.editBtn, { borderColor: accent + '60', backgroundColor: accent + '10' }]} onPress={() => setIsEditing(true)}>
              <AppIcon name="pencil" size={13} color={accent} />
              <Text style={{ fontSize: 12, color: accent, fontWeight: '700' }}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.editForm}>
            {[
              { label: 'Full Name', val: editForm.fullName, key: 'fullName', keyboard: 'default' },
              { label: 'Height (cm)', val: editForm.height, key: 'height', keyboard: 'numeric' },
              { label: 'Weight (kg)', val: editForm.weight, key: 'weight', keyboard: 'numeric' },
            ].map((f) => (
              <TextInput key={f.key}
                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                value={f.val}
                onChangeText={(v) => setEditForm(p => ({ ...p, [f.key]: v }))}
                placeholder={f.label} placeholderTextColor={colors.textSecondary}
                keyboardType={f.keyboard as any}
              />
            ))}
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setIsEditing(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accent }]} onPress={handleSaveProfile}>
                <Text style={{ color: '#000', fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Stats Overview */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ATHLETE STATS</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.statVal, { color: accent }]}>{apsScore}</Text>
          <Text style={[styles.statUnit, { color: colors.textDisabled }]}>/ 100</Text>
          <Text style={[styles.statLbl, { color: colors.textSecondary }]}>APS Score</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.statVal, { color: '#FF9500' }]}>{streak}</Text>
          <Text style={[styles.statUnit, { color: colors.textDisabled }]}>days</Text>
          <Text style={[styles.statLbl, { color: colors.textSecondary }]}>Streak</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.statVal, { color: '#4D9FFF' }]}>{totalActivities}</Text>
          <Text style={[styles.statUnit, { color: colors.textDisabled }]}>total</Text>
          <Text style={[styles.statLbl, { color: colors.textSecondary }]}>Activities</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.statVal, { color: '#00F5C4' }]}>{totalDistance.toFixed(0)}</Text>
          <Text style={[styles.statUnit, { color: colors.textDisabled }]}>km</Text>
          <Text style={[styles.statLbl, { color: colors.textSecondary }]}>Distance</Text>
        </View>
      </View>

      {/* Body Stats */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BODY STATS</Text>
      <View style={styles.bodyRow}>
        {[
          { label: 'Height', val: user?.height ? `${user.height}` : '—', unit: 'cm', color: '#4D9FFF' },
          { label: 'Weight', val: user?.weight ? `${user.weight}` : '—', unit: 'kg', color: '#FF5B5B' },
          { label: 'BMI', val: getBMI() ?? '—', unit: getBMICategory(), color: accent },
        ].map((s) => (
          <View key={s.label} style={[styles.bodyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.bodyVal, { color: s.color }]}>{s.val}</Text>
            <Text style={[styles.bodyUnit, { color: colors.textDisabled }]}>{s.unit}</Text>
            <Text style={[styles.bodyLbl, { color: colors.textSecondary }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Badges */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        ACHIEVEMENTS · {unlockedCount}/{BADGE_DEFINITIONS.length}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <View style={styles.badgesGrid}>
          {BADGE_DEFINITIONS.map((badge) => {
            const unlocked = unlockedBadgeIds.includes(badge.id);
            return (
              <View key={badge.id} style={[styles.badge, {
                backgroundColor: unlocked ? badge.color + '15' : colors.surface,
                borderColor: unlocked ? badge.color + '50' : colors.border,
              }]}>
                <Text style={{ fontSize: unlocked ? 20 : 16, opacity: unlocked ? 1 : 0.25 }}>{badge.icon}</Text>
                <Text style={{ fontSize: 9, fontWeight: '700', color: unlocked ? colors.text : colors.textDisabled, textAlign: 'center', paddingHorizontal: 2 }}>
                  {badge.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Body Measurements */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BODY TRACKING</Text>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }]}
        onPress={() => navigation.navigate('BodyMeasurements')}
      >
        <View style={[{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: accent + '18' }]}>
          <AppIcon name="human-male-height" size={20} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[{ fontSize: 15, fontWeight: '700', color: colors.text }]}>Body Measurements</Text>
          <Text style={[{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }]}>Track weight, waist, chest, arms, hips, body fat</Text>
        </View>
        <AppIcon name="chevron-right" size={18} color={colors.textDisabled} />
      </TouchableOpacity>

      {/* Appearance */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <View style={styles.themeRow}>
          {[
            { key: 'light', label: '☀️  Light' },
            { key: 'dark', label: '🌙  Dark' },
            { key: 'system', label: '⚙️  System' },
          ].map((t) => (
            <TouchableOpacity key={t.key} onPress={() => setMode(t.key as any)}
              style={[styles.themeBtn, {
                backgroundColor: mode === t.key ? accent + '18' : colors.surface,
                borderColor: mode === t.key ? accent : colors.border, borderWidth: mode === t.key ? 1.5 : 1,
              }]}>
              <Text style={[styles.themeBtnText, { color: mode === t.key ? accent : colors.textSecondary }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Reminders */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>REMINDERS</Text>
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        {REMINDER_KEYS.map((key, idx) => {
          const setting = reminderSettings[key];
          const meta = REMINDER_LABELS[key];
          return (
            <View key={key} style={[styles.reminderRow, {
              borderBottomColor: idx < REMINDER_KEYS.length - 1 ? colors.divider : 'transparent',
              borderBottomWidth: idx < REMINDER_KEYS.length - 1 ? 1 : 0,
            }]}>
              <View style={[styles.remIconWrap, { backgroundColor: meta.color + '18' }]}>
                <AppIcon name={meta.icon} size={14} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reminderLabel, { color: colors.text }]}>{meta.label}</Text>
                {/* FIXED: Show time as non-editable display with tap to edit hint */}
                <Text style={[styles.reminderTime, { color: colors.textSecondary }]}>
                  {setting.time} · {setting.enabled ? 'On' : 'Off'}
                </Text>
              </View>
              <Switch
                value={setting.enabled}
                onValueChange={(v) => setReminderSettings(p => ({ ...p, [key]: { ...p[key], enabled: v } }))}
                trackColor={{ false: colors.border, true: accent + '60' }}
                thumbColor={setting.enabled ? accent : colors.textDisabled}
              />
            </View>
          );
        })}
        <TouchableOpacity style={[styles.saveRemBtn, { backgroundColor: accent }]} onPress={handleSaveReminders}>
          <Text style={styles.saveRemBtnText}>Save Reminders</Text>
        </TouchableOpacity>
      </View>

      {/* Sign out & Delete */}
      <TouchableOpacity style={[styles.signOutBtn, { borderColor: colors.error + '50', backgroundColor: colors.error + '08' }]} onPress={handleSignOut}>
        <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.deleteBtn, { borderColor: colors.error + '30' }]} onPress={handleDeleteAccount}>
        <Text style={[styles.deleteText, { color: colors.textDisabled }]}>Delete Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroCard: { borderRadius: borderRadius.xxl, borderWidth: 1, padding: 28, alignItems: 'center', gap: 16, marginBottom: spacing.xl },
  avatarWrap: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, position: 'relative' },
  avatarLetter: { fontSize: 34, fontWeight: '900' },
  cameraOverlay: { position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: '#fff' },
  userName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  userEmail: { fontSize: 13, fontWeight: '500' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 4 },
  editForm: { width: '100%', gap: 10 },
  editInput: { borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, fontWeight: '500' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 46, borderWidth: 1, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { flex: 1, height: 46, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, minWidth: '45%', borderWidth: 1, borderRadius: borderRadius.lg, padding: 14, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  statUnit: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  statLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  bodyRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  bodyCard: { flex: 1, borderWidth: 1, borderRadius: borderRadius.lg, padding: 14, alignItems: 'center', gap: 2 },
  bodyVal: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  bodyUnit: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  bodyLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '18%', borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 4 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: { flex: 1, padding: 12, borderRadius: borderRadius.md, alignItems: 'center' },
  themeBtnText: { fontSize: 12, fontWeight: '700' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  remIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  reminderLabel: { fontSize: 14, fontWeight: '700' },
  reminderTime: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  saveRemBtn: { height: 48, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveRemBtnText: { color: '#000', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  signOutBtn: { height: 52, borderRadius: borderRadius.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  signOutText: { fontSize: 15, fontWeight: '800' },
  deleteBtn: { height: 44, borderRadius: borderRadius.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  deleteText: { fontSize: 13, fontWeight: '600' },
});
