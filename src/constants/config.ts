// Credentials: EXPO_PUBLIC_* inlined at bundle time + `extra` from app.config.js
// embedded in the native binary (reliable for EAS / release when Metro env differs).
//
// Expo Go often works while APK fails when only one path is set — use both.

import Constants from 'expo-constants';

type ExpoExtra = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';

export const SUPABASE_PUBLISHABLE_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  extra.supabasePublishableKey ??
  '';

export const APP_CONFIG = {
  appName: 'EpexFit',
  version: '1.0.0',
  minStepsGoal: 1000,
  maxStepsGoal: 50000,
  minWaterGoal: 1,
  maxWaterGoal: 15,
  calorieFactor: 0.04,
  stepLength: 0.76,
} as const;

export const STORAGE_KEYS = {
  USER_DATA: '@epexfit_user_data',
  GOALS: '@epexfit_goals',
  SETTINGS: '@epexfit_settings',
  REMINDERS: '@epexfit_reminders',
  ONBOARDING: '@epexfit_onboarding',
} as const;