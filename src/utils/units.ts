/**
 * Unit system helpers — single source for metric / imperial.
 * Persisted value must match SettingsScreen (AsyncStorage key below).
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

/** Same key as SettingsScreen — keep in sync */
export const UNIT_SYSTEM_KEY = '@epexfit_unit_system';

export type UnitSystem = 'metric' | 'imperial';

const MI_PER_KM = 0.621371;
const LB_PER_KG = 2.20462;

/** Read/write preference (for services outside React) */
export async function getUnitSystem(): Promise<UnitSystem> {
  const v = await AsyncStorage.getItem(UNIT_SYSTEM_KEY);
  return v === 'imperial' ? 'imperial' : 'metric';
}

/**
 * Current unit system from storage. Reloads on mount, when screen gains focus,
 * and when app returns to foreground (covers returning from Settings).
 */
export function useUnitSystem(): UnitSystem {
  const [system, setSystem] = useState<UnitSystem>('metric');

  const load = useCallback(() => {
    getUnitSystem().then(setSystem);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return system;
}

/** Short distance unit label */
export function distLabel(system: UnitSystem): 'km' | 'mi' {
  return system === 'imperial' ? 'mi' : 'km';
}

/** Format a distance stored in kilometers */
export function formatDistance(km: number, system: UnitSystem, decimals = 1): string {
  if (system === 'imperial') {
    return `${(km * MI_PER_KM).toFixed(decimals)} mi`;
  }
  return `${km.toFixed(decimals)} km`;
}

/** Format body weight stored in kg */
export function formatWeight(kg: number, system: UnitSystem, decimals = 1): string {
  if (system === 'imperial') {
    return `${(kg * LB_PER_KG).toFixed(decimals)} lbs`;
  }
  return `${kg.toFixed(decimals)} kg`;
}
