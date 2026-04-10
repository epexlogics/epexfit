/**
 * ProgressScreen — Fixed
 *
 * Bugs fixed:
 * 1. getActivities ab period-based startDate/endDate ke saath call hoti hai
 * 2. CalendarHeatmap dayjs immutability bug fix — startDay properly assigned
 * 3. weightSeries — DailyLog mein weight nahi hai, so body tab real message dikhata hai
 * 4. bodyLogs state removed — koi use nahi tha
 * 5. Training Load aur PRs ab period-filtered activities pe based hain
 * 6. Period change par activities bhi refetch hoti hain
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { supabase } from '../../services/supabase';
import { DailyLog, Activity } from '../../types';
import { formatPace } from '../../utils/paceUtils';
import { useUnitSystem } from '../../utils/units';
import { borderRadius, spacing } from '../../constants/theme';
import { ChartScreenSkeleton } from '../../components/SkeletonLoader';
import dayjs from '../../utils/dayjs';

const { width } = Dimensions.get('window');
const CHART_W = width - 64;
const CHART_H = 120;

type Period = '30d' | '90d' | '365d';
type Tab = 'activity' | 'body' | 'prs';

// ─── Line Chart ───────────────────────────────────────────────────────────────

function LineChart({
  data,
  color,
  colors,
  yLabel,
}: {
  data: number[];
  color: string;
  colors: any;
  yLabel?: string;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * CHART_W;
      const y = CHART_H - (v / max) * (CHART_H - 16) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // 7-day rolling average
  const avg = data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - 6), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const avgPts = avg
    .map((v, i) => {
      const x = (i / (data.length - 1)) * CHART_W;
      const y = CHART_H - (v / max) * (CHART_H - 16) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        <Line
          x1="0"
          y1={CHART_H - 8}
          x2={CHART_W}
          y2={CHART_H - 8}
          stroke={colors.border}
          strokeWidth="1"
        />
        <SvgText x="2" y={CHART_H - 10} fontSize="9" fill={colors.textDisabled}>
          {yLabel ?? ''}
        </SvgText>
        <Polyline
          points={pts}
          fill="none"
          stroke={color + '50'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Polyline
          points={avgPts}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 9, color: colors.textDisabled }}>Raw</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 14, height: 2.5, borderRadius: 1, backgroundColor: color }} />
          <Text style={{ fontSize: 9, color: colors.textDisabled }}>7-day avg</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────

function CalendarHeatmap({
  logs,
  colors,
  accent,
}: {
  logs: DailyLog[];
  colors: any;
  accent: string;
}) {
  const WEEKS = 12;
  const CELL = 18;
  const GAP = 3;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const logMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of logs) m[l.date] = l.steps;
    return m;
  }, [logs]);

  const maxSteps = Math.max(...Object.values(logMap), 1);
  const today = dayjs();

  // FIX: dayjs is immutable — must assign the result of subtract()
  const rawStart = today.subtract(WEEKS * 7 - 1, 'days');
  const dayOffset = (rawStart.day() + 6) % 7; // Monday = 0
  const startDay = rawStart.subtract(dayOffset, 'days');

  const grid: { date: string; steps: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: string; steps: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = startDay.add(w * 7 + d, 'days').format('YYYY-MM-DD');
      week.push({ date, steps: logMap[date] ?? 0 });
    }
    grid.push(week);
  }

  const getColor = (steps: number) => {
    if (steps === 0) return colors.border;
    const intensity = Math.min(steps / maxSteps, 1);
    if (intensity < 0.25) return accent + '30';
    if (intensity < 0.5) return accent + '60';
    if (intensity < 0.75) return accent + 'A0';
    return accent;
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
        {days.map((d, i) => (
          <Text
            key={i}
            style={{
              width: CELL,
              fontSize: 8,
              fontWeight: '700',
              color: colors.textDisabled,
              textAlign: 'center',
            }}
          >
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {grid.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'column', gap: GAP }}>
            {week.map((day, di) => (
              <View
                key={di}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 4,
                  backgroundColor: getColor(day.steps),
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
        <Text style={{ fontSize: 9, color: colors.textDisabled }}>Less</Text>
        {[0, 0.3, 0.6, 1].map((v, i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor:
                v === 0
                  ? colors.border
                  : accent + Math.round(v * 255).toString(16).padStart(2, '0'),
            }}
          />
        ))}
        <Text style={{ fontSize: 9, color: colors.textDisabled }}>More</Text>
      </View>
    </View>
  );
}

// ─── PR Card ──────────────────────────────────────────────────────────────────

function PRCard({
  label,
  value,
  unit,
  icon,
  color,
  colors,
  date,
}: {
  label: string;
  value: string;
  unit: string;
  icon: string;
  color: string;
  colors: any;
  date?: string;
}) {
  return (
    <View style={[prStyles.card, { backgroundColor: colors.surface, borderColor: color + '40' }]}>
      <View style={[prStyles.iconWrap, { backgroundColor: color + '20' }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={[prStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[prStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[prStyles.unit, { color }]}>{unit}</Text>
      {date ? (
        <Text style={[prStyles.date, { color: colors.textDisabled }]}>{date}</Text>
      ) : null}
    </View>
  );
}

const prStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  value: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  unit: { fontSize: 10, fontWeight: '700' },
  date: { fontSize: 9, marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'prs', label: 'Personal Bests' },
  { key: 'body', label: 'Body' },
];

export default function ProgressScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const unitSystem = useUnitSystem();
  const accent = colors.primary;

  const [period, setPeriod] = useState<Period>('30d');
  const [tab, setTab] = useState<Tab>('activity');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [bodyStats, setBodyStats] = useState<{ date: string; weight: number }[]>([]);
  const [bodyLoading, setBodyLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const [{ data: l }, { data: a }] = await Promise.all([
      databaseService.getLogsInRange(user.id, startDate, endDate),
      databaseService.getActivities(user.id, startDate, endDate),
    ]);

    setLogs(l ?? []);
    setActivities(a ?? []);
    setIsLoading(false);
  }, [user, period]);

  // Body stats — fetched separately when body tab is active
  const loadBodyStats = useCallback(async () => {
    if (!user) return;
    setBodyLoading(true);
    const { data: bs } = await supabase
      .from('body_stats')
      .select('date, weight')
      .eq('user_id', user.id)
      .not('weight', 'is', null)
      .order('date', { ascending: true })
      .limit(60);
    setBodyStats((bs ?? []).filter((r: any) => r.weight != null));
    setBodyLoading(false);
  }, [user]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'body') loadBodyStats();
  }, [tab, loadBodyStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    if (tab === 'body') await loadBodyStats();
    setRefreshing(false);
  };

  // ── Chart series (from real DailyLog data) ────────────────────────────────
  const stepSeries = useMemo(() => logs.map(l => l.steps), [logs]);
  const sleepSeries = useMemo(() => logs.map(l => l.sleep ?? 0), [logs]);

  const hasWeightData = bodyStats.length > 0;
  const latestWeight = hasWeightData ? bodyStats[bodyStats.length - 1].weight : null;
  const firstWeight  = hasWeightData ? bodyStats[0].weight : null;
  const weightChange = (latestWeight != null && firstWeight != null)
    ? parseFloat((latestWeight - firstWeight).toFixed(1))
    : null;

  // ── Personal Bests (period-filtered activities se) ────────────────────────
  const prs = useMemo(() => {
    const runs = activities.filter(
      a => a.type === 'running' && a.distance > 0 && a.duration > 0
    );

    const bestPace = runs.reduce(
      (best, a) => {
        const pace = a.duration / a.distance;
        return pace < best.pace ? { pace, date: dayjs(a.startTime).format('MMM D') } : best;
      },
      { pace: 9999, date: '' }
    );

    const longestRun = runs.reduce(
      (best, a) =>
        a.distance > best.distance
          ? { distance: a.distance, date: dayjs(a.startTime).format('MMM D') }
          : best,
      { distance: 0, date: '' }
    );

    const mostSteps = logs.reduce(
      (best, l) => (l.steps > best.steps ? { steps: l.steps, date: l.date } : best),
      { steps: 0, date: '' }
    );

    const totalKm = activities.reduce((sum, a) => sum + (a.distance ?? 0), 0);

    return { bestPace, longestRun, mostSteps, totalKm };
  }, [activities, logs]);

  // ── Weekly Training Load (ATL:CTL ratio — period-filtered) ───────────────
  const trainingLoad = useMemo(() => {
    const now = dayjs();

    // Acute: last 7 days within fetched activities
    const recent7 = activities.filter(a =>
      dayjs(a.startTime).isAfter(now.subtract(7, 'days'))
    );
    // Chronic: last 28 days (use full set if period >= 90d, else best effort)
    const recent28 = activities.filter(a =>
      dayjs(a.startTime).isAfter(now.subtract(28, 'days'))
    );

    const acute = recent7.reduce((sum, a) => sum + a.duration / 60, 0);
    const chronic = recent28.length > 0
      ? recent28.reduce((sum, a) => sum + a.duration / 60, 0) / 4
      : 0;

    const acr = chronic > 0 ? acute / chronic : 1;

    let status = 'Optimal';
    let color = colors.success;
    if (acr > 1.5) { status = 'High Risk'; color = colors.errorSoft; }
    else if (acr > 1.3) { status = 'Pushing Hard'; color = colors.warning; }
    else if (acr < 0.7) { status = 'Deload'; color = colors.metricDistance; }

    return {
      acute: Math.round(acute),
      chronic: Math.round(chronic),
      acr: parseFloat(acr.toFixed(2)),
      status,
      color,
    };
  }, [activities, colors]);

  // ── Stats for activity tab ────────────────────────────────────────────────
  const stepAvg = useMemo(() => {
    if (!stepSeries.length) return 0;
    return Math.round(stepSeries.reduce((a, b) => a + b, 0) / stepSeries.length);
  }, [stepSeries]);

  const sleepAvg = useMemo(() => {
    const valid = sleepSeries.filter(s => s > 0);
    if (!valid.length) return null;
    return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
  }, [sleepSeries]);

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) return <ChartScreenSkeleton />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
            colors={[accent]}
          />
        }
      >
        <Text style={[styles.title, { color: colors.text }]}>Progress</Text>

        {/* ── Weekly Training Load Card ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Training Load</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.loadScore, { color: trainingLoad.color }]}>
                {trainingLoad.acr}
              </Text>
              <Text style={[styles.loadLabel, { color: colors.textSecondary }]}>
                ATL:CTL Ratio
              </Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={[styles.loadBadge, { backgroundColor: trainingLoad.color + '20' }]}>
                <Text style={[styles.loadStatus, { color: trainingLoad.color }]}>
                  {trainingLoad.status}
                </Text>
              </View>
              <Text style={[styles.loadSub, { color: colors.textSecondary }]}>
                {trainingLoad.acute} min this week · {trainingLoad.chronic} min avg/week
              </Text>
              <Text style={[styles.loadTip, { color: colors.textDisabled }]}>
                {trainingLoad.acr > 1.3
                  ? 'Consider a recovery day'
                  : trainingLoad.acr < 0.7
                  ? 'Safe to increase intensity'
                  : 'Training load is well-balanced'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Tabs ── */}
        <View
          style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && { backgroundColor: accent }]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t.key ? colors.onPrimary : colors.textSecondary },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Period Pills (activity + prs tabs) ── */}
        {tab !== 'body' && (
          <View style={styles.periodRow}>
            {(['30d', '90d', '365d'] as Period[]).map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={[
                  styles.periodPill,
                  {
                    backgroundColor: period === p ? accent : colors.surface,
                    borderColor: period === p ? accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    { color: period === p ? colors.onPrimary : colors.textSecondary },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══════════ ACTIVITY TAB ══════════ */}
        {tab === 'activity' && (
          <>
            {/* Steps chart */}
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Steps</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                {stepSeries.length} days · avg {stepAvg.toLocaleString()}
              </Text>
              {stepSeries.length >= 2 ? (
                <LineChart data={stepSeries} color={accent} colors={colors} yLabel="steps" />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 28 }}>👟</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No step data for this period
                  </Text>
                </View>
              )}
            </View>

            {/* Sleep chart */}
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>Sleep</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                {sleepAvg !== null ? `Avg ${sleepAvg}h` : 'No sleep logged'}
              </Text>
              {sleepSeries.filter(s => s > 0).length >= 2 ? (
                <LineChart
                  data={sleepSeries}
                  color={colors.metricSleep}
                  colors={colors}
                  yLabel="hours"
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 28 }}>🌙</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Log sleep in Daily Log to see trends
                  </Text>
                </View>
              )}
            </View>

            {/* Activity heatmap */}
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>Activity Heatmap</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                12-week step intensity
              </Text>
              <CalendarHeatmap logs={logs} colors={colors} accent={accent} />
            </View>
          </>
        )}

        {/* ══════════ PERSONAL BESTS TAB ══════════ */}
        {tab === 'prs' && (
          <>
            <View style={styles.prGrid}>
              <PRCard
                label="Fastest Pace"
                value={
                  prs.bestPace.pace < 9000 ? formatPace(1, prs.bestPace.pace) : '--'
                }
                unit="min/km"
                icon="⚡"
                color={colors.metricBurn}
                colors={colors}
                date={prs.bestPace.date || undefined}
              />
              <PRCard
                label="Longest Run"
                value={prs.longestRun.distance > 0 ? prs.longestRun.distance.toFixed(1) : '--'}
                unit="km"
                icon="🏃"
                color={colors.metricDistance}
                colors={colors}
                date={prs.longestRun.date || undefined}
              />
            </View>

            <View style={styles.prGrid}>
              <PRCard
                label="Best Step Day"
                value={prs.mostSteps.steps > 0 ? prs.mostSteps.steps.toLocaleString() : '--'}
                unit="steps"
                icon="👟"
                color={colors.success}
                colors={colors}
                date={
                  prs.mostSteps.date ? dayjs(prs.mostSteps.date).format('MMM D') : undefined
                }
              />
              <PRCard
                label="Total Distance"
                value={prs.totalKm.toFixed(1)}
                unit="km this period"
                icon="🌍"
                color={colors.metricStreak}
                colors={colors}
              />
            </View>

            {/* Activity breakdown */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>Activity Breakdown</Text>
              {activities.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 28 }}>📊</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No activities in this period
                  </Text>
                </View>
              ) : (
                (
                  [
                    'running',
                    'walking',
                    'cycling',
                    'strength',
                    'hiit',
                    'yoga',
                    'swimming',
                    'football',
                    'other',
                  ] as Activity['type'][]
                ).map(type => {
                  const count = activities.filter(a => a.type === type).length;
                  if (count === 0) return null;
                  const total = activities.length;
                  return (
                    <View
                      key={type}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 8,
                        gap: 10,
                      }}
                    >
                      <Text
                        style={{
                          width: 72,
                          fontSize: 12,
                          fontWeight: '600',
                          color: colors.text,
                          textTransform: 'capitalize',
                        }}
                      >
                        {type}
                      </Text>
                      <View
                        style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.border,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: accent,
                            width: `${(count / total) * 100}%`,
                          }}
                        />
                      </View>
                      <Text
                        style={{
                          width: 30,
                          fontSize: 11,
                          color: colors.textSecondary,
                          textAlign: 'right',
                        }}
                      >
                        {count}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ══════════ BODY TAB ══════════ */}
        {tab === 'body' && (
          <>
            {bodyLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color={accent} />
              </View>
            ) : !hasWeightData ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.emptyBody}>
                  <Text style={{ fontSize: 36 }}>⚖️</Text>
                  <Text style={[styles.emptyBodyText, { color: colors.textSecondary }]}>
                    No weight data yet. Log your first measurement to see trends.
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('BodyMeasurements')}
                    style={[styles.ctaButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '60' }]}
                  >
                    <Text style={[styles.ctaButtonText, { color: colors.primary }]}>Log Body Measurements →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Weight Trend</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                  <View style={{ flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: accent + '12' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: accent }}>
                      {unitSystem === 'imperial'
                        ? `${(latestWeight! * 2.20462).toFixed(1)} lbs`
                        : `${latestWeight} kg`}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Current
                    </Text>
                  </View>
                  {weightChange !== null && (
                    <View style={{ flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: (weightChange <= 0 ? '#4ADE80' : '#FB7185') + '15' }}>
                      <Text style={{ fontSize: 22, fontWeight: '900', color: weightChange <= 0 ? '#4ADE80' : '#FB7185' }}>
                        {weightChange > 0 ? '+' : ''}
                        {unitSystem === 'imperial'
                          ? `${(weightChange * 2.20462).toFixed(1)} lbs`
                          : `${weightChange} kg`}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Change
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: colors.surfaceElevated }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>
                      {bodyStats.length}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Logs
                    </Text>
                  </View>
                </View>

                {bodyStats.length >= 2 ? (
                  <View style={{ marginTop: 16 }}>
                    <LineChart
                      data={unitSystem === 'imperial'
                        ? bodyStats.map(b => parseFloat((b.weight * 2.20462).toFixed(1)))
                        : bodyStats.map(b => b.weight)}
                      color={accent}
                      colors={colors}
                      yLabel={unitSystem === 'imperial' ? 'lbs' : 'kg'}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ fontSize: 10, color: colors.textDisabled }}>
                        {dayjs(bodyStats[0].date).format('MMM D')}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textDisabled }}>
                        {dayjs(bodyStats[bodyStats.length - 1].date).format('MMM D')}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 16, padding: 14, borderRadius: 10, backgroundColor: accent + '10', borderWidth: 1, borderColor: accent + '30' }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                      Log one more measurement to see your weight trend chart.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => navigation.navigate('BodyMeasurements')}
                  style={[styles.ctaButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '60', marginTop: 12 }]}
                >
                  <Text style={[styles.ctaButtonText, { color: colors.primary }]}>Add Measurement →</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 16 },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  cardSub: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  loadScore: { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  loadLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  loadBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  loadStatus: { fontSize: 13, fontWeight: '800' },
  loadSub: { fontSize: 12 },
  loadTip: { fontSize: 11 },
  tabRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '700' },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodPill: { flex: 1, paddingVertical: 9, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  periodText: { fontSize: 13, fontWeight: '700' },
  prGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  emptyBody: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyBodyText: { fontSize: 13, textAlign: 'center', maxWidth: 260 },
  ctaButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  ctaButtonText: { fontSize: 14, fontWeight: '700' },
});
