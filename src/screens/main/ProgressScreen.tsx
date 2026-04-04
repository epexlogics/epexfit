/**
 * ProgressScreen
 * Historical trend charts: 30 / 90 / 365 day views
 * Calendar heatmap (12-week GitHub-style)
 * Weekly progress snapshot
 * Personal bests summary
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl, Platform,
} from 'react-native';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { DailyLog, Activity } from '../../types';
import { formatPace } from '../../utils/paceUtils';
import { borderRadius, spacing } from '../../constants/theme';
import moment from 'moment';

const { width } = Dimensions.get('window');
const CHART_W = width - 64;
const CHART_H = 120;

type Period = '30d' | '90d' | '365d';

// ── Mini Line Chart ───────────────────────────────────────────────────────
function LineChart({ data, color, colors }: { data: number[]; color: string; colors: any }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * CHART_W;
    const y = CHART_H - (v / max) * (CHART_H - 16) - 8;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Rolling 7-day average
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
    <Svg width={CHART_W} height={CHART_H}>
      {/* Zero line */}
      <Line x1="0" y1={CHART_H - 8} x2={CHART_W} y2={CHART_H - 8} stroke={colors.border} strokeWidth="1" />
      {/* Data line */}
      <Polyline points={pts} fill="none" stroke={color + '60'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 7-day average */}
      <Polyline points={avgPts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Calendar Heatmap ─────────────────────────────────────────────────────
function CalendarHeatmap({ logs, colors, accent }: { logs: DailyLog[]; colors: any; accent: string }) {
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

  // Build grid: 12 weeks × 7 days
  const today = moment();
  const grid: { date: string; steps: number }[][] = [];
  const startDay = moment(today).subtract(WEEKS * 7 - 1, 'days');
  // Align to Monday
  const dayOffset = (startDay.day() + 6) % 7;
  startDay.subtract(dayOffset, 'days');

  for (let w = 0; w < WEEKS; w++) {
    const week: { date: string; steps: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = moment(startDay).add(w * 7 + d, 'days').format('YYYY-MM-DD');
      week.push({ date, steps: logMap[date] ?? 0 });
    }
    grid.push(week);
  }

  const getColor = (steps: number) => {
    if (steps === 0) return colors.border;
    const intensity = Math.min(steps / maxSteps, 1);
    if (intensity < 0.25) return accent + '30';
    if (intensity < 0.5)  return accent + '60';
    if (intensity < 0.75) return accent + 'A0';
    return accent;
  };

  const totalW = WEEKS * (CELL + GAP) - GAP;
  const totalH = 7 * (CELL + GAP) - GAP;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
        {days.map((d, i) => (
          <Text key={i} style={{ width: CELL, fontSize: 8, fontWeight: '700', color: colors.textDisabled, textAlign: 'center' }}>
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
                  width: CELL, height: CELL, borderRadius: 4,
                  backgroundColor: getColor(day.steps),
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Text style={{ fontSize: 9, color: colors.textDisabled }}>Less</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: v === 0 ? colors.border : accent + Math.round(v * 255).toString(16).padStart(2, '0') }} />
        ))}
        <Text style={{ fontSize: 9, color: colors.textDisabled }}>More</Text>
      </View>
    </View>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────
