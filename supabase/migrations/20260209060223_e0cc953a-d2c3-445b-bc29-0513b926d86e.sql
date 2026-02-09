-- Ensure public checkout can always create orders/items/tracking/payments (for both preview + published environments)

-- Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can place orders" ON public.orders;
CREATE POLICY "Anyone can place orders"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Order items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
CREATE POLICY "Anyone can add order items"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Order tracking
ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert order tracking" ON public.order_tracking;
CREATE POLICY "Anyone can insert order tracking"
ON public.order_tracking
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Payments (receipt generation depends on this)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;
CREATE POLICY "Anyone can insert payments"
ON public.payments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
