/**
 * DirectMessagesScreen — Conversation inbox
 *
 * Fixes:
 * - Improved dmService.getConversations() no longer has N+1 query
 * - Pull-to-refresh
 * - useFocusEffect so unread counts update when navigating back from chat
 * - New conversation button — navigates to UserSearch to pick someone
 */
import React, { useCallback, useState } from 'react';
import {
  FlatList, Image, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import EmptyState from '../../components/EmptyState';
import { dmService, Conversation } from '../../services/dmService';
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
              <Text style={cS.badgeText}>{item.unreadCount}</Text>
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
  const navigation = useNavigation<any>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const convs = await dmService.getConversations();
    setConversations(convs);
    setLoading(false);
  }, []);

  // Reload every time screen comes into focus (so unread badges update)
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

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
            onPress={() => navigation.navigate('Chat', {
              partnerId: item.partnerId,
              partnerName: item.partnerName,
              partnerAvatar: item.partnerAvatar,
            })}
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
