// Credentials are loaded from environment variables.
// Copy .env.example to .env and fill in your Supabase values.
// For EAS builds, set these in eas.json under "env" or use EAS Secrets.
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const SUPABASE_URL: string =
  (extra.supabaseUrl as string) || '';

export const SUPABASE_ANON_KEY: string =
  (extra.supabaseAnonKey as string) || '';

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
