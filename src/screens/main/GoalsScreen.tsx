import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnitSystem } from '../../utils/units';
import { databaseService } from '../../services/database';
import { Goal } from '../../types';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import { TAB_BAR_HEIGHT } from '../../constants/layout';
import dayjs from '../../utils/dayjs';

const GOAL_PRESETS = [
  { type: 'steps', label: 'Daily Steps', icon: 'shoe-print', unit: 'steps', defaultTarget: 10000, period: 'daily', description: 'Walk 10,000 steps every day', color: '#4ADE80', minTarget: 1000, maxTarget: 30000, stepSize: 500 },
  { type: 'running', label: 'Running Distance', icon: 'run', unit: 'km', defaultTarget: 5, period: 'weekly', description: 'Run 5 km per week', color: '#FB7185', minTarget: 1, maxTarget: 100, stepSize: 1 },
  { type: 'water', label: 'Water Intake', icon: 'water', unit: 'glasses', defaultTarget: 8, period: 'daily', description: 'Drink 8 glasses of water daily', color: '#22D3EE', minTarget: 4, maxTarget: 20, stepSize: 1 },
  { type: 'calories', label: 'Calorie Burn', icon: 'fire', unit: 'kcal', defaultTarget: 500, period: 'daily', description: 'Burn 500 calories daily', color: '#FB7185', minTarget: 100, maxTarget: 2000, stepSize: 50 },
  { type: 'weight', label: 'Target Weight', icon: 'scale-bathroom', unit: 'kg', defaultTarget: 70, period: 'longterm', description: 'Reach your ideal weight', color: '#38BDF8', minTarget: 30, maxTarget: 200, stepSize: 0.5 },
  { type: 'protein', label: 'Protein Intake', icon: 'food-steak', unit: 'g', defaultTarget: 120, period: 'daily', description: 'Eat 120g protein every day', color: '#A78BFA', minTarget: 30, maxTarget: 300, stepSize: 5 },
] as const;

