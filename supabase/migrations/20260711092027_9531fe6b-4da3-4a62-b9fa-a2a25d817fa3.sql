
-- CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'));
CREATE POLICY "Staff can insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'));
CREATE POLICY "Staff can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'));
CREATE POLICY "Admins can delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (public.has_staff_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- QUOTATIONS
CREATE SEQUENCE IF NOT EXISTS public.quotation_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE DEFAULT ('QT-' || lpad(nextval('public.quotation_number_seq')::text, 5, '0')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotations_staff ON public.quotations(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON public.quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations(quote_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quotations"
  ON public.quotations FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'));
CREATE POLICY "Staff can insert own quotations"
  ON public.quotations FOR INSERT TO authenticated
  WITH CHECK (
    staff_user_id = auth.uid()
    AND (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'))
  );
CREATE POLICY "Staff can update own quotations, admins any"
  ON public.quotations FOR UPDATE TO authenticated
  USING (staff_user_id = auth.uid() OR public.has_staff_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can delete own quotations, admins any"
  ON public.quotations FOR DELETE TO authenticated
  USING (staff_user_id = auth.uid() OR public.has_staff_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- QUOTATION ITEMS
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  size TEXT,
  color TEXT,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quote ON public.quotation_items(quotation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_items TO authenticated;
GRANT ALL ON public.quotation_items TO service_role;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view quotation items"
  ON public.quotation_items FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'));
CREATE POLICY "Staff insert quotation items"
  ON public.quotation_items FOR INSERT TO authenticated
  WITH CHECK (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'));
CREATE POLICY "Staff update quotation items"
  ON public.quotation_items FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'));
CREATE POLICY "Staff delete quotation items"
  ON public.quotation_items FOR DELETE TO authenticated
  USING (public.has_staff_role(auth.uid(), 'admin') OR public.has_staff_role(auth.uid(), 'quotation_staff'));
