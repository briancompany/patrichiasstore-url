-- Add new delivery workflow statuses
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'processing' AFTER 'confirmed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery' AFTER 'processing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered' AFTER 'out_for_delivery';

-- Add delivered_at timestamp column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Create trigger to auto-set delivered_at when status changes to 'delivered'
CREATE OR REPLACE FUNCTION public.set_delivered_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    NEW.delivered_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_delivered_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivered_at();