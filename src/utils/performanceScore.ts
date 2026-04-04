export interface APSInput {
  plannedWorkouts: number;
  completedWorkouts: number;
  stepGoal: number;
  stepsToday: number;
  calGoal: number;
  calBurned: number;
  proteinGoal: number;
  proteinActual: number;
  waterGoal: number;
  waterActual: number;
  sleepHours: number;
  mood: number; // 1-5
  weekPace?: number; // min/km
  prevWeekPace?: number;
}

export interface APSResult {
  total: number;
  breakdown: {
    consistency: number;
    activity: number;
    nutrition: number;
    recovery: number;
    progress: number;
  };
  label: string;
  color: string;
}

export function calculateAPS(input: APSInput): APSResult {
  const pct = (v: number, g: number) => (g > 0 ? Math.min(v / g, 1) : 0);

  const consistency =
    input.plannedWorkouts > 0
      ? pct(input.completedWorkouts, input.plannedWorkouts) * 100
      : 60; // neutral if no plan

  const activity =
    (pct(input.stepsToday, input.stepGoal) * 0.5 +
      pct(input.calBurned, input.calGoal) * 0.5) *
    100;

  const nutrition =
    (pct(input.proteinActual, input.proteinGoal) * 0.6 +
      pct(input.waterActual, input.waterGoal) * 0.4) *
    100;

  const recovery =
    (Math.min(input.sleepHours / 8, 1) * 0.7 + (input.mood / 5) * 0.3) * 100;

  const progress =
    input.weekPace && input.prevWeekPace && input.prevWeekPace > 0
      ? Math.min(
          ((input.prevWeekPace - input.weekPace) / input.prevWeekPace) * 500,
          100
        )
      : 50;

  const total = Math.round(
    consistency * 0.3 +
      activity * 0.25 +
      nutrition * 0.2 +
      recovery * 0.15 +
      progress * 0.1
  );

  let label = 'Building';
  let color = '#FF5B5B';
  if (total >= 90) { label = 'Elite 🏆'; color = '#00F5C4'; }
  else if (total >= 75) { label = 'Strong 💪'; color = '#F5C842'; }
  else if (total >= 55) { label = 'Active 🏃'; color = '#4D9FFF'; }
  else if (total >= 40) { label = 'Building 📈'; color = '#C084FC'; }

  return {
    total,
    breakdown: { consistency, activity, nutrition, recovery, progress },
    label,
    color,
  };
}
