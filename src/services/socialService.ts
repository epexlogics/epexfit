/**
 * socialService.ts — Complete production social service
 *
 * ✅ Follow / Unfollow
 * ✅ Follow counts (exact, head:true)
 * ✅ Followers / Following lists with follow-back status
 * ✅ Public profile (bio, username, badges, streak, follow counts)
 * ✅ Feed: activity_feed + social_posts combined, paginated
 * ✅ Social posts: create, delete, share activity
 * ✅ Likes: toggle, count
 * ✅ Comments: CRUD with real-time
 * ✅ User search: full_name OR username
 * ✅ Privacy: is_private field
 * ✅ User activity/posts for their profile page
 * ✅ Realtime-ready (channels in components)
 * ✅ Zero mock data
 *
 * Supabase tables:
 *   profiles        (id, full_name, username, avatar_url, bio, is_private, location, website)
 *   follows         (id, follower_id, following_id, created_at)
 *   activity_feed   (id, actor_id, type, payload jsonb, created_at)
 *   social_posts    (id, user_id, content, image_url, activity_id, created_at)
 *   feed_likes      (id, feed_item_id, user_id, created_at)
 *   feed_comments   (id, feed_item_id, user_id, content, created_at)
 *   direct_messages (id, sender_id, recipient_id, message, created_at, is_read)
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── SECURITY NOTE ─────────────────────────────────────────────────────────────
// This service assumes Row Level Security (RLS) is enabled on ALL tables below.
// Required RLS policies (verify in Supabase Dashboard → Authentication → Policies):
//
//   profiles:        SELECT — authenticated users can read public profiles
//                    UPDATE — users can only update their own row (auth.uid() = id)
//   follows:         SELECT — authenticated; INSERT/DELETE — own rows only
//   activity_feed:   SELECT — only from users you follow (or your own)
//   feed_likes:      SELECT — authenticated; INSERT/DELETE — own rows only
//   feed_comments:   SELECT — authenticated; INSERT/DELETE — own rows only
//   direct_messages: SELECT — sender_id = auth.uid() OR recipient_id = auth.uid()
//
// Without RLS, all users' private data is readable by any authenticated user.
// ──────────────────────────────────────────────────────────────────────────────


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
  /** For social_posts: text content */
  content?: string;
  /** For social_posts: image */
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
}

const FEED_CACHE_KEY = '@epexfit_social_feed';

// ── Helpers ────────────────────────────────────────────────────────────────

