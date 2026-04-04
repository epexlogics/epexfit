export interface BadgeDefinition {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  category: 'streak' | 'distance' | 'consistency' | 'nutrition' | 'special';
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Streak badges
  { id: 'streak_3',   label: '3-Day Streak',   icon: '🔥', description: 'Active 3 days in a row',   color: '#FF9500', category: 'streak' },
  { id: 'streak_7',   label: '7-Day Streak',   icon: '🔥', description: 'Active 7 days in a row',   color: '#FF6B00', category: 'streak' },
  { id: 'streak_14',  label: '2-Week Streak',  icon: '⚡', description: 'Active 14 days in a row',  color: '#F5C842', category: 'streak' },
  { id: 'streak_30',  label: '30-Day Streak',  icon: '⚡', description: 'Active 30 days in a row',  color: '#F5C842', category: 'streak' },
  { id: 'streak_60',  label: '60-Day Inferno', icon: '🌟', description: 'Active 60 days in a row',  color: '#00F5C4', category: 'streak' },
  { id: 'streak_100', label: 'Century Blaze',  icon: '🏆', description: 'Active 100 days in a row', color: '#C084FC', category: 'streak' },
  // Distance badges
  { id: 'dist_1km',    label: 'First Step',     icon: '👟', description: 'Completed your first 1km',   color: '#4D9FFF', category: 'distance' },
  { id: 'dist_5km',    label: '5K Club',        icon: '🏅', description: 'Ran a total of 5km',         color: '#4D9FFF', category: 'distance' },
  { id: 'dist_10km',   label: '10K Milestone',  icon: '🎯', description: 'Ran a total of 10km',        color: '#00C853', category: 'distance' },
  { id: 'dist_21km',   label: 'Half Marathon',  icon: '🏃', description: 'Ran a total of 21km',        color: '#00F5C4', category: 'distance' },
  { id: 'dist_42km',   label: 'Marathon Bound', icon: '🌠', description: 'Ran a total of 42km',        color: '#F5C842', category: 'distance' },
  { id: 'dist_100km',  label: 'Century Runner', icon: '🏆', description: 'Ran a total of 100km',       color: '#C084FC', category: 'distance' },
  // Steps badges
  { id: 'steps_10k',   label: '10K Steps Day',  icon: '🦵', description: 'Hit 10,000 steps in one day', color: '#4D9FFF', category: 'consistency' },
  { id: 'steps_20k',   label: 'Step Machine',   icon: '⚡', description: 'Hit 20,000 steps in one day', color: '#F5C842', category: 'consistency' },
  // Consistency badges
  { id: 'workouts_5',  label: 'Active Week',    icon: '💪', description: '5 workouts in one week',   color: '#FF5B5B', category: 'consistency' },
  { id: 'workouts_20', label: 'Month Warrior',  icon: '🛡️', description: '20 workouts in a month',   color: '#F5C842', category: 'consistency' },
  { id: 'workouts_100',label: 'Century Club',   icon: '🏛️', description: '100 total workouts',       color: '#C084FC', category: 'consistency' },
  // Nutrition badges
  { id: 'water_7',     label: 'Hydration Hero', icon: '💧', description: 'Hit water goal 7 days straight', color: '#00BCD4', category: 'nutrition' },
  { id: 'protein_7',   label: 'Protein Pro',    icon: '🥩', description: 'Hit protein goal 7 days straight', color: '#9C27B0', category: 'nutrition' },
  // Special
  { id: 'early_bird',  label: 'Early Bird',     icon: '🌅', description: 'Workout before 7am',         color: '#FFB300', category: 'special' },
  { id: 'night_owl',   label: 'Night Owl',      icon: '🦉', description: 'Workout after 9pm',          color: '#3F51B5', category: 'special' },
  { id: 'weekend_warrior', label: 'Weekend Warrior', icon: '🏖️', description: 'Worked out both Sat & Sun', color: '#FF5722', category: 'special' },
  { id: 'comeback',    label: 'Comeback Kid',   icon: '💫', description: 'Returned after a 5-day break', color: '#00F5C4', category: 'special' },
];

/** Check which badge IDs should be awarded given current stats */
export function evaluateBadges(stats: {
  streak: number;
  totalDistanceKm: number;
  stepsToday: number;
  totalWorkouts: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  waterStreakDays: number;
  proteinStreakDays: number;
  lastActivityHour?: number;
  workedOutSaturday?: boolean;
  workedOutSunday?: boolean;
}): string[] {
  const earned: string[] = [];

  // Streak
  if (stats.streak >= 3)   earned.push('streak_3');
  if (stats.streak >= 7)   earned.push('streak_7');
  if (stats.streak >= 14)  earned.push('streak_14');
  if (stats.streak >= 30)  earned.push('streak_30');
  if (stats.streak >= 60)  earned.push('streak_60');
  if (stats.streak >= 100) earned.push('streak_100');

  // Distance
  if (stats.totalDistanceKm >= 1)   earned.push('dist_1km');
  if (stats.totalDistanceKm >= 5)   earned.push('dist_5km');
  if (stats.totalDistanceKm >= 10)  earned.push('dist_10km');
  if (stats.totalDistanceKm >= 21)  earned.push('dist_21km');
  if (stats.totalDistanceKm >= 42)  earned.push('dist_42km');
  if (stats.totalDistanceKm >= 100) earned.push('dist_100km');

  // Steps
  if (stats.stepsToday >= 10000) earned.push('steps_10k');
  if (stats.stepsToday >= 20000) earned.push('steps_20k');

  // Consistency
  if (stats.workoutsThisWeek >= 5)   earned.push('workouts_5');
  if (stats.workoutsThisMonth >= 20) earned.push('workouts_20');
  if (stats.totalWorkouts >= 100)    earned.push('workouts_100');

  // Nutrition
  if (stats.waterStreakDays >= 7)   earned.push('water_7');
  if (stats.proteinStreakDays >= 7) earned.push('protein_7');

  // Special
  if (stats.lastActivityHour !== undefined && stats.lastActivityHour < 7)  earned.push('early_bird');
  if (stats.lastActivityHour !== undefined && stats.lastActivityHour >= 21) earned.push('night_owl');
  if (stats.workedOutSaturday && stats.workedOutSunday) earned.push('weekend_warrior');

  return earned;
}
