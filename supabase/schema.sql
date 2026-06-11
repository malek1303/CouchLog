-- ============================================================
-- CouchLog Database Schema
-- Apply this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. MEDIA (TMDB local cache) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id     INTEGER NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title       TEXT NOT NULL,
  poster_path TEXT,
  overview    TEXT,
  status      TEXT,
  vote_average REAL DEFAULT 0,
  number_of_seasons INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tmdb_id, media_type)
);

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read media
CREATE POLICY "media_read_authenticated"
  ON public.media FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update media (done server-side)
CREATE POLICY "media_insert_service"
  ON public.media FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "media_update_service"
  ON public.media FOR UPDATE
  TO service_role
  USING (true);

-- ── 2. WATCHLIST ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watchlist (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  media_id         UUID NOT NULL REFERENCES public.media ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'to_watch'
                   CHECK (status IN ('to_watch', 'watching', 'completed', 'dropped')),
  current_season   INTEGER NOT NULL DEFAULT 1,
  current_episode  INTEGER NOT NULL DEFAULT 1,
  last_timestamp   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, media_id)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_user_all"
  ON public.watchlist FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_media_id ON public.watchlist (media_id);

-- ── 3. EPISODE_PROGRESS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.episode_progress (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  media_id             UUID NOT NULL REFERENCES public.media ON DELETE CASCADE,
  season_number        INTEGER NOT NULL,
  episode_number       INTEGER NOT NULL,
  watched              BOOLEAN NOT NULL DEFAULT FALSE,
  stopped_at_timestamp TEXT,
  watched_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, media_id, season_number, episode_number)
);

ALTER TABLE public.episode_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "episode_progress_user_all"
  ON public.episode_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ep_progress_user ON public.episode_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_ep_progress_media ON public.episode_progress (media_id);
CREATE INDEX IF NOT EXISTS idx_ep_progress_stopped ON public.episode_progress (user_id, stopped_at_timestamp)
  WHERE stopped_at_timestamp IS NOT NULL AND watched = FALSE;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER episode_progress_updated_at
  BEFORE UPDATE ON public.episode_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. MOVIE_PROGRESS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movie_progress (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  media_id             UUID NOT NULL REFERENCES public.media ON DELETE CASCADE,
  watched              BOOLEAN NOT NULL DEFAULT FALSE,
  stopped_at_timestamp TEXT,
  watched_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, media_id)
);

ALTER TABLE public.movie_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movie_progress_user_all"
  ON public.movie_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_movie_progress_user ON public.movie_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_movie_progress_stopped ON public.movie_progress (user_id, stopped_at_timestamp)
  WHERE stopped_at_timestamp IS NOT NULL AND watched = FALSE;

CREATE TRIGGER movie_progress_updated_at
  BEFORE UPDATE ON public.movie_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  media_id   UUID NOT NULL REFERENCES public.media ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'new_episode',
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_user_all"
  ON public.notifications FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert notifications (cron route uses service key)
CREATE POLICY "notifications_insert_service"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read)
  WHERE read = FALSE;

-- ── 6. HELPER FUNCTIONS ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to access auth schema
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = LOWER(TRIM(p_email))
  );
END;
$$;

-- Restrict execution to service_role only (called via API route using service client)
REVOKE ALL ON FUNCTION public.check_email_exists(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO service_role;

