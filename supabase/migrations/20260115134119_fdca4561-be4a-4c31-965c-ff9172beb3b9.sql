-- Fix RLS policies for orders and order_items to allow anonymous inserts
-- The issue is policies are RESTRICTIVE (must ALL pass) instead of PERMISSIVE

-- Drop the existing restrictive policies for inserts
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;

-- Create PERMISSIVE policies for public order creation (no auth required)
CREATE POLICY "Anyone can insert orders" 
ON public.orders 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can insert order items" 
ON public.order_items 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also create a pricing_chart table for admin to set prices
CREATE TABLE IF NOT EXISTS public.pricing_chart (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uniform_type TEXT NOT NULL,
  size TEXT NOT NULL,
  price INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(uniform_type, size)
);

-- Enable RLS on pricing_chart
ALTER TABLE public.pricing_chart ENABLE ROW LEVEL SECURITY;

-- Anyone can view pricing chart
CREATE POLICY "Anyone can view pricing chart" 
ON public.pricing_chart 
FOR SELECT 
USING (true);

-- Only admins can manage pricing chart
CREATE POLICY "Admins can insert pricing chart" 
ON public.pricing_chart 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update pricing chart" 
ON public.pricing_chart 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete pricing chart" 
ON public.pricing_chart 
FOR DELETE 
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_pricing_chart_updated_at
BEFORE UPDATE ON public.pricing_chart
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();