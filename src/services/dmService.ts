/**
 * dmService.ts — Direct Messages service
 *
 * Schema (see DEPLOYMENT_GUIDE.md):
 *   direct_messages(id, sender_id, recipient_id, message, created_at, is_read)
 *
 * Uses Supabase Realtime for live updates.
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
  /** The other participant's user ID */
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

// ── Service ────────────────────────────────────────────────────────────────

export const dmService = {
  /**
   * Send a message.
   */
  async send(recipientId: string, message: string): Promise<DirectMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        message: message.trim(),
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;
    return mapRow(data as Record<string, unknown>);
  },

  /**
   * Get all messages in a conversation (newest last).
   */
  async getMessages(partnerId: string): Promise<DirectMessage[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),` +
        `and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`,
      )
      .order('created_at', { ascending: true });

    if (error) return [];
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  },

  /**
   * Mark all messages from a partner as read.
   */
  async markRead(partnerId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('recipient_id', user.id)
      .eq('sender_id', partnerId)
      .eq('is_read', false);
  },

  /**
   * Get conversation list for inbox — one entry per unique partner.
   * Sorted newest-first by last message.
   */
  async getConversations(): Promise<Conversation[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('direct_messages')
      .select(`
        id, sender_id, recipient_id, message, created_at, is_read,
        sender:profiles!sender_id(id, full_name, avatar_url),
        recipient:profiles!recipient_id(id, full_name, avatar_url)
      `)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    const seen = new Map<string, Conversation>();

    for (const row of data as Array<Record<string, unknown>>) {
      const isSender = row.sender_id === user.id;
      const partner = isSender
        ? (row.recipient as Record<string, unknown>)
        : (row.sender as Record<string, unknown>);
      const partnerId = String(partner?.id ?? '');

      if (seen.has(partnerId)) continue;

      const unreadCount = isSender
        ? 0
        : (await supabase
            .from('direct_messages')
            .select('id', { count: 'exact', head: true })
            .eq('sender_id', partnerId)
            .eq('recipient_id', user.id)
            .eq('is_read', false)
          ).count ?? 0;

      seen.set(partnerId, {
        partnerId,
        partnerName: String(partner?.full_name ?? 'Unknown'),
        partnerAvatar: (partner?.avatar_url as string | null) ?? null,
        lastMessage: String(row.message),
        lastMessageAt: String(row.created_at),
        unreadCount: Number(unreadCount),
      });
    }

    return Array.from(seen.values());
  },

  /**
   * Subscribe to new messages in a conversation.
   * Returns cleanup function.
   */
  subscribeToMessages(
    partnerId: string,
    currentUserId: string,
    onMessage: (msg: DirectMessage) => void,
  ): () => void {
    const channel: RealtimeChannel = supabase
      .channel(`dm:${currentUserId}:${partnerId}`)
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
