
-- Enable citext for case-insensitive emails
CREATE EXTENSION IF NOT EXISTS citext;

-- Staff users table
CREATE TABLE IF NOT EXISTS public.staff_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email CITEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'quotation_staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_users_email ON public.staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_users_phone ON public.staff_users(phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_users TO authenticated;
GRANT ALL ON public.staff_users TO service_role;

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage staff
CREATE POLICY "Admins manage staff"
ON public.staff_users
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Each staff can read their own row
CREATE POLICY "Staff can view own row"
ON public.staff_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Helper: check whether a user is an active staff member with a role
CREATE OR REPLACE FUNCTION public.has_staff_role(_uid UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE user_id = _uid
      AND role = _role
      AND is_active = true
  )
$$;

REVOKE ALL ON FUNCTION public.has_staff_role(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.has_staff_role(UUID, TEXT) TO authenticated, service_role;

-- Updated_at trigger
CREATE TRIGGER trg_staff_users_updated_at
BEFORE UPDATE ON public.staff_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
