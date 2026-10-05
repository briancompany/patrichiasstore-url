ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_initiated';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'declined';