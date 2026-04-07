/**
 * BodyMeasurementsScreen
 * Track: weight, waist, chest, arms, hips, body fat %
 * Shows trend over time with comparison vs last entry
 * Data stored in Supabase body_measurements table
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase';
import { socialService } from '../../services/socialService';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

interface Measurement {
  id: string;
  date: string;
  weight:    number | null;
  waist:     number | null;
  chest:     number | null;
  arms:      number | null;
  hips:      number | null;
  body_fat:  number | null;
  notes:     string | null;
}

const FIELDS: { key: keyof Omit<Measurement,'id'|'date'|'notes'>; label: string; unit: string; icon: string; color: string }[] = [
  { key: 'weight',   label: 'Weight',        unit: 'kg',  icon: 'scale-bathroom', color: '#F5C842' },
  { key: 'waist',    label: 'Waist',         unit: 'cm',  icon: 'human-male-height', color: '#FF5B5B' },
  { key: 'chest',    label: 'Chest',         unit: 'cm',  icon: 'human-male-height', color: '#4D9FFF' },
  { key: 'arms',     label: 'Arms',          unit: 'cm',  icon: 'arm-flex',       color: '#FF9500' },
  { key: 'hips',     label: 'Hips',          unit: 'cm',  icon: 'human-female',   color: '#C084FC' },
  { key: 'body_fat', label: 'Body Fat',      unit: '%',   icon: 'fire',           color: '#00F5C4' },
];

function delta(curr: number | null, prev: number | null): string | null {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  if (Math.abs(d) < 0.05) return null;
  return `${d > 0 ? '+' : ''}${d.toFixed(1)}`;
}

function deltaColor(key: string, d: string): string {
  const num = parseFloat(d);
  // Lower is better for weight/waist/hips/body_fat; higher is better for chest/arms
  const lowerBetter = ['weight', 'waist', 'hips', 'body_fat'];
  if (lowerBetter.includes(key)) return num < 0 ? '#00C853' : '#FF5B5B';
  return num > 0 ? '#00C853' : '#FF5B5B';
}

export default function BodyMeasurementsScreen({ navigation }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const accent = colors.primary;

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30);
      setMeasurements(data ?? []);
    } catch {}
  };

  useEffect(() => { load(); }, [user?.id]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
      };
      for (const f of FIELDS) {
        const v = parseFloat(form[f.key] ?? '');
        payload[f.key] = isNaN(v) ? null : v;
      }
      payload.notes = form.notes ?? null;

      const { error } = await supabase.from('body_measurements').insert(payload);
      if (error) throw error;

      // Publish weight to social feed if weight was logged
      if (payload.weight != null) {
        socialService.publishFeedEvent('weight_logged', { weight: payload.weight, unit: 'kg' });
      }

      setForm({});
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const latest  = measurements[0] ?? null;
  const previous = measurements[1] ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
    >
      {/* Header */}
      <View style={[styles.header, { }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <AppIcon name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Measurements</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: accent }]}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>
            {showForm ? 'Cancel' : '+ Log'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Log form */}
      {showForm && (
        <View style={[styles.formCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Log Today's Measurements</Text>
          <View style={styles.formGrid}>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{f.label} ({f.unit})</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                  value={form[f.key] ?? ''}
                  onChangeText={(v) => setForm(p => ({ ...p, [f.key]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.textDisabled}
                />
              </View>
            ))}
          </View>
          <TextInput
            style={[styles.notesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={form.notes ?? ''}
            onChangeText={(v) => setForm(p => ({ ...p, notes: v }))}
            placeholder="Notes (optional)..."
            placeholderTextColor={colors.textDisabled}
            multiline
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>
              {saving ? 'Saving...' : 'Save Measurements'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Latest vs previous comparison */}
      {latest && (
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Latest Entry</Text>
          <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{dayjs(latest.date).format('MMM D, YYYY')}</Text>
          <View style={styles.metricsGrid}>
            {FIELDS.map((f) => {
              const val = latest[f.key];
              if (val == null) return null;
              const d = delta(val, previous ? previous[f.key] : null);
              return (
                <View key={f.key} style={[styles.metricItem, { backgroundColor: colors.surface, borderColor: f.color + '30' }]}>
                  <View style={[styles.metricIcon, { backgroundColor: f.color + '18' }]}>
                    <AppIcon name={f.icon} size={14} color={f.color} />
                  </View>
                  <Text style={[styles.metricVal, { color: colors.text }]}>{val}{f.unit}</Text>
                  {d && (
                    <Text style={[styles.metricDelta, { color: deltaColor(f.key, d) }]}>{d}</Text>
                  )}
                  <Text style={[styles.metricLbl, { color: colors.textSecondary }]}>{f.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* History list */}
      {measurements.length > 1 && (
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginBottom: 110 }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>History</Text>
          {measurements.slice(1).map((m, i) => {
            const prev = measurements.find((_, j) => j === measurements.indexOf(m) + 1);
            return (
              <View key={m.id} style={[styles.historyRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.historyDate, { color: colors.textSecondary }]}>{dayjs(m.date).format('MMM D')}</Text>
                <View style={styles.historyVals}>
                  {FIELDS.filter(f => m[f.key] != null).slice(0, 3).map(f => (
                    <Text key={f.key} style={[styles.historyVal, { color: colors.text }]}>
                      {m[f.key]}{f.unit}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {measurements.length === 0 && !showForm && (
        <View style={[styles.empty, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={{ fontSize: 40, textAlign: 'center' }}>📏</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Start tracking your body</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Log measurements weekly to see real progress beyond the scale.</Text>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accent }]} onPress={() => setShowForm(true)}>
            <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Log First Entry</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  formCard: { margin: 16, borderRadius: borderRadius.xl, borderWidth: 1, padding: 18, gap: 14 },
  formTitle: { fontSize: 16, fontWeight: '800' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fieldWrap: { width: '47%' },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
  fieldInput: { height: 42, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontWeight: '700' },
  notesInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13, minHeight: 60 },
  saveBtn: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  card: { margin: 16, borderRadius: borderRadius.xl, borderWidth: 1, padding: 16, gap: 12, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardDate: { fontSize: 12, marginTop: -8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricItem: { width: '30%', borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center', gap: 3 },
  metricIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricVal: { fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  metricDelta: { fontSize: 11, fontWeight: '700' },
  metricLbl: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  historyDate: { fontSize: 12, fontWeight: '600', width: 52 },
  historyVals: { flex: 1, flexDirection: 'row', gap: 12 },
  historyVal: { fontSize: 12, fontWeight: '700' },
  empty: { margin: 16, borderRadius: borderRadius.xl, borderWidth: 1, padding: 28, gap: 10, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});