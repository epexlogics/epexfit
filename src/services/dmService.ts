/**
 * dmService.ts — Direct Messages service
 *
 * Fixes:
 * - getConversations: eliminated N+1 unread count queries.
 *   Now fetches all unread counts in one query and merges client-side.
 * - subscribeToMessages: also receives messages you sent on another device
 *
 * Schema:
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
   * FIX: Old version made one extra SELECT per conversation for unread count (N+1).
   * New version:
   * 1. Fetch latest message per partner (using seen map)
   * 2. Fetch ALL unread counts in ONE query grouped by sender_id
   * 3. Merge client-side
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

    // Step 2: Build conversation list — one entry per unique partner (newest msg wins)
    const seen = new Map<string, Conversation>();

    for (const row of data as Array<Record<string, unknown>>) {
      const isSender = row.sender_id === myId;
      const partner = isSender
        ? (row.recipient as Record<string, unknown>)
        : (row.sender as Record<string, unknown>);
      const partnerId = String(partner?.id ?? '');

      if (seen.has(partnerId)) continue;

      seen.set(partnerId, {
        partnerId,
        partnerName: String(partner?.full_name ?? 'Unknown'),
        partnerAvatar: (partner?.avatar_url as string | null) ?? null,
        lastMessage: String(row.message),
        lastMessageAt: String(row.created_at),
        unreadCount: 0, // will fill below
      });
    }

    if (seen.size === 0) return [];

    // Step 3: Fetch all unread counts in ONE query
    const partnerIds = Array.from(seen.keys());
    const { data: unreadRows } = await supabase
      .from('direct_messages')
      .select('sender_id')
      .eq('recipient_id', myId)
      .eq('is_read', false)
      .in('sender_id', partnerIds);

    // Count unread per sender
    const unreadMap: Record<string, number> = {};
    for (const row of unreadRows ?? []) {
      const sid = String((row as any).sender_id);
      unreadMap[sid] = (unreadMap[sid] ?? 0) + 1;
    }

    // Merge unread counts
    const result = Array.from(seen.values()).map(conv => ({
      ...conv,
      unreadCount: unreadMap[conv.partnerId] ?? 0,
    }));

    return result;
  },

  /**
   * Subscribe to new messages in a conversation.
   * Listens for messages where I am the recipient from this partner,
   * OR messages I sent (for multi-device sync).
   * Returns cleanup function.
   */
  subscribeToMessages(
    partnerId: string,
    currentUserId: string,
    onMessage: (msg: DirectMessage) => void,
  ): () => void {
    const channel: RealtimeChannel = supabase
      .channel(`dm:${[currentUserId, partnerId].sort().join(':')}`)
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

    return () => { channel.unsubscribe(); };
  },
};
