-- Drop and recreate with explicit anon role
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Public can insert order items" ON public.order_items;

-- Create policies explicitly for anon role
CREATE POLICY "Anyone can place orders" 
ON public.orders 
FOR INSERT 
TO anon
WITH CHECK (true);

CREATE POLICY "Anyone can add order items" 
ON public.order_items 
FOR INSERT 
TO anon
WITH CHECK (true);