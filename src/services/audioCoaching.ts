/**
 * audioCoaching.ts — Audio coaching cues during activities
 *
 * Changes from original:
 * - Added imperial (mile) support
 * - Added half-distance announcement
 * - Added activity-completion fanfare
 * - Added isSpeechEnabled() silent-mode guard (reads user preference)
 * - All cues respect @epexfit_unit_system setting
 */
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UNIT_SYSTEM_KEY } from '../screens/SettingsScreen';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CoachCueOptions {
  /** Distance reached, in km */
  km: number;
  /** Formatted pace string, e.g. "5:30" */
  paceStr: string;
  /** Total target distance in km (for half-distance detection) */
  totalDistKm: number;
  /** Elapsed minutes */
  elapsedMin: number;
  calories: number;
}

export interface CompletionCueOptions {
  distanceKm: number;
  durationMin: number;
  avgPaceStr: string;
  calories: number;
}

// ── Silent mode guard ──────────────────────────────────────────────────────

let _speechEnabled: boolean | null = null;

/** Returns false if the user has disabled audio coaching in settings. */
async function isSpeechEnabled(): Promise<boolean> {
  if (_speechEnabled !== null) return _speechEnabled;
  try {
    const val = await AsyncStorage.getItem('@epexfit_audio_coaching');
    _speechEnabled = val !== 'false'; // default: enabled
    return _speechEnabled;
  } catch {
    return true;
  }
}

/** Call this when the user toggles audio coaching in Settings. */
export function invalidateSpeechCache(): void {
  _speechEnabled = null;
}

// ── Unit helpers ───────────────────────────────────────────────────────────

async function getUnitSystem(): Promise<'metric' | 'imperial'> {
  try {
    const val = await AsyncStorage.getItem(UNIT_SYSTEM_KEY);
    return (val === 'imperial') ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

function kmToMiles(km: number): number {
  return Math.round(km * 0.62137 * 10) / 10;
}

// ── Core speak wrapper ─────────────────────────────────────────────────────

async function speak(message: string): Promise<void> {
  if (!(await isSpeechEnabled())) return;
  try {
    // Stop any currently speaking cue before starting a new one
    if (await Speech.isSpeakingAsync()) {
      await Speech.stop();
    }
    await Speech.speak(message, {
      rate: 0.92,
      pitch: 1.0,
      language: 'en-US',
    });
  } catch {
    // Non-critical — silent fail
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Announce every km (or mile) milestone.
 * Triggered by TrackingContext when distance crosses a whole-unit boundary.
 */
export async function speakKmCue(opts: CoachCueOptions): Promise<void> {
  const { km, paceStr, elapsedMin, calories } = opts;
  const units = await getUnitSystem();

  let message = '';

  if (units === 'imperial') {
    const miles = kmToMiles(km);
    if (miles === 1) {
      message = `First mile done. Pace ${paceStr} per mile. Keep it steady.`;
    } else if (miles === 3.1) {
      message = `5K! Great work. ${elapsedMin} minutes in. Pace ${paceStr}.`;
    } else if (miles === 6.2) {
      message = `10K — outstanding effort! ${calories} calories burned.`;
    } else if (miles % 5 === 0) {
      message = `${miles} miles complete. Pace ${paceStr}. Keep pushing.`;
    } else {
      message = `Mile ${miles}. Pace ${paceStr} per mile.`;
    }
  } else {
    if (km === 1) {
      message = `First kilometer done. Pace ${paceStr} per kilometer. Keep it steady.`;
    } else if (km === 5) {
      message = `5 kilometers! Great work. ${elapsedMin} minutes in. Pace ${paceStr}.`;
    } else if (km === 10) {
      message = `10 kilometers — that's a 10K! Outstanding effort. ${calories} calories burned.`;
    } else if (km % 5 === 0) {
      message = `${km} kilometers complete. Pace ${paceStr}. Keep pushing.`;
    } else {
      message = `Kilometer ${km}. Pace ${paceStr} per kilometer.`;
    }
  }

  await speak(message);
}

/**
 * Announce half-distance milestone.
 * Call when currentKm >= totalDistKm / 2 (once per session).
 */
export async function speakHalfDistance(opts: {
  distanceKm: number;
  paceStr: string;
}): Promise<void> {
  const units = await getUnitSystem();
  const dist =
    units === 'imperial'
      ? `${kmToMiles(opts.distanceKm)} miles`
      : `${opts.distanceKm} kilometers`;

  await speak(
    `Halfway there! ${dist} completed. Current pace ${opts.paceStr}. You're doing great — maintain your form.`,
  );
}

/**
 * Announce activity completion.
 */
export async function speakCompletion(opts: CompletionCueOptions): Promise<void> {
  const { distanceKm, durationMin, avgPaceStr, calories } = opts;
  const units = await getUnitSystem();

  const distLabel =
    units === 'imperial'
      ? `${kmToMiles(distanceKm)} miles`
      : `${distanceKm} kilometers`;

  await speak(
    `Activity complete! You covered ${distLabel} in ${durationMin} minutes. ` +
    `Average pace ${avgPaceStr}. ${calories} calories burned. Amazing work!`,
  );
}

/**
 * Speak a motivational nudge mid-run.
 */
export async function speakMotivation(
  type: 'halfway' | 'goal_near' | 'pr_pace',
): Promise<void> {
  const messages: Record<string, string> = {
    halfway:   "Halfway there! You're doing great. Maintain your form.",
    goal_near: 'Almost at your goal! One last push.',
    pr_pace:   "You're running at your personal best pace. Keep it up!",
  };
  await speak(messages[type] ?? 'Keep going!');
}

/**
 * Announce workout rest end (used by ActiveWorkoutScreen).
 */
export async function speakRestEnd(nextExercise?: string): Promise<void> {
  const msg = nextExercise
    ? `Rest complete. Next up: ${nextExercise}.`
    : 'Rest complete. Next set.';
  await speak(msg);
}

/**
 * Set user preference for audio coaching.
 */
export async function setAudioCoachingEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem('@epexfit_audio_coaching', enabled ? 'true' : 'false');
  invalidateSpeechCache();
}

/**
 * Read current preference.
 */
export async function getAudioCoachingEnabled(): Promise<boolean> {
  return isSpeechEnabled();
}
