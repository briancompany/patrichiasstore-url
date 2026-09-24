CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_hash text NOT NULL,
  phone_hash text,
  language text,
  resolved boolean NOT NULL DEFAULT false,
  lead_captured boolean NOT NULL DEFAULT false,
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.chat_sessions (device_hash, updated_at DESC);
GRANT SELECT ON public.chat_sessions TO authenticated;
GRANT ALL ON public.chat_sessions TO service_role;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read chat sessions" ON public.chat_sessions FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.chat_messages (session_id, created_at);
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read chat messages" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash text NOT NULL,
  device_hash text NOT NULL,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_hash, device_hash)
);
GRANT SELECT ON public.ai_memory TO authenticated;
GRANT ALL ON public.ai_memory TO service_role;
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ai memory" ON public.ai_memory FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.chat_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  name text,
  phone text,
  school text,
  interest text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.chat_leads TO authenticated;
GRANT ALL ON public.chat_leads TO service_role;
ALTER TABLE public.chat_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read leads" ON public.chat_leads FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete leads" ON public.chat_leads FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  phone_hash text,
  query_preview text,
  response_ms integer,
  tools_used text[] NOT NULL DEFAULT '{}',
  schools_queried text[] NOT NULL DEFAULT '{}',
  failed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.chat_logs (created_at DESC);
GRANT SELECT ON public.chat_logs TO authenticated;
GRANT ALL ON public.chat_logs TO service_role;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read chat logs" ON public.chat_logs FOR SELECT TO authenticated USING (public.is_admin());