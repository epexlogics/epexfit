/**
 * socialService.ts — Extended social features
 * - Feed with likes + comments
 * - Follow/unfollow
 * - Follower/following lists
 * - User profile (public/private)
 * - Comments on feed items
 *
 * Supabase tables needed:
 *   follows (id, follower_id, following_id, created_at)
 *   activity_feed (id, actor_id, type, payload jsonb, created_at)
 *   feed_likes (id, feed_item_id, user_id, created_at)
 *   feed_comments (id, feed_item_id, user_id, content, created_at)
 *   profiles (id, full_name, avatar_url, is_private bool default false)
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FeedItem {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  type: 'activity_completed' | 'goal_achieved' | 'streak' | 'weight_logged';
  payload: Record<string, any>;
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
  avatarUrl?: string;
  isFollowing: boolean;   // current user follows them
  followsMe: boolean;     // they follow current user
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export interface PublicProfile {
  id: string;
  fullName: string;
  avatarUrl?: string;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  activityCount: number;
  badgeIds: string[];
  streak: number;
  isFollowing: boolean;
  followsMe: boolean;
}

const FEED_CACHE_KEY = '@epexfit_social_feed';

class SocialService {
  /** Follow a user */
  async follow(followingId: string): Promise<{ error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: followingId });
      return { error };
    } catch (error) {
      return { error };
    }
  }

  /** Unfollow a user */
  async unfollow(followingId: string): Promise<{ error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', followingId);
      return { error };
    } catch (error) {
      return { error };
    }
  }

  /** Check if current user follows a given user */
  async isFollowing(followingId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from('follows').select('id')
        .eq('follower_id', user.id).eq('following_id', followingId).maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }

  /** Get follower/following counts for a user */
  async getFollowCounts(userId: string): Promise<FollowCounts> {
    try {
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
      ]);
      return { followers: followersRes.count ?? 0, following: followingRes.count ?? 0 };
    } catch {
      return { followers: 0, following: 0 };
    }
  }

  /** Get list of followers for a user, with follow-back status */
  async getFollowers(userId: string): Promise<FollowUser[]> {
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      const myId = me?.id ?? '';

      // People who follow userId
      const { data: rows } = await supabase
        .from('follows')
        .select('follower_id, profiles:follower_id(id, full_name, avatar_url)')
        .eq('following_id', userId);

      const users = (rows ?? []).map((r: any) => r.profiles).filter(Boolean);
      const ids = users.map((u: any) => u.id);
      if (!ids.length) return [];

      // Check who current user follows among them
      const { data: myFollows } = myId
        ? await supabase.from('follows').select('following_id')
            .eq('follower_id', myId).in('following_id', ids)
        : { data: [] };

      const myFollowSet = new Set((myFollows ?? []).map((f: any) => f.following_id));

      // Check who among them follows current user
      const { data: theyFollowMe } = myId
        ? await supabase.from('follows').select('follower_id')
            .eq('following_id', myId).in('follower_id', ids)
        : { data: [] };

      const followsMeSet = new Set((theyFollowMe ?? []).map((f: any) => f.follower_id));

      return users.map((u: any) => ({
        id: u.id,
        fullName: u.full_name ?? 'EpexFit User',
        avatarUrl: u.avatar_url,
        isFollowing: myFollowSet.has(u.id),
        followsMe: followsMeSet.has(u.id),
      }));
    } catch {
      return [];
    }
  }

  /** Get list of people a user is following */
  async getFollowing(userId: string): Promise<FollowUser[]> {
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      const myId = me?.id ?? '';

      const { data: rows } = await supabase
        .from('follows')
        .select('following_id, profiles:following_id(id, full_name, avatar_url)')
        .eq('follower_id', userId);

      const users = (rows ?? []).map((r: any) => r.profiles).filter(Boolean);
      const ids = users.map((u: any) => u.id);
      if (!ids.length) return [];

      const { data: myFollows } = myId
        ? await supabase.from('follows').select('following_id')
            .eq('follower_id', myId).in('following_id', ids)
        : { data: [] };

      const myFollowSet = new Set((myFollows ?? []).map((f: any) => f.following_id));

      const { data: theyFollowMe } = myId
        ? await supabase.from('follows').select('follower_id')
            .eq('following_id', myId).in('follower_id', ids)
        : { data: [] };

      const followsMeSet = new Set((theyFollowMe ?? []).map((f: any) => f.follower_id));

      return users.map((u: any) => ({
        id: u.id,
        fullName: u.full_name ?? 'EpexFit User',
        avatarUrl: u.avatar_url,
        isFollowing: myFollowSet.has(u.id),
        followsMe: followsMeSet.has(u.id),
      }));
    } catch {
      return [];
    }
  }

  /** Get public profile of any user */
  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      const myId = me?.id ?? '';

      const [
        { data: profile },
        { data: follows },
        { data: following },
        { data: activities },
        { data: amFollowing },
        { data: theyFollowMe },
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, is_private').eq('id', userId).maybeSingle(),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        myId ? supabase.from('follows').select('id').eq('follower_id', myId).eq('following_id', userId).maybeSingle() : Promise.resolve({ data: null }),
        myId ? supabase.from('follows').select('id').eq('follower_id', userId).eq('following_id', myId).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      if (!profile) return null;

      // Get unlocked badge ids
      let badgeIds: string[] = [];
      try {
        const { getUnlockedBadgeIds } = await import('./streaks');
        badgeIds = await getUnlockedBadgeIds(userId);
      } catch {}

      // Get streak
      let streak = 0;
      try {
        const { recalculateStreak } = await import('./streaks');
        streak = await recalculateStreak(userId);
      } catch {}

      return {
        id: userId,
        fullName: profile.full_name ?? 'EpexFit User',
        avatarUrl: profile.avatar_url,
        isPrivate: profile.is_private ?? false,
        followerCount: (follows as any)?.count ?? 0,
        followingCount: (following as any)?.count ?? 0,
        activityCount: (activities as any)?.count ?? 0,
        badgeIds,
        streak,
        isFollowing: !!amFollowing,
        followsMe: !!theyFollowMe,
      };
    } catch {
      return null;
    }
  }

  /** Update current user's private/public setting */
  async setProfilePrivacy(isPrivate: boolean): Promise<{ error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles').update({ is_private: isPrivate }).eq('id', user.id);
      return { error };
    } catch (error) {
      return { error };
    }
  }

  /** Get current user's privacy setting */
  async getProfilePrivacy(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from('profiles').select('is_private').eq('id', user.id).maybeSingle();
      return data?.is_private ?? false;
    } catch {
      return false;
    }
  }

  /** Fetch activity feed */
  async getFeed(limit = 30): Promise<{ items: FeedItem[]; fromCache: boolean }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { items: [], fromCache: false };

      const { data: follows } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id);

      const followingIds = (follows ?? []).map((f: any) => f.following_id);
      const actorIds = [user.id, ...followingIds];

      const { data: feedRows, error } = await supabase
        .from('activity_feed')
        .select('id, actor_id, type, payload, created_at, feed_likes(count), user_liked:feed_likes(id), comment_count:feed_comments(count)')
        .in('actor_id', actorIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const actorIds2 = [...new Set((feedRows ?? []).map((r: any) => r.actor_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name, avatar_url').in('id', actorIds2);

      const profileMap: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

      const items: FeedItem[] = (feedRows ?? []).map((row: any) => {
        const actor = profileMap[row.actor_id] ?? {};
        return {
          id: row.id,
          actorId: row.actor_id,
          actorName: actor.full_name ?? 'EpexFit User',
          actorAvatar: actor.avatar_url,
          type: row.type,
          payload: row.payload ?? {},
          createdAt: new Date(row.created_at),
          liked: Array.isArray(row.user_liked) && row.user_liked.some((l: any) => l.id),
          likeCount: row.feed_likes?.[0]?.count ?? 0,
          commentCount: row.comment_count?.[0]?.count ?? 0,
        };
      });

      await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(items.map(i => ({
        ...i, createdAt: i.createdAt.toISOString(),
      }))));

      return { items, fromCache: false };
    } catch {
      try {
        const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw).map((i: any) => ({ ...i, createdAt: new Date(i.createdAt) }));
          return { items: parsed, fromCache: true };
        }
      } catch {}
      return { items: [], fromCache: false };
    }
  }

  /** Get comments for a feed item */
  async getComments(feedItemId: string): Promise<FeedComment[]> {
    try {
      const { data: rows } = await supabase
        .from('feed_comments')
        .select('id, feed_item_id, user_id, content, created_at, profiles:user_id(full_name, avatar_url)')
        .eq('feed_item_id', feedItemId)
        .order('created_at', { ascending: true })
        .limit(50);

      return (rows ?? []).map((r: any) => ({
        id: r.id,
        feedItemId: r.feed_item_id,
        userId: r.user_id,
        userName: r.profiles?.full_name ?? 'EpexFit User',
        userAvatar: r.profiles?.avatar_url,
        content: r.content,
        createdAt: new Date(r.created_at),
      }));
    } catch {
      return [];
    }
  }

  /** Post a comment on a feed item */
  async postComment(feedItemId: string, content: string): Promise<{ error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('feed_comments').insert({
        feed_item_id: feedItemId,
        user_id: user.id,
        content: content.trim(),
      });
      return { error };
    } catch (error) {
      return { error };
    }
  }

  /** Toggle like on a feed item */
  async toggleLike(feedItemId: string, currentlyLiked: boolean): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (currentlyLiked) {
        await supabase.from('feed_likes').delete()
          .eq('feed_item_id', feedItemId).eq('user_id', user.id);
      } else {
        await supabase.from('feed_likes').insert({ feed_item_id: feedItemId, user_id: user.id });
      }
    } catch {}
  }

  /** Publish an event to the activity feed */
  async publishFeedEvent(type: FeedItem['type'], payload: Record<string, any>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('activity_feed').insert({ actor_id: user.id, type, payload });
    } catch {}
  }
}

export const socialService = new SocialService();
