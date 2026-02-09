-- Tighten public INSERT policies to avoid WITH CHECK (true) while keeping public checkout working

-- Orders
DROP POLICY IF EXISTS "Anyone can place orders" ON public.orders;
CREATE POLICY "Anyone can place orders"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  customer_name IS NOT NULL
  AND length(trim(customer_name)) > 0
  AND customer_phone IS NOT NULL
  AND length(trim(customer_phone)) >= 9
  AND total_amount IS NOT NULL
  AND total_amount > 0
);

-- Order items
DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
CREATE POLICY "Anyone can add order items"
ON public.order_items
FOR INSERT
TO anon, authenticated
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

-- Order tracking
DROP POLICY IF EXISTS "Anyone can insert order tracking" ON public.order_tracking;
CREATE POLICY "Anyone can insert order tracking"
ON public.order_tracking
FOR INSERT
TO anon, authenticated
WITH CHECK (
  order_id IS NOT NULL
  AND tracking_code IS NOT NULL
  AND tracking_code ~ '^PS-[A-Z0-9]{6}$'
);

-- Payments
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;
CREATE POLICY "Anyone can insert payments"
ON public.payments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  order_id IS NOT NULL
  AND amount IS NOT NULL
  AND amount > 0
  AND mpesa_code IS NOT NULL
  AND length(trim(mpesa_code)) BETWEEN 8 AND 12
  AND customer_name IS NOT NULL
  AND length(trim(customer_name)) > 0
);
