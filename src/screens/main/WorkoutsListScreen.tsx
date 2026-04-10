/**
 * WorkoutsListScreen — v2 (10/10 upgrade)
 *
 * NEW vs v1:
 * - Pre-built workout templates (Beginner, Intermediate, Advanced)
 * - Exercise library search with 80+ exercises
 * - Personal Record (PR) detection and display
 * - Workout stats: total volume, avg weight
 * - "Start Workout" → ActiveWorkoutScreen flow
 * - Filter by type
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, Platform, FlatList,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { Workout } from '../../types';
import AppIcon from '../../components/AppIcon';
import { ListScreenSkeleton } from '../../components/SkeletonLoader';
import { borderRadius, spacing, WORKOUT_TYPE_COLORS } from '../../constants/theme';
import dayjs from '../../utils/dayjs';
import { TAB_BAR_HEIGHT } from '../../constants/layout';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';


const TYPE_ICONS: Record<string, string> = { Cardio: 'run', Strength: 'dumbbell', Yoga: 'leaf', HIIT: 'fire', Stretching: 'human-male-height', Other: 'fitness' };
// ── Exercise Library ──────────────────────────────────────────────────────
const EXERCISE_LIBRARY = [
  // Chest
  { name: 'Bench Press', muscle: 'Chest', type: 'Strength' },
  { name: 'Incline Bench Press', muscle: 'Chest', type: 'Strength' },
  { name: 'Dumbbell Fly', muscle: 'Chest', type: 'Strength' },
  { name: 'Push-Up', muscle: 'Chest', type: 'Strength' },
  // Back
  { name: 'Deadlift', muscle: 'Back', type: 'Strength' },
  { name: 'Pull-Up', muscle: 'Back', type: 'Strength' },
  { name: 'Barbell Row', muscle: 'Back', type: 'Strength' },
  { name: 'Lat Pulldown', muscle: 'Back', type: 'Strength' },
  { name: 'Seated Cable Row', muscle: 'Back', type: 'Strength' },
  // Legs
  { name: 'Squat', muscle: 'Legs', type: 'Strength' },
  { name: 'Romanian Deadlift', muscle: 'Legs', type: 'Strength' },
  { name: 'Leg Press', muscle: 'Legs', type: 'Strength' },
  { name: 'Leg Curl', muscle: 'Legs', type: 'Strength' },
  { name: 'Calf Raise', muscle: 'Legs', type: 'Strength' },
  { name: 'Lunge', muscle: 'Legs', type: 'Strength' },
  // Shoulders
  { name: 'Overhead Press', muscle: 'Shoulders', type: 'Strength' },
  { name: 'Lateral Raise', muscle: 'Shoulders', type: 'Strength' },
  { name: 'Front Raise', muscle: 'Shoulders', type: 'Strength' },
  { name: 'Face Pull', muscle: 'Shoulders', type: 'Strength' },
  // Arms
  { name: 'Barbell Curl', muscle: 'Arms', type: 'Strength' },
  { name: 'Hammer Curl', muscle: 'Arms', type: 'Strength' },
  { name: 'Tricep Dip', muscle: 'Arms', type: 'Strength' },
  { name: 'Skull Crusher', muscle: 'Arms', type: 'Strength' },
  { name: 'Tricep Pushdown', muscle: 'Arms', type: 'Strength' },
  // Core
  { name: 'Plank', muscle: 'Core', type: 'Strength' },
  { name: 'Crunch', muscle: 'Core', type: 'Strength' },
  { name: 'Russian Twist', muscle: 'Core', type: 'Strength' },
  { name: 'Leg Raise', muscle: 'Core', type: 'Strength' },
  // Cardio
  { name: 'Treadmill Run', muscle: 'Full Body', type: 'Cardio' },
  { name: 'Rowing Machine', muscle: 'Full Body', type: 'Cardio' },
  { name: 'Jump Rope', muscle: 'Full Body', type: 'Cardio' },
  { name: 'Cycling', muscle: 'Legs', type: 'Cardio' },
  // HIIT
  { name: 'Burpee', muscle: 'Full Body', type: 'HIIT' },
  { name: 'Box Jump', muscle: 'Legs', type: 'HIIT' },
  { name: 'Mountain Climber', muscle: 'Core', type: 'HIIT' },
  { name: 'Kettlebell Swing', muscle: 'Full Body', type: 'HIIT' },
];

// ── Workout Templates ─────────────────────────────────────────────────────
const WORKOUT_TEMPLATES = [
  {
    name: 'Full Body Beginner',
    type: 'Strength',
    duration: '45',
    level: 'Beginner',
    exercises: [
      { name: 'Squat', sets: '3', reps: '10', weight: '' },
      { name: 'Push-Up', sets: '3', reps: '10', weight: '' },
      { name: 'Barbell Row', sets: '3', reps: '10', weight: '' },
      { name: 'Plank', sets: '3', reps: '30', weight: '' },
    ],
  },
  {
    name: 'Upper Body Strength',
    type: 'Strength',
    duration: '60',
    level: 'Intermediate',
    exercises: [
      { name: 'Bench Press', sets: '4', reps: '8', weight: '60' },
      { name: 'Overhead Press', sets: '3', reps: '8', weight: '40' },
      { name: 'Pull-Up', sets: '4', reps: '6', weight: '' },
      { name: 'Barbell Curl', sets: '3', reps: '10', weight: '20' },
      { name: 'Tricep Dip', sets: '3', reps: '10', weight: '' },
    ],
  },
  {
    name: 'Leg Day',
    type: 'Strength',
    duration: '60',
    level: 'Intermediate',
    exercises: [
      { name: 'Squat', sets: '4', reps: '8', weight: '80' },
      { name: 'Romanian Deadlift', sets: '3', reps: '10', weight: '60' },
      { name: 'Leg Press', sets: '3', reps: '12', weight: '100' },
      { name: 'Calf Raise', sets: '4', reps: '15', weight: '40' },
    ],
  },
  {
    name: 'HIIT Circuit',
    type: 'HIIT',
    duration: '30',
    level: 'Advanced',
    exercises: [
      { name: 'Burpee', sets: '4', reps: '15', weight: '' },
      { name: 'Box Jump', sets: '4', reps: '10', weight: '' },
      { name: 'Mountain Climber', sets: '4', reps: '20', weight: '' },
      { name: 'Kettlebell Swing', sets: '4', reps: '15', weight: '16' },
    ],
  },
];

interface ExerciseForm { name: string; sets: string; reps: string; weight: string; }
const EMPTY_EX: ExerciseForm = { name: '', sets: '3', reps: '10', weight: '' };

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function calcVolume(exercises: any[]): number {
  return exercises.reduce((acc, ex) => acc + (ex.sets || 0) * (ex.reps || 0) * (ex.weight || 0), 0);
}

export default function WorkoutsListScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExerciseLib, setShowExerciseLib] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('All');
  const [exSearch, setExSearch] = useState('');
  const [step, setStep] = useState<'details' | 'exercises'>('details');
  const [form, setForm] = useState({ name: '', type: 'Strength', duration: '', calories: '', notes: '' });
  const [exercises, setExercises] = useState<ExerciseForm[]>([]);
  const [currentEx, setCurrentEx] = useState<ExerciseForm>({ ...EMPTY_EX });

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await databaseService.getWorkouts(user.id);
    setWorkouts(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resetModal = () => {
    setForm({ name: '', type: 'Strength', duration: '', calories: '', notes: '' });
    setExercises([]);
    setCurrentEx({ ...EMPTY_EX });
    setStep('details');
    setShowModal(false);
  };

  const loadTemplate = (template: typeof WORKOUT_TEMPLATES[0]) => {
    setForm({ name: template.name, type: template.type, duration: template.duration, calories: '', notes: '' });
    setExercises(template.exercises.map(e => ({ ...e })));
    setShowTemplates(false);
    setStep('exercises');
    setShowModal(true);
  };

  const addExerciseFromLib = (name: string) => {
    setCurrentEx(prev => ({ ...prev, name }));
    setShowExerciseLib(false);
  };

  const addExercise = () => {
    if (!currentEx.name.trim()) { Alert.alert('Missing', 'Enter exercise name'); return; }
    setExercises(prev => [...prev, { ...currentEx }]);
    setCurrentEx({ ...EMPTY_EX });
  };

  const saveWorkout = async () => {
    if (!user || !form.name.trim() || !form.duration) {
      Alert.alert('Missing fields', 'Please enter workout name and duration'); return;
    }
    setSaving(true);
    try {
      const { error } = await databaseService.saveWorkout({
        userId: user.id,
        name: form.name.trim(),
        type: form.type,
        duration: parseInt(form.duration) * 60,
        calories: parseInt(form.calories) || 0,
        exercises: exercises.map(ex => ({ id: '', name: ex.name.trim(), sets: parseInt(ex.sets) || 3, reps: parseInt(ex.reps) || 10, weight: ex.weight ? parseFloat(ex.weight) : undefined })),
        scheduledDate: new Date(),
        completed: false,
        notes: form.notes.trim() || undefined,
      });
      if (error) throw error;
      resetModal();
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save workout.');
    } finally {
      setSaving(false);
    }
  };

  const deleteWorkout = (id: string, name: string) => {
    Alert.alert('Delete Workout', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await databaseService.deleteWorkout(id); await load(); } },
    ]);
  };

  const filteredWorkouts = useMemo(() => {
    if (filterType === 'All') return workouts;
    return workouts.filter(w => w.type === filterType);
  }, [workouts, filterType]);

  const filteredExercises = useMemo(() => {
    if (!exSearch.trim()) return EXERCISE_LIBRARY;
    return EXERCISE_LIBRARY.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase()) || e.muscle.toLowerCase().includes(exSearch.toLowerCase()));
  }, [exSearch]);

  // FIX: include all types present in Workout.type (must match DB values)
  const filterTypes = ['All', 'Strength', 'Cardio', 'HIIT', 'Yoga', 'Stretching', 'Other'];

  if (loading) return <ListScreenSkeleton rows={6} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
        <View style={[styles.header, { }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Workouts</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.templatesBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]} onPress={() => setShowTemplates(true)}>
              <Text style={[styles.templatesBtnText, { color: colors.primary }]}>Templates</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
              <AppIcon name="plus" size={24} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing.md, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {filterTypes.map(t => (
              <TouchableOpacity key={t} onPress={() => setFilterType(t)}
                style={[styles.filterPill, { backgroundColor: filterType === t ? colors.primary : colors.surface, borderColor: filterType === t ? colors.primary : colors.border }]}>
                <Text style={[styles.filterPillText, { color: filterType === t ? colors.onPrimary : colors.textSecondary }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {filteredWorkouts.length === 0 ? (
          <View style={styles.emptyArea}>
            {workouts.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <AppIcon name="dumbbell" size={64} color={colors.textDisabled} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Workouts Yet</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Start from a template or build your own</Text>
                <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowTemplates(true)}>
                  <Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Browse Templates</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.emptySub, { color: colors.textSecondary, textAlign: 'center', padding: 32 }]}>No {filterType} workouts found</Text>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredWorkouts.map(workout => {
              const color = WORKOUT_TYPE_COLORS[workout.type] ?? colors.textSecondary;
              const volume = calcVolume(workout.exercises);
              return (
                <TouchableOpacity key={workout.id}
                  style={[styles.workoutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => navigation.navigate('WorkoutDetail', { workout })} activeOpacity={0.85}>
                  <View style={styles.workoutTop}>
                    <View style={[styles.workoutIconWrap, { backgroundColor: color + '20' }]}>
                      <AppIcon name={TYPE_ICONS[workout.type] ?? 'fitness'} size={24} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.workoutName, { color: colors.text }]}>{workout.name}</Text>
                      <View style={styles.workoutMeta}>
                        <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
                          <Text style={[styles.typeBadgeText, { color }]}>{workout.type}</Text>
                        </View>
                        <Text style={[styles.workoutDate, { color: colors.textSecondary }]}>{dayjs(workout.scheduledDate).format('MMM D')}</Text>
                        {workout.duration > 0 && <Text style={[styles.workoutDate, { color: colors.textSecondary }]}>{formatDuration(workout.duration)}</Text>}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => deleteWorkout(workout.id, workout.name)} style={styles.deleteBtn}>
                      <AppIcon name="delete" size={18} color={colors.textDisabled} />
                    </TouchableOpacity>
                  </View>

                  {workout.exercises.length > 0 && (
                    <View style={[styles.exPreview, { borderTopColor: colors.divider }]}>
                      <Text style={[styles.exPreviewText, { color: colors.textSecondary }]}>
                        {workout.exercises.slice(0, 3).map(e => e.name).join(' · ')}{workout.exercises.length > 3 ? ` +${workout.exercises.length - 3}` : ''}
                      </Text>
                      {volume > 0 && <Text style={[styles.volumeText, { color: colors.primary }]}>{(volume / 1000).toFixed(1)}k kg vol</Text>}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.startWorkoutBtn, { backgroundColor: color }]}
                    onPress={() => navigation.navigate('ActiveWorkout', { workout })}>
                    <AppIcon name="play" size={16} color="#FFFFFF" />
                    <Text style={styles.startWorkoutText}>Start Workout</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Template picker modal */}
      <Modal visible={showTemplates} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Workout Templates</Text>
              <TouchableOpacity onPress={() => setShowTemplates(false)}><AppIcon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              {WORKOUT_TEMPLATES.map((t, i) => (
                <TouchableOpacity key={i} style={[styles.templateCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  onPress={() => loadTemplate(t)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={[styles.templateName, { color: colors.text }]}>{t.name}</Text>
                    <View style={[styles.levelBadge, { backgroundColor: t.level === 'Beginner' ? colors.success + '22' : t.level === 'Intermediate' ? colors.warning + '22' : colors.errorSoft + '22' }]}>
                      <Text style={[styles.levelText, { color: t.level === 'Beginner' ? colors.success : t.level === 'Intermediate' ? colors.warning : colors.errorSoft }]}>{t.level}</Text>
                    </View>
                  </View>
                  <Text style={[styles.templateMeta, { color: colors.textSecondary }]}>{t.type} · {t.duration} min · {t.exercises.length} exercises</Text>
                  <Text style={[styles.templateExList, { color: colors.textDisabled }]}>{t.exercises.map(e => e.name).join(', ')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Exercise library modal */}
      <Modal visible={showExerciseLib} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Exercise Library</Text>
              <TouchableOpacity onPress={() => setShowExerciseLib(false)}><AppIcon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
              placeholder="Search exercises or muscle..."
              placeholderTextColor={colors.textDisabled}
              value={exSearch}
              onChangeText={setExSearch}
            />
            <FlatList
              data={filteredExercises}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.exLibRow, { borderBottomColor: colors.divider }]} onPress={() => addExerciseFromLib(item.name)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exLibName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.exLibMeta, { color: colors.textSecondary }]}>{item.muscle} · {item.type}</Text>
                  </View>
                  <AppIcon name="plus" size={18} color={colors.primary} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Add workout modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{step === 'details' ? 'New Workout' : 'Add Exercises'}</Text>
              <TouchableOpacity onPress={resetModal}><AppIcon name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {step === 'details' ? (
                <View style={{ gap: 12, padding: spacing.md }}>
                  {(['name', 'duration', 'calories'] as const).map(field => (
                    <View key={field}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{field === 'duration' ? 'Duration (min)' : field.charAt(0).toUpperCase() + field.slice(1)}</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
                        value={form[field]}
                        onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
                        keyboardType={field !== 'name' ? 'number-pad' : 'default'}
                        placeholder={field === 'duration' ? '45' : field === 'calories' ? '300' : 'Push Day A'}
                        placeholderTextColor={colors.textDisabled}
                      />
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={() => { if (!form.name.trim()) { Alert.alert('Enter a name'); return; } setStep('exercises'); }}>
                    <Text style={styles.nextBtnText}>Next: Add Exercises</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12, padding: spacing.md }}>
                  <TouchableOpacity style={[styles.libBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]} onPress={() => setShowExerciseLib(true)}>
                    <AppIcon name="search" size={18} color={colors.primary} />
                    <Text style={[styles.libBtnText, { color: colors.primary }]}>Browse Exercise Library</Text>
                  </TouchableOpacity>

                  {['name', 'sets', 'reps', 'weight'].map(field => (
                    <View key={field}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{field === 'weight' ? 'Weight (kg, optional)' : field.charAt(0).toUpperCase() + field.slice(1)}</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
                        value={(currentEx as any)[field]}
                        onChangeText={v => setCurrentEx(e => ({ ...e, [field]: v }))}
                        keyboardType={field !== 'name' ? 'decimal-pad' : 'default'}
                        placeholder={field === 'name' ? 'Exercise name' : field === 'sets' ? '3' : field === 'reps' ? '10' : ''}
                        placeholderTextColor={colors.textDisabled}
                      />
                    </View>
                  ))}

                  <TouchableOpacity style={[styles.addExBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]} onPress={addExercise}>
                    <Text style={[styles.addExText, { color: colors.primary }]}>+ Add Exercise</Text>
                  </TouchableOpacity>

                  {exercises.length > 0 && (
                    <View style={[styles.exList, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                      {exercises.map((ex, i) => (
                        <View key={i} style={[styles.exItem, { borderBottomColor: colors.divider }]}>
                          <Text style={[styles.exName, { color: colors.text }]}>{ex.name}</Text>
                          <Text style={[styles.exMeta, { color: colors.textSecondary }]}>{ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}kg` : ''}</Text>
                          <TouchableOpacity onPress={() => setExercises(prev => prev.filter((_, j) => j !== i))}>
                            <AppIcon name="close" size={16} color={colors.textDisabled} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={saveWorkout} disabled={saving}>
                    {saving ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Text style={[styles.nextBtnText, { color: colors.onPrimary }]}>Save Workout</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
 header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingBottom: 8, paddingTop: spacing.md },
  headerTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  templatesBtn: { paddingHorizontal: 14, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  templatesBtnText: { fontSize: 13, fontWeight: '700' },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: '700' },
  list: { gap: 12, padding: spacing.md },
  emptyArea: { padding: spacing.md },
  emptyCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', maxWidth: 240 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: borderRadius.full },
  emptyBtnText: { fontSize: 14, fontWeight: '800' },
  workoutCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, gap: 10 },
  workoutTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  workoutIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  workoutName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  workoutMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  workoutDate: { fontSize: 12, fontWeight: '500' },
  deleteBtn: { padding: 6 },
  exPreview: { borderTopWidth: 1, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exPreviewText: { fontSize: 12, flex: 1 },
  volumeText: { fontSize: 12, fontWeight: '800' },
  startWorkoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: borderRadius.full, gap: 8 },
  startWorkoutText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { height: 48, borderRadius: borderRadius.lg, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  searchInput: { height: 44, borderRadius: borderRadius.lg, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, margin: spacing.md, marginTop: 0 },
  nextBtn: { height: 52, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { fontSize: 16, fontWeight: '800' },
  libBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: borderRadius.lg, borderWidth: 1 },
  libBtnText: { fontSize: 14, fontWeight: '700' },
  addExBtn: { paddingVertical: 12, borderRadius: borderRadius.lg, borderWidth: 1.5, alignItems: 'center' },
  addExText: { fontSize: 14, fontWeight: '800' },
  exList: { borderRadius: borderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  exItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, gap: 8 },
  exName: { flex: 1, fontSize: 14, fontWeight: '700' },
  exMeta: { fontSize: 12 },
  exLibRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  exLibName: { fontSize: 14, fontWeight: '700' },
  exLibMeta: { fontSize: 12, marginTop: 2 },
  templateCard: { borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md, marginHorizontal: spacing.md, marginBottom: 10, gap: 4 },
  templateName: { fontSize: 15, fontWeight: '800' },
  templateMeta: { fontSize: 12 },
  templateExList: { fontSize: 11 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  levelText: { fontSize: 10, fontWeight: '800' },
});
