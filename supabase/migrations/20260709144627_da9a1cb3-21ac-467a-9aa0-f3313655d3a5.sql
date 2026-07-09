
-- order_items INSERT
DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
CREATE POLICY "Anyone can add order items"
ON public.order_items
FOR INSERT
TO public
WITH CHECK (
  order_id IS NOT NULL
  AND product_name IS NOT NULL
  AND length(btrim(product_name)) > 0
  AND size IS NOT NULL
  AND length(btrim(size)) > 0
  AND quantity IS NOT NULL
  AND quantity > 0
  AND price_at_purchase IS NOT NULL
  AND price_at_purchase >= 0
);

-- order_tracking INSERT
DROP POLICY IF EXISTS "Anyone can insert order tracking" ON public.order_tracking;
CREATE POLICY "Anyone can insert order tracking"
ON public.order_tracking
FOR INSERT
TO public
WITH CHECK (
  order_id IS NOT NULL
  AND tracking_code IS NOT NULL
  AND tracking_code ~ '^PS-[A-Z0-9]{6,10}$'
);

-- order_contacts INSERT
DROP POLICY IF EXISTS "Anyone can insert order contacts" ON public.order_contacts;
CREATE POLICY "Anyone can insert order contacts"
ON public.order_contacts
FOR INSERT
TO public
WITH CHECK (
  order_id IS NOT NULL
  AND customer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
);

-- payments INSERT
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;
CREATE POLICY "Anyone can insert payments"
ON public.payments
FOR INSERT
TO public
WITH CHECK (
  order_id IS NOT NULL
  AND amount IS NOT NULL
  AND amount > 0
  AND mpesa_code IS NOT NULL
  AND length(btrim(mpesa_code)) >= 8
  AND length(btrim(mpesa_code)) <= 12
  AND customer_name IS NOT NULL
  AND length(btrim(customer_name)) > 0
);
