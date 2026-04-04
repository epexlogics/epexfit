import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { BADGE_DEFINITIONS, evaluateBadges } from '../constants/badges';

const STREAK_CACHE_KEY = '@epexfit_streak_cache';

/**
 * Recalculates the user's current activity streak from daily_logs.
 * Returns the streak count and persists it.
 */
export async function recalculateStreak(userId: string): Promise<number> {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return 0;

    const today = new Date().toISOString().split('T')[0];
    const ago365 = new Date();
    ago365.setDate(ago365.getDate() - 365);

    const { data: logs } = await supabase
      .from('daily_logs')
      .select('date, steps')
      .eq('user_id', authUser.id)
      .gte('date', ago365.toISOString().split('T')[0])
      .order('date', { ascending: false });

    const activeDates = new Set(
      (logs ?? [])
        .filter((l: any) => l.steps > 0)
        .map((l: any) => l.date as string)
    );

    let streak = 0;
    const cursor = new Date();

    while (true) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (activeDates.has(dateStr)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    // Cache it locally for fast reads
    await AsyncStorage.setItem(
      STREAK_CACHE_KEY,
      JSON.stringify({ streak, updatedAt: today })
    );

    return streak;
  } catch {
    return 0;
  }
}

/** Fast streak read from cache (falls back to 0) */
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
 */
export async function syncBadges(userId: string): Promise<typeof BADGE_DEFINITIONS> {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return [];

    // Gather all data needed for badge evaluation
    const streak = await recalculateStreak(userId);

    const { data: activities } = await supabase
      .from('activities')
      .select('type, distance, steps, start_time')
      .eq('user_id', authUser.id);

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

    // Get already-unlocked badges
    const { data: existing } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', authUser.id);

    const alreadyUnlocked = new Set((existing ?? []).map((b: any) => b.badge_id));
    const newBadgeIds = earnedIds.filter((id) => !alreadyUnlocked.has(id));

    if (newBadgeIds.length > 0) {
      await supabase.from('user_badges').insert(
        newBadgeIds.map((badge_id) => ({
          user_id: authUser.id,
          badge_id,
          unlocked_at: new Date().toISOString(),
        }))
      );
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
    const authUser = await getAuthUser();
    if (!authUser) return [];
    const { data } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', authUser.id);
    return (data ?? []).map((b: any) => b.badge_id);
  } catch {
    return [];
  }
}

async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
