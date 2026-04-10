/**
 * UserProfileScreen — Facebook-style public profile
 *
 * ✅ Real Supabase data via socialService.getPublicProfile()
 * ✅ Tabs: Posts, Workouts, About
 * ✅ Follow / Unfollow → optimistic + DB write
 * ✅ Real follower/following counts (clickable → FollowersList)
 * ✅ Supabase Realtime follow count subscription
 * ✅ User's posts (from activity_feed) with like/comment
 * ✅ User's recent activities
 * ✅ DM button → ChatScreen
 * ✅ Private profile lock (if not following)
 * ✅ Rank badge from level/badges
 * ✅ Bio, location, website shown
 * ✅ Zero mock data
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, FlatList, Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { socialService, PublicProfile, FeedItem } from '../../services/socialService';
import { supabase } from '../../services/supabase';
import { BADGE_DEFINITIONS } from '../../constants/badges';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';
import AppIcon from '../../components/AppIcon';

// PRODUCTION FIX: relativeTime plugin ki jagah pure JS — Hermes safe
function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}


// ── Helpers ────────────────────────────────────────────────────────────────

function getRank(badgeCount: number, streak: number, activities: number) {
  const score = badgeCount * 10 + streak + activities;
  if (score >= 200) return { label: 'Legend', color: '#C084FC', icon: '👑' };
  if (score >= 100) return { label: 'Elite',  color: '#FBBF24', icon: '🏆' };
  if (score >= 50)  return { label: 'Pro',    color: '#22D3EE', icon: '⚡' };
  if (score >= 20)  return { label: 'Athlete',color: '#4ADE80', icon: '🎯' };
  return              { label: 'Rookie', color: '#94A3B8', icon: '🌱' };
}

const FEED_TYPE_META: Record<string, { emoji: string; label: string; color: string }> = {
  activity_completed: { emoji: '🏃', label: 'completed a workout',   color: '#4D9FFF' },
  goal_achieved:      { emoji: '🎯', label: 'crushed a goal',        color: '#00C853' },
  streak:             { emoji: '🔥', label: 'hit a streak milestone', color: '#FF9500' },
  weight_logged:      { emoji: '⚖️', label: 'logged weight',         color: '#C084FC' },
  social_post:        { emoji: '📝', label: 'shared a post',         color: '#22D3EE' },
};

type TabType = 'posts' | 'workouts' | 'about';

// ── Component ──────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const { colors }       = useTheme();
  const { user: me }     = useAuth();
  const navigation       = useNavigation<any>();
  const route            = useRoute<any>();
  const { userId, userName } = route.params ?? {};

  const accent = colors.primary;

  const [profile, setProfile]         = useState<PublicProfile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab]     = useState<TabType>('posts');
  const [posts, setPosts]             = useState<any[]>([]);
  const [activities, setActivities]   = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = await socialService.getPublicProfile(userId);
    setProfile(p);
    setLoading(false);
  }, [userId]);

  const loadUserContent = useCallback(async (p: PublicProfile | null) => {
    if (!p) return;
    const canSeeContent = !p.isPrivate || p.isFollowing || me?.id === userId;
    if (!canSeeContent) return;

    setPostsLoading(true);
    const [userPosts, userActivities] = await Promise.all([
      socialService.getUserPosts(userId, 20),
      socialService.getUserActivities(userId, 10),
    ]);
    setPosts(userPosts);
    setActivities(userActivities);
    setPostsLoading(false);
  }, [userId, me?.id]);

  useEffect(() => {
    load().then(() => {
      setProfile(p => { if (p) loadUserContent(p); return p; });
    });

    // Realtime: follow count live updates
    channelRef.current = supabase
      .channel(`profile_follows:${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        async (payload) => {
          const row = (payload.new ?? payload.old) as any;
          if (row?.follower_id !== userId && row?.following_id !== userId) return;
          const counts = await socialService.getFollowCounts(userId);
          setProfile(p => p ? { ...p, followerCount: counts.followers, followingCount: counts.following } : p);
        },
      )
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [load, userId]);

  // Reload content after follow (may unlock private profile)
  useEffect(() => {
    if (profile) loadUserContent(profile);
  }, [profile?.isFollowing]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    setFollowLoading(true);
    if (profile.isFollowing) {
      await socialService.unfollow(userId);
      setProfile(p => p ? { ...p, isFollowing: false, followerCount: Math.max(0, p.followerCount - 1) } : p);
    } else {
      await socialService.follow(userId);
      setProfile(p => p ? { ...p, isFollowing: true, followerCount: p.followerCount + 1 } : p);
    }
    setFollowLoading(false);
  };

  const handleDM = () => {
    if (!profile) return;
    navigation.navigate('Chat', {
      partnerId: userId,
      partnerName: profile.fullName,
      partnerAvatar: profile.avatarUrl,
    });
  };

  const handleLikePost = async (postId: string, liked: boolean) => {
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, liked: !liked, likeCount: liked ? Math.max(0, p.likeCount - 1) : p.likeCount + 1 }
        : p,
    ));
    await socialService.toggleLike(postId, liked);
  };

  const isMyProfile = me?.id === userId;

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <AppIcon name="chevron-left" size={22} color={colors.text} />
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
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <AppIcon name="chevron-left" size={22} color={colors.text} />
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
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <AppIcon name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {profile.username ? `@${profile.username}` : profile.fullName}
        </Text>
        {profile.isPrivate && (
          <View style={[s.privateBadge, { backgroundColor: colors.border }]}>
            <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '700' }}>🔒 Private</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── Hero Card ──────────────────────────────────────────────── */}
        <View style={[s.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {/* Avatar */}
          <View style={[s.avatarWrap, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={s.avatarImg} />
            ) : (
              <Text style={[s.avatarLetter, { color: accent }]}>
                {profile.fullName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <Text style={[s.userName, { color: colors.text }]}>{profile.fullName}</Text>
          {profile.username && (
            <Text style={[s.userHandle, { color: colors.textSecondary }]}>@{profile.username}</Text>
          )}

          {/* Rank badge */}
          <View style={[s.rankBadge, { backgroundColor: rank.color + '20', borderColor: rank.color + '50' }]}>
            <Text style={{ fontSize: 14 }}>{rank.icon}</Text>
            <Text style={[s.rankText, { color: rank.color }]}>{rank.label}</Text>
          </View>

          {/* Bio */}
          {profile.bio ? (
            <Text style={[s.bio, { color: colors.textSecondary }]}>{profile.bio}</Text>
          ) : null}

          {/* Location / Website */}
          <View style={s.metaRow}>
            {profile.location && (
              <View style={s.metaItem}>
                <Text style={{ fontSize: 12 }}>📍</Text>
                <Text style={[s.metaText, { color: colors.textSecondary }]}>{profile.location}</Text>
              </View>
            )}
            {profile.website && (
              <TouchableOpacity
                style={s.metaItem}
                onPress={() => Linking.openURL(profile.website!.startsWith('http') ? profile.website! : `https://${profile.website}`)}
              >
                <Text style={{ fontSize: 12 }}>🔗</Text>
                <Text style={[s.metaText, { color: accent }]} numberOfLines={1}>
                  {profile.website.replace(/^https?:\/\//, '')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Streak */}
          {profile.streak > 0 && (
            <View style={[s.streakBadge, { backgroundColor: '#FF950015', borderColor: '#FF950035' }]}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#FF9500' }}>
                {profile.streak}-day streak
              </Text>
            </View>
          )}

          {/* Stats row */}
          <View style={s.statsRow}>
            <TouchableOpacity
              style={s.statItem}
              onPress={() => navigation.navigate('FollowersList', { userId, type: 'followers', userName: profile.fullName })}
            >
              <Text style={[s.statNum, { color: colors.text }]}>{profile.followerCount}</Text>
              <Text style={[s.statLbl, { color: colors.textSecondary }]}>Followers</Text>
            </TouchableOpacity>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={s.statItem}
              onPress={() => navigation.navigate('FollowersList', { userId, type: 'following', userName: profile.fullName })}
            >
              <Text style={[s.statNum, { color: colors.text }]}>{profile.followingCount}</Text>
              <Text style={[s.statLbl, { color: colors.textSecondary }]}>Following</Text>
            </TouchableOpacity>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.text }]}>{profile.activityCount}</Text>
              <Text style={[s.statLbl, { color: colors.textSecondary }]}>Workouts</Text>
            </View>
          </View>

          {/* Action buttons */}
          {!isMyProfile && (
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.followBtn, {
                  backgroundColor: profile.isFollowing ? colors.surface : accent,
                  borderColor: profile.isFollowing ? colors.border : accent,
                  flex: 1,
                }]}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={profile.isFollowing ? colors.textSecondary : '#000'} />
                ) : (
                  <Text style={[s.followBtnText, { color: profile.isFollowing ? colors.textSecondary : '#000' }]}>
                    {profile.isFollowing ? '✓ Following' : profile.followsMe ? 'Follow Back' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.dmBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleDM}
              >
                <Text style={{ fontSize: 18 }}>💬</Text>
              </TouchableOpacity>
            </View>
          )}
          {isMyProfile && (
            <TouchableOpacity
              style={[s.followBtn, { borderColor: accent + '60', backgroundColor: accent + '10', alignSelf: 'stretch' }]}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <AppIcon name="pencil" size={14} color={accent} />
              <Text style={{ color: accent, fontWeight: '700', fontSize: 14 }}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Locked state ─────────────────────────────────────────── */}
        {isPrivateLocked ? (
          <View style={[s.lockCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={{ fontSize: 48 }}>🔒</Text>
            <Text style={[s.lockTitle, { color: colors.text }]}>Private Profile</Text>
            <Text style={[s.lockSub, { color: colors.textSecondary }]}>
              Follow {profile.fullName} to see their achievements and workouts.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Tabs ────────────────────────────────────────────── */}
            <View style={[s.tabBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {(['posts', 'workouts', 'about'] as TabType[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[s.tab, activeTab === tab && { borderBottomColor: accent, borderBottomWidth: 2 }]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[s.tabText, { color: activeTab === tab ? accent : colors.textSecondary }]}>
                    {tab === 'posts' ? '📝 Posts' : tab === 'workouts' ? '🏃 Workouts' : '👤 About'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {postsLoading ? (
              <View style={s.center}>
                <ActivityIndicator size="large" color={accent} />
              </View>
            ) : (
              <>
                {/* ── Posts Tab ───────────────────────────────────── */}
                {activeTab === 'posts' && (
                  <View style={{ padding: spacing.md, gap: 12 }}>
                    {posts.length === 0 ? (
                      <View style={s.emptyTab}>
                        <Text style={{ fontSize: 36 }}>📝</Text>
                        <Text style={[s.emptyTitle, { color: colors.text }]}>No posts yet</Text>
                      </View>
                    ) : (
                      posts.map((post) => {
                        const meta = FEED_TYPE_META[post.type] ?? { emoji: '📊', label: 'logged an update', color: accent };
                        return (
                          <View key={post.id} style={[s.postCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                            <Text style={[s.postMeta, { color: colors.textSecondary }]}>
                              {meta.emoji} {meta.label} · {timeAgo(post.createdAt)}
                            </Text>
                            {post.content ? (
                              <Text style={[s.postContent, { color: colors.text }]}>{post.content}</Text>
                            ) : null}
                            {post.payload?.activityType && (
                              <View style={[s.payloadChip, { backgroundColor: meta.color + '12', borderColor: meta.color + '30' }]}>
                                <Text style={[s.payloadLabel, { color: meta.color }]}>
                                  {post.payload.activityType?.toUpperCase()}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                  {post.payload.distance > 0 && <Text style={[s.payloadStat, { color: colors.text }]}>{Number(post.payload.distance).toFixed(2)} km</Text>}
                                  {post.payload.duration > 0 && <Text style={[s.payloadStat, { color: colors.text }]}>{Math.floor(post.payload.duration / 60)} min</Text>}
                                  {post.payload.calories > 0 && <Text style={[s.payloadStat, { color: colors.text }]}>{post.payload.calories} kcal</Text>}
                                </View>
                              </View>
                            )}
                            {post.payload?.weight && (
                              <View style={[s.payloadChip, { backgroundColor: '#C084FC12', borderColor: '#C084FC30' }]}>
                                <Text style={[s.payloadStat, { color: colors.text }]}>⚖️ {post.payload.weight} {post.payload.unit ?? 'kg'}</Text>
                              </View>
                            )}
                            <View style={s.postActions}>
                              <TouchableOpacity
                                style={[s.actionBtn, { backgroundColor: post.liked ? accent + '18' : colors.border + '80' }]}
                                onPress={() => handleLikePost(post.id, post.liked)}
                              >
                                <Text style={{ fontSize: 13 }}>{post.liked ? '❤️' : '🤍'}</Text>
                                <Text style={[s.actionCount, { color: post.liked ? accent : colors.textSecondary }]}>
                                  {post.likeCount > 0 ? post.likeCount : 'Like'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[s.actionBtn, { backgroundColor: colors.border + '80' }]}
                                onPress={() => navigation.navigate('Comments', { feedItemId: post.id, actorName: profile.fullName })}
                              >
                                <Text style={{ fontSize: 13 }}>💬</Text>
                                <Text style={[s.actionCount, { color: colors.textSecondary }]}>
                                  {post.commentCount > 0 ? post.commentCount : 'Comment'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* ── Workouts Tab ────────────────────────────────── */}
                {activeTab === 'workouts' && (
                  <View style={{ padding: spacing.md, gap: 10 }}>
                    {activities.length === 0 ? (
                      <View style={s.emptyTab}>
                        <Text style={{ fontSize: 36 }}>🏃</Text>
                        <Text style={[s.emptyTitle, { color: colors.text }]}>No workouts yet</Text>
                      </View>
                    ) : (
                      activities.map((act) => (
                        <View key={act.id} style={[s.actCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                          <View style={s.actHeader}>
                            <View style={[s.actIcon, { backgroundColor: accent + '18' }]}>
                              <Text style={{ fontSize: 18 }}>
                                {act.type === 'running' ? '🏃' : act.type === 'cycling' ? '🚴' : act.type === 'walking' ? '🚶' : act.type === 'strength' ? '💪' : '🏋️'}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.actType, { color: colors.text }]}>
                                {act.type.charAt(0).toUpperCase() + act.type.slice(1)}
                              </Text>
                              <Text style={[s.actDate, { color: colors.textSecondary }]}>
                                {dayjs(act.start_time).format('MMM D, YYYY')}
                              </Text>
                            </View>
                          </View>
                          <View style={s.actStats}>
                            {act.distance > 0 && (
                              <View style={s.actStat}>
                                <Text style={[s.actStatVal, { color: accent }]}>{act.distance.toFixed(2)}</Text>
                                <Text style={[s.actStatUnit, { color: colors.textDisabled }]}>km</Text>
                              </View>
                            )}
                            {act.duration > 0 && (
                              <View style={s.actStat}>
                                <Text style={[s.actStatVal, { color: colors.metricDistance }]}>{Math.floor(act.duration / 60)}</Text>
                                <Text style={[s.actStatUnit, { color: colors.textDisabled }]}>min</Text>
                              </View>
                            )}
                            {act.calories > 0 && (
                              <View style={s.actStat}>
                                <Text style={[s.actStatVal, { color: colors.metricBurn }]}>{act.calories}</Text>
                                <Text style={[s.actStatUnit, { color: colors.textDisabled }]}>kcal</Text>
                              </View>
                            )}
                            {act.steps > 0 && (
                              <View style={s.actStat}>
                                <Text style={[s.actStatVal, { color: colors.neonGlow }]}>{act.steps.toLocaleString()}</Text>
                                <Text style={[s.actStatUnit, { color: colors.textDisabled }]}>steps</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* ── About Tab ───────────────────────────────────── */}
                {activeTab === 'about' && (
                  <View style={{ padding: spacing.md, gap: 12 }}>
                    {/* Badges */}
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

                    {/* Stats */}
                    <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>STATS</Text>
                    <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                      {[
                        { label: 'Total Workouts', val: profile.activityCount, color: accent },
                        { label: 'Current Streak', val: `${profile.streak} days`, color: '#FF9500' },
                        { label: 'Badges Earned',  val: `${profile.badgeIds.length}/${BADGE_DEFINITIONS.length}`, color: rank.color },
                        { label: 'Rank',           val: `${rank.icon} ${rank.label}`, color: rank.color },
                      ].map((s_) => (
                        <View key={s_.label} style={[s.infoRow, { borderBottomColor: colors.border }]}>
                          <Text style={[s.infoLabel, { color: colors.textSecondary }]}>{s_.label}</Text>
                          <Text style={[s.infoVal, { color: s_.color }]}>{s_.val}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.md, paddingBottom: 12,
  },
  backBtn:     { width: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  privateBadge:{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '800' },

  heroCard: {
    margin: spacing.md, borderRadius: borderRadius.xxl, borderWidth: 1,
    padding: 24, alignItems: 'center', gap: 10,
  },
  avatarWrap: {
    width: 90, height: 90, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  avatarImg:    { width: 90, height: 90, borderRadius: 28 },
  avatarLetter: { fontSize: 36, fontWeight: '900' },
  userName:     { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  userHandle:   { fontSize: 13, fontWeight: '600', marginTop: -4 },
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  rankText: { fontSize: 12, fontWeight: '800' },
  bio: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  metaRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', justifyContent: 'center' },
  metaItem:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:{ fontSize: 13, fontWeight: '500' },

  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6,
  },

  statsRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statItem:    { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 4 },
  statNum:     { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLbl:     { fontSize: 11, fontWeight: '600', marginTop: 1 },
  statDivider: { width: 1, height: 28 },

  actionRow:    { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  followBtn: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  followBtnText: { fontSize: 14, fontWeight: '800' },
  dmBtn: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  lockCard: {
    margin: spacing.md, borderRadius: borderRadius.xl, borderWidth: 1,
    padding: 40, alignItems: 'center', gap: 12,
  },
  lockTitle: { fontSize: 20, fontWeight: '900' },
  lockSub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    marginHorizontal: spacing.md, borderRadius: 0,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '700' },

  emptyTab: { alignItems: 'center', paddingVertical: 40, gap: 10 },

  postCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: 14, gap: 10 },
  postMeta: { fontSize: 12 },
  postContent: { fontSize: 15, lineHeight: 22 },
  payloadChip: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 2 },
  payloadLabel:{ fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  payloadStat: { fontSize: 13, fontWeight: '700' },
  postActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  actionCount: { fontSize: 13, fontWeight: '700' },

  actCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: 14, gap: 10 },
  actHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actIcon:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actType:    { fontSize: 15, fontWeight: '800' },
  actDate:    { fontSize: 12, marginTop: 2 },
  actStats:   { flexDirection: 'row', gap: 16 },
  actStat:    { alignItems: 'center', flexDirection: 'row', gap: 3 },
  actStatVal: { fontSize: 18, fontWeight: '900' },
  actStatUnit:{ fontSize: 11, fontWeight: '600' },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, gap: 8 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '18%', borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 4 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 14 },
  infoVal:   { fontSize: 14, fontWeight: '800' },
});
