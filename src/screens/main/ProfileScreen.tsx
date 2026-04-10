/**
 * ProfileScreen — Production-ready, 100% real Supabase data
 *
 * ✅ Avatar: upload to 'avatars' bucket, update profiles.avatar_url
 * ✅ Edit profile: navigates to EditProfileScreen (full fields)
 * ✅ Athlete stats: from athlete_stats table (level, exp, total_workouts, total_minutes, total_calories)
 * ✅ Body stats: latest from body_stats table (weight, height, BMI, body_fat)
 * ✅ Notification settings: saved to notification_settings Supabase table
 * ✅ Body measurements: navigates to BodyMeasurementsScreen
 * ✅ Privacy: saved to profiles.is_private
 * ✅ Sign out: clears all state, navigates to auth
 * ✅ Delete account: deletes profiles + all related data cascade
 * ✅ Follow counts: real from follows table
 * ✅ Badges: real from streaks service
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import {
  Alert, Dimensions, Platform, RefreshControl, ScrollView, StyleSheet,
  Switch, Text, TouchableOpacity, View, Image, ActivityIndicator,
} from 'react-native';
// Badge grid: 4 columns, screen padding=16 each side, card padding=16 each side, 3 gaps of 8px
// Total horizontal space used = 16+16 (scroll) + 16+16 (card) + 3*8 (gaps) = 88px
const BADGE_COL_WIDTH = Math.floor((Dimensions.get('window').width - 88) / 4);
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppIcon from '../../components/AppIcon';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { storageService } from '../../services/storage';
import { supabase } from '../../services/supabase';
import { recalculateStreak, getUnlockedBadgeIds } from '../../services/streaks';
import { socialService, FollowCounts } from '../../services/socialService';
import { BADGE_DEFINITIONS } from '../../constants/badges';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';
import { TAB_BAR_HEIGHT } from '../../constants/layout';
import { useUnitSystem } from '../../utils/units';

// ── Types ─────────────────────────────────────────────────────────────────

interface AthleteStats {
  total_workouts: number;
  total_minutes: number;
  total_calories: number;
  level: number;
  exp: number;
  rank?: string;
}

interface BodyStatLatest {
  weight: number | null;
  height: number | null;
  bmi: number | null;
  body_fat: number | null;
}

interface NotifSettings {
  push_enabled: boolean;
  email_enabled: boolean;
  like_notifications: boolean;
  comment_notifications: boolean;
  follow_notifications: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getRankFromLevel(level: number): { label: string; color: string; icon: string } {
  if (level >= 20) return { label: 'Legend', color: '#C084FC', icon: '👑' };
  if (level >= 10) return { label: 'Elite',  color: '#FBBF24', icon: '🏆' };
  if (level >= 5)  return { label: 'Pro',    color: '#22D3EE', icon: '⚡' };
  if (level >= 2)  return { label: 'Athlete',color: '#4ADE80', icon: '🎯' };
  return              { label: 'Rookie', color: '#94A3B8', icon: '🌱' };
}

function calcBMI(weight: number | null, height: number | null): string | null {
  if (!weight || !height || height === 0) return null;
  const h = height / 100;
  return (weight / (h * h)).toFixed(1);
}

function bmiCategory(bmi: string | null): string {
  const v = parseFloat(bmi ?? '0');
  if (!v) return 'N/A';
  if (v < 18.5) return 'Underweight';
  if (v < 25)   return 'Normal';
  if (v < 30)   return 'Overweight';
  return 'Obese';
}

const DEFAULT_NOTIF: NotifSettings = {
  push_enabled: true,
  email_enabled: false,
  like_notifications: true,
  comment_notifications: true,
  follow_notifications: true,
};

// ── Component ─────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const { colors, setMode, mode } = useTheme();
  const unitSystem = useUnitSystem();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing]     = useState(false);
  const [avatarUri, setAvatarUri]       = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [streak, setStreak]             = useState(0);
  const [unlockedBadgeIds, setBadgeIds] = useState<string[]>([]);
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [isPrivate, setIsPrivate]       = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  const [athleteStats, setAthleteStats] = useState<AthleteStats>({
    total_workouts: 0,
    total_minutes: 0,
    total_calories: 0,
    level: 1,
    exp: 0,
  });
  const [bodyStats, setBodyStats] = useState<BodyStatLatest>({
    weight: null,
    height: null,
    bmi: null,
    body_fat: null,
  });
  const [notifSettings, setNotifSettings] = useState<NotifSettings>(DEFAULT_NOTIF);
  const [notifSaving, setNotifSaving]     = useState(false);

  // ── Load all data ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;

    const [streakVal, badgeIds, counts, privacy] = await Promise.all([
      recalculateStreak(user.id),
      getUnlockedBadgeIds(user.id),
      socialService.getFollowCounts(user.id),
      socialService.getProfilePrivacy(),
    ]);

    setStreak(streakVal);
    setBadgeIds(badgeIds);
    setFollowCounts(counts);
    setIsPrivate(privacy);

    // Avatar from profiles table (canonical source)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.avatar_url) {
        setAvatarUri(profile.avatar_url);
        await AsyncStorage.setItem('@epexfit_avatar_url', profile.avatar_url);
      } else {
        const cached = await AsyncStorage.getItem('@epexfit_avatar_url');
        if (cached) setAvatarUri(cached);
      }
    } catch {
      const cached = await AsyncStorage.getItem('@epexfit_avatar_url');
      if (cached) setAvatarUri(cached);
    }

    // Athlete stats from athlete_stats table
    try {
      const { data: as } = await supabase
        .from('athlete_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (as) {
        setAthleteStats({
          total_workouts: as.total_workouts ?? 0,
          total_minutes: as.total_minutes ?? 0,
          total_calories: as.total_calories ?? 0,
          level: as.level ?? 1,
          exp: as.exp ?? 0,
        });
      } else {
        // Fallback: calculate from activities table
        const { data: acts } = await supabase
          .from('activities')
          .select('duration, calories')
          .eq('user_id', user.id);
        const total_workouts = acts?.length ?? 0;
        const total_minutes = Math.round((acts?.reduce((s, a) => s + (a.duration ?? 0), 0) ?? 0) / 60);
        const total_calories = acts?.reduce((s, a) => s + (a.calories ?? 0), 0) ?? 0;
        const level = Math.max(1, Math.floor(total_workouts / 5) + 1);
        setAthleteStats({ total_workouts, total_minutes, total_calories, level, exp: total_workouts % 5 });
      }
    } catch {}

    // Body stats from body_stats table — latest entry
    try {
      const { data: bs } = await supabase
        .from('body_stats')
        .select('weight, height, bmi, body_fat')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (bs) {
        setBodyStats({
          weight: bs.weight,
          height: bs.height,
          bmi: bs.bmi,
          body_fat: bs.body_fat,
        });
      } else {
        // Fallback to profile height/weight
        const { data: prof } = await supabase
          .from('profiles')
          .select('height, weight')
          .eq('id', user.id)
          .maybeSingle();
        if (prof) {
          const bmi = calcBMI(prof.weight, prof.height);
          setBodyStats({
            weight: prof.weight ?? null,
            height: prof.height ?? null,
            bmi: bmi ? parseFloat(bmi) : null,
            body_fat: null,
          });
        }
      }
    } catch {}

    // Notification settings from notification_settings table
    try {
      const { data: ns } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (ns) {
        setNotifSettings({
          push_enabled: ns.push_enabled ?? true,
          email_enabled: ns.email_enabled ?? false,
          like_notifications: ns.like_notifications ?? true,
          comment_notifications: ns.comment_notifications ?? true,
          follow_notifications: ns.follow_notifications ?? true,
        });
      }
    } catch {}
  }, [user]);

  useEffect(() => { loadData(); }, [user?.id]);

  // FIX: Refresh follow counts when screen comes back into focus
  // (user may have followed/unfollowed from FollowersListScreen or UserProfileScreen)
  useFocusEffect(useCallback(() => {
    if (!user) return;
    socialService.getFollowCounts(user.id).then(counts => setFollowCounts(counts));
  }, [user?.id]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Avatar upload ──────────────────────────────────────────────────────

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && user) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri); // optimistic
      setUploading(true);
      try {
        const { url, error } = await storageService.uploadAvatar(user.id, uri);
        if (error || !url) throw error ?? new Error('Upload returned no URL');

        // Update profiles table
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
        await AsyncStorage.setItem('@epexfit_avatar_url', url);
        setAvatarUri(url);
      } catch (err: any) {
        Alert.alert('Upload Failed', err?.message ?? 'Could not save your photo.');
        setAvatarUri(null);
      } finally {
        setUploading(false);
      }
    }
  };

  // ── Notification settings save ────────────────────────────────────────

  const handleSaveNotifSettings = async () => {
    if (!user) return;
    setNotifSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert(
          { user_id: user.id, ...notifSettings, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save notification settings.');
    } finally {
      setNotifSaving(false);
    }
  };

  // ── Privacy toggle ────────────────────────────────────────────────────

  const handlePrivacyToggle = async (value: boolean) => {
    setIsPrivate(value);
    setPrivacyLoading(true);
    const { error } = await socialService.setProfilePrivacy(value);
    if (error) {
      setIsPrivate(!value);
      Alert.alert('Error', 'Could not update privacy setting.');
    }
    setPrivacyLoading(false);
  };

  // ── Sign out ──────────────────────────────────────────────────────────

  const handleSignOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          // Navigation reset happens via auth state change in AppNavigator
        },
      },
    ]);

  // ── Delete account ────────────────────────────────────────────────────

  const handleDeleteAccount = () =>
    Alert.alert(
      '⚠️ Delete Account',
      'This will permanently delete your account and ALL data:\n\n• Profile & workouts\n• Posts, likes & comments\n• Messages & followers\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever', style: 'destructive',
          onPress: async () => {
            const { success, error } = await deleteAccount();
            if (!success) Alert.alert('Error', error?.message ?? 'Failed to delete account. Please try again.');
          },
        },
      ]
    );

  // ── Derived ───────────────────────────────────────────────────────────

  const rank  = getRankFromLevel(athleteStats.level);
  const bmi   = bodyStats.bmi ? bodyStats.bmi.toFixed(1) : (calcBMI(bodyStats.weight, bodyStats.height) ?? '—');
  const bmiCat = bmiCategory(bmi !== '—' ? bmi : null);
  const accent = colors.primary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24, padding: spacing.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />
        }
      >
        {/* ── Hero Card ─────────────────────────────────────────────── */}
        <View style={[s.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {/* Avatar */}
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} disabled={uploading}>
            <View style={[s.avatarWrap, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImg} />
              ) : (
                <Text style={[s.avatarLetter, { color: accent }]}>
                  {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
                </Text>
              )}
              <View style={s.cameraOverlay}>
                {uploading
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={{ fontSize: 13 }}>📷</Text>
                }
              </View>
            </View>
          </TouchableOpacity>

          {/* Name, rank, stats */}
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={[s.userName, { color: colors.text }]}>{user?.fullName ?? 'Athlete'}</Text>

            {/* Rank badge */}
            <View style={[s.rankBadge, { backgroundColor: rank.color + '20', borderColor: rank.color + '50' }]}>
              <Text style={{ fontSize: 14 }}>{rank.icon}</Text>
              <Text style={[s.rankText, { color: rank.color }]}>
                {rank.label} · Level {athleteStats.level}
              </Text>
            </View>

            {/* Streak */}
            {streak > 0 && (
              <View style={[s.streakBadge, { backgroundColor: '#FF950022', borderColor: '#FF950055' }]}>
                <Text style={{ fontSize: 15 }}>🔥</Text>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#FF9500' }}>{streak}</Text>
                <Text style={{ fontSize: 11, color: '#FF9500', fontWeight: '600' }}>day streak</Text>
              </View>
            )}

            {/* Follow counts */}
            <View style={s.followRow}>
              <TouchableOpacity
                style={s.followStat}
                onPress={() => user && navigation.navigate('FollowersList', {
                  userId: user.id, type: 'followers', userName: user.fullName,
                })}
              >
                <Text style={[s.followNum, { color: colors.text }]}>{followCounts.followers}</Text>
                <Text style={[s.followLbl, { color: colors.textSecondary }]}>Followers</Text>
              </TouchableOpacity>
              <View style={[s.followDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={s.followStat}
                onPress={() => user && navigation.navigate('FollowersList', {
                  userId: user.id, type: 'following', userName: user.fullName,
                })}
              >
                <Text style={[s.followNum, { color: colors.text }]}>{followCounts.following}</Text>
                <Text style={[s.followLbl, { color: colors.textSecondary }]}>Following</Text>
              </TouchableOpacity>
            </View>

            {/* Edit profile button */}
            <TouchableOpacity
              style={[s.editBtn, { borderColor: accent + '60', backgroundColor: accent + '10' }]}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <AppIcon name="pencil" size={13} color={accent} />
              <Text style={{ fontSize: 12, color: accent, fontWeight: '700' }}>Edit Profile</Text>
            </TouchableOpacity>
            {/* Create post button */}
            <TouchableOpacity
              style={[s.editBtn, { borderColor: accent + '60', backgroundColor: accent + '10' }]}
              onPress={() => navigation.navigate('CreatePost', {})}
            >
              <Text style={{ fontSize: 13 }}>✏️</Text>
              <Text style={{ fontSize: 12, color: accent, fontWeight: '700' }}>Create Post</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Athlete Stats ──────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>ATHLETE STATS</Text>
        <View style={s.statsGrid}>
          {[
            { val: athleteStats.total_workouts, unit: 'total',  label: 'Workouts',  color: accent },
            { val: athleteStats.total_minutes,  unit: 'min',    label: 'Active Time', color: colors.metricDistance },
            { val: athleteStats.total_calories, unit: 'kcal',   label: 'Burned',    color: colors.metricBurn },
            { val: athleteStats.exp,            unit: `/ 5 XP`, label: `Lv ${athleteStats.level}`, color: rank.color },
          ].map((stat) => (
            <View key={stat.label} style={[s.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[s.statVal, { color: stat.color }]}>{stat.val.toLocaleString()}</Text>
              <Text style={[s.statUnit, { color: colors.textDisabled }]}>{stat.unit}</Text>
              <Text style={[s.statLbl, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Body Stats ────────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>BODY STATS</Text>
        <View style={s.bodyRow}>
          {[
            { label: 'Weight', val: bodyStats.weight ? (unitSystem === 'imperial' ? `${(bodyStats.weight * 2.20462).toFixed(1)}` : `${bodyStats.weight}`) : '—', unit: unitSystem === 'imperial' ? 'lbs' : 'kg', color: colors.metricBurn },
            { label: 'Height', val: bodyStats.height ? (unitSystem === 'imperial' ? `${Math.floor(bodyStats.height * 0.393701 / 12)}'${Math.round(bodyStats.height * 0.393701 % 12)}"` : `${bodyStats.height}`) : '—', unit: unitSystem === 'imperial' ? '' : 'cm', color: colors.metricDistance },
            { label: 'BMI',    val: bmi,                                              unit: bmiCat, color: accent },
            { label: 'Body Fat', val: bodyStats.body_fat ? `${bodyStats.body_fat}` : '—', unit: '%', color: colors.neonGlow },
          ].map((stat) => (
            <View key={stat.label} style={[s.bodyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[s.bodyVal, { color: stat.color }]}>{stat.val}</Text>
              <Text style={[s.bodyUnit, { color: colors.textDisabled }]}>{stat.unit}</Text>
              <Text style={[s.bodyLbl, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Achievements ──────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>
          ACHIEVEMENTS · {unlockedBadgeIds.length}/{BADGE_DEFINITIONS.length}
        </Text>
        <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={s.badgesGrid}>
            {BADGE_DEFINITIONS.map((badge) => {
              const unlocked = unlockedBadgeIds.includes(badge.id);
              return (
                <View key={badge.id} style={[s.badge, {
                  backgroundColor: unlocked ? badge.color + '15' : colors.surface,
                  borderColor: unlocked ? badge.color + '50' : colors.border,
                }]}>
                  <Text style={{ fontSize: unlocked ? 20 : 16, opacity: unlocked ? 1 : 0.2 }}>{badge.icon}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: unlocked ? colors.text : colors.textDisabled, textAlign: 'center', paddingHorizontal: 2 }}>
                    {badge.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Quick Links ───────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>TRACKING</Text>
        {[
          { icon: 'human-male-height', label: 'Body Measurements', sub: 'Weight, waist, chest, arms, body fat', screen: 'BodyMeasurements', color: accent },
          { icon: 'clipboard-text',   label: 'Import Data',        sub: 'Import workouts from other apps',     screen: 'Import',            color: '#4D9FFF' },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: spacing.sm }]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[s.iconWrap, { backgroundColor: item.color + '18' }]}>
              <AppIcon name={item.icon} size={20} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.linkLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[s.linkSub, { color: colors.textSecondary }]}>{item.sub}</Text>
            </View>
            <AppIcon name="chevron-right" size={18} color={colors.textDisabled} />
          </TouchableOpacity>
        ))}

        {/* ── Appearance ────────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={s.themeRow}>
            {(['light', 'dark', 'system'] as const).map((t, i) => {
              const label = ['☀️  Light', '🌙  Dark', '⚙️  System'][i];
              return (
                <TouchableOpacity key={t} onPress={() => setMode(t)}
                  style={[s.themeBtn, {
                    backgroundColor: mode === t ? accent + '18' : colors.surface,
                    borderColor: mode === t ? accent : colors.border,
                    borderWidth: mode === t ? 1.5 : 1,
                  }]}>
                  <Text style={[s.themeBtnText, { color: mode === t ? accent : colors.textSecondary }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Privacy ───────────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>PRIVACY</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={[s.iconWrap, { backgroundColor: (isPrivate ? '#94A3B8' : accent) + '18' }]}>
              <Text style={{ fontSize: 20 }}>{isPrivate ? '🔒' : '🌐'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.linkLabel, { color: colors.text }]}>{isPrivate ? 'Private Profile' : 'Public Profile'}</Text>
              <Text style={[s.linkSub, { color: colors.textSecondary }]}>
                {isPrivate ? 'Only followers see your content' : 'Anyone can view your profile'}
              </Text>
            </View>
            {privacyLoading
              ? <ActivityIndicator size="small" color={accent} />
              : <Switch
                  value={isPrivate}
                  onValueChange={handlePrivacyToggle}
                  trackColor={{ false: colors.border, true: accent + '60' }}
                  thumbColor={isPrivate ? accent : colors.textDisabled}
                />
            }
          </View>
        </View>

        {/* ── Notification Settings ─────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>NOTIFICATIONS</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {(
            [
              { key: 'push_enabled' as const,           label: 'Push Notifications', icon: '🔔', desc: 'Receive push alerts on this device' },
              { key: 'email_enabled' as const,          label: 'Email Notifications', icon: '📧', desc: 'Receive activity summaries by email' },
              { key: 'like_notifications' as const,     label: 'Likes',              icon: '❤️', desc: 'When someone likes your post' },
              { key: 'comment_notifications' as const,  label: 'Comments',           icon: '💬', desc: 'When someone comments on your post' },
              { key: 'follow_notifications' as const,   label: 'New Followers',      icon: '👤', desc: 'When someone follows you' },
            ] satisfies Array<{ key: keyof NotifSettings; label: string; icon: string; desc: string }>
          ).map((item, idx, arr) => (
            <View key={item.key} style={[s.notifRow, {
              borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }]}>
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.linkLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[s.linkSub, { color: colors.textSecondary, marginTop: 1 }]}>{item.desc}</Text>
              </View>
              <Switch
                value={notifSettings[item.key]}
                onValueChange={(v) => setNotifSettings(p => ({ ...p, [item.key]: v }))}
                trackColor={{ false: colors.border, true: accent + '60' }}
                thumbColor={notifSettings[item.key] ? accent : colors.textDisabled}
              />
            </View>
          ))}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: accent }, notifSaving && { opacity: 0.7 }]}
            onPress={handleSaveNotifSettings}
            disabled={notifSaving}
          >
            {notifSaving
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={{ color: '#000', fontWeight: '800', fontSize: 14 }}>Save Preferences</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Sign Out ──────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.signOutBtn, { borderColor: colors.error + '50', backgroundColor: colors.error + '08' }]}
          onPress={handleSignOut}
        >
          <AppIcon name="logout" size={16} color={colors.error} />
          <Text style={[s.signOutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.deleteBtn, { borderColor: colors.error + '30' }]}
          onPress={handleDeleteAccount}
        >
          <Text style={[s.deleteText, { color: colors.textDisabled }]}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  heroCard: {
    borderRadius: borderRadius.xxl, borderWidth: 1,
    padding: 28, alignItems: 'center', gap: 16, marginBottom: spacing.xl,
  },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, position: 'relative',
  },
  avatarImg:    { width: 88, height: 88, borderRadius: 28 },
  avatarLetter: { fontSize: 34, fontWeight: '900' },
  cameraOverlay: {
    position: 'absolute', bottom: -4, right: -4,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 2, borderColor: '#fff',
  },
  userName:  { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  rankText:  { fontSize: 12, fontWeight: '800' },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
  },
  followRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  followStat:   { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 4 },
  followNum:    { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  followLbl:    { fontSize: 11, fontWeight: '600', marginTop: 1 },
  followDivider:{ width: 1, height: 28, borderRadius: 1 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 4,
  },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    marginBottom: 12, marginTop: 4,
  },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1, minWidth: '45%', borderWidth: 1, borderRadius: borderRadius.lg,
    padding: 14, alignItems: 'center', gap: 2,
  },
  statVal:  { fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  statUnit: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  statLbl:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },

  bodyRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  bodyCard: {
    flex: 1, minWidth: '45%', borderWidth: 1, borderRadius: borderRadius.lg,
    padding: 14, alignItems: 'center', gap: 2,
  },
  bodyVal:  { fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  bodyUnit: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  bodyLbl:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },

  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg },

  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    width: BADGE_COL_WIDTH,
    borderWidth: 1, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center', gap: 4,
  },

  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { fontSize: 15, fontWeight: '700' },
  linkSub:   { fontSize: 12, marginTop: 2 },

  themeRow:    { flexDirection: 'row', gap: 8 },
  themeBtn:    { flex: 1, padding: 12, borderRadius: borderRadius.md, alignItems: 'center' },
  themeBtnText:{ fontSize: 12, fontWeight: '700' },

  notifRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 12,
  },

  saveBtn: {
    height: 48, borderRadius: borderRadius.lg,
    alignItems: 'center', justifyContent: 'center', marginTop: 14,
  },

  signOutBtn: {
    height: 52, borderRadius: borderRadius.xl, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 12,
  },
  signOutText: { fontSize: 15, fontWeight: '800' },
  deleteBtn: {
    height: 44, borderRadius: borderRadius.xl, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  deleteText: { fontSize: 13, fontWeight: '600' },
});
