-- Record anonymous storefront analytics without requiring an Edge Function.
-- Public callers can only insert validated, allow-listed events.
CREATE OR REPLACE FUNCTION public.record_visitor_events(_events jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  item jsonb;
  v_visitor text;
  v_session text;
  v_type text;
  v_page text;
  v_school text;
  v_product uuid;
  v_device text;
  v_referrer text;
  v_x numeric;
  v_y numeric;
  v_meta jsonb;
  v_count integer := 0;
  v_existing integer;
BEGIN
  IF jsonb_typeof(_events) <> 'array'
     OR jsonb_array_length(_events) < 1
     OR jsonb_array_length(_events) > 40 THEN
    RAISE EXCEPTION 'Invalid analytics batch' USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(_events)
  LOOP
    v_visitor := item->>'visitorId';
    v_session := item->>'sessionId';
    v_type := item->>'type';

    IF v_visitor !~ '^[a-f0-9]{32}$'
       OR v_session !~ '^[a-f0-9]{32}$'
       OR v_type NOT IN (
         'page_view','school_viewed','product_viewed','search','add_to_cart',
         'checkout_started','order_completed','chatbot_opened',
         'chatbot_message_sent','whatsapp_click','click','time_on_page'
       ) THEN
      CONTINUE;
    END IF;

    SELECT count(*) INTO v_existing
    FROM public.visitor_events
    WHERE visitor_id = v_visitor
      AND created_at >= now() - interval '1 hour';
    IF v_existing >= 600 THEN
      CONTINUE;
    END IF;

    v_page := left(regexp_replace(coalesce(item->>'page',''), '[[:cntrl:]]', '', 'g'), 200);
    v_school := nullif(left(regexp_replace(coalesce(item->>'school',''), '[[:cntrl:]]', '', 'g'), 120), '');
    v_device := CASE WHEN item->>'deviceType' IN ('mobile','desktop','tablet') THEN item->>'deviceType' ELSE NULL END;
    v_referrer := nullif(left(regexp_replace(coalesce(item->>'referrer',''), '[[:cntrl:]]', '', 'g'), 200), '');
    v_product := CASE WHEN coalesce(item->>'productId','') ~* '^[0-9a-f-]{36}$'
                      THEN (item->>'productId')::uuid ELSE NULL END;
    v_x := CASE WHEN jsonb_typeof(item->'xPct') = 'number'
                     AND (item->>'xPct')::numeric BETWEEN 0 AND 100
                THEN (item->>'xPct')::numeric ELSE NULL END;
    v_y := CASE WHEN jsonb_typeof(item->'yPct') = 'number'
                     AND (item->>'yPct')::numeric BETWEEN 0 AND 100
                THEN (item->>'yPct')::numeric ELSE NULL END;

    v_meta := CASE WHEN jsonb_typeof(item->'meta') = 'object' THEN item->'meta' ELSE '{}'::jsonb END;
    IF pg_column_size(v_meta) > 2048 THEN
      v_meta := '{}'::jsonb;
    END IF;
    IF jsonb_typeof(item->'seconds') = 'number' THEN
      v_meta := v_meta || jsonb_build_object('seconds', least(86400, greatest(0, (item->>'seconds')::integer)));
    END IF;
    IF jsonb_typeof(item->'scrollPct') = 'number' THEN
      v_meta := v_meta || jsonb_build_object('scroll_pct', least(100, greatest(0, (item->>'scrollPct')::integer)));
    END IF;

    INSERT INTO public.visitor_events (
      visitor_id, session_id, event_type, page, school, product_id,
      x_pct, y_pct, device_type, referrer, metadata
    ) VALUES (
      v_visitor, v_session, v_type, nullif(v_page,''), v_school, v_product,
      v_x, v_y, v_device, v_referrer, v_meta
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'stored', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.record_visitor_events(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_visitor_events(jsonb) TO anon, authenticated;
