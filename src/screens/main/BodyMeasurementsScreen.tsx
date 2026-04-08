/**
 * BodyMeasurementsScreen — Production-ready body stats tracking
 *
 * ✅ Uses body_stats table (weight, height, bmi, body_fat, chest, waist, arms, legs, date)
 * ✅ Auto-calculates BMI from weight + height
 * ✅ Add new entry (insert)
 * ✅ Edit existing entry (update)
 * ✅ Delete entry (long press)
 * ✅ History list with progress deltas
 * ✅ Latest entry shown prominently
 * ✅ Zero mock data
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnitSystem } from '../../utils/units';
import { supabase } from '../../services/supabase';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

// ── Types ─────────────────────────────────────────────────────────────────

interface BodyStat {
  id: string;
  user_id: string;
  date: string;
  weight:   number | null;
  height:   number | null;
  bmi:      number | null;
  body_fat: number | null;
  chest:    number | null;
  waist:    number | null;
  arms:     number | null;
  legs:     number | null;
}

interface FormState {
  weight:   string;
  height:   string;
  body_fat: string;
  chest:    string;
  waist:    string;
  arms:     string;
  legs:     string;
}

// ── Metric Definitions ────────────────────────────────────────────────────

const METRICS: Array<{
  key: keyof Omit<BodyStat, 'id' | 'user_id' | 'date' | 'bmi'>;
  label: string;
  unit: string;
  icon: string;
  color: string;
  lowerBetter: boolean;
}> = [
  { key: 'weight',   label: 'Weight',   unit: 'kg', icon: 'scale-bathroom',    color: '#F5C842', lowerBetter: false },
  { key: 'height',   label: 'Height',   unit: 'cm', icon: 'human-male-height', color: '#4D9FFF', lowerBetter: false },
  { key: 'body_fat', label: 'Body Fat', unit: '%',  icon: 'fire',              color: '#00F5C4', lowerBetter: true  },
  { key: 'chest',    label: 'Chest',    unit: 'cm', icon: 'arm-flex',          color: '#FF9500', lowerBetter: false },
  { key: 'waist',    label: 'Waist',    unit: 'cm', icon: 'human-male-height', color: '#FF5B5B', lowerBetter: true  },
  { key: 'arms',     label: 'Arms',     unit: 'cm', icon: 'arm-flex',          color: '#C084FC', lowerBetter: false },
  { key: 'legs',     label: 'Legs',     unit: 'cm', icon: 'human-male-height', color: '#22D3EE', lowerBetter: false },
];

/** Convert a stored metric value (always metric) to the display unit */
function toDisplayValue(key: string, value: number | null, unitSystem: 'metric' | 'imperial'): number | null {
  if (value == null) return null;
  if (unitSystem === 'imperial') {
    if (key === 'weight') return parseFloat((value * 2.20462).toFixed(1));
    if (key === 'height') {
      // return total inches for display; formatted separately
      return parseFloat((value * 0.393701).toFixed(1));
    }
    if (['chest','waist','arms','legs'].includes(key)) return parseFloat((value * 0.393701).toFixed(1));
  }
  return value;
}

function displayUnit(key: string, unitSystem: 'metric' | 'imperial'): string {
  if (unitSystem === 'imperial') {
    if (key === 'weight') return 'lbs';
    if (key === 'height') return 'in';
    if (['chest','waist','arms','legs'].includes(key)) return 'in';
  }
  if (key === 'weight') return 'kg';
  if (key === 'height') return 'cm';
  if (['chest','waist','arms','legs'].includes(key)) return 'cm';
  return '%';
}

// ── Helpers ───────────────────────────────────────────────────────────────

function computeBMI(weight: number | null, height: number | null): number | null {
  if (!weight || !height || height === 0) return null;
  const h = height / 100;
  return parseFloat((weight / (h * h)).toFixed(1));
}

function deltaStr(curr: number | null, prev: number | null): string | null {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  if (Math.abs(d) < 0.05) return null;
  return `${d > 0 ? '+' : ''}${d.toFixed(1)}`;
}

function deltaColor(delta: string, lowerBetter: boolean): string {
  const n = parseFloat(delta);
  if (lowerBetter) return n < 0 ? '#00C853' : '#FF5B5B';
  return n > 0 ? '#00C853' : '#FF5B5B';
}

const EMPTY_FORM: FormState = {
  weight: '', height: '', body_fat: '', chest: '', waist: '', arms: '', legs: '',
};

// ── Component ─────────────────────────────────────────────────────────────

