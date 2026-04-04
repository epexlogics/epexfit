/**
 * WeeklySnapshotModal
 * Full-screen swipeable "Your Week" card shown on Monday mornings.
 * Summarises last week: steps, distance, workouts, best day, streak.
 * Dismissed and suppressed until next Monday via AsyncStorage.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

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

export default function WeeklySnapshotModal({ data, onDismiss }: Props) {
  const slideAnim = new Animated.Value(400);
  const opacityAnim = new Animated.Value(0);

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

  const weekLabel = moment().subtract(1, 'week').format('[Week of] MMM D');
  const stepsK = (data.totalSteps / 1000).toFixed(1);

  const getInsight = (): string => {
    if (data.activeDays >= 6) return 'Elite consistency — you trained almost every day. 🏆';
    if (data.activeDays >= 4) return 'Strong week. Hitting 4+ days is where real progress happens.';
    if (data.activeDays >= 2) return 'Good start. Try adding one more day next week.';
    return 'Every journey starts somewhere. Let\'s aim for 3 days next week.';
  };

  return (
    <Modal transparent animationType="none" visible={!!data} onRequestClose={handleDismiss}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.weekEmoji}>📅</Text>
              <Text style={styles.weekTitle}>Your Week in Review</Text>
              <Text style={styles.weekLabel}>{weekLabel}</Text>
            </View>
            <View style={[styles.apsBadge, { backgroundColor: '#F5C84220' }]}>
              <Text style={styles.apsNum}>{data.apsScore}</Text>
              <Text style={styles.apsLbl}>APS</Text>
            </View>
          </View>

          {/* Big stats */}
          <View style={styles.statsGrid}>
            {[
              { val: `${stepsK}K`, lbl: 'Steps',    emoji: '👟', color: '#F5C842' },
              { val: `${data.totalDistKm.toFixed(1)}`, lbl: 'Km',   emoji: '🗺️', color: '#4D9FFF' },
              { val: `${data.activeDays}/7`, lbl: 'Active',  emoji: '⚡', color: '#00F5C4' },
              { val: `${data.streak}`,       lbl: 'Streak',  emoji: '🔥', color: '#FF9500' },
            ].map((s) => (
              <View key={s.lbl} style={styles.statItem}>
                <Text style={styles.statEmoji}>{s.emoji}</Text>
                <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                <Text style={styles.statLbl}>{s.lbl}</Text>
              </View>
            ))}
          </View>

          {/* Calories burned */}
          <View style={styles.caloriesRow}>
            <Text style={styles.calLabel}>🔥 Total calories burned</Text>
            <Text style={styles.calVal}>{data.totalCalories.toLocaleString()} kcal</Text>
          </View>

          {/* Best day */}
          {data.bestDayDate && (
            <View style={styles.bestDay}>
              <Text style={styles.bestDayLabel}>🏅 Best day</Text>
              <Text style={styles.bestDayVal}>
                {moment(data.bestDayDate).format('dddd, MMM D')} · {data.bestDaySteps.toLocaleString()} steps
              </Text>
            </View>
          )}

          {/* Insight */}
          <View style={styles.insightBox}>
            <Text style={styles.insightText}>{getInsight()}</Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
            <Text style={styles.closeBtnText}>Start This Week Strong 💪</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Check if today is Monday AND we haven't shown this week's snapshot yet */
export async function shouldShowWeeklySnapshot(): Promise<boolean> {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday
  if (dayOfWeek !== 1) return false;
  const thisWeek = moment().startOf('isoWeek').format('YYYY-[W]WW');
  try {
    const last = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return last !== thisWeek;
  } catch { return false; }
}

export async function markSnapshotShown(): Promise<void> {
  const thisWeek = moment().startOf('isoWeek').format('YYYY-[W]WW');
  try { await AsyncStorage.setItem(SNAPSHOT_KEY, thisWeek); } catch {}
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#141828',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  weekEmoji: { fontSize: 32, marginBottom: 4 },
  weekTitle: { fontSize: 22, fontWeight: '900', color: '#E8EAF6', letterSpacing: -0.6 },
  weekLabel: { fontSize: 12, color: '#7A83A6', marginTop: 3 },
  apsBadge: { padding: 14, borderRadius: 14, alignItems: 'center' },
  apsNum: { fontSize: 28, fontWeight: '900', color: '#F5C842', letterSpacing: -1 },
  apsLbl: { fontSize: 10, fontWeight: '700', color: '#7A83A6', letterSpacing: 1, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', gap: 4 },
  statEmoji: { fontSize: 20 },
  statVal: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLbl: { fontSize: 10, fontWeight: '600', color: '#7A83A6', textTransform: 'uppercase', letterSpacing: 0.8 },
  caloriesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF5B5B10', padding: 12, borderRadius: 12 },
  calLabel: { fontSize: 13, color: '#7A83A6' },
  calVal: { fontSize: 15, fontWeight: '800', color: '#FF5B5B' },
  bestDay: { backgroundColor: '#F5C84210', padding: 12, borderRadius: 12, gap: 3 },
  bestDayLabel: { fontSize: 11, fontWeight: '700', color: '#F5C842' },
  bestDayVal: { fontSize: 13, color: '#E8EAF6' },
  insightBox: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 12 },
  insightText: { fontSize: 13, color: '#A0A8C8', lineHeight: 19, fontStyle: 'italic' },
  closeBtn: { backgroundColor: '#F5C842', height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
