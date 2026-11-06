-- Structured colour metadata for catalogue matching.
-- Existing products remain valid; descriptions and all existing fields are preserved.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS colors text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.products.colors IS
  'Structured colour names for this product; supports multiple colours for patterns and combinations.';
