
-- Fix: Convert all public-facing INSERT policies from RESTRICTIVE to PERMISSIVE
-- The current RESTRICTIVE policies deny all access because no PERMISSIVE policy exists.

-- ==================== ORDERS ====================
DROP POLICY IF EXISTS "Anyone can place orders" ON public.orders;
CREATE POLICY "Anyone can place orders" ON public.orders
  FOR INSERT
  WITH CHECK (
    customer_name IS NOT NULL
    AND length(trim(customer_name)) > 0
    AND customer_phone IS NOT NULL
    AND length(trim(customer_phone)) >= 9
    AND total_amount IS NOT NULL
    AND total_amount > 0
  );

-- Also need a permissive SELECT for admins (required base)
DROP POLICY IF EXISTS "Admins can view orders" ON public.orders;
CREATE POLICY "Admins can view orders" ON public.orders
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view orders via tracking" ON public.orders;
CREATE POLICY "Anyone can view orders via tracking" ON public.orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM order_tracking ot WHERE ot.order_id = orders.id)
  );

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE USING (is_admin());

-- ==================== ORDER_ITEMS ====================
DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
CREATE POLICY "Anyone can add order items" ON public.order_items
  FOR INSERT
  WITH CHECK (
    order_id IS NOT NULL
    AND product_name IS NOT NULL
    AND length(trim(product_name)) > 0
    AND size IS NOT NULL
    AND length(trim(size)) > 0
    AND quantity IS NOT NULL
    AND quantity > 0
    AND price_at_purchase IS NOT NULL
    AND price_at_purchase >= 0
  );

DROP POLICY IF EXISTS "Admins can view order items" ON public.order_items;
CREATE POLICY "Admins can view order items" ON public.order_items
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view order items via tracking" ON public.order_items;
CREATE POLICY "Anyone can view order items via tracking" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM order_tracking ot WHERE ot.order_id = order_items.order_id)
  );

DROP POLICY IF EXISTS "Admins can update order items" ON public.order_items;
CREATE POLICY "Admins can update order items" ON public.order_items
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
CREATE POLICY "Admins can delete order items" ON public.order_items
  FOR DELETE USING (is_admin());

-- ==================== ORDER_TRACKING ====================
DROP POLICY IF EXISTS "Anyone can insert order tracking" ON public.order_tracking;
CREATE POLICY "Anyone can insert order tracking" ON public.order_tracking
  FOR INSERT
  WITH CHECK (
    order_id IS NOT NULL
    AND tracking_code IS NOT NULL
    AND tracking_code ~ '^PS-[A-Z0-9]{6}$'
  );

DROP POLICY IF EXISTS "Anyone can view order tracking by code" ON public.order_tracking;
CREATE POLICY "Anyone can view order tracking by code" ON public.order_tracking
  FOR SELECT USING (true);

-- ==================== PAYMENTS ====================
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;
CREATE POLICY "Anyone can insert payments" ON public.payments
  FOR INSERT
  WITH CHECK (
    order_id IS NOT NULL
    AND amount IS NOT NULL
    AND amount > 0
    AND mpesa_code IS NOT NULL
    AND length(trim(mpesa_code)) >= 8
    AND length(trim(mpesa_code)) <= 12
    AND customer_name IS NOT NULL
    AND length(trim(customer_name)) > 0
  );

DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;
CREATE POLICY "Admins can delete payments" ON public.payments
  FOR DELETE USING (is_admin());

-- ==================== OTHER TABLES (fix restrictive → permissive) ====================
DROP POLICY IF EXISTS "Anyone can view schools" ON public.schools;
CREATE POLICY "Anyone can view schools" ON public.schools
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products" ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view pricing chart" ON public.pricing_chart;
CREATE POLICY "Anyone can view pricing chart" ON public.pricing_chart
  FOR SELECT USING (true);