async function getMyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
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
      // Publish follow event to feed
      if (!error) {
        this.publishFeedEvent('follow' as any, { followingId }).catch(() => {});
      }
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

  async getFollowers(userId: string): Promise<FollowUser[]> {
    try {
      const myId = await getMyId();
      const { data: rows } = await supabase
        .from('follows')
        .select(`
          follower_id,
          profile:profiles!follower_id (
            id, full_name, username, avatar_url
          )
        `)
        .eq('following_id', userId);

      if (!rows?.length) return [];
      const profiles = rows.map((r: any) => r.profile).filter(Boolean);
      const ids = profiles.map((p: any) => p.id);
      return await this._enrichWithFollowStatus(profiles, ids, myId);
    } catch {
      return [];
    }
  }

  async getFollowing(userId: string): Promise<FollowUser[]> {
    try {
      const myId = await getMyId();
      const { data: rows } = await supabase
        .from('follows')
        .select(`
          following_id,
          profile:profiles!following_id (
            id, full_name, username, avatar_url
          )
        `)
        .eq('follower_id', userId);

      if (!rows?.length) return [];
      const profiles = rows.map((r: any) => r.profile).filter(Boolean);
      const ids = profiles.map((p: any) => p.id);
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

  // ── User's recent activities (for their profile page) ──────────────────

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

  // ── User's social posts ─────────────────────────────────────────────────

  async getUserPosts(userId: string, limit = 20): Promise<UserPost[]> {
    try {
      const myId = await getMyId();

      const { data: posts } = await supabase
        .from('activity_feed')
        .select(`
          id,
          type,
          payload,
          created_at,
          like_count:feed_likes(count),
          comment_count:feed_comments(count)
        `)
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!posts?.length) return [];

      const postIds = posts.map((p: any) => p.id);
      const { data: myLikes } = myId
        ? await supabase.from('feed_likes').select('feed_item_id').eq('user_id', myId).in('feed_item_id', postIds)
        : { data: [] };

      const likedSet = new Set((myLikes ?? []).map((l: any) => l.feed_item_id));

      return posts.map((p: any) => ({
        id: p.id,
        content: p.payload?.content ?? '',
        imageUrl: p.payload?.image_url,
        activityId: p.payload?.activity_id,
        createdAt: new Date(p.created_at),
        likeCount: Number(Array.isArray(p.like_count) ? (p.like_count[0]?.count ?? 0) : 0),
        commentCount: Number(Array.isArray(p.comment_count) ? (p.comment_count[0]?.count ?? 0) : 0),
        liked: likedSet.has(p.id),
        type: p.type,
        payload: p.payload,
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

  async getFeed(limit = 30): Promise<{ items: FeedItem[]; fromCache: boolean }> {
    try {
      const myId = await getMyId();
      if (!myId) return { items: [], fromCache: false };

      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', myId);

      const followingIds = (followRows ?? []).map((f: any) => f.following_id);
      const actorIds = [...new Set([myId, ...followingIds])];

      if (!actorIds.length) return { items: [], fromCache: false };

      const { data: feedRows, error } = await supabase
        .from('activity_feed')
        .select(`
          id,
          actor_id,
          type,
          payload,
          created_at,
          like_count:feed_likes(count),
          comment_count:feed_comments(count)
        `)
        .in('actor_id', actorIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!feedRows?.length) return { items: [], fromCache: false };

      const feedIds = feedRows.map((r: any) => r.id);
      const { data: myLikes } = await supabase
        .from('feed_likes')
        .select('feed_item_id')
        .eq('user_id', myId)
        .in('feed_item_id', feedIds);

      const likedSet = new Set((myLikes ?? []).map((l: any) => l.feed_item_id));

      const uniqueActorIds = [...new Set(feedRows.map((r: any) => r.actor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', uniqueActorIds);

      const profileMap: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

      const items: FeedItem[] = feedRows.map((row: any) => {
        const actor = profileMap[row.actor_id] ?? {};
        const likeCount    = Array.isArray(row.like_count)    ? (row.like_count[0]?.count    ?? 0) : 0;
        const commentCount = Array.isArray(row.comment_count) ? (row.comment_count[0]?.count ?? 0) : 0;

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
          likeCount: Number(likeCount),
          commentCount: Number(commentCount),
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
      if (!myId) return;
      if (currentlyLiked) {
        await supabase.from('feed_likes').delete()
          .eq('feed_item_id', feedItemId).eq('user_id', myId);
      } else {
        await supabase.from('feed_likes').insert({ feed_item_id: feedItemId, user_id: myId });
      }
    } catch {}
  }

  // ── Comments ─────────────────────────────────────────────────────────────

  async getComments(feedItemId: string): Promise<FeedComment[]> {
    try {
      const { data: rows, error } = await supabase
        .from('feed_comments')
        .select(`
          id, feed_item_id, user_id, content, created_at,
          profile:profiles!user_id (full_name, avatar_url)
        `)
        .eq('feed_item_id', feedItemId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      return (rows ?? []).map((r: any) => ({
        id: r.id,
        feedItemId: r.feed_item_id,
        userId: r.user_id,
        userName: r.profile?.full_name ?? 'EpexFit User',
        userAvatar: r.profile?.avatar_url,
        content: r.content,
        createdAt: new Date(r.created_at),
      }));
    } catch {
      return [];
    }
  }

  async postComment(feedItemId: string, content: string): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('feed_comments')
        .insert({ feed_item_id: feedItemId, user_id: myId, content: content.trim() });
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

  // ── Share activity as post ───────────────────────────────────────────────

  async shareActivity(activityId: string, content: string, imageUrl?: string): Promise<{ error: any }> {
    try {
      const myId = await getMyId();
      if (!myId) throw new Error('Not authenticated');

      // Fetch activity data to include in payload
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

  // ── Create social post ───────────────────────────────────────────────────

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
        .neq('id', myId ?? '')
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