export default function BodyMeasurementsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const unitSystem = useUnitSystem();
  const accent = colors.primary;

  const [stats, setStats]       = useState<BodyStat[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('body_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      setStats(data ?? []);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load measurements.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Parse form to payload
  const buildPayload = (f: FormState) => {
    const weight   = parseFloat(f.weight)   || null;
    const height   = parseFloat(f.height)   || null;
    const bmi      = computeBMI(weight, height);
    return {
      weight,
      height,
      bmi,
      body_fat: parseFloat(f.body_fat) || null,
      chest:    parseFloat(f.chest)    || null,
      waist:    parseFloat(f.waist)    || null,
      arms:     parseFloat(f.arms)     || null,
      legs:     parseFloat(f.legs)     || null,
    };
  };

  const openAdd = () => {
    // Pre-fill height from latest entry
    const latest = stats[0];
    setForm({ ...EMPTY_FORM, height: latest?.height ? String(latest.height) : '' });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (stat: BodyStat) => {
    setForm({
      weight:   stat.weight   != null ? String(stat.weight)   : '',
      height:   stat.height   != null ? String(stat.height)   : '',
      body_fat: stat.body_fat != null ? String(stat.body_fat) : '',
      chest:    stat.chest    != null ? String(stat.chest)    : '',
      waist:    stat.waist    != null ? String(stat.waist)    : '',
      arms:     stat.arms     != null ? String(stat.arms)     : '',
      legs:     stat.legs     != null ? String(stat.legs)     : '',
    });
    setEditingId(stat.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user) return;

    const hasAnyValue = Object.values(form).some(v => v.trim() !== '');
    if (!hasAnyValue) {
      Alert.alert('Empty entry', 'Please enter at least one measurement.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form);

      if (editingId) {
        const { error } = await supabase
          .from('body_stats')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('body_stats')
          .insert({
            user_id: user.id,
            date: new Date().toISOString().split('T')[0],
            ...payload,
          });
        if (error) throw error;
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (stat: BodyStat) => {
    Alert.alert(
      'Delete Entry',
      `Delete measurement from ${dayjs(stat.date).format('MMM D, YYYY')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('body_stats')
                .delete()
                .eq('id', stat.id)
                .eq('user_id', user!.id);
              if (error) throw error;
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Failed to delete.');
            }
          },
        },
      ]
    );
  };

  const latest   = stats[0] ?? null;
  const previous = stats[1] ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <AppIcon name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.text }]}>Measurements</Text>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: showForm ? colors.surface : accent, borderColor: accent }]}
            onPress={showForm ? () => { setShowForm(false); setEditingId(null); } : openAdd}
          >
            <Text style={{ color: showForm ? colors.textSecondary : '#000', fontWeight: '800', fontSize: 13 }}>
              {showForm ? 'Cancel' : '+ Log'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Add / Edit Form ──────────────────────────────────────── */}
        {showForm && (
          <View style={[s.formCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[s.formTitle, { color: colors.text }]}>
              {editingId ? 'Edit Entry' : "Today's Measurements"}
            </Text>
            <View style={s.formGrid}>
              {METRICS.map((m) => (
                <View key={m.key} style={s.fieldWrap}>
                  <Text style={[s.fieldLabel, { color: m.color }]}>{m.label} ({displayUnit(m.key, unitSystem)})</Text>
                  <TextInput
                    style={[s.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                    value={form[m.key as keyof FormState]}
                    onChangeText={(v) => setForm(p => ({ ...p, [m.key]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
              ))}
            </View>

            {/* BMI preview */}
            {(form.weight || form.height) && (() => {
              const bmi = computeBMI(parseFloat(form.weight) || null, parseFloat(form.height) || null);
              return bmi ? (
                <View style={[s.bmiPreview, { backgroundColor: accent + '12', borderColor: accent + '30' }]}>
                  <Text style={[s.bmiPreviewText, { color: accent }]}>
                    Calculated BMI: <Text style={{ fontWeight: '900' }}>{bmi}</Text>
                  </Text>
                </View>
              ) : null;
            })()}

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>
                    {editingId ? 'Update Entry' : 'Save Measurements'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── Latest Entry ─────────────────────────────────────────── */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={accent} />
          </View>
        ) : latest ? (
          <>
            <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginHorizontal: 16, marginTop: 16 }]}>
              <View style={s.cardHeader}>
                <View>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Latest Entry</Text>
                  <Text style={[s.cardDate, { color: colors.textSecondary }]}>
                    {dayjs(latest.date).format('MMMM D, YYYY')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.editEntryBtn, { borderColor: accent + '50', backgroundColor: accent + '10' }]}
                  onPress={() => openEdit(latest)}
                >
                  <AppIcon name="pencil" size={14} color={accent} />
                  <Text style={{ fontSize: 12, color: accent, fontWeight: '700' }}>Edit</Text>
                </TouchableOpacity>
              </View>

              {/* BMI if available */}
              {latest.bmi && (
                <View style={[s.bmiCard, { backgroundColor: accent + '10', borderColor: accent + '25' }]}>
                  <Text style={[s.bmiVal, { color: accent }]}>{latest.bmi}</Text>
                  <View>
                    <Text style={[s.bmiLabel, { color: colors.text }]}>BMI</Text>
                    <Text style={[s.bmiCat, { color: colors.textSecondary }]}>
                      {latest.bmi < 18.5 ? 'Underweight' : latest.bmi < 25 ? 'Normal' : latest.bmi < 30 ? 'Overweight' : 'Obese'}
                    </Text>
                  </View>
                </View>
              )}

              <View style={s.metricsGrid}>
                {METRICS.filter(m => latest[m.key] != null).map((m) => {
                  const rawVal = latest[m.key] as number;
                  const displayVal = toDisplayValue(m.key, rawVal, unitSystem);
                  const unit = displayUnit(m.key, unitSystem);
                  const prevRaw = previous ? (previous[m.key] as number | null) : null;
                  const prevDisplay = toDisplayValue(m.key, prevRaw, unitSystem);
                  const d = deltaStr(displayVal, prevDisplay);
                  return (
                    <View key={m.key} style={[s.metricItem, { backgroundColor: colors.surface, borderColor: m.color + '30' }]}>
                      <View style={[s.metricIcon, { backgroundColor: m.color + '18' }]}>
                        <AppIcon name={m.icon} size={14} color={m.color} />
                      </View>
                      <Text style={[s.metricVal, { color: colors.text }]}>{displayVal}{unit}</Text>
                      {d && <Text style={[s.metricDelta, { color: deltaColor(d, m.lowerBetter) }]}>{d}</Text>}
                      <Text style={[s.metricLbl, { color: colors.textSecondary }]}>{m.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── History ──────────────────────────────────────────── */}
            {stats.length > 1 && (
              <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginHorizontal: 16, marginTop: 12, marginBottom: 32 }]}>
                <Text style={[s.cardTitle, { color: colors.text }]}>History</Text>
                {stats.slice(1).map((stat, i) => {
                  const prevStat = stats[i + 2] ?? null;
                  return (
                    <TouchableOpacity
                      key={stat.id}
                      style={[s.historyRow, {
                        borderBottomColor: colors.border,
                        borderBottomWidth: i < stats.length - 2 ? 1 : 0,
                      }]}
                      onLongPress={() => handleDelete(stat)}
                      onPress={() => openEdit(stat)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.historyDate, { color: colors.textSecondary }]}>
                        {dayjs(stat.date).format('MMM D')}
                      </Text>
                      <View style={s.historyVals}>
                        {stat.weight != null && (
                          <Text style={[s.historyVal, { color: colors.text }]}>
                            {unitSystem === 'imperial' ? `${(stat.weight * 2.20462).toFixed(1)}lbs` : `${stat.weight}kg`}
                          </Text>
                        )}
                        {stat.waist != null && (
                          <Text style={[s.historyVal, { color: '#FF5B5B' }]}>
                            W:{unitSystem === 'imperial' ? `${(stat.waist * 0.393701).toFixed(1)}in` : `${stat.waist}cm`}
                          </Text>
                        )}
                        {stat.body_fat != null && (
                          <Text style={[s.historyVal, { color: '#00F5C4' }]}>BF:{stat.body_fat}%</Text>
                        )}
                        {stat.bmi != null && (
                          <Text style={[s.historyVal, { color: colors.textSecondary }]}>BMI:{stat.bmi}</Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => openEdit(stat)}>
                          <AppIcon name="pencil-outline" size={16} color={colors.textDisabled} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(stat)}>
                          <AppIcon name="trash-can-outline" size={16} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <Text style={[s.longPressHint, { color: colors.textDisabled }]}>
                  Tap to edit · Long press to delete
                </Text>
              </View>
            )}
          </>
        ) : !showForm ? (
          <View style={[s.emptyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={{ fontSize: 48, textAlign: 'center' }}>📏</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>Start tracking your body</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>
              Log weekly measurements to see real progress beyond the scale.
            </Text>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: accent }]} onPress={openAdd}>
              <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Log First Entry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  addBtn:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },

  formCard: { margin: 16, borderRadius: borderRadius.xl, borderWidth: 1, padding: 18, gap: 14 },
  formTitle:{ fontSize: 16, fontWeight: '800' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fieldWrap:{ width: '47%' },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
  fieldInput: { height: 44, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontWeight: '700' },

  bmiPreview: { borderRadius: 10, borderWidth: 1, padding: 10, alignItems: 'center' },
  bmiPreviewText: { fontSize: 13, fontWeight: '600' },

  saveBtn: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: 16, gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle:  { fontSize: 16, fontWeight: '800' },
  cardDate:   { fontSize: 12, marginTop: 2 },
  editEntryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },

  bmiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  bmiVal:   { fontSize: 36, fontWeight: '900' },
  bmiLabel: { fontSize: 14, fontWeight: '700' },
  bmiCat:   { fontSize: 12, marginTop: 2 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricItem: { width: '30%', borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center', gap: 3 },
  metricIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricVal:  { fontSize: 15, fontWeight: '900' },
  metricDelta:{ fontSize: 11, fontWeight: '700' },
  metricLbl:  { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },

  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 12,
  },
  historyDate: { fontSize: 12, fontWeight: '600', width: 52 },
  historyVals: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyVal:  { fontSize: 12, fontWeight: '700' },
  longPressHint: { fontSize: 11, textAlign: 'center', paddingTop: 8 },

  emptyCard: { margin: 16, borderRadius: borderRadius.xl, borderWidth: 1, padding: 32, gap: 12, alignItems: 'center' },
  emptyTitle:{ fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySub:  { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
