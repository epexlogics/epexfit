import dayjs from '../utils/dayjs';
import { supabase } from './supabase';
import { Activity, DailyLog, Goal, Reminder, Workout } from '../types';
import { withCache, invalidateCache, invalidateCachePrefix, TTL } from './offlineCache';
import { socialService } from './socialService';

function mapActivity(item: Record<string, any>): Activity {
  return {
    id: item.id,
    userId: item.user_id,
    type: item.type,
    steps: item.steps ?? 0,
    distance: item.distance ?? 0,
    calories: item.calories ?? 0,
    duration: item.duration ?? 0,
    startTime: new Date(item.start_time),
    endTime: new Date(item.end_time),
    route: item.route,
    photoUrl: item.photo_url,
    photoOverlayUrl: item.photo_overlay_url,
    notes: item.notes,
    createdAt: new Date(item.created_at),
  };
}

function mapDailyLog(item: Record<string, any>): DailyLog {
  return {
    id: item.id,
    userId: item.user_id,
    date: item.date,
    steps: item.steps ?? 0,
    distance: item.distance ?? 0,
    calories: item.calories ?? 0,
    water: item.water ?? 0,
    protein: item.protein ?? 0,
    fiber: item.fiber ?? 0,
    sleep: item.sleep ?? 0,
    mood: item.mood ?? 3,
    notes: item.notes,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  };
}

function mapGoal(item: Record<string, any>): Goal {
  return {
    id: item.id,
    userId: item.user_id,
    type: item.type,
    target: item.target,
    current: item.current,
    unit: item.unit,
    startDate: new Date(item.start_date),
    deadline: new Date(item.deadline),
    completed: item.completed,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  };
}

