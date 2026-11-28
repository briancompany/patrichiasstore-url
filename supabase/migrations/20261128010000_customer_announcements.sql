CREATE TABLE IF NOT EXISTS public.store_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  announcement_type text NOT NULL DEFAULT 'info'
    CHECK (announcement_type IN ('maintenance', 'completed', 'info')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT store_announcements_valid_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS store_announcements_active_window_idx
  ON public.store_announcements (is_active, starts_at, ends_at);

ALTER TABLE public.store_announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.store_announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.store_announcements TO authenticated;

DROP POLICY IF EXISTS "Customers can read active announcements" ON public.store_announcements;
CREATE POLICY "Customers can read active announcements"
  ON public.store_announcements FOR SELECT TO anon, authenticated
  USING (is_active = true AND starts_at <= now() AND ends_at > now());

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.store_announcements;
CREATE POLICY "Admins can manage announcements"
  ON public.store_announcements FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_store_announcements_updated_at ON public.store_announcements;
CREATE TRIGGER trg_store_announcements_updated_at
  BEFORE UPDATE ON public.store_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
