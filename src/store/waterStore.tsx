/**
 * waterStore — Single source of truth for daily water intake.
 *
 * Table:  water_logs  (user_id, date, glasses)
 * Unique: (user_id, date)
 *
 * Flow: upsertWater() → Supabase upsert → optimistic local state → realtime
 *       subscription keeps all screens in sync automatically.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import dayjs from '../utils/dayjs';

interface WaterState {
  glasses: number;
  goal: number;
  date: string;
  loading: boolean;
}

interface WaterContextType extends WaterState {
  upsertWater: (glasses: number) => Promise<void>;
  addGlass: () => Promise<void>;
  removeGlass: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_GOAL = 8;
const WaterContext = createContext<WaterContextType | undefined>(undefined);

export const WaterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // FIX: compute today dynamically so midnight rollover works correctly
  const getToday = () => dayjs().format('YYYY-MM-DD');
  const today = getToday();
  const [state, setState] = useState<WaterState>({ glasses: 0, goal: DEFAULT_GOAL, date: today, loading: true });
  const realtimeSub = useRef<any>(null);

  const fetchToday = useCallback(async () => {
    if (!user) return;
    setState(s => ({ ...s, loading: true }));
    const { data } = await supabase
      .from('water_logs')
      .select('glasses')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    setState(s => ({ ...s, glasses: data?.glasses ?? 0, loading: false }));
  }, [user, today]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  useEffect(() => {
    if (!user) return;
    realtimeSub.current = supabase
      .channel(`water_${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'water_logs',
        filter: `user_id=eq.${user.id}`,
      }, fetchToday)
      .subscribe();
    return () => { realtimeSub.current?.unsubscribe(); };
  }, [user, fetchToday]);

  const upsertWater = useCallback(async (glasses: number) => {
    if (!user) return;
    const clamped = Math.max(0, glasses);
    const currentDate = getToday(); // FIX: always use current date at call time
    setState(s => ({ ...s, glasses: clamped })); // optimistic
    await supabase
      .from('water_logs')
      .upsert({ user_id: user.id, date: currentDate, glasses: clamped }, { onConflict: 'user_id,date' });
  }, [user]);

  const addGlass = useCallback(() => upsertWater(state.glasses + 1), [upsertWater, state.glasses]);
  const removeGlass = useCallback(() => upsertWater(Math.max(0, state.glasses - 1)), [upsertWater, state.glasses]);

  return (
    <WaterContext.Provider value={{ ...state, upsertWater, addGlass, removeGlass, refresh: fetchToday }}>
      {children}
    </WaterContext.Provider>
  );
};

export const useWater = (): WaterContextType => {
  const ctx = useContext(WaterContext);
  if (!ctx) throw new Error('useWater must be used within WaterProvider');
  return ctx;
};
