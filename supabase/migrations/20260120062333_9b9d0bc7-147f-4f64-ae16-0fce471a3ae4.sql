-- Add color and sample_image_url columns to order_items table
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS sample_image_url TEXT;