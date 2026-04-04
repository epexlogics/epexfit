import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { DailyLog } from '../../types';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import moment from 'moment';

const MOOD_OPTIONS: { value: 1 | 2 | 3 | 4 | 5; icon: string; label: string; color: string }[] = [
  { value: 1, icon: 'emoticon-dead',     label: 'Terrible', color: '#F44336' },
  { value: 2, icon: 'emoticon-sad',      label: 'Bad',      color: '#FF5722' },
  { value: 3, icon: 'emoticon-neutral',  label: 'Okay',     color: '#FFC107' },
  { value: 4, icon: 'emoticon-happy',    label: 'Good',     color: '#8BC34A' },
  { value: 5, icon: 'emoticon-excited',  label: 'Great',    color: '#4CAF50' },
];

interface LogForm {
  water: string;
  protein: string;
  fiber: string;
  sleep: string;
  mood: 1 | 2 | 3 | 4 | 5;
  notes: string;
}

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [existingLog, setExistingLog] = useState<DailyLog | null>(null);
  // FIXED: Auto-save indicator (no more manual save button)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [form, setForm] = useState<LogForm>({
    water: '', protein: '', fiber: '', sleep: '', mood: 3, notes: '',
  });

  // Ref to hold latest form for blur-save
  const formRef = useRef<LogForm>(form);
  formRef.current = form;
  const existingLogRef = useRef<DailyLog | null>(existingLog);
  existingLogRef.current = existingLog;

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTodayLog = async () => {
    if (!user) return;
    const { data } = await databaseService.getDailyLog(user.id, new Date());
    if (data) {
      setExistingLog(data);
      setForm({
        water: data.water ? String(data.water) : '',
        protein: data.protein ? String(data.protein) : '',
        fiber: data.fiber ? String(data.fiber) : '',
        sleep: data.sleep ? String(data.sleep) : '',
        mood: data.mood || 3,
        notes: data.notes || '',
      });
    }
    setLoading(false);
  };

  useEffect(() => { if (user) loadTodayLog(); }, [user]);

  const onRefresh = async () => { setRefreshing(true); await loadTodayLog(); setRefreshing(false); };

  // FIXED: Actual save function (no alert, no manual tap needed)
  const performSave = useCallback(async (f: LogForm, log: DailyLog | null) => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      await databaseService.saveDailyLog({
        userId: user.id,
        date: moment().format('YYYY-MM-DD'),
        steps: log?.steps ?? 0,
        distance: log?.distance ?? 0,
        calories: log?.calories ?? 0,
        water: parseInt(f.water) || 0,
        protein: parseInt(f.protein) || 0,
        fiber: parseInt(f.fiber) || 0,
        sleep: parseFloat(f.sleep) || 0,
        mood: f.mood,
        notes: f.notes || undefined,
      });
      // FIXED: Sync goals after log update
      await databaseService.syncGoalProgress(user.id);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch {
      setSaveStatus('idle');
    }
  }, [user]);

  // FIXED: Debounced auto-save — fires 1.5s after last change
  const scheduleAutoSave = useCallback((newForm: LogForm) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      performSave(newForm, existingLogRef.current);
    }, 1500);
  }, [performSave]);

  // FIXED: Save when navigating away (screen loses focus)
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        performSave(formRef.current, existingLogRef.current);
      };
    }, [performSave])
  );

  const updateField = (field: keyof LogForm, value: any) => {
    const newForm = { ...formRef.current, [field]: value };
    setForm(newForm);
    scheduleAutoSave(newForm);
  };

  const quickAdd = (field: 'water' | 'protein' | 'fiber', amount: number) => {
    const cur = parseInt(formRef.current[field] as string) || 0;
    updateField(field, String(cur + amount));
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Daily Log</Text>
          <Text style={[styles.pageDate, { color: colors.textSecondary }]}>{moment().format('dddd, MMMM D')}</Text>
        </View>
        {/* FIXED: Auto-save status indicator replaces manual Save button */}
        <View style={[styles.saveStatus, {
          backgroundColor: saveStatus === 'saved' ? '#00C85320' : saveStatus === 'saving' ? colors.surfaceElevated : 'transparent',
          borderColor: saveStatus === 'saved' ? '#00C85350' : 'transparent',
        }]}>
          {saveStatus === 'saving' && <ActivityIndicator size="small" color={colors.textSecondary} />}
          {saveStatus === 'saved' && <Text style={styles.savedText}>✓ Saved</Text>}
          {saveStatus === 'idle' && <Text style={[styles.autoSaveHint, { color: colors.textDisabled }]}>Auto-saves</Text>}
        </View>
      </View>

      {/* Water */}
      <LogCard title="Water Intake" icon="water" iconColor="#00BCD4">
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.numInput, { color: colors.text, borderColor: colors.border, flex: 1 }]}
            placeholder="0" placeholderTextColor={colors.textDisabled}
            value={form.water} onChangeText={(v) => updateField('water', v)} keyboardType="numeric"
          />
          <View style={styles.quickBtns}>
            {[200, 250, 500].map((a) => (
              <TouchableOpacity key={a} style={[styles.quickBtn, { backgroundColor: '#00BCD420' }]} onPress={() => quickAdd('water', a)}>
                <Text style={{ color: '#00BCD4', fontSize: 12, fontWeight: '600' }}>+{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Recommended: {user?.weight ? Math.round(user.weight * 35) : 2450} ml/day
        </Text>
      </LogCard>

      {/* Protein */}
      <LogCard title="Protein Intake" icon="food-steak" iconColor="#9C27B0">
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.numInput, { color: colors.text, borderColor: colors.border, flex: 1 }]}
            placeholder="0" placeholderTextColor={colors.textDisabled}
            value={form.protein} onChangeText={(v) => updateField('protein', v)} keyboardType="numeric"
          />
          <View style={styles.quickBtns}>
            {[20, 30, 50].map((a) => (
              <TouchableOpacity key={a} style={[styles.quickBtn, { backgroundColor: '#9C27B020' }]} onPress={() => quickAdd('protein', a)}>
                <Text style={{ color: '#9C27B0', fontSize: 12, fontWeight: '600' }}>+{a}g</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Recommended: {user?.weight ? Math.round(user.weight * 1.6) : 112}g/day
        </Text>
      </LogCard>

      {/* Fiber */}
      <LogCard title="Fiber Intake" icon="leaf" iconColor="#4CAF50">
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.numInput, { color: colors.text, borderColor: colors.border, flex: 1 }]}
            placeholder="0" placeholderTextColor={colors.textDisabled}
            value={form.fiber} onChangeText={(v) => updateField('fiber', v)} keyboardType="numeric"
          />
          <View style={styles.quickBtns}>
            {[5, 10, 15].map((a) => (
              <TouchableOpacity key={a} style={[styles.quickBtn, { backgroundColor: '#4CAF5020' }]} onPress={() => quickAdd('fiber', a)}>
                <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>+{a}g</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Recommended: 25–38g/day</Text>
      </LogCard>

      {/* Sleep */}
      <LogCard title="Sleep" icon="sleep" iconColor="#607D8B">
        <TextInput
          style={[styles.numInput, { color: colors.text, borderColor: colors.border }]}
          placeholder="0.0" placeholderTextColor={colors.textDisabled}
          value={form.sleep} onChangeText={(v) => updateField('sleep', v)} keyboardType="decimal-pad"
        />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Recommended: 7–9 hours/night</Text>
      </LogCard>

      {/* Mood */}
      <LogCard title="Today's Mood" icon="emoticon" iconColor="#FF9800">
        <View style={styles.moodRow}>
          {MOOD_OPTIONS.map((option) => {
            const selected = form.mood === option.value;
            return (
              <TouchableOpacity key={option.value} onPress={() => updateField('mood', option.value)}
                style={[styles.moodBtn, { backgroundColor: selected ? option.color + '25' : colors.surfaceElevated, borderColor: selected ? option.color : 'transparent', borderWidth: selected ? 1.5 : 0 }]}>
                <AppIcon name={option.icon} size={30} color={selected ? option.color : colors.textDisabled} />
                <Text style={[styles.moodLabel, { color: selected ? option.color : colors.textDisabled }]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LogCard>

      {/* Notes */}
      <LogCard title="Notes" icon="note-text" iconColor={colors.info}>
        <TextInput
          style={[styles.notesInput, { color: colors.text, borderColor: colors.border }]}
          placeholder="How did you feel today? Any observations..."
          placeholderTextColor={colors.textDisabled}
          value={form.notes} onChangeText={(v) => updateField('notes', v)}
          multiline numberOfLines={4} textAlignVertical="top"
        />
      </LogCard>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  pageDate: { fontSize: 14, marginTop: 4 },
  saveStatus: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  savedText: { fontSize: 12, fontWeight: '700', color: '#00C853' },
  autoSaveHint: { fontSize: 11, fontWeight: '500' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numInput: { borderWidth: 1.5, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600' },
  quickBtns: { flexDirection: 'row', gap: 6 },
  quickBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: borderRadius.sm },
  hint: { fontSize: 12 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: borderRadius.md, gap: 4, marginHorizontal: 2 },
  moodLabel: { fontSize: 9, fontWeight: '600' },
  notesInput: { borderWidth: 1.5, borderRadius: borderRadius.md, padding: 14, fontSize: 14, minHeight: 100 },
});
