import { useState, useCallback, useRef, useEffect } from 'react';
import Constants from 'expo-constants';
import { useToast } from '../contexts/ToastContext';

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

interface UseFoodSearchResult {
  results: FoodItem[];
  loading: boolean;
  search: (query: string) => Promise<void>;
  clear: () => void;
  apiAvailable: boolean;
}

function getNutrient(food: unknown, name: string): number {
  const f = food as { foodNutrients?: Array<{ nutrientName?: string; value?: number }> };
  const n = f.foodNutrients?.find((x) =>
    x.nutrientName?.toLowerCase().includes(name.toLowerCase()),
  );
  return Math.round((n?.value ?? 0) * 10) / 10;
}

function getFiber(food: unknown): number {
  const f = food as { foodNutrients?: Array<{ nutrientName?: string; value?: number }> };
  const n = f.foodNutrients?.find((x) => {
    const nm: string = x.nutrientName?.toLowerCase() ?? '';
    return (
      nm.includes('fiber') &&
      (nm.includes('total') || nm.includes('dietary') || nm === 'fiber')
    );
  });
  return Math.round((n?.value ?? 0) * 10) / 10;
}

/** Returns the validated USDA API key or null if missing. */
function getUsdaKey(): string | null {
  // Expo public env var (preferred)
  const envKey = process.env.EXPO_PUBLIC_USDA_API_KEY;
  if (envKey && envKey.trim().length > 0) return envKey.trim();

  // app.config.js extra fallback
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  const extraKey = extra.usdaApiKey;
  if (extraKey && extraKey.trim().length > 0 && extraKey !== 'DEMO_KEY') {
    return extraKey.trim();
  }

  return null;
}

export function useFoodSearch(): UseFoodSearchResult {
  const { show } = useToast();
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);

  // Warn once on mount if key is missing
  useEffect(() => {
    const key = getUsdaKey();
    if (!key && !warnedRef.current) {
      warnedRef.current = true;
      setApiAvailable(false);
      show({
        message: 'USDA API key missing — food search uses local fallback only. Add EXPO_PUBLIC_USDA_API_KEY to your .env file.',
        variant: 'warning',
        duration: 6000,
      });
    }
  }, [show]);

  const search = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const usdaKey = getUsdaKey();

        if (usdaKey) {
          try {
            const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=15&api_key=${usdaKey}`;
            const res = await fetch(url);

            if (!res.ok) {
              throw new Error(`USDA API error: ${res.status}`);
            }

            const json = (await res.json()) as {
              foods?: Array<{
                fdcId: number;
                description?: string;
                brandOwner?: string;
                brandName?: string;
                servingSize?: number;
                foodNutrients?: Array<{ nutrientName?: string; value?: number }>;
              }>;
            };

            const mapped: FoodItem[] = (json.foods ?? []).map((f) => ({
              id: String(f.fdcId),
              name: f.description || 'Unknown Food',
              brand: f.brandOwner || f.brandName,
              caloriesPer100g: getNutrient(f, 'Energy'),
              proteinPer100g: getNutrient(f, 'Protein'),
              carbsPer100g: getNutrient(f, 'Carbohydrate'),
              fatPer100g: getNutrient(f, 'Total lipid'),
              fiberPer100g: getFiber(f),
              defaultServingG: f.servingSize || 100,
            }));

            setResults(mapped);
          } catch (err) {
            show({
              message: 'Food search unavailable. Showing local results.',
              variant: 'warning',
              duration: 3000,
            });
            setResults(
              COMMON_FOODS.filter((f) =>
                f.name.toLowerCase().includes(query.toLowerCase()),
              ),
            );
          } finally {
            setLoading(false);
          }
        } else {
          // No key — use local fallback silently (already warned on mount)
          setResults(
            COMMON_FOODS.filter((f) =>
              f.name.toLowerCase().includes(query.toLowerCase()),
            ),
          );
          setLoading(false);
        }
      }, 400);
    },
    [show],
  );

  const clear = useCallback(() => setResults([]), []);

  return { results, loading, search, clear, apiAvailable };
}

/** Local fallback for when API is unavailable */
const COMMON_FOODS: FoodItem[] = [
  { id: 'egg',     name: 'Egg (boiled)',        caloriesPer100g: 155, proteinPer100g: 13,  carbsPer100g: 1.1, fatPer100g: 11,  fiberPer100g: 0,    defaultServingG: 60  },
  { id: 'chicken', name: 'Chicken Breast',      caloriesPer100g: 165, proteinPer100g: 31,  carbsPer100g: 0,   fatPer100g: 3.6, fiberPer100g: 0,    defaultServingG: 150 },
  { id: 'rice',    name: 'White Rice (cooked)', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28,  fatPer100g: 0.3, fiberPer100g: 0.4,  defaultServingG: 200 },
  { id: 'oats',    name: 'Oats (dry)',           caloriesPer100g: 389, proteinPer100g: 17,  carbsPer100g: 66,  fatPer100g: 7,   fiberPer100g: 10.6, defaultServingG: 80  },
  { id: 'banana',  name: 'Banana',              caloriesPer100g: 89,  proteinPer100g: 1.1, carbsPer100g: 23,  fatPer100g: 0.3, fiberPer100g: 2.6,  defaultServingG: 120 },
  { id: 'milk',    name: 'Whole Milk',           caloriesPer100g: 61,  proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3, fiberPer100g: 0,    defaultServingG: 250 },
  { id: 'bread',   name: 'Whole Wheat Bread',   caloriesPer100g: 247, proteinPer100g: 13,  carbsPer100g: 41,  fatPer100g: 3.4, fiberPer100g: 6,    defaultServingG: 40  },
  { id: 'salmon',  name: 'Salmon (cooked)',      caloriesPer100g: 206, proteinPer100g: 20,  carbsPer100g: 0,   fatPer100g: 13,  fiberPer100g: 0,    defaultServingG: 150 },
  { id: 'apple',   name: 'Apple',               caloriesPer100g: 52,  proteinPer100g: 0.3, carbsPer100g: 14,  fatPer100g: 0.2, fiberPer100g: 2.4,  defaultServingG: 150 },
  { id: 'yogurt',  name: 'Greek Yogurt',         caloriesPer100g: 59,  proteinPer100g: 10,  carbsPer100g: 3.6, fatPer100g: 0.4, fiberPer100g: 0,    defaultServingG: 200 },
];
