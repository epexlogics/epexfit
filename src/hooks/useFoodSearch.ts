/**
 * useFoodSearch — Updated
 *
 * Changes:
 * 1. Local fallback now has 50+ Pakistani / desi foods
 * 2. Search checks local list FIRST (instant), then USDA API
 * 3. foodLogService added — save/load/delete food_logs from Supabase
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  defaultServingG: number;
}

export interface FoodLogEntry {
  id: string;           // DB row id
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  food: FoodItem;
  servingG: number;
  date: string;         // YYYY-MM-DD
}

// ─── Supabase food_logs service ───────────────────────────────────────────────

export const foodLogService = {
  /** Load all entries for a given date */
  async getByDate(userId: string, date: string): Promise<FoodLogEntry[]> {
    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((row: any): FoodLogEntry => ({
      id: row.id,
      mealType: row.meal_type,
      servingG: parseFloat(row.serving_g),
      date: row.date,
      food: {
        id: row.food_id,
        name: row.food_name,
        brand: row.brand ?? undefined,
        caloriesPer100g: parseFloat(row.calories_per100g),
        proteinPer100g:  parseFloat(row.protein_per100g),
        carbsPer100g:    parseFloat(row.carbs_per100g),
        fatPer100g:      parseFloat(row.fat_per100g),
        fiberPer100g:    parseFloat(row.fiber_per100g),
        defaultServingG: parseFloat(row.serving_g),
      },
    }));
  },

  /** Insert one entry */
  async add(
    userId: string,
    date: string,
    mealType: FoodLogEntry['mealType'],
    food: FoodItem,
    servingG: number,
  ): Promise<FoodLogEntry | null> {
    const { data, error } = await supabase
      .from('food_logs')
      .insert({
        user_id:          userId,
        date,
        meal_type:        mealType,
        food_id:          food.id,
        food_name:        food.name,
        brand:            food.brand ?? null,
        calories_per100g: food.caloriesPer100g,
        protein_per100g:  food.proteinPer100g,
        carbs_per100g:    food.carbsPer100g,
        fat_per100g:      food.fatPer100g,
        fiber_per100g:    food.fiberPer100g,
        serving_g:        servingG,
      })
      .select()
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      mealType,
      servingG,
      date,
      food,
    };
  },

  /** Delete one entry by id */
  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('food_logs')
      .delete()
      .eq('id', id);
    return !error;
  },

  /** Get last N unique foods logged by user (for "Recent" section) */
  async getRecentFoods(userId: string, limit = 10): Promise<FoodItem[]> {
    const { data } = await supabase
      .from('food_logs')
      .select('food_id, food_name, brand, calories_per100g, protein_per100g, carbs_per100g, fat_per100g, fiber_per100g, serving_g')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) return [];

    // Deduplicate by food_id
    const seen = new Set<string>();
    const unique: FoodItem[] = [];
    for (const row of data) {
      if (!seen.has(row.food_id) && unique.length < limit) {
        seen.add(row.food_id);
        unique.push({
          id: row.food_id,
          name: row.food_name,
          brand: row.brand ?? undefined,
          caloriesPer100g: parseFloat(row.calories_per100g),
          proteinPer100g:  parseFloat(row.protein_per100g),
          carbsPer100g:    parseFloat(row.carbs_per100g),
          fatPer100g:      parseFloat(row.fat_per100g),
          fiberPer100g:    parseFloat(row.fiber_per100g),
          defaultServingG: parseFloat(row.serving_g),
        });
      }
    }
    return unique;
  },
};

// ─── USDA key helper ─────────────────────────────────────────────────────────

function getUsdaKey(): string | null {
  const envKey = process.env.EXPO_PUBLIC_USDA_API_KEY;
  if (envKey && envKey.trim().length > 0) return envKey.trim();
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  const extraKey = extra.usdaApiKey;
  if (extraKey && extraKey.trim().length > 0 && extraKey !== 'DEMO_KEY') return extraKey.trim();
  return null;
}

function getNutrient(food: unknown, name: string): number {
  const f = food as { foodNutrients?: Array<{ nutrientName?: string; value?: number }> };
  const n = f.foodNutrients?.find((x) => x.nutrientName?.toLowerCase().includes(name.toLowerCase()));
  return Math.round((n?.value ?? 0) * 10) / 10;
}

