-- Make school cleanup safe for linked orders and convert chatbot special-order
-- leads into their corresponding checkout order without double-counting alerts.

CREATE OR REPLACE FUNCTION public.admin_delete_schools(_school_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF _school_ids IS NULL OR cardinality(_school_ids) = 0 THEN
    RETURN 0;
  END IF;

  -- products.school_id already uses ON DELETE SET NULL. Orders use the
  -- default restrictive FK, so unlink them explicitly before deleting.
  UPDATE public.orders
  SET linked_school_id = NULL
  WHERE linked_school_id = ANY(_school_ids);

  DELETE FROM public.schools
  WHERE id = ANY(_school_ids);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_schools(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_schools(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_chat_special_order_converted(
  _session_id uuid,
  _order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF _session_id IS NULL OR _order_id IS NULL THEN
    RETURN false;
  END IF;

  -- Only close a pending chatbot request when the same customer's actual
  -- special-order checkout has been saved. This prevents arbitrary lead updates.
  UPDATE public.chat_leads AS lead
  SET is_handled = true
  FROM public.orders AS ord
  WHERE lead.session_id = _session_id
    AND lead.lead_type = 'special_order'
    AND lead.is_handled = false
    AND ord.id = _order_id
    AND ord.is_special_order = true
    AND (
      CASE
        WHEN left(regexp_replace(coalesce(lead.phone, ''), '[^0-9]', '', 'g'), 1) = '0'
          THEN '254' || substr(regexp_replace(coalesce(lead.phone, ''), '[^0-9]', '', 'g'), 2)
        ELSE regexp_replace(coalesce(lead.phone, ''), '[^0-9]', '', 'g')
      END
    ) = (
      CASE
        WHEN left(regexp_replace(coalesce(ord.customer_phone, ''), '[^0-9]', '', 'g'), 1) = '0'
          THEN '254' || substr(regexp_replace(coalesce(ord.customer_phone, ''), '[^0-9]', '', 'g'), 2)
        ELSE regexp_replace(coalesce(ord.customer_phone, ''), '[^0-9]', '', 'g')
      END
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_special_order_converted(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_chat_special_order_converted(uuid, uuid) TO anon, authenticated;
