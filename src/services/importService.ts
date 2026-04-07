/**
 * importService.ts — Activity import from Strava, Garmin, Apple Health
 *
 * Dependencies:
 *   expo-auth-session (Strava OAuth)
 *   expo-health-connect (Android Health Connect)
 *   react-native-health (iOS HealthKit) — optional
 */
import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ImportedActivity {
  externalId: string;
  source: 'strava' | 'garmin' | 'apple_health' | 'google_fit';
  type: string;
  distanceKm: number;
  durationSec: number;
  calories: number;
  startedAt: string;
  name?: string;
  avgHeartRate?: number;
  routePolyline?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

// ── Deduplication ──────────────────────────────────────────────────────────

async function getExistingExternalIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('activities')
    .select('external_id')
    .eq('user_id', userId)
    .not('external_id', 'is', null);

  return new Set((data ?? []).map((r: { external_id: string }) => r.external_id));
}

// ── Save to Supabase ───────────────────────────────────────────────────────

async function saveActivities(
  userId: string,
  activities: ImportedActivity[],
  existingIds: Set<string>,
): Promise<ImportResult> {
  let imported = 0, skipped = 0, errors = 0;

  for (const act of activities) {
    if (existingIds.has(act.externalId)) { skipped++; continue; }

    const { error } = await supabase.from('activities').insert({
      user_id: userId,
      external_id: act.externalId,
      source: act.source,
      type: act.type,
      distance: act.distanceKm,
      duration: act.durationSec,
      calories: act.calories,
      started_at: act.startedAt,
      name: act.name ?? null,
      avg_heart_rate: act.avgHeartRate ?? null,
      route_polyline: act.routePolyline ?? null,
    });

    if (error) { errors++; } else { imported++; existingIds.add(act.externalId); }
  }

  return { imported, skipped, errors };
}

// ── Strava ─────────────────────────────────────────────────────────────────

const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/mobile/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

/**
 * Exchange an authorization code for tokens (call from ImportScreen after
 * the user completes the Strava OAuth flow via expo-auth-session).
 */
export async function exchangeStravaCode(
  code: string,
  clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string; athleteId: number }> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
  const json = await res.json() as {
    access_token: string;
    refresh_token: string;
    athlete: { id: number };
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    athleteId: json.athlete.id,
  };
}

/**
 * Fetch and import Strava activities (up to 200, newest first).
 */
export async function importFromStrava(
  accessToken: string,
  perPage = 50,
  page = 1,
): Promise<ImportResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`);

  const rawActivities = await res.json() as Array<Record<string, unknown>>;
  const existingIds = await getExistingExternalIds(user.id);

  const mapped: ImportedActivity[] = rawActivities.map((a) => ({
    externalId: `strava_${a.id}`,
    source: 'strava',
    type: String(a.sport_type ?? a.type ?? 'other').toLowerCase(),
    distanceKm: Number(a.distance ?? 0) / 1000,
    durationSec: Number(a.moving_time ?? 0),
    calories: Number(a.calories ?? 0),
    startedAt: String(a.start_date),
    name: String(a.name ?? ''),
    avgHeartRate: a.average_heartrate ? Number(a.average_heartrate) : undefined,
    routePolyline: a.map ? String((a.map as Record<string, unknown>).summary_polyline ?? '') : undefined,
  }));

  return saveActivities(user.id, mapped, existingIds);
}

// ── Apple Health / Google Fit ──────────────────────────────────────────────

/**
 * Import workouts from the platform health store.
 * On Android this uses Health Connect (expo-health-connect).
 * On iOS it uses HealthKit (react-native-health).
 *
 * NOTE: The caller must first request permissions from the relevant
 * health SDK before calling this function.
 */
export async function importFromHealthPlatform(
  workouts: ImportedActivity[],
): Promise<ImportResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const existingIds = await getExistingExternalIds(user.id);
  return saveActivities(user.id, workouts, existingIds);
}

// ── Garmin (TCX/GPX file import) ───────────────────────────────────────────

/**
 * Parse a minimal TCX activity and return an ImportedActivity.
 * For full Garmin Connect API support the user must provide their
 * Garmin Connect credentials — guide is in DEPLOYMENT_GUIDE.md.
 */
export function parseTcxActivity(
  tcxXml: string,
  fallbackId?: string,
): ImportedActivity | null {
  try {
    // Minimal regex-based parse — replace with a proper XML parser in production
    const idMatch = tcxXml.match(/<Id>(.*?)<\/Id>/);
    const calMatch = tcxXml.match(/<Calories>(\d+)<\/Calories>/);
    const distMatch = tcxXml.match(/<DistanceMeters>([\d.]+)<\/DistanceMeters>/g);
    const timeMatch = tcxXml.match(/<TotalTimeSeconds>([\d.]+)<\/TotalTimeSeconds>/);
    const startMatch = tcxXml.match(/<StartTime>(.*?)<\/StartTime>/);

    const externalId = idMatch?.[1] ?? fallbackId ?? `garmin_${Date.now()}`;
    const lastDistRaw = distMatch ? distMatch[distMatch.length - 1] : null;
    const distM = lastDistRaw
      ? parseFloat(lastDistRaw.replace(/<\/?DistanceMeters>/g, ''))
      : 0;

    return {
      externalId: `garmin_${externalId}`,
      source: 'garmin',
      type: 'running',
      distanceKm: distM / 1000,
      durationSec: timeMatch ? parseFloat(timeMatch[1]) : 0,
      calories: calMatch ? parseInt(calMatch[1], 10) : 0,
      startedAt: startMatch?.[1] ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
