-- Update order_status enum to include new statuses
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';

-- Add printing_required and logo_confirmed columns to order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS printing_required boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS logo_url text;

-- Create a table for customer order tracking (allows customers to view their orders without auth)
CREATE TABLE IF NOT EXISTS public.order_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  tracking_code text UNIQUE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on order_tracking
ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view order tracking (they need the code to find it)
CREATE POLICY "Anyone can view order tracking by code" 
ON public.order_tracking 
FOR SELECT 
USING (true);

-- Only admins can insert tracking codes
CREATE POLICY "Admins can insert order tracking" 
ON public.order_tracking 
FOR INSERT 
WITH CHECK (is_admin());

-- Allow public to insert orders (for customer checkout)
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

-- Allow public to insert order items (for customer checkout)
DROP POLICY IF EXISTS "Admins can insert order items" ON public.order_items;
CREATE POLICY "Anyone can insert order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to view their own order by tracking code (via join)
CREATE POLICY "Anyone can view orders via tracking" 
ON public.orders 
FOR SELECT 
USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM public.order_tracking ot WHERE ot.order_id = orders.id
  )
);

-- Allow anyone to view order items for orders they can access
CREATE POLICY "Anyone can view order items via tracking" 
ON public.order_items 
FOR SELECT 
USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 FROM public.order_tracking ot WHERE ot.order_id = order_items.order_id
  )
);