export interface User {
  id: string;
  email: string;
  fullName: string;
  avatar?: string;
  height?: number;
  weight?: number;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  height: number;
  weight: number;
  age: number;
  gender: string;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  id: string;
  userId: string;
  type: 'walking' | 'running' | 'cycling' | 'swimming' | 'strength' | 'hiit' | 'yoga' | 'football' | 'other';
  steps: number;
  distance: number;
  calories: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  route?: LocationPoint[];
  photoUrl?: string;
  photoOverlayUrl?: string;
  notes?: string;
  createdAt: Date;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  altitude?: number;
  speed?: number;
}

export interface Goal {
  id: string;
  userId: string;
  type: 'steps' | 'running' | 'weight' | 'water' | 'calories' | 'protein' | 'fiber';
  target: number;
  current: number;
  unit: string;
  startDate: Date;
  deadline: Date;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyLog {
  id: string;
  userId: string;
  date: string;
  steps: number;
  distance: number;
  calories: number;
  water: number;
  protein: number;
  fiber: number;
  sleep: number;
  mood: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  type: string;
  duration: number;
  calories: number;
  exercises: Exercise[];
  scheduledDate: Date;
  completed: boolean;
  notes?: string;
  createdAt: Date;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number;
  rest?: number;
}

export interface Reminder {
  id: string;
  userId: string;
  type: 'walking' | 'workout' | 'water' | 'protein' | 'fiber' | 'medication';
  title: string;
  message: string;
  time: string;
  enabled: boolean;
  days: number[];
  lastTriggered?: Date;
  createdAt: Date;
}

export interface TrackingState {
  isTracking: boolean;
  currentActivity: Partial<Activity> | null;
  steps: number;
  distance: number;
  calories: number;
  duration: number;
  locationPoints: LocationPoint[];
  error: string | null;
}
