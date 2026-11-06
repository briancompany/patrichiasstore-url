-- Re-arm stock alert subscribers after each stockout cycle.
CREATE OR REPLACE FUNCTION public.reset_stock_alerts_when_product_sells_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stock_quantity > 0
     AND OLD.in_stock = true
     AND (NEW.stock_quantity <= 0 OR NEW.in_stock = false) THEN
    UPDATE public.stock_subscribers
    SET notified = false
    WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_stock_alerts_on_product_stockout ON public.products;
CREATE TRIGGER reset_stock_alerts_on_product_stockout
AFTER UPDATE OF stock_quantity, in_stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.reset_stock_alerts_when_product_sells_out();

-- Store actionable chatbot special-order requests with contact details and a handled state.
ALTER TABLE public.chat_leads
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS lead_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_handled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_leads_special_order_pending
  ON public.chat_leads (lead_type, is_handled, created_at DESC);

GRANT UPDATE ON public.chat_leads TO authenticated;
DROP POLICY IF EXISTS "Admins update leads" ON public.chat_leads;
CREATE POLICY "Admins update leads"
  ON public.chat_leads FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
