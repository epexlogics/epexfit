/**
 * activityStore — Single source of truth for today's activity metrics.
 *
 * Table:  daily_logs  (user_id, date, steps, distance, calories, ...)
 * Unique: (user_id, date)
 *
 * This store owns steps/distance/calories for the current day.
 * TrackingContext writes here via saveDailyActivityMetrics() after a workout.
 * DailyLogScreen reads/writes here for manual step entry.
 * HomeScreen reads from here — never from TrackingContext directly for display.
 *
 * Flow: any write → upsert daily_logs → optimistic state update → realtime
 *       subscription propagates to all consumers.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import dayjs from '../utils/dayjs';

interface ActivityMetrics {
  steps: number;
  distance: number; // km
  calories: number;
}

interface ActivityState extends ActivityMetrics {
  date: string;
  loading: boolean;
}

interface ActivityStoreContextType extends ActivityState {
  /** Merge new metrics into today's log (additive — adds on top of existing) */
  addActivityMetrics: (metrics: Partial<ActivityMetrics>) => Promise<void>;
  /** Overwrite specific fields in today's log */
  setActivityMetrics: (metrics: Partial<ActivityMetrics>) => Promise<void>;
  refresh: () => Promise<void>;
}

const ActivityStoreContext = createContext<ActivityStoreContextType | undefined>(undefined);

export const ActivityStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // FIX: compute today dynamically so midnight rollover works correctly
  const getToday = () => dayjs().format('YYYY-MM-DD');
  const today = getToday();
  const [state, setState] = useState<ActivityState>({
    steps: 0, distance: 0, calories: 0, date: today, loading: true,
  });
  const realtimeSub = useRef<any>(null);
  // Keep a ref of current state for additive operations
  const stateRef = useRef(state);
  stateRef.current = state;

  const fetchToday = useCallback(async () => {
    if (!user) return;
    setState(s => ({ ...s, loading: true }));
    const { data } = await supabase
      .from('daily_logs')
      .select('steps, distance, calories')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    setState(s => ({
      ...s,
      steps: data?.steps ?? 0,
      distance: data?.distance ?? 0,
      calories: data?.calories ?? 0,
      loading: false,
    }));
  }, [user, today]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  useEffect(() => {
    if (!user) return;
    realtimeSub.current = supabase
      .channel(`activity_metrics_${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'daily_logs',
        filter: `user_id=eq.${user.id}`,
      }, fetchToday)
      .subscribe();
    return () => { realtimeSub.current?.unsubscribe(); };
  }, [user, fetchToday]);

  const upsertMetrics = useCallback(async (metrics: Partial<ActivityMetrics>) => {
    if (!user) return;
    const currentDate = getToday(); // FIX: always use current date at call time
    await supabase
      .from('daily_logs')
      .upsert(
        { user_id: user.id, date: currentDate, ...metrics },
        { onConflict: 'user_id,date' }
      );
  }, [user]);

  const addActivityMetrics = useCallback(async (metrics: Partial<ActivityMetrics>) => {
    if (!user) return;
    const current = stateRef.current;
    const merged: Partial<ActivityMetrics> = {
      steps: (current.steps) + (metrics.steps ?? 0),
      distance: parseFloat(((current.distance) + (metrics.distance ?? 0)).toFixed(3)),
      calories: (current.calories) + (metrics.calories ?? 0),
    };
    setState(s => ({ ...s, ...merged })); // optimistic
    await upsertMetrics(merged);
  }, [user, upsertMetrics]);

  const setActivityMetrics = useCallback(async (metrics: Partial<ActivityMetrics>) => {
    if (!user) return;
    setState(s => ({ ...s, ...metrics })); // optimistic
    await upsertMetrics(metrics);
  }, [user, upsertMetrics]);

  return (
    <ActivityStoreContext.Provider value={{ ...state, addActivityMetrics, setActivityMetrics, refresh: fetchToday }}>
      {children}
    </ActivityStoreContext.Provider>
  );
};

export const useActivityStore = (): ActivityStoreContextType => {
  const ctx = useContext(ActivityStoreContext);
  if (!ctx) throw new Error('useActivityStore must be used within ActivityStoreProvider');
  return ctx;
};
