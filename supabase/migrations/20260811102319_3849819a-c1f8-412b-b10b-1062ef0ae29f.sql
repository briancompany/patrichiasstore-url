ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS share_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_share_token
ON public.quotations (share_token);

CREATE OR REPLACE FUNCTION public.get_quotation_public(_share_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'quote_number', q.quote_number,
    'customer_name', q.customer_name,
    'customer_phone', q.customer_phone,
    'customer_email', q.customer_email,
    'staff_name', q.staff_name,
    'created_at', q.created_at,
    'valid_until', q.valid_until,
    'notes', q.notes,
    'subtotal', q.subtotal,
    'discount', q.discount,
    'total', q.total,
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_name', qi.product_name,
          'size', qi.size,
          'color', qi.color,
          'unit_price', qi.unit_price,
          'quantity', qi.quantity,
          'line_total', qi.line_total
        ) ORDER BY qi.created_at, qi.id
      )
      FROM public.quotation_items qi
      WHERE qi.quotation_id = q.id
    ), '[]'::jsonb)
  )
  FROM public.quotations q
  WHERE q.share_token = _share_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_quotation_public(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quotation_public(UUID) TO anon, authenticated, service_role;