/**
 * moderationService.ts — Report & Block system
 *
 * Supabase schema required (see DEPLOYMENT_GUIDE.md):
 *   - reports(id, reporter_id, reported_user_id, post_id, reason, details, created_at, status)
 *   - blocked_users(id, blocker_id, blocked_id, created_at)
 */
import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'offensive'
  | 'misinformation'
  | 'other';

export interface ReportPayload {
  reportedUserId: string;
  postId?: string;
  reason: ReportReason;
  details?: string;
}

export interface BlockedUser {
  blockedId: string;
  createdAt: string;
}

// ── Reports ────────────────────────────────────────────────────────────────

export async function submitReport(payload: ReportPayload): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    reported_user_id: payload.reportedUserId,
    post_id: payload.postId ?? null,
    reason: payload.reason,
    details: payload.details ?? null,
    status: 'pending',
  });

  if (error) throw error;
}

// ── Block / Unblock ────────────────────────────────────────────────────────

export async function blockUser(blockedId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('blocked_users').upsert({
    blocker_id: user.id,
    blocked_id: blockedId,
  });

  if (error) throw error;
}

export async function unblockUser(blockedId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId);

  if (error) throw error;
}

export async function getBlockedUserIds(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', user.id);

  if (error || !data) return [];
  return data.map((row: { blocked_id: string }) => row.blocked_id);
}

export async function isUserBlocked(targetId: string): Promise<boolean> {
  const blocked = await getBlockedUserIds();
  return blocked.includes(targetId);
}
