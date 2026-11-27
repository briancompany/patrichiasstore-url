-- Dynamic product catalogue: product types are data, not a fixed enum.
CREATE TABLE IF NOT EXISTS public.product_types (
  slug text PRIMARY KEY,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_types_slug_format CHECK (slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active product types" ON public.product_types;
CREATE POLICY "Anyone can view active product types" ON public.product_types
  FOR SELECT USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage product types" ON public.product_types;
CREATE POLICY "Admins manage product types" ON public.product_types
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.product_types TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_types TO authenticated;

-- Preserve all existing type values while removing the enum restriction.
ALTER TABLE public.products ALTER COLUMN type DROP DEFAULT;
ALTER TABLE public.products ALTER COLUMN type TYPE text USING type::text;
ALTER TABLE public.products ALTER COLUMN type SET DEFAULT 'tshirt';

-- Keep the existing enum helper for compatibility and add the text overload
-- used by products.type after the conversion. Stock-check/deduction RPC bodies
-- remain unchanged and resolve this overload at runtime.
CREATE OR REPLACE FUNCTION public.has_complete_size_inventory(_type text, _sizes jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.pricing_chart pc WHERE pc.uniform_type = _type)
    AND jsonb_typeof(COALESCE(_sizes, '[]'::jsonb)) = 'array'
    AND jsonb_array_length(COALESCE(_sizes, '[]'::jsonb)) > 0
    AND (SELECT count(*) FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb))) =
        (SELECT count(*) FROM public.pricing_chart pc WHERE pc.uniform_type = _type)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb)) AS s(value)
      WHERE COALESCE(s.value->>'stock', '') !~ '^[0-9]+$'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pricing_chart pc
      WHERE pc.uniform_type = _type
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(_sizes, '[]'::jsonb)) AS s(value)
          WHERE s.value->>'size' = pc.size
            AND COALESCE(s.value->>'stock', '') ~ '^[0-9]+$'
        )
    );
$$;
GRANT EXECUTE ON FUNCTION public.has_complete_size_inventory(text, jsonb) TO anon, authenticated, service_role;

-- Seed from both inventory and pricing data without overwriting admin labels.
INSERT INTO public.product_types (slug, name, sort_order)
SELECT slug, initcap(replace(slug, '_', '')), row_number() OVER (ORDER BY slug)
FROM (
  SELECT DISTINCT lower(trim(type)) AS slug FROM public.products WHERE nullif(trim(type), '') IS NOT NULL
  UNION
  SELECT DISTINCT lower(trim(uniform_type)) AS slug FROM public.pricing_chart WHERE nullif(trim(uniform_type), '') IS NOT NULL
) source
WHERE slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
ON CONFLICT (slug) DO NOTHING;

-- Common spelling/plural variants resolve to one canonical catalogue entry.
UPDATE public.products SET type = 'dress' WHERE lower(type) IN ('dresses');
UPDATE public.pricing_chart SET uniform_type = 'dress' WHERE lower(uniform_type) IN ('dresses');
UPDATE public.products SET type = 'fleece_jacket' WHERE lower(type) IN ('fleeze', 'fleece', 'fleece_jackets');
UPDATE public.pricing_chart SET uniform_type = 'fleece_jacket' WHERE lower(uniform_type) IN ('fleeze', 'fleece', 'fleece_jackets');
UPDATE public.products SET type = 'tracksuit' WHERE lower(type) IN ('tracksuits', 'track_suit');
UPDATE public.pricing_chart SET uniform_type = 'tracksuit' WHERE lower(uniform_type) IN ('tracksuits', 'track_suit');

INSERT INTO public.product_types (slug, name, sort_order) VALUES
 ('dress','Dresses',100), ('fleece_jacket','Fleece Jackets',101), ('tracksuit','Tracksuits',102)
ON CONFLICT (slug) DO NOTHING;
