import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWater } from '../../store/waterStore';
import { useSleep } from '../../store/sleepStore';
import { useMood } from '../../store/moodStore';
import { useActivityStore } from '../../store/activityStore';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';
import { supabase } from '../../services/supabase';

const MOOD_OPTIONS: { value: 1 | 2 | 3 | 4 | 5; icon: string; label: string; color: string }[] = [
  { value: 1, icon: 'emoticon-dead',    label: 'Terrible', color: '#FB7185' },
  { value: 2, icon: 'emoticon-sad',     label: 'Bad',      color: '#FB923C' },
  { value: 3, icon: 'emoticon-neutral', label: 'Okay',     color: '#FBBF24' },
  { value: 4, icon: 'emoticon-happy',   label: 'Good',     color: '#4ADE80' },
  { value: 5, icon: 'emoticon-excited', label: 'Great',    color: '#22D3EE' },
];

function LogCard({ title, icon, iconColor, children }: { title: string; icon: string; iconColor: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[cardStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={cardStyles.header}>
        <View style={[cardStyles.iconWrap, { backgroundColor: iconColor + '20' }]}>
          <AppIcon name={icon} size={20} color={iconColor} />
        </View>
        <Text style={[cardStyles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
});

export default function DailyLogScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

  // ── Feature stores (single source of truth) ──────────────────────────────
  const water = useWater();
  const sleep = useSleep();
  const mood = useMood();
  const activityStore = useActivityStore();

  // ── Nutrition fields (protein, fiber) — still in daily_logs ──────────────
  // These are not in dedicated tables, so we manage them locally with auto-save
  const [protein, setProtein] = useState('');
  const [fiber, setFiber] = useState('');
  const [notes, setNotes] = useState('');
  const [nutritionLoading, setNutritionLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // FIX: compute today dynamically — DailyLogScreen uses today at mount time
  // but nutrition save also needs the current date at call time
  const getToday = () => dayjs().format('YYYY-MM-DD');
  const today = getToday();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proteinRef = useRef(protein);
  const fiberRef = useRef(fiber);
  const notesRef = useRef(notes);
  proteinRef.current = protein;
  fiberRef.current = fiber;
  notesRef.current = notes;

  // Load nutrition fields from daily_logs on mount
  const loadNutrition = useCallback(async () => {
    if (!user) return;
    setNutritionLoading(true);
    const { data } = await supabase
      .from('daily_logs')
      .select('protein, fiber, notes')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    if (data) {
      setProtein(data.protein ? String(data.protein) : '');
      setFiber(data.fiber ? String(data.fiber) : '');
      setNotes(data.notes ?? '');
    }
    setNutritionLoading(false);
  }, [user, today]);

  useEffect(() => { loadNutrition(); }, [loadNutrition]);

  // Auto-save nutrition fields to daily_logs
  const saveNutrition = useCallback(async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      const currentDate = getToday(); // FIX: use current date at call time
      await supabase
        .from('daily_logs')
        .upsert({
          user_id: user.id,
          date: currentDate,
          protein: parseInt(proteinRef.current) || 0,
          fiber: parseInt(fiberRef.current) || 0,
          notes: notesRef.current || null,
        }, { onConflict: 'user_id,date' });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch {
      setSaveStatus('idle');
    }
  }, [user]);

  const scheduleNutritionSave = useCallback((newProtein: string, newFiber: string, newNotes: string) => {
    proteinRef.current = newProtein;
    fiberRef.current = newFiber;
    notesRef.current = newNotes;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveNutrition, 1500);
  }, [saveNutrition]);

  // Save on screen blur
  useFocusEffect(useCallback(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveNutrition();
    };
  }, [saveNutrition]));

  const updateProtein = (v: string) => {
    const clean = v.replace(/[^0-9]/g, '');
    setProtein(clean);
    scheduleNutritionSave(clean, fiberRef.current, notesRef.current);
  };

  const updateFiber = (v: string) => {
    const clean = v.replace(/[^0-9]/g, '');
    setFiber(clean);
    scheduleNutritionSave(proteinRef.current, clean, notesRef.current);
  };

  const updateNotes = (v: string) => {
    setNotes(v);
    scheduleNutritionSave(proteinRef.current, fiberRef.current, v);
  };

  const quickAdd = (field: 'protein' | 'fiber', amount: number) => {
    if (field === 'protein') {
      const next = String((parseInt(proteinRef.current) || 0) + amount);
      setProtein(next);
      scheduleNutritionSave(next, fiberRef.current, notesRef.current);
    } else {
      const next = String((parseInt(fiberRef.current) || 0) + amount);
      setFiber(next);
      scheduleNutritionSave(proteinRef.current, next, notesRef.current);
    }
  };

  // Manual steps entry — writes to activityStore (daily_logs steps column)
  const [stepsInput, setStepsInput] = useState('');
  const stepsInputRef = useRef(stepsInput);
  stepsInputRef.current = stepsInput;
  const stepsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activityStore.steps > 0) setStepsInput(String(activityStore.steps));
  }, [activityStore.steps]);

  const updateSteps = (v: string) => {
    const clean = v.replace(/[^0-9]/g, '');
    setStepsInput(clean);
    if (stepsTimerRef.current) clearTimeout(stepsTimerRef.current);
    stepsTimerRef.current = setTimeout(() => {
      activityStore.setActivityMetrics({ steps: parseInt(clean) || 0 });
    }, 1500);
  };

  const isLoading = nutritionLoading || water.loading || sleep.loading || mood.loading;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { loadNutrition(); water.refresh(); sleep.refresh(); activityStore.refresh(); }}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: colors.text }]}>Daily Log</Text>
            <Text style={[styles.pageDate, { color: colors.textSecondary }]}>{dayjs().format('dddd, MMMM D')}</Text>
          </View>
          <View style={[styles.saveStatus, {
            backgroundColor: saveStatus === 'saved' ? colors.success + '22' : saveStatus === 'saving' ? colors.surfaceElevated : 'transparent',
            borderColor: saveStatus === 'saved' ? colors.success + '55' : 'transparent',
          }]}>
            {saveStatus === 'saving' && <ActivityIndicator size="small" color={colors.textSecondary} />}
            {saveStatus === 'saved' && <Text style={[styles.savedText, { color: colors.success }]}>✓ Saved</Text>}
            {saveStatus === 'idle' && <Text style={[styles.autoSaveHint, { color: colors.textDisabled }]}>Auto-saves</Text>}
          </View>
        </View>

        {/* Water — reads/writes waterStore */}
        <LogCard title="Water Intake" icon="water" iconColor={colors.metricHydration}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.adjustBtn, { backgroundColor: colors.border }]}
              onPress={water.removeGlass}
            >
              <Text style={[styles.adjustText, { color: colors.text }]}>−</Text>
            </TouchableOpacity>
            <View style={styles.valueDisplay}>
              <Text style={[styles.valueText, { color: colors.text }]}>{water.glasses}</Text>
              <Text style={[styles.valueUnit, { color: colors.textSecondary }]}>glasses</Text>
            </View>
            <TouchableOpacity
              style={[styles.adjustBtn, { backgroundColor: colors.primary }]}
              onPress={water.addGlass}
            >
              <Text style={[styles.adjustText, { color: colors.onPrimary }]}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.metricHydration + '22' }]}>
            <View style={[styles.progressFill, {
              backgroundColor: colors.metricHydration,
              width: `${Math.min((water.glasses / water.goal) * 100, 100)}%`,
            }]} />
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {water.glasses} / {water.goal} glasses · {user?.weight ? Math.round(user.weight * 35) : 2450} ml recommended
          </Text>
        </LogCard>

        {/* Sleep — reads/writes sleepStore */}
        <LogCard title="Sleep" icon="sleep" iconColor={colors.secondary}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.adjustBtn, { backgroundColor: colors.border }]}
              onPress={() => sleep.upsertSleep(Math.max(0, sleep.hours - 0.5))}
            >
              <Text style={[styles.adjustText, { color: colors.text }]}>−</Text>
            </TouchableOpacity>
            <View style={styles.valueDisplay}>
              <Text style={[styles.valueText, { color: colors.text }]}>{sleep.hours}</Text>
              <Text style={[styles.valueUnit, { color: colors.textSecondary }]}>hours</Text>
            </View>
            <TouchableOpacity
              style={[styles.adjustBtn, { backgroundColor: colors.primary }]}
              onPress={() => sleep.upsertSleep(Math.min(12, sleep.hours + 0.5))}
            >
              <Text style={[styles.adjustText, { color: colors.onPrimary }]}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.secondary + '22' }]}>
            <View style={[styles.progressFill, {
              backgroundColor: colors.secondary,
              width: `${Math.min((sleep.hours / sleep.goal) * 100, 100)}%`,
            }]} />
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Recommended: 7–9 hours/night</Text>
        </LogCard>

        {/* Mood — reads/writes moodStore */}
        <LogCard title="Today's Mood" icon="emoticon" iconColor={colors.warning}>
          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map((option) => {
              const selected = mood.rating === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => mood.upsertMood(option.value)}
                  style={[styles.moodBtn, {
                    backgroundColor: selected ? option.color + '25' : colors.surfaceElevated,
                    borderColor: selected ? option.color : 'transparent',
                    borderWidth: selected ? 1.5 : 0,
                  }]}
                >
                  <AppIcon name={option.icon} size={30} color={selected ? option.color : colors.textDisabled} />
                  <Text style={[styles.moodLabel, { color: selected ? option.color : colors.textDisabled }]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LogCard>

        {/* Steps — reads/writes activityStore */}
        <LogCard title="Steps" icon="shoe-print" iconColor={colors.primary}>
          <TextInput
            style={[styles.numInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            value={stepsInput}
            onChangeText={updateSteps}
            keyboardType="numeric"
          />
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Today: {activityStore.steps.toLocaleString()} steps · {activityStore.distance.toFixed(2)} km
          </Text>
        </LogCard>

        {/* Protein */}
        <LogCard title="Protein Intake" icon="food-steak" iconColor={colors.metricProtein}>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.numInput, { color: colors.text, borderColor: colors.border, flex: 1 }]}
              placeholder="0"
              placeholderTextColor={colors.textDisabled}
              value={protein}
              onChangeText={updateProtein}
              keyboardType="numeric"
            />
            <View style={styles.quickBtns}>
              {[20, 30, 50].map((a) => (
                <TouchableOpacity key={a} style={[styles.quickBtn, { backgroundColor: colors.metricProtein + '22' }]} onPress={() => quickAdd('protein', a)}>
                  <Text style={{ color: colors.metricProtein, fontSize: 12, fontWeight: '600' }}>+{a}g</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Recommended: {user?.weight ? Math.round(user.weight * 1.6) : 112}g/day
          </Text>
        </LogCard>

        {/* Fiber */}
        <LogCard title="Fiber Intake" icon="leaf" iconColor={colors.neonGlow}>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.numInput, { color: colors.text, borderColor: colors.border, flex: 1 }]}
              placeholder="0"
              placeholderTextColor={colors.textDisabled}
              value={fiber}
              onChangeText={updateFiber}
              keyboardType="numeric"
            />
            <View style={styles.quickBtns}>
              {[5, 10, 15].map((a) => (
                <TouchableOpacity key={a} style={[styles.quickBtn, { backgroundColor: colors.neonGlow + '22' }]} onPress={() => quickAdd('fiber', a)}>
                  <Text style={{ color: colors.neonGlow, fontSize: 12, fontWeight: '600' }}>+{a}g</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Recommended: 25–38g/day</Text>
        </LogCard>

        {/* Notes */}
        <LogCard title="Notes" icon="note-text" iconColor={colors.info}>
          <TextInput
            style={[styles.notesInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="How did you feel today? Any observations..."
            placeholderTextColor={colors.textDisabled}
            value={notes}
            onChangeText={updateNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </LogCard>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  pageDate: { fontSize: 14, marginTop: 4 },
  saveStatus: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  savedText: { fontSize: 12, fontWeight: '700' },
  autoSaveHint: { fontSize: 11, fontWeight: '500' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valueDisplay: { flex: 1, alignItems: 'center' },
  valueText: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  valueUnit: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  adjustBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  adjustText: { fontSize: 22, fontWeight: '700' },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  numInput: { borderWidth: 1.5, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600' },
  quickBtns: { flexDirection: 'row', gap: 6 },
  quickBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: borderRadius.sm },
  hint: { fontSize: 12 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: borderRadius.md, gap: 4, marginHorizontal: 2 },
  moodLabel: { fontSize: 9, fontWeight: '600' },
  notesInput: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: 14, fontSize: 14, minHeight: 100 },
});