type GoalPreset = (typeof GOAL_PRESETS)[number];

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const p = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: color + '22', overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${p * 100}%`, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export default function GoalsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const unitSystem = useUnitSystem();
  const periodColors: Record<string, string> = {
    daily: colors.success,
    weekly: colors.warning,
    longterm: colors.metricDistance,
  };
  const [goals, setGoals] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<GoalPreset>(GOAL_PRESETS[0]);
  const [targetValue, setTargetValue] = useState(String(GOAL_PRESETS[0].defaultTarget));
  const [saving, setSaving] = useState(false);
  
  // Edit modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editTargetValue, setEditTargetValue] = useState('');

  const getPresetByType = (type: string) => GOAL_PRESETS.find((p) => p.type === type);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    // FIXED: Sync goal progress from real activity data before displaying
    await databaseService.syncGoalProgress(user.id);
    const { data } = await databaseService.getGoals(user.id);
    setGoals(data ?? []);
  }, [user]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const onRefresh = async () => { setRefreshing(true); await loadGoals(); setRefreshing(false); };

  const openModal = () => {
    setSelectedPreset(GOAL_PRESETS[0]);
    setTargetValue(String(GOAL_PRESETS[0].defaultTarget));
    setShowModal(true);
  };

  const handleSelectPreset = (preset: GoalPreset) => {
    setSelectedPreset(preset);
    setTargetValue(String(preset.defaultTarget));
  };

  const handleAddGoal = async () => {
    if (!user) return;
    const target = parseFloat(targetValue);
    if (isNaN(target) || target <= 0) { Alert.alert('Invalid Target', 'Please enter a valid target value.'); return; }
    const exists = goals.find((g) => g.type === selectedPreset.type);
    if (exists) { Alert.alert('Goal Exists', `You already have a ${selectedPreset.label} goal.`); return; }

    setSaving(true);
    const daysMap: Record<string, number> = { daily: 30, weekly: 84, longterm: 180 };
    const deadline = dayjs().add(daysMap[selectedPreset.period] ?? 30, 'days').toDate();

    const { error } = await databaseService.saveGoal({
      userId: user.id,
      type: selectedPreset.type as any,
      target,
      current: 0,
      unit: selectedPreset.unit,
      startDate: new Date(),
      deadline,
      completed: false,
    });
    setSaving(false);

    if (error) { Alert.alert('Error', 'Failed to save goal.'); return; }
    setShowModal(false);
    await loadGoals();
  };

  const handleDeleteGoal = (goal: Goal) => {
    Alert.alert('Delete Goal', `Delete "${goal.type}" goal?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await databaseService.deleteGoal(goal.id); await loadGoals(); },
      },
    ]);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditTargetValue(String(Number(goal.target)));
    setEditModalVisible(true);
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal) return;
    const newTarget = parseFloat(editTargetValue);
    if (isNaN(newTarget) || newTarget <= 0) {
      Alert.alert('Invalid', 'Please enter a valid target');
      return;
    }
    
    const { error } = await databaseService.updateGoal(editingGoal.id, {
      target: newTarget,
    });
    
    if (error) {
      Alert.alert('Error', 'Failed to update goal');
    } else {
      setEditModalVisible(false);
      await loadGoals();
      Alert.alert('Success', 'Goal updated!');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={[styles.header, { }]}>
          <Text style={[styles.title, { color: colors.text }]}>Goals</Text>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openModal}>
            <AppIcon name="plus" size={24} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>

        {goals.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppIcon name="target" size={56} color={colors.textDisabled} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No goals yet</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Set your first goal to start tracking your progress</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={openModal}>
              <Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Add Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.goalsList}>
            {goals.map((goal) => {
              const preset = GOAL_PRESETS.find((p) => p.type === goal.type);
              const progress = Math.min(Number(goal.current) / Number(goal.target), 1);
              const color = preset?.color ?? colors.primary;
              const daysLeft = dayjs(goal.deadline).diff(dayjs(), 'days');

              return (
                <View
                  key={goal.id}
                  style={[styles.goalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.goalTop}>
                    <View style={[styles.goalIconWrap, { backgroundColor: color + '20' }]}>
                      <AppIcon name={preset?.icon ?? 'target'} size={24} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.goalLabel, { color: colors.text }]}>{preset?.label ?? goal.type}</Text>
                      <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>{preset?.description}</Text>
                    </View>
                    <View style={[styles.periodBadge, { backgroundColor: (periodColors[preset?.period ?? 'daily'] ?? colors.primary) + '25' }]}>
                      <Text style={[styles.periodText, { color: periodColors[preset?.period ?? 'daily'] ?? colors.primary }]}>
                        {preset?.period ?? 'daily'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => openEditModal(goal)} style={{ padding: 4 }}>
                        <AppIcon name="pencil" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteGoal(goal)} style={{ padding: 4 }}>
                        <AppIcon name="trash-can" size={18} color={colors.errorSoft} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.goalProgress}>
                    <View style={styles.goalProgressLabels}>
                      <Text style={[styles.goalCurrent, { color: colors.text }]}>
                        {goal.unit === 'km'
                          ? unitSystem === 'imperial'
                            ? `${(Number(goal.current) * 0.621371).toFixed(1)} mi`
                            : `${Number(goal.current).toFixed(1)} km`
                          : `${Number(goal.current).toFixed(0)} ${goal.unit}`}
                      </Text>
                      <Text style={[styles.goalTarget, { color: colors.textSecondary }]}>
                        / {goal.unit === 'km'
                          ? unitSystem === 'imperial'
                            ? `${(Number(goal.target) * 0.621371).toFixed(1)} mi`
                            : `${Number(goal.target).toFixed(1)} km`
                          : `${Number(goal.target).toFixed(0)} ${goal.unit}`}
                      </Text>
                    </View>
                    <ProgressBar progress={progress} color={goal.completed ? colors.success : color} />
                    <View style={styles.goalFooter}>
                      <Text style={[styles.goalPct, { color: color }]}>{Math.round(progress * 100)}% complete</Text>
                      <Text style={[styles.goalDays, { color: colors.textDisabled }]}>
                        {goal.completed ? '✅ Completed' : `${Math.max(daysLeft, 0)} days left`}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <Text style={[styles.hint, { color: colors.textDisabled }]}>Tap ✏️ to edit goal | Tap 🗑️ to delete</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Goal</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CHOOSE GOAL TYPE</Text>
            <View style={styles.presetsGrid}>
              {GOAL_PRESETS.map((preset) => {
                const selected = selectedPreset.type === preset.type;
                return (
                  <TouchableOpacity
                    key={preset.type}
                    onPress={() => handleSelectPreset(preset)}
                    activeOpacity={0.8}
                    style={[styles.presetCard, {
                      backgroundColor: selected ? preset.color + '20' : colors.surface,
                      borderColor: selected ? preset.color : colors.border,
                      borderWidth: selected ? 1.5 : 1,
                    }]}
                  >
                    <AppIcon name={preset.icon} size={26} color={selected ? preset.color : colors.textSecondary} />
                    <Text style={[styles.presetLabel, { color: selected ? preset.color : colors.text }]}>{preset.label}</Text>
                    <Text style={[styles.presetDesc, { color: colors.textSecondary }]}>{preset.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 24 }]}>SET TARGET</Text>
            <View style={[styles.targetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.targetLabel, { color: colors.text }]}>{selectedPreset.label} Target</Text>
              <View style={styles.targetRow}>
                <TouchableOpacity
                  style={[styles.adjustBtn, { backgroundColor: colors.surfaceElevated }]}
                  onPress={() => {
                    const v = parseFloat(targetValue) - selectedPreset.stepSize;
                    if (v >= selectedPreset.minTarget) setTargetValue(String(v));
                  }}
                >
                  <Text style={[styles.adjustBtnText, { color: colors.text }]}>−</Text>
                </TouchableOpacity>
                <View style={styles.targetInputWrap}>
                  <TextInput
                    style={[styles.targetInput, { color: colors.text, borderColor: colors.border }]}
                    value={targetValue}
                    onChangeText={setTargetValue}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  <Text style={[styles.targetUnit, { color: colors.textSecondary }]}>{selectedPreset.unit}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.adjustBtn, { backgroundColor: colors.surfaceElevated }]}
                  onPress={() => {
                    const v = parseFloat(targetValue) + selectedPreset.stepSize;
                    if (v <= selectedPreset.maxTarget) setTargetValue(String(v));
                  }}
                >
                  <Text style={[styles.adjustBtnText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.7 }]}
              onPress={handleAddGoal}
              disabled={saving}
            >
              <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>{saving ? 'Saving...' : 'Add Goal'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Goal Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Goal</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {editingGoal && (() => {
              const preset = getPresetByType(editingGoal.type);
              return (
                <>
                  <View style={[styles.currentGoalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.goalTop}>
                      <View style={[styles.goalIconWrap, { backgroundColor: (preset?.color ?? colors.primary) + '20' }]}>
                        <AppIcon name={preset?.icon ?? 'target'} size={24} color={preset?.color ?? colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.goalLabel, { color: colors.text }]}>{preset?.label ?? editingGoal.type}</Text>
                        <Text style={[styles.goalCurrentSmall, { color: colors.textSecondary }]}>
                          Current Progress: {Number(editingGoal.current).toFixed(0)} / {Number(editingGoal.target).toFixed(0)} {editingGoal.unit}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 24 }]}>NEW TARGET</Text>
                  <View style={[styles.targetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.targetLabel, { color: colors.text }]}>Set New Target ({editingGoal.unit})</Text>
                    <View style={styles.targetRow}>
                      <TouchableOpacity
                        style={[styles.adjustBtn, { backgroundColor: colors.surfaceElevated }]}
                        onPress={() => {
                          let v = parseFloat(editTargetValue) - (preset?.stepSize ?? 1);
                          if (v >= (preset?.minTarget ?? 1)) setEditTargetValue(String(v));
                        }}
                      >
                        <Text style={[styles.adjustBtnText, { color: colors.text }]}>−</Text>
                      </TouchableOpacity>
                      <View style={styles.targetInputWrap}>
                        <TextInput
                          style={[styles.targetInput, { color: colors.text, borderColor: colors.border }]}
                          value={editTargetValue}
                          onChangeText={setEditTargetValue}
                          keyboardType="numeric"
                          textAlign="center"
                        />
                        <Text style={[styles.targetUnit, { color: colors.textSecondary }]}>{editingGoal.unit}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.adjustBtn, { backgroundColor: colors.surfaceElevated }]}
                        onPress={() => {
                          let v = parseFloat(editTargetValue) + (preset?.stepSize ?? 1);
                          if (v <= (preset?.maxTarget ?? 999999)) setEditTargetValue(String(v));
                        }}
                      >
                        <Text style={[styles.adjustBtnText, { color: colors.text }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                    onPress={handleUpdateGoal}
                  >
                    <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Update Goal</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { margin: 16, borderRadius: borderRadius.xl, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: borderRadius.full },
  emptyBtnText: { fontSize: 15, fontWeight: '700' },
  goalsList: { padding: 16, gap: 12 },
  goalCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, gap: 14 },
  goalTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  goalIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  goalLabel: { fontSize: 15, fontWeight: '700' },
  goalDesc: { fontSize: 12, marginTop: 2 },
  periodBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  periodText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  goalProgress: { gap: 8 },
  goalProgressLabels: { flexDirection: 'row', alignItems: 'baseline' },
  goalCurrent: { fontSize: 20, fontWeight: '800' },
  goalTarget: { fontSize: 13, marginLeft: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  goalPct: { fontSize: 12, fontWeight: '700' },
  goalDays: { fontSize: 12 },
  hint: { textAlign: 'center', fontSize: 11, marginTop: 4 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  cancelText: { fontSize: 16, fontWeight: '600' },
  modalScroll: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 12 },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetCard: { width: '47%', borderRadius: borderRadius.lg, padding: 14, gap: 6 },
  presetLabel: { fontSize: 13, fontWeight: '700' },
  presetDesc: { fontSize: 11, lineHeight: 16 },
  targetCard: { borderRadius: borderRadius.lg, borderWidth: 1, padding: 20, gap: 16 },
  targetLabel: { fontSize: 16, fontWeight: '700' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adjustBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  adjustBtnText: { fontSize: 22, fontWeight: '700' },
  targetInputWrap: { flex: 1, alignItems: 'center' },
  targetInput: { fontSize: 28, fontWeight: '800', width: '100%', borderBottomWidth: 2, paddingBottom: 4 },
  targetUnit: { fontSize: 14, marginTop: 4 },
  saveBtn: { marginTop: 24, height: 54, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '800' },
  currentGoalCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md },
  goalCurrentSmall: { fontSize: 12, marginTop: 4 },
});