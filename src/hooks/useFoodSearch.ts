import { useState, useCallback, useRef } from 'react';

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
}

function getNutrient(food: any, name: string): number {
  const n = food.foodNutrients?.find((x: any) =>
    x.nutrientName?.toLowerCase().includes(name.toLowerCase())
  );
  return Math.round((n?.value ?? 0) * 10) / 10;
}

export function useFoodSearch(): UseFoodSearchResult {
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // USDA FoodData Central — free, no registration needed for DEMO_KEY (limited)
        // Replace DEMO_KEY with a real key from https://fdc.nal.usda.gov/api-key-signup.html
        const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=15&api_key=DEMO_KEY`;
        const res = await fetch(url);
        const json = await res.json();

        const mapped: FoodItem[] = (json.foods ?? []).map((f: any) => ({
          id: String(f.fdcId),
          name: f.description || 'Unknown Food',
          brand: f.brandOwner || f.brandName,
          caloriesPer100g: getNutrient(f, 'Energy'),
          proteinPer100g: getNutrient(f, 'Protein'),
          carbsPer100g: getNutrient(f, 'Carbohydrate'),
          fatPer100g: getNutrient(f, 'Total lipid'),
          fiberPer100g: getNutrient(f, 'Fiber'),
          defaultServingG: f.servingSize || 100,
        }));

        setResults(mapped);
      } catch {
        // Fallback: common local foods
        setResults(COMMON_FOODS.filter(f =>
          f.name.toLowerCase().includes(query.toLowerCase())
        ));
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const clear = useCallback(() => setResults([]), []);

  return { results, loading, search, clear };
}

/** Local fallback for when API is unavailable */
const COMMON_FOODS: FoodItem[] = [
  { id: 'egg',     name: 'Egg (boiled)',       caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11, fiberPer100g: 0,   defaultServingG: 60 },
  { id: 'chicken', name: 'Chicken Breast',     caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0,   fatPer100g: 3.6, fiberPer100g: 0,  defaultServingG: 150 },
  { id: 'rice',    name: 'White Rice (cooked)',caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, defaultServingG: 200 },
  { id: 'oats',    name: 'Oats (dry)',         caloriesPer100g: 389, proteinPer100g: 17, carbsPer100g: 66,  fatPer100g: 7,   fiberPer100g: 10.6, defaultServingG: 80 },
  { id: 'banana',  name: 'Banana',             caloriesPer100g: 89,  proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, fiberPer100g: 2.6, defaultServingG: 120 },
  { id: 'milk',    name: 'Whole Milk',         caloriesPer100g: 61,  proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3, fiberPer100g: 0, defaultServingG: 250 },
  { id: 'bread',   name: 'Whole Wheat Bread',  caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41,  fatPer100g: 3.4, fiberPer100g: 6,  defaultServingG: 40 },
  { id: 'salmon',  name: 'Salmon (cooked)',    caloriesPer100g: 206, proteinPer100g: 20, carbsPer100g: 0,   fatPer100g: 13,  fiberPer100g: 0,  defaultServingG: 150 },
  { id: 'apple',   name: 'Apple',              caloriesPer100g: 52,  proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2, fiberPer100g: 2.4, defaultServingG: 150 },
  { id: 'yogurt',  name: 'Greek Yogurt',       caloriesPer100g: 59,  proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4, fiberPer100g: 0,  defaultServingG: 200 },
];
