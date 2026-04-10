/**
 * socialService.ts — Fixed social service
 *
 * ROOT CAUSE FIXES:
 * 1. Followers/Following lists: replaced `profiles!follower_id` FK-hint join
 *    (which silently returns null if FK name differs) with a two-step query:
 *    first fetch the IDs, then fetch profiles by those IDs.
 * 2. Comments: same FK-hint issue fixed — now fetches profile separately.
 * 3. Feed: explicit actor_id filter + RLS ensures only followed users' posts.
 * 4. Search: ilike on both full_name and username, handles null username.
 * 5. createPost / shareActivity: single source of truth → activity_feed table.
 * 6. Like/comment counts: use aggregate count queries, not subquery arrays.
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────────────────

export type FeedItemType =
  | 'activity_completed'
  | 'goal_achieved'
  | 'streak'
  | 'weight_logged'
  | 'social_post';

export interface FeedItem {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  type: FeedItemType;
  payload: Record<string, any>;
  content?: string;
  imageUrl?: string;
  createdAt: Date;
  liked: boolean;
  likeCount: number;
  commentCount: number;
}

export interface FeedComment {
  id: string;
  feedItemId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: Date;
}

export interface FollowUser {
  id: string;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  isFollowing: boolean;
  followsMe: boolean;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export interface PublicProfile {
  id: string;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  activityCount: number;
  badgeIds: string[];
  streak: number;
  isFollowing: boolean;
  followsMe: boolean;
}

export interface UserPost {
  id: string;
  content: string;
  imageUrl?: string;
  activityId?: string;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  type: string;
  payload: Record<string, any>;
}

const FEED_CACHE_KEY = '@epexfit_social_feed';

// ── Helpers ────────────────────────────────────────────────────────────────

async function getMyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Fetch profiles by an array of IDs.
 * Returns a map of id → profile row.
 * FIX: avoids FK-hint join syntax that silently fails.
 */
async function fetchProfilesById(ids: string[]): Promise<Record<string, any>> {
  if (!ids.length) return {};
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', ids);
  const map: Record<string, any> = {};
  (data ?? []).forEach((p: any) => { map[p.id] = p; });
  return map;
}

// ── Service ────────────────────────────────────────────────────────────────

class SocialService {

  // ── Follow / Unfollow ────────────────────────────────────────────────────

