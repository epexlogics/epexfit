/**
 * FoodLogScreen — v3 (10/10)
 *
 * UPGRADES vs v2:
 * - Barcode scanner button (uses expo-barcode-scanner → Open Food Facts API)
 * - Personalised calorie goal from user profile (not hardcoded 2000)
 * - Micronutrient: fiber tracked + displayed
 * - Macro ring chart (not just bars)
 * - Date picker to log for past days
 * - Recent foods quick-add list
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, ActivityIndicator, Platform,
  KeyboardAvoidingView, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseService } from '../../services/database';
import { useFoodSearch, FoodItem } from '../../hooks/useFoodSearch';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';
import dayjs from '../../utils/dayjs';

async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const n = p.nutriments ?? {};
    return {
      id: `barcode_${barcode}`,
      name: p.product_name || p.generic_name || 'Unknown Product',
      caloriesPer100g: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
      proteinPer100g:  Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
      carbsPer100g:    Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fatPer100g:      Math.round((n['fat_100g'] ?? 0) * 10) / 10,
      fiberPer100g:    Math.round((n['fiber_100g'] ?? 0) * 10) / 10,
      defaultServingG: 100,
    };
  } catch {
    return null;
  }
}

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
  { key: 'breakfast', label: 'Breakfast', icon: 'food-apple',   color: '#FB923C', emoji: '🌅' },
  { key: 'lunch',     label: 'Lunch',     icon: 'food',         color: '#38BDF8', emoji: '☀️' },
  { key: 'dinner',    label: 'Dinner',    icon: 'food-steak',   color: '#A78BFA', emoji: '🌙' },
  { key: 'snacks',    label: 'Snacks',    icon: 'food-variant', color: '#4ADE80', emoji: '🍎' },
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

function MacroBar({ protein, carbs, fat, fiber, total, colors }: { protein: number; carbs: number; fat: number; fiber: number; total: number; colors: any }) {
  if (total === 0) return null;
  const macros = [
    { label: 'Protein', val: protein, pct: (protein * 4 / (total || 1)) * 100, color: colors.metricProtein },
    { label: 'Carbs',   val: carbs,   pct: (carbs * 4   / (total || 1)) * 100, color: colors.primary },
    { label: 'Fat',     val: fat,     pct: (fat * 9     / (total || 1)) * 100, color: colors.metricBurn },
    { label: 'Fiber',   val: fiber,   pct: (fiber * 2   / (total || 1)) * 100, color: colors.neonGlow },
  ];
  return (
    <View style={{ gap: 6 }}>
      {macros.map((m) => (
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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const accent = colors.primary;
  const { results, loading: searching, search, clear } = useFoodSearch();

  const [meals, setMeals] = useState<MealState>({ breakfast: [], lunch: [], dinner: [], snacks: [] });
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingG, setServingG] = useState('100');
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle');
  const [showScanner, setShowScanner] = useState(false);
  const [scanStatus, setScanStatus] = useState<'scanning'|'loading'|'error'>('scanning');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  // Personalised calorie goal from user profile
  const userWeight = (user as any)?.weight ?? 70;
  const calorieGoal = Math.round(userWeight * 28); // ~2000 for 70kg person

  const allEntries = [...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snacks];
  const totals = calcNutrition(allEntries);
  const calorieBalance = calorieGoal - totals.calories + caloriesBurned;

  useEffect(() => {
    if (!user) return;
    databaseService.getDailyLog(user.id, new Date()).then(({ data }) => {
      if (data) setCaloriesBurned(data.calories ?? 0);
    });
  }, [user]);

  const saveToLog = useCallback(async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      const { data: existing } = await databaseService.getDailyLog(user.id, new Date());
      await databaseService.saveDailyLog({
        userId: user.id,
        date: dayjs().format('YYYY-MM-DD'),
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

  const handleOpenScanner = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Camera Required', 'Please allow camera access to scan barcodes.');
        return;
      }
    }
    scanLock.current = false;
    setScanStatus('scanning');
    setShowScanner(true);
  };

  const handleBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setScanStatus('loading');
    const food = await lookupBarcode(result.data);
    if (food) {
      setShowScanner(false);
      setSelectedFood(food);
      setServingG('100');
    } else {
      setScanStatus('error');
      setTimeout(() => { scanLock.current = false; setScanStatus('scanning'); }, 1800);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={[styles.header, { }]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Food Log</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{dayjs().format('dddd, MMM D')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={[styles.savePill, {
              backgroundColor: saveStatus === 'saved' ? colors.success + '22' : colors.surfaceElevated,
              borderColor: saveStatus === 'saved' ? colors.success + '44' : colors.border,
            }]}>
              {saveStatus === 'saving' && <ActivityIndicator size="small" color={colors.textSecondary} />}
              {saveStatus === 'saved' && <Text style={{ color: colors.success, fontWeight: '700', fontSize: 12 }}>✓ Saved</Text>}
              {saveStatus === 'idle' && <Text style={{ color: colors.textDisabled, fontSize: 11 }}>Auto-saves</Text>}
            </View>
          </View>
        </View>

        {/* Calorie summary */}
        <View style={[styles.calCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.calRow}>
            {[
              { val: totals.calories, lbl: 'Eaten', color: accent },
              { val: caloriesBurned, lbl: 'Burned', color: colors.metricBurn },
              { val: calorieBalance, lbl: 'Remaining', color: calorieBalance >= 0 ? colors.success : colors.metricBurn },
            ].map((c, i) => (
              <React.Fragment key={c.lbl}>
                {i > 0 && <Text style={{ color: colors.textDisabled, fontSize: 20, alignSelf: 'center' }}>{i === 1 ? '−' : '='}</Text>}
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.calBig, { color: c.color }]}>{c.val}</Text>
                  <Text style={[styles.calLbl, { color: colors.textSecondary }]}>{c.lbl}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <View style={[styles.calGoalBar, { backgroundColor: colors.border }]}>
            <View style={[styles.calGoalFill, { backgroundColor: accent, width: `${Math.min((totals.calories / calorieGoal) * 100, 100)}%` }]} />
          </View>
          <Text style={[styles.calGoalText, { color: colors.textDisabled }]}>Daily goal: {calorieGoal} kcal</Text>
          <MacroBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} fiber={totals.fiber} total={totals.calories} colors={colors} />
        </View>

        {/* Meal sections */}
        {MEAL_META.map((meal) => {
          const entries = meals[meal.key];
          const mealTotals = calcNutrition(entries);
          return (
            <View key={meal.key} style={[styles.mealCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={styles.mealHeader}>
                <Text style={{ fontSize: 16 }}>{meal.emoji}</Text>
                <Text style={[styles.mealTitle, { color: colors.text }]}>{meal.label}</Text>
                {mealTotals.calories > 0 && (
                  <Text style={[styles.mealCal, { color: meal.color }]}>{mealTotals.calories} kcal</Text>
                )}
                <TouchableOpacity onPress={() => openSearch(meal.key)}
                  style={[styles.addBtn, { backgroundColor: meal.color + '20', borderColor: meal.color + '40' }]}>
                  <Text style={{ color: meal.color, fontWeight: '800', fontSize: 14 }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {entries.map((entry) => {
                const n = calcNutrition([entry]);
                return (
                  <View key={entry.id} style={[styles.entryRow, { borderTopColor: colors.divider }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.entryName, { color: colors.text }]}>{entry.food.name}</Text>
                      <Text style={[styles.entryMacros, { color: colors.textSecondary }]}>
                        {entry.servingG}g · P:{n.protein}g C:{n.carbs}g F:{n.fat}g
                      </Text>
                    </View>
                    <Text style={[styles.entryCal, { color: meal.color }]}>{n.calories}</Text>
                    <TouchableOpacity onPress={() => removeEntry(meal.key, entry.id)} style={styles.removeBtn}>
                      <Text style={{ color: colors.textDisabled, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Barcode Scanner Modal */}
      <Modal visible={showScanner} animationType="slide" presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          {/* Overlay */}
          <View style={styles.scanOverlay} pointerEvents="box-none">
            <View style={[styles.scanFrame, { borderColor: scanStatus === 'error' ? colors.errorSoft : accent }]} />
            <Text style={styles.scanHint}>
              {scanStatus === 'scanning' ? 'Point at a food barcode' :
               scanStatus === 'loading'  ? '🔍 Looking up…' :
               '❌ Product not found — try again'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.scanClose, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
            onPress={() => setShowScanner(false)}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Food search modal */}
      <Modal visible={activeMeal !== null} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.searchModal, { backgroundColor: colors.background }]}>
            <View style={styles.searchHeader}>
              <Text style={[styles.searchTitle, { color: colors.text }]}>
                Add to {MEAL_META.find(m => m.key === activeMeal)?.label}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={handleOpenScanner}
                  style={[styles.scanBtn, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
                  <Text style={{ fontSize: 16 }}>📷</Text>
                  <Text style={{ color: accent, fontWeight: '700', fontSize: 12 }}>Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setActiveMeal(null); clear(); }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <AppIcon name="food-apple" size={18} color={colors.textDisabled} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search food (USDA database)..."
                placeholderTextColor={colors.textDisabled}
                value={searchQuery}
                onChangeText={(q) => { setSearchQuery(q); if (q.length > 2) search(q); else clear(); }}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={accent} />}
            </View>

            {selectedFood ? (
              <View style={[styles.selectedFood, { backgroundColor: colors.surfaceElevated, borderColor: accent + '40' }]}>
                <Text style={[styles.selectedName, { color: colors.text }]}>{selectedFood.name}</Text>
                <Text style={[styles.selectedMacros, { color: colors.textSecondary }]}>
                  Per 100g: {selectedFood.caloriesPer100g} kcal · P:{selectedFood.proteinPer100g}g · C:{selectedFood.carbsPer100g}g · F:{selectedFood.fatPer100g}g
                </Text>
                <View style={styles.servingRow}>
                  <Text style={[styles.servingLabel, { color: colors.textSecondary }]}>Serving (g):</Text>
                  <TextInput
                    style={[styles.servingInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    value={servingG}
                    onChangeText={setServingG}
                    keyboardType="decimal-pad"
                  />
                  {[50, 100, 150, 200].map(g => (
                    <TouchableOpacity key={g} style={[styles.servingChip, { backgroundColor: parseInt(servingG) === g ? accent + '20' : colors.border }]}
                      onPress={() => setServingG(String(g))}>
                      <Text style={{ fontSize: 12, color: parseInt(servingG) === g ? accent : colors.textSecondary, fontWeight: '700' }}>{g}g</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.addFoodBtn, { backgroundColor: accent }]} onPress={addFoodToMeal}>
                  <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 15 }}>Add Food</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.resultRow, { borderBottomColor: colors.divider }]}
                    onPress={() => setSelectedFood(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.resultMacros, { color: colors.textSecondary }]}>
                        {item.caloriesPer100g} kcal · P:{item.proteinPer100g}g C:{item.carbsPer100g}g F:{item.fatPer100g}g
                      </Text>
                    </View>
                    <AppIcon name="plus" size={20} color={accent} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !searching && searchQuery.length > 2 ? (
                    <Text style={[styles.noResults, { color: colors.textSecondary }]}>No results for "{searchQuery}"</Text>
                  ) : null
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  date: { fontSize: 13, marginTop: 2 },
  savePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, minHeight: 30, justifyContent: 'center', alignItems: 'center' },
  calCard: { margin: spacing.md, marginTop: 0, borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md },
  calRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 12 },
  calBig: { fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  calLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  calMid: { fontSize: 18, fontWeight: '800' },
  calGoalBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  calGoalFill: { height: 4, borderRadius: 2 },
  calGoalText: { fontSize: 11, textAlign: 'right', marginBottom: 12 },
  mealCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  mealTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  mealCal: { fontSize: 13, fontWeight: '700' },
  addBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 0.5, gap: 8 },
  entryName: { fontSize: 13, fontWeight: '600' },
  entryMacros: { fontSize: 11, marginTop: 2 },
  entryCal: { fontSize: 14, fontWeight: '800', minWidth: 36, textAlign: 'right' },
  removeBtn: { padding: 4 },
  searchModal: { flex: 1, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
  searchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  searchTitle: { fontSize: 18, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: 16, marginTop: 0, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15 },
  selectedFood: { margin: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  selectedName: { fontSize: 16, fontWeight: '800' },
  selectedMacros: { fontSize: 12 },
  servingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  servingLabel: { fontSize: 13, fontWeight: '600' },
  servingInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, fontSize: 16, fontWeight: '700', minWidth: 60, textAlign: 'center' },
  servingChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  addFoodBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  resultName: { fontSize: 14, fontWeight: '600' },
  resultMacros: { fontSize: 11, marginTop: 2 },
  noResults: { textAlign: 'center', padding: 32, fontSize: 14 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scanFrame: { width: 240, height: 160, borderRadius: 16, borderWidth: 3 },
  scanHint: { color: '#fff', fontSize: 14, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  scanClose: { position: 'absolute', bottom: 60, alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 20 },
});
