-- ============================================================
-- EpexFit: Social System Fix Migration
-- Fixes: follows joins, feed filtering, comments, likes, search
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Ensure profiles table has all required columns ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username       text,
  ADD COLUMN IF NOT EXISTS bio            text,
  ADD COLUMN IF NOT EXISTS location       text,
  ADD COLUMN IF NOT EXISTS website        text,
  ADD COLUMN IF NOT EXISTS is_private     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url     text,
  ADD COLUMN IF NOT EXISTS full_name      text,
  ADD COLUMN IF NOT EXISTS height         numeric,
  ADD COLUMN IF NOT EXISTS weight         numeric;

-- Unique index on username (case-insensitive search)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Index for full-text search on name + username
CREATE INDEX IF NOT EXISTS profiles_fullname_idx  ON public.profiles USING gin(to_tsvector('simple', coalesce(full_name, '')));
CREATE INDEX IF NOT EXISTS profiles_username_idx  ON public.profiles (username);

-- ── 2. Ensure follows table exists with correct structure ─────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;

CREATE POLICY "follows_select" ON public.follows
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());

CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE USING (follower_id = auth.uid());

-- ── 3. Ensure activity_feed table exists ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_feed_actor_idx      ON public.activity_feed (actor_id);
CREATE INDEX IF NOT EXISTS activity_feed_created_at_idx ON public.activity_feed (created_at DESC);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_select" ON public.activity_feed;
DROP POLICY IF EXISTS "feed_insert" ON public.activity_feed;
DROP POLICY IF EXISTS "feed_delete" ON public.activity_feed;

-- Feed: see your own posts + posts from people you follow
CREATE POLICY "feed_select" ON public.activity_feed
  FOR SELECT USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = activity_feed.actor_id
    )
  );

CREATE POLICY "feed_insert" ON public.activity_feed
  FOR INSERT WITH CHECK (actor_id = auth.uid());

CREATE POLICY "feed_delete" ON public.activity_feed
  FOR DELETE USING (actor_id = auth.uid());

-- ── 4. Ensure feed_likes table exists ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_likes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id uuid NOT NULL REFERENCES public.activity_feed(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feed_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS feed_likes_item_idx ON public.feed_likes (feed_item_id);
CREATE INDEX IF NOT EXISTS feed_likes_user_idx ON public.feed_likes (user_id);

ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_likes_select" ON public.feed_likes;
DROP POLICY IF EXISTS "feed_likes_insert" ON public.feed_likes;
DROP POLICY IF EXISTS "feed_likes_delete" ON public.feed_likes;

CREATE POLICY "feed_likes_select" ON public.feed_likes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "feed_likes_insert" ON public.feed_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_likes_delete" ON public.feed_likes
  FOR DELETE USING (user_id = auth.uid());

-- ── 5. Ensure feed_comments table exists ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id uuid NOT NULL REFERENCES public.activity_feed(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feed_comments_item_idx ON public.feed_comments (feed_item_id);
CREATE INDEX IF NOT EXISTS feed_comments_user_idx ON public.feed_comments (user_id);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_comments_select" ON public.feed_comments;
DROP POLICY IF EXISTS "feed_comments_insert" ON public.feed_comments;
DROP POLICY IF EXISTS "feed_comments_delete" ON public.feed_comments;

CREATE POLICY "feed_comments_select" ON public.feed_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "feed_comments_insert" ON public.feed_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_comments_delete" ON public.feed_comments
  FOR DELETE USING (user_id = auth.uid());

-- ── 6. Enable Realtime for social tables ─────────────────────────────────
DO $$
BEGIN
  -- activity_feed
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activity_feed'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
  END IF;

  -- feed_likes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'feed_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_likes;
  END IF;

  -- feed_comments
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'feed_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_comments;
  END IF;

  -- follows
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'follows'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
  END IF;
END $$;

-- ── 7. Auto-create profile row on new user signup ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, is_private)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
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

-- ── 8. Backfill profiles for existing users who have no profile row ───────
INSERT INTO public.profiles (id, full_name, is_private)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  false
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
