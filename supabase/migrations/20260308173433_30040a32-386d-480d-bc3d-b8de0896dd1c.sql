
-- Flash sales table
CREATE TABLE public.flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  sale_price integer NOT NULL,
  original_price integer NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

-- Anyone can view active flash sales
CREATE POLICY "Anyone can view active flash sales"
ON public.flash_sales FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can view all flash sales"
ON public.flash_sales FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert flash sales"
ON public.flash_sales FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update flash sales"
ON public.flash_sales FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete flash sales"
ON public.flash_sales FOR DELETE
USING (is_admin());

-- Product bundles table
CREATE TABLE public.product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  bundle_price integer NOT NULL,
  original_price integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bundles"
ON public.product_bundles FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can view all bundles"
ON public.product_bundles FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert bundles"
ON public.product_bundles FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update bundles"
ON public.product_bundles FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete bundles"
ON public.product_bundles FOR DELETE
USING (is_admin());

-- Bundle items junction table
CREATE TABLE public.bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid REFERENCES public.product_bundles(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  size text NOT NULL DEFAULT 'M',
  quantity integer NOT NULL DEFAULT 1
);

ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bundle items"
ON public.bundle_items FOR SELECT
USING (true);

CREATE POLICY "Admins can insert bundle items"
ON public.bundle_items FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update bundle items"
ON public.bundle_items FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete bundle items"
ON public.bundle_items FOR DELETE
USING (is_admin());
