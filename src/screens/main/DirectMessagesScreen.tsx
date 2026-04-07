/**
 * DirectMessagesScreen — Conversation inbox
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/EmptyState';
import { dmService, Conversation } from '../../services/dmService';
import { borderRadius, spacing } from '../../constants/theme';
import { TAB_BAR_HEIGHT } from '../../constants/layout';
import dayjs from '../../utils/dayjs';

function ConversationCard({
  item,
  onPress,
  colors,
  accent,
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
          borderBottomColor: colors.divider,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {item.partnerAvatar ? (
        <Image source={{ uri: item.partnerAvatar }} style={cS.avatar} />
      ) : (
        <View style={[cS.avatarFallback, { backgroundColor: accent + '25' }]}>
          <Text style={{ fontSize: 18, color: accent }}>
            {item.partnerName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={cS.nameRow}>
          <Text
            style={[
              cS.name,
              { color: colors.text, fontWeight: item.unreadCount > 0 ? '700' : '500' },
            ]}
          >
            {item.partnerName}
          </Text>
          <Text style={[cS.time, { color: colors.textDisabled }]}>
            {dayjs(item.lastMessageAt).fromNow(true)}
          </Text>
        </View>
        <View style={cS.previewRow}>
          <Text
            style={[
              cS.preview,
              {
                color: item.unreadCount > 0 ? colors.text : colors.textSecondary,
                fontWeight: item.unreadCount > 0 ? '500' : '400',
              },
            ]}
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
  const { colors, accent } = useTheme();
  const navigation = useNavigation<any>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const convs = await dmService.getConversations();
    setConversations(convs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[dS.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <AppIcon name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[dS.title, { color: colors.text }]}>Messages</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.partnerId}
        renderItem={({ item }) => (
          <ConversationCard
            item={item}
            colors={colors}
            accent={accent}
            onPress={() =>
              navigation.navigate('Chat', {
                partnerId: item.partnerId,
                partnerName: item.partnerName,
                partnerAvatar: item.partnerAvatar,
              })
            }
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
              message="Send a message to someone you follow to start a conversation."
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const dS = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
});

const cS = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15 },
  time: { fontSize: 12 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1, fontSize: 13 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
