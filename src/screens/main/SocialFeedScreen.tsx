/**
 * SocialFeedScreen — Real activity feed from Supabase
 *
 * Fixes:
 * - Uses corrected socialService.getFeed() which properly checks liked-by-me
 * - Optimistic like toggle updates count correctly
 * - Navigate to UserProfile on avatar/name tap
 * - Empty state with Find People CTA
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { socialService, FeedItem } from '../../services/socialService';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

const FEED_TYPE_META: Record<string, { emoji: string; label: string; color: string }> = {
  activity_completed: { emoji: '🏃', label: 'completed a workout',   color: '#4D9FFF' },
  goal_achieved:      { emoji: '🎯', label: 'crushed a goal',        color: '#00C853' },
  streak:             { emoji: '🔥', label: 'hit a streak milestone', color: '#FF9500' },
  weight_logged:      { emoji: '⚖️', label: 'logged weight',         color: '#C084FC' },
};

function FeedCard({
  item, colors, accent, onLike, onComment, onActorPress,
}: {
  item: FeedItem;
  colors: any;
  accent: string;
  onLike: (id: string, liked: boolean) => void;
  onComment: (id: string, actorName: string) => void;
  onActorPress: (id: string, name: string) => void;
}) {
  const meta = FEED_TYPE_META[item.type] ?? { emoji: '📊', label: 'logged an update', color: accent };

  return (
    <View style={[fc.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      {/* Actor row */}
      <TouchableOpacity
        style={fc.actor}
        onPress={() => onActorPress(item.actorId, item.actorName)}
        activeOpacity={0.75}
      >
        {item.actorAvatar ? (
          <Image source={{ uri: item.actorAvatar }} style={[fc.avatar, { borderColor: colors.border }]} />
        ) : (
          <View style={[fc.avatarFallback, { backgroundColor: meta.color + '25' }]}>
            <Text style={{ fontSize: 18 }}>{item.actorName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[fc.actorName, { color: colors.text }]}>{item.actorName}</Text>
          <Text style={[fc.actorSub, { color: colors.textSecondary }]}>
            {meta.emoji} {meta.label} · {dayjs(item.createdAt).fromNow()}
          </Text>
        </View>
        <View style={[fc.typeBadge, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
          <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
        </View>
      </TouchableOpacity>

      {/* Payload */}
      {item.type === 'activity_completed' && (
        <View style={[fc.payload, { backgroundColor: meta.color + '10', borderColor: meta.color + '20' }]}>
          {item.payload.activityType && (
            <Text style={[fc.payloadLabel, { color: meta.color }]}>
              {item.payload.activityType.toUpperCase()}
            </Text>
          )}
          <View style={fc.payloadStats}>
            {Number(item.payload.distance) > 0 && (
              <View style={fc.statChip}>
                <Text style={[fc.statVal, { color: colors.text }]}>
                  {Number(item.payload.distance).toFixed(2)}
                </Text>
                <Text style={[fc.statUnit, { color: colors.textSecondary }]}>km</Text>
              </View>
            )}
            {Number(item.payload.duration) > 0 && (
              <View style={fc.statChip}>
                <Text style={[fc.statVal, { color: colors.text }]}>
                  {Math.floor(item.payload.duration / 60)}
                </Text>
                <Text style={[fc.statUnit, { color: colors.textSecondary }]}>min</Text>
              </View>
            )}
            {Number(item.payload.calories) > 0 && (
              <View style={fc.statChip}>
                <Text style={[fc.statVal, { color: colors.text }]}>{item.payload.calories}</Text>
                <Text style={[fc.statUnit, { color: colors.textSecondary }]}>kcal</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {item.type === 'goal_achieved' && item.payload.goalType && (
        <View style={[fc.payload, { backgroundColor: meta.color + '10', borderColor: meta.color + '20' }]}>
          <Text style={[fc.goalText, { color: colors.text }]}>
            🎯 Reached {item.payload.target} {item.payload.unit} — {item.payload.goalType}
          </Text>
        </View>
      )}

      {item.type === 'streak' && (
        <View style={[fc.payload, { backgroundColor: meta.color + '10', borderColor: meta.color + '20' }]}>
          <Text style={[fc.goalText, { color: colors.text }]}>
            🔥 {item.payload.days}-day streak achieved!
          </Text>
        </View>
      )}

      {item.type === 'weight_logged' && item.payload.weight && (
        <View style={[fc.payload, { backgroundColor: meta.color + '10', borderColor: meta.color + '20' }]}>
          <Text style={[fc.goalText, { color: colors.text }]}>
            ⚖️ Logged {item.payload.weight} {item.payload.unit ?? 'kg'}
          </Text>
        </View>
      )}

      {/* Action bar */}
      <View style={fc.actionBar}>
        <TouchableOpacity
          style={[fc.actionBtn, { backgroundColor: item.liked ? accent + '18' : colors.border + '80' }]}
          onPress={() => onLike(item.id, item.liked)}
          activeOpacity={0.75}
        >
          <Text style={{ fontSize: 14 }}>{item.liked ? '❤️' : '🤍'}</Text>
          <Text style={[fc.actionCount, { color: item.liked ? accent : colors.textSecondary }]}>
            {item.likeCount > 0 ? item.likeCount : 'Like'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[fc.actionBtn, { backgroundColor: colors.border + '80' }]}
          onPress={() => onComment(item.id, item.actorName)}
          activeOpacity={0.75}
        >
          <Text style={{ fontSize: 14 }}>💬</Text>
          <Text style={[fc.actionCount, { color: colors.textSecondary }]}>
            {item.commentCount > 0 ? item.commentCount : 'Comment'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SocialFeedScreen() {
  const { colors } = useTheme();
  const accent = colors.primary;
  const navigation = useNavigation<any>();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const loadFeed = useCallback(async () => {
    const { items: feed, fromCache: cached } = await socialService.getFeed(40);
    setItems(feed);
    setFromCache(cached);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadFeed();
  }, [loadFeed]));

  const handleLike = async (id: string, liked: boolean) => {
    // Optimistic update
    setItems(prev => prev.map(i =>
      i.id === id
        ? { ...i, liked: !liked, likeCount: liked ? i.likeCount - 1 : i.likeCount + 1 }
        : i,
    ));
    await socialService.toggleLike(id, liked);
  };

  const handleComment = (feedItemId: string, actorName: string) => {
    navigation.navigate('Comments', { feedItemId, actorName });
  };

  const handleActorPress = (actorId: string, actorName: string) => {
    navigation.navigate('UserProfile', { userId: actorId, userName: actorName });
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: colors.text }]}>Community</Text>
          <Text style={[s.sub, { color: colors.textSecondary }]}>
            Activity from people you follow
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {fromCache && (
            <View style={[s.cacheBadge, { backgroundColor: '#FF950018', borderColor: '#FF950040' }]}>
              <Text style={{ fontSize: 10, color: '#FF9500', fontWeight: '700' }}>📶 Cached</Text>
            </View>
          )}
          <TouchableOpacity
            style={[s.findBtn, { backgroundColor: accent + '15', borderColor: accent + '40' }]}
            onPress={() => navigation.navigate('DirectMessages')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14 }}>💬</Text>
            <Text style={[s.findBtnText, { color: accent }]}>DMs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.findBtn, { backgroundColor: accent + '15', borderColor: accent + '40' }]}
            onPress={() => navigation.navigate('UserSearch')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14 }}>👥</Text>
            <Text style={[s.findBtnText, { color: accent }]}>Find</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={[s.loadText, { color: colors.textSecondary }]}>Loading feed…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadFeed(); }}
              tintColor={accent}
            />
          }
          renderItem={({ item }) => (
            <FeedCard
              item={item}
              colors={colors}
              accent={accent}
              onLike={handleLike}
              onComment={handleComment}
              onActorPress={handleActorPress}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🏃</Text>
              <Text style={[s.emptyTitle, { color: colors.text }]}>No activity yet</Text>
              <Text style={[s.emptySub, { color: colors.textSecondary }]}>
                Follow other EpexFit users to see their workouts, goals, and streaks here.
              </Text>
              <TouchableOpacity
                style={[s.findPeopleBtn, { backgroundColor: accent, marginTop: 8 }]}
                onPress={() => navigation.navigate('UserSearch')}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 16 }}>👥</Text>
                <Text style={s.findPeopleBtnText}>Find People to Follow</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const fc = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl, borderWidth: 1,
    padding: 14, marginBottom: 12, gap: 10,
  },
  actor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5 },
  avatarFallback: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  actorName: { fontSize: 14, fontWeight: '800' },
  actorSub: { fontSize: 12, marginTop: 2 },
  typeBadge: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  payload: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  payloadLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  payloadStats: { flexDirection: 'row', gap: 12 },
  statChip: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statVal: { fontSize: 20, fontWeight: '900' },
  statUnit: { fontSize: 11, fontWeight: '600' },
  goalText: { fontSize: 14, fontWeight: '700' },
  actionBar: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  actionCount: { fontSize: 13, fontWeight: '700' },
});

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  sub: { fontSize: 13, marginTop: 2 },
  cacheBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  findBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  findBtnText: { fontSize: 13, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: {
    fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24,
  },
  findPeopleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 13, borderRadius: 999,
  },
  findPeopleBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
