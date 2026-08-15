CREATE TABLE public.battle_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  client_session_id TEXT,
  encounter_id TEXT,
  encounter_name TEXT,
  is_boss_strike BOOLEAN NOT NULL DEFAULT false,
  bs_points INTEGER,
  outcome TEXT,
  total_turns INTEGER NOT NULL DEFAULT 0,
  player_units_total INTEGER NOT NULL DEFAULT 0,
  enemy_units_total INTEGER NOT NULL DEFAULT 0,
  player_units_damaged INTEGER NOT NULL DEFAULT 0,
  enemy_units_damaged INTEGER NOT NULL DEFAULT 0,
  player_units_killed INTEGER NOT NULL DEFAULT 0,
  enemy_units_killed INTEGER NOT NULL DEFAULT 0,
  player_formation JSONB NOT NULL DEFAULT '[]'::jsonb,
  enemy_formation JSONB NOT NULL DEFAULT '[]'::jsonb,
  app_version TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.battle_turn_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.battle_sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  wave_number INTEGER NOT NULL DEFAULT 1,
  is_player_turn BOOLEAN NOT NULL DEFAULT true,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_battle_turn_events_session ON public.battle_turn_events(session_id, turn_number);
CREATE INDEX idx_battle_sessions_created_at ON public.battle_sessions(created_at DESC);

GRANT INSERT, UPDATE ON public.battle_sessions TO anon, authenticated;
GRANT INSERT ON public.battle_turn_events TO anon, authenticated;
GRANT ALL ON public.battle_sessions TO service_role;
GRANT ALL ON public.battle_turn_events TO service_role;

ALTER TABLE public.battle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_turn_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a battle"
  ON public.battle_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can close an open battle"
  ON public.battle_sessions FOR UPDATE TO anon, authenticated
  USING (ended_at IS NULL) WITH CHECK (true);

CREATE POLICY "Anyone can record a battle turn"
  ON public.battle_turn_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE TRIGGER update_battle_sessions_updated_at
  BEFORE UPDATE ON public.battle_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();