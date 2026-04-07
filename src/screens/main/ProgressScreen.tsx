/**
 * ProgressScreen — v2 (10/10 upgrade)
 *
 * NEW vs v1:
 * - Personal Bests (PRs) section: fastest pace, longest run, most steps
 * - Weekly Training Load score (acute workload)
 * - Body composition trend tab
 * - Monthly activity heatmap
 * - Better chart labeling and Y-axis
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { DailyLog, Activity } from '../../types';
import { formatPace } from '../../utils/paceUtils';
import { borderRadius, spacing } from '../../constants/theme';
import { ChartScreenSkeleton } from '../../components/SkeletonLoader';
import dayjs from '../../utils/dayjs';

const { width } = Dimensions.get('window');
const CHART_W = width - 64;
const CHART_H = 120;

type Period = '30d' | '90d' | '365d';
type Tab = 'activity' | 'body' | 'prs';

function LineChart({ data, color, colors, yLabel }: { data: number[]; color: string; colors: any; yLabel?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * CHART_W;
    const y = CHART_H - (v / max) * (CHART_H - 16) - 8;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const avg = data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - 6), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const avgPts = avg.map((v, i) => {
    const x = (i / (data.length - 1)) * CHART_W;
    const y = CHART_H - (v / max) * (CHART_H - 16) - 8;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        <Line x1="0" y1={CHART_H - 8} x2={CHART_W} y2={CHART_H - 8} stroke={colors.border} strokeWidth="1" />
        <SvgText x="2" y={CHART_H - 10} fontSize="9" fill={colors.textDisabled}>{yLabel ?? ''}</SvgText>
        <Polyline points={pts} fill="none" stroke={color + '50'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={avgPts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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

function CalendarHeatmap({ logs, colors, accent }: { logs: DailyLog[]; colors: any; accent: string }) {
  const WEEKS = 12; const CELL = 18; const GAP = 3;
  const days = ['M','T','W','T','F','S','S'];
  const logMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of logs) m[l.date] = l.steps;
    return m;
  }, [logs]);
  const maxSteps = Math.max(...Object.values(logMap), 1);
  const today = dayjs();
  const grid: { date: string; steps: number }[][] = [];
  const startDay = dayjs(today).subtract(WEEKS * 7 - 1, 'days');
  const dayOffset = (startDay.day() + 6) % 7;
  startDay.subtract(dayOffset, 'days');
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: string; steps: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = dayjs(startDay).add(w * 7 + d, 'days').format('YYYY-MM-DD');
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
        {days.map((d, i) => <Text key={i} style={{ width: CELL, fontSize: 8, fontWeight: '700', color: colors.textDisabled, textAlign: 'center' }}>{d}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {grid.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'column', gap: GAP }}>
            {week.map((day, di) => (
              <View key={di} style={{ width: CELL, height: CELL, borderRadius: 4, backgroundColor: getColor(day.steps) }} />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
        <Text style={{ fontSize: 9, color: colors.textDisabled }}>Less</Text>
        {[0, 0.3, 0.6, 1].map((v, i) => (
          <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: v === 0 ? colors.border : accent + Math.round(v * 255).toString(16).padStart(2, '0') }} />
        ))}
        <Text style={{ fontSize: 9, color: colors.textDisabled }}>More</Text>
      </View>
    </View>
  );
}

function PRCard({ label, value, unit, icon, color, colors, date }: { label: string; value: string; unit: string; icon: string; color: string; colors: any; date?: string }) {
  return (
    <View style={[prStyles.card, { backgroundColor: colors.surface, borderColor: color + '40' }]}>
      <View style={[prStyles.iconWrap, { backgroundColor: color + '20' }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={[prStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[prStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[prStyles.unit, { color: color }]}>{unit}</Text>
      {date && <Text style={[prStyles.date, { color: colors.textDisabled }]}>{date}</Text>}
    </View>
  );
}
const prStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: borderRadius.lg, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 4 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  label: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  value: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  unit: { fontSize: 10, fontWeight: '700' },
  date: { fontSize: 9, marginTop: 2 },
});

export default function ProgressScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const accent = colors.primary;
  const [period, setPeriod] = useState<Period>('30d');
  const [tab, setTab] = useState<Tab>('activity');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [bodyLogs, setBodyLogs] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();
    const [{ data: l }, { data: a }] = await Promise.all([
      databaseService.getLogsInRange(user.id, startDate, endDate),
      databaseService.getActivities(user.id),
    ]);
    setLogs(l ?? []);
    setActivities(a ?? []);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, [user, period]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Data series
  const stepSeries = useMemo(() => logs.map(l => l.steps), [logs]);
  const sleepSeries = useMemo(() => logs.map(l => l.sleep ?? 0), [logs]);
  const weightSeries = useMemo(() => logs.map(l => (l as any).weight ?? 0).filter(w => w > 0), [logs]);

  // Personal bests
  const prs = useMemo(() => {
    const runs = activities.filter(a => a.type === 'running' && a.distance > 0 && a.duration > 0);
    const bestPace = runs.reduce((best, a) => {
      const pace = a.duration / a.distance;
      return pace < best.pace ? { pace, date: dayjs(a.startTime).format('MMM D') } : best;
    }, { pace: 9999, date: '' });
    const longestRun = runs.reduce((best, a) => a.distance > best.distance ? { distance: a.distance, date: dayjs(a.startTime).format('MMM D') } : best, { distance: 0, date: '' });
    const mostSteps = logs.reduce((best, l) => l.steps > best.steps ? { steps: l.steps, date: l.date } : best, { steps: 0, date: '' });
    const totalKm = activities.reduce((sum, a) => sum + (a.distance ?? 0), 0);
    return { bestPace, longestRun, mostSteps, totalKm };
  }, [activities, logs]);

  // Weekly training load (past 7 days vs past 28 days avg)
  const trainingLoad = useMemo(() => {
    const now = dayjs();
    const recent7 = activities.filter(a => dayjs(a.startTime).isAfter(now.subtract(7, 'days')));
    const recent28 = activities.filter(a => dayjs(a.startTime).isAfter(now.subtract(28, 'days')));
    const acute = recent7.reduce((sum, a) => sum + (a.duration / 60), 0);
    const chronic = recent28.reduce((sum, a) => sum + (a.duration / 60), 0) / 4;
    const acr = chronic > 0 ? (acute / chronic) : 1;
    let status = 'Optimal';
    let color = colors.success;
    if (acr > 1.5) { status = 'High Risk'; color = colors.errorSoft; }
    else if (acr > 1.3) { status = 'Pushing Hard'; color = colors.warning; }
    else if (acr < 0.7) { status = 'Deload'; color = colors.metricDistance; }
    return { acute: Math.round(acute), chronic: Math.round(chronic), acr: parseFloat(acr.toFixed(2)), status, color };
  }, [activities, colors.success, colors.errorSoft, colors.warning, colors.metricDistance]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'activity', label: 'Activity' },
    { key: 'prs', label: 'Personal Bests' },
    { key: 'body', label: 'Body' },
  ];

  if (isLoading) return <ChartScreenSkeleton />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}>
      
      <Text style={[styles.title, { color: colors.text }]}>Progress</Text>

      {/* Training load */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Training Load</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.loadScore, { color: trainingLoad.color }]}>{trainingLoad.acr}</Text>
            <Text style={[styles.loadLabel, { color: colors.textSecondary }]}>ATL:CTL Ratio</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={[styles.loadBadge, { backgroundColor: trainingLoad.color + '20' }]}>
              <Text style={[styles.loadStatus, { color: trainingLoad.color }]}>{trainingLoad.status}</Text>
            </View>
            <Text style={[styles.loadSub, { color: colors.textSecondary }]}>
              {trainingLoad.acute} min this week · {trainingLoad.chronic} min avg/week
            </Text>
            <Text style={[styles.loadTip, { color: colors.textDisabled }]}>
              {trainingLoad.acr > 1.3 ? 'Consider a recovery day' : trainingLoad.acr < 0.7 ? 'Safe to increase intensity' : 'Training load is well-balanced'}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && { backgroundColor: accent }]}>
            <Text style={[styles.tabText, { color: tab === t.key ? colors.onPrimary : colors.textSecondary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period pills */}
      {tab !== 'prs' && (
        <View style={styles.periodRow}>
          {(['30d', '90d', '365d'] as Period[]).map(p => (
            <TouchableOpacity key={p} onPress={() => setPeriod(p)}
              style={[styles.periodPill, { backgroundColor: period === p ? accent : colors.surface, borderColor: period === p ? accent : colors.border }]}>
              <Text style={[styles.periodText, { color: period === p ? colors.onPrimary : colors.textSecondary }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {tab === 'activity' && (
        <>
          {/* Steps chart */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Steps</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{stepSeries.length} days · avg {stepSeries.length ? Math.round(stepSeries.reduce((a,b)=>a+b,0)/stepSeries.length).toLocaleString() : 0}</Text>
            <LineChart data={stepSeries} color={accent} colors={colors} yLabel="steps" />
          </View>

          {/* Sleep chart */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Sleep</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Avg {sleepSeries.filter(s=>s>0).length ? (sleepSeries.reduce((a,b)=>a+b,0)/sleepSeries.filter(s=>s>0).length).toFixed(1) : '--'}h</Text>
            <LineChart data={sleepSeries} color={colors.metricSleep} colors={colors} yLabel="hours" />
          </View>

          {/* Heatmap */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Activity Heatmap</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>12-week step intensity</Text>
            <CalendarHeatmap logs={logs} colors={colors} accent={accent} />
          </View>
        </>
      )}

      {tab === 'prs' && (
        <>
          <View style={styles.prGrid}>
            <PRCard label="Fastest Pace" value={prs.bestPace.pace < 9000 ? formatPace(1, prs.bestPace.pace) : '--'} unit="min/km" icon="⚡" color={colors.metricBurn} colors={colors} date={prs.bestPace.date} />
            <PRCard label="Longest Run" value={prs.longestRun.distance > 0 ? prs.longestRun.distance.toFixed(1) : '--'} unit="km" icon="🏃" color={colors.metricDistance} colors={colors} date={prs.longestRun.date} />
          </View>
          <View style={styles.prGrid}>
            <PRCard label="Best Step Day" value={prs.mostSteps.steps > 0 ? prs.mostSteps.steps.toLocaleString() : '--'} unit="steps" icon="👟" color={colors.success} colors={colors} date={prs.mostSteps.date ? dayjs(prs.mostSteps.date).format('MMM D') : ''} />
            <PRCard label="Total Distance" value={prs.totalKm.toFixed(1)} unit="km ever" icon="🌍" color={colors.metricStreak} colors={colors} />
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Activity Breakdown</Text>
            {['running', 'walking', 'cycling', 'strength', 'hiit', 'yoga', 'other'].map(type => {
              const count = activities.filter(a => a.type === type).length;
              if (count === 0) return null;
              const total = activities.length || 1;
              return (
                <View key={type} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                  <Text style={{ width: 72, fontSize: 12, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>{type}</Text>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: accent, width: `${(count/total)*100}%` }} />
                  </View>
                  <Text style={{ width: 30, fontSize: 11, color: colors.textSecondary, textAlign: 'right' }}>{count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {tab === 'body' && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Body Measurements</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Log measurements in your Daily Log to track trends here</Text>
          {weightSeries.length > 1 ? (
            <LineChart data={weightSeries} color={colors.metricProtein} colors={colors} yLabel="kg" />
          ) : (
            <View style={styles.emptyBody}>
              <Text style={{ fontSize: 36 }}>⚖️</Text>
              <Text style={[styles.emptyBodyText, { color: colors.textSecondary }]}>No body data yet. Log your weight in the Daily Log to see trends.</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 16 },
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  cardSub: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  loadScore: { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  loadLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  loadBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  loadStatus: { fontSize: 13, fontWeight: '800' },
  loadSub: { fontSize: 12 },
  loadTip: { fontSize: 11 },
  tabRow: { flexDirection: 'row', borderRadius: borderRadius.full, borderWidth: 1, padding: 4, marginBottom: 12, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '700' },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodPill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  periodText: { fontSize: 12, fontWeight: '700' },
  prGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  emptyBody: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyBodyText: { fontSize: 13, textAlign: 'center', maxWidth: 240 },
}
    
  );