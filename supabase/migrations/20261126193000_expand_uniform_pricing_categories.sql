-- Extend the product type enum to cover every chart category in the Patrichia uniform price list.
-- Existing enum values and product rows are preserved.
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'shirts_york';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'shirts_normal_plain';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 't_shirts_kids';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 't_shirts_adults';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'polo_shirts';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'long_sleeve_shirts_plain';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'long_sleeve_shirts_stripes';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'shorts_summit';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'shorts_grey';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'trousers_primary_school_summit';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'trousers_primary_school_grey';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'trousers_high_school_summit';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'trousers_high_school_grey';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'blazers';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'lab_coats';
ALTER TYPE public.uniform_type ADD VALUE IF NOT EXISTS 'scrubs';
