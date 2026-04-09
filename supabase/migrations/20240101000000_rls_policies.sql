-- ============================================================
-- EpexFit — Row Level Security Policies
-- Run this migration in your Supabase SQL editor or via CLI:
--   supabase db push
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    -- Public profiles visible to all authenticated users
    -- Private profiles only visible to owner or followers
    auth.role() = 'authenticated' AND (
      is_private = false
      OR id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = auth.uid() AND following_id = profiles.id
      )
    )
  );

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── activities ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "activities_select" ON activities;
DROP POLICY IF EXISTS "activities_insert" ON activities;
DROP POLICY IF EXISTS "activities_update" ON activities;
DROP POLICY IF EXISTS "activities_delete" ON activities;

CREATE POLICY "activities_select" ON activities
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "activities_insert" ON activities
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "activities_update" ON activities
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "activities_delete" ON activities
  FOR DELETE USING (user_id = auth.uid());

-- ── daily_logs ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "daily_logs_all" ON daily_logs;

CREATE POLICY "daily_logs_all" ON daily_logs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── goals ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "goals_all" ON goals;

CREATE POLICY "goals_all" ON goals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── workouts ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "workouts_all" ON workouts;

CREATE POLICY "workouts_all" ON workouts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── exercises ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "exercises_all" ON exercises;

CREATE POLICY "exercises_all" ON exercises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM workouts WHERE workouts.id = exercises.workout_id AND workouts.user_id = auth.uid())
  );

-- ── food_logs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "food_logs_all" ON food_logs;

CREATE POLICY "food_logs_all" ON food_logs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── follows ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "follows_select" ON follows;
DROP POLICY IF EXISTS "follows_insert" ON follows;
DROP POLICY IF EXISTS "follows_delete" ON follows;

CREATE POLICY "follows_select" ON follows
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "follows_insert" ON follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());

CREATE POLICY "follows_delete" ON follows
  FOR DELETE USING (follower_id = auth.uid());

-- ── activity_feed ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "feed_select" ON activity_feed;
DROP POLICY IF EXISTS "feed_insert" ON activity_feed;

CREATE POLICY "feed_select" ON activity_feed
  FOR SELECT USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid() AND following_id = activity_feed.actor_id
    )
  );

CREATE POLICY "feed_insert" ON activity_feed
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- ── feed_likes ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "feed_likes_select" ON feed_likes;
DROP POLICY IF EXISTS "feed_likes_insert" ON feed_likes;
DROP POLICY IF EXISTS "feed_likes_delete" ON feed_likes;

CREATE POLICY "feed_likes_select" ON feed_likes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "feed_likes_insert" ON feed_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_likes_delete" ON feed_likes
  FOR DELETE USING (user_id = auth.uid());

-- ── feed_comments ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "feed_comments_select" ON feed_comments;
DROP POLICY IF EXISTS "feed_comments_insert" ON feed_comments;
DROP POLICY IF EXISTS "feed_comments_delete" ON feed_comments;

CREATE POLICY "feed_comments_select" ON feed_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "feed_comments_insert" ON feed_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_comments_delete" ON feed_comments
  FOR DELETE USING (user_id = auth.uid());

-- ── direct_messages ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dm_select" ON direct_messages;
DROP POLICY IF EXISTS "dm_insert" ON direct_messages;

CREATE POLICY "dm_select" ON direct_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

CREATE POLICY "dm_insert" ON direct_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- ── body_measurements ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "body_measurements_all" ON body_measurements;

CREATE POLICY "body_measurements_all" ON body_measurements
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── notification_settings ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "notification_settings_all" ON notification_settings;

CREATE POLICY "notification_settings_all" ON notification_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── user_achievements ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_achievements_select" ON user_achievements;
DROP POLICY IF EXISTS "user_achievements_insert" ON user_achievements;

CREATE POLICY "user_achievements_select" ON user_achievements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "user_achievements_insert" ON user_achievements
  FOR INSERT WITH CHECK (user_id = auth.uid());
