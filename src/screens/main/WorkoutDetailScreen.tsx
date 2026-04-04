import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import moment from 'moment';

const TYPE_COLORS: Record<string, string> = {
  Cardio: '#FF5722', Strength: '#2196F3', Yoga: '#9C27B0',
  HIIT: '#F44336', Stretching: '#4CAF50', Other: '#607D8B',
};
const TYPE_ICONS: Record<string, string> = {
  Cardio: 'run', Strength: 'dumbbell', Yoga: 'leaf',
  HIIT: 'fire', Stretching: 'human-male-height', Other: 'fitness',
};

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default function WorkoutDetailScreen({ route, navigation }: any) {
  const { workout } = route.params;
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const typeColor = TYPE_COLORS[workout.type] ?? colors.primary;
  const accent = colors.primary;

  const handleDelete = () => {
    Alert.alert('Delete Workout', `Delete "${workout.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await databaseService.deleteWorkout(workout.id); navigation.goBack(); } },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Back button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <AppIcon name="chevron-left" size={22} color={colors.text} />
        <Text style={[styles.backText, { color: colors.text }]}>Workouts</Text>
      </TouchableOpacity>

      {/* Header card */}
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.typeIconWrap, { backgroundColor: typeColor + '20' }]}>
          <AppIcon name={TYPE_ICONS[workout.type] ?? 'fitness'} size={40} color={typeColor} />
        </View>
        <Text style={[styles.workoutName, { color: colors.text }]}>{workout.name}</Text>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>{workout.type}</Text>
        </View>
        {workout.completed && (
          <View style={[styles.completedTag, { backgroundColor: '#4CAF5020', borderColor: '#4CAF5040' }]}>
            <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 13 }}>✓ Completed</Text>
          </View>
        )}
        <View style={[styles.statsRow, { borderTopColor: colors.divider }]}>
          {[
            { icon: 'timer', val: formatDuration(workout.duration), lbl: 'Duration' },
            { icon: 'fire', val: `${workout.calories}`, lbl: 'Est. Kcal' },
            { icon: 'dumbbell', val: `${workout.exercises.length}`, lbl: 'Exercises' },
            { icon: 'calendar', val: moment(workout.scheduledDate).format('MMM D'), lbl: 'Scheduled' },
          ].map((s) => (
            <View key={s.lbl} style={styles.statItem}>
              <AppIcon name={s.icon} size={18} color={typeColor} />
              <Text style={[styles.statValue, { color: colors.text }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.lbl}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* START WORKOUT button — routes to ActiveWorkoutScreen */}
      {!workout.completed && (
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: accent }]}
          onPress={() => navigation.navigate('ActiveWorkout', { workout })}
          activeOpacity={0.88}
        >
          <AppIcon name="play" size={22} color="#000" />
          <Text style={styles.startBtnText}>Start Workout</Text>
        </TouchableOpacity>
      )}

      {/* Exercises list */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Exercises</Text>
          <Text style={[styles.exCount, { color: colors.textSecondary }]}>
            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {workout.exercises.length === 0 ? (
          <Text style={[styles.noExText, { color: colors.textSecondary }]}>No exercises added.</Text>
        ) : (
          workout.exercises.map((ex: any, i: number) => (
            <View key={ex.id || i} style={[styles.exerciseItem, { backgroundColor: colors.surfaceElevated }, i > 0 && { marginTop: 8 }]}>
              <View style={[styles.exNum, { backgroundColor: accent + '20' }]}>
                <Text style={[styles.exNumText, { color: accent }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exName, { color: colors.text }]}>{ex.name}</Text>
                <View style={styles.exPills}>
                  <View style={[styles.pill, { backgroundColor: accent + '20' }]}>
                    <Text style={[styles.pillText, { color: accent }]}>{ex.sets} sets</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: accent + '20' }]}>
                    <Text style={[styles.pillText, { color: accent }]}>{ex.reps} reps</Text>
                  </View>
                  {ex.weight != null && (
                    <View style={[styles.pill, { backgroundColor: colors.surfaceHighlight }]}>
                      <Text style={[styles.pillText, { color: colors.textSecondary }]}>{ex.weight} kg</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {workout.notes ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 8 }]}>Notes</Text>
          <Text style={[styles.notesText, { color: colors.textSecondary }]}>{workout.notes}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.deleteBtn, { borderColor: colors.error + '50' }]} onPress={handleDelete}>
        <Text style={[styles.deleteBtnText, { color: colors.error }]}>Delete Workout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingBottom: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  headerCard: { margin: 16, borderRadius: borderRadius.xl, borderWidth: 1, padding: 20, alignItems: 'center', gap: 10 },
  typeIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  workoutName: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  typeBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: borderRadius.full },
  typeBadgeText: { fontSize: 13, fontWeight: '700' },
  completedTag: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', borderTopWidth: 1, paddingTop: 16 },
  statItem: { alignItems: 'center', gap: 6 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 58, borderRadius: 999, marginHorizontal: 16, marginBottom: 8, gap: 10 },
  startBtnText: { color: '#000', fontWeight: '900', fontSize: 17, letterSpacing: 0.3 },
  card: { margin: 16, marginTop: 0, marginBottom: 8, borderRadius: borderRadius.xl, borderWidth: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  exCount: { fontSize: 13 },
  noExText: { fontSize: 14, fontStyle: 'italic', paddingVertical: 8 },
  exerciseItem: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 12, gap: 12 },
  exNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  exNumText: { fontSize: 13, fontWeight: '800' },
  exName: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  exPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  pillText: { fontSize: 12, fontWeight: '600' },
  notesText: { fontSize: 14, lineHeight: 22 },
  deleteBtn: { marginHorizontal: 16, marginTop: 4, marginBottom: 8, height: 48, borderRadius: borderRadius.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '700' },
});
