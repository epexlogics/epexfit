/**
 * app.config.js — Dynamic Expo config (takes precedence over app.json)
 *
 * This file is the single source of truth for the `extra` config block.
 * Credentials are loaded exclusively from environment variables (EXPO_PUBLIC_*).
 * Never hardcode secrets here — set them in .env (local dev) or EAS Secrets (CI/build).
 *
 * See .env.example for required variable names.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    // Preserve EAS project linkage from app.json
    eas: config.extra?.eas,
    // Runtime config — populated from env vars; undefined in dev if .env not set
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    usdaApiKey: process.env.EXPO_PUBLIC_USDA_API_KEY,
    stravaClientId: process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID,
  },
});
