/**
 * CommentsScreen — Real-time comments CRUD
 *
 * ✅ Real Supabase data via socialService.getComments()
 * ✅ Post comment → DB write, auto-appear via Realtime
 * ✅ Delete own comment (long press) → DB delete + live remove from list
 * ✅ Real-time: INSERT + DELETE events subscribed
 * ✅ Auto-scroll to bottom on new comment
 * ✅ Zero mock data
 *
 * FIX APPLIED:
 *   - Added DELETE listener to real-time channel so deleted comments
 *     disappear from list instantly (previously only INSERT was handled)
 *   - divider uses colors.divider ?? colors.border (safe fallback)
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { socialService, FeedComment } from '../../services/socialService';
import { supabase } from '../../services/supabase';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

export default function CommentsScreen() {
  const { colors } = useTheme();
  const { user: me } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { feedItemId, actorName } = route.params ?? {};

  const accent = colors.primary;
  const dividerColor = colors.divider ?? colors.border;

  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<FeedComment>>(null);

  const loadComments = useCallback(async () => {
    const list = await socialService.getComments(feedItemId);
    setComments(list);
    setLoading(false);
  }, [feedItemId]);

  useEffect(() => {
    loadComments();

    // Real-time: subscribe to INSERT and DELETE on this feed item's comments
    const channel = supabase
      .channel(`comments:${feedItemId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_comments',
          filter: `feed_item_id=eq.${feedItemId}`,
        },
        async (payload) => {
          // Reload to get joined profile data for the new comment
          const updated = await socialService.getComments(feedItemId);
          setComments(updated);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'feed_comments',
          filter: `feed_item_id=eq.${feedItemId}`,
        },
        (payload) => {
          // ✅ FIX: Remove deleted comment from local state immediately
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setComments(prev => prev.filter(c => c.id !== deletedId));
          }
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [feedItemId, loadComments]);

  // Auto-scroll when comments load or new one arrives
  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [comments.length]);

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setText('');
    const { error } = await socialService.postComment(feedItemId, trimmed);
    if (error) {
      setText(trimmed); // restore on failure
      Alert.alert('Error', 'Could not post comment. Please try again.');
    }
    setPosting(false);
  };

  const handleLongPress = (comment: FeedComment) => {
    if (comment.userId !== me?.id) return;
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          // Optimistic remove — real-time DELETE will also fire (idempotent)
          setComments(prev => prev.filter(c => c.id !== comment.id));
          await socialService.deleteComment(comment.id);
        },
      },
    ]);
  };

  const renderComment = ({ item }: { item: FeedComment }) => {
    const isMe = item.userId === me?.id;
    return (
      <TouchableOpacity
        style={[c.row, { borderBottomColor: dividerColor }]}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={isMe ? 0.7 : 1}
      >
        {item.userAvatar ? (
          <Image source={{ uri: item.userAvatar }} style={[c.avatar, { borderColor: colors.border }]} />
        ) : (
          <View style={[c.avatarFallback, { backgroundColor: accent + '20' }]}>
            <Text style={[c.avatarLetter, { color: accent }]}>
              {item.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={c.nameRow}>
            <Text style={[c.name, { color: colors.text }]}>
              {item.userName}{isMe ? ' (you)' : ''}
            </Text>
            <Text style={[c.time, { color: colors.textSecondary }]}>
              {dayjs(item.createdAt).fromNow()}
            </Text>
            {isMe && (
              <Text style={[c.deleteHint, { color: colors.textSecondary }]}>Hold to delete</Text>
            )}
          </View>
          <Text style={[c.content, { color: colors.text }]}>{item.content}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[s.header, { borderBottomColor: dividerColor }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={[s.backText, { color: accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.text }]}>Comments</Text>
          {comments.length > 0 && (
            <Text style={[s.count, { color: colors.textSecondary }]}>
              {comments.length}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={i => i.id}
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              paddingBottom: 20,
            }}
            renderItem={renderComment}
            ListEmptyComponent={
              <View style={s.center}>
                <Text style={{ fontSize: 40 }}>💬</Text>
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                  No comments yet. Be the first!
                </Text>
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
            style={[s.input, {
              backgroundColor: colors.surfaceElevated,
              color: colors.text,
              borderColor: colors.border,
            }]}
            placeholder={`Comment on ${actorName ?? 'this post'}…`}
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={300}
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
              <Text style={[s.sendIcon, { color: text.trim() ? '#000' : colors.textSecondary }]}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const c = StyleSheet.create({
  row: {
    flexDirection: 'row', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  avatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 14, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 13, fontWeight: '800' },
  time: { fontSize: 11 },
  deleteHint: { fontSize: 10, opacity: 0.5 },
  content: { fontSize: 14, lineHeight: 20, marginTop: 3 },
});

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { paddingRight: 6, paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '700' },
  title: { flex: 1, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  count: { fontSize: 14, fontWeight: '600' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 48,
  },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: spacing.md, paddingTop: 10, borderTopWidth: 1,
  },
  input: {
    flex: 1, borderRadius: borderRadius.xl, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, maxHeight: 100, fontWeight: '500',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { fontSize: 18, fontWeight: '900' },
});
