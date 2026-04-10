import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { speakKmCue } from '../services/audioCoaching';
import * as TaskManager from 'expo-task-manager';
import { Pedometer } from 'expo-sensors';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { databaseService } from '../services/database';
import { socialService } from '../services/socialService';
import { Activity, LocationPoint, TrackingState } from '../types';
import { useAuth } from './AuthContext';

interface TrackingContextType extends TrackingState {
  startTracking: (type: 'walking' | 'running' | 'cycling' | 'swimming' | 'strength' | 'hiit' | 'yoga' | 'football' | 'other') => Promise<void>;
  stopTracking: (opts?: { avgHr?: number }) => Promise<Activity | null>;
  resetTracking: () => void;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

const BACKGROUND_LOCATION_TASK = 'EPEXFIT_BACKGROUND_LOCATION_TASK';
const TRACKING_SESSION_KEY = '@epexfit_tracking_session';
const TRACKING_BG_POINTS_KEY = '@epexfit_tracking_bg_points';
const DEFAULT_STRIDE_METERS = 0.76;

type ActivityType = 'walking' | 'running' | 'cycling' | 'swimming' | 'strength' | 'hiit' | 'yoga' | 'football' | 'other';

interface TrackingSession {
  startedAt: string;
  selectedType: ActivityType;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(a: LocationPoint, b: LocationPoint): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function distanceFromRoute(points: LocationPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

function calcCalories(type: ActivityType, durationSec: number, weightKg: number): number {
  const met: Record<ActivityType, number> = { walking: 3.8, running: 8.5, cycling: 7.0, swimming: 8.0, strength: 5.0, hiit: 10.0, yoga: 3.0, football: 7.0, other: 5.0 };
  return Math.max(0, Math.round(met[type] * weightKg * (durationSec / 3600)));
}

// Background task — guard against double-define across hot reloads
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(
    BACKGROUND_LOCATION_TASK,
    async ({ data, error }: { data: any; error: any }) => {
      if (error) return;
      const locations: Location.LocationObject[] = data?.locations ?? [];
      if (!locations.length) return;
      try {
        const existing = await AsyncStorage.getItem(TRACKING_BG_POINTS_KEY);
        const prev: LocationPoint[] = existing ? JSON.parse(existing) : [];
        const mapped: LocationPoint[] = locations.map((loc) => ({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          altitude: loc.coords.altitude ?? undefined,
          speed: loc.coords.speed ?? undefined,
          timestamp: new Date(loc.timestamp),
        }));
        await AsyncStorage.setItem(
          TRACKING_BG_POINTS_KEY,
          JSON.stringify([...prev, ...mapped])
        );
      } catch {
        // Background task resilient rehna chahiye
      }
    }
  );
}

const initialState: TrackingState = {
  isTracking: false,
  currentActivity: null,
  steps: 0,
  distance: 0,
  calories: 0,
  duration: 0,
  locationPoints: [],
  error: null,
};

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<TrackingState>(initialState);

  // FIX: selectedActivityType ref — type lock karo, auto-inference se override na ho
  const selectedTypeRef = useRef<ActivityType>('walking');
  const pedometerSub = useRef<{ remove(): void } | null>(null);
  const locationSub = useRef<{ remove(): void } | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const lastStepsRef = useRef(0);
  const announcedKmRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const midnightResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Midnight pedometer reset — steps from yesterday should not bleed into today
  useEffect(() => {
    const scheduleMidnightReset = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setDate(now.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      midnightResetRef.current = setTimeout(() => {
        lastStepsRef.current = 0;
        setState((prev) => ({ ...prev, steps: 0 }));
        scheduleMidnightReset();
      }, msUntilMidnight);
    };
    scheduleMidnightReset();
    return () => {
      if (midnightResetRef.current) clearTimeout(midnightResetRef.current);
    };
  }, []);