function MonthlyBars({ data, labels, color, colors }: { data: number[]; labels: string[]; color: string; colors: any }) {
  const max = Math.max(...data, 1);
  const barW = (CHART_W - (data.length - 1) * 4) / data.length;

  return (
    <Svg width={CHART_W} height={CHART_H + 20}>
      {data.map((v, i) => {
        const x = i * (barW + 4);
        const h = Math.max((v / max) * (CHART_H - 16), 2);
        const y = CHART_H - h - 4;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={barW} height={h} rx="3" ry="3" fill={color + (i === data.length - 1 ? 'FF' : '55')} />
            <SvgText x={x + barW / 2} y={CHART_H + 16} fontSize="8" fill={colors.textDisabled} textAnchor="middle">{labels[i]}</SvgText>
          </React.Fragment>
        );
      })}
      <Line x1="0" y1={CHART_H - 4} x2={CHART_W} y2={CHART_H - 4} stroke={colors.border} strokeWidth="0.5" />
    </Svg>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function ProgressScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const accent = colors.primary;

  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);

  const load = async () => {
    if (!user) return;
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const start = moment().subtract(days, 'days').toDate();
    const [{ data: logsData }, { data: actsData }, { data: allLogsData }] = await Promise.all([
      databaseService.getLogsInRange(user.id, start, new Date()),
      databaseService.getActivities(user.id, start),
      databaseService.getLogsInRange(user.id, moment().subtract(84, 'days').toDate(), new Date()),
    ]);
    setLogs(logsData ?? []);
    setActivities(actsData ?? []);
    setAllLogs(allLogsData ?? []);
  };

  useEffect(() => { load(); }, [user?.id, period]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Step trend data
  const stepData = useMemo(() => logs.map((l) => l.steps), [logs]);
  const calData  = useMemo(() => logs.map((l) => l.calories), [logs]);
  const sleepData = useMemo(() => logs.map((l) => l.sleep * 100), [logs]); // scale for chart

  // Monthly distance bars
  const monthlyDist = useMemo(() => {
    const months: Record<string, number> = {};
    for (const a of activities) {
      const m = moment(a.startTime).format('MMM');
      months[m] = (months[m] ?? 0) + a.distance;
    }
    const keys = Object.keys(months).slice(-6);
    return { data: keys.map((k) => months[k]), labels: keys };
  }, [activities]);

  // Stats
  const avgSteps   = logs.length ? Math.round(logs.reduce((s, l) => s + l.steps, 0) / logs.length) : 0;
  const avgSleep   = logs.length ? (logs.reduce((s, l) => s + l.sleep, 0) / logs.length).toFixed(1) : '0';
  const totalDist  = activities.reduce((s, a) => s + a.distance, 0);
  const activeDays = new Set(logs.filter((l) => l.steps > 0).map((l) => l.date)).size;

  // Best pace from running activities
  const runActs = activities.filter((a) => a.type === 'running' && a.distance > 0.5);
  const bestPace = runActs.length
    ? formatPace(1, Math.min(...runActs.map((a) => a.duration / a.distance)))
    : '--:--';

  // Weekly snapshot (last 7 days vs prev 7 days)
  const last7 = logs.slice(-7);
  const prev7 = logs.slice(-14, -7);
  const last7Steps = last7.reduce((s, l) => s + l.steps, 0);
  const prev7Steps = prev7.reduce((s, l) => s + l.steps, 0);
  const stepsChange = prev7Steps > 0 ? Math.round(((last7Steps - prev7Steps) / prev7Steps) * 100) : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={[styles.title, { color: colors.text }]}>Progress</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your training data over time</Text>
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {(['30d', '90d', '365d'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.periodChip, {
              backgroundColor: period === p ? accent : colors.surface,
              borderColor: period === p ? accent : colors.border,
            }]}
          >
            <Text style={{ color: period === p ? '#000' : colors.text, fontWeight: '700', fontSize: 12 }}>
              {p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary stats */}
      <View style={styles.statsGrid}>
        {[
          { val: avgSteps.toLocaleString(), lbl: 'Avg Steps/day', color: accent },
          { val: `${totalDist.toFixed(1)} km`, lbl: 'Total Distance', color: '#4D9FFF' },
          { val: `${activeDays}d`, lbl: 'Active Days', color: '#00F5C4' },
          { val: avgSleep + 'h', lbl: 'Avg Sleep', color: '#C084FC' },
        ].map((s) => (
          <View key={s.lbl} style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
            <Text style={[styles.statLbl, { color: colors.textSecondary }]}>{s.lbl}</Text>
          </View>
        ))}
      </View>

      {/* Weekly snapshot */}
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>This Week vs Last Week</Text>
        <View style={styles.snapshotRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.snapshotVal, { color: accent }]}>{last7Steps.toLocaleString()}</Text>
            <Text style={[styles.snapshotLbl, { color: colors.textSecondary }]}>Steps this week</Text>
          </View>
          <View style={[styles.changeBadge, { backgroundColor: stepsChange >= 0 ? '#00C85320' : '#FF5B5B20' }]}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: stepsChange >= 0 ? '#00C853' : '#FF5B5B' }}>
              {stepsChange >= 0 ? '↑' : '↓'} {Math.abs(stepsChange)}%
            </Text>
          </View>
        </View>
        {bestPace !== '--:--' && (
          <View style={[styles.prRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.prLabel, { color: colors.textSecondary }]}>Best pace this period</Text>
            <Text style={[styles.prVal, { color: accent }]}>{bestPace} /km 🏆</Text>
          </View>
        )}
      </View>

      {/* Steps trend */}
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Steps</Text>
        <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Line = 7-day average</Text>
        {stepData.length > 1 ? (
          <LineChart data={stepData} color={accent} colors={colors} />
        ) : (
          <Text style={[styles.noData, { color: colors.textDisabled }]}>Log activities to see trend</Text>
        )}
      </View>

      {/* Calories trend */}
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Calories Burned</Text>
        {calData.length > 1 ? (
          <LineChart data={calData} color="#FF5B5B" colors={colors} />
        ) : (
          <Text style={[styles.noData, { color: colors.textDisabled }]}>No data yet</Text>
        )}
      </View>

      {/* Monthly distance bars */}
      {monthlyDist.data.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Monthly Distance</Text>
          <MonthlyBars data={monthlyDist.data} labels={monthlyDist.labels} color="#4D9FFF" colors={colors} />
        </View>
      )}

      {/* Calendar heatmap */}
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Activity Calendar</Text>
        <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Last 12 weeks</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <CalendarHeatmap logs={allLogs} colors={colors} accent={accent} />
        </ScrollView>
      </View>

      {/* Sleep trend */}
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginBottom: 110 }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Sleep Quality</Text>
        <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Hours per night</Text>
        {sleepData.some((v) => v > 0) ? (
          <LineChart data={sleepData} color="#C084FC" colors={colors} />
        ) : (
          <Text style={[styles.noData, { color: colors.textDisabled }]}>Log sleep in Daily Log to track</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, marginTop: 2 },
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  periodChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '44%', borderRadius: 14, borderWidth: 1, padding: 14 },
  statVal: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
  card: { marginHorizontal: 16, marginBottom: 14, borderRadius: borderRadius.xl, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  cardSub: { fontSize: 11, marginBottom: 12 },
  noData: { fontSize: 13, fontStyle: 'italic', paddingVertical: 24, textAlign: 'center' },
  snapshotRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  snapshotVal: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  snapshotLbl: { fontSize: 11, marginTop: 2 },
  changeBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  prLabel: { fontSize: 12 },
  prVal: { fontSize: 14, fontWeight: '800' },
});
