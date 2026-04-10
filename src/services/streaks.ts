import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { BADGE_DEFINITIONS, evaluateBadges } from '../constants/badges';
import { socialService } from './socialService';

const STREAK_CACHE_KEY = '@epexfit_streak_cache';

// ── Cached getAuthUser ────────────────────────────────────────────────────
// PERF FIX: mirrors the same cache in database.ts — prevents redundant
// supabase.auth.getUser() calls when streaks.ts functions run in parallel
// with database.ts functions (e.g. during HomeScreen's Promise.all load).
let _authUserCache: { user: any; expiresAt: number } | null = null;

async function getAuthUser() {
  const now = Date.now();
  if (_authUserCache && now < _authUserCache.expiresAt) {
    return _authUserCache.user;
  }
  const { data: { user } } = await supabase.auth.getUser();
  _authUserCache = { user, expiresAt: now + 30_000 }; // 30 second TTL
  return user;
}

export function clearStreakAuthCache() {
  _authUserCache = null;
}

/**
 * Recalculates the user's current activity streak from daily_logs.
 * Writes result to AsyncStorage cache for fast subsequent reads.
 * Called in the background after HomeScreen initial render.
 */
export async function recalculateStreak(userId: string): Promise<number> {
  try {
    // PRODUCTION FIX: userId already passed by caller — no internal getAuthUser()
    // needed. Production APK cold-start par supabase.auth.getUser() async hota hai
    // aur race condition se null return kar sakta hai, causing a crash.
    if (!userId) return 0;

    const today = new Date().toISOString().split('T')[0];
    const ago365 = new Date();
    ago365.setDate(ago365.getDate() - 365);
    const ago365Str = ago365.toISOString().split('T')[0];

    // Fetch both daily_logs (steps) AND workouts (any logged workout = active day)
    const [{ data: logs }, { data: workouts }] = await Promise.all([
      supabase
        .from('daily_logs')
        .select('date, steps')
        .eq('user_id', userId)
        .gte('date', ago365Str)
        .order('date', { ascending: false }),
      supabase
        .from('workouts')
        .select('date')
        .eq('user_id', userId)
        .gte('date', ago365Str),
    ]);

    const activeDates = new Set<string>();

    // Step-based active days
    (logs ?? [])
      .filter((l: any) => l.steps > 0)
      .forEach((l: any) => activeDates.add(l.date as string));

    // Workout-based active days (a logged workout = active regardless of steps)
    (workouts ?? [])
      .forEach((w: any) => {
        const d = typeof w.date === 'string' ? w.date : new Date(w.date).toISOString().split('T')[0];
        activeDates.add(d);
      });

    let streak = 0;
    const cursor = new Date();

    // Grace: if today has no activity yet, start counting from yesterday so the day
    // isn't treated as a broken streak before the user has logged anything.
    const todayStr = cursor.toISOString().split('T')[0];
    const startFromYesterday = !activeDates.has(todayStr);
    if (startFromYesterday) {
      cursor.setDate(cursor.getDate() - 1);
    }

    // One-day grace in the chain: a single rest day between workouts still counts
    // (two inactive days in a row ends the streak).
    let consecutiveMisses = 0;
    for (let i = 0; i < 400; i++) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (activeDates.has(dateStr)) {
        streak++;
        consecutiveMisses = 0;
      } else {
        consecutiveMisses++;
        if (consecutiveMisses > 1) break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    await AsyncStorage.setItem(
      STREAK_CACHE_KEY,
      JSON.stringify({ streak, updatedAt: today })
    );

    return streak;
  } catch {
    return 0;
  }
}

/**
 * Fast streak read from AsyncStorage cache (falls back to 0).
 * Use this in HomeScreen's Promise.all — it's instant vs 365-day DB fetch.
 * recalculateStreak() runs in the background to keep the cache fresh.
 */
export async function getCachedStreak(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_CACHE_KEY);
    if (!raw) return 0;
    const { streak } = JSON.parse(raw);
    return streak ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Checks which badges the user has earned and unlocks any new ones.
 * Returns array of newly unlocked badge definitions (for celebration UI).
 * PERF FIX: uses getCachedStreak() instead of recalculateStreak() — the
 * streak is already being recalculated in the HomeScreen background task,
 * so no need to trigger a second 365-day DB fetch here.
 */
export async function syncBadges(userId: string): Promise<typeof BADGE_DEFINITIONS> {
  try {
    // PRODUCTION FIX: use passed userId directly
    if (!userId) return [];

    // PERF FIX: read from cache — recalculateStreak runs separately in background
    const streak = await getCachedStreak();

    const { data: activities } = await supabase
      .from('activities')
      .select('type, distance, steps, start_time')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    const acts = activities ?? [];
    const totalDistanceKm = acts.reduce((s: number, a: any) => s + (a.distance ?? 0), 0);
    const stepsToday = acts
      .filter((a: any) => a.start_time?.startsWith(new Date().toISOString().split('T')[0]))
      .reduce((s: number, a: any) => s + (a.steps ?? 0), 0);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const workoutsThisWeek = acts.filter(
      (a: any) => new Date(a.start_time) >= weekStart
    ).length;
    const workoutsThisMonth = acts.filter(
      (a: any) => new Date(a.start_time) >= monthStart
    ).length;

    const lastAct = acts[acts.length - 1];
    const lastActivityHour = lastAct
      ? new Date(lastAct.start_time).getHours()
      : undefined;

    const earnedIds = evaluateBadges({
      streak,
      totalDistanceKm,
      stepsToday,
      totalWorkouts: acts.length,
      workoutsThisWeek,
      workoutsThisMonth,
      waterStreakDays: 0,
      proteinStreakDays: 0,
      lastActivityHour,
    });

    const { data: existing } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    const alreadyUnlocked = new Set((existing ?? []).map((b: any) => b.badge_id));
    const newBadgeIds = earnedIds.filter((id) => !alreadyUnlocked.has(id));

    if (newBadgeIds.length > 0) {
      await supabase.from('user_badges').insert(
        newBadgeIds.map((badge_id) => ({
          user_id: userId,
          badge_id,
          unlocked_at: new Date().toISOString(),
        }))
      );
    }

    const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
    // FIX: only publish streak event if this is a newly unlocked milestone
    // (check if a streak badge for this milestone was just inserted)
    if (STREAK_MILESTONES.includes(streak) && newBadgeIds.some(id => id.includes('streak'))) {
      socialService.publishFeedEvent('streak', { days: streak });
    }

    return newBadgeIds
      .map((id) => BADGE_DEFINITIONS.find((b) => b.id === id))
      .filter(Boolean) as typeof BADGE_DEFINITIONS;
  } catch {
    return [];
  }
}

/** Fetch all unlocked badge IDs for a user */
export async function getUnlockedBadgeIds(userId: string): Promise<string[]> {
  try {
    // PRODUCTION FIX: use passed userId directly
    if (!userId) return [];
    const { data } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);
    return (data ?? []).map((b: any) => b.badge_id);
  } catch {
    return [];
  }
}