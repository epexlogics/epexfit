/**
 * Audio coaching cues during activities
 * Uses expo-speech for TTS announcements
 * Called from TrackingContext at km milestones
 */
import * as Speech from 'expo-speech';

export interface CoachCueOptions {
  km: number;
  paceStr: string;       // e.g. "5:30"
  totalDistKm: number;
  elapsedMin: number;
  calories: number;
}

/**
 * Speaks a contextual coaching cue at each km milestone
 */
export async function speakKmCue(opts: CoachCueOptions): Promise<void> {
  const { km, paceStr, totalDistKm, elapsedMin, calories } = opts;

  let message = '';

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

  try {
    await Speech.speak(message, {
      rate: 0.92,
      pitch: 1.0,
      language: 'en-US',
    });
  } catch {
    // Silent fail — speech is non-critical
  }
}

/**
 * Speak a motivational nudge mid-run
 */
export async function speakMotivation(type: 'halfway' | 'goal_near' | 'pr_pace'): Promise<void> {
  const messages: Record<string, string> = {
    halfway:   "Halfway there! You're doing great. Maintain your form.",
    goal_near: "Almost at your goal! One last push.",
    pr_pace:   "You're running at your personal best pace. Keep it up!",
  };

  try {
    await Speech.speak(messages[type] ?? 'Keep going!', { rate: 0.92, pitch: 1.0, language: 'en-US' });
  } catch {}
}

/**
 * Announce workout rest end
 */
export async function speakRestEnd(nextExercise?: string): Promise<void> {
  const msg = nextExercise
    ? `Rest complete. Next up: ${nextExercise}.`
    : 'Rest complete. Next set.';
  try {
    await Speech.speak(msg, { rate: 0.95 });
  } catch {}
}
