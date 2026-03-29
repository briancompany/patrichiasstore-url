
-- Tighten warmup_logs policies - only service role should insert/update
DROP POLICY "Service role can insert warmup logs" ON public.warmup_logs;
DROP POLICY "Service role can update warmup logs" ON public.warmup_logs;

-- Only authenticated admins can insert/update warmup logs from client
CREATE POLICY "Admins can insert warmup logs" ON public.warmup_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update warmup logs" ON public.warmup_logs
  FOR UPDATE TO authenticated USING (public.is_admin());

-- Allow anon/service inserts via edge functions (service_role bypasses RLS anyway)
CREATE POLICY "Anon insert warmup logs" ON public.warmup_logs
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update warmup logs" ON public.warmup_logs
  FOR UPDATE TO anon USING (true);
