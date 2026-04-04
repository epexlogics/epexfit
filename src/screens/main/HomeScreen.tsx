import React, { useEffect, useState, useRef } from 'react';
import {
  Animated, View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Dimensions, StatusBar, Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { databaseService } from '../../services/database';
import { recalculateStreak, syncBadges, getUnlockedBadgeIds } from '../../services/streaks';
import { calculateAPS } from '../../utils/performanceScore';
import { generateInsight, getDailyChallenge, isChallengeComplete } from '../../utils/insights';
import { DailyLog, Activity, Goal } from '../../types';
import { BADGE_DEFINITIONS, BadgeDefinition } from '../../constants/badges';
import AppIcon from '../../components/AppIcon';
import BadgeUnlockModal from '../../components/BadgeUnlockModal';
import WeeklySnapshotModal, { shouldShowWeeklySnapshot, markSnapshotShown } from '../../components/WeeklySnapshotModal';
import { spacing, borderRadius } from '../../constants/theme';
import moment from 'moment';

const { width } = Dimensions.get('window');

const DEFAULT_STEP_GOAL = 10000;
const DEFAULT_DIST_GOAL = 5;
const DEFAULT_CAL_GOAL = 500;

// ── SVG Arc Progress Ring ────────────────────────────────────────────────
function ArcProgress({ progress, size = 120, strokeWidth = 10, color, children }: {
  progress: number; size?: number; strokeWidth?: number; color: string; children?: React.ReactNode;
}) {
  const p = Math.min(Math.max(progress, 0), 1);
  const r = (size - strokeWidth) / 2;
  const cx = size / 2; const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - p);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />
        <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
      </Svg>
      {children}
    </View>
  );
}

