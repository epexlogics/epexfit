/**
 * Athlete Performance Score (APS) — v3
 * Uses actual user profile data for macro targets (no more hardcoded 120g protein).
 * Scores: Consistency · Activity · Nutrition · Recovery · Progress
 */
export interface APSInput {
  plannedWorkouts: number;
  completedWorkouts: number;
  stepGoal: number;
  stepsToday: number;
  calGoal: number;
  calBurned: number;
  proteinGoal: number;   // from user profile (weight × 1.6 for athletes)
  proteinActual: number;
  waterGoal: number;     // from user profile
  waterActual: number;
  sleepHours: number;
  mood: number;
  weekPace?: number;
  prevWeekPace?: number;
  bodyWeightKg?: number; // for personalised goals
}

export interface APSResult {
  total: number;
  breakdown: { consistency: number; activity: number; nutrition: number; recovery: number; progress: number };
  label: string;
  color: string;
  tip: string;
}

/** Derive personalised daily protein goal: 1.6–2g per kg body weight */
export function calcProteinGoal(weightKg: number, level: 'beginner'|'intermediate'|'advanced' = 'intermediate'): number {
  const multiplier = level === 'advanced' ? 2.0 : level === 'intermediate' ? 1.8 : 1.6;
  return Math.round(weightKg * multiplier);
}

/** Derive daily calorie burn goal from activity level */
export function calcCalorieBurnGoal(level: 'beginner'|'intermediate'|'advanced'): number {
  return level === 'advanced' ? 700 : level === 'intermediate' ? 500 : 350;
}

export function calculateAPS(input: APSInput): APSResult {
  const pct = (v: number, g: number) => (g > 0 ? Math.min(v / g, 1) : 0);

  // FIX: no planned workouts = truly new user → consistency is 0, not a free 60
  const consistency = input.plannedWorkouts > 0
    ? pct(input.completedWorkouts, input.plannedWorkouts) * 100
    : 0;

  const activity = (pct(input.stepsToday, input.stepGoal) * 0.5 + pct(input.calBurned, input.calGoal) * 0.5) * 100;

  const nutrition = (pct(input.proteinActual, input.proteinGoal) * 0.6 + pct(input.waterActual, input.waterGoal) * 0.4) * 100;

  const recovery = (Math.min(input.sleepHours / 8, 1) * 0.7 + (input.mood / 5) * 0.3) * 100;

  // FIX: progress pillar — use calorie burn trend OR pace trend so non-runners score too
  let progress = 0;
  if (input.weekPace && input.prevWeekPace && input.prevWeekPace > 0) {
    // Runner path: improvement in pace (lower = faster = better)
    progress = Math.min(((input.prevWeekPace - input.weekPace) / input.prevWeekPace) * 500, 100);
  } else if (input.calBurned > 0 && input.calGoal > 0) {
    // Non-runner path: reward hitting/exceeding calorie burn goal this week
    progress = Math.min((input.calBurned / input.calGoal) * 60, 100);
  }

  const total = Math.round(
    consistency * 0.30 + activity * 0.25 + nutrition * 0.20 + recovery * 0.15 + progress * 0.10
  );

  // Specific actionable tip
  let tip = 'Log your first full day to get your personal APS.';
  if (input.stepsToday < input.stepGoal * 0.5) tip = "You're less than halfway to your step goal — a 20-min walk closes the gap.";
  else if (input.waterActual < input.waterGoal * 0.6) tip = 'Hydration is behind — drink 2 glasses now.';
  else if (input.proteinActual < input.proteinGoal * 0.5) tip = 'Protein is low — add a high-protein meal or shake.';
  else if (input.sleepHours < 6) tip = 'Under 6h sleep detected — prioritise rest tonight.';
  else if (total >= 80) tip = 'Outstanding day! Keep the momentum going.';
  else if (total >= 60) tip = 'Solid effort — one more win today pushes you to Strong.';

  /* Tier colors align with AppThemeColors aps* (midnight / cyan system) */
  let label = 'Building', color = '#FB7185';
  if (total >= 90) { label = 'Elite 🏆'; color = '#4ADE80'; }
  else if (total >= 75) { label = 'Strong 💪'; color = '#22D3EE'; }
  else if (total >= 55) { label = 'Active 🏃'; color = '#38BDF8'; }
  else if (total >= 40) { label = 'Building 📈'; color = '#C084FC'; }

  return { total, breakdown: { consistency, activity, nutrition, recovery, progress }, label, color, tip };
}