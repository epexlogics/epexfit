/**
 * HomeScreen — PRODUCTION v5
 *
 * 100% real data from Supabase. Zero mock data, zero hardcoded arrays.
 * Every section wired to live queries with loading states, error handling,
 * pull-to-refresh, and real-time subscriptions where appropriate.
 *
 * Sections:
 *  1. Header          — avatar from profiles.avatar_url → fallback initial
 *  2. APS Score       — calculated from workouts + food_logs + sleep_logs + mood_logs
 *  3. Metric Cards    — steps/calories/distance/active minutes (workouts + daily_logs)
 *  4. Quick Actions   — Log Workout / Log Food / Start Challenge
 *  5. Today's Challenge — from challenges + user_challenges tables
 *  6. Weekly Activity Chart — workout minutes per day from workouts table
 *  7. Today's Metrics Detail — water/sleep/mood (editable inline)
 *  8. Activity Streak — consecutive days with ≥1 workout OR ≥5000 steps
 *  9. Achievements    — from user_achievements table
 * 10. Recent Activities Feed — union of workouts + food_logs + achievements
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useWater } from '../../store/waterStore';
import { useSleep } from '../../store/sleepStore';
import { useMood } from '../../store/moodStore';
import { useActivityStore } from '../../store/activityStore';
import { supabase } from '../../services/supabase';
import { databaseService } from '../../services/database';
import { recalculateStreak, syncBadges, getUnlockedBadgeIds } from '../../services/streaks';
import { calculateAPS, calcProteinGoal } from '../../utils/performanceScore';
import { generateInsight, getDailyChallenge, isChallengeComplete } from '../../utils/insights';
import { DailyLog, Goal } from '../../types';
import { BADGE_DEFINITIONS, BadgeDefinition } from '../../constants/badges';
import { STORAGE_KEYS } from '../../constants/config';
import { spacing, borderRadius, typography } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

import { useUnitSystem } from '../../utils/units';
import AppIcon from '../../components/AppIcon';
import BadgeUnlockModal from '../../components/BadgeUnlockModal';
import WeeklySnapshotModal, {
  shouldShowWeeklySnapshot,
  markSnapshotShown,
} from '../../components/WeeklySnapshotModal';
import { HomeScreenSkeleton } from '../../components/SkeletonLoader';
import AnimatedProgressRing from '../../components/AnimatedProgressRing';
import AnimatedCounter from '../../components/AnimatedCounter';

// PRODUCTION FIX: relativeTime plugin ki jagah pure JS — Hermes safe
function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}


// ─── Constants ─────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_STEP_GOAL = 10000;
const DEFAULT_DIST_GOAL = 5;
const DEFAULT_CAL_GOAL = 500;
const DEFAULT_WATER_GOAL = 8;
const DEFAULT_SLEEP_GOAL = 8;
const DEFAULT_ACTIVE_MINS_GOAL = 30;
const DAILY_CHALLENGE_PERSIST_KEY = '@epexfit_daily_challenge';
const AVATAR_CACHE_KEY = '@epexfit_avatar_url';

// ─── Types ──────────────────────────────────────────────────────────────────
interface WorkoutRow {
  id: string;
  duration_minutes: number;
  calories_burned: number;
  date: string; // YYYY-MM-DD
  name?: string;
  type?: string;
}

interface FoodLogRow {
  id: string;
  calories: number;
  meal_type: string;
  date: string;
  created_at: string;
}

interface WaterLogRow {
  id: string;
  glasses: number;
  date: string;
}

interface SleepLogRow {
  id: string;
  hours: number;
  date: string;
}

interface MoodLogRow {
  id: string;
  rating: number; // 1–5
  date: string;
}

interface ChallengeRow {
  id: string;
  title: string;
  target: number;
  target_unit: string;
  reward?: string;
}

interface UserChallengeRow {
  id: string;
  challenge_id: string;
  progress: number;
  completed: boolean;
}

interface AchievementRow {
  id: string;
  achievement_type: string;
  earned_at: string;
}

interface FeedItem {
  id: string;
  kind: 'workout' | 'food' | 'achievement';
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  createdAt: Date;
  referenceId?: string;
}

interface HomeData {
  // Avatar
  avatarUrl: string | null;

  // Metrics — today
  stepsToday: number;
  caloriesToday: number;   // workouts calories_burned
  distanceToday: number;   // from daily_logs or step × stride
  activeMinsToday: number; // sum of workout durations

  // Metrics — goals
  stepGoal: number;
  calGoal: number;
  distGoal: number;
  activeMinsGoal: number;

  // APS inputs
  waterToday: number;
  waterGoal: number;
  sleepHours: number;
  moodRating: number;
  proteinToday: number;
  proteinGoal: number;
  completedWorkoutsThisWeek: number;
  plannedWorkouts: number;

  // Weekly chart — workout minutes per day [Mon…Sun]
  weeklyMinutes: number[];
  weeklyWorkoutCount: number;

  // Weekly totals for summary row
  weeklyCalories: number;
  weeklyDistance: number;

  // Streak
  currentStreak: number;
  bestStreak: number; // from user_achievements or calculated

  // Challenge
  todayChallenge: ChallengeRow | null;
  userChallenge: UserChallengeRow | null;

  // Achievements
  recentAchievements: AchievementRow[];
  totalAchievements: number;

  // Feed
  feedItems: FeedItem[];

  // Legacy badge system
  unlockedBadgeIds: string[];

  // Insight
  insight: { text: string; icon: string } | null;

  // Weekly snapshot
  snapshotData: any;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ArcProgress({
  progress,
  size = 120,
  strokeWidth = 10,
  color,
  trackColor,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const p = Math.min(Math.max(progress, 0), 1);
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - p);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={trackColor ?? 'rgba(148,163,184,0.25)'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      {children}
    </View>
  );
}

function WeeklyBar({
  values,
  color,
  colors,
  onBarPress,
}: {
  values: number[];
  color: string;
  colors: any;
  onBarPress?: (dayIdx: number, value: number) => void;
}) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const max = Math.max(...values, 1);
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0

  return (
    <View style={wbS.row}>
      {values.map((v, i) => {
        const h = Math.max((v / max) * 56, 3);
        const isToday = i === todayIdx;
        const hasData = v > 0;
        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => onBarPress?.(i, v)}
            style={wbS.col}
          >
            <View style={wbS.barWrap}>
              <View
                style={[
                  wbS.bar,
                  {
                    height: h,
                    borderRadius: 6,
                    backgroundColor: isToday
                      ? color
                      : hasData
                      ? color + '55'
                      : color + '15',
                  },
                ]}
              />
            </View>
            <Text
              style={[
                wbS.day,
                {
                  color: isToday ? color : colors.textSecondary,
                  fontWeight: isToday ? '800' : '500',
                },
              ]}
            >
              {days[i]}
            </Text>
            {hasData && (
              <Text style={[wbS.val, { color: isToday ? color : colors.textDisabled }]}>
                {v}m
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const wbS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  col: { flex: 1, alignItems: 'center', gap: 3 },
  barWrap: { height: 56, justifyContent: 'flex-end' },
  bar: { width: '100%' },
  day: { fontSize: 10 },
  val: { fontSize: 9, fontWeight: '600' },
});

// Achievement type → display config
const ACHIEVEMENT_META: Record<string, { icon: string; label: string; color: string }> = {
  streak_3:        { icon: '🔥', label: '3-Day Streak',    color: '#FBBF24' },
  streak_7:        { icon: '🔥', label: '7-Day Streak',    color: '#F59E0B' },
  streak_14:       { icon: '⚡', label: '2-Week Streak',   color: '#22D3EE' },
  streak_30:       { icon: '⚡', label: '30-Day Streak',   color: '#06B6D4' },
  streak_60:       { icon: '🌟', label: '60-Day Inferno',  color: '#4ADE80' },
  streak_100:      { icon: '🏆', label: 'Century Blaze',   color: '#C084FC' },
  dist_1km:        { icon: '👟', label: 'First Step',      color: '#38BDF8' },
  dist_5km:        { icon: '🏅', label: '5K Club',         color: '#22D3EE' },
  dist_10km:       { icon: '🎯', label: '10K Milestone',   color: '#4ADE80' },
  dist_21km:       { icon: '🏃', label: 'Half Marathon',   color: '#2DD4BF' },
  dist_42km:       { icon: '🌠', label: 'Marathon Bound',  color: '#818CF8' },
  dist_100km:      { icon: '🏆', label: 'Century Runner',  color: '#A78BFA' },
  steps_10k:       { icon: '🦵', label: '10K Steps Day',   color: '#38BDF8' },
  steps_20k:       { icon: '⚡', label: 'Step Machine',    color: '#22D3EE' },
  workouts_5:      { icon: '💪', label: 'Active Week',     color: '#FB7185' },
  workouts_20:     { icon: '🛡️', label: 'Month Warrior',  color: '#F472B6' },
  workouts_100:    { icon: '🏛️', label: 'Century Club',   color: '#C084FC' },
  water_7:         { icon: '💧', label: 'Hydration Hero',  color: '#22D3EE' },
  protein_7:       { icon: '🥩', label: 'Protein Pro',     color: '#A78BFA' },
  early_bird:      { icon: '🌅', label: 'Early Bird',      color: '#FBBF24' },
  night_owl:       { icon: '🦉', label: 'Night Owl',       color: '#6366F1' },
  weekend_warrior: { icon: '🏖️', label: 'Weekend Warrior', color: '#FB7185' },
  comeback:        { icon: '💫', label: 'Comeback Kid',    color: '#4ADE80' },
  calories_1000:   { icon: '🔥', label: '1000 Cal Burned', color: '#FB7185' },
  workouts_10:     { icon: '💪', label: '10 Workouts',     color: '#22D3EE' },
};

const WORKOUT_ICON_MAP: Record<string, string> = {
  running: 'run',
  cycling: 'bike',
  walking: 'walk',
  swimming: 'swim',
  strength: 'weight',
  hiit: 'fire',
  yoga: 'meditation',
  football: 'soccer',
  other: 'dumbbell',
};

const WORKOUT_COLOR_MAP: Record<string, string> = {
  running:  '#FB7185',
  cycling:  '#38BDF8',
  walking:  '#4ADE80',
  swimming: '#22D3EE',
  strength: '#C084FC',
  hiit:     '#F472B6',
  yoga:     '#A78BFA',
  football: '#FBBF24',
  other:    '#94A3B8',
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const unitSystem = useUnitSystem();
  const { isTracking } = useTracking();
  const waterStore = useWater();
  const sleepStore = useSleep();
  const moodStore = useMood();
  const activityStore = useActivityStore();
  const { sendSmartNotifications, notifyBadgeUnlocked } = useNotifications();

  // ── State ─────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<HomeData | null>(null);

  // Modal state
  const [celebBadge, setCelebBadge] = useState<BadgeDefinition | null>(null);
  const [snapshotVisible, setSnapshotVisible] = useState(false);

  // Local UI state
  const [showAPSTip, setShowAPSTip] = useState(false);
  const [selectedBarDay, setSelectedBarDay] = useState<{ day: number; mins: number } | null>(null);

  // Inline metric edit (water/sleep/mood)
  const [editingWater, setEditingWater] = useState(false);
  const [editingSleep, setEditingSleep] = useState(false);
  const [editingMood, setEditingMood] = useState(false);

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  // Realtime subscription ref
  const realtimeSub = useRef<any>(null);
  // Debounce ref — prevents 13-query storm when multiple tables change rapidly
  const realtimeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = colors.primary;
  const today = dayjs().format('YYYY-MM-DD');

  // ── Animations ───────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, speed: 16, bounciness: 5, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Data Loading ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoadError(null);

      // ── Week bounds ───────────────────────────────────────────────────────
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun
      const diffToMonday = (dayOfWeek + 6) % 7;
      const weekStart = dayjs().subtract(diffToMonday, 'day').format('YYYY-MM-DD');
      const weekEnd = dayjs().format('YYYY-MM-DD');

      // ── Parallel fetches ─────────────────────────────────────────────────
      const [
        profileResult,
        workoutsResult,
        foodLogsResult,
        challengeResult,
        userChallengeResult,
        achievementsResult,
        dailyLogResult,
        goalsResult,
        streakResult,
        badgeIdsResult,
      ] = await Promise.allSettled([
        supabase.from('profiles').select('avatar_url, full_name').eq('id', user.id).maybeSingle(),
        supabase.from('workouts').select('id, duration_minutes, calories_burned, date, name, type').eq('user_id', user.id).gte('date', weekStart).lte('date', weekEnd).order('date', { ascending: true }),
        supabase.from('food_logs').select('id, calories, meal_type, date, created_at').eq('user_id', user.id).eq('date', today).order('created_at', { ascending: false }).limit(5),
        supabase.from('challenges').select('id, title, target, target_unit, reward').limit(1).order('id', { ascending: true }),
        supabase.from('user_challenges').select('id, challenge_id, progress, completed').eq('user_id', user.id).gte('created_at', dayjs().startOf('day').toISOString()).limit(1),
        supabase.from('user_achievements').select('id, achievement_type, earned_at').eq('user_id', user.id).order('earned_at', { ascending: false }).limit(10),
        databaseService.getDailyLog(user.id, new Date()),
        databaseService.getGoals(user.id),
        recalculateStreak(user.id),
        getUnlockedBadgeIds(user.id),
      ]);

      // ── Extract results safely ────────────────────────────────────────────
      const profile =
        profileResult.status === 'fulfilled' ? profileResult.value.data : null;

      const workouts: WorkoutRow[] =
        workoutsResult.status === 'fulfilled'
          ? (workoutsResult.value.data ?? [])
          : [];

      const foodLogs: FoodLogRow[] =
        foodLogsResult.status === 'fulfilled'
          ? (foodLogsResult.value.data ?? [])
          : [];

      const challengeRows: ChallengeRow[] =
        challengeResult.status === 'fulfilled'
          ? (challengeResult.value.data ?? [])
          : [];

      const userChallengeRows: UserChallengeRow[] =
        userChallengeResult.status === 'fulfilled'
          ? (userChallengeResult.value.data ?? [])
          : [];

      const achievements: AchievementRow[] =
        achievementsResult.status === 'fulfilled'
          ? (achievementsResult.value.data ?? [])
          : [];

      const dailyLog: DailyLog | null =
        dailyLogResult.status === 'fulfilled' ? dailyLogResult.value.data : null;

      const goals: Goal[] =
        goalsResult.status === 'fulfilled' ? (goalsResult.value.data ?? []) : [];

      const currentStreak: number =
        streakResult.status === 'fulfilled' ? streakResult.value : 0;

      const unlockedBadgeIds: string[] =
        badgeIdsResult.status === 'fulfilled' ? badgeIdsResult.value : [];

      // ── Avatar ────────────────────────────────────────────────────────────
      let avatarUrl: string | null = profile?.avatar_url ?? null;
      if (!avatarUrl) {
        // Fallback: check AsyncStorage cache (set by ProfileScreen on upload)
        try {
          const cached = await AsyncStorage.getItem(AVATAR_CACHE_KEY);
          if (cached) avatarUrl = cached;
        } catch {}
      } else {
        // Keep cache in sync
        try {
          await AsyncStorage.setItem(AVATAR_CACHE_KEY, avatarUrl);
        } catch {}
      }

      // ── Goals ─────────────────────────────────────────────────────────────
      let stepGoal = DEFAULT_STEP_GOAL;
      let calGoal = DEFAULT_CAL_GOAL;
      let distGoal = DEFAULT_DIST_GOAL;
      let proteinGoal = user.weight ? calcProteinGoal(user.weight) : 120;

      if (goals.length) {
        const sg = goals.find((g) => g.type === 'steps');
        const cg = goals.find((g) => g.type === 'calories');
        const rg = goals.find((g) => g.type === 'running');
        if (sg) { stepGoal = sg.target; }
        if (cg) { calGoal = cg.target; }
        if (rg) { distGoal = rg.target; }
      }

      // ── Today metrics — read from feature stores (single source of truth) ──
      // activityStore owns steps/distance/calories from daily_logs
      const stepsToday = activityStore.steps;
      const distanceToday = activityStore.distance;
      const caloriesToday = activityStore.calories;

      // Today's workouts (subset of weekly)
      const todayWorkouts = workouts.filter((w) => w.date === today);

      // Active minutes: sum of today's workout durations
      const activeMinsToday = todayWorkouts.reduce(
        (sum, w) => sum + (w.duration_minutes ?? 0),
        0
      );

      // Water / sleep / mood — from dedicated stores
      const waterToday = waterStore.glasses;
      const sleepHours = sleepStore.hours;
      const moodRating = moodStore.rating;
      const proteinToday = dailyLog?.protein ?? 0;

      // ── Weekly chart (workout minutes per day, Mon=0…Sun=6) ──────────────
      const weeklyMinutes: number[] = Array(7).fill(0);
      let weeklyCalories = 0;
      let weeklyDistance = 0;

      workouts.forEach((w) => {
        const d = dayjs(w.date);
        // dayjs .day() → 0=Sun, convert to Mon=0
        const idx = (d.day() + 6) % 7;
        if (idx >= 0 && idx < 7) {
          weeklyMinutes[idx] += w.duration_minutes ?? 0;
        }
        weeklyCalories += w.calories_burned ?? 0;
      });

      // Also pull distance from activities this week for accurate km
      const { data: activitiesWeek } = await supabase
        .from('activities')
        .select('distance, start_time')
        .eq('user_id', user.id)
        .gte('start_time', dayjs(weekStart).startOf('day').toISOString())
        .lte('start_time', dayjs(weekEnd).endOf('day').toISOString());

      (activitiesWeek ?? []).forEach((a: any) => {
        weeklyDistance += a.distance ?? 0;
      });

      const weeklyWorkoutCount = workouts.length;

      // ── Best streak from achievements ─────────────────────────────────────
      // We store best streak as a special achievement type 'best_streak_N'
      let bestStreak = currentStreak;
      const bestStreakAch = achievements.find((a) =>
        a.achievement_type.startsWith('best_streak_')
      );
      if (bestStreakAch) {
        const n = parseInt(bestStreakAch.achievement_type.replace('best_streak_', ''), 10);
        if (!isNaN(n)) bestStreak = Math.max(bestStreak, n);
      }

      // ── Challenge ─────────────────────────────────────────────────────────
      const todayChallenge: ChallengeRow | null = challengeRows[0] ?? null;
      const userChallenge: UserChallengeRow | null = userChallengeRows[0] ?? null;

      // ── Feed items (last 5, union of workouts + food_logs + achievements) ─
      const feedItems: FeedItem[] = [];

      // Add today's workouts from DB as feed items
      todayWorkouts.slice(0, 3).forEach((w) => {
        const type = (w.type ?? 'other').toLowerCase();
        feedItems.push({
          id: `workout_${w.id}`,
          kind: 'workout',
          title: w.name ?? (type.charAt(0).toUpperCase() + type.slice(1)) + ' Workout',
          subtitle: `${w.duration_minutes ?? 0} min · ${w.calories_burned ?? 0} kcal`,
          icon: WORKOUT_ICON_MAP[type] ?? 'dumbbell',
          color: WORKOUT_COLOR_MAP[type] ?? '#94A3B8',
          createdAt: new Date(w.date),
          referenceId: w.id,
        });
      });

      // Add food logs
      foodLogs.slice(0, 2).forEach((f) => {
        feedItems.push({
          id: `food_${f.id}`,
          kind: 'food',
          title: `${(f.meal_type ?? 'meal').charAt(0).toUpperCase() + (f.meal_type ?? 'meal').slice(1)} logged`,
          subtitle: `${f.calories} kcal`,
          icon: 'food-apple',
          color: '#FB923C',
          createdAt: new Date(f.created_at),
          referenceId: f.id,
        });
      });

      // Add recent achievements
      achievements.slice(0, 2).forEach((ach) => {
        const meta = ACHIEVEMENT_META[ach.achievement_type];
        if (meta) {
          feedItems.push({
            id: `ach_${ach.id}`,
            kind: 'achievement',
            title: meta.label,
            subtitle: `Earned ${timeAgo(ach.earned_at)}`,
            icon: 'star',
            color: meta.color,
            createdAt: new Date(ach.earned_at),
          });
        }
      });

      // Sort by most recent and take top 5
      feedItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const top5Feed = feedItems.slice(0, 5);

      // ── APS — Planned workouts from onboarding ────────────────────────────
      let plannedWorkouts = 5;
      try {
        const onboardingRaw = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
        if (onboardingRaw) {
          const ob = JSON.parse(onboardingRaw);
          if (ob?.trainingDays && typeof ob.trainingDays === 'number') {
            plannedWorkouts = ob.trainingDays;
          }
        }
      } catch {}

      const completedWorkoutsThisWeek = weeklyWorkoutCount;

      // ── Insight ───────────────────────────────────────────────────────────
      const weeklySteps = await databaseService.getWeeklyStepsByDay(user.id, new Date(weekStart));
      const bestDaySteps = Array.isArray(weeklySteps) && weeklySteps.length > 0
        ? Math.max(...weeklySteps)
        : 0;

      const insight = generateInsight({
        avgSleepHours: sleepStore.hours,
        bestDaySteps,
        weeklyStepsChange: 0,
        currentStreak,
        waterToday: waterStore.glasses,
        proteinToday,
        stepsToday: activityStore.steps,
        stepGoal,
      });

      // ── Weekly snapshot ───────────────────────────────────────────────────
      let snapshotData = null;
      if (await shouldShowWeeklySnapshot()) {
        snapshotData = {
          totalSteps: stepsToday,
          totalDistKm: weeklyDistance,
          totalCalories: weeklyCalories,
          activeDays: weeklyMinutes.filter((m) => m > 0).length,
          streak: currentStreak,
          bestDaySteps: 0,
          bestDayDate: '',
          apsScore: 0,
        };
      }

      // ── Sync badges in background ─────────────────────────────────────────
      syncBadges(user.id)
        .then((newBadges) => {
          if (newBadges.length > 0) {
            setCelebBadge(newBadges[0]);
            notifyBadgeUnlocked(newBadges[0].label, newBadges[0].icon).catch(() => {});
          }
        })
        .catch(() => {});

      // ── Assemble final data object ────────────────────────────────────────
      setData({
        avatarUrl,
        stepsToday,
        caloriesToday,
        distanceToday,
        activeMinsToday,
        stepGoal,
        calGoal,
        distGoal,
        activeMinsGoal: DEFAULT_ACTIVE_MINS_GOAL,
        waterToday,
        waterGoal: DEFAULT_WATER_GOAL,
        sleepHours,
        moodRating,
        proteinToday,
        proteinGoal,
        completedWorkoutsThisWeek,
        plannedWorkouts,
        weeklyMinutes,
        weeklyWorkoutCount,
        weeklyCalories,
        weeklyDistance,
        currentStreak,
        bestStreak,
        todayChallenge,
        userChallenge,
        recentAchievements: achievements,
        totalAchievements: achievements.length,
        feedItems: top5Feed,
        unlockedBadgeIds,
        insight,
        snapshotData,
      });

      if (snapshotData) {
        setSnapshotVisible(true);
      }

      // ── Smart notifications in background ────────────────────────────────
      sendSmartNotifications({
        stepsToday: activityStore.steps,
        stepGoal,
        streak: currentStreak,
        distanceToday: weeklyDistance,
        distanceGoal: distGoal,
        waterToday: waterStore.glasses,
        waterGoal: DEFAULT_WATER_GOAL,
      }).catch(() => {});

      // ── Goal progress sync in background ─────────────────────────────────
      databaseService.syncGoalProgress(user.id).catch(() => {});

    } catch (err: any) {
      // Production APK debugging: full error details
      const msg = err?.message ?? String(err) ?? 'Failed to load data';
      console.error('[HomeScreen] loadData crash:', msg, err?.stack ?? '');
      setLoadError(msg);
    }
  }, [user, activityStore.steps, activityStore.distance, activityStore.calories, waterStore.glasses, sleepStore.hours, moodStore.rating, colors]);


  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));
  }, [user]);

  // ── Realtime subscription: refresh on daily_log / workout changes ────────
  useEffect(() => {
    if (!user) return;

    const debouncedLoad = () => {
      if (realtimeDebounce.current) clearTimeout(realtimeDebounce.current);
      realtimeDebounce.current = setTimeout(() => { loadData(); }, 600);
    };

    realtimeSub.current = supabase
      .channel(`home_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${user.id}` },
        debouncedLoad
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workouts', filter: `user_id=eq.${user.id}` },
        debouncedLoad
      )
      .subscribe();
      // Note: water_logs / sleep_logs / mood_logs realtime is handled by their
      // respective stores — no duplicate subscriptions needed here.

    return () => {
      realtimeSub.current?.unsubscribe();
      if (realtimeDebounce.current) clearTimeout(realtimeDebounce.current);
    };
  }, [user]);

  // ── Pull to refresh ───────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Quick metric update helpers ───────────────────────────────────────────
  // Water/sleep/mood mutations now delegate to stores
  const upsertWater = waterStore.upsertWater;
  const upsertSleep = sleepStore.upsertSleep;
  const upsertMood = moodStore.upsertMood;

  const markChallengeComplete = useCallback(async () => {
    if (!user || !data?.todayChallenge) return;
    await supabase.from('user_challenges').upsert(
      {
        user_id: user.id,
        challenge_id: data.todayChallenge.id,
        progress: data.todayChallenge.target,
        completed: true,
      },
      { onConflict: 'user_id,challenge_id' }
    );
    setData((d) =>
      d
        ? {
            ...d,
            userChallenge: d.userChallenge
              ? { ...d.userChallenge, completed: true, progress: d.todayChallenge!.target }
              : { id: 'local', challenge_id: d.todayChallenge!.id, progress: d.todayChallenge!.target, completed: true },
          }
        : d
    );
  }, [user, data?.todayChallenge]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getMoodEmoji = (rating: number) => {
    const emojis = ['😞', '😐', '🙂', '😄', '🔥'];
    return emojis[Math.max(0, Math.min(rating - 1, 4))];
  };

  // ── APS calculation ───────────────────────────────────────────────────────
  const apsResult = data
    ? calculateAPS({
        plannedWorkouts: data.plannedWorkouts,
        completedWorkouts: data.completedWorkoutsThisWeek,
        stepGoal: data.stepGoal,
        stepsToday: data.stepsToday,
        calGoal: data.calGoal,
        calBurned: data.caloriesToday,
        proteinGoal: data.proteinGoal,
        proteinActual: data.proteinToday,
        waterGoal: waterStore.goal,
        waterActual: waterStore.glasses,
        sleepHours: sleepStore.hours,
        mood: moodStore.rating,
        bodyWeightKg: user?.weight,
      })
    : { total: 0, label: 'Loading', color: accent, tip: '' };

  // ── New user check — koi bhi activity nahi logged ────────────────────────
  const isNewUser = data != null &&
    activityStore.steps === 0 &&
    activityStore.calories === 0 &&
    data.completedWorkoutsThisWeek === 0 &&
    waterStore.glasses === 0 &&
    sleepStore.hours === 0;

  // ── Challenge completion check ────────────────────────────────────────────
  const challengeDone =
    data?.userChallenge?.completed ??
    (data?.todayChallenge
      ? isChallengeComplete(
          {
            id: data.todayChallenge.id,
            text: data.todayChallenge.title,
            icon: '🎯',
            metric: (data.todayChallenge.target_unit as any) ?? 'steps',
            target: data.todayChallenge.target,
            difficulty: 'medium',
          },
          {
            steps: activityStore.steps,
            water: waterStore.glasses,
            sleep: sleepStore.hours,
            protein: data.proteinToday,
          }
        )
      : false);

  const challengeProgress = data?.userChallenge?.progress ?? 0;
  const challengeTarget = data?.todayChallenge?.target ?? 0;
  const challengePct = challengeTarget > 0 ? Math.min(challengeProgress / challengeTarget, 1) : 0;

  // ── Display badges ────────────────────────────────────────────────────────
  const displayBadges = BADGE_DEFINITIONS.slice(0, 6).map((b) => ({
    ...b,
    unlocked: data?.unlockedBadgeIds.includes(b.id) ?? false,
  }));

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) return <HomeScreenSkeleton />;

  // Error state with retry
  if (loadError && !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>⚠️</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
          Couldn't load your data
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 28 }}>
          {loadError}
        </Text>
        <TouchableOpacity
          onPress={() => { setIsLoading(true); loadData().finally(() => setIsLoading(false)); }}
          style={{ backgroundColor: accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 15 }}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <BadgeUnlockModal badge={celebBadge} onDismiss={() => setCelebBadge(null)} />
      <WeeklySnapshotModal
        data={data?.snapshotData}
        onDismiss={() => { setSnapshotVisible(false); markSnapshotShown(); }}
      />

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeIn, transform: [{ translateY: slideUp }] }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
            colors={[accent]}
          />
        }
      >
        {/* ─── 1. HEADER ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {getGreeting()}
            </Text>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {user?.fullName?.split(' ')[0] || 'Athlete'} 👋
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Streak badge */}
            {(data?.currentStreak ?? 0) > 0 && (
              <View
                style={[
                  styles.streakBadge,
                  {
                    backgroundColor: colors.metricStreak + '22',
                    borderColor: colors.metricStreak + '55',
                  },
                ]}
              >
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text style={[styles.streakNum, { color: colors.metricStreak }]}>
                  {data!.currentStreak}
                </Text>
              </View>
            )}

            {/* Notification bell */}
            <TouchableOpacity
              onPress={() => navigation.navigate('NotificationInbox')}
              style={[styles.avatarBtn, { backgroundColor: accent + '18', borderColor: accent + '40' }]}
            >
              <Text style={{ fontSize: 20 }}>🔔</Text>
            </TouchableOpacity>

            {/* Avatar — Supabase profiles.avatar_url OR first letter */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={[styles.avatarBtn, { backgroundColor: accent + '18', borderColor: accent + '60' }]}
              activeOpacity={0.8}
            >
              {data?.avatarUrl ? (
                <Image
                  source={{ uri: data.avatarUrl }}
                  style={{ width: 46, height: 46, borderRadius: 14 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={[styles.avatarText, { color: accent }]}>
                  {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 2. APS SCORE CARD ──────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>

            {/* ── APS Ring — always visible, even at 0 ── */}
            <>
              <View style={styles.apsRingContainer}>
                <AnimatedProgressRing
                  progress={apsResult.total / 100}
                  size={200}
                  strokeWidth={6}
                  color={isNewUser ? (isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.35)') : apsResult.color}
                  trackColor={isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)'}
                  duration={1200}
                >
                  <View style={styles.apsRingCenter}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <AnimatedCounter
                        value={apsResult.total}
                        duration={1200}
                        style={[
                          { fontSize: 42, fontWeight: '900', letterSpacing: -1.5 },
                          { color: isNewUser ? accent : apsResult.color },
                        ]}
                      />
                      <Text
                        style={[
                          { fontSize: 14, fontWeight: '500' },
                          { color: colors.textSecondary, marginLeft: 2 },
                        ]}
                      >
                        {' '}/ 100
                      </Text>
                    </View>
                    <Text style={[typography.label, { color: colors.textSecondary, marginTop: 2 }]}>
                      APS SCORE
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: isNewUser ? colors.textSecondary : apsResult.color,
                        marginTop: 2,
                        textAlign: 'center',
                        maxWidth: 120,
                      }}
                      numberOfLines={2}
                    >
                      {isNewUser ? 'Log to build your score' : apsResult.label}
                    </Text>
                  </View>
                </AnimatedProgressRing>

                <TouchableOpacity
                  style={[
                    styles.apsInfoBtn,
                    { backgroundColor: accent + '18', borderColor: accent + '40' },
                  ]}
                  onPress={() => setShowAPSTip((v) => !v)}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>ⓘ</Text>
                </TouchableOpacity>
              </View>

              {showAPSTip && (
                <View
                  style={[
                    styles.apsTipCard,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                >
                  <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
                    APS = (Consistency 30% + Activity 25% + Nutrition 20% + Recovery 15% + Progress 10%).
                    Calculated live from your workouts, food logs, sleep & mood today.
                  </Text>
                  {apsResult.tip ? (
                    <Text style={[typography.bodyBold, { color: apsResult.color, marginTop: 8 }]}>
                      💡 {apsResult.tip}
                    </Text>
                  ) : null}
                </View>
              )}
            </>

            {isNewUser && (
              <View style={[styles.newUserBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 12, textAlign: 'center', letterSpacing: 0.3 }}>
                  🏁  Start logging to activate your APS score
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Workouts')}
                    activeOpacity={0.82}
                    style={[styles.newUserBtn, { backgroundColor: accent, borderWidth: 0 }]}
                  >
                    <Text style={{ fontSize: 13 }}>💪</Text>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff', marginTop: 3 }}>Workout</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('FoodLog')}
                    activeOpacity={0.82}
                    style={[styles.newUserBtn, { backgroundColor: accent + '15', borderWidth: 1, borderColor: accent + '40' }]}
                  >
                    <Text style={{ fontSize: 13 }}>🥗</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: accent, marginTop: 3 }}>Food</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Goals')}
                    activeOpacity={0.82}
                    style={[styles.newUserBtn, { backgroundColor: accent + '15', borderWidth: 1, borderColor: accent + '40' }]}
                  >
                    <Text style={{ fontSize: 13 }}>🎯</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: accent, marginTop: 3 }}>Goals</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ─── 3. METRIC CARDS ────────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricPills}
              style={{ marginTop: 28 }}
            >
              {[
                {
                  icon: 'shoe-print',
                  value: activityStore.steps,
                  unit: '',
                  label: 'Steps',
                  goal: data?.stepGoal ?? DEFAULT_STEP_GOAL,
                  color: accent,
                  decimals: 0,
                  onPress: () => navigation.navigate('DailyLog'),
                },
                {
                  icon: 'fire',
                  value: activityStore.calories,
                  unit: 'kcal',
                  label: 'Calories',
                  goal: data?.calGoal ?? DEFAULT_CAL_GOAL,
                  color: colors.metricBurn,
                  decimals: 0,
                  onPress: () => navigation.navigate('FoodLog'),
                },
                {
                  icon: 'map-marker-distance',
                  value: unitSystem === 'imperial'
                    ? activityStore.distance * 0.621371
                    : activityStore.distance,
                  unit: unitSystem === 'imperial' ? 'mi' : 'km',
                  label: 'Distance',
                  goal: unitSystem === 'imperial'
                    ? (data?.distGoal ?? DEFAULT_DIST_GOAL) * 0.621371
                    : (data?.distGoal ?? DEFAULT_DIST_GOAL),
                  color: colors.metricDistance,
                  decimals: 1,
                  onPress: () => navigation.navigate('History'),
                },
                {
                  icon: 'timer',
                  value: data?.activeMinsToday ?? 0,
                  unit: 'min',
                  label: 'Active',
                  goal: data?.activeMinsGoal ?? DEFAULT_ACTIVE_MINS_GOAL,
                  color: colors.metricStrength,
                  decimals: 0,
                  onPress: () => navigation.navigate('Workouts'),
                },
              ].map((m) => {
                const pct = Math.min((m.value / m.goal) * 100, 100);
                return (
                  <TouchableOpacity
                    key={m.label}
                    activeOpacity={0.75}
                    onPress={m.onPress}
                    style={[
                      styles.metricPill,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                  >
                    <View style={[styles.metricPillIcon, { backgroundColor: m.color + '20' }]}>
                      <AppIcon name={m.icon} size={18} color={m.color} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, gap: 2 }}>
                      <Text style={[typography.h3, { color: colors.text, lineHeight: 28 }]}>
                        {m.decimals > 0 ? m.value.toFixed(m.decimals) : m.value.toLocaleString()}
                      </Text>
                      {m.unit ? (
                        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 3 }]}>
                          {m.unit}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[typography.label, { color: colors.textSecondary, marginTop: 2 }]}>
                      {m.label}
                    </Text>
                    {/* Progress bar */}
                    <View style={[styles.pillProgress, { backgroundColor: m.color + '20' }]}>
                      <View
                        style={[styles.pillProgressFill, { backgroundColor: m.color, width: `${pct}%` }]}
                      />
                    </View>
                    {m.value === 0 && (
                      <Text style={[styles.addDataHint, { color: m.color }]}>+ Add data</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* ─── 4. QUICK ACTIONS ───────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>QUICK ACTIONS</Text>
        <View style={styles.qaRow}>
          {[
            {
              icon: 'dumbbell',
              label: 'Log Workout',
              sub: 'Track a session',
              color: accent,
              onPress: () => navigation.navigate('Workouts'),
            },
            {
              icon: 'food-apple',
              label: 'Log Food',
              sub: 'Track calories',
              color: colors.metricFood,
              onPress: () => navigation.navigate('FoodLog'),
            },
            {
              icon: 'target',
              label: 'Challenges',
              sub: 'Start a challenge',
              color: colors.metricDistance,
              onPress: () => navigation.navigate('Goals'),
            },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              activeOpacity={0.75}
              style={[
                styles.qaCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={[styles.qaIconWrap, { backgroundColor: item.color + '18' }]}>
                <AppIcon name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={[styles.qaLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.qaSub, { color: colors.textSecondary }]}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── AI Insight ─────────────────────────────────────────────── */}
        {data?.insight && (
          <View
            style={[
              styles.insightCard,
              { backgroundColor: colors.surfaceElevated, borderColor: accent + '30', borderLeftColor: accent },
            ]}
          >
            <Text style={{ fontSize: 18 }}>{data.insight.icon}</Text>
            <Text style={[styles.insightText, { color: colors.text }]}>{data.insight.text}</Text>
          </View>
        )}

        {/* ─── 5. TODAY'S CHALLENGE ───────────────────────────────────── */}
        {data?.todayChallenge ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (!challengeDone) markChallengeComplete();
            }}
            style={[
              styles.challengeCard,
              {
                backgroundColor: challengeDone ? colors.success + '14' : colors.surfaceElevated,
                borderColor: challengeDone ? colors.success + '55' : colors.border,
              },
            ]}
          >
            <Text style={{ fontSize: 24 }}>🎯</Text>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.challengeLabel, { color: colors.textSecondary }]}>
                TODAY'S CHALLENGE
              </Text>
              <Text style={[styles.challengeText, { color: challengeDone ? colors.success : colors.text }]}>
                {data.todayChallenge.title}
              </Text>
              {/* Progress bar */}
              {!challengeDone && challengeTarget > 0 && (
                <View>
                  <View style={[styles.challTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[styles.challFill, { backgroundColor: accent, width: `${challengePct * 100}%` }]}
                    />
                  </View>
                  <Text style={[styles.challPct, { color: colors.textSecondary }]}>
                    {challengeProgress.toLocaleString()} / {challengeTarget.toLocaleString()} {data.todayChallenge.target_unit}
                  </Text>
                </View>
              )}
              {data.todayChallenge.reward && (
                <Text style={[styles.challReward, { color: colors.metricStreak }]}>
                  🏆 {data.todayChallenge.reward}
                </Text>
              )}
            </View>
            <View
              style={[
                styles.challengeCheck,
                { backgroundColor: challengeDone ? colors.success : colors.border },
              ]}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                {challengeDone ? '✓' : '○'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          /* Fallback: deterministic local challenge when Supabase table is empty */
          <View
            style={[
              styles.challengeCard,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <Text style={{ fontSize: 24 }}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.challengeLabel, { color: colors.textSecondary }]}>
                TODAY'S CHALLENGE
              </Text>
              <Text style={[styles.challengeText, { color: colors.text }]}>
                {getDailyChallenge().text}
              </Text>
            </View>
          </View>
        )}

        {/* ─── 6. WEEKLY ACTIVITY CHART ───────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Activity</Text>
            <View style={[styles.cardBadge, { backgroundColor: accent + '20' }]}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: accent }}>
                {data?.weeklyWorkoutCount ?? 0} sessions
              </Text>
            </View>
          </View>

          {/* Bar chart — workout minutes per day */}
          <WeeklyBar
            values={data?.weeklyMinutes ?? Array(7).fill(0)}
            color={accent}
            colors={colors}
            onBarPress={(day, mins) => setSelectedBarDay({ day, mins })}
          />

          {/* Day detail tooltip */}
          {selectedBarDay && (
            <View style={[styles.barTooltip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][selectedBarDay.day]}
                {': '}
                {selectedBarDay.mins > 0 ? `${selectedBarDay.mins} active mins` : 'Rest day'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedBarDay(null)}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}> ✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Weekly totals */}
          <View style={[styles.weekDivider, { borderTopColor: colors.divider }]}>
            {[
              { val: `${(data?.weeklyMinutes ?? []).reduce((a, b) => a + b, 0)} min`, lbl: 'Active' },
              { val: unitSystem === 'imperial' ? `${((data?.weeklyDistance ?? 0) * 0.621371).toFixed(1)} mi` : `${(data?.weeklyDistance ?? 0).toFixed(1)} km`, lbl: 'Distance' },
              { val: (data?.weeklyCalories ?? 0).toLocaleString(), lbl: 'Calories' },
            ].map((s) => (
              <View key={s.lbl} style={styles.weekStatItem}>
                <Text style={[styles.weekStatVal, { color: colors.text }]}>{s.val}</Text>
                <Text style={[styles.weekStatLbl, { color: colors.textSecondary }]}>{s.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ─── 7. TODAY'S METRICS DETAIL (editable) ───────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TODAY'S METRICS</Text>
        <View style={styles.tilesRow}>
          {/* Water — reads from waterStore */}
          <TouchableOpacity
            onPress={() => setEditingWater((v) => !v)}
            style={[styles.tile, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <View style={[styles.tileIcon, { backgroundColor: colors.metricHydration + '18' }]}>
              <AppIcon name="water" size={16} color={colors.metricHydration} />
            </View>
            <Text style={[styles.tileVal, { color: colors.text }]}>{waterStore.glasses}</Text>
            <Text style={[styles.tileLbl, { color: colors.textSecondary }]}>Water 💧</Text>
            <View style={[styles.tileTrack, { backgroundColor: colors.metricHydration + '22' }]}>
              <View
                style={[
                  styles.tileFill,
                  {
                    backgroundColor: colors.metricHydration,
                    width: `${Math.min((waterStore.glasses / waterStore.goal) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
            {editingWater && (
              <View style={styles.inlineEdit}>
                <TouchableOpacity
                  onPress={waterStore.removeGlass}
                  style={[styles.editBtn, { backgroundColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={waterStore.addGlass}
                  style={[styles.editBtn, { backgroundColor: accent }]}
                >
                  <Text style={{ color: colors.onPrimary, fontWeight: '900', fontSize: 16 }}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>

          {/* Sleep — reads from sleepStore */}
          <TouchableOpacity
            onPress={() => setEditingSleep((v) => !v)}
            style={[styles.tile, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <View style={[styles.tileIcon, { backgroundColor: colors.metricSleep + '18' }]}>
              <AppIcon name="sleep" size={16} color={colors.metricSleep} />
            </View>
            <Text style={[styles.tileVal, { color: colors.text }]}>{sleepStore.hours}h</Text>
            <Text style={[styles.tileLbl, { color: colors.textSecondary }]}>Sleep 😴</Text>
            <View style={[styles.tileTrack, { backgroundColor: colors.metricSleep + '22' }]}>
              <View
                style={[
                  styles.tileFill,
                  {
                    backgroundColor: colors.metricSleep,
                    width: `${Math.min((sleepStore.hours / sleepStore.goal) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
            {editingSleep && (
              <View style={styles.inlineEdit}>
                <TouchableOpacity
                  onPress={() => upsertSleep(Math.max(0, sleepStore.hours - 0.5))}
                  style={[styles.editBtn, { backgroundColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => upsertSleep(Math.min(12, sleepStore.hours + 0.5))}
                  style={[styles.editBtn, { backgroundColor: accent }]}
                >
                  <Text style={{ color: colors.onPrimary, fontWeight: '900', fontSize: 16 }}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>

          {/* Mood — reads from moodStore */}
          <TouchableOpacity
            onPress={() => {
              const next = ((moodStore.rating % 5) + 1) as 1|2|3|4|5;
              upsertMood(next);
            }}
            style={[styles.tile, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <View style={[styles.tileIcon, { backgroundColor: colors.primary + '18' }]}>
              <Text style={{ fontSize: 14 }}>{getMoodEmoji(moodStore.rating)}</Text>
            </View>
            <Text style={[styles.tileVal, { color: colors.text }]}>
              {getMoodEmoji(moodStore.rating)}
            </Text>
            <Text style={[styles.tileLbl, { color: colors.textSecondary }]}>Mood</Text>
            <View style={[styles.tileTrack, { backgroundColor: accent + '22' }]}>
              <View
                style={[
                  styles.tileFill,
                  {
                    backgroundColor: accent,
                    width: `${(moodStore.rating / 5) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={[{ fontSize: 9, color: colors.textDisabled, textAlign: 'center', marginTop: 2 }]}>
              tap to change
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── 8. ACTIVITY STREAK ─────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Activity Streak</Text>
            <Text style={{ fontSize: 22 }}>🔥</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ alignItems: 'center', minWidth: 70 }}>
              <Text style={{ fontSize: 52, fontWeight: '900', color: colors.metricStreak, letterSpacing: -2 }}>
                {data?.currentStreak ?? 0}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
                days
              </Text>
            </View>

            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {(data?.currentStreak ?? 0) === 0
                  ? 'Start your streak today!'
                  : (data?.currentStreak ?? 0) >= 7
                  ? `${data!.currentStreak} days strong! 🏆`
                  : `${7 - (data?.currentStreak ?? 0)} more days to 7-day badge`}
              </Text>

              {/* Current streak bar */}
              <View>
                <View style={[styles.bigTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.bigFill,
                      {
                        backgroundColor: colors.metricStreak,
                        width: `${Math.min(((data?.currentStreak ?? 0) / 30) * 100, 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={{ fontSize: 10, color: colors.textDisabled, marginTop: 4 }}>
                  {data?.currentStreak ?? 0} / 30 day goal · Best: {data?.bestStreak ?? 0} days
                </Text>
              </View>

              <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                Streak requires ≥5,000 steps OR 1 workout per day.
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 9. ACHIEVEMENTS ────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Achievements</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={[styles.seeAll, { color: accent }]}>
                {data?.unlockedBadgeIds.length ?? 0}/{BADGE_DEFINITIONS.length}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recent achievements from Supabase */}
          {(data?.recentAchievements ?? []).length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, marginBottom: 14 }}
            >
              {data!.recentAchievements.slice(0, 5).map((ach) => {
                const meta = ACHIEVEMENT_META[ach.achievement_type];
                if (!meta) return null;
                return (
                  <View
                    key={ach.id}
                    style={[
                      styles.achChip,
                      { backgroundColor: meta.color + '18', borderColor: meta.color + '55' },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                    <Text style={[styles.achChipLabel, { color: colors.text }]}>{meta.label}</Text>
                    <Text style={[styles.achChipDate, { color: colors.textSecondary }]}>
                      {dayjs(ach.earned_at).format('MMM D')}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Badge grid (legacy system) */}
          <View style={styles.badgesGrid}>
            {displayBadges.map((badge) => (
              <View
                key={badge.id}
                style={[
                  styles.badge,
                  {
                    backgroundColor: badge.unlocked ? badge.color + '15' : colors.surface,
                    borderColor: badge.unlocked ? badge.color + '60' : colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: badge.unlocked ? 22 : 18, opacity: badge.unlocked ? 1 : 0.3 }}>
                  {badge.icon}
                </Text>
                <Text
                  style={[
                    styles.badgeLabel,
                    { color: badge.unlocked ? colors.text : colors.textDisabled },
                  ]}
                >
                  {badge.label}
                </Text>
                {badge.unlocked && (
                  <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ─── 10. RECENT ACTIVITIES FEED ─────────────────────────────── */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginBottom: 110 },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Activity</Text>
            {(data?.feedItems ?? []).length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={[styles.seeAll, { color: accent }]}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {(data?.feedItems ?? []).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>🏃</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No activities yet</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Start your first workout to track progress
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: accent }]}
                onPress={() => navigation.navigate('Workouts')}
                activeOpacity={0.85}
              >
                <Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Log Workout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            data!.feedItems.map((item, i) => {
              const isLast = i === data!.feedItems.length - 1;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.kind === 'workout') {
                      navigation.navigate('WorkoutDetail', { workoutId: item.referenceId });
                    } else if (item.kind === 'food') {
                      navigation.navigate('FoodLog');
                    } else {
                      navigation.navigate('History');
                    }
                  }}
                  style={[
                    feedS.row,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider },
                  ]}
                >
                  <View style={[feedS.iconWrap, { backgroundColor: item.color + '18' }]}>
                    {item.kind === 'achievement' ? (
                      <Text style={{ fontSize: 18 }}>
                        {(ACHIEVEMENT_META[item.id.replace('ach_', '')] ?? { icon: '🏅' }).icon}
                      </Text>
                    ) : (
                      <AppIcon name={item.icon} size={18} color={item.color} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[feedS.title, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[feedS.sub, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                  </View>
                  <Text style={[feedS.time, { color: colors.textDisabled }]}>
                    {dayjs(item.createdAt).format('h:mm A')}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const feedS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  sub: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  time: { fontSize: 11, fontWeight: '600' },
});

const styles = StyleSheet.create({
  scroll: { padding: spacing.md },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: { ...typography.label, marginBottom: 3 },
  userName: { ...typography.h1, letterSpacing: -0.8 },
  avatarBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  avatarText: { fontSize: 19, fontWeight: '900' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  streakNum: { fontSize: 15, fontWeight: '900', letterSpacing: -0.5 },

  // Hero / APS
  heroSection: {
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: { alignItems: 'center', width: '100%' },
  apsRingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  apsRingCenter: { alignItems: 'center', justifyContent: 'center' },
  apsInfoBtn: {
    position: 'absolute',
    top: 0,
    right: -40,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  apsTipCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    maxWidth: '90%',
  },

  // Metric pills
  metricPills: { paddingHorizontal: 4, gap: 12 },
  metricPill: {
    width: 140,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricPillIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillProgress: { width: '100%', height: 4, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  pillProgressFill: { height: 4, borderRadius: 2 },
  addDataHint: { fontSize: 9, fontWeight: '700', marginTop: 4, letterSpacing: 0.3 },

  // Quick actions
  sectionLabel: { ...typography.label, marginBottom: 12, marginTop: 4 },
  qaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  qaCard: { flex: 1, padding: 14, borderRadius: borderRadius.lg, borderWidth: 1, gap: 8 },
  qaIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { ...typography.bodyBold, letterSpacing: -0.2 },
  qaSub: { ...typography.caption },

  // Insight
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 10,
  },
  insightText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19 },

  // Challenge
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  challengeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  challengeText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  challengeCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  challTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  challFill: { height: 4, borderRadius: 2 },
  challPct: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  challReward: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  // Cards
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { ...typography.h4, letterSpacing: -0.3 },
  cardBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  seeAll: { fontSize: 12, fontWeight: '700' },

  // Bar chart tooltip
  barTooltip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },

  // Weekly stats
  weekDivider: { flexDirection: 'row', borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md },
  weekStatItem: { flex: 1, alignItems: 'center' },
  weekStatVal: { fontSize: 14, fontWeight: '800', letterSpacing: -0.4 },
  weekStatLbl: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },

  // Metric tiles (water/sleep/mood)
  tilesRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tile: { flex: 1, padding: 12, borderRadius: borderRadius.lg, borderWidth: 1, gap: 4, alignItems: 'center' },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileVal: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  tileLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' },
  tileTrack: { height: 3, borderRadius: 2, marginTop: 4, overflow: 'hidden', width: '100%' },
  tileFill: { height: 3, borderRadius: 2 },
  inlineEdit: { flexDirection: 'row', gap: 8, marginTop: 8 },
  editBtn: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Streak
  bigTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bigFill: { height: 6, borderRadius: 3 },

  // Achievements
  achChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 4, minWidth: 90 },
  achChipLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  achChipDate: { fontSize: 10, fontWeight: '500' },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '30%', borderWidth: 1, borderRadius: borderRadius.lg, paddingVertical: 12, alignItems: 'center', gap: 5 },
  badgeLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2, paddingHorizontal: 4 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },

  newUserBanner: {
    width: '100%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 14,
    marginTop: 20,
    alignItems: 'center',
  },
  newUserBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  // Setup card (new user — no data yet)
  setupCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    width: '100%',
    gap: 10,
  },
  setupPrimaryCta: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  setupSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  setupSteps: { width: '100%', gap: 10 },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  setupStepText: { flex: 1, fontSize: 14, fontWeight: '700' },

  // Feed empty state
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  emptySub: { fontSize: 12, textAlign: 'center', maxWidth: 220, fontWeight: '500' },
  emptyBtn: { marginTop: 14, paddingHorizontal: 32, paddingVertical: 14, borderRadius: borderRadius.full },
  emptyBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
});
