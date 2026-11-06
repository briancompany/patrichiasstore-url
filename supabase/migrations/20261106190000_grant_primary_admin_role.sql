-- Grant the administrator role only to the verified primary admin account.
-- This migration intentionally fails if the Supabase Auth account does not exist,
-- rather than silently leaving the admin dashboard inaccessible.
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id
    INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('brianmuia777@gmail.com')
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Primary admin account brianmuia777@gmail.com was not found in auth.users';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  SELECT
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', email),
    'admin'::public.user_role
  FROM auth.users
  WHERE id = target_user_id
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = 'admin'::public.user_role,
        updated_at = now();
END
$$;