/**
 * Get energy in kcal specifically.
 * USDA FDC returns multiple energy entries:
 *   "Energy" (kcal), "Energy (Atwater General Factors)" (kcal),
 *   "Energy (Atwater Specific Factors)" (kcal), "Energy" (kJ).
 * We must find the kcal entry, not kJ. Prefer the plain "Energy" entry
 * with unit kcal, falling back to any entry that contains "energy" and
 * has a value consistent with kcal (>10 suggests kcal not kJ for real foods).
 */
function getCaloriesKcal(food: unknown): number {
  const f = food as {
    foodNutrients?: Array<{ nutrientName?: string; unitName?: string; value?: number }>;
  };
  const nutrients = f.foodNutrients ?? [];

  // 1. Prefer exact match: nutrientName === "Energy" AND unitName === "KCAL"
  const exact = nutrients.find(
    (x) =>
      x.nutrientName?.toLowerCase() === 'energy' &&
      x.unitName?.toLowerCase() === 'kcal'
  );
  if (exact?.value != null) return Math.round(exact.value);

  // 2. Any nutrient with "energy" in name and unit kcal
  const byUnit = nutrients.find(
    (x) =>
      x.nutrientName?.toLowerCase().includes('energy') &&
      x.unitName?.toLowerCase() === 'kcal'
  );
  if (byUnit?.value != null) return Math.round(byUnit.value);

  // 3. Fallback: any "energy" entry — if value looks like kJ (>600 for typical food)
  // convert: 1 kcal = 4.184 kJ
  const anyEnergy = nutrients.find((x) => x.nutrientName?.toLowerCase().includes('energy'));
  if (anyEnergy?.value != null) {
    const v = anyEnergy.value;
    // If kJ (values typically 200-3000 range per 100g for real food)
    // kcal values are ~4x smaller. Heuristic: if >800 it's almost certainly kJ
    return Math.round(v > 800 ? v / 4.184 : v);
  }

  return 0;
}

function getFiber(food: unknown): number {
  const f = food as { foodNutrients?: Array<{ nutrientName?: string; value?: number }> };
  const n = f.foodNutrients?.find((x) => {
    const nm = x.nutrientName?.toLowerCase() ?? '';
    return nm.includes('fiber') && (nm.includes('total') || nm.includes('dietary') || nm === 'fiber');
  });
  return Math.round((n?.value ?? 0) * 10) / 10;
}

// ─── useFoodSearch hook ───────────────────────────────────────────────────────

export type SearchSource = 'usda+local' | 'local-only' | 'idle';

interface UseFoodSearchResult {
  results: FoodItem[];
  loading: boolean;
  search: (query: string) => Promise<void>;
  clear: () => void;
  apiAvailable: boolean;
  searchSource: SearchSource;
}

export function useFoodSearch(): UseFoodSearchResult {
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiAvailable] = useState(() => !!getUsdaKey());
  const [searchSource, setSearchSource] = useState<SearchSource>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setResults([]); setSearchSource('idle'); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);

      // 1. Always search local list first (instant, no network)
      const localMatches = COMMON_FOODS.filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase())
      );

      const usdaKey = getUsdaKey();
      if (usdaKey) {
        try {
          const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=15&api_key=${usdaKey}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`USDA ${res.status}`);

          const json = await res.json() as {
            foods?: Array<{
              fdcId: number;
              description?: string;
              brandOwner?: string;
              brandName?: string;
              servingSize?: number;
              foodNutrients?: Array<{ nutrientName?: string; value?: number }>;
            }>;
          };

          const usdaResults: FoodItem[] = (json.foods ?? []).map((f) => ({
            id: String(f.fdcId),
            name: f.description || 'Unknown Food',
            brand: f.brandOwner || f.brandName,
            caloriesPer100g: getCaloriesKcal(f),
            proteinPer100g:  getNutrient(f, 'Protein'),
            carbsPer100g:    getNutrient(f, 'Carbohydrate'),
            fatPer100g:      getNutrient(f, 'Total lipid'),
            fiberPer100g:    getFiber(f),
            defaultServingG: f.servingSize || 100,
          }));

          setResults([...localMatches, ...usdaResults]);
          setSearchSource('usda+local');
        } catch {
          setResults(localMatches);
          setSearchSource('local-only');
        }
      } else {
        setResults(localMatches);
        setSearchSource('local-only');
      }

      setLoading(false);
    }, 350);
  }, []);

  const clear = useCallback(() => { setResults([]); setSearchSource('idle'); }, []);

  return { results, loading, search, clear, apiAvailable, searchSource };
}

