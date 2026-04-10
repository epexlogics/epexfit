/**
 * moodStore — Single source of truth for daily mood rating.
 *
 * Table:  mood_logs  (user_id, date, rating)
 * Unique: (user_id, date)
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import dayjs from '../utils/dayjs';

interface MoodState {
  rating: 1 | 2 | 3 | 4 | 5;
  date: string;
  loading: boolean;
}

interface MoodContextType extends MoodState {
  upsertMood: (rating: 1 | 2 | 3 | 4 | 5) => Promise<void>;
  refresh: () => Promise<void>;
}

const MoodContext = createContext<MoodContextType | undefined>(undefined);

export const MoodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // FIX: compute today dynamically so midnight rollover works correctly
  const getToday = () => dayjs().format('YYYY-MM-DD');
  const today = getToday();
  const [state, setState] = useState<MoodState>({ rating: 3, date: today, loading: true });
  const realtimeSub = useRef<any>(null);

  const fetchToday = useCallback(async () => {
    if (!user) return;
    setState(s => ({ ...s, loading: true }));
    const { data } = await supabase
      .from('mood_logs')
      .select('rating')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    setState(s => ({ ...s, rating: (data?.rating as any) ?? 3, loading: false }));
  }, [user, today]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  useEffect(() => {
    if (!user) return;
    realtimeSub.current = supabase
      .channel(`mood_${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'mood_logs',
        filter: `user_id=eq.${user.id}`,
      }, fetchToday)
      .subscribe();
    return () => { realtimeSub.current?.unsubscribe(); };
  }, [user, fetchToday]);

  const upsertMood = useCallback(async (rating: 1 | 2 | 3 | 4 | 5) => {
    if (!user) return;
    const currentDate = getToday(); // FIX: always use current date at call time
    setState(s => ({ ...s, rating })); // optimistic
    await supabase
      .from('mood_logs')
      .upsert({ user_id: user.id, date: currentDate, rating }, { onConflict: 'user_id,date' });
  }, [user]);

  return (
    <MoodContext.Provider value={{ ...state, upsertMood, refresh: fetchToday }}>
      {children}
    </MoodContext.Provider>
  );
};

export const useMood = (): MoodContextType => {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error('useMood must be used within MoodProvider');
  return ctx;
};
