/**
 * ActiveWorkoutScreen — Fixed
 *
 * Bugs fixed:
 * 1. handleFinish ab actual set/rep/weight data exercises table mein update karta hai
 * 2. Workout complete hone par saveActivity bhi call hoti hai — activity history mein dikhega
 * 3. useAuth import kiya — user available hai for saveActivity
 * 4. saving state add kiya — finish button disabled during save
 * 5. Post-workout summary mein calories estimate bhi dikhta hai
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Vibration, Platform, StatusBar, Animated, AppState,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useActivityStore } from '../../store/activityStore';
import { databaseService } from '../../services/database';
import { supabase } from '../../services/supabase';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';

const DEFAULT_REST = 90; // seconds

interface SetLog {
  reps: number;
  weight: number;
  done: boolean;
}

interface ExerciseLog {
  id: string; // exercise row id from DB
  name: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  sets: SetLog[];
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Rest Timer ────────────────────────────────────────────────────────────────

function RestTimer({
  seconds, onDone, colors, accent,
}: {
  seconds: number; onDone: () => void; colors: any; accent: string;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [active, setActive] = useState(true);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: seconds * 1000,
      useNativeDriver: false,
    }).start();
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          setActive(false);
          onDone();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[restStyles.wrap, { backgroundColor: colors.surface, borderColor: accent + '40' }]}>
      <View style={restStyles.row}>
        <Text style={[restStyles.label, { color: colors.textSecondary }]}>REST</Text>
        <Text style={[restStyles.time, { color: active ? accent : colors.textDisabled }]}>
          {formatTime(remaining)}
        </Text>
        <TouchableOpacity
          onPress={onDone}
          style={[restStyles.skipBtn, { backgroundColor: accent + '20' }]}
        >
          <Text style={{ color: accent, fontWeight: '800', fontSize: 12 }}>SKIP</Text>
        </TouchableOpacity>
      </View>
      <View style={[restStyles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[restStyles.fill, { backgroundColor: accent, width }]} />
      </View>
    </View>
  );
}

const restStyles = StyleSheet.create({
  wrap: { borderRadius: 14, padding: 14, borderWidth: 1, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, flex: 1 },
  time: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 12 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  ex, exIdx, onSetDone, onUpdateSet, colors, accent, showRest, onRestDone,
}: {
  ex: ExerciseLog;
  exIdx: number;
  onSetDone: (exIdx: number, setIdx: number) => void;
  onUpdateSet: (exIdx: number, setIdx: number, field: 'reps' | 'weight', val: string) => void;
  colors: any;
  accent: string;
  showRest: boolean;
  onRestDone: () => void;
}) {
  const completedSets = ex.sets.filter((s) => s.done).length;
  const allDone = completedSets === ex.targetSets;

  return (
    <View
      style={[
        exStyles.card,
        { backgroundColor: colors.surface, borderColor: allDone ? accent + '50' : colors.border },
      ]}
    >
      <View style={exStyles.header}>
        <View
          style={[
            exStyles.numBadge,
            { backgroundColor: allDone ? accent + '20' : colors.surfaceElevated },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '800',
              color: allDone ? accent : colors.textSecondary,
            }}
          >
            {exIdx + 1}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[exStyles.name, { color: colors.text }]}>{ex.name}</Text>
          <Text style={[exStyles.target, { color: colors.textSecondary }]}>
            {ex.targetSets} × {ex.targetReps} reps
            {ex.targetWeight > 0 ? ` @ ${ex.targetWeight}kg` : ''}
          </Text>
        </View>
        <View
          style={[
            exStyles.progress,
            { backgroundColor: allDone ? accent + '20' : colors.surfaceElevated },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '800',
              color: allDone ? accent : colors.textSecondary,
            }}
          >
            {completedSets}/{ex.targetSets}
          </Text>
        </View>
      </View>

      {/* Column headers */}
      <View style={[exStyles.setsHeader, { borderBottomColor: colors.divider }]}>
        <Text style={[exStyles.colLbl, { color: colors.textDisabled, flex: 0.3 }]}>SET</Text>
        <Text style={[exStyles.colLbl, { color: colors.textDisabled, flex: 1 }]}>REPS</Text>
        <Text style={[exStyles.colLbl, { color: colors.textDisabled, flex: 1 }]}>KG</Text>
        <Text style={[exStyles.colLbl, { color: colors.textDisabled, flex: 0.8 }]}>DONE</Text>
      </View>

      {ex.sets.map((set, si) => (
        <View
          key={si}
          style={[
            exStyles.setRow,
            set.done && { backgroundColor: accent + '08' },
          ]}
        >
          <Text style={[exStyles.setNum, { color: colors.textSecondary, flex: 0.3 }]}>
            {si + 1}
          </Text>
          <TextInput
            style={[
              exStyles.setInput,
              {
                color: set.done ? accent : colors.text,
                borderColor: set.done ? accent + '40' : colors.border,
                flex: 1,
              },
            ]}
            value={String(set.reps)}
            onChangeText={(v) => onUpdateSet(exIdx, si, 'reps', v)}
            keyboardType="numeric"
            editable={!set.done}
          />
          <TextInput
            style={[
              exStyles.setInput,
              {
                color: set.done ? accent : colors.text,
                borderColor: set.done ? accent + '40' : colors.border,
                flex: 1,
              },
            ]}
            value={set.weight > 0 ? String(set.weight) : ''}
            onChangeText={(v) => onUpdateSet(exIdx, si, 'weight', v)}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            editable={!set.done}
          />
          <TouchableOpacity
            onPress={() => !set.done && onSetDone(exIdx, si)}
            style={[
              exStyles.doneBtn,
              {
                backgroundColor: set.done ? accent : colors.surfaceElevated,
                borderColor: set.done ? accent : colors.border,
                flex: 0.8,
              },
            ]}
          >
            <Text style={{ fontSize: 16, color: set.done ? '#000' : colors.textDisabled }}>
              {set.done ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {showRest && (
        <RestTimer seconds={DEFAULT_REST} onDone={onRestDone} colors={colors} accent={accent} />
      )}
    </View>
  );
}

const exStyles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  numBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  target: { fontSize: 11, marginTop: 2 },
  progress: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  setsHeader: { flexDirection: 'row', paddingBottom: 8, marginBottom: 4, borderBottomWidth: 1 },
  colLbl: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8, borderRadius: 8, paddingHorizontal: 4, marginBottom: 2 },
  setNum: { textAlign: 'center', fontSize: 13, fontWeight: '700' },
  setInput: { height: 36, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 14, fontWeight: '700', marginHorizontal: 2 },
  doneBtn: { height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen({ route, navigation }: any) {
  const { workout } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  const activityStore = useActivityStore();
  const accent = colors.primary;

  const [elapsed, setElapsed] = useState(0);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>(() =>
    (workout.exercises ?? []).map((ex: any) => ({
      id: ex.id ?? '',
      name: ex.name,
      targetSets: ex.sets,
      targetReps: ex.reps,
      targetWeight: ex.weight ?? 0,
      sets: Array.from({ length: ex.sets }, () => ({
        reps: ex.reps,
        weight: ex.weight ?? 0,
        done: false,
      })),
    }))
  );
  const [restTimer, setRestTimer] = useState<{ exIdx: number } | null>(null);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef<number>(Date.now());
  const bgTimeRef = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Wall-clock timer — survives backgrounding
  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current === 'active' &&
        nextState.match(/inactive|background/)
      ) {
        bgTimeRef.current = Date.now();
      } else if (nextState === 'active' && bgTimeRef.current !== null) {
        // Compensate for time spent in background
        const bgDuration = Date.now() - bgTimeRef.current;
        startTimeRef.current -= bgDuration;
        bgTimeRef.current = null;
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(timerRef.current);
      sub.remove();
    };
  }, []);

  const handleSetDone = useCallback((exIdx: number, setIdx: number) => {
    setExerciseLogs((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, j) =>
                j !== setIdx ? s : { ...s, done: true }
              ),
            }
      )
    );
    Vibration.vibrate(60);
    setRestTimer({ exIdx });
  }, []);

  const handleUpdateSet = useCallback(
    (exIdx: number, setIdx: number, field: 'reps' | 'weight', val: string) => {
      setExerciseLogs((prev) =>
        prev.map((ex, i) =>
          i !== exIdx
            ? ex
            : {
                ...ex,
                sets: ex.sets.map((s, j) =>
                  j !== setIdx ? s : { ...s, [field]: parseFloat(val) || 0 }
                ),
              }
        )
      );
    },
    []
  );

  const totalVolume = exerciseLogs.reduce(
    (sum, ex) =>
      sum +
      ex.sets
        .filter((s) => s.done)
        .reduce((sv, s) => sv + s.reps * s.weight, 0),
    0
  );
  const completedSets = exerciseLogs.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.done).length,
    0
  );
  const totalSets = exerciseLogs.reduce((sum, ex) => sum + ex.targetSets, 0);
  const allDone = completedSets === totalSets;

  // FIX: Save actual set data + create activity record
  const handleFinish = async () => {
    if (!user) return;
    clearInterval(timerRef.current);
    setSaving(true);

    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - elapsed * 1000);

      // 1. Mark workout as completed in workouts table
      await databaseService.completeWorkout(workout.id);

      // 2. Update each exercise row with actual performed sets/reps/weight
      //    Use the best (heaviest) completed set as the representative value
      for (const ex of exerciseLogs) {
        const doneSets = ex.sets.filter((s) => s.done);
        if (doneSets.length === 0 || !ex.id) continue;

        const bestWeight = Math.max(...doneSets.map((s) => s.weight), 0);
        const avgReps = Math.round(
          doneSets.reduce((a, s) => a + s.reps, 0) / doneSets.length
        );

        // Update exercises table with actual performed data
        await supabase
          .from('exercises')
          .update({
            sets: doneSets.length,
            reps: avgReps,
            weight: bestWeight > 0 ? bestWeight : null,
          })
          .eq('id', ex.id);
      }

      // 3. Save as Activity so it shows up in Progress screen & history
      // MET-based estimate: HIIT=10, Cardio=8, Strength=5, Yoga=3, Stretching=2.5
      const calPerMin = workout.type === 'HIIT' ? 10
        : workout.type === 'Cardio' ? 8
        : workout.type === 'Strength' ? 5
        : workout.type === 'Yoga' ? 3
        : workout.type === 'Stretching' ? 2.5
        : 6;
      const estimatedCalories = Math.round((elapsed / 60) * calPerMin);

      await databaseService.saveActivity({
        userId: user.id,
        type: workout.type === 'HIIT'
          ? 'hiit'
          : workout.type === 'Cardio'
          ? 'walking'
          : workout.type === 'Yoga'
          ? 'yoga'
          : 'strength',
        steps: 0,
        distance: 0,
        calories: estimatedCalories,
        duration: elapsed,
        startTime,
        endTime: now,
        notes: `${workout.name} — ${completedSets}/${totalSets} sets, ${Math.round(totalVolume)}kg volume`,
      });

      setFinished(true);

      // FIX: sync calories to daily_logs so HomeScreen metrics update
      activityStore.addActivityMetrics({ calories: estimatedCalories });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save workout. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmFinish = () => {
    Alert.alert(
      allDone ? '🏆 Workout Complete!' : 'Finish Early?',
      allDone
        ? `Great job! You completed all ${totalSets} sets.`
        : `You've done ${completedSets}/${totalSets} sets. Finish anyway?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: handleFinish },
      ]
    );
  };

  const estimatedCalories = Math.round(
    (elapsed / 60) * (workout.type === 'HIIT' ? 10
      : workout.type === 'Cardio' ? 8
      : workout.type === 'Strength' ? 5
      : workout.type === 'Yoga' ? 3
      : workout.type === 'Stretching' ? 2.5
      : 6)
  );

  // ── Post-workout summary ──────────────────────────────────────────────────
  if (finished) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
          <Text style={{ fontSize: 48, textAlign: 'center' }}>🏆</Text>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Workout Done!</Text>
          <Text style={[styles.summaryTime, { color: accent }]}>{formatTime(elapsed)}</Text>
          <Text style={[styles.summaryLbl, { color: colors.textSecondary }]}>Total Time</Text>

          <View style={styles.summaryGrid}>
            {[
              { val: `${completedSets}/${totalSets}`, lbl: 'Sets', color: accent },
              { val: `${Math.round(totalVolume)} kg`, lbl: 'Volume', color: colors.metricDistance },
              { val: `~${estimatedCalories}`, lbl: 'Kcal', color: colors.metricBurn },
              { val: `${exerciseLogs.length}`, lbl: 'Exercises', color: colors.success },
            ].map((s) => (
              <View
                key={s.lbl}
                style={[
                  styles.summaryCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.summaryVal, { color: s.color }]}>{s.val}</Text>
                <Text style={[styles.summaryCardLbl, { color: colors.textSecondary }]}>
                  {s.lbl}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: accent }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: colors.onPrimary, fontWeight: '900', fontSize: 16 }}>
              Back to Workouts
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Active workout UI ─────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <StatusBar barStyle="light-content" />

      {/* Sticky header */}
      <View
        style={[
          styles.stickyHeader,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <AppIcon name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.timerBig, { color: accent }]}>{formatTime(elapsed)}</Text>
          <Text style={[styles.workoutNameSmall, { color: colors.textSecondary }]}>
            {workout.name}
          </Text>
        </View>
        <View style={[styles.progressChip, { backgroundColor: accent + '20' }]}>
          <Text style={{ color: accent, fontWeight: '800', fontSize: 12 }}>
            {completedSets}/{totalSets}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: accent,
                width: `${(completedSets / Math.max(totalSets, 1)) * 100}%`,
              },
            ]}
          />
        </View>

        {exerciseLogs.map((ex, i) => (
          <ExerciseCard
            key={i}
            ex={ex}
            exIdx={i}
            onSetDone={handleSetDone}
            onUpdateSet={handleUpdateSet}
            colors={colors}
            accent={accent}
            showRest={restTimer?.exIdx === i}
            onRestDone={() => {
              setRestTimer(null);
              Speech.speak('Rest complete. Next set.', { rate: 0.95 });
            }}
          />
        ))}
      </ScrollView>

      {/* Finish bar */}
      <View
        style={[
          styles.finishBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>Volume lifted</Text>
          <Text style={[styles.volumeVal, { color: colors.text }]}>
            {Math.round(totalVolume)} kg
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.finishBtn,
            { backgroundColor: allDone ? accent : colors.primary, opacity: saving ? 0.6 : 1 },
          ]}
          onPress={confirmFinish}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={{ color: colors.onPrimary, fontWeight: '900', fontSize: 15 }}>
              {allDone ? '🏆 Finish' : 'Finish Workout'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  timerBig: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  workoutNameSmall: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  progressChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: 4, borderRadius: 2 },
  finishBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    gap: 16,
  },
  volumeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  volumeVal: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  finishBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999, minWidth: 140, alignItems: 'center' },
  summaryTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8 },
  summaryTime: { fontSize: 52, fontWeight: '900', textAlign: 'center', letterSpacing: -2 },
  summaryLbl: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: -12,
  },
  summaryGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  summaryCard: {
    flex: 1,
    minWidth: '40%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  summaryVal: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  summaryCardLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  doneBtn: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
