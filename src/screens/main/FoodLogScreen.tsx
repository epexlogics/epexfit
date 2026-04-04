/**
 * FoodLogScreen
 * Full food/nutrition logging with:
 * - USDA food database search
 * - Breakfast / Lunch / Dinner / Snacks meal slots
 * - Macro breakdown: protein, carbs, fat, fiber, calories
 * - Calorie balance: eaten vs burned
 * - Auto-syncs to daily log
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { useFoodSearch, FoodItem } from '../../hooks/useFoodSearch';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import moment from 'moment';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

interface MealEntry {
  id: string;
  food: FoodItem;
  servingG: number;
}

interface MealState {
  breakfast: MealEntry[];
  lunch: MealEntry[];
  dinner: MealEntry[];
  snacks: MealEntry[];
}

const MEAL_META: { key: MealType; label: string; icon: string; color: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'food-apple',   color: '#FF9500', emoji: '🌅' },
  { key: 'lunch',     label: 'Lunch',     icon: 'food',         color: '#4D9FFF', emoji: '☀️' },
  { key: 'dinner',    label: 'Dinner',    icon: 'food-steak',   color: '#C084FC', emoji: '🌙' },
  { key: 'snacks',    label: 'Snacks',    icon: 'food-variant', color: '#00C853', emoji: '🍎' },
];

function calcNutrition(entries: MealEntry[]) {
  return entries.reduce(
    (acc, e) => {
      const f = e.servingG / 100;
      return {
        calories: acc.calories + Math.round(e.food.caloriesPer100g * f),
        protein:  acc.protein  + Math.round(e.food.proteinPer100g  * f),
        carbs:    acc.carbs    + Math.round(e.food.carbsPer100g    * f),
        fat:      acc.fat      + Math.round(e.food.fatPer100g      * f),
        fiber:    acc.fiber    + Math.round(e.food.fiberPer100g    * f),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

// ── Macro Ring (simple arc visualization) ────────────────────────────────
function MacroBar({ protein, carbs, fat, total, colors }: { protein: number; carbs: number; fat: number; total: number; colors: any }) {
  if (total === 0) return null;
  const pP = (protein * 4 / (total || 1)) * 100;
  const pC = (carbs * 4 / (total || 1)) * 100;
  const pF = (fat * 9 / (total || 1)) * 100;
  return (
    <View style={{ gap: 6 }}>
      {[
        { label: 'Protein', val: protein, pct: pP, color: '#C084FC' },
        { label: 'Carbs',   val: carbs,   pct: pC, color: '#F5C842' },
        { label: 'Fat',     val: fat,     pct: pF, color: '#FF5B5B' },
      ].map((m) => (
        <View key={m.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, width: 52 }}>{m.label}</Text>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: m.color, width: `${Math.min(m.pct, 100)}%` }} />
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, width: 36, textAlign: 'right' }}>{m.val}g</Text>
        </View>
      ))}
    </View>
  );
}

export default function FoodLogScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const accent = colors.primary;
  const { results, loading: searching, search, clear } = useFoodSearch();

  const [meals, setMeals] = useState<MealState>({ breakfast: [], lunch: [], dinner: [], snacks: [] });
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingG, setServingG] = useState('100');
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const allEntries = [...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snacks];
  const totals = calcNutrition(allEntries);
  const calorieGoal = 2000; // Could come from user profile
  const calorieBalance = calorieGoal - totals.calories + caloriesBurned;

  // Load today's activity calories burned
  useEffect(() => {
    if (!user) return;
    databaseService.getDailyLog(user.id, new Date()).then(({ data }) => {
      if (data) setCaloriesBurned(data.calories ?? 0);
    });
  }, [user]);

  // Auto-save totals to daily log when meals change
  const saveToLog = useCallback(async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      const { data: existing } = await databaseService.getDailyLog(user.id, new Date());
      await databaseService.saveDailyLog({
        userId: user.id,
        date: moment().format('YYYY-MM-DD'),
        steps: existing?.steps ?? 0,
        distance: existing?.distance ?? 0,
        calories: existing?.calories ?? 0,
        water: existing?.water ?? 0,
        protein: totals.protein,
        fiber: totals.fiber,
        sleep: existing?.sleep ?? 0,
        mood: existing?.mood ?? 3,
      });
      await databaseService.syncGoalProgress(user.id);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch { setSaveStatus('idle'); }
  }, [user, totals]);

  useFocusEffect(useCallback(() => {
    return () => { saveToLog(); };
  }, [saveToLog]));

  const openSearch = (meal: MealType) => {
    setActiveMeal(meal);
    setSearchQuery('');
    clear();
    setSelectedFood(null);
    setServingG('100');
  };

  const addFoodToMeal = () => {
    if (!selectedFood || !activeMeal) return;
    const entry: MealEntry = {
      id: `${Date.now()}_${Math.random()}`,
      food: selectedFood,
      servingG: parseFloat(servingG) || 100,
    };
    setMeals((prev) => ({ ...prev, [activeMeal]: [...prev[activeMeal], entry] }));
    setActiveMeal(null);
    setSelectedFood(null);
  };

  const removeEntry = (meal: MealType, id: string) => {
    setMeals((prev) => ({ ...prev, [meal]: prev[meal].filter((e) => e.id !== id) }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Food Log</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{moment().format('dddd, MMM D')}</Text>
          </View>
          <View style={[styles.savePill, {
            backgroundColor: saveStatus === 'saved' ? '#00C85320' : colors.surfaceElevated,
            borderColor: saveStatus === 'saved' ? '#00C85340' : colors.border,
          }]}>
            {saveStatus === 'saving' && <ActivityIndicator size="small" color={colors.textSecondary} />}
            {saveStatus === 'saved' && <Text style={{ color: '#00C853', fontWeight: '700', fontSize: 12 }}>✓ Saved</Text>}
            {saveStatus === 'idle' && <Text style={{ color: colors.textDisabled, fontSize: 11 }}>Auto-saves</Text>}
          </View>
        </View>

        {/* Calorie summary */}
        <View style={[styles.calCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.calRow}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.calBig, { color: accent }]}>{totals.calories}</Text>
              <Text style={[styles.calLbl, { color: colors.textSecondary }]}>Eaten</Text>
            </View>
            <View style={styles.calMath}>
              <Text style={{ color: colors.textDisabled, fontSize: 20 }}>−</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.calMid, { color: '#FF5B5B' }]}>{caloriesBurned}</Text>
                <Text style={[styles.calLbl, { color: colors.textSecondary }]}>Burned</Text>
              </View>
              <Text style={{ color: colors.textDisabled, fontSize: 20 }}>=</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.calBig, { color: calorieBalance >= 0 ? '#00C853' : '#FF5B5B' }]}>{Math.abs(calorieBalance)}</Text>
                <Text style={[styles.calLbl, { color: colors.textSecondary }]}>{calorieBalance >= 0 ? 'Remaining' : 'Over'}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.calTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.calFill, { backgroundColor: accent, width: `${Math.min((totals.calories / calorieGoal) * 100, 100)}%` }]} />
          </View>
          <MacroBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} total={totals.calories} colors={colors} />
        </View>

        {/* Meal sections */}
        {MEAL_META.map((meal) => {
          const mealEntries = meals[meal.key];
          const mealTotals = calcNutrition(mealEntries);
          return (
            <View key={meal.key} style={[styles.mealCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={styles.mealHeader}>
                <Text style={{ fontSize: 18 }}>{meal.emoji}</Text>
                <Text style={[styles.mealTitle, { color: colors.text }]}>{meal.label}</Text>
                {mealTotals.calories > 0 && (
                  <Text style={[styles.mealCal, { color: meal.color }]}>{mealTotals.calories} kcal</Text>
                )}
                <TouchableOpacity
                  onPress={() => openSearch(meal.key)}
                  style={[styles.addMealBtn, { backgroundColor: meal.color + '20', borderColor: meal.color + '40' }]}
                >
                  <Text style={{ color: meal.color, fontWeight: '800', fontSize: 13 }}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {mealEntries.map((entry) => {
                const nut = calcNutrition([entry]);
                return (
                  <View key={entry.id} style={[styles.entryRow, { borderTopColor: colors.divider }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.entryName, { color: colors.text }]} numberOfLines={1}>{entry.food.name}</Text>
                      <Text style={[styles.entryMeta, { color: colors.textSecondary }]}>
                        {entry.servingG}g · {nut.calories} kcal · P:{nut.protein}g C:{nut.carbs}g F:{nut.fat}g
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeEntry(meal.key, entry.id)} style={styles.removeBtn}>
                      <Text style={{ color: colors.textDisabled, fontSize: 16 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {mealEntries.length === 0 && (
                <Text style={[styles.emptyMeal, { color: colors.textDisabled }]}>Nothing logged yet</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Food Search Modal */}
      <Modal
        visible={activeMeal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveMeal(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add to {MEAL_META.find((m) => m.key === activeMeal)?.label}
            </Text>
            <TouchableOpacity onPress={() => setActiveMeal(null)}>
              <Text style={{ color: accent, fontWeight: '700', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {!selectedFood ? (
            <>
              {/* Search input */}
              <View style={[styles.searchRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <AppIcon name="magnify" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={searchQuery}
                  onChangeText={(v) => { setSearchQuery(v); search(v); }}
                  placeholder="Search foods... (e.g. chicken, rice)"
                  placeholderTextColor={colors.textDisabled}
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color={accent} />}
              </View>

              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, gap: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setSelectedFood(item); setServingG(String(item.defaultServingG)); }}
                    style={[styles.foodResult, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.foodName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                      {item.brand && <Text style={[styles.foodBrand, { color: colors.textSecondary }]}>{item.brand}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.foodCal, { color: accent }]}>{item.caloriesPer100g}</Text>
                      <Text style={[styles.foodCalLbl, { color: colors.textSecondary }]}>kcal/100g</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  searchQuery.length >= 2 && !searching ? (
                    <Text style={[styles.noResults, { color: colors.textDisabled }]}>No results. Try a different search.</Text>
                  ) : null
                }
              />
            </>
          ) : (
            /* Serving size selection */
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <View style={[styles.selectedCard, { backgroundColor: colors.surfaceElevated, borderColor: accent + '40' }]}>
                <Text style={[styles.selectedName, { color: colors.text }]}>{selectedFood.name}</Text>
                {selectedFood.brand && <Text style={[styles.selectedBrand, { color: colors.textSecondary }]}>{selectedFood.brand}</Text>}
              </View>

              <View>
                <Text style={[styles.servingLabel, { color: colors.textSecondary }]}>SERVING SIZE (grams)</Text>
                <View style={styles.servingRow}>
                  {[50, 100, 150, 200].map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setServingG(String(g))}
                      style={[styles.servingChip, {
                        backgroundColor: servingG === String(g) ? accent + '20' : colors.surfaceElevated,
                        borderColor: servingG === String(g) ? accent : colors.border,
                      }]}
                    >
                      <Text style={{ color: servingG === String(g) ? accent : colors.text, fontWeight: '700', fontSize: 13 }}>{g}g</Text>
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    style={[styles.servingInput, { color: colors.text, borderColor: colors.border }]}
                    value={servingG}
                    onChangeText={setServingG}
                    keyboardType="numeric"
                    placeholder="Custom"
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
              </View>

              {/* Nutrition preview */}
              <View style={[styles.nutPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {[
                  { lbl: 'Calories', val: `${Math.round(selectedFood.caloriesPer100g * (parseFloat(servingG) || 100) / 100)} kcal`, color: accent },
                  { lbl: 'Protein',  val: `${Math.round(selectedFood.proteinPer100g * (parseFloat(servingG) || 100) / 100)}g`, color: '#C084FC' },
                  { lbl: 'Carbs',    val: `${Math.round(selectedFood.carbsPer100g * (parseFloat(servingG) || 100) / 100)}g`, color: '#F5C842' },
                  { lbl: 'Fat',      val: `${Math.round(selectedFood.fatPer100g * (parseFloat(servingG) || 100) / 100)}g`, color: '#FF5B5B' },
                  { lbl: 'Fiber',    val: `${Math.round(selectedFood.fiberPer100g * (parseFloat(servingG) || 100) / 100)}g`, color: '#00C853' },
                ].map((n) => (
                  <View key={n.lbl} style={styles.nutRow}>
                    <Text style={[styles.nutLbl, { color: colors.textSecondary }]}>{n.lbl}</Text>
                    <Text style={[styles.nutVal, { color: n.color }]}>{n.val}</Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => setSelectedFood(null)} style={[styles.backBtn, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={addFoodToMeal} style={[styles.addBtn, { backgroundColor: accent }]}>
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Add Food</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  date: { fontSize: 13, marginTop: 2 },
  savePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, minWidth: 80, alignItems: 'center' },
  calCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: borderRadius.xl, borderWidth: 1, padding: 16, gap: 12 },
  calRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calMath: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calBig: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  calMid: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  calLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  calTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  calFill: { height: 4, borderRadius: 2 },
  mealCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: borderRadius.xl, borderWidth: 1, padding: 16 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  mealTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  mealCal: { fontSize: 13, fontWeight: '700' },
  addMealBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, gap: 8 },
  entryName: { fontSize: 13, fontWeight: '700' },
  entryMeta: { fontSize: 11, marginTop: 2 },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  emptyMeal: { fontSize: 12, fontStyle: 'italic', paddingVertical: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  foodResult: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  foodName: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  foodBrand: { fontSize: 11, marginTop: 2 },
  foodCal: { fontSize: 16, fontWeight: '900' },
  foodCalLbl: { fontSize: 10 },
  noResults: { textAlign: 'center', fontSize: 13, padding: 24 },
  selectedCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  selectedName: { fontSize: 16, fontWeight: '800' },
  selectedBrand: { fontSize: 12, marginTop: 4 },
  servingLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginBottom: 10 },
  servingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  servingChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  servingInput: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, minWidth: 80, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  nutPreview: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  nutRow: { flexDirection: 'row', justifyContent: 'space-between' },
  nutLbl: { fontSize: 13 },
  nutVal: { fontSize: 13, fontWeight: '700' },
  backBtn: { flex: 1, height: 52, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flex: 2, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
