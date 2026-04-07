/**
 * CommentsScreen — Comments on a feed item
 * Route params: feedItemId, actorName
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { socialService, FeedComment } from '../../services/socialService';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

export default function CommentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { feedItemId, actorName } = route.params ?? {};

  const accent = colors.primary;
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const load = async () => {
    setLoading(true);
    const list = await socialService.getComments(feedItemId);
    setComments(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [feedItemId]);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    const { error } = await socialService.postComment(feedItemId, text);
    if (!error) {
      setText('');
      await load();
    }
    setPosting(false);
  };

  const renderComment = ({ item }: { item: FeedComment }) => (
    <View style={[c.row, { borderBottomColor: colors.divider }]}>
      {item.userAvatar ? (
        <Image source={{ uri: item.userAvatar }} style={[c.avatar, { borderColor: colors.border }]} />
      ) : (
        <View style={[c.avatarFallback, { backgroundColor: accent + '20' }]}>
          <Text style={[c.avatarLetter, { color: accent }]}>{item.userName.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={c.nameRow}>
          <Text style={[c.name, { color: colors.text }]}>{item.userName}</Text>
          <Text style={[c.time, { color: colors.textSecondary }]}>{dayjs(item.createdAt).fromNow()}</Text>
        </View>
        <Text style={[c.content, { color: colors.text }]}>{item.content}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={[s.backText, { color: accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>Comments</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, paddingBottom: 20 }}
          renderItem={renderComment}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>No comments yet. Be the first!</Text>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <View style={[s.inputBar, {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom + 8,
      }]}>
        <TextInput
          ref={inputRef}
          style={[s.input, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
          placeholder={`Comment on ${actorName ?? 'this post'}…`}
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={300}
          returnKeyType="send"
          onSubmitEditing={handlePost}
        />
        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: text.trim() ? accent : colors.border }]}
          onPress={handlePost}
          disabled={!text.trim() || posting}
          activeOpacity={0.8}
        >
          {posting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={s.sendIcon}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const c = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 14, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 13, fontWeight: '800' },
  time: { fontSize: 11 },
  content: { fontSize: 14, lineHeight: 20, marginTop: 3 },
});

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { paddingRight: 6, paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '700' },
  title: { flex: 1, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: spacing.md, paddingTop: 10, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: borderRadius.xl, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100, fontWeight: '500' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#000', fontSize: 18, fontWeight: '900' },
});