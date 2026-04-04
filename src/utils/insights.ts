/**
 * Daily Insight & Challenge Generator
 * Produces a personalised 1-line insight and a daily mini-challenge
 * based on the user's own activity data.
 */

export interface DailyInsight {
  text: string;
  icon: string;
}

export interface DailyChallenge {
  id: string;
  text: string;
  icon: string;
  metric: 'steps' | 'water' | 'activity' | 'sleep';
  target: number;
}

// ── Daily Insights ────────────────────────────────────────────────────────
export function generateInsight(params: {
  avgSleepHours: number;
  avgPaceSecPerKm?: number;
  bestDaySteps: number;
  mostActiveHour?: number;
  weeklyStepsChange: number; // % vs prev week
  currentStreak: number;
}): DailyInsight {
  const insights: DailyInsight[] = [];

  if (params.avgSleepHours > 0 && params.avgPaceSecPerKm) {
    if (params.avgSleepHours >= 7) {
      insights.push({ text: 'You run faster on days you sleep 7+ hours. Protect that rest.', icon: '😴' });
    } else {
      insights.push({ text: 'Your pace tends to drop on low-sleep days. Aim for 7h tonight.', icon: '💤' });
    }
  }

  if (params.weeklyStepsChange > 10) {
    insights.push({ text: `Steps are up ${Math.round(params.weeklyStepsChange)}% vs last week. You\'re trending up. 📈`, icon: '📈' });
  } else if (params.weeklyStepsChange < -10) {
    insights.push({ text: `Steps dropped ${Math.round(Math.abs(params.weeklyStepsChange))}% vs last week. Let\'s get back on track.`, icon: '📉' });
  }

  if (params.mostActiveHour !== undefined) {
    const timeLabel =
      params.mostActiveHour < 12 ? 'morning' :
      params.mostActiveHour < 17 ? 'afternoon' : 'evening';
    insights.push({ text: `Your most active time is ${timeLabel}. Schedule workouts then for best results.`, icon: '⏰' });
  }

  if (params.currentStreak >= 7) {
    insights.push({ text: `${params.currentStreak} consecutive active days — you\'re building an unbreakable habit.`, icon: '🔥' });
  }

  if (params.bestDaySteps > 15000) {
    insights.push({ text: `Your personal best is ${params.bestDaySteps.toLocaleString()} steps. That\'s your ceiling to beat.`, icon: '🏆' });
  }

  // Default if nothing matched
  if (insights.length === 0) {
    insights.push({ text: 'Log your first week of activity to unlock personalised insights.', icon: '💡' });
  }

  // Rotate daily using day of year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return insights[dayOfYear % insights.length];
}

// ── Daily Challenges ──────────────────────────────────────────────────────
const CHALLENGES: DailyChallenge[] = [
  { id: 'steps_500_post_meal', text: 'Take 500 steps after your next meal', icon: '🚶', metric: 'steps', target: 500 },
  { id: 'water_extra_2',       text: 'Drink 2 extra glasses of water today', icon: '💧', metric: 'water', target: 2 },
  { id: 'steps_3k_morning',   text: 'Hit 3,000 steps before noon',         icon: '🌅', metric: 'steps', target: 3000 },
  { id: 'no_lift_day',        text: 'Take a recovery walk — 20 minutes easy', icon: '🧘', metric: 'activity', target: 20 },
  { id: 'steps_10k_today',    text: 'Hit 10,000 steps today — full goal!',  icon: '👟', metric: 'steps', target: 10000 },
  { id: 'sleep_7h',           text: 'Be in bed by 10:30pm for 7h sleep',   icon: '😴', metric: 'sleep', target: 7 },
  { id: 'steps_15min_break',  text: 'Take a 15-minute walk on your next break', icon: '⏱️', metric: 'steps', target: 1200 },
];

export function getDailyChallenge(): DailyChallenge {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return CHALLENGES[dayOfYear % CHALLENGES.length];
}

/** Check if today's challenge is completed based on current values */
export function isChallengeComplete(
  challenge: DailyChallenge,
  current: { steps: number; water: number; sleep: number }
): boolean {
  switch (challenge.metric) {
    case 'steps':    return current.steps >= challenge.target;
    case 'water':    return current.water >= challenge.target;
    case 'sleep':    return current.sleep >= challenge.target;
    case 'activity': return true; // activity challenges are manual
    default:         return false;
  }
}
