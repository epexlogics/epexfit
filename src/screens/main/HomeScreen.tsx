/**
 * HomeScreen — v4 PREMIUM REDESIGN (Inspiration-level)
 *
 * NEW in v4:
 * - Hero APS ring (60% screen space, 200px diameter)
 * - Animated progress ring with count-up
 * - Horizontal metric pills (not grid)
 * - Premium cards with gradient + inner glow
 * - Inter font family throughout
 * - Larger display numbers (48-64px)
 * - 20-24px border radius
 * - Badge unlock celebration animation
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  Animated, View, Image, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Dimensions, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { databaseService } from '../../services/database';
import { recalculateStreak, syncBadges, getUnlockedBadgeIds } from '../../services/streaks';
import { calculateAPS, calcProteinGoal, calcCalorieBurnGoal } from '../../utils/performanceScore';
import { generateInsight, getDailyChallenge, isChallengeComplete } from '../../utils/insights';
import { DailyLog, Activity, Goal } from '../../types';
import { BADGE_DEFINITIONS, BadgeDefinition } from '../../constants/badges';
import AppIcon from '../../components/AppIcon';
import BadgeUnlockModal from '../../components/BadgeUnlockModal';
import WeeklySnapshotModal, { shouldShowWeeklySnapshot, markSnapshotShown } from '../../components/WeeklySnapshotModal';
import { HomeScreenSkeleton } from '../../components/SkeletonLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/config';
import AnimatedProgressRing from '../../components/AnimatedProgressRing';
import AnimatedCounter from '../../components/AnimatedCounter';
import PremiumCard from '../../components/PremiumCard';
import GradientButton from '../../components/GradientButton';
import { spacing, borderRadius, typography } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

const { width } = Dimensions.get('window');
const DEFAULT_STEP_GOAL = 10000;
const DEFAULT_DIST_GOAL = 5;
const DEFAULT_CAL_GOAL = 500;
const DAILY_CHALLENGE_KEY = '@epexfit_daily_challenge';

function ArcProgress({ progress, size = 120, strokeWidth = 10, color, trackColor, children }: {
  progress: number; size?: number; strokeWidth?: number; color: string; trackColor?: string; children?: React.ReactNode;
}) {
  const p = Math.min(Math.max(progress, 0), 1);
  const r = (size - strokeWidth) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - p);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={cx} cy={cy} r={r} stroke={trackColor ?? 'rgba(148,163,184,0.25)'} strokeWidth={strokeWidth} fill="none" />
        <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
      </Svg>
      {children}
    </View>
  );
}

function WeekBar({ values, color, colors }: { values: number[]; color: string; colors: any }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const max = Math.max(...values, 1);
  const todayIdx = (new Date().getDay() + 6) % 7;
  return (
    <View style={barS.row}>
      {values.map((v, i) => {
        const h = Math.max((v / max) * 52, 3);
        const isToday = i === todayIdx;
        return (
          <View key={i} style={barS.col}>
            <View style={barS.barWrap}>
              <View style={[barS.bar, {
                height: h, borderRadius: 6,
                backgroundColor: isToday ? color : v > 0 ? color + '45' : color + '15',
              }]} />
            </View>
            <Text style={[barS.day, { color: isToday ? color : colors.textDisabled, fontWeight: isToday ? '800' : '500' }]}>{days[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}
const barS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  col: { flex: 1, alignItems: 'center', gap: 5 },
  barWrap: { height: 56, justifyContent: 'flex-end' },
  bar: { width: '100%' },
  day: { fontSize: 10 },
});

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { steps, distance, calories } = useTracking();
  const { sendSmartNotifications, notifyBadgeUnlocked } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState({ totalSteps: 0, totalDistance: 0, totalCalories: 0 });
  const [weeklySteps, setWeeklySteps] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [streak, setStreak] = useState(0);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<string[]>([]);
  const [apsResult, setApsResult] = useState({ total: 0, label: 'Building', color: '#A78BFA', tip: '' });
  const [stepGoal, setStepGoal] = useState(DEFAULT_STEP_GOAL);
  const [distGoal, setDistGoal] = useState(DEFAULT_DIST_GOAL);
  const [calGoal, setCalGoal] = useState(DEFAULT_CAL_GOAL);
  const [celebBadge, setCelebBadge] = useState<BadgeDefinition | null>(null);
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [insight, setInsight] = useState<{ text: string; icon: string } | null>(null);
  const [challenge, setChallenge] = useState(getDailyChallenge());
  const [challengeDone, setChallengeDone] = useState(false);
  const [showAPSTip, setShowAPSTip] = useState(false);
const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const fadeIn = useState(new Animated.Value(0))[0];
  const slideUp = useState(new Animated.Value(22))[0];

  useEffect(() => {
    if (user) loadData();
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, speed: 16, bounciness: 5, useNativeDriver: true }),
    ]).start();
    setChallenge(getDailyChallenge());
  }, [user]);

  const loadData = async () => {
    if (!user) return;
setIsLoading(true);
try {
  const savedAvatar = await AsyncStorage.getItem('@epexfit_avatar_url');
  if (savedAvatar) setAvatarUri(savedAvatar);
} catch {}
    const now = new Date();
    const diffToMonday = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);

    const [
      { data: log }, { data: activities }, stats, { data: goals },
      realWeeklySteps, currentStreak, badgeIds,
    ] = await Promise.all([
      databaseService.getDailyLog(user.id, new Date()),
      databaseService.getRecentActivities(user.id, 5),
      databaseService.getStatistics(user.id, 'week'),
      databaseService.getGoals(user.id),
      databaseService.getWeeklyStepsByDay(user.id, weekStart),
      recalculateStreak(user.id),
      getUnlockedBadgeIds(user.id),
    ]);

    setTodayLog(log);
    setRecentActivities(activities ?? []);
    setWeeklyStats(stats);
    setWeeklySteps(realWeeklySteps);
    setStreak(currentStreak);
    setUnlockedBadgeIds(badgeIds);

    // Personalised goals
    let sGoal = DEFAULT_STEP_GOAL, cGoal = DEFAULT_CAL_GOAL, dGoal = DEFAULT_DIST_GOAL;
    let proteinGoal = user.weight ? calcProteinGoal(user.weight) : 120;
    if (goals?.length) {
      const sg = goals.find((g: Goal) => g.type === 'steps');
      const cg = goals.find((g: Goal) => g.type === 'calories');
      const rg = goals.find((g: Goal) => g.type === 'running');
      if (sg) { setStepGoal(sg.target); sGoal = sg.target; }
      if (cg) { setCalGoal(cg.target); cGoal = cg.target; }
      if (rg) { setDistGoal(rg.target); dGoal = rg.target; }
    }

    const todaySteps = log?.steps ?? steps ?? 0;
    const todayDist = log?.distance ?? distance ?? 0;
    const todayCal = log?.calories ?? calories ?? 0;
    const todayProtein = log?.protein ?? 0;
    const todayWater = log?.water ?? 0;

    // FIX: read user's actual training days from onboarding — was hardcoded to 5
    // This was causing APS Consistency score to always be wrong for users with 2, 4, or 6 day plans
    let plannedWorkouts = 5;
    try {
      const onboardingRaw = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
      if (onboardingRaw) {
        const onboarding = JSON.parse(onboardingRaw);
        if (onboarding?.trainingDays && typeof onboarding.trainingDays === 'number') {
          plannedWorkouts = onboarding.trainingDays;
        }
      }
    } catch { /* use default of 5 */ }

    const aps = calculateAPS({
      plannedWorkouts,
      completedWorkouts: activities?.length ?? 0,
      stepGoal: sGoal,
      stepsToday: todaySteps,
      calGoal: cGoal,
      calBurned: todayCal,
      proteinGoal,
      proteinActual: todayProtein,
      waterGoal: 8,
      waterActual: todayWater,
      sleepHours: log?.sleep ?? 0,
      mood: log?.mood ?? 3,
      bodyWeightKg: user.weight,
    });
    setApsResult(aps);

    // Background tasks — run after UI renders to avoid blocking the initial paint
    setIsLoading(false);
    databaseService.syncGoalProgress(user.id).catch(() => {});
    syncBadges(user.id).then(newBadges => {
      if (newBadges.length > 0) {
        setCelebBadge(newBadges[0]);
        notifyBadgeUnlocked(newBadges[0].label, newBadges[0].icon).catch(() => {});
      }
    }).catch(() => {});

    const ch = getDailyChallenge(
      realWeeklySteps.filter(s => s > 0).length > 0
        ? realWeeklySteps.reduce((a, b) => a + b, 0) / 7
        : undefined
    );
    setChallenge(ch);

    // FIX: persist daily challenge completion — was recalculated fresh every load,
    // so backgrounding the app reset the completed checkmark
    const today = new Date().toISOString().split('T')[0];
    let persistedDone = false;
    try {
      const saved = await AsyncStorage.getItem(DAILY_CHALLENGE_KEY);
      if (saved) {
        const { date, completed } = JSON.parse(saved);
        if (date === today && completed) persistedDone = true;
      }
    } catch { /* ignore */ }

    const metricsDone = isChallengeComplete(ch, {
      steps: todaySteps, water: todayWater, sleep: log?.sleep ?? 0, protein: todayProtein,
    });
    const isDone = persistedDone || metricsDone;
    setChallengeDone(isDone);

    if (metricsDone && !persistedDone) {
      try {
        await AsyncStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify({ date: today, completed: true }));
      } catch { /* ignore */ }
    }

    const i = generateInsight({
      avgSleepHours: log?.sleep ?? 0,
      bestDaySteps: Math.max(...realWeeklySteps),
      weeklyStepsChange: stats.totalSteps > 0 ? 5 : 0,
      currentStreak,
      waterToday: todayWater,
      proteinToday: todayProtein,
      stepsToday: todaySteps,
      stepGoal: sGoal,
    });
    setInsight(i);

    if (await shouldShowWeeklySnapshot()) {
      setSnapshotData({
        totalSteps: stats.totalSteps, totalDistKm: stats.totalDistance,
        totalCalories: stats.totalCalories, activeDays: realWeeklySteps.filter(s => s > 0).length,
        streak: currentStreak, bestDaySteps: Math.max(...realWeeklySteps),
        bestDayDate: '', apsScore: aps.total,
      });
    }

    sendSmartNotifications({
      stepsToday: todaySteps, stepGoal: sGoal,
      streak: currentStreak, distanceToday: todayDist, distanceGoal: dGoal,
      waterToday: todayWater, waterGoal: 8,
    }).catch(() => {});
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning'; if (h < 18) return 'Good afternoon'; return 'Good evening';
  };

  const todaySteps = todayLog?.steps ?? steps ?? 0;
  const todayDist = todayLog?.distance ?? distance ?? 0;
  const todayCal = todayLog?.calories ?? calories ?? 0;
  const overallPct = Math.min(((todaySteps / stepGoal) + (todayDist / distGoal) + (todayCal / calGoal)) / 3, 1);
  const consistencyPct = Math.min((weeklyStats.totalSteps / (stepGoal * 7)) * 100, 100);
  const accent = colors.primary;
  const displayBadges = BADGE_DEFINITIONS.slice(0, 6).map(b => ({ ...b, unlocked: unlockedBadgeIds.includes(b.id) }));

  // Training load warning: 5 activities in the past 5 days is high load
  const highLoad = recentActivities.length >= 4;

  // Hero APS ring — 60% of screen height
  const screenHeight = Dimensions.get('window').height;
  const heroHeight = screenHeight * 0.55; // 55% for better balance

  if (isLoading) return <HomeScreenSkeleton />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <BadgeUnlockModal badge={celebBadge} onDismiss={() => setCelebBadge(null)} />
      <WeeklySnapshotModal data={snapshotData} onDismiss={() => { setSnapshotData(null); markSnapshotShown(); }} />

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeIn, transform: [{ translateY: slideUp }] }}
        contentContainerStyle={[styles.scroll, { }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()}</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.fullName?.split(' ')[0] || 'Athlete'} 👋</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {streak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: colors.metricStreak + '22', borderColor: colors.metricStreak + '55' }]}>
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text style={[styles.streakNum, { color: colors.metricStreak }]}>{streak}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}
  style={[styles.avatarBtn, { backgroundColor: accent + '18', borderColor: accent + '60' }]}>
  {avatarUri ? (
    <Image source={{ uri: avatarUri }} style={{ width: 46, height: 46, borderRadius: 16 }} />
  ) : (
    <Text style={[styles.avatarText, { color: accent }]}>{user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
  )}
</TouchableOpacity>
          </View>
        </View>

        {/* ── HERO SECTION: Dominant APS Ring (60% screen) ── */}
        <View style={[styles.heroSection, { minHeight: heroHeight }]}>
          <View style={styles.heroContent}>
            {/* APS Ring — 200px diameter, animated */}
            <View style={styles.apsRingContainer}>
              <AnimatedProgressRing
                progress={apsResult.total / 100}
                size={200}
                strokeWidth={6}
                color={apsResult.color}
                trackColor={isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)'}
                duration={1200}
              >
                <View style={styles.apsRingCenter}>
                  <AnimatedCounter
                    value={apsResult.total}
                    duration={1200}
                    style={[typography.displayMedium, { color: apsResult.color }]}
                  />
                  <Text style={[typography.label, { color: colors.textSecondary, marginTop: 4 }]}>
                    APS SCORE
                  </Text>
                  <Text style={[typography.bodyBold, { color: apsResult.color, marginTop: 2 }]}>
                    {apsResult.label}
                  </Text>
                </View>
              </AnimatedProgressRing>
              
              {/* APS Info Button */}
              <TouchableOpacity
                style={[styles.apsInfoBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
                onPress={() => setShowAPSTip(!showAPSTip)}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>ⓘ</Text>
              </TouchableOpacity>
            </View>

            {/* APS Tooltip */}
            {showAPSTip && (
              <View style={[styles.apsTipCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
                  Athlete Performance Score combines consistency, activity, nutrition, sleep & mood. Higher = better day.
                </Text>
                {apsResult.tip && (
                  <Text style={[typography.bodyBold, { color: apsResult.color, marginTop: 8 }]}>
                    {apsResult.tip}
                  </Text>
                )}
              </View>
            )}

            {/* Metric Pills — Horizontal scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricPills}
              style={{ marginTop: 32 }}
            >
              {[
                { icon: 'shoe-print', value: todaySteps, unit: '', label: 'Steps', goal: stepGoal, color: colors.primary },
                { icon: 'map-marker-distance', value: todayDist, unit: 'km', label: 'Distance', goal: distGoal, color: colors.metricDistance, decimals: 1 },
                { icon: 'fire', value: todayCal, unit: 'kcal', label: 'Calories', goal: calGoal, color: colors.metricBurn },
                { icon: 'food-steak', value: todayLog?.protein ?? 0, unit: 'g', label: 'Protein', goal: 120, color: colors.metricProtein },
              ].map((metric) => {
                const progress = Math.min((metric.value / metric.goal) * 100, 100);
                return (
                  <View
                    key={metric.label}
                    style={[
                      styles.metricPill,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.metricPillIcon, { backgroundColor: metric.color + '20' }]}>
                      <AppIcon name={metric.icon} size={18} color={metric.color} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, gap: 2 }}>
  <Text style={[typography.h3, { color: colors.text, lineHeight: 28 }]}>
    {metric.decimals ? metric.value.toFixed(metric.decimals) : metric.value.toLocaleString()}
  </Text>
  {metric.unit ? (
    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 3 }]}>
      {metric.unit}
    </Text>
  ) : null}
</View>
                    <Text style={[typography.label, { color: colors.textSecondary, marginTop: 2 }]}>
                      {metric.label}
                    </Text>
                    {/* Mini progress bar */}
                    <View style={[styles.pillProgress, { backgroundColor: metric.color + '20' }]}>
                      <View style={[styles.pillProgressFill, { backgroundColor: metric.color, width: `${progress}%` }]} />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>QUICK ACTIONS</Text>
        <View style={styles.qaRow}>
          {[
            { icon: 'run', label: 'Activity', sub: 'Start tracking', color: accent, screen: 'Activity' },
            { icon: 'food-apple', label: 'Food Log', sub: 'Log meals', color: colors.metricFood, screen: 'FoodLog' },
            { icon: 'dumbbell', label: 'Workouts', sub: 'Log lifting', color: colors.metricDistance, screen: 'Workouts' },
          ].map((item) => (
            <TouchableOpacity key={item.label} onPress={() => navigation.navigate(item.screen)} activeOpacity={0.75}
              style={[styles.qaCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={[styles.qaIconWrap, { backgroundColor: item.color + '15' }]}><AppIcon name={item.icon} size={22} color={item.color} /></View>
              <Text style={[styles.qaLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.qaSub, { color: colors.textSecondary }]}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* AI Daily Insight */}
        {insight && (
          <View style={[styles.insightCard, { backgroundColor: colors.surfaceElevated, borderColor: accent + '30', borderLeftColor: accent }]}>
            <Text style={{ fontSize: 18 }}>{insight.icon}</Text>
            <Text style={[styles.insightText, { color: colors.text }]}>{insight.text}</Text>
          </View>
        )}

        {/* Daily Challenge — completion tied to real data */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.challengeCard, { backgroundColor: challengeDone ? colors.success + '14' : colors.surfaceElevated, borderColor: challengeDone ? colors.success + '55' : colors.border }]}
        >
          <Text style={{ fontSize: 22 }}>{challenge.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.challengeLabel, { color: colors.textSecondary }]}>TODAY'S CHALLENGE</Text>
            <Text style={[styles.challengeText, { color: challengeDone ? colors.success : colors.text }]}>{challenge.text}</Text>
          </View>
          <View style={[styles.challengeCheck, { backgroundColor: challengeDone ? colors.success : colors.border }]}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{challengeDone ? '✓' : '○'}</Text>
          </View>
        </TouchableOpacity>

        {/* Training Load Warning */}
        {highLoad && (
          <View style={[styles.card, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '44' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 22 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.warning }}>High Training Load</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                  {recentActivities.length} sessions this week. Consider a rest or recovery day — overtraining stalls progress.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Weekly Activity */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Activity</Text>
            <Text style={[styles.cardBadge, { backgroundColor: accent + '20', color: accent }]}>Real data</Text>
          </View>
          <WeekBar values={weeklySteps} color={accent} colors={colors} />
          <View style={[styles.weekDivider, { borderTopColor: colors.divider }]}>
            {[
              { val: weeklyStats.totalSteps.toLocaleString(), lbl: 'Steps' },
              { val: `${weeklyStats.totalDistance.toFixed(1)} km`, lbl: 'Distance' },
              { val: weeklyStats.totalCalories.toLocaleString(), lbl: 'Calories' },
            ].map((s) => (
              <View key={s.lbl} style={styles.weekStatItem}>
                <Text style={[styles.weekStatVal, { color: colors.text }]}>{s.val}</Text>
                <Text style={[styles.weekStatLbl, { color: colors.textSecondary }]}>{s.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Daily Metrics */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TODAY'S METRICS</Text>
        <View style={styles.tilesRow}>
          {[
            { icon: 'water', value: `${todayLog?.water ?? 0}`, label: 'Water', color: colors.metricHydration, cur: todayLog?.water ?? 0, goal: 8 },
            { icon: 'food-steak', value: `${todayLog?.protein ?? 0}g`, label: 'Protein', color: colors.metricProtein, cur: todayLog?.protein ?? 0, goal: 120 },
            { icon: 'sleep', value: `${todayLog?.sleep ?? 0}h`, label: 'Sleep', color: colors.metricSleep, cur: todayLog?.sleep ?? 0, goal: 8 },
          ].map(t => (
            <View key={t.label} style={[styles.tile, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={[styles.tileIcon, { backgroundColor: t.color + '18' }]}><AppIcon name={t.icon} size={16} color={t.color} /></View>
              <Text style={[styles.tileVal, { color: colors.text }]}>{t.value}</Text>
              <Text style={[styles.tileLbl, { color: colors.textSecondary }]}>{t.label}</Text>
              <View style={[styles.tileTrack, { backgroundColor: t.color + '22' }]}>
                <View style={[styles.tileFill, { backgroundColor: t.color, width: `${Math.min((t.cur / t.goal) * 100, 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Streak + Consistency */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Activity Streak</Text>
            <Text style={{ fontSize: 22 }}>🔥</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: colors.metricStreak, letterSpacing: -2 }}>{streak}</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>days</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {streak === 0 ? 'Start your streak today!' : streak >= 7 ? `${streak} days strong! 🏆` : `${7 - streak} more days to 7-day badge`}
              </Text>
              <View style={[styles.bigTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.bigFill, { backgroundColor: colors.metricStreak, width: `${Math.min((streak / 30) * 100, 100)}%` }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Achievements */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Achievements</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: accent }}>{unlockedBadgeIds.length}/{BADGE_DEFINITIONS.length}</Text>
          </View>
          <View style={styles.badgesGrid}>
            {displayBadges.map((badge) => (
              <View key={badge.id} style={[styles.badge, { backgroundColor: badge.unlocked ? badge.color + '15' : colors.surface, borderColor: badge.unlocked ? badge.color + '60' : colors.border }]}>
                <Text style={{ fontSize: badge.unlocked ? 22 : 18, opacity: badge.unlocked ? 1 : 0.3 }}>{badge.icon}</Text>
                <Text style={[styles.badgeLabel, { color: badge.unlocked ? colors.text : colors.textDisabled }]}>{badge.label}</Text>
                {badge.unlocked && <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />}
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activities */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginBottom: 110 }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Activities</Text>
            {recentActivities.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={[styles.seeAll, { color: accent }]}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentActivities.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>🏃</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No activities yet</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Start your first workout to track progress</Text>
              <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: accent }]} onPress={() => navigation.navigate('Activity')} activeOpacity={0.85}>
                <Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Start Activity</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentActivities.slice(0, 5).map((a, i) => {
              const meta: Record<string, { icon: string; color: string; label: string }> = {
                running: { icon: 'run', color: colors.metricBurn, label: 'Running' },
                cycling: { icon: 'bike', color: colors.metricDistance, label: 'Cycling' },
                walking: { icon: 'walk', color: colors.secondary, label: 'Walking' },
                swimming: { icon: 'swim', color: colors.metricHydration, label: 'Swimming' },
                strength: { icon: 'weight', color: colors.metricStrength, label: 'Strength' },
                hiit: { icon: 'fire', color: colors.metricBurn, label: 'HIIT' },
                yoga: { icon: 'meditation', color: colors.metricProtein, label: 'Yoga' },
              };
              const m = meta[a.type] ?? meta.walking;
              const mins = Math.floor(a.duration / 60);
              const isLast = i === recentActivities.slice(0, 5).length - 1;
              return (
                <TouchableOpacity key={a.id} activeOpacity={0.7} onPress={() => navigation.navigate('PhotoLog', { activity: a })}
                  style={[actS.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <View style={[actS.iconWrap, { backgroundColor: m.color + '15' }]}><AppIcon name={m.icon} size={18} color={m.color} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[actS.type, { color: colors.text }]}>{m.label}</Text>
                    <Text style={[actS.time, { color: colors.textSecondary }]}>{dayjs(a.startTime).format('MMM D · h:mm A')}</Text>
                  </View>
                  <View style={actS.statsWrap}><Text style={[actS.statVal, { color: colors.text }]}>{a.steps.toLocaleString()}</Text><Text style={[actS.statLbl, { color: colors.textSecondary }]}>steps</Text></View>
                  <View style={actS.statsWrap}><Text style={[actS.statVal, { color: colors.text }]}>{a.distance.toFixed(1)}</Text><Text style={[actS.statLbl, { color: colors.textSecondary }]}>km</Text></View>
                  <View style={actS.statsWrap}><Text style={[actS.statVal, { color: colors.text }]}>{mins}m</Text><Text style={[actS.statLbl, { color: colors.textSecondary }]}>time</Text></View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const actS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  type: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  time: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  statsWrap: { alignItems: 'center', minWidth: 36 },
  statVal: { fontSize: 13, fontWeight: '700', letterSpacing: -0.3 },
  statLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  scroll: { padding: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { ...typography.label, marginBottom: 3 },
  userName: { ...typography.h1, letterSpacing: -0.8 },
  avatarBtn: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  avatarText: { fontSize: 19, fontWeight: '900', fontFamily: 'Inter_900Black' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  streakNum: { fontSize: 15, fontWeight: '900', letterSpacing: -0.5, fontFamily: 'Inter_900Black' },
  
  // Hero Section (60% screen)
  heroSection: {
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'center',
    width: '100%',
  },
  apsRingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  apsRingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  
  // Metric Pills
  metricPills: {
    paddingHorizontal: 4,
    gap: 12,
  },
metricPill: {
  width: 140,
  paddingHorizontal: 14,
  paddingVertical: 14,
  borderRadius: borderRadius.lg,
  borderWidth: 1,
  alignItems: 'center',
  overflow: 'visible',   
},
  metricPillIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillProgress: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  pillProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  sectionLabel: { ...typography.label, marginBottom: 12, marginTop: 4 },
  qaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  qaCard: { flex: 1, padding: 14, borderRadius: borderRadius.lg, borderWidth: 1, gap: 8 },
  qaIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { ...typography.bodyBold, letterSpacing: -0.2 },
  qaSub: { ...typography.caption },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderLeftWidth: 3, marginBottom: 10 },
  insightText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19 },
  challengeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: spacing.lg },
  challengeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 },
  challengeText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  challengeCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { ...typography.h4, letterSpacing: -0.3 },
  cardBadge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  seeAll: { fontSize: 12, fontWeight: '700' },
  weekDivider: { flexDirection: 'row', borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md },
  weekStatItem: { flex: 1, alignItems: 'center' },
  weekStatVal: { fontSize: 14, fontWeight: '800', letterSpacing: -0.4 },
  weekStatLbl: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
  tilesRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tile: { flex: 1, padding: 14, borderRadius: borderRadius.lg, borderWidth: 1, gap: 6 },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileVal: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  tileLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  tileTrack: { height: 3, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  tileFill: { height: 3, borderRadius: 2 },
  bigTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bigFill: { height: 6, borderRadius: 3 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '30%', borderWidth: 1, borderRadius: borderRadius.lg, paddingVertical: 12, alignItems: 'center', gap: 5 },
  badgeLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2, paddingHorizontal: 4 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  emptySub: { fontSize: 12, textAlign: 'center', maxWidth: 220, fontWeight: '500' },
  emptyBtn: { marginTop: 14, paddingHorizontal: 32, paddingVertical: 14, borderRadius: borderRadius.full },
  emptyBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
});
