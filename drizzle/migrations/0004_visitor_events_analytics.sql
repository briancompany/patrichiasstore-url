CREATE TABLE public.visitor_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  event_type text NOT NULL,
  page text,
  school text,
  product_id uuid,
  x_pct numeric(5,2),
  y_pct numeric(5,2),
  device_type text,
  referrer text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visitor_events_created_idx ON public.visitor_events (created_at);
CREATE INDEX visitor_events_visitor_idx ON public.visitor_events (visitor_id, created_at);
CREATE INDEX visitor_events_type_idx ON public.visitor_events (event_type, created_at);
CREATE INDEX visitor_events_page_idx ON public.visitor_events (page);

GRANT SELECT ON public.visitor_events TO authenticated;
GRANT ALL ON public.visitor_events TO service_role;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view visitor events"
  ON public.visitor_events FOR SELECT TO authenticated
  USING (public.is_admin());

-- Aggregate summary for the admin Visitors tab (admin-only via is_admin).
CREATE OR REPLACE FUNCTION public.visitor_summary(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  WITH win AS (
    SELECT * FROM visitor_events WHERE created_at >= _from AND created_at < _to
  ),
  funnel AS (
    SELECT
      (SELECT count(DISTINCT session_id) FROM win WHERE event_type IN ('product_viewed','school_viewed')) AS viewed,
      (SELECT count(DISTINCT session_id) FROM win WHERE event_type = 'add_to_cart') AS cart,
      (SELECT count(DISTINCT session_id) FROM win WHERE event_type = 'checkout_started') AS checkout,
      (SELECT count(DISTINCT session_id) FROM win WHERE event_type = 'order_completed') AS paid
  ),
  totals AS (
    SELECT
      (SELECT count(DISTINCT visitor_id) FROM win) AS visitors,
      (SELECT count(DISTINCT visitor_id) FROM win WHERE created_at > now() - interval '5 minutes') AS live_now,
      (SELECT count(*) FROM win WHERE event_type = 'page_view') AS pageviews,
      (SELECT count(DISTINCT session_id) FROM win WHERE event_type = 'add_to_cart') AS carts
  ),
  cart_sessions AS (
    SELECT DISTINCT session_id FROM win WHERE event_type = 'add_to_cart'
  ),
  paid_sessions AS (
    SELECT DISTINCT session_id FROM win WHERE event_type = 'order_completed'
  ),
  vnb AS (
    SELECT page, metadata->>'name' AS label, count(*) AS views, max(created_at) AS last_seen
    FROM win
    WHERE event_type = 'product_viewed'
      AND visitor_id NOT IN (SELECT DISTINCT visitor_id FROM win WHERE event_type = 'order_completed')
    GROUP BY page, label
    ORDER BY views DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT visitors FROM totals),
    'live_now', (SELECT live_now FROM totals),
    'pageviews', (SELECT pageviews FROM totals),
    'today', (SELECT count(DISTINCT visitor_id) FROM win WHERE created_at > now() - interval '24 hours'),
    'week', (SELECT count(DISTINCT visitor_id) FROM win WHERE created_at > now() - interval '7 days'),
    'returning', (SELECT count(*) FROM (
        SELECT visitor_id FROM win GROUP BY visitor_id HAVING count(DISTINCT session_id) > 1
      ) r),
    'conversion', CASE WHEN (SELECT visitors FROM totals) = 0 THEN 0
      ELSE round(100.0 * (SELECT paid FROM funnel) / (SELECT visitors FROM totals), 1) END,
    'abandoned', (SELECT count(*) FROM cart_sessions WHERE session_id NOT IN (SELECT session_id FROM paid_sessions)),
    'whatsapp_clicks', (SELECT count(*) FROM win WHERE event_type = 'whatsapp_click'),
    'chatbot_opened', (SELECT count(*) FROM win WHERE event_type = 'chatbot_opened'),
    'chatbot_messages', (SELECT count(*) FROM win WHERE event_type = 'chatbot_message_sent'),
    'device_split', COALESCE((
      SELECT jsonb_object_agg(device_type, n) FROM (
        SELECT device_type, count(DISTINCT visitor_id) AS n FROM win WHERE device_type IS NOT NULL GROUP BY device_type
      ) d), '{}'::jsonb),
    'top_referrers', COALESCE((
      SELECT jsonb_object_agg(referrer, n) FROM (
        SELECT referrer, count(DISTINCT visitor_id) AS n FROM win WHERE referrer IS NOT NULL AND referrer <> ''
        GROUP BY referrer ORDER BY n DESC LIMIT 8
      ) r), '{}'::jsonb),
    'top_schools', COALESCE((
      SELECT jsonb_object_agg(school, n) FROM (
        SELECT school, count(*) AS n FROM win WHERE school IS NOT NULL AND school <> ''
        GROUP BY school ORDER BY n DESC LIMIT 10
      ) s), '{}'::jsonb),
    'top_products', COALESCE((
      SELECT jsonb_object_agg(label, n) FROM (
        SELECT metadata->>'name' AS label, count(*) AS n FROM win
        WHERE event_type = 'product_viewed' AND metadata->>'name' IS NOT NULL
        GROUP BY label ORDER BY n DESC LIMIT 10
      ) p), '{}'::jsonb),
    'top_searches', COALESCE((
      SELECT jsonb_object_agg(q, n) FROM (
        SELECT metadata->>'query' AS q, count(*) AS n FROM win
        WHERE event_type = 'search' AND metadata->>'query' IS NOT NULL
        GROUP BY q ORDER BY n DESC LIMIT 10
      ) sr), '{}'::jsonb),
    'heatmap', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'count', n) ORDER BY dow, hour)
      FROM (
        SELECT extract(dow FROM created_at AT TIME ZONE 'Africa/Nairobi')::int AS dow,
               extract(hour FROM created_at AT TIME ZONE 'Africa/Nairobi')::int AS hour,
               count(*) AS n
        FROM win GROUP BY dow, hour
      ) h), '[]'::jsonb),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'count', n) ORDER BY day)
      FROM (
        SELECT (created_at AT TIME ZONE 'Africa/Nairobi')::date AS day, count(DISTINCT visitor_id) AS n
        FROM win GROUP BY day
      ) dd), '[]'::jsonb),
    'funnel', (
      SELECT jsonb_build_array(
        jsonb_build_object('step', 'Viewed', 'count', viewed),
        jsonb_build_object('step', 'Added to cart', 'count', cart),
        jsonb_build_object('step', 'Checkout', 'count', checkout),
        jsonb_build_object('step', 'Paid', 'count', paid)
      ) FROM funnel
    ),
    'viewed_not_bought', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('page', page, 'label', label, 'views', views, 'last_seen', last_seen)) FROM vnb
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- Click heatmap buckets for one page.
CREATE OR REPLACE FUNCTION public.visitor_clickmap(_from timestamptz, _to timestamptz, _page text)
RETURNS TABLE(x_bucket int, y_bucket int, clicks bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.is_admin() THEN
    round(x_pct / 5) * 5::int
  ELSE NULL END,
  CASE WHEN public.is_admin() THEN round(y_pct / 10) * 10::int ELSE NULL END,
  count(*)
  FROM public.visitor_events
  WHERE created_at >= _from AND created_at < _to
    AND event_type = 'click'
    AND x_pct IS NOT NULL
    AND (_page IS NULL OR page = _page)
  GROUP BY 1, 2
  HAVING public.is_admin();
$$;

-- Distinct pages with clicks (for the heatmap page selector).
CREATE OR REPLACE FUNCTION public.visitor_pages(_from timestamptz, _to timestamptz)
RETURNS TABLE(page text, clicks bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT page, count(*)
  FROM public.visitor_events
  WHERE public.is_admin() AND created_at >= _from AND created_at < _to AND event_type = 'click' AND page IS NOT NULL
  GROUP BY page
  ORDER BY count(*) DESC
  LIMIT 30;
$$;

-- Live activity feed.
CREATE OR REPLACE FUNCTION public.visitor_feed(_since timestamptz, _limit int)
RETURNS TABLE(visitor_id text, event_type text, page text, school text, metadata jsonb, device_type text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT visitor_id, event_type, page, school, metadata, device_type, created_at
  FROM public.visitor_events
  WHERE public.is_admin() AND created_at >= _since
  ORDER BY created_at DESC
  LIMIT LEAST(COALESCE(_limit, 50), 200);
$$;

-- Visitors list for the timeline picker.
CREATE OR REPLACE FUNCTION public.visitor_list(_from timestamptz, _to timestamptz, _limit int)
RETURNS TABLE(visitor_id text, events bigint, sessions bigint, first_seen timestamptz, last_seen timestamptz, device_type text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT visitor_id, count(*), count(DISTINCT session_id), min(created_at), max(created_at), max(device_type)
  FROM public.visitor_events
  WHERE public.is_admin() AND created_at >= _from AND created_at < _to
  GROUP BY visitor_id
  ORDER BY max(created_at) DESC
  LIMIT LEAST(COALESCE(_limit, 50), 200);
$$;

-- Full timeline for one visitor.
CREATE OR REPLACE FUNCTION public.visitor_timeline(_visitor_id text, _from timestamptz, _to timestamptz)
RETURNS TABLE(event_type text, page text, school text, product_id uuid, x_pct numeric, y_pct numeric, metadata jsonb, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT event_type, page, school, product_id, x_pct, y_pct, metadata, created_at
  FROM public.visitor_events
  WHERE public.is_admin() AND visitor_id = _visitor_id AND created_at >= _from AND created_at < _to
  ORDER BY created_at ASC
  LIMIT 500;
$$;

REVOKE EXECUTE ON FUNCTION public.visitor_summary(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.visitor_clickmap(timestamptz, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.visitor_pages(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.visitor_feed(timestamptz, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.visitor_list(timestamptz, timestamptz, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.visitor_timeline(text, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.visitor_summary(timestamptz, timestamptz),
  public.visitor_clickmap(timestamptz, timestamptz, text),
  public.visitor_pages(timestamptz, timestamptz),
  public.visitor_feed(timestamptz, int),
  public.visitor_list(timestamptz, timestamptz, int),
  public.visitor_timeline(text, timestamptz, timestamptz) TO authenticated;