
-- Warm-up logs table
CREATE TABLE public.warmup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled', 'auto')),
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  faults jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  duration_ms integer
);

ALTER TABLE public.warmup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view warmup logs" ON public.warmup_logs
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Service role can insert warmup logs" ON public.warmup_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update warmup logs" ON public.warmup_logs
  FOR UPDATE USING (true);

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
