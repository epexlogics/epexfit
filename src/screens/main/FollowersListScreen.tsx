/**
 * FollowersListScreen — Shows followers or following of a user
 * Route params: userId, type ('followers' | 'following'), userName
 * Each row shows: avatar, name, follow-back button if they follow you
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { socialService, FollowUser } from '../../services/socialService';
import { borderRadius, spacing } from '../../constants/theme';

export default function FollowersListScreen() {
  const { colors } = useTheme();
  const { user: me } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, type, userName } = route.params ?? {};

  const accent = colors.primary;
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = type === 'followers'
        ? await socialService.getFollowers(userId)
        : await socialService.getFollowing(userId);
      setUsers(list);
      setLoading(false);
    })();
  }, [userId, type]);

  const handleFollowToggle = async (targetId: string, isFollowing: boolean) => {
    setFollowLoadingId(targetId);
    if (isFollowing) {
      await socialService.unfollow(targetId);
    } else {
      await socialService.follow(targetId);
    }
    setUsers(prev => prev.map(u => u.id === targetId ? { ...u, isFollowing: !isFollowing } : u));
    setFollowLoadingId(null);
  };

  const renderItem = ({ item }: { item: FollowUser }) => {
    const isMe = item.id === me?.id;
    const isLoading = followLoadingId === item.id;

    return (
      <TouchableOpacity
        style={[s.row, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        onPress={() => navigation.navigate('UserProfile', { userId: item.id, userName: item.fullName })}
        activeOpacity={0.8}
      >
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={[s.avatar, { borderColor: colors.border }]} />
        ) : (
          <View style={[s.avatarFallback, { backgroundColor: accent + '20' }]}>
            <Text style={[s.avatarLetter, { color: accent }]}>{item.fullName.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: colors.text }]}>{item.fullName}</Text>
          {item.followsMe && !isMe && (
            <Text style={[s.followsYou, { color: accent }]}>Follows you</Text>
          )}
        </View>

        {!isMe && (
          <TouchableOpacity
            style={[s.btn, {
              backgroundColor: item.isFollowing ? colors.surface : accent,
              borderColor: item.isFollowing ? colors.border : accent,
            }]}
            onPress={() => handleFollowToggle(item.id, item.isFollowing)}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={item.isFollowing ? colors.textSecondary : '#000'} />
            ) : (
              <Text style={[s.btnText, { color: item.isFollowing ? colors.textSecondary : '#000' }]}>
                {item.isFollowing ? 'Following' : item.followsMe ? 'Follow Back' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[s.header, { }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={[s.backText, { color: accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>
          {type === 'followers' ? `${userName}'s Followers` : `${userName} Following`}
        </Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ fontSize: 40 }}>👥</Text>
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingBottom: 12 },
  backBtn: { paddingRight: 6, paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '700' },
  title: { flex: 1, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: borderRadius.xl, borderWidth: 1, padding: 14, marginBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '800' },
  followsYou: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, minWidth: 90, alignItems: 'center', justifyContent: 'center', height: 36 },
  btnText: { fontSize: 12, fontWeight: '800' },
});
