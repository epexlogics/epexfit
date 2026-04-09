/**
 * Weekly snapshot — glassy sheet, cyan primary CTA, soft-rose calorie row.
 */
import React, { useEffect, Component, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from '../utils/dayjs';
import { useTheme } from '../context/ThemeContext';

// ── Modal-scoped Error Boundary ─────────────────────────────────────────────

class ModalErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn('[WeeklySnapshotModal] render error:', e.message); }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}


const SNAPSHOT_KEY = '@epexfit_last_snapshot_week';

interface SnapshotData {
  totalSteps:    number;
  totalDistKm:   number;
  totalCalories: number;
  activeDays:    number;
  streak:        number;
  bestDaySteps:  number;
  bestDayDate:   string;
  apsScore:      number;
}

interface Props {
  data: SnapshotData | null;
  onDismiss: () => void;
}

function WeeklySnapshotModalInner({ data, onDismiss }: Props) {
  const { colors } = useTheme();
  const slideAnim = useState(() => new Animated.Value(400))[0];
  const opacityAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!data) return;
    Animated.parallel([
      Animated.spring(slideAnim,   { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [data]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 400, duration: 250, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,   duration: 250, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  if (!data) return null;

  const weekLabel = dayjs().subtract(1, 'week').format('[Week of] MMM D');
  const stepsK = (data.totalSteps / 1000).toFixed(1);

  const getInsight = (): string => {
    if (data.activeDays >= 6) return 'Elite consistency — you trained almost every day. 🏆';
    if (data.activeDays >= 4) return 'Strong week. Hitting 4+ days is where real progress happens.';
    if (data.activeDays >= 2) return 'Good start. Try adding one more day next week.';
    return 'Every journey starts somewhere. Let\'s aim for 3 days next week.';
  };

  const statRows = [
    { val: `${stepsK}K`, lbl: 'Steps',    emoji: '👟', color: colors.primary },
    { val: `${data.totalDistKm.toFixed(1)}`, lbl: 'Km',   emoji: '🗺️', color: colors.metricDistance },
    { val: `${data.activeDays}/7`, lbl: 'Active',  emoji: '⚡', color: colors.neonGlow },
    { val: `${data.streak}`,       lbl: 'Streak',  emoji: '🔥', color: colors.metricStreak },
  ];

  return (
    <Modal transparent animationType="none" visible={!!data} onRequestClose={handleDismiss}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim, backgroundColor: colors.overlay }]}>
        <Animated.View style={[
          styles.card,
          {
            transform: [{ translateY: slideAnim }],
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.weekEmoji}>📅</Text>
              <Text style={[styles.weekTitle, { color: colors.text }]}>Your Week in Review</Text>
              <Text style={[styles.weekLabel, { color: colors.textSecondary }]}>{weekLabel}</Text>
            </View>
            <View style={[styles.apsBadge, { backgroundColor: colors.primary + '22' }]}>
              <Text style={[styles.apsNum, { color: colors.primary }]}>{data.apsScore}</Text>
              <Text style={[styles.apsLbl, { color: colors.textSecondary }]}>APS</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            {statRows.map((s) => (
              <View key={s.lbl} style={styles.statItem}>
                <Text style={styles.statEmoji}>{s.emoji}</Text>
                <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                <Text style={[styles.statLbl, { color: colors.textSecondary }]}>{s.lbl}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.caloriesRow, { backgroundColor: colors.errorSurface }]}>
            <Text style={[styles.calLabel, { color: colors.textSecondary }]}>🔥 Total calories burned</Text>
            <Text style={[styles.calVal, { color: colors.errorSoft }]}>{data.totalCalories.toLocaleString()} kcal</Text>
          </View>

          {data.bestDayDate ? (
            <View style={[styles.bestDay, { backgroundColor: colors.primary + '12' }]}>
              <Text style={[styles.bestDayLabel, { color: colors.primary }]}>🏅 Best day</Text>
              <Text style={[styles.bestDayVal, { color: colors.text }]}>
                {dayjs(data.bestDayDate).format('dddd, MMM D')} · {data.bestDaySteps.toLocaleString()} steps
              </Text>
            </View>
          ) : null}

          <View style={[styles.insightBox, { backgroundColor: colors.surfaceHighlight }]}>
            <Text style={[styles.insightText, { color: colors.textSecondary }]}>{getInsight()}</Text>
          </View>

          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.primary }, shadows.cta]}
            onPress={handleDismiss}
            activeOpacity={0.9}
          >
            <Text style={[styles.closeBtnText, { color: colors.onPrimary }]}>Start This Week Strong 💪</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const shadows = StyleSheet.create({
  cta: {
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
});

export async function shouldShowWeeklySnapshot(): Promise<boolean> {
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon
  const thisWeek = dayjs().startOf('isoWeek').format('YYYY-[W]WW');
  try {
    const last = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (last === thisWeek) return false; // already shown this week
    // Show on Monday (normal weekly recap)
    if (dayOfWeek === 1) return true;
    // Also show mid-week if user has never seen it (new install)
    // — gives first-week users the motivational snapshot sooner
    if (!last) return true;
    return false;
  } catch { return false; }
}

export async function markSnapshotShown(): Promise<void> {
  const thisWeek = dayjs().startOf('isoWeek').format('YYYY-[W]WW');
  try { await AsyncStorage.setItem(SNAPSHOT_KEY, thisWeek); } catch {}
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    gap: 16,
    borderWidth: 1,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  weekEmoji: { fontSize: 32, marginBottom: 4 },
  weekTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  weekLabel: { fontSize: 12, marginTop: 3 },
  apsBadge: { padding: 14, borderRadius: 16, alignItems: 'center' },
  apsNum: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  apsLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', gap: 4 },
  statEmoji: { fontSize: 20 },
  statVal: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  caloriesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 14 },
  calLabel: { fontSize: 13 },
  calVal: { fontSize: 15, fontWeight: '800' },
  bestDay: { padding: 14, borderRadius: 14, gap: 3 },
  bestDayLabel: { fontSize: 11, fontWeight: '700' },
  bestDayVal: { fontSize: 13 },
  insightBox: { padding: 14, borderRadius: 14 },
  insightText: { fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  closeBtn: { height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontWeight: '900', fontSize: 16 },
});

export default function WeeklySnapshotModal(props: Parameters<typeof WeeklySnapshotModalInner>[0]) {
  return (
    <ModalErrorBoundary>
      <WeeklySnapshotModalInner {...props} />
    </ModalErrorBoundary>
  );
}