  async follow(followingId: string): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');
      if (myId === followingId) throw new Error('Cannot follow yourself');
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: myId, following_id: followingId });
      return { error };
    } catch (error) {
      return { error };
    }
  }

  async unfollow(followingId: string): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', myId)
        .eq('following_id', followingId);
      return { error };
    } catch (error) {
      return { error };
    }
  }

  async isFollowing(followingId: string): Promise<boolean> {
    try {
      const myId = await getMyId();
      if (!myId) return false;
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', myId)
        .eq('following_id', followingId)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }

  // ── Follow counts ────────────────────────────────────────────────────────

  async getFollowCounts(userId: string): Promise<FollowCounts> {
    try {
      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId),
      ]);
      return {
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    } catch {
      return { followers: 0, following: 0 };
    }
  }

  // ── Followers / Following lists ──────────────────────────────────────────
  // FIX: Two-step query instead of FK-hint join to avoid silent null returns.

  async getFollowers(userId: string): Promise<FollowUser[]> {
    try {
      const myId = await getMyId();

      // Step 1: get follower IDs
      const { data: rows } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId);

      if (!rows?.length) return [];
      const ids = rows.map((r: any) => r.follower_id);

      // Step 2: fetch profiles for those IDs
      const profileMap = await fetchProfilesById(ids);
      const profiles = ids.map((id: string) => profileMap[id]).filter(Boolean);

      return await this._enrichWithFollowStatus(profiles, ids, myId);
    } catch {
      return [];
    }
  }

  async getFollowing(userId: string): Promise<FollowUser[]> {
    try {
      const myId = await getMyId();

      // Step 1: get following IDs
      const { data: rows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (!rows?.length) return [];
      const ids = rows.map((r: any) => r.following_id);

      // Step 2: fetch profiles for those IDs
      const profileMap = await fetchProfilesById(ids);
      const profiles = ids.map((id: string) => profileMap[id]).filter(Boolean);

      return await this._enrichWithFollowStatus(profiles, ids, myId);
    } catch {
      return [];
    }
  }

  private async _enrichWithFollowStatus(
    profiles: any[], ids: string[], myId: string | null,
  ): Promise<FollowUser[]> {
    if (!ids.length) return [];

    const [myFollowsRes, followsMeRes] = await Promise.all([
      myId
        ? supabase.from('follows').select('following_id').eq('follower_id', myId).in('following_id', ids)
        : Promise.resolve({ data: [] }),
      myId
        ? supabase.from('follows').select('follower_id').eq('following_id', myId).in('follower_id', ids)
        : Promise.resolve({ data: [] }),
    ]);

    const myFollowSet  = new Set((myFollowsRes.data ?? []).map((f: any) => f.following_id));
    const followsMeSet = new Set((followsMeRes.data ?? []).map((f: any) => f.follower_id));

    return profiles.map((p: any) => ({
      id: p.id,
      fullName: p.full_name ?? 'EpexFit User',
      username: p.username,
      avatarUrl: p.avatar_url,
      isFollowing: myFollowSet.has(p.id),
      followsMe: followsMeSet.has(p.id),
    }));
  }

  // ── Public profile ───────────────────────────────────────────────────────

  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    try {
      const myId = await getMyId();

      const [
        profileRes,
        followersRes,
        followingRes,
        activitiesRes,
        amFollowingRes,
        theyFollowMeRes,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio, is_private, location, website')
          .eq('id', userId)
          .maybeSingle(),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('activities').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        myId
          ? supabase.from('follows').select('id').eq('follower_id', myId).eq('following_id', userId).maybeSingle()
          : Promise.resolve({ data: null }),
        myId
          ? supabase.from('follows').select('id').eq('follower_id', userId).eq('following_id', myId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const profile = profileRes.data;
      if (!profile) return null;

      let badgeIds: string[] = [];
      let streak = 0;
      try {
        const { getUnlockedBadgeIds } = await import('./streaks');
        badgeIds = await getUnlockedBadgeIds(userId);
      } catch {}
      try {
        const { recalculateStreak } = await import('./streaks');
        streak = await recalculateStreak(userId);
      } catch {}

      return {
        id: userId,
        fullName: profile.full_name ?? 'EpexFit User',
        username: profile.username,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        location: profile.location,
        website: profile.website,
        isPrivate: profile.is_private ?? false,
        followerCount: followersRes.count ?? 0,
        followingCount: followingRes.count ?? 0,
        activityCount: activitiesRes.count ?? 0,
        badgeIds,
        streak,
        isFollowing: !!amFollowingRes.data,
        followsMe: !!theyFollowMeRes.data,
      };
    } catch {
      return null;
    }
  }

  // ── User's recent activities ─────────────────────────────────────────────

  async getUserActivities(userId: string, limit = 10): Promise<any[]> {
    try {
      const { data } = await supabase
        .from('activities')
        .select('id, type, distance, duration, calories, steps, start_time, notes')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(limit);
      return data ?? [];
    } catch {
      return [];
    }
  }

  // ── User's posts ─────────────────────────────────────────────────────────
  // FIX: fetch like/comment counts via separate count queries (not subquery arrays)

  async getUserPosts(userId: string, limit = 20): Promise<UserPost[]> {
    try {
      const myId = await getMyId();

      const { data: posts } = await supabase
        .from('activity_feed')
        .select('id, type, payload, created_at')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!posts?.length) return [];

      const postIds = posts.map((p: any) => p.id);

      // Fetch counts and likes in parallel
      const [likesCountRes, commentsCountRes, myLikesRes] = await Promise.all([
        supabase.from('feed_likes').select('feed_item_id').in('feed_item_id', postIds),
        supabase.from('feed_comments').select('feed_item_id').in('feed_item_id', postIds),
        myId
          ? supabase.from('feed_likes').select('feed_item_id').eq('user_id', myId).in('feed_item_id', postIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Build count maps
      const likeCountMap: Record<string, number> = {};
      const commentCountMap: Record<string, number> = {};
      (likesCountRes.data ?? []).forEach((r: any) => {
        likeCountMap[r.feed_item_id] = (likeCountMap[r.feed_item_id] ?? 0) + 1;
      });
      (commentsCountRes.data ?? []).forEach((r: any) => {
        commentCountMap[r.feed_item_id] = (commentCountMap[r.feed_item_id] ?? 0) + 1;
      });

      const likedSet = new Set((myLikesRes.data ?? []).map((l: any) => l.feed_item_id));

      return posts.map((p: any) => ({
        id: p.id,
        content: p.payload?.content ?? '',
        imageUrl: p.payload?.image_url,
        activityId: p.payload?.activity_id,
        createdAt: new Date(p.created_at),
        likeCount: likeCountMap[p.id] ?? 0,
        commentCount: commentCountMap[p.id] ?? 0,
        liked: likedSet.has(p.id),
        type: p.type,
        payload: p.payload ?? {},
      }));
    } catch {
      return [];
    }
  }

  // ── Privacy ──────────────────────────────────────────────────────────────

  async setProfilePrivacy(isPrivate: boolean): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles')
        .update({ is_private: isPrivate })
        .eq('id', myId);
      return { error };
    } catch (error) {
      return { error };
    }
  }

  async getProfilePrivacy(): Promise<boolean> {
    try {
      const myId = await getMyId();
      if (!myId) return false;
      const { data } = await supabase
        .from('profiles')
        .select('is_private')
        .eq('id', myId)
        .maybeSingle();
      return data?.is_private ?? false;
    } catch {
      return false;
    }
  }

  // ── Feed ─────────────────────────────────────────────────────────────────
  // FIX: explicit actor_id filter (belt + suspenders alongside RLS)
  // FIX: count maps instead of subquery arrays

  async getFeed(limit = 30): Promise<{ items: FeedItem[]; fromCache: boolean }> {
    try {
      const myId = await getMyId();
      if (!myId) return { items: [], fromCache: false };

      // Get IDs of people I follow
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', myId);

      const followingIds = (followRows ?? []).map((f: any) => f.following_id);
      const actorIds = [...new Set([myId, ...followingIds])];

      // FIX: if actorIds is somehow empty, return empty feed (never query without filter)
      if (!actorIds.length) return { items: [], fromCache: false };

      // Fetch feed rows filtered to only my network
      const { data: feedRows, error } = await supabase
        .from('activity_feed')
        .select('id, actor_id, type, payload, created_at')
        .in('actor_id', actorIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!feedRows?.length) return { items: [], fromCache: false };

      const feedIds = feedRows.map((r: any) => r.id);
      const uniqueActorIds = [...new Set(feedRows.map((r: any) => r.actor_id))];

      // Fetch counts and profiles in parallel
      const [likesRes, commentsRes, myLikesRes, profileMap] = await Promise.all([
        supabase.from('feed_likes').select('feed_item_id').in('feed_item_id', feedIds),
        supabase.from('feed_comments').select('feed_item_id').in('feed_item_id', feedIds),
        supabase.from('feed_likes').select('feed_item_id').eq('user_id', myId).in('feed_item_id', feedIds),
        fetchProfilesById(uniqueActorIds),
      ]);

      // Build count maps
      const likeCountMap: Record<string, number> = {};
      const commentCountMap: Record<string, number> = {};
      (likesRes.data ?? []).forEach((r: any) => {
        likeCountMap[r.feed_item_id] = (likeCountMap[r.feed_item_id] ?? 0) + 1;
      });
      (commentsRes.data ?? []).forEach((r: any) => {
        commentCountMap[r.feed_item_id] = (commentCountMap[r.feed_item_id] ?? 0) + 1;
      });

      const likedSet = new Set((myLikesRes.data ?? []).map((l: any) => l.feed_item_id));

      const items: FeedItem[] = feedRows.map((row: any) => {
        const actor = profileMap[row.actor_id] ?? {};
        return {
          id: row.id,
          actorId: row.actor_id,
          actorName: actor.full_name ?? 'EpexFit User',
          actorAvatar: actor.avatar_url,
          type: row.type,
          payload: row.payload ?? {},
          content: row.payload?.content,
          imageUrl: row.payload?.image_url,
          createdAt: new Date(row.created_at),
          liked: likedSet.has(row.id),
          likeCount: likeCountMap[row.id] ?? 0,
          commentCount: commentCountMap[row.id] ?? 0,
        };
      });

      try {
        await AsyncStorage.setItem(
          FEED_CACHE_KEY,
          JSON.stringify(items.map(i => ({ ...i, createdAt: i.createdAt.toISOString() }))),
        );
      } catch {}

      return { items, fromCache: false };
    } catch {
      try {
        const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw).map((i: any) => ({
            ...i, createdAt: new Date(i.createdAt),
          }));
          return { items: parsed, fromCache: true };
        }
      } catch {}
      return { items: [], fromCache: false };
    }
  }

  // ── Likes ────────────────────────────────────────────────────────────────

  async toggleLike(feedItemId: string, currentlyLiked: boolean): Promise<void> {
    try {
      const myId = await getMyId();
      if (!myId || !feedItemId) return;
      if (currentlyLiked) {
        await supabase.from('feed_likes').delete()
          .eq('feed_item_id', feedItemId).eq('user_id', myId);
      } else {
        // upsert to prevent duplicate like on rapid double-tap
        await supabase.from('feed_likes')
          .upsert({ feed_item_id: feedItemId, user_id: myId }, { onConflict: 'feed_item_id,user_id' });
      }
    } catch {}
  }

  // ── Comments ─────────────────────────────────────────────────────────────
  // FIX: two-step query — fetch comments then fetch profiles separately

  async getComments(feedItemId: string): Promise<FeedComment[]> {
    try {
      // Step 1: fetch comments
      const { data: rows, error } = await supabase
        .from('feed_comments')
        .select('id, feed_item_id, user_id, content, created_at')
        .eq('feed_item_id', feedItemId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      if (!rows?.length) return [];

      // Step 2: fetch profiles for comment authors
      const userIds = [...new Set(rows.map((r: any) => r.user_id))];
      const profileMap = await fetchProfilesById(userIds);

      return rows.map((r: any) => {
        const profile = profileMap[r.user_id] ?? {};
        return {
          id: r.id,
          feedItemId: r.feed_item_id,
          userId: r.user_id,
          userName: profile.full_name ?? 'EpexFit User',
          userAvatar: profile.avatar_url,
          content: r.content,
          createdAt: new Date(r.created_at),
        };
      });
    } catch {
      return [];
    }
  }

  async postComment(feedItemId: string, content: string): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');
      const trimmed = content.trim();
      if (!trimmed) throw new Error('Comment cannot be empty');
      const { error } = await supabase
        .from('feed_comments')
        .insert({ feed_item_id: feedItemId, user_id: myId, content: trimmed });
      return { error };
    } catch (error) {
      return { error };
    }
  }

  async deleteComment(commentId: string): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('feed_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', myId);
      return { error };
    } catch (error) {
      return { error };
    }
  }

  // ── Publish feed event ───────────────────────────────────────────────────

  async publishFeedEvent(
    type: FeedItem['type'],
    payload: Record<string, any>,
  ): Promise<string | null> {
    try {
      const myId = await getMyId();
      if (!myId) return null;
      const { data } = await supabase
        .from('activity_feed')
        .insert({ actor_id: myId, type, payload })
        .select('id')
        .single();
      return data?.id ?? null;
    } catch {
      return null;
    }
  }

  // ── Create manual social post ────────────────────────────────────────────

  async createPost(content: string, imageUrl?: string): Promise<{ id: string | null; error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('activity_feed')
        .insert({
          actor_id: myId,
          type: 'social_post',
          payload: {
            content: content.trim(),
            image_url: imageUrl ?? null,
          },
        })
        .select('id')
        .single();

      return { id: data?.id ?? null, error };
    } catch (error) {
      return { id: null, error };
    }
  }

  // ── Share activity as post ───────────────────────────────────────────────

  async shareActivity(activityId: string, content: string, imageUrl?: string): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');

      const { data: activity } = await supabase
        .from('activities')
        .select('type, distance, duration, calories, steps')
        .eq('id', activityId)
        .maybeSingle();

      const { error } = await supabase
        .from('activity_feed')
        .insert({
          actor_id: myId,
          type: 'activity_completed',
          payload: {
            activity_id: activityId,
            content: content.trim(),
            image_url: imageUrl ?? null,
            activityType: activity?.type,
            distance: activity?.distance,
            duration: activity?.duration,
            calories: activity?.calories,
            steps: activity?.steps,
          },
        });
      return { error };
    } catch (error) {
      return { error };
    }
  }

  async deletePost(feedItemId: string): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('activity_feed')
        .delete()
        .eq('id', feedItemId)
        .eq('actor_id', myId);
      return { error };
    } catch (error) {
      return { error };
    }
  }

  // ── User search ──────────────────────────────────────────────────────────
  // FIX: handles null username gracefully, uses ilike on both columns

  async searchUsers(query: string): Promise<Array<{
    id: string;
    full_name: string;
    username?: string;
    avatar_url?: string;
    isFollowing: boolean;
  }>> {
    try {
      const myId = await getMyId();
      const trimmed = query.trim();
      if (!trimmed) return [];

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
        .neq('id', myId ?? '00000000-0000-0000-0000-000000000000')
        .limit(30);

      if (error || !profiles?.length) return [];

      const ids = profiles.map((p: any) => p.id);
      const { data: follows } = myId && ids.length
        ? await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', myId)
            .in('following_id', ids)
        : { data: [] };

      const followingSet = new Set((follows ?? []).map((f: any) => f.following_id));

      return profiles.map((p: any) => ({
        id: p.id,
        full_name: p.full_name ?? 'EpexFit User',
        username: p.username,
        avatar_url: p.avatar_url,
        isFollowing: followingSet.has(p.id),
      }));
    } catch {
      return [];
    }
  }
}

export const socialService = new SocialService();
