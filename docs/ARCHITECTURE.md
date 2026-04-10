# EpexFit — Clean Architecture

## Data Flow (Single Source of Truth)

```
User Action
    │
    ▼
Feature Store (src/store/)
    │  upsert → Supabase table
    │  optimistic local state update
    │
    ▼
Supabase Realtime subscription
    │  fires on any change to the table
    │
    ▼
All screens re-render with consistent data
```

---

## Feature Stores

| Feature  | Store file            | Supabase table | Hook           |
|----------|-----------------------|----------------|----------------|
| Water    | store/waterStore.tsx  | water_logs     | useWater()     |
| Sleep    | store/sleepStore.tsx  | sleep_logs     | useSleep()     |
| Mood     | store/moodStore.tsx   | mood_logs      | useMood()      |
| Activity | store/activityStore.tsx | daily_logs   | useActivityStore() |

### Rules
1. **Never** write water/sleep/mood to `daily_logs` — those columns are deprecated
2. **Never** read water/sleep/mood from `daily_logs` — always use the store hooks
3. After a workout completes, `TrackingContext.syncGoalsAndDailyLog()` additively
   merges steps/distance/calories into `daily_logs` via upsert
4. `ActivityStoreProvider` realtime subscription picks up that upsert automatically

---

## Table Ownership

| Table        | Owns                                    | Written by                    |
|--------------|-----------------------------------------|-------------------------------|
| water_logs   | glasses per day                         | waterStore only               |
| sleep_logs   | hours per day                           | sleepStore only               |
| mood_logs    | rating per day                          | moodStore only                |
| daily_logs   | steps, distance, calories, protein, fiber, notes | activityStore + TrackingContext + DailyLogScreen (nutrition only) |
| activities   | individual workout records              | TrackingContext.stopTracking() |
| workouts     | planned/logged workouts                 | WorkoutsListScreen            |

---

## Provider Tree (App.tsx)

```
AuthProvider
  └─ NotificationProvider
       └─ TrackingProvider
            └─ ActivityStoreProvider   ← daily_logs (steps/dist/cal)
                 └─ WaterProvider      ← water_logs
                      └─ SleepProvider ← sleep_logs
                           └─ MoodProvider ← mood_logs
                                └─ NavigationContainer
```

---

## Setup

### 1. Run the migration
```sql
-- In Supabase SQL Editor:
-- supabase/migrations/20240102000000_feature_store_tables.sql
```

### 2. Enable Realtime
In Supabase Dashboard → Database → Replication, add:
- `water_logs`
- `sleep_logs`
- `mood_logs`
- `daily_logs`

### 3. No code changes needed in screens
All screens that call `useWater()`, `useSleep()`, `useMood()`, or `useActivityStore()`
will automatically receive live updates when any other screen writes data.

---

## Adding a New Feature

1. Create `src/store/myFeatureStore.tsx` following the same pattern
2. Add `MyFeatureProvider` to the provider tree in `App.tsx`
3. Create the Supabase table with `UNIQUE (user_id, date)`
4. Enable realtime for the table
5. Use `useMyFeature()` in any screen — data is always consistent
