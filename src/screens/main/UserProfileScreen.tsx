/**
 * UserProfileScreen — Public profile of any EpexFit user
 * Shows: avatar, name, follower/following counts (tappable),
 * streak, achievements, activity count, rank, follow/unfollow button.
 * Private profiles show locked message unless current user follows them.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { socialService, PublicProfile } from '../../services/socialService';
import { BADGE_DEFINITIONS } from '../../constants/badges';
import { borderRadius, spacing } from '../../constants/theme';

function getRank(badgeCount: number, streak: number, activities: number): { label: string; color: string; icon: string } {
  const score = badgeCount * 10 + streak + activities;
  if (score >= 200) return { label: 'Legend', color: '#C084FC', icon: '👑' };
  if (score >= 100) return { label: 'Elite', color: '#FBBF24', icon: '🏆' };
  if (score >= 50)  return { label: 'Pro', color: '#22D3EE', icon: '⚡' };
  if (score >= 20)  return { label: 'Athlete', color: '#4ADE80', icon: '🎯' };
  return { label: 'Rookie', color: '#94A3B8', icon: '🌱' };
}

export default function UserProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user: me } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, userName } = route.params ?? {};

  const accent = colors.primary;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await socialService.getPublicProfile(userId);
    setProfile(p);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    setFollowLoading(true);
    if (profile.isFollowing) {
      await socialService.unfollow(userId);
      setProfile(p => p ? { ...p, isFollowing: false, followerCount: p.followerCount - 1 } : p);
    } else {
      await socialService.follow(userId);
      setProfile(p => p ? { ...p, isFollowing: true, followerCount: p.followerCount + 1 } : p);
    }
    setFollowLoading(false);
  };

  const isMyProfile = me?.id === userId;

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[s.header, { }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={[s.backText, { color: accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{userName ?? 'Profile'}</Text>
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[s.header, { }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={[s.backText, { color: accent }]}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>😕</Text>
          <Text style={[s.emptyTitle, { color: colors.text }]}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPrivateLocked = profile.isPrivate && !profile.isFollowing && !isMyProfile;
  const rank = getRank(profile.badgeIds.length, profile.streak, profile.activityCount);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={[s.backText, { color: accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {profile.fullName}
        </Text>
        {profile.isPrivate && (
          <View style={[s.privateBadge, { backgroundColor: colors.border }]}>
            <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '700' }}>🔒 Private</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero card */}
        <View style={[s.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {/* Avatar */}
          <View style={[s.avatarWrap, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={{ width: 84, height: 84, borderRadius: 28 }} />
            ) : (
              <Text style={[s.avatarLetter, { color: accent }]}>
                {profile.fullName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <Text style={[s.userName, { color: colors.text }]}>{profile.fullName}</Text>

          {/* Rank badge */}
          <View style={[s.rankBadge, { backgroundColor: rank.color + '20', borderColor: rank.color + '50' }]}>
            <Text style={{ fontSize: 16 }}>{rank.icon}</Text>
            <Text style={[s.rankText, { color: rank.color }]}>{rank.label}</Text>
          </View>

          {/* Follow stats */}
          <View style={s.followRow}>
            <TouchableOpacity
              style={s.followStat}
              onPress={() => navigation.navigate('FollowersList', { userId, type: 'followers', userName: profile.fullName })}
            >
              <Text style={[s.followNum, { color: colors.text }]}>{profile.followerCount}</Text>
              <Text style={[s.followLbl, { color: colors.textSecondary }]}>Followers</Text>
            </TouchableOpacity>
            <View style={[s.followDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={s.followStat}
              onPress={() => navigation.navigate('FollowersList', { userId, type: 'following', userName: profile.fullName })}
            >
              <Text style={[s.followNum, { color: colors.text }]}>{profile.followingCount}</Text>
              <Text style={[s.followLbl, { color: colors.textSecondary }]}>Following</Text>
            </TouchableOpacity>
            <View style={[s.followDivider, { backgroundColor: colors.border }]} />
            <View style={s.followStat}>
              <Text style={[s.followNum, { color: colors.text }]}>{profile.activityCount}</Text>
              <Text style={[s.followLbl, { color: colors.textSecondary }]}>Activities</Text>
            </View>
          </View>

          {/* Follow button — hide for own profile */}
          {!isMyProfile && (
            <TouchableOpacity
              style={[s.followBtn, {
                backgroundColor: profile.isFollowing ? colors.surface : accent,
                borderColor: profile.isFollowing ? colors.border : accent,
              }]}
              onPress={handleFollowToggle}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={profile.isFollowing ? colors.textSecondary : '#000'} />
              ) : (
                <Text style={[s.followBtnText, { color: profile.isFollowing ? colors.textSecondary : '#000' }]}>
                  {profile.isFollowing ? '✓ Following' : profile.followsMe ? 'Follow Back' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Streak */}
        {profile.streak > 0 && (
          <View style={[s.streakCard, { backgroundColor: '#FF950015', borderColor: '#FF950035' }]}>
            <Text style={{ fontSize: 28 }}>🔥</Text>
            <View>
              <Text style={[s.streakNum, { color: '#FF9500' }]}>{profile.streak}-day streak</Text>
              <Text style={[s.streakSub, { color: colors.textSecondary }]}>Consecutive active days</Text>
            </View>
          </View>
        )}

        {/* Private lock */}
        {isPrivateLocked ? (
          <View style={[s.lockCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={{ fontSize: 48 }}>🔒</Text>
            <Text style={[s.lockTitle, { color: colors.text }]}>Private Profile</Text>
            <Text style={[s.lockSub, { color: colors.textSecondary }]}>
              Follow {profile.fullName} to see their achievements and activity.
            </Text>
          </View>
        ) : (
          <>
            {/* Achievements */}
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>
              ACHIEVEMENTS · {profile.badgeIds.length}/{BADGE_DEFINITIONS.length}
            </Text>
            <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={s.badgesGrid}>
                {BADGE_DEFINITIONS.map((badge) => {
                  const unlocked = profile.badgeIds.includes(badge.id);
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingBottom: 12 },
  backBtn: { paddingRight: 6, paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  privateBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  heroCard: { margin: spacing.md, borderRadius: borderRadius.xxl, borderWidth: 1, padding: 28, alignItems: 'center', gap: 12 },
  avatarWrap: { width: 90, height: 90, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarLetter: { fontSize: 36, fontWeight: '900' },
  userName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  rankBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  rankText: { fontSize: 13, fontWeight: '800' },
  followRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  followStat: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 4 },
  followNum: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  followLbl: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  followDivider: { width: 1, height: 28 },
  followBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 999, borderWidth: 1.5, minWidth: 140, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  followBtnText: { fontSize: 14, fontWeight: '800' },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: spacing.md, marginBottom: spacing.md, padding: 16, borderRadius: borderRadius.xl, borderWidth: 1 },
  streakNum: { fontSize: 16, fontWeight: '900' },
  streakSub: { fontSize: 12, marginTop: 2 },
  lockCard: { marginHorizontal: spacing.md, borderRadius: borderRadius.xl, borderWidth: 1, padding: 40, alignItems: 'center', gap: 12 },
  lockTitle: { fontSize: 20, fontWeight: '900' },
  lockSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10, marginTop: 4, paddingHorizontal: spacing.md },
  card: { marginHorizontal: spacing.md, marginBottom: spacing.lg, borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '18%', borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 4 },
});
