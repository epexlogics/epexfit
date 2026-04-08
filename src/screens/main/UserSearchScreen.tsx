/**
 * UserSearchScreen — Real Supabase user search
 *
 * Fixes:
 * - Searches both full_name AND username columns
 * - Proper 400ms debounce
 * - Shows username under name if available
 * - Follow/unfollow with optimistic UI
 * - Tap row to view profile
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ActivityIndicator, Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { socialService } from '../../services/socialService';
import { borderRadius, spacing } from '../../constants/theme';

interface UserResult {
  id: string;
  full_name: string;
  username?: string;
  avatar_url?: string;
  isFollowing: boolean;
  followLoading: boolean;
}

export default function UserSearchScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const accent = colors.primary;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchUsers = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    setSearched(true);

    try {
      const found = await socialService.searchUsers(trimmed);
      setResults(found.map(u => ({ ...u, followLoading: false })));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(text), 400);
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const handleFollowToggle = async (userId: string, currentlyFollowing: boolean) => {
    setResults(prev =>
      prev.map(u => u.id === userId ? { ...u, followLoading: true } : u),
    );

    if (currentlyFollowing) {
      await socialService.unfollow(userId);
    } else {
      await socialService.follow(userId);
    }

    setResults(prev =>
      prev.map(u =>
        u.id === userId
          ? { ...u, isFollowing: !currentlyFollowing, followLoading: false }
          : u,
      ),
    );
  };

  const renderUser = ({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={[card.row, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id, userName: item.full_name })}
      activeOpacity={0.8}
    >
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={[card.avatar, { borderColor: colors.border }]} />
      ) : (
        <View style={[card.avatarFallback, { backgroundColor: accent + '20' }]}>
          <Text style={[card.avatarLetter, { color: accent }]}>
            {item.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={[card.name, { color: colors.text }]}>{item.full_name}</Text>
        {item.username ? (
          <Text style={[card.username, { color: colors.textSecondary }]}>@{item.username}</Text>
        ) : (
          <Text style={[card.username, { color: colors.textSecondary }]}>EpexFit Athlete</Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          card.followBtn,
          {
            backgroundColor: item.isFollowing ? colors.surface : accent,
            borderColor: item.isFollowing ? colors.border : accent,
          },
        ]}
        onPress={() => handleFollowToggle(item.id, item.isFollowing)}
        disabled={item.followLoading}
        activeOpacity={0.8}
      >
        {item.followLoading ? (
          <ActivityIndicator size="small" color={item.isFollowing ? colors.textSecondary : '#000'} />
        ) : (
          <Text style={[card.followBtnText, { color: item.isFollowing ? colors.textSecondary : '#000' }]}>
            {item.isFollowing ? 'Following' : 'Follow'}
          </Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={[s.backText, { color: accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>Find People</Text>
      </View>

      {/* Search bar */}
      <View style={[s.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          placeholder="Search by name or @username…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={handleQueryChange}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => { Keyboard.dismiss(); searchUsers(query); }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '700' }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {searching ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={[s.hint, { color: colors.textSecondary }]}>Searching…</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
          renderItem={renderUser}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searched ? (
              <View style={s.center}>
                <Text style={{ fontSize: 40 }}>🔎</Text>
                <Text style={[s.emptyTitle, { color: colors.text }]}>No users found</Text>
                <Text style={[s.hint, { color: colors.textSecondary }]}>
                  Try a different name or username
                </Text>
              </View>
            ) : (
              <View style={s.center}>
                <Text style={{ fontSize: 40 }}>👥</Text>
                <Text style={[s.emptyTitle, { color: colors.text }]}>Find EpexFit athletes</Text>
                <Text style={[s.hint, { color: colors.textSecondary }]}>
                  Search by name or @username
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const card = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: borderRadius.xl, borderWidth: 1,
    padding: 14, marginBottom: 10,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5 },
  avatarFallback: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '800' },
  username: { fontSize: 12, marginTop: 2 },
  followBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    minWidth: 90, alignItems: 'center', justifyContent: 'center', height: 36,
  },
  followBtnText: { fontSize: 13, fontWeight: '800' },
});

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingBottom: 12,
  },
  backBtn: { paddingRight: 8, paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    borderRadius: borderRadius.xl, borderWidth: 1.5,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500' },
  center: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  hint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
});
