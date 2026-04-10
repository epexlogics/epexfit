/**
 * sleepStore — Single source of truth for daily sleep hours.
 *
 * Table:  sleep_logs  (user_id, date, hours)
 * Unique: (user_id, date)
 *
 * Flow: upsertSleep() → Supabase upsert → optimistic local state → realtime
 *       subscription keeps all screens in sync automatically.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import dayjs from '../utils/dayjs';

interface SleepState {
  hours: number;
  goal: number;
  date: string;
  loading: boolean;
}

interface SleepContextType extends SleepState {
  upsertSleep: (hours: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_GOAL = 8;
const SleepContext = createContext<SleepContextType | undefined>(undefined);

export const SleepProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // FIX: compute today dynamically so midnight rollover works correctly
  const getToday = () => dayjs().format('YYYY-MM-DD');
  const today = getToday();
  const [state, setState] = useState<SleepState>({ hours: 0, goal: DEFAULT_GOAL, date: today, loading: true });
  const realtimeSub = useRef<any>(null);

  const fetchToday = useCallback(async () => {
    if (!user) return;
    setState(s => ({ ...s, loading: true }));
    const { data } = await supabase
      .from('sleep_logs')
      .select('hours')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    setState(s => ({ ...s, hours: data?.hours ?? 0, loading: false }));
  }, [user, today]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  useEffect(() => {
    if (!user) return;
    realtimeSub.current = supabase
      .channel(`sleep_${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'sleep_logs',
        filter: `user_id=eq.${user.id}`,
      }, fetchToday)
      .subscribe();
    return () => { realtimeSub.current?.unsubscribe(); };
  }, [user, fetchToday]);

  const upsertSleep = useCallback(async (hours: number) => {
    if (!user) return;
    const clamped = Math.max(0, Math.min(24, hours));
    const currentDate = getToday(); // FIX: always use current date at call time
    setState(s => ({ ...s, hours: clamped })); // optimistic
    await supabase
      .from('sleep_logs')
      .upsert({ user_id: user.id, date: currentDate, hours: clamped }, { onConflict: 'user_id,date' });
  }, [user]);

  return (
    <SleepContext.Provider value={{ ...state, upsertSleep, refresh: fetchToday }}>
      {children}
    </SleepContext.Provider>
  );
};

export const useSleep = (): SleepContextType => {
  const ctx = useContext(SleepContext);
  if (!ctx) throw new Error('useSleep must be used within SleepProvider');
  return ctx;
};
