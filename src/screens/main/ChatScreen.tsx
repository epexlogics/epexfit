/**
 * ChatScreen — Real-time 1:1 direct messages
 *
 * Features:
 * - Live messages via Supabase Realtime
 * - Typing indicator
 * - Read receipts (marks read on open)
 * - Blocked users cannot DM
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import AppIcon from '../../components/AppIcon';
import { dmService, DirectMessage } from '../../services/dmService';
import { isUserBlocked } from '../../services/moderationService';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

type ChatParams = {
  Chat: {
    partnerId: string;
    partnerName: string;
    partnerAvatar?: string;
  };
};

function MessageBubble({
  msg,
  isMe,
  colors,
  accent,
}: {
  msg: DirectMessage;
  isMe: boolean;
  colors: any;
  accent: string;
}) {
  return (
    <View style={[bS.wrap, isMe ? bS.wrapMe : bS.wrapThem]}>
      <View
        style={[
          bS.bubble,
          {
            backgroundColor: isMe ? accent : colors.surfaceElevated,
            borderColor: isMe ? 'transparent' : colors.border,
          },
        ]}
      >
        <Text style={[bS.text, { color: isMe ? '#fff' : colors.text }]}>{msg.message}</Text>
      </View>
      <Text style={[bS.time, { color: colors.textDisabled, alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
        {dayjs(msg.createdAt).format('h:mm A')}
        {isMe && msg.isRead ? '  ✓✓' : ''}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const { colors, accent } = useTheme();
  const { user } = useAuth();
  const { show } = useToast();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ChatParams, 'Chat'>>();
  const { partnerId, partnerName } = route.params;

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false); // partner typing indicator (future: presence channel)
  const listRef = useRef<FlatList<DirectMessage>>(null);

  // ── Load + subscribe ───────────────────────────────────────────────────
  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      // Check block status
      const isBlocked = await isUserBlocked(partnerId);
      setBlocked(isBlocked);
      if (isBlocked) { setLoading(false); return; }

      // Load history
      const history = await dmService.getMessages(partnerId);
      setMessages(history);
      setLoading(false);

      // Mark incoming as read
      await dmService.markRead(partnerId);

      // Subscribe to new messages
      if (user) {
        unsub = dmService.subscribeToMessages(partnerId, user.id, (msg) => {
          setMessages((prev) => [...prev, msg]);
          dmService.markRead(partnerId);
        });
      }
    })();

    return () => { unsub?.(); };
  }, [partnerId, user]);

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      const msg = await dmService.send(partnerId, trimmed);
      setMessages((prev) => [...prev, msg]);
    } catch {
      show({ message: 'Failed to send message', variant: 'error' });
      setText(trimmed); // restore
    } finally {
      setSending(false);
    }
  }, [text, sending, partnerId, show]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={[cS.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <AppIcon name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={cS.headerInfo}>
          <View style={[cS.avatarFallback, { backgroundColor: accent + '25' }]}>
            <Text style={{ color: accent, fontWeight: '700' }}>{partnerName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[cS.partnerName, { color: colors.text }]}>{partnerName}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {blocked ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>🚫</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            You've blocked this user
          </Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
            Unblock them in Settings to send messages.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble
                msg={item}
                isMe={item.senderId === user?.id}
                colors={colors}
                accent={accent}
              />
            )}
            contentContainerStyle={{ padding: spacing.md, gap: 4 }}
            showsVerticalScrollIndicator={false}
          />

          {typing && (
            <Text style={[cS.typingIndicator, { color: colors.textSecondary }]}>
              {partnerName} is typing…
            </Text>
          )}

          {/* Input bar */}
          <View style={[cS.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TextInput
              style={[
                cS.input,
                { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Message…"
              placeholderTextColor={colors.textDisabled}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[cS.sendBtn, { backgroundColor: text.trim() ? accent : colors.border }]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <AppIcon name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const cS = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  partnerName: { fontSize: 16, fontWeight: '700' },
  typingIndicator: { fontSize: 12, paddingHorizontal: spacing.md, paddingBottom: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const bS = StyleSheet.create({
  wrap: { marginVertical: 2, maxWidth: '78%' },
  wrapMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 11, marginTop: 3 },
});
