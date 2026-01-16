-- Add is_new_school flag to orders table for orders with unregistered schools
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_new_school boolean NOT NULL DEFAULT false;

-- Add linked_school_id to link orders to newly created school profiles
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS linked_school_id uuid REFERENCES public.schools(id);

-- Update order_status enum to include new_school_setup status
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'new_school_setup';