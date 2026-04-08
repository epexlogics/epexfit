/**
 * OnboardingScreen — Upgraded to 4-step goal-setting wizard
 * Step 1: Welcome + goal type
 * Step 2: Fitness level
 * Step 3: Schedule (days/week)
 * Step 4: Body metrics
 *
 * FIXES APPLIED:
 * - Issue 2: Onboarding flag now also stored in user profile (survives reinstall/new device)
 * - Issue 3: finishCalled ref prevents double-tap / double navigation
 * - Issue 4: Goal creation wrapped in its own try/catch (non-fatal), single alert guard
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { STORAGE_KEYS } from '../../constants/config';
import { borderRadius, spacing } from '../../constants/theme';


const GOALS = [
  { key: 'lose_weight',       label: 'Lose Weight',        icon: '🔥', desc: 'Burn fat, get lean' },
  { key: 'build_muscle',      label: 'Build Muscle',       icon: '💪', desc: 'Get stronger, bigger' },
  { key: 'stay_active',       label: 'Stay Active',        icon: '🏃', desc: 'Maintain fitness' },
  { key: 'improve_endurance', label: 'Improve Endurance',  icon: '⚡', desc: 'Run farther, faster' },
  { key: 'flexibility',       label: 'Flexibility',        icon: '🧘', desc: 'Stretch & recover' },
  { key: 'general_health',    label: 'General Health',     icon: '❤️', desc: 'Feel better daily' },
];

const LEVELS = [
  { key: 'beginner',     label: 'Beginner',     icon: '🌱', desc: 'Just getting started or returning after a long break' },
  { key: 'intermediate', label: 'Intermediate', icon: '🏅', desc: 'Active a few times per week, comfortable with exercise' },
  { key: 'advanced',     label: 'Advanced',     icon: '🏆', desc: 'Training regularly, pushing performance limits' },
];

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const STEPS = [
  { key: 'goal',     title: "What's your\nmain goal?",        subtitle: 'Pick the one that matters most right now.', emoji: '🎯' },
  { key: 'level',    title: "What's your\nfitness level?",    subtitle: 'Be honest — this shapes your training plan.', emoji: '📊' },
  { key: 'schedule', title: "How many days\ncan you train?",   subtitle: 'Consistency beats intensity every time.',  emoji: '📅' },
  { key: 'metrics',  title: "Your body\nmetrics",             subtitle: 'For accurate BMI and calorie calculations.',  emoji: '📏' },
];

export default function OnboardingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const { colors } = useTheme();
  const accent = colors.primary;

  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [trainingDays, setTrainingDays] = useState<number>(4);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  // FIX (Issue 3): ref guard prevents double-tap triggering two navigation calls
  const finishCalled = useRef(false);

  const canProceed = () => {
    if (step === 0) return selectedGoal !== null;
    if (step === 1) return selectedLevel !== null;
    if (step === 2) return trainingDays > 0;
    if (step === 3) return height.trim() !== '' && weight.trim() !== '';
    return true;
  };

  const handleFinish = async () => {
    // FIX (Issue 3): block if already in-flight (ref check is synchronous, unlike state)
    if (!user || saving || finishCalled.current) return;
    finishCalled.current = true;
    setSaving(true);

    // FIX (Issue 4): single alert flag so repeated promise rejections only show one alert
    let alertShown = false;

    try {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0 || h < 50 || h > 300 || w < 20 || w > 500) {
        Alert.alert('Invalid values', 'Please enter realistic height (cm) and weight (kg). Values cannot be zero.');
        finishCalled.current = false; // allow retry after validation error
        setSaving(false);
        return;
      }

      // FIX (Issue 2): persist onboarding_complete to user profile so it survives
      // reinstalls and new devices — AppNavigator checks this before AsyncStorage
      await updateProfile({ height: h, weight: w, onboarding_complete: true } as any);

      await AsyncStorage.setItem('user_fitness_goal', selectedGoal ?? '');
      await AsyncStorage.setItem('user_fitness_level', selectedLevel ?? '');
      await AsyncStorage.setItem('user_training_days', String(trainingDays));
      await AsyncStorage.setItem('@epexfit_onboarding', JSON.stringify({
        goal: selectedGoal,
        level: selectedLevel,
        trainingDays,
        height: h,
        weight: w,
      }));

      // FIX (Issue 4): goal creation is non-fatal — a network/RLS failure here
      // should NOT prevent the user entering the app or trigger a confusing error alert
      try {
        const stepGoal = selectedLevel === 'beginner' ? 7000 : selectedLevel === 'intermediate' ? 10000 : 12000;
        const runGoal  = trainingDays >= 4 ? 10 : trainingDays >= 3 ? 7 : 5;
        const deadline30 = new Date(); deadline30.setDate(deadline30.getDate() + 30);
        const deadline90 = new Date(); deadline90.setDate(deadline90.getDate() + 90);

        await Promise.all([
          databaseService.saveGoal({ userId: user.id, type: 'steps',    target: stepGoal, current: 0, unit: 'steps',   startDate: new Date(), deadline: deadline30, completed: false }),
          databaseService.saveGoal({ userId: user.id, type: 'water',    target: 8,        current: 0, unit: 'glasses', startDate: new Date(), deadline: deadline30, completed: false }),
          databaseService.saveGoal({ userId: user.id, type: 'calories', target: 500,      current: 0, unit: 'kcal',    startDate: new Date(), deadline: deadline30, completed: false }),
          databaseService.saveGoal({ userId: user.id, type: 'running',  target: runGoal,  current: 0, unit: 'km',      startDate: new Date(), deadline: deadline90, completed: false }),
        ]);
      } catch (goalError) {
        // Goals will be creatable later from GoalsScreen — silently continue
        console.warn('[Onboarding] Default goals creation failed (non-fatal):', goalError);
      }

      // Mark onboarding complete locally — AppNavigator reads this to skip onboarding
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, 'complete');
      navigation.replace('Main');

    } catch (error) {
      // FIX (Issue 4): only show one alert even if multiple async ops reject
      if (!alertShown) {
        alertShown = true;
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
      // Reset guards so user can retry
      finishCalled.current = false;
      setSaving(false);
    }
    // NOTE: no finally setSaving(false) here — on success the screen unmounts via
    // navigation.replace('Main'), so there is no state to reset.
  };

  const current = STEPS[step];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, {
                backgroundColor: i <= step ? accent : colors.border,
                width: i === step ? 28 : 7,
              }]} />
            ))}
          </View>

          {/* Step indicator */}
          <Text style={[styles.stepNum, { color: colors.textDisabled }]}>
            Step {step + 1} of {STEPS.length}
          </Text>

          <Text style={styles.emoji}>{current.emoji}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{current.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{current.subtitle}</Text>

          {/* Step 0 — Goal selection */}
          {step === 0 && (
            <View style={styles.goalsGrid}>
              {GOALS.map((g) => {
                const selected = selectedGoal === g.key;
                return (
                  <TouchableOpacity
                    key={g.key}
                    onPress={() => setSelectedGoal(g.key)}
                    activeOpacity={0.8}
                    style={[styles.goalCard, {
                      backgroundColor: selected ? accent + '18' : colors.surfaceElevated,
                      borderColor: selected ? accent : colors.border,
                      borderWidth: selected ? 2 : 1,
                    }]}
                  >
                    <Text style={styles.goalIcon}>{g.icon}</Text>
                    <Text style={[styles.goalLabel, { color: selected ? accent : colors.text }]}>{g.label}</Text>
                    <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>{g.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Step 1 — Fitness level */}
          {step === 1 && (
            <View style={styles.levelList}>
              {LEVELS.map((l) => {
                const selected = selectedLevel === l.key;
                return (
                  <TouchableOpacity
                    key={l.key}
                    onPress={() => setSelectedLevel(l.key)}
                    style={[styles.levelCard, {
                      backgroundColor: selected ? accent + '15' : colors.surfaceElevated,
                      borderColor: selected ? accent : colors.border,
                      borderWidth: selected ? 2 : 1,
                    }]}
                  >
                    <Text style={{ fontSize: 32 }}>{l.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.levelLabel, { color: selected ? accent : colors.text }]}>{l.label}</Text>
                      <Text style={[styles.levelDesc, { color: colors.textSecondary }]}>{l.desc}</Text>
                    </View>
                    {selected && <Text style={{ fontSize: 20, color: accent }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Step 2 — Training days */}
          {step === 2 && (
            <View style={styles.daysWrap}>
              <Text style={[styles.daysNum, { color: accent }]}>{trainingDays}</Text>
              <Text style={[styles.daysLbl, { color: colors.textSecondary }]}>days per week</Text>
              <View style={styles.daysRow}>
                {DAYS_OPTIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setTrainingDays(d)}
                    style={[styles.dayChip, {
                      backgroundColor: trainingDays === d ? accent : colors.surfaceElevated,
                      borderColor: trainingDays === d ? accent : colors.border,
                    }]}
                  >
                    <Text style={{ color: trainingDays === d ? colors.onPrimary : colors.text, fontWeight: '800', fontSize: 18 }}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.dayHint, { color: colors.textSecondary }]}>
                {trainingDays <= 2 ? 'Light schedule — perfect for beginners' :
                 trainingDays <= 4 ? 'Balanced training — great for most people' :
                 'Intense schedule — make sure to rest adequately'}
              </Text>
            </View>
          )}

          {/* Step 3 — Body metrics */}
          {step === 3 && (
            <View style={styles.inputsWrap}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Height (cm)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={height} onChangeText={setHeight}
                  keyboardType="decimal-pad" placeholder="e.g. 175"
                  placeholderTextColor={colors.textDisabled}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Weight (kg)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={weight} onChangeText={setWeight}
                  keyboardType="decimal-pad" placeholder="e.g. 72"
                  placeholderTextColor={colors.textDisabled}
                />
              </View>
              <View style={[styles.privacyNote, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={{ fontSize: 14, color: colors.text }}>🔒</Text>
                <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                  Used only for BMI and calorie calculations. Never shared.
                </Text>
              </View>
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            onPress={() => {
              if (step < STEPS.length - 1) setStep(step + 1);
              else handleFinish();
            }}
            disabled={!canProceed() || saving}
            activeOpacity={0.85}
            style={[styles.btn, { backgroundColor: canProceed() ? accent : colors.border }]}
          >
            <Text style={[styles.btnText, { color: canProceed() ? colors.onPrimary : colors.textDisabled }]}>
              {saving ? 'Setting up…' : step < STEPS.length - 1 ? 'Continue →' : "Let's go 🚀"}
            </Text>
          </TouchableOpacity>

          {step > 0 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: 60 },
  dots: { flexDirection: 'row', gap: 5, marginBottom: 24, alignSelf: 'center' },
  dot: { height: 7, borderRadius: 4 },
  stepNum: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 24 },
  emoji: { fontSize: 52, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -1, marginBottom: 10, lineHeight: 36 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32, fontWeight: '500' },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  goalCard: { width: '47%', padding: 16, borderRadius: borderRadius.xl, alignItems: 'center', gap: 6 },
  goalIcon: { fontSize: 28 },
  goalLabel: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  goalDesc: { fontSize: 11, textAlign: 'center' },
  levelList: { gap: 12, marginBottom: 32 },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: borderRadius.xl },
  levelLabel: { fontSize: 16, fontWeight: '800' },
  levelDesc: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  daysWrap: { alignItems: 'center', gap: 12, marginBottom: 32 },
  daysNum: { fontSize: 72, fontWeight: '900', letterSpacing: -3 },
  daysLbl: { fontSize: 16, fontWeight: '600', marginTop: -12 },
  daysRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dayChip: { width: 56, height: 56, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayHint: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19, maxWidth: 260 },
  inputsWrap: { gap: 16, marginBottom: 32 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  input: { height: 52, borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: 16, fontSize: 16, fontWeight: '600' },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 17 },
  btn: { height: 58, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  btnText: { fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  backBtn: { alignSelf: 'center', padding: 8 },
  backText: { fontSize: 14, fontWeight: '600' },
});
