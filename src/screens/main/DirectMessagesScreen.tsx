/**
 * DirectMessagesScreen — Real-time conversation inbox
 *
 * ✅ Real Supabase data via dmService.getConversations()
 * ✅ Unread badge counts from DB (no N+1 queries)
 * ✅ Real-time: new incoming messages update unread badge live
 * ✅ Pull-to-refresh
 * ✅ useFocusEffect to reload when navigating back from chat
 * ✅ Zero mock data
 *
 * FIX APPLIED: Added Supabase Realtime subscription on 'direct_messages'
 * table so unread counts update instantly when a new message arrives —
 * no need to leave and re-enter the screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, Image, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/EmptyState';
import { dmService, Conversation } from '../../services/dmService';
import { supabase } from '../../services/supabase';
import { spacing } from '../../constants/theme';
import { TAB_BAR_HEIGHT } from '../../constants/layout';
import dayjs from '../../utils/dayjs';

function ConversationCard({
  item, onPress, colors, accent,
}: {
  item: Conversation;
  onPress: () => void;
  colors: any;
  accent: string;
}) {
  return (
    <TouchableOpacity
      style={[
        cS.card,
        {
          backgroundColor: item.unreadCount > 0 ? colors.surfaceElevated : colors.surface,
          borderBottomColor: colors.divider ?? colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {item.partnerAvatar ? (
        <Image source={{ uri: item.partnerAvatar }} style={cS.avatar} />
      ) : (
        <View style={[cS.avatarFallback, { backgroundColor: accent + '25' }]}>
          <Text style={{ fontSize: 18, color: accent, fontWeight: '700' }}>
            {item.partnerName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={cS.nameRow}>
          <Text style={[cS.name, {
            color: colors.text,
            fontWeight: item.unreadCount > 0 ? '700' : '500',
          }]}>
            {item.partnerName}
          </Text>
          <Text style={[cS.time, { color: colors.textSecondary }]}>
            {dayjs(item.lastMessageAt).fromNow(true)}
          </Text>
        </View>
        <View style={cS.previewRow}>
          <Text
            style={[cS.preview, {
              color: item.unreadCount > 0 ? colors.text : colors.textSecondary,
              fontWeight: item.unreadCount > 0 ? '500' : '400',
            }]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={[cS.badge, { backgroundColor: accent }]}>
              <Text style={cS.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DirectMessagesScreen() {
  const { colors } = useTheme();
  const accent = colors.primary;
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const convs = await dmService.getConversations();
    setConversations(convs);
    setLoading(false);
  }, []);

  // Reload every time screen comes into focus (unread badges update after chat)
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // Real-time: when a new DM arrives, bump unread count for that sender
  useEffect(() => {
    if (!user?.id) return;

    channelRef.current = supabase
      .channel(`dm_inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          const senderId = row?.sender_id;
          if (!senderId) return;

          setConversations(prev => {
            const exists = prev.find(c => c.partnerId === senderId);
            if (exists) {
              // Update existing conversation: new last message + increment unread
              return prev
                .map(c =>
                  c.partnerId === senderId
                    ? {
                        ...c,
                        lastMessage: row.message ?? c.lastMessage,
                        lastMessageAt: row.created_at ?? c.lastMessageAt,
                        unreadCount: c.unreadCount + 1,
                      }
                    : c,
                )
                .sort((a, b) =>
                  new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
                );
            }
            // New conversation — reload full list to get partner profile
            load();
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [user?.id, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[dS.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={[dS.title, { color: colors.text }]}>Messages</Text>
        <TouchableOpacity
          style={[dS.newBtn, { backgroundColor: accent + '15', borderColor: accent + '30' }]}
          onPress={() => navigation.navigate('UserSearch')}
          activeOpacity={0.8}
        >
          <Text style={{ color: accent, fontSize: 13, fontWeight: '800' }}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={item => item.partnerId}
        renderItem={({ item }) => (
          <ConversationCard
            item={item}
            colors={colors}
            accent={accent}
            onPress={() => {
              // Reset unread count locally on open
              setConversations(prev =>
                prev.map(c => c.partnerId === item.partnerId ? { ...c, unreadCount: 0 } : c),
              );
              navigation.navigate('Chat', {
                partnerId: item.partnerId,
                partnerName: item.partnerName,
                partnerAvatar: item.partnerAvatar,
              });
            }}
          />
        )}
        contentContainerStyle={[
          { paddingBottom: TAB_BAR_HEIGHT + 24 },
          conversations.length === 0 && { flex: 1 },
        ]}
        onRefresh={load}
        refreshing={loading}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="chat-outline"
              title="No messages yet"
              message="Tap '+ New' to message someone you follow."
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const dS = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
  newBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
  },
});

const cS = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15 },
  time: { fontSize: 12 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1, fontSize: 13 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
