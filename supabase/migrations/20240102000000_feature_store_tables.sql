-- ============================================================
-- EpexFit: Feature Store Tables Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── water_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.water_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  glasses    integer NOT NULL DEFAULT 0 CHECK (glasses >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "water_logs: user owns rows"
  ON public.water_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── sleep_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  hours      numeric(4,1) NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 24),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sleep_logs: user owns rows"
  ON public.sleep_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── mood_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  rating     smallint NOT NULL DEFAULT 3 CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mood_logs: user owns rows"
  ON public.mood_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── daily_logs: ensure unique constraint exists ───────────────────────────
-- daily_logs stores steps, distance, calories, protein, fiber, notes
-- water/sleep/mood are now in their own tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_logs_user_id_date_key'
  ) THEN
    ALTER TABLE public.daily_logs ADD CONSTRAINT daily_logs_user_id_date_key UNIQUE (user_id, date);
  END IF;
END $$;

-- ── Realtime: enable for all feature tables ───────────────────────────────
-- Run these in Supabase Dashboard → Database → Replication
-- or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE public.water_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sleep_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mood_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_logs;

-- ── updated_at triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER water_logs_updated_at  BEFORE UPDATE ON public.water_logs  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sleep_logs_updated_at  BEFORE UPDATE ON public.sleep_logs  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER mood_logs_updated_at   BEFORE UPDATE ON public.mood_logs   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
