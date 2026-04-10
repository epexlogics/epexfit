-- ============================================================
-- EpexFit: Complete Schema — Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ blocks)
-- ============================================================

-- ── 1. profiles: add missing columns ─────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS username            text,
  ADD COLUMN IF NOT EXISTS bio                 text,
  ADD COLUMN IF NOT EXISTS location            text,
  ADD COLUMN IF NOT EXISTS website             text,
  ADD COLUMN IF NOT EXISTS is_private          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url          text,
  ADD COLUMN IF NOT EXISTS full_name           text,
  ADD COLUMN IF NOT EXISTS height              numeric,
  ADD COLUMN IF NOT EXISTS weight              numeric,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now();

-- ── 2. body_stats ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.body_stats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  weight     numeric,
  height     numeric,
  bmi        numeric GENERATED ALWAYS AS (
               CASE WHEN height > 0 AND weight > 0
               THEN round((weight / ((height/100)*(height/100)))::numeric, 1)
               ELSE NULL END
             ) STORED,
  body_fat   numeric,
  chest      numeric,
  waist      numeric,
  arms       numeric,
  legs       numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.body_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_stats_all" ON public.body_stats;
CREATE POLICY "body_stats_all" ON public.body_stats
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 3. athlete_stats ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.athlete_stats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  level            integer NOT NULL DEFAULT 1,
  exp              integer NOT NULL DEFAULT 0,
  total_workouts   integer NOT NULL DEFAULT 0,
  total_minutes    integer NOT NULL DEFAULT 0,
  total_calories   integer NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_stats_all" ON public.athlete_stats;
CREATE POLICY "athlete_stats_all" ON public.athlete_stats
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 4. user_badges ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_badges_select" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_insert" ON public.user_badges;
CREATE POLICY "user_badges_select" ON public.user_badges
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "user_badges_insert" ON public.user_badges
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 5. challenges ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  target      integer NOT NULL DEFAULT 1,
  target_unit text NOT NULL DEFAULT 'steps',
  reward      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_select" ON public.challenges;
CREATE POLICY "challenges_select" ON public.challenges
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed default challenges if empty
INSERT INTO public.challenges (title, target, target_unit, reward)
SELECT * FROM (VALUES
  ('Walk 5,000 steps today',        5000,  'steps', '🏅 Step Starter badge'),
  ('Drink 8 glasses of water',      8,     'glasses','💧 Hydration Hero badge'),
  ('Complete a 20-minute workout',  20,    'minutes','💪 Active badge'),
  ('Log all 3 meals today',         3,     'meals',  '🥗 Nutrition badge'),
  ('Hit 10,000 steps',              10000, 'steps',  '👟 Step Master badge'),
  ('Sleep 7+ hours tonight',        7,     'hours',  '😴 Rest badge')
) AS v(title, target, target_unit, reward)
WHERE NOT EXISTS (SELECT 1 FROM public.challenges LIMIT 1);

-- ── 6. user_challenges ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  progress     integer NOT NULL DEFAULT 0,
  completed    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_challenges_all" ON public.user_challenges;
CREATE POLICY "user_challenges_all" ON public.user_challenges
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 7. notification_settings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled          boolean NOT NULL DEFAULT true,
  email_enabled         boolean NOT NULL DEFAULT false,
  like_notifications    boolean NOT NULL DEFAULT true,
  comment_notifications boolean NOT NULL DEFAULT true,
  follow_notifications  boolean NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_settings_all" ON public.notification_settings;
CREATE POLICY "notification_settings_all" ON public.notification_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 8. direct_messages ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message      text NOT NULL CHECK (char_length(message) > 0),
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dm_sender_idx    ON public.direct_messages (sender_id);
CREATE INDEX IF NOT EXISTS dm_recipient_idx ON public.direct_messages (recipient_id);
CREATE INDEX IF NOT EXISTS dm_created_idx   ON public.direct_messages (created_at DESC);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_select" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_insert" ON public.direct_messages;
CREATE POLICY "dm_select" ON public.direct_messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "dm_insert" ON public.direct_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- ── 9. blocked_users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_users_all" ON public.blocked_users;
CREATE POLICY "blocked_users_all" ON public.blocked_users
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 10. reports ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id   uuid NOT NULL,
  target_type text NOT NULL,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- ── 11. deleted_accounts (audit log) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deleted_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  reason     text
);

ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deleted_accounts_insert" ON public.deleted_accounts;
CREATE POLICY "deleted_accounts_insert" ON public.deleted_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 12. user_achievements ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  earned_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_type)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_achievements_select" ON public.user_achievements;
DROP POLICY IF EXISTS "user_achievements_insert" ON public.user_achievements;
CREATE POLICY "user_achievements_select" ON public.user_achievements
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "user_achievements_insert" ON public.user_achievements
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 13. Realtime: enable for all tables ───────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'water_logs','sleep_logs','mood_logs','daily_logs',
    'activity_feed','feed_likes','feed_comments','follows',
    'direct_messages','user_badges','user_challenges'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || t;
    END IF;
  END LOOP;
END $$;

-- ── 14. Storage buckets ───────────────────────────────────────────────────
-- Run these manually in Supabase Dashboard → Storage if buckets don't exist:
-- 1. Create bucket: "avatars"        → Public: true
-- 2. Create bucket: "activity-photos" → Public: true
--
-- Or via SQL (requires pg_storage extension):
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-photos', 'activity-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated users to upload to avatars bucket
DROP POLICY IF EXISTS "avatars_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_select" ON storage.objects;

CREATE POLICY "avatars_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.role() = 'authenticated'
  );

CREATE POLICY "avatars_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "activity_photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'activity-photos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "activity_photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'activity-photos');

-- ── 15. Auto-create profile on signup (idempotent) ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, is_private, onboarding_complete)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 16. Backfill profiles for existing users ──────────────────────────────
INSERT INTO public.profiles (id, full_name, is_private, onboarding_complete)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  false,
  false
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
