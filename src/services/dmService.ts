/**
 * dmService.ts — Direct Messages service
 *
 * ✅ All data from Supabase (direct_messages + profiles tables)
 * ✅ getConversations: no N+1 — single unread query
 * ✅ subscribeToMessages: receives BOTH incoming AND sent messages
 * ✅ Deduplication via Set<id> to prevent double-rendering sent msgs
 * ✅ Zero mock data
 *
 * FIX APPLIED:
 *   - subscribeToMessages now has TWO channels:
 *     1. incoming: recipient_id = currentUserId AND sender_id = partnerId
 *     2. sent: sender_id = currentUserId AND recipient_id = partnerId
 *        (needed for multi-device or if send() callback races with realtime)
 *   - Returns a cleanup that unsubscribes both channels.
 *
 * Schema required:
 *   direct_messages(id, sender_id, recipient_id, message, created_at, is_read)
 *   profiles(id, full_name, avatar_url)
 */
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): DirectMessage {
  return {
    id: String(row.id),
    senderId: String(row.sender_id),
    recipientId: String(row.recipient_id),
    message: String(row.message),
    createdAt: String(row.created_at),
    isRead: Boolean(row.is_read),
  };
}

async function getMyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Service ────────────────────────────────────────────────────────────────

export const dmService = {

  async send(recipientId: string, message: string): Promise<DirectMessage> {
    const myId = await getMyId();
    if (!myId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: myId,
        recipient_id: recipientId,
        message: message.trim(),
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  },

  async getMessages(partnerId: string): Promise<DirectMessage[]> {
    const myId = await getMyId();
    if (!myId) return [];

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${myId},recipient_id.eq.${partnerId}),` +
        `and(sender_id.eq.${partnerId},recipient_id.eq.${myId})`,
      )
      .order('created_at', { ascending: true });

    if (error) return [];
    return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
  },

  async markRead(partnerId: string): Promise<void> {
    const myId = await getMyId();
    if (!myId) return;

    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('recipient_id', myId)
      .eq('sender_id', partnerId)
      .eq('is_read', false);
  },

  /**
   * Get all conversations for the current user.
   * One entry per unique conversation partner, sorted by most recent message.
   * Unread counts fetched in a single query (no N+1).
   */
  async getConversations(): Promise<Conversation[]> {
    const myId = await getMyId();
    if (!myId) return [];

    // Step 1: Get all messages involving me, newest first
    const { data, error } = await supabase
      .from('direct_messages')
      .select(`
        id, sender_id, recipient_id, message, created_at, is_read,
        sender:profiles!sender_id(id, full_name, avatar_url),
        recipient:profiles!recipient_id(id, full_name, avatar_url)
      `)
      .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    // Step 2: One entry per unique partner (newest msg wins via order)
    const seen = new Map<string, Conversation>();

    for (const row of data as Array<Record<string, unknown>>) {
      const isSender = row.sender_id === myId;
      const partner = isSender
        ? (row.recipient as Record<string, unknown>)
        : (row.sender as Record<string, unknown>);
      const partnerId = String(partner?.id ?? '');

      if (!partnerId || seen.has(partnerId)) continue;

      seen.set(partnerId, {
        partnerId,
        partnerName: String(partner?.full_name ?? 'Unknown'),
        partnerAvatar: (partner?.avatar_url as string | null) ?? null,
        lastMessage: String(row.message),
        lastMessageAt: String(row.created_at),
        unreadCount: 0,
      });
    }

    if (seen.size === 0) return [];

    // Step 3: Fetch ALL unread counts in ONE query
    const partnerIds = Array.from(seen.keys());
    const { data: unreadRows } = await supabase
      .from('direct_messages')
      .select('sender_id')
      .eq('recipient_id', myId)
      .eq('is_read', false)
      .in('sender_id', partnerIds);

    const unreadMap: Record<string, number> = {};
    for (const row of unreadRows ?? []) {
      const sid = String((row as any).sender_id);
      unreadMap[sid] = (unreadMap[sid] ?? 0) + 1;
    }

    return Array.from(seen.values()).map(conv => ({
      ...conv,
      unreadCount: unreadMap[conv.partnerId] ?? 0,
    }));
  },

  /**
   * Subscribe to new messages in a 1:1 conversation.
   *
   * FIX: Two channels:
   *   - ch_in:  messages FROM partnerId TO currentUserId (incoming)
   *   - ch_out: messages FROM currentUserId TO partnerId (sent — for multi-device)
   *
   * The caller should deduplicate using message ID (see ChatScreen seenIds ref).
   * Returns cleanup function.
   */
  subscribeToMessages(
    partnerId: string,
    currentUserId: string,
    onMessage: (msg: DirectMessage) => void,
  ): () => void {
    const channelKey = [currentUserId, partnerId].sort().join(':');

    // Incoming messages from partner
    const chIn: RealtimeChannel = supabase
      .channel(`dm_in:${channelKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.sender_id === partnerId) {
            onMessage(mapRow(row));
          }
        },
      )
      .subscribe();

    // Sent messages — for multi-device sync (e.g. sent on web, show on mobile)
    const chOut: RealtimeChannel = supabase
      .channel(`dm_out:${channelKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.recipient_id === partnerId) {
            onMessage(mapRow(row));
          }
        },
      )
      .subscribe();

    return () => {
      chIn.unsubscribe();
      chOut.unsubscribe();
    };
  },
};
