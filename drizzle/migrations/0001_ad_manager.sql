CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name text NOT NULL,
  title text,
  image_url text NOT NULL,
  link_url text,
  placements text[] NOT NULL DEFAULT ARRAY['home']::text[],
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean NOT NULL DEFAULT true,
  price_ksh integer NOT NULL DEFAULT 0,
  advertiser_phone text,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ads" ON public.ads FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.ad_daily_stats (
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ad_id, day)
);
GRANT SELECT ON public.ad_daily_stats TO authenticated;
GRANT ALL ON public.ad_daily_stats TO service_role;
ALTER TABLE public.ad_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ad stats" ON public.ad_daily_stats FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_live_ads(_placement text)
RETURNS TABLE(id uuid, advertiser_name text, title text, image_url text, link_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.advertiser_name, a.title, a.image_url, a.link_url FROM public.ads a
  WHERE a.is_active AND now() BETWEEN a.starts_at AND a.ends_at AND _placement = ANY(a.placements)
  ORDER BY random() LIMIT 5;
$$;

CREATE OR REPLACE FUNCTION public.record_ad_event(_ad_id uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind NOT IN ('view','click') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ads WHERE id = _ad_id AND is_active AND now() BETWEEN starts_at AND ends_at) THEN RETURN; END IF;
  UPDATE public.ads SET views = views + (_kind='view')::int, clicks = clicks + (_kind='click')::int WHERE id = _ad_id;
  INSERT INTO public.ad_daily_stats(ad_id, day, views, clicks) VALUES (_ad_id, current_date, (_kind='view')::int, (_kind='click')::int)
  ON CONFLICT (ad_id, day) DO UPDATE SET views = ad_daily_stats.views + EXCLUDED.views, clicks = ad_daily_stats.clicks + EXCLUDED.clicks;
END $$;

REVOKE ALL ON FUNCTION public.get_live_ads(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_ad_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_ads(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ad_event(uuid, text) TO anon, authenticated;