// ─── Local food database — 10 common + 50 Pakistani/desi foods ───────────────

export const COMMON_FOODS: FoodItem[] = [
  // ── Common International ────────────────────────────────────────────────
  { id: 'egg',          name: 'Egg (boiled)',          caloriesPer100g: 155, proteinPer100g: 13.0, carbsPer100g: 1.1, fatPer100g: 11.0, fiberPer100g: 0.0,  defaultServingG: 60  },
  { id: 'chicken_b',    name: 'Chicken Breast',         caloriesPer100g: 165, proteinPer100g: 31.0, carbsPer100g: 0.0, fatPer100g: 3.6,  fiberPer100g: 0.0,  defaultServingG: 150 },
  { id: 'rice_w',       name: 'White Rice (cooked)',    caloriesPer100g: 130, proteinPer100g: 2.7,  carbsPer100g: 28.0, fatPer100g: 0.3, fiberPer100g: 0.4,  defaultServingG: 200 },
  { id: 'oats',         name: 'Oats (dry)',              caloriesPer100g: 389, proteinPer100g: 17.0, carbsPer100g: 66.0, fatPer100g: 7.0, fiberPer100g: 10.6, defaultServingG: 80  },
  { id: 'banana',       name: 'Banana',                  caloriesPer100g: 89,  proteinPer100g: 1.1,  carbsPer100g: 23.0, fatPer100g: 0.3, fiberPer100g: 2.6,  defaultServingG: 120 },
  { id: 'milk_w',       name: 'Whole Milk',              caloriesPer100g: 61,  proteinPer100g: 3.2,  carbsPer100g: 4.8,  fatPer100g: 3.3, fiberPer100g: 0.0,  defaultServingG: 250 },
  { id: 'bread_ww',     name: 'Whole Wheat Bread',       caloriesPer100g: 247, proteinPer100g: 13.0, carbsPer100g: 41.0, fatPer100g: 3.4, fiberPer100g: 6.0,  defaultServingG: 40  },
  { id: 'salmon',       name: 'Salmon (cooked)',          caloriesPer100g: 206, proteinPer100g: 20.0, carbsPer100g: 0.0, fatPer100g: 13.0, fiberPer100g: 0.0,  defaultServingG: 150 },
  { id: 'apple',        name: 'Apple',                   caloriesPer100g: 52,  proteinPer100g: 0.3,  carbsPer100g: 14.0, fatPer100g: 0.2, fiberPer100g: 2.4,  defaultServingG: 150 },
  { id: 'greek_yogurt', name: 'Greek Yogurt',             caloriesPer100g: 59,  proteinPer100g: 10.0, carbsPer100g: 3.6,  fatPer100g: 0.4, fiberPer100g: 0.0,  defaultServingG: 200 },

  // ── Pakistani / Desi Main Dishes ────────────────────────────────────────
  { id: 'pk_biryani',       name: 'Chicken Biryani',            caloriesPer100g: 195, proteinPer100g: 10.0, carbsPer100g: 24.0, fatPer100g: 6.5,  fiberPer100g: 0.8,  defaultServingG: 350 },
  { id: 'pk_biryani_m',     name: 'Mutton Biryani',             caloriesPer100g: 220, proteinPer100g: 11.0, carbsPer100g: 23.0, fatPer100g: 9.0,  fiberPer100g: 0.7,  defaultServingG: 350 },
  { id: 'pk_nihari',        name: 'Nihari (beef)',               caloriesPer100g: 170, proteinPer100g: 14.0, carbsPer100g: 5.0,  fatPer100g: 11.0, fiberPer100g: 0.5,  defaultServingG: 300 },
  { id: 'pk_karahi_c',      name: 'Chicken Karahi',              caloriesPer100g: 185, proteinPer100g: 18.0, carbsPer100g: 4.0,  fatPer100g: 11.0, fiberPer100g: 1.0,  defaultServingG: 250 },
  { id: 'pk_karahi_m',      name: 'Mutton Karahi',               caloriesPer100g: 210, proteinPer100g: 16.0, carbsPer100g: 4.0,  fatPer100g: 14.0, fiberPer100g: 0.8,  defaultServingG: 250 },
  { id: 'pk_haleem',        name: 'Haleem',                      caloriesPer100g: 155, proteinPer100g: 12.0, carbsPer100g: 14.0, fatPer100g: 5.5,  fiberPer100g: 3.0,  defaultServingG: 300 },
  { id: 'pk_paya',          name: 'Paya (trotters)',              caloriesPer100g: 140, proteinPer100g: 13.0, carbsPer100g: 3.0,  fatPer100g: 9.0,  fiberPer100g: 0.0,  defaultServingG: 300 },
  { id: 'pk_qorma',         name: 'Chicken Qorma',               caloriesPer100g: 200, proteinPer100g: 16.0, carbsPer100g: 6.0,  fatPer100g: 13.0, fiberPer100g: 0.5,  defaultServingG: 250 },
  { id: 'pk_sajji',         name: 'Sajji (whole chicken)',        caloriesPer100g: 195, proteinPer100g: 26.0, carbsPer100g: 2.0,  fatPer100g: 10.0, fiberPer100g: 0.0,  defaultServingG: 300 },
  { id: 'pk_tikka',         name: 'Chicken Tikka (baked)',        caloriesPer100g: 190, proteinPer100g: 28.0, carbsPer100g: 3.0,  fatPer100g: 8.0,  fiberPer100g: 0.5,  defaultServingG: 200 },
  { id: 'pk_seekh',         name: 'Seekh Kebab',                 caloriesPer100g: 225, proteinPer100g: 20.0, carbsPer100g: 6.0,  fatPer100g: 14.0, fiberPer100g: 0.5,  defaultServingG: 100 },
  { id: 'pk_chapli',        name: 'Chapli Kebab',                caloriesPer100g: 280, proteinPer100g: 18.0, carbsPer100g: 8.0,  fatPer100g: 20.0, fiberPer100g: 0.8,  defaultServingG: 100 },
  { id: 'pk_bun_kebab',     name: 'Bun Kebab',                   caloriesPer100g: 260, proteinPer100g: 11.0, carbsPer100g: 28.0, fatPer100g: 13.0, fiberPer100g: 1.0,  defaultServingG: 150 },

  // ── Daal / Lentils ───────────────────────────────────────────────────────
  { id: 'pk_daal_c',        name: 'Daal Chawal',                 caloriesPer100g: 140, proteinPer100g: 7.0,  carbsPer100g: 22.0, fatPer100g: 3.0,  fiberPer100g: 4.0,  defaultServingG: 350 },
  { id: 'pk_daal_makhni',   name: 'Daal Makhni',                 caloriesPer100g: 160, proteinPer100g: 8.0,  carbsPer100g: 18.0, fatPer100g: 6.5,  fiberPer100g: 5.0,  defaultServingG: 250 },
  { id: 'pk_daal_chana',    name: 'Chana Daal',                  caloriesPer100g: 145, proteinPer100g: 9.0,  carbsPer100g: 20.0, fatPer100g: 3.5,  fiberPer100g: 6.0,  defaultServingG: 250 },
  { id: 'pk_chana_masala',  name: 'Chana Masala',                caloriesPer100g: 165, proteinPer100g: 8.5,  carbsPer100g: 22.0, fatPer100g: 5.5,  fiberPer100g: 7.0,  defaultServingG: 250 },
  { id: 'pk_rajma',         name: 'Rajma (kidney beans)',         caloriesPer100g: 155, proteinPer100g: 9.0,  carbsPer100g: 22.0, fatPer100g: 3.5,  fiberPer100g: 6.5,  defaultServingG: 250 },

  // ── Rice Dishes ──────────────────────────────────────────────────────────
  { id: 'pk_pulao',         name: 'Yakhni Pulao',                caloriesPer100g: 175, proteinPer100g: 9.0,  carbsPer100g: 24.0, fatPer100g: 4.5,  fiberPer100g: 0.8,  defaultServingG: 300 },
  { id: 'pk_khichdi',       name: 'Khichdi',                     caloriesPer100g: 115, proteinPer100g: 5.0,  carbsPer100g: 20.0, fatPer100g: 2.0,  fiberPer100g: 2.0,  defaultServingG: 300 },
  { id: 'pk_matar_pulao',   name: 'Matar Pulao',                 caloriesPer100g: 165, proteinPer100g: 5.0,  carbsPer100g: 28.0, fatPer100g: 4.0,  fiberPer100g: 2.0,  defaultServingG: 300 },

  // ── Breads ───────────────────────────────────────────────────────────────
  { id: 'pk_roti',          name: 'Chapati / Roti (whole wheat)', caloriesPer100g: 264, proteinPer100g: 8.5,  carbsPer100g: 50.0, fatPer100g: 3.5,  fiberPer100g: 4.5,  defaultServingG: 50  },
  { id: 'pk_naan',          name: 'Naan (plain)',                  caloriesPer100g: 290, proteinPer100g: 8.0,  carbsPer100g: 55.0, fatPer100g: 4.0,  fiberPer100g: 1.5,  defaultServingG: 90  },
  { id: 'pk_naan_butter',   name: 'Butter Naan',                   caloriesPer100g: 330, proteinPer100g: 8.0,  carbsPer100g: 55.0, fatPer100g: 9.0,  fiberPer100g: 1.5,  defaultServingG: 90  },
  { id: 'pk_paratha',       name: 'Paratha (plain)',               caloriesPer100g: 310, proteinPer100g: 7.0,  carbsPer100g: 42.0, fatPer100g: 13.0, fiberPer100g: 3.0,  defaultServingG: 80  },
  { id: 'pk_paratha_alu',   name: 'Aloo Paratha',                  caloriesPer100g: 290, proteinPer100g: 7.0,  carbsPer100g: 42.0, fatPer100g: 11.0, fiberPer100g: 2.5,  defaultServingG: 120 },
  { id: 'pk_puri',          name: 'Puri (fried bread)',            caloriesPer100g: 390, proteinPer100g: 7.5,  carbsPer100g: 48.0, fatPer100g: 18.0, fiberPer100g: 2.0,  defaultServingG: 50  },

  // ── Vegetable Dishes ─────────────────────────────────────────────────────
  { id: 'pk_aloo_gosht',    name: 'Aloo Gosht',                  caloriesPer100g: 175, proteinPer100g: 12.0, carbsPer100g: 11.0, fatPer100g: 9.0,  fiberPer100g: 1.5,  defaultServingG: 300 },
  { id: 'pk_saag',          name: 'Saag (mustard greens)',         caloriesPer100g: 95,  proteinPer100g: 4.0,  carbsPer100g: 8.0,  fatPer100g: 5.5,  fiberPer100g: 3.5,  defaultServingG: 250 },
  { id: 'pk_bhindi',        name: 'Bhindi Masala (okra)',          caloriesPer100g: 90,  proteinPer100g: 3.0,  carbsPer100g: 9.0,  fatPer100g: 4.5,  fiberPer100g: 3.0,  defaultServingG: 200 },
  { id: 'pk_aloo_matar',    name: 'Aloo Matar',                  caloriesPer100g: 120, proteinPer100g: 4.0,  carbsPer100g: 16.0, fatPer100g: 4.5,  fiberPer100g: 3.0,  defaultServingG: 250 },
  { id: 'pk_palak',         name: 'Palak Paneer / Chicken',       caloriesPer100g: 145, proteinPer100g: 10.0, carbsPer100g: 7.0,  fatPer100g: 8.5,  fiberPer100g: 2.5,  defaultServingG: 250 },
  { id: 'pk_baingan',       name: 'Baingan Bharta (eggplant)',     caloriesPer100g: 95,  proteinPer100g: 3.0,  carbsPer100g: 10.0, fatPer100g: 5.0,  fiberPer100g: 3.5,  defaultServingG: 200 },
  { id: 'pk_karela',        name: 'Karela (bitter gourd)',         caloriesPer100g: 75,  proteinPer100g: 2.5,  carbsPer100g: 6.0,  fatPer100g: 4.0,  fiberPer100g: 2.5,  defaultServingG: 200 },

  // ── Breakfast / Snacks ───────────────────────────────────────────────────
  { id: 'pk_halwa_puri',    name: 'Halwa Puri (1 plate)',         caloriesPer100g: 350, proteinPer100g: 7.0,  carbsPer100g: 50.0, fatPer100g: 14.0, fiberPer100g: 2.0,  defaultServingG: 250 },
  { id: 'pk_chana_puri',    name: 'Chana Puri (1 plate)',         caloriesPer100g: 300, proteinPer100g: 10.0, carbsPer100g: 45.0, fatPer100g: 10.0, fiberPer100g: 5.0,  defaultServingG: 250 },
  { id: 'pk_samosa',        name: 'Samosa (1 piece)',              caloriesPer100g: 280, proteinPer100g: 6.0,  carbsPer100g: 33.0, fatPer100g: 14.0, fiberPer100g: 2.0,  defaultServingG: 75  },
  { id: 'pk_pakora',        name: 'Pakora (onion / veg)',          caloriesPer100g: 260, proteinPer100g: 5.5,  carbsPer100g: 28.0, fatPer100g: 14.0, fiberPer100g: 2.5,  defaultServingG: 100 },
  { id: 'pk_dahi_bhalla',   name: 'Dahi Bhalla',                  caloriesPer100g: 130, proteinPer100g: 6.0,  carbsPer100g: 18.0, fatPer100g: 4.0,  fiberPer100g: 1.5,  defaultServingG: 200 },
  { id: 'pk_chaat',         name: 'Aloo Chaat',                   caloriesPer100g: 140, proteinPer100g: 3.5,  carbsPer100g: 22.0, fatPer100g: 5.0,  fiberPer100g: 3.0,  defaultServingG: 200 },
  { id: 'pk_gol_gappa',     name: 'Gol Gappa / Pani Puri (6pcs)', caloriesPer100g: 185, proteinPer100g: 4.0,  carbsPer100g: 30.0, fatPer100g: 5.5,  fiberPer100g: 2.0,  defaultServingG: 100 },
  { id: 'pk_lassi_sweet',   name: 'Lassi (sweet)',                 caloriesPer100g: 80,  proteinPer100g: 3.5,  carbsPer100g: 12.0, fatPer100g: 2.5,  fiberPer100g: 0.0,  defaultServingG: 300 },
  { id: 'pk_lassi_salt',    name: 'Lassi (salted)',                caloriesPer100g: 55,  proteinPer100g: 3.5,  carbsPer100g: 4.5,  fatPer100g: 2.5,  fiberPer100g: 0.0,  defaultServingG: 300 },
  { id: 'pk_chai',          name: 'Doodh Patti Chai',             caloriesPer100g: 50,  proteinPer100g: 2.0,  carbsPer100g: 6.0,  fatPer100g: 2.0,  fiberPer100g: 0.0,  defaultServingG: 200 },
  { id: 'pk_paratha_egg',   name: 'Egg Paratha',                  caloriesPer100g: 295, proteinPer100g: 10.0, carbsPer100g: 35.0, fatPer100g: 13.0, fiberPer100g: 2.0,  defaultServingG: 130 },

  // ── Desserts / Sweets ────────────────────────────────────────────────────
  { id: 'pk_kheer',         name: 'Kheer (rice pudding)',         caloriesPer100g: 145, proteinPer100g: 4.0,  carbsPer100g: 22.0, fatPer100g: 5.0,  fiberPer100g: 0.2,  defaultServingG: 200 },
  { id: 'pk_gulab_jamun',   name: 'Gulab Jamun (1 piece)',        caloriesPer100g: 310, proteinPer100g: 5.0,  carbsPer100g: 50.0, fatPer100g: 10.0, fiberPer100g: 0.5,  defaultServingG: 50  },
  { id: 'pk_gajar_halwa',   name: 'Gajar Halwa',                  caloriesPer100g: 240, proteinPer100g: 4.5,  carbsPer100g: 34.0, fatPer100g: 10.0, fiberPer100g: 1.5,  defaultServingG: 150 },
  { id: 'pk_jalebi',        name: 'Jalebi',                       caloriesPer100g: 380, proteinPer100g: 3.0,  carbsPer100g: 68.0, fatPer100g: 11.0, fiberPer100g: 0.5,  defaultServingG: 80  },
  { id: 'pk_sheer_khurma',  name: 'Sheer Khurma',                 caloriesPer100g: 185, proteinPer100g: 5.5,  carbsPer100g: 28.0, fatPer100g: 6.5,  fiberPer100g: 1.0,  defaultServingG: 200 },
];
