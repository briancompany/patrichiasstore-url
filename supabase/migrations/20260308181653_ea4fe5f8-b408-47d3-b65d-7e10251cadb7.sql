-- 1. Drop the overly permissive order_tracking SELECT policy
DROP POLICY IF EXISTS "Anyone can view order tracking by code" ON public.order_tracking;

-- 2. Replace with admin-only SELECT on order_tracking
-- Public tracking uses get_order_tracking_public RPC (SECURITY DEFINER) so no direct access needed
CREATE POLICY "Admins can view order tracking"
  ON public.order_tracking FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 3. Drop chained policies that exposed all orders and order_items via tracking
DROP POLICY IF EXISTS "Anyone can view orders via tracking" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view order items via tracking" ON public.order_items;