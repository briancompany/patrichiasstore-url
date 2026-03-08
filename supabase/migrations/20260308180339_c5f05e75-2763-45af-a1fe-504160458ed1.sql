
-- Performance indexes for sub-50ms query execution
-- Products
CREATE INDEX IF NOT EXISTS idx_products_school_id ON public.products (school_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON public.products (type);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products (in_stock);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_school_stock ON public.products (school_id, in_stock);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_linked_school_id ON public.orders (linked_school_id);

-- Order items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_mpesa_code ON public.payments (mpesa_code);

-- Order tracking
CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id ON public.order_tracking (order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_code ON public.order_tracking (tracking_code);

-- Flash sales
CREATE INDEX IF NOT EXISTS idx_flash_sales_product_id ON public.flash_sales (product_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_active_dates ON public.flash_sales (is_active, starts_at, ends_at);

-- Discount codes
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes (code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON public.discount_codes (is_active);

-- Product reviews
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON public.product_reviews (is_approved);

-- Stock subscribers
CREATE INDEX IF NOT EXISTS idx_stock_subscribers_product_id ON public.stock_subscribers (product_id);

-- Pricing chart
CREATE INDEX IF NOT EXISTS idx_pricing_chart_type ON public.pricing_chart (uniform_type);

-- Receipt emails
CREATE INDEX IF NOT EXISTS idx_receipt_emails_order_id ON public.receipt_emails (order_id);

-- Bundle items
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON public.bundle_items (bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON public.bundle_items (product_id);

-- Order contacts
CREATE INDEX IF NOT EXISTS idx_order_contacts_order_id ON public.order_contacts (order_id);

-- Delivery zones
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON public.delivery_zones (is_active);

-- Create aggregate view for product ratings (eliminates N+1)
CREATE OR REPLACE VIEW public.product_rating_summary AS
SELECT
  product_id,
  COUNT(*)::int AS review_count,
  ROUND(AVG(rating)::numeric, 1)::float AS avg_rating
FROM public.product_reviews
WHERE is_approved = true
GROUP BY product_id;