  // Restore in-progress session after app restart
  // Also reset state when user changes (account switch) so stale data doesn't bleed
  useEffect(() => {
    const restore = async () => {
      try {
        // If user changed, wipe state first so previous account's data doesn't show
        setState(initialState);
        lastStepsRef.current = 0;

        const hasBg = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        const sessionRaw = await AsyncStorage.getItem(TRACKING_SESSION_KEY);
        if (!hasBg || !sessionRaw) return;

        const session: TrackingSession = JSON.parse(sessionRaw);
        const startedAt = new Date(session.startedAt);
        startTimeRef.current = startedAt;
        selectedTypeRef.current = session.selectedType;

        const bgRaw = await AsyncStorage.getItem(TRACKING_BG_POINTS_KEY);
        const bgPoints: LocationPoint[] = bgRaw
          ? JSON.parse(bgRaw).map((p: any) => ({ ...p, timestamp: new Date(p.timestamp) }))
          : [];

        const elapsed = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));

        setState((prev) => ({
          ...prev,
          isTracking: true,
          currentActivity: { type: session.selectedType, startTime: startedAt, userId: user?.id },
          duration: elapsed,
          locationPoints: bgPoints,
          distance: distanceFromRoute(bgPoints),
          error: null,
        }));
      } catch {
        // Restore errors ignore
      }
    };
    restore();
  }, [user?.id]);

  // Timer — duration + calories update every second
  useEffect(() => {
    if (state.isTracking) {
      timerRef.current = setInterval(() => {
        if (!startTimeRef.current) return;
        const duration = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
        setState((prev) => ({
          ...prev,
          duration,
          calories: calcCalories(
            selectedTypeRef.current,
            duration,
            user?.weight ?? 70
          ),
        }));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isTracking, user?.weight]);

  const startTracking = async (type: ActivityType) => {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') throw new Error('Location permission denied');

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') throw new Error('Background location permission denied');

      // Pedometer permission - non-fatal on Android (not all devices support it)
      try {
        await Pedometer.requestPermissionsAsync();
      } catch { /* Pedometer not available on this device */ }

      const now = new Date();
      startTimeRef.current = now;
      lastStepsRef.current = 0;
      announcedKmRef.current = 0;
      // FIX: User ka selected type lock karo
      selectedTypeRef.current = type;

      await AsyncStorage.removeItem(TRACKING_BG_POINTS_KEY);
      await AsyncStorage.setItem(
        TRACKING_SESSION_KEY,
        JSON.stringify({ startedAt: now.toISOString(), selectedType: type } as TrackingSession)
      );

      setState({
        isTracking: true,
        currentActivity: { type, startTime: now, userId: user?.id },
        steps: 0,
        distance: 0,
        calories: 0,
        duration: 0,
        locationPoints: [],
        error: null,
      });

      // FIX: only start pedometer for ambulatory activities
      // Swimming, cycling, yoga, HIIT, strength = GPS-only distance tracking
      // Pedometer was previously active for ALL activity types, creating nonsense step counts
      const AMBULATORY_ACTIVITIES: ActivityType[] = ['walking', 'running', 'football', 'other'];
      const shouldTrackSteps = AMBULATORY_ACTIVITIES.includes(type);

      const isAvailable = await Pedometer.isAvailableAsync();
      if (isAvailable && shouldTrackSteps) {
        pedometerSub.current = Pedometer.watchStepCount((result) => {
          setState((prev) => {
            const steps = Math.max(result.steps, lastStepsRef.current);
            lastStepsRef.current = steps;
            const stepDist = (steps * DEFAULT_STRIDE_METERS) / 1000;
            const gpsDist = distanceFromRoute(prev.locationPoints);
            return { ...prev, steps, distance: Math.max(stepDist, gpsDist) };
          });
        });
      }

      // Foreground location
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5 },
        (location) => {
          const point: LocationPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date(),
            altitude: location.coords.altitude ?? undefined,
            speed: location.coords.speed ?? undefined,
          };

          setState((prev) => {
            const nextPoints = [...prev.locationPoints, point];
            const gpsDist = distanceFromRoute(nextPoints);
            const stepDist = (prev.steps * DEFAULT_STRIDE_METERS) / 1000;
            const nextDist = Math.max(gpsDist, stepDist);

            const reachedKm = Math.floor(nextDist);
            if (reachedKm > announcedKmRef.current && reachedKm > 0) {
              announcedKmRef.current = reachedKm;
              const elapsedMin = Math.round((Date.now() - (startTimeRef.current?.getTime() ?? Date.now())) / 60000);
              const paceSecPerKm = prev.duration / Math.max(nextDist, 0.01);
              const paceMin = Math.floor(paceSecPerKm / 60);
              const paceSec = Math.round(paceSecPerKm % 60);
              speakKmCue({
                km: reachedKm,
                paceStr: `${paceMin}:${String(paceSec).padStart(2, '0')}`,
                totalDistKm: nextDist,
                elapsedMin,
                calories: prev.calories,
              });
            }

            return {
              ...prev,
              locationPoints: nextPoints,
              distance: nextDist,
              // FIX: Type wahi rakho jo user ne select ki thi — auto-inference remove
              currentActivity: {
                ...prev.currentActivity,
                type: selectedTypeRef.current,
              },
            };
          });
        }
      );

      // Background location
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'Tracking your activity',
          notificationBody: 'EpexFit is recording steps, distance, and route.',
          notificationColor: '#FC4C02',
        },
      });
    } catch (err: any) {
      setState((prev) => ({ ...prev, error: err.message }));
      throw err;
    }
  };

  const syncGoalsAndDailyLog = async (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const { data: existingLog } = await databaseService.getDailyLog(user.id, new Date());

      // FIX: Idempotent save — duplicate risk kam karo
      await databaseService.saveDailyLog({
        userId: user.id,
        date: new Date().toISOString().split('T')[0],
        steps: (existingLog?.steps ?? 0) + activity.steps,
        distance: Number(((existingLog?.distance ?? 0) + activity.distance).toFixed(2)),
        calories: (existingLog?.calories ?? 0) + activity.calories,
        water: existingLog?.water ?? 0,
        protein: existingLog?.protein ?? 0,
        fiber: existingLog?.fiber ?? 0,
        sleep: existingLog?.sleep ?? 0,
        mood: existingLog?.mood ?? 3,
        notes: existingLog?.notes,
      });

      const { data: goals } = await databaseService.getGoals(user.id);
      for (const goal of goals) {
        let delta = 0;
        if (goal.type === 'steps') delta = activity.steps;
        if (goal.type === 'running' && activity.type === 'running') delta = activity.distance;
        if (goal.type === 'calories') delta = activity.calories;
        if (delta > 0) {
          await databaseService.updateGoalProgress(goal.id, Number(goal.current) + delta);
        }
      }
    } catch {
      // Non-critical
    }
  };

  const stopTracking = async (opts?: { avgHr?: number }): Promise<Activity | null> => {
    pedometerSub.current?.remove();
    pedometerSub.current = null;
    locationSub.current?.remove();
    locationSub.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const hasBg = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (hasBg) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch {}

    if (!state.currentActivity || !user) {
      resetTracking();
      return null;
    }

    let bgPoints: LocationPoint[] = [];
    try {
      const raw = await AsyncStorage.getItem(TRACKING_BG_POINTS_KEY);
      bgPoints = raw
        ? JSON.parse(raw).map((p: any) => ({ ...p, timestamp: new Date(p.timestamp) }))
        : [];
    } catch {}

    const mergedRoute = [...state.locationPoints, ...bgPoints];
    const gpsDist = distanceFromRoute(mergedRoute);
    const stepDist = (state.steps * DEFAULT_STRIDE_METERS) / 1000;
    const finalDist = Math.max(gpsDist, stepDist);

    // FIX: Final type bhi selected type se lo, inference se nahi
    const finalType = selectedTypeRef.current;
    const finalCalories = calcCalories(finalType, state.duration, user.weight ?? 70);

    const activityData: Omit<Activity, 'id' | 'createdAt'> = {
      userId: user.id,
      type: finalType,
      steps: state.steps,
      distance: finalDist,
      calories: finalCalories,
      duration: state.duration,
      startTime: startTimeRef.current ?? new Date(),
      endTime: new Date(),
      route: mergedRoute,
      avgHeartRate: opts?.avgHr ?? undefined,
    };

    const { data, error } = await databaseService.saveActivity(activityData);
    if (error) {
      console.error('Error saving activity:', error);
      resetTracking();
      return null;
    }

    const savedActivity: Activity = {
      id: data.id,
      ...activityData,
      createdAt: new Date(data.created_at),
    };

    resetTracking();
    await AsyncStorage.multiRemove([TRACKING_SESSION_KEY, TRACKING_BG_POINTS_KEY]);
    await syncGoalsAndDailyLog(activityData);

    // Publish to social feed (non-blocking, never crashes)
    socialService.publishFeedEvent('activity_completed', {
      activityType: activityData.type,
      distance: activityData.distance,
      duration: activityData.duration,
      calories: activityData.calories,
    });

    return savedActivity;
  };

  const resetTracking = () => {
    setState(initialState);
    startTimeRef.current = null;
    announcedKmRef.current = 0;
  };

  return (
    <TrackingContext.Provider value={{ ...state, startTracking, stopTracking, resetTracking }}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = (): TrackingContextType => {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking must be used within TrackingProvider');
  return ctx;
};