async function getAuthUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export class DatabaseService {
  // ─── Activities ───────────────────────────────────────────────────────────

  async saveActivity(
    activity: Omit<Activity, 'id' | 'createdAt'>
  ): Promise<{ data: any; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('activities')
        .insert({
          user_id: authUser.id,
          type: activity.type,
          steps: activity.steps,
          distance: activity.distance,
          calories: activity.calories,
          duration: activity.duration,
          start_time: activity.startTime.toISOString(),
          end_time: activity.endTime.toISOString(),
          route: activity.route ?? null,
          photo_url: activity.photoUrl ?? null,
          photo_overlay_url: activity.photoOverlayUrl ?? null,
          notes: activity.notes ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async getActivities(
    _userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ data: Activity[]; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { data: [], error: 'Not authenticated' };

      let query = supabase
        .from('activities')
        .select('*')
        .eq('user_id', authUser.id)
        .order('start_time', { ascending: false });

      if (startDate) query = query.gte('start_time', startDate.toISOString());
      if (endDate) query = query.lte('end_time', endDate.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      return { data: (data ?? []).map(mapActivity), error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  async getRecentActivities(
    _userId: string,
    limit = 10
  ): Promise<{ data: Activity[]; error: any }> {
    const authUser = await getAuthUser();
    if (!authUser) return { data: [], error: 'Not authenticated' };
    const result = await withCache<Activity[]>(
      `recent_activities/${authUser.id}/${limit}`,
      TTL.ACTIVITIES,
      async () => {
        const { data, error } = await supabase
          .from('activities').select('*')
          .eq('user_id', authUser.id)
          .order('start_time', { ascending: false }).limit(limit);
        if (error) return { data: [], error };
        return { data: (data ?? []).map(mapActivity), error: null };
      },
      []
    );
    return { data: result.data, error: result.error ?? null };
  }

  async updateActivityPhotos(
    activityId: string,
    updates: { photoUrl?: string; photoOverlayUrl?: string }
  ): Promise<{ success: boolean; error: any }> {
    try {
      const payload: Record<string, string> = {};
      if (updates.photoUrl) payload.photo_url = updates.photoUrl;
      if (updates.photoOverlayUrl) payload.photo_overlay_url = updates.photoOverlayUrl;

      const { error } = await supabase.from('activities').update(payload).eq('id', activityId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  // ─── Goals ────────────────────────────────────────────────────────────────

  async saveGoal(
    goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ data: any; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: authUser.id,
          type: goal.type,
          target: goal.target,
          current: goal.current,
          unit: goal.unit,
          start_date: goal.startDate.toISOString().split('T')[0],
          deadline: goal.deadline.toISOString().split('T')[0],
          completed: goal.completed,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async getGoals(_userId: string): Promise<{ data: Goal[]; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { data: [], error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', authUser.id)
        .order('deadline', { ascending: true });

      if (error) throw error;
      return { data: (data ?? []).map(mapGoal), error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  // ✅ NEW: Update entire goal (target, current, completed)
  async updateGoal(
    goalId: string,
    updates: { target?: number; current?: number; completed?: boolean }
  ): Promise<{ success: boolean; error: any }> {
    try {
      const payload: Record<string, any> = {};
      if (updates.target !== undefined) payload.target = updates.target;
      if (updates.current !== undefined) payload.current = updates.current;
      if (updates.completed !== undefined) payload.completed = updates.completed;

      const { error } = await supabase
        .from('goals')
        .update(payload)
        .eq('id', goalId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  async updateGoalProgress(
    goalId: string,
    current: number
  ): Promise<{ success: boolean; error: any }> {
    try {
      const target = await this.getGoalTarget(goalId);
      const completed = current >= target;
      
      const { error } = await supabase
        .from('goals')
        .update({ current, completed })
        .eq('id', goalId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  async deleteGoal(goalId: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase.from('goals').delete().eq('id', goalId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  private async getGoalTarget(goalId: string): Promise<number> {
    const { data } = await supabase
      .from('goals')
      .select('target')
      .eq('id', goalId)
      .single();
    return data?.target ?? 0;
  }

  // ─── Daily Logs ───────────────────────────────────────────────────────────

  async saveDailyLog(
    log: Omit<DailyLog, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ data: any; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('daily_logs')
        .upsert({
          user_id: authUser.id,
          date: log.date,
          steps: log.steps,
          distance: log.distance,
          calories: log.calories,
          water: log.water,
          protein: log.protein,
          fiber: log.fiber,
          sleep: log.sleep,
          mood: log.mood,
          notes: log.notes ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async getDailyLog(
    _userId: string,
    date: Date
  ): Promise<{ data: DailyLog | null; error: any }> {
    const authUser = await getAuthUser();
    if (!authUser) return { data: null, error: 'Not authenticated' };
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const result = await withCache<DailyLog | null>(
      `daily_log/${authUser.id}/${dateStr}`,
      TTL.DAILY_LOG,
      async () => {
        const { data, error } = await supabase
          .from('daily_logs').select('*')
          .eq('user_id', authUser.id).eq('date', dateStr).single();
        if (error && error.code !== 'PGRST116') return { data: null, error };
        return { data: data ? mapDailyLog(data) : null, error: null };
      },
      null
    );
    return { data: result.data, error: result.error ?? null };
  }

  async getWeeklyLogs(
    _userId: string,
    startDate: Date
  ): Promise<{ data: DailyLog[]; error: any }> {
    const authUser = await getAuthUser();
    if (!authUser) return { data: [], error: 'Not authenticated' };
    const startStr = dayjs(startDate).format('YYYY-MM-DD');
    const endStr = dayjs(startDate).add(7, 'days').format('YYYY-MM-DD');
    const result = await withCache<DailyLog[]>(
      `weekly_logs/${authUser.id}/${startStr}`,
      TTL.WEEKLY_LOGS,
      async () => {
        const { data, error } = await supabase
          .from('daily_logs').select('*')
          .eq('user_id', authUser.id)
          .gte('date', startStr).lte('date', endStr)
          .order('date', { ascending: true });
        if (error) return { data: [], error };
        return { data: (data ?? []).map(mapDailyLog), error: null };
      },
      []
    );
    return { data: result.data, error: result.error ?? null };
  }

  // ─── Reminders ────────────────────────────────────────────────────────────

  async saveReminder(
    reminder: Omit<Reminder, 'id' | 'createdAt'>
  ): Promise<{ data: any; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('reminders')
        .insert({
          user_id: authUser.id,
          type: reminder.type,
          title: reminder.title,
          message: reminder.message,
          time: reminder.time,
          enabled: reminder.enabled,
          days: reminder.days,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async getReminders(_userId: string): Promise<{ data: Reminder[]; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { data: [], error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', authUser.id)
        .order('time', { ascending: true });

      if (error) throw error;

      const reminders: Reminder[] = (data ?? []).map((item) => ({
        id: item.id,
        userId: item.user_id,
        type: item.type,
        title: item.title,
        message: item.message,
        time: item.time,
        enabled: item.enabled,
        days: item.days,
        lastTriggered: item.last_triggered ? new Date(item.last_triggered) : undefined,
        createdAt: new Date(item.created_at),
      }));

      return { data: reminders, error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  async updateReminder(
    reminderId: string,
    updates: Partial<Reminder>
  ): Promise<{ success: boolean; error: any }> {
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.message !== undefined) dbUpdates.message = updates.message;
      if (updates.time !== undefined) dbUpdates.time = updates.time;
      if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
      if (updates.days !== undefined) dbUpdates.days = updates.days;

      const { error } = await supabase.from('reminders').update(dbUpdates).eq('id', reminderId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  async deleteReminder(reminderId: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', reminderId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  // ─── Workouts ─────────────────────────────────────────────────────────────

  async saveWorkout(
    workout: Omit<Workout, 'id' | 'createdAt'>
  ): Promise<{ data: any; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: authUser.id,
          name: workout.name,
          type: workout.type,
          duration: workout.duration,
          calories: workout.calories,
          scheduled_date:
            workout.scheduledDate instanceof Date
              ? workout.scheduledDate.toISOString()
              : new Date(workout.scheduledDate).toISOString(),
          completed: workout.completed,
          notes: workout.notes ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      if (workout.exercises && workout.exercises.length > 0) {
        const exercisesData = workout.exercises.map((exercise, index) => ({
          workout_id: data.id,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight ?? null,
          duration: exercise.duration ?? null,
          rest: exercise.rest ?? null,
          order_index: index,
        }));

        const { error: exError } = await supabase.from('exercises').insert(exercisesData);
        if (exError) throw exError;
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async getWorkouts(
    _userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ data: Workout[]; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { data: [], error: 'Not authenticated' };

      let query = supabase
        .from('workouts')
        .select('*')
        .eq('user_id', authUser.id)
        .order('scheduled_date', { ascending: false });

      if (startDate) query = query.gte('scheduled_date', startDate.toISOString());
      if (endDate) query = query.lte('scheduled_date', endDate.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      const workoutIds = (data ?? []).map((w) => w.id);
      let allExercises: Record<string, any>[] = [];

      if (workoutIds.length > 0) {
        const { data: exData } = await supabase
          .from('exercises')
          .select('*')
          .in('workout_id', workoutIds)
          .order('order_index', { ascending: true });
        allExercises = exData ?? [];
      }

      const workouts: Workout[] = (data ?? []).map((item) => ({
        id: item.id,
        userId: item.user_id,
        name: item.name,
        type: item.type,
        duration: item.duration,
        calories: item.calories,
        exercises: allExercises
          .filter((ex) => ex.workout_id === item.id)
          .map((ex) => ({
            id: ex.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration,
            rest: ex.rest,
          })),
        scheduledDate: new Date(item.scheduled_date),
        completed: item.completed,
        notes: item.notes,
        createdAt: new Date(item.created_at),
      }));

      return { data: workouts, error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  async completeWorkout(workoutId: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ completed: true })
        .eq('id', workoutId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  async deleteWorkout(workoutId: string): Promise<{ success: boolean; error: any }> {
    try {
      await supabase.from('exercises').delete().eq('workout_id', workoutId);
      const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  }

  // ─── Statistics ───────────────────────────────────────────────────────────

  async getStatistics(
    userId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    totalSteps: number;
    totalDistance: number;
    totalCalories: number;
    totalActivities: number;
    averageSteps: number;
    bestDay: { date: string; steps: number };
  }> {
    try {
      const startDate = dayjs().startOf(period).toDate();
      const { data: activities } = await this.getActivities(userId, startDate);

      const totalSteps = activities.reduce((sum, a) => sum + a.steps, 0);
      const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
      const totalCalories = activities.reduce((sum, a) => sum + a.calories, 0);
      const totalActivities = activities.length;

      const dailySteps: Record<string, number> = {};
      activities.forEach((activity) => {
        const date = dayjs(activity.startTime).format('YYYY-MM-DD');
        dailySteps[date] = (dailySteps[date] ?? 0) + activity.steps;
      });

      let bestDay = { date: '', steps: 0 };
      Object.entries(dailySteps).forEach(([date, steps]) => {
        if (steps > bestDay.steps) bestDay = { date, steps };
      });

      return {
        totalSteps,
        totalDistance,
        totalCalories,
        totalActivities,
        averageSteps: totalActivities > 0 ? Math.floor(totalSteps / totalActivities) : 0,
        bestDay,
      };
    } catch {
      return {
        totalSteps: 0,
        totalDistance: 0,
        totalCalories: 0,
        totalActivities: 0,
        averageSteps: 0,
        bestDay: { date: '', steps: 0 },
      };
    }
  }


  // ─── Weekly Steps (real data, no fabrication) ─────────────────────────────

  async getWeeklyStepsByDay(
    _userId: string,
    weekStart: Date
  ): Promise<number[]> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return [0, 0, 0, 0, 0, 0, 0];

      const days: string[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      });

      const { data } = await supabase
        .from('daily_logs')
        .select('date, steps')
        .eq('user_id', authUser.id)
        .gte('date', days[0])
        .lte('date', days[6]);

      return days.map((d) => {
        const row = (data ?? []).find((r: any) => r.date === d);
        return row?.steps ?? 0;
      });
    } catch {
      return [0, 0, 0, 0, 0, 0, 0];
    }
  }

  // ─── Goal Progress Sync ───────────────────────────────────────────────────

  async syncGoalProgress(_userId: string): Promise<void> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return;

      const today = new Date().toISOString().split('T')[0];

      // Get week start (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - diffToMonday);
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const [logResult, weekActsResult, goalsResult] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('steps, calories, water, protein')
          .eq('user_id', authUser.id)
          .eq('date', today)
          .single(),
        supabase
          .from('activities')
          .select('type, distance')
          .eq('user_id', authUser.id)
          .gte('start_time', weekStartStr),
        supabase
          .from('goals')
          .select('id, type, target, completed')
          .eq('user_id', authUser.id),
      ]);

      const log = logResult.data;
      const weekActs = weekActsResult.data ?? [];
      const goals = goalsResult.data ?? [];

      const weekRunDist = weekActs
        .filter((a: any) => a.type === 'running')
        .reduce((s: number, a: any) => s + (a.distance ?? 0), 0);

      const updates: Record<string, number> = {
        steps: log?.steps ?? 0,
        calories: log?.calories ?? 0,
        water: log?.water ?? 0,
        protein: log?.protein ?? 0,
        running: weekRunDist,
      };

      for (const goal of goals) {
        const current = updates[goal.type as string];
        if (current !== undefined) {
          const completed = current >= goal.target;
          const wasCompleted = goal.completed;
          await supabase
            .from('goals')
            .update({ current, completed })
            .eq('id', goal.id);
          // Fire feed event the first time a goal is completed
          if (completed && !wasCompleted) {
            socialService.publishFeedEvent('goal_achieved', {
              goalType: goal.type,
              target: goal.target,
              unit: goal.unit,
            });
          }
        }
      }
    } catch {
      // Non-critical — don't crash the app
    }
  }

  // ─── Historical logs (for trend charts) ───────────────────────────────────

  async getLogsInRange(
    _userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ data: DailyLog[]; error: any }> {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { data: [], error: null };

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', authUser.id)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true });

      if (error) throw error;
      return { data: (data ?? []).map(mapDailyLog), error: null };
    } catch (error) {
      return { data: [], error };
    }
  }
}

export const databaseService = new DatabaseService();