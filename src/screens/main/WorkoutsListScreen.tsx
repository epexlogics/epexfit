import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { Workout } from '../../types';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import moment from 'moment';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 100 : 88;
const WORKOUT_TYPES = ['Cardio', 'Strength', 'Yoga', 'HIIT', 'Stretching', 'Other'];

interface ExerciseForm { name: string; sets: string; reps: string; weight: string; }
const EMPTY_EX: ExerciseForm = { name: '', sets: '3', reps: '10', weight: '' };

const TYPE_ICONS: Record<string, string> = { Cardio: 'run', Strength: 'dumbbell', Yoga: 'leaf', HIIT: 'fire', Stretching: 'human-male-height', Other: 'fitness' };
const TYPE_COLORS: Record<string, string> = { Cardio: '#FF5722', Strength: '#2196F3', Yoga: '#9C27B0', HIIT: '#F44336', Stretching: '#4CAF50', Other: '#607D8B' };

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default function WorkoutsListScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'details' | 'exercises'>('details');

  const [form, setForm] = useState({ name: '', type: 'Strength', duration: '', calories: '', notes: '' });
  const [exercises, setExercises] = useState<ExerciseForm[]>([]);
  const [currentEx, setCurrentEx] = useState<ExerciseForm>({ ...EMPTY_EX });

  const load = async () => {
    if (!user) return;
    const { data } = await databaseService.getWorkouts(user.id);
    setWorkouts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resetModal = () => {
    setForm({ name: '', type: 'Strength', duration: '', calories: '', notes: '' });
    setExercises([]);
    setCurrentEx({ ...EMPTY_EX });
    setStep('details');
    setShowModal(false);
  };

  const addExercise = () => {
    if (!currentEx.name.trim()) { Alert.alert('Missing', 'Enter exercise name'); return; }
    setExercises((prev) => [...prev, { ...currentEx }]);
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
        exercises: exercises.map((ex) => ({ id: '', name: ex.name.trim(), sets: parseInt(ex.sets) || 3, reps: parseInt(ex.reps) || 10, weight: ex.weight ? parseFloat(ex.weight) : undefined })),
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

  if (loading) {
    return <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Workouts</Text>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
            <AppIcon name="plus" size={24} color="#000000" />
          </TouchableOpacity>
        </View>

        {workouts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppIcon name="dumbbell" size={64} color={colors.textDisabled} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Workouts Yet</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Plan your first workout — add exercises, sets, and reps!</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyBtnText}>Add Workout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {workouts.map((workout) => {
              const color = TYPE_COLORS[workout.type] ?? '#607D8B';
              return (
                <TouchableOpacity
                  key={workout.id}
                  style={[styles.workoutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => navigation.navigate('WorkoutDetail', { workout })}
                  activeOpacity={0.85}
                >
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
                        <Text style={[styles.workoutDate, { color: colors.textSecondary }]}>
                          {moment(workout.scheduledDate).format('MMM D')}
                        </Text>
                      </View>
                    </View>
                    {workout.completed && <AppIcon name="check-circle" size={20} color="#4CAF50" />}
                  </View>
                  <View style={[styles.workoutStats, { borderTopColor: colors.divider }]}>
                    {[
                      { icon: 'timer', val: formatDuration(workout.duration) },
                      { icon: 'fire', val: `${workout.calories} kcal` },
                      { icon: 'dumbbell', val: `${workout.exercises.length} exercises` },
                    ].map((s) => (
                      <View key={s.icon} style={styles.statItem}>
                        <AppIcon name={s.icon} size={14} color={colors.textSecondary} />
                        <Text style={[styles.statText, { color: colors.textSecondary }]}>{s.val}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {step === 'details' ? 'New Workout' : 'Add Exercises'}
              </Text>
              <TouchableOpacity onPress={resetModal}>
                <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {step === 'details' ? (
                <>
                  {[
                    { label: 'WORKOUT NAME', val: form.name, key: 'name', placeholder: 'e.g. Morning Strength', keyboard: 'default' },
                    { label: 'DURATION (minutes)', val: form.duration, key: 'duration', placeholder: '45', keyboard: 'numeric' },
                    { label: 'ESTIMATED CALORIES', val: form.calories, key: 'calories', placeholder: '300', keyboard: 'numeric' },
                  ].map((f) => (
                    <View key={f.key} style={styles.fieldGroup}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{f.label}</Text>
                      <TextInput
                        style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                        value={f.val}
                        onChangeText={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                        placeholder={f.placeholder}
                        placeholderTextColor={colors.textDisabled}
                        keyboardType={f.keyboard as any}
                      />
                    </View>
                  ))}

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>WORKOUT TYPE</Text>
                  <View style={styles.typeGrid}>
                    {WORKOUT_TYPES.map((t) => {
                      const selected = form.type === t;
                      const c = TYPE_COLORS[t];
                      return (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setForm((p) => ({ ...p, type: t }))}
                          style={[styles.typeChip, { backgroundColor: selected ? c + '25' : colors.surfaceElevated, borderColor: selected ? c : colors.border }]}
                        >
                          <AppIcon name={TYPE_ICONS[t]} size={16} color={selected ? c : colors.textSecondary} />
                          <Text style={[styles.typeChipText, { color: selected ? c : colors.textSecondary }]}>{t}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={() => setStep('exercises')}>
                    <Text style={styles.nextBtnText}>Next: Add Exercises</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Added exercises */}
                  {exercises.map((ex, i) => (
                    <View key={i} style={[styles.addedEx, { backgroundColor: colors.surfaceElevated }]}>
                      <Text style={[styles.addedExName, { color: colors.text }]}>{ex.name}</Text>
                      <Text style={[styles.addedExMeta, { color: colors.textSecondary }]}>{ex.sets} sets × {ex.reps} reps{ex.weight ? ` @ ${ex.weight}kg` : ''}</Text>
                      <TouchableOpacity onPress={() => setExercises((p) => p.filter((_, j) => j !== i))}>
                        <AppIcon name="alert-circle" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add exercise form */}
                  <View style={[styles.exForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.exFormTitle, { color: colors.text }]}>Add Exercise</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                      value={currentEx.name}
                      onChangeText={(v) => setCurrentEx((p) => ({ ...p, name: v }))}
                      placeholder="Exercise name (e.g. Bench Press)"
                      placeholderTextColor={colors.textDisabled}
                    />
                    <View style={styles.exMetaRow}>
                      {[
                        { label: 'Sets', val: currentEx.sets, key: 'sets' },
                        { label: 'Reps', val: currentEx.reps, key: 'reps' },
                        { label: 'Weight (kg)', val: currentEx.weight, key: 'weight' },
                      ].map((f) => (
                        <View key={f.key} style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontSize: 10 }]}>{f.label}</Text>
                          <TextInput
                            style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                            value={f.val}
                            onChangeText={(v) => setCurrentEx((p) => ({ ...p, [f.key]: v }))}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textDisabled}
                          />
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity style={[styles.addExBtn, { borderColor: colors.primary }]} onPress={addExercise}>
                      <AppIcon name="plus" size={18} color={colors.primary} />
                      <Text style={[styles.addExBtnText, { color: colors.primary }]}>Add Exercise</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => setStep('details')}>
                      <Text style={[styles.backBtnText, { color: colors.text }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.7 }]} onPress={saveWorkout} disabled={saving}>
                      <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Workout'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 60 : 44 },
  headerTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { margin: 16, borderRadius: borderRadius.xl, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: borderRadius.full },
  emptyBtnText: { color: '#000000', fontWeight: '800' },
  list: { padding: 16, gap: 12 },
  workoutCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, gap: 12 },
  workoutTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  workoutIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  workoutName: { fontSize: 16, fontWeight: '700' },
  workoutMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  workoutDate: { fontSize: 12 },
  workoutStats: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12, gap: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  cancelText: { fontSize: 16, fontWeight: '600' },
  modalScroll: { padding: 20, paddingBottom: 40 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginBottom: 8 },
  fieldInput: { borderWidth: 1.5, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1 },
  typeChipText: { fontSize: 13, fontWeight: '600' },
  nextBtn: { height: 54, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#000000', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  addedEx: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: borderRadius.md, marginBottom: 8 },
  addedExName: { flex: 1, fontSize: 14, fontWeight: '600' },
  addedExMeta: { fontSize: 12, marginRight: 8 },
  exForm: { borderRadius: borderRadius.xl, borderWidth: 1, padding: 16, gap: 12, marginBottom: 16 },
  exFormTitle: { fontSize: 15, fontWeight: '700' },
  exMetaRow: { flexDirection: 'row', gap: 10 },
  addExBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: borderRadius.md, borderWidth: 1.5, gap: 8 },
  addExBtnText: { fontSize: 14, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12 },
  backBtn: { flex: 1, height: 54, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  backBtnText: { fontSize: 15, fontWeight: '700' },
  saveBtn: { flex: 2, height: 54, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#000000', fontSize: 15, fontWeight: '800' },
});