function StatTile({ icon, value, label, color, progress, colors }: {
  icon: string; value: string; label: string; color: string; progress: number; colors: any;
}) {
  return (
    <View style={[tileStyles.wrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={[tileStyles.iconRow, { backgroundColor: color + '18' }]}><AppIcon name={icon} size={16} color={color} /></View>
      <Text style={[tileStyles.val, { color: colors.text }]}>{value}</Text>
      <Text style={[tileStyles.lbl, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[tileStyles.track, { backgroundColor: color + '22' }]}>
        <View style={[tileStyles.fill, { backgroundColor: color, width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>
    </View>
  );
}
const tileStyles = StyleSheet.create({
  wrap: { flex: 1, padding: 14, borderRadius: borderRadius.lg, borderWidth: 1, gap: 6 },
  iconRow: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  val: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  lbl: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  track: { height: 3, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
});

function WeekBar({ values, color, colors }: { values: number[]; color: string; colors: any }) {
  const days = ['M','T','W','T','F','S','S'];
  const max = Math.max(...values, 1);
  const todayIdx = (new Date().getDay() + 6) % 7;
  return (
    <View style={barStyles.row}>
      {values.map((v, i) => {
        const h = Math.max((v / max) * 52, 3);
        const isToday = i === todayIdx;
        return (
          <View key={i} style={barStyles.col}>
            <View style={barStyles.barWrap}>
              <View style={[barStyles.bar, {
                height: h, borderRadius: 6,
                backgroundColor: isToday ? color : v > 0 ? color + '45' : color + '15',
                ...(isToday ? { shadowColor: color, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 } : {}),
              }]} />
            </View>
            <Text style={[barStyles.day, { color: isToday ? color : colors.textDisabled, fontWeight: isToday ? '800' : '500' }]}>{days[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}
const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  col: { flex: 1, alignItems: 'center', gap: 5 },
  barWrap: { height: 56, justifyContent: 'flex-end' },
  bar: { width: '100%' },
  day: { fontSize: 10 },
});

function ActivityRow({ activity, colors, isLast, onPress }: {
  activity: Activity; colors: any; isLast: boolean; onPress: () => void;
}) {
  const meta: Record<string,{ icon: string; color: string; label: string }> = {
    running:  { icon: 'run',       color: '#FF5B5B', label: 'Running'  },
    cycling:  { icon: 'bike',      color: '#4D9FFF', label: 'Cycling'  },
    walking:  { icon: 'walk',      color: '#6C8EFF', label: 'Walking'  },
    swimming: { icon: 'swim',      color: '#00BCD4', label: 'Swimming' },
    strength: { icon: 'weight',    color: '#FF9500', label: 'Strength' },
    hiit:     { icon: 'fire',      color: '#FF5B5B', label: 'HIIT'     },
    yoga:     { icon: 'meditation',color: '#C084FC', label: 'Yoga'     },
  };
  const m = meta[activity.type] ?? meta.walking;
  const mins = Math.floor(activity.duration / 60);
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}
      style={[actStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <View style={[actStyles.iconWrap, { backgroundColor: m.color + '15' }]}><AppIcon name={m.icon} size={18} color={m.color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[actStyles.type, { color: colors.text }]}>{m.label}</Text>
        <Text style={[actStyles.time, { color: colors.textSecondary }]}>{moment(activity.startTime).format('MMM D · h:mm A')}</Text>
      </View>
      <View style={actStyles.statsWrap}><Text style={[actStyles.statVal, { color: colors.text }]}>{activity.steps.toLocaleString()}</Text><Text style={[actStyles.statLbl, { color: colors.textSecondary }]}>steps</Text></View>
      <View style={actStyles.statsWrap}><Text style={[actStyles.statVal, { color: colors.text }]}>{activity.distance.toFixed(1)}</Text><Text style={[actStyles.statLbl, { color: colors.textSecondary }]}>km</Text></View>
      <View style={actStyles.statsWrap}><Text style={[actStyles.statVal, { color: colors.text }]}>{mins}m</Text><Text style={[actStyles.statLbl, { color: colors.textSecondary }]}>time</Text></View>
    </TouchableOpacity>
  );
}
const actStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  type: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  time: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  statsWrap: { alignItems: 'center', minWidth: 36 },
  statVal: { fontSize: 13, fontWeight: '700', letterSpacing: -0.3 },
  statLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { steps, distance, calories } = useTracking();
  const { sendSmartNotifications, notifyBadgeUnlocked } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState({ totalSteps: 0, totalDistance: 0, totalCalories: 0 });
  const [weeklySteps, setWeeklySteps] = useState<number[]>([0,0,0,0,0,0,0]);
  const [streak, setStreak] = useState(0);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<string[]>([]);
  const [apsResult, setApsResult] = useState({ total: 0, label: 'Building', color: '#C084FC' });
  const [stepGoal, setStepGoal] = useState(DEFAULT_STEP_GOAL);
  const [distGoal, setDistGoal] = useState(DEFAULT_DIST_GOAL);
  const [calGoal, setCalGoal] = useState(DEFAULT_CAL_GOAL);

  // Badge unlock celebration
  const [celebBadge, setCelebBadge] = useState<BadgeDefinition | null>(null);
  // Weekly snapshot
  const [snapshotData, setSnapshotData] = useState<any>(null);

  // Insight & challenge
  const [insight, setInsight] = useState<{ text: string; icon: string } | null>(null);
  const [challenge, setChallenge] = useState(getDailyChallenge());
  const [challengeDone, setChallengeDone] = useState(false);

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
    const now = new Date();
    const diffToMonday = (now.getDay() + 6) % 7;
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - diffToMonday);

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

    let sGoal = DEFAULT_STEP_GOAL, cGoal = DEFAULT_CAL_GOAL, dGoal = DEFAULT_DIST_GOAL;
    if (goals?.length) {
      const sg = goals.find((g: Goal) => g.type === 'steps');
      const cg = goals.find((g: Goal) => g.type === 'calories');
      const rg = goals.find((g: Goal) => g.type === 'running');
      if (sg) { setStepGoal(sg.target); sGoal = sg.target; }
      if (cg) { setCalGoal(cg.target); cGoal = cg.target; }
      if (rg) { setDistGoal(rg.target); dGoal = rg.target; }
    }

    const todaySteps = log?.steps ?? steps ?? 0;
    const todayDist  = log?.distance ?? distance ?? 0;
    const todayCal   = log?.calories ?? calories ?? 0;

    const aps = calculateAPS({
      plannedWorkouts: 5, completedWorkouts: activities?.length ?? 0,
      stepGoal: sGoal, stepsToday: todaySteps,
      calGoal: cGoal, calBurned: todayCal,
      proteinGoal: 120, proteinActual: log?.protein ?? 0,
      waterGoal: 8, waterActual: log?.water ?? 0,
      sleepHours: log?.sleep ?? 0, mood: log?.mood ?? 3,
    });
    setApsResult(aps);

    // Sync goals from real data
    await databaseService.syncGoalProgress(user.id);

    // Badge sync — show celebration for newly unlocked
    const newBadges = await syncBadges(user.id);
    if (newBadges.length > 0) {
      setCelebBadge(newBadges[0]);
      await notifyBadgeUnlocked(newBadges[0].label, newBadges[0].icon);
    }

    // Daily insight
    const i = generateInsight({
      avgSleepHours: log?.sleep ?? 0,
      weeklyStepsChange: stats.totalSteps > 0 ? 5 : 0,
      currentStreak,
      bestDaySteps: Math.max(...realWeeklySteps),
    });
    setInsight(i);

    // Challenge completion check
    const ch = getDailyChallenge();
    setChallengeDone(isChallengeComplete(ch, {
      steps: todaySteps,
      water: log?.water ?? 0,
      sleep: log?.sleep ?? 0,
    }));

    // Weekly snapshot check (Monday morning)
    if (await shouldShowWeeklySnapshot()) {
      setSnapshotData({
        totalSteps: stats.totalSteps,
        totalDistKm: stats.totalDistance,
        totalCalories: stats.totalCalories,
        activeDays: realWeeklySteps.filter(s => s > 0).length,
        streak: currentStreak,
        bestDaySteps: Math.max(...realWeeklySteps),
        bestDayDate: '',
        apsScore: aps.total,
      });
    }

    await sendSmartNotifications({
      stepsToday: todaySteps, stepGoal: sGoal,
      streak: currentStreak, distanceToday: todayDist, distanceGoal: dGoal,
      waterToday: log?.water ?? 0, waterGoal: 8,
    });
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning'; if (h < 18) return 'Good afternoon'; return 'Good evening';
  };

  const todaySteps = todayLog?.steps ?? steps ?? 0;
  const todayDist  = todayLog?.distance ?? distance ?? 0;
  const todayCal   = todayLog?.calories ?? calories ?? 0;
  const overallPct = Math.min(((todaySteps/stepGoal)+(todayDist/distGoal)+(todayCal/calGoal))/3, 1);
  const consistencyPct = Math.min((weeklyStats.totalSteps/(stepGoal*7))*100, 100);
  const accentColor = colors.primary;
  const displayBadges = BADGE_DEFINITIONS.slice(0, 6).map(b => ({ ...b, unlocked: unlockedBadgeIds.includes(b.id) }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Badge unlock celebration */}
      <BadgeUnlockModal badge={celebBadge} onDismiss={() => setCelebBadge(null)} />

      {/* Monday weekly snapshot */}
      <WeeklySnapshotModal
        data={snapshotData}
        onDismiss={() => { setSnapshotData(null); markSnapshotShown(); }}
      />

      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeIn, transform: [{ translateY: slideUp }] }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} colors={[accentColor]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()}</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.fullName?.split(' ')[0] || 'Athlete'} 👋</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {streak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: '#FF6B0020', borderColor: '#FF6B0050' }]}>
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text style={[styles.streakNum, { color: '#FF9500' }]}>{streak}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}
              style={[styles.avatarBtn, { backgroundColor: accentColor + '18', borderColor: accentColor + '60' }]}>
              <Text style={[styles.avatarText, { color: accentColor }]}>{user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Daily Insight */}
        {insight && (
          <View style={[styles.insightCard, { backgroundColor: colors.surfaceElevated, borderColor: accentColor + '30', borderLeftColor: accentColor }]}>
            <Text style={{ fontSize: 18 }}>{insight.icon}</Text>
            <Text style={[styles.insightText, { color: colors.text }]}>{insight.text}</Text>
          </View>
        )}

        {/* Daily Challenge */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.challengeCard, {
            backgroundColor: challengeDone ? '#00C85312' : colors.surfaceElevated,
            borderColor: challengeDone ? '#00C85350' : colors.border,
          }]}
          onPress={() => setChallengeDone(true)}
        >
          <Text style={{ fontSize: 22 }}>{challenge.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.challengeLabel, { color: colors.textSecondary }]}>TODAY'S CHALLENGE</Text>
            <Text style={[styles.challengeText, { color: challengeDone ? '#00C853' : colors.text }]}>{challenge.text}</Text>
          </View>
          <View style={[styles.challengeCheck, { backgroundColor: challengeDone ? '#00C853' : colors.border }]}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{challengeDone ? '✓' : '○'}</Text>
          </View>
        </TouchableOpacity>

        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>DAILY PROGRESS</Text>
              <Text style={[styles.heroDate, { color: colors.textDisabled }]}>{moment().format('dddd, MMM D')}</Text>
              <View style={[styles.apsChip, { backgroundColor: apsResult.color + '18' }]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: apsResult.color, letterSpacing: 0.5 }}>
                  APS {apsResult.total} · {apsResult.label}
                </Text>
              </View>
            </View>
            <ArcProgress progress={overallPct} size={80} strokeWidth={7} color={accentColor}>
              <Text style={[styles.heroPercent, { color: accentColor }]}>{Math.round(overallPct * 100)}%</Text>
            </ArcProgress>
          </View>
          <View style={styles.heroStats}>
            {[
              { icon: 'shoe-print', val: todaySteps.toLocaleString(), unit: '', lbl: 'Steps',    cur: todaySteps, goal: stepGoal, color: accentColor },
              { icon: 'map-marker-distance', val: todayDist.toFixed(1), unit: 'km', lbl: 'Distance', cur: todayDist, goal: distGoal, color: '#4D9FFF' },
              { icon: 'fire', val: String(todayCal), unit: 'kcal', lbl: 'Burned', cur: todayCal, goal: calGoal, color: '#FF5B5B' },
            ].map((s) => (
              <View key={s.lbl} style={{ flex: 1, alignItems: 'center' }}>
                <View style={[styles.heroStatDot, { backgroundColor: s.color + '20' }]}><AppIcon name={s.icon} size={14} color={s.color} /></View>
                <Text style={[styles.heroStatBig, { color: colors.text }]}>{s.val}<Text style={{ fontSize: 11, color: colors.textSecondary }}>{s.unit}</Text></Text>
                <Text style={[styles.heroStatLbl, { color: colors.textSecondary }]}>{s.lbl}</Text>
                <View style={[styles.heroTrack, { backgroundColor: s.color + '20' }]}>
                  <View style={[styles.heroFill, { backgroundColor: s.color, width: `${Math.min((s.cur/s.goal)*100, 100)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>QUICK ACTIONS</Text>
        <View style={styles.qaRow}>
          {[
            { icon: 'run',       label: 'Activity', sub: 'Start tracking', color: accentColor, screen: 'Activity' },
            { icon: 'food-apple',label: 'Food Log', sub: 'Log meals',      color: '#FF9500',   screen: 'FoodLog'  },
            { icon: 'chart-bar', label: 'Progress', sub: 'View trends',    color: '#4D9FFF',   screen: 'Progress' },
          ].map((item) => (
            <TouchableOpacity key={item.label} onPress={() => navigation.navigate(item.screen)} activeOpacity={0.75}
              style={[styles.qaCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={[styles.qaIconWrap, { backgroundColor: item.color + '15' }]}><AppIcon name={item.icon} size={22} color={item.color} /></View>
              <Text style={[styles.qaLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.qaSub, { color: colors.textSecondary }]}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weekly Activity */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Activity</Text>
            <Text style={[styles.cardBadge, { backgroundColor: accentColor + '20', color: accentColor }]}>Real data</Text>
          </View>
          <WeekBar values={weeklySteps} color={accentColor} colors={colors} />
          <View style={[styles.weekDivider, { borderTopColor: colors.divider }]}>
            {[
              { val: weeklyStats.totalSteps.toLocaleString(), lbl: 'Steps'    },
              { val: `${weeklyStats.totalDistance.toFixed(1)} km`, lbl: 'Distance' },
              { val: weeklyStats.totalCalories.toLocaleString(), lbl: 'Calories'  },
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
        <TouchableOpacity onPress={() => navigation.navigate('Goals')} style={styles.goalsLink}>
          <Text style={[styles.goalsLinkText, { color: accentColor }]}>View goals →</Text>
        </TouchableOpacity>
        <View style={styles.tilesRow}>
          <StatTile icon="water"      value={`${todayLog?.water??0}`}    label="Water"   color="#4D9FFF" progress={(todayLog?.water??0)/8}    colors={colors} />
          <StatTile icon="food-steak" value={`${todayLog?.protein??0}g`} label="Protein" color="#C084FC" progress={(todayLog?.protein??0)/120} colors={colors} />
          <StatTile icon="sleep"      value={`${todayLog?.sleep??0}h`}   label="Sleep"   color="#00F5C4" progress={(todayLog?.sleep??0)/8}    colors={colors} />
        </View>

        {/* Streak Card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Activity Streak</Text>
            <Text style={{ fontSize: 22 }}>🔥</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: '#FF9500', letterSpacing: -2 }}>{streak}</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>days</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {streak === 0 ? 'Start your streak today!' : streak >= 7 ? `${streak} days strong! 🏆` : `${7 - streak} more days to 7-day badge`}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {streak === 0 ? 'Log an activity to begin.' : 'Consistency builds champions.'}
              </Text>
              <View style={[styles.bigTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.bigFill, { backgroundColor: '#FF9500', width: `${Math.min((streak/30)*100, 100)}%` }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Consistency */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Consistency</Text>
            <Text style={[styles.cardBadge, { backgroundColor: accentColor + '20', color: accentColor }]}>{Math.round(consistencyPct)}%</Text>
          </View>
          <Text style={[styles.reportSub, { color: colors.textSecondary }]}>
            {recentActivities.length} sessions · {consistencyPct >= 80 ? 'Crushing it 🔥' : 'Keep pushing 💪'}
          </Text>
          <View style={[styles.bigTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.bigFill, { backgroundColor: accentColor, width: `${consistencyPct}%` }]} />
          </View>
        </View>

        {/* Achievements */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Achievements</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: accentColor }}>{unlockedBadgeIds.length}/{BADGE_DEFINITIONS.length}</Text>
          </View>
          <View style={styles.badgesGrid}>
            {displayBadges.map((badge) => (
              <View key={badge.id} style={[styles.badge, {
                backgroundColor: badge.unlocked ? badge.color + '15' : colors.surface,
                borderColor: badge.unlocked ? badge.color + '60' : colors.border,
              }]}>
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
                <Text style={[styles.seeAll, { color: accentColor }]}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentActivities.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>🏃</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No activities yet</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Start your first workout to track progress</Text>
              <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: accentColor }]} onPress={() => navigation.navigate('Activity')} activeOpacity={0.85}>
                <Text style={[styles.emptyBtnText, { color: '#000000' }]}>Start Activity</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentActivities.map((a, i) => (
              <ActivityRow key={a.id} activity={a} colors={colors} isLast={i===recentActivities.length-1} onPress={() => navigation.navigate('PhotoLog', { activity: a })} />
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, paddingTop: Platform.OS === 'ios' ? 64 : 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  userName: { fontSize: 26, fontWeight: '900', letterSpacing: -0.8 },
  avatarBtn: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  avatarText: { fontSize: 19, fontWeight: '900' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  streakNum: { fontSize: 15, fontWeight: '900', letterSpacing: -0.5 },
  // AI Insight
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderLeftWidth: 3, marginBottom: 10 },
  insightText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19 },
  // Daily Challenge
  challengeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: spacing.lg },
  challengeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 },
  challengeText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  challengeCheck: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // Hero
  heroCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.xl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  heroLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  heroDate: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  heroPercent: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  apsChip: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  heroStats: { flexDirection: 'row', gap: 4 },
  heroStatDot: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroStatBig: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  heroStatLbl: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  heroTrack: { height: 3, borderRadius: 2, marginTop: 8, width: '90%', overflow: 'hidden' },
  heroFill: { height: 3, borderRadius: 2 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
  qaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  qaCard: { flex: 1, padding: 14, borderRadius: borderRadius.lg, borderWidth: 1, gap: 8 },
  qaIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 12, fontWeight: '800', letterSpacing: -0.2 },
  qaSub: { fontSize: 10, fontWeight: '500' },
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  cardBadge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  seeAll: { fontSize: 12, fontWeight: '700' },
  weekDivider: { flexDirection: 'row', borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md },
  weekStatItem: { flex: 1, alignItems: 'center' },
  weekStatVal: { fontSize: 14, fontWeight: '800', letterSpacing: -0.4 },
  weekStatLbl: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
  goalsLink: { position: 'absolute', right: spacing.md, marginTop: -24 },
  goalsLinkText: { fontSize: 11, fontWeight: '700' },
  tilesRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  reportSub: { fontSize: 12, fontWeight: '500', marginBottom: 12 },
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
