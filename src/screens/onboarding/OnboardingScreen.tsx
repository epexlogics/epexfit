/**
 * OnboardingScreen — Upgraded to 4-step goal-setting wizard
 * Step 1: Welcome + goal type
 * Step 2: Fitness level
 * Step 3: Schedule (days/week)
 * Step 4: Body metrics
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Platform, Alert, KeyboardAvoidingView, Animated,
} from 'react-native';
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

  const canProceed = () => {
    if (step === 0) return selectedGoal !== null;
    if (step === 1) return selectedLevel !== null;
    if (step === 2) return trainingDays > 0;
    if (step === 3) return height.trim() !== '' && weight.trim() !== '';
    return true;
  };

  const handleFinish = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (isNaN(h) || isNaN(w) || h < 50 || h > 300 || w < 20 || w > 500) {
        Alert.alert('Invalid values', 'Please enter realistic height (cm) and weight (kg).');
        setSaving(false);
        return;
      }

      await updateProfile({ height: h, weight: w });
      await AsyncStorage.setItem('user_fitness_goal', selectedGoal ?? '');
      await AsyncStorage.setItem('user_fitness_level', selectedLevel ?? '');
      await AsyncStorage.setItem('user_training_days', String(trainingDays));

      // Pre-create default goals based on selection
      const stepGoal = selectedLevel === 'beginner' ? 7000 : selectedLevel === 'intermediate' ? 10000 : 12000;
      const runGoal  = trainingDays >= 4 ? 10 : trainingDays >= 3 ? 7 : 5;

      const deadline30  = new Date(); deadline30.setDate(deadline30.getDate() + 30);
      const deadline90  = new Date(); deadline90.setDate(deadline90.getDate() + 90);

      await Promise.all([
        databaseService.saveGoal({ userId: user.id, type: 'steps', target: stepGoal, current: 0, unit: 'steps', startDate: new Date(), deadline: deadline30, completed: false }),
        databaseService.saveGoal({ userId: user.id, type: 'water', target: 8, current: 0, unit: 'glasses', startDate: new Date(), deadline: deadline30, completed: false }),
        databaseService.saveGoal({ userId: user.id, type: 'calories', target: 500, current: 0, unit: 'kcal', startDate: new Date(), deadline: deadline30, completed: false }),
        databaseService.saveGoal({ userId: user.id, type: 'running', target: runGoal, current: 0, unit: 'km', startDate: new Date(), deadline: deadline90, completed: false }),
      ]);

      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, 'complete');
      navigation.replace('Main');
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const current = STEPS[step];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: Platform.OS === 'ios' ? 72 : 48 }]}
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
                  <Text style={{ color: trainingDays === d ? '#000' : colors.text, fontWeight: '800', fontSize: 18 }}>{d}</Text>
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
              <Text style={{ fontSize: 14 }}>🔒</Text>
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
          <Text style={[styles.btnText, { color: canProceed() ? '#000' : colors.textDisabled }]}>
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
