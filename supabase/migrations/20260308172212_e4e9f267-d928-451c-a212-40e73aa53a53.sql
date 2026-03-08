
-- Product reviews table
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  reviewer_name text NOT NULL,
  reviewer_email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a review
CREATE POLICY "Anyone can submit reviews"
ON public.product_reviews FOR INSERT
WITH CHECK (
  product_id IS NOT NULL
  AND reviewer_name IS NOT NULL
  AND length(trim(reviewer_name)) > 0
  AND reviewer_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND rating >= 1
  AND rating <= 5
);

-- Anyone can view approved reviews
CREATE POLICY "Anyone can view approved reviews"
ON public.product_reviews FOR SELECT
USING (is_approved = true);

-- Admins can view all reviews
CREATE POLICY "Admins can view all reviews"
ON public.product_reviews FOR SELECT
USING (is_admin());

-- Admins can update reviews (approve/reject)
CREATE POLICY "Admins can update reviews"
ON public.product_reviews FOR UPDATE
USING (is_admin());

-- Admins can delete reviews
CREATE POLICY "Admins can delete reviews"
ON public.product_reviews FOR DELETE
USING (is_admin());

-- Discounts/coupons table
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_percent integer NOT NULL DEFAULT 0,
  discount_amount integer NOT NULL DEFAULT 0,
  min_order_amount integer NOT NULL DEFAULT 0,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can view active discount codes (for validation)
CREATE POLICY "Anyone can view active discounts"
ON public.discount_codes FOR SELECT
USING (is_active = true);

-- Admins can manage discounts
CREATE POLICY "Admins can manage discounts select"
ON public.discount_codes FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert discounts"
ON public.discount_codes FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update discounts"
ON public.discount_codes FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete discounts"
ON public.discount_codes FOR DELETE
USING (is_admin());

-- Add stock_quantity to products for low stock alerts
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 100;
