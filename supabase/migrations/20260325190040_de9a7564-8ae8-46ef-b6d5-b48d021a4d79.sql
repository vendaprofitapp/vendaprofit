
-- Fix: create_sale_transaction now handles null variant_id for products with variants
-- When variant_id is null, try to find the correct variant by extracting size from product_name "(SIZE)"
-- This is the universal safety net for all cart-loading paths

CREATE OR REPLACE FUNCTION public.create_sale_transaction(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sale_id UUID;
  _owner_id UUID;
  _item JSONB;
  _stock_update JSONB;
  _split JSONB;
  _reminder JSONB;
  _result JSONB;
  _product_id UUID;
  _quantity INT;
  _size_from_name TEXT;
  _resolved_variant_id UUID;
  _variant_count INT;
BEGIN
  _owner_id := (payload->>'owner_id')::UUID;

  -- 1. Optionally create customer if new
  IF payload->'new_customer' IS NOT NULL AND payload->>'new_customer' != 'null' THEN
    INSERT INTO public.customers (owner_id, name, phone, instagram)
    VALUES (
      _owner_id,
      payload->'new_customer'->>'name',
      NULLIF(payload->'new_customer'->>'phone', ''),
      NULLIF(payload->'new_customer'->>'instagram', '')
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- 2. Insert sale
  INSERT INTO public.sales (
    owner_id, customer_name, customer_phone, payment_method,
    subtotal, discount_type, discount_value, discount_amount, total,
    notes, status, sale_source, event_name,
    shipping_method, shipping_company, shipping_cost, shipping_payer,
    shipping_address, shipping_notes, shipping_tracking, shipping_label_url
  ) VALUES (
    _owner_id,
    NULLIF(payload->'sale'->>'customer_name', ''),
    NULLIF(payload->'sale'->>'customer_phone', ''),
    COALESCE(payload->'sale'->>'payment_method', 'Dinheiro'),
    COALESCE((payload->'sale'->>'subtotal')::NUMERIC, 0),
    payload->'sale'->>'discount_type',
    COALESCE((payload->'sale'->>'discount_value')::NUMERIC, 0),
    COALESCE((payload->'sale'->>'discount_amount')::NUMERIC, 0),
    COALESCE((payload->'sale'->>'total')::NUMERIC, 0),
    NULLIF(payload->'sale'->>'notes', ''),
    COALESCE(payload->'sale'->>'status', 'completed'),
    COALESCE(payload->'sale'->>'sale_source', 'manual'),
    NULLIF(payload->'sale'->>'event_name', ''),
    NULLIF(payload->'sale'->>'shipping_method', ''),
    NULLIF(payload->'sale'->>'shipping_company', ''),
    COALESCE((payload->'sale'->>'shipping_cost')::NUMERIC, 0),
    NULLIF(payload->'sale'->>'shipping_payer', ''),
    NULLIF(payload->'sale'->>'shipping_address', ''),
    NULLIF(payload->'sale'->>'shipping_notes', ''),
    NULLIF(payload->'sale'->>'shipping_tracking', ''),
    NULLIF(payload->'sale'->>'shipping_label_url', '')
  )
  RETURNING id INTO _sale_id;

  -- 3. Insert sale items
  INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, total, source, b2b_status)
  SELECT
    _sale_id,
    (item->>'product_id')::UUID,
    item->>'product_name',
    COALESCE((item->>'quantity')::INT, 1),
    COALESCE((item->>'unit_price')::NUMERIC, 0),
    COALESCE((item->>'total')::NUMERIC, 0),
    NULLIF(item->>'source', ''),
    NULLIF(item->>'b2b_status', '')
  FROM jsonb_array_elements(payload->'items') AS item;

  -- 4. Update stock (with smart variant resolution)
  IF payload->'stock_updates' IS NOT NULL AND jsonb_array_length(payload->'stock_updates') > 0 THEN
    FOR _stock_update IN SELECT * FROM jsonb_array_elements(payload->'stock_updates')
    LOOP
      _product_id := (_stock_update->>'product_id')::UUID;
      _quantity   := COALESCE((_stock_update->>'quantity')::INT, 0);

      -- Check if a variant_id was explicitly provided
      IF _stock_update->>'variant_id' IS NOT NULL AND _stock_update->>'variant_id' != '' THEN
        -- Direct variant update — trigger trg_sync_product_stock_from_variants will sync product automatically
        UPDATE public.product_variants
        SET stock_quantity = GREATEST(stock_quantity - _quantity, 0)
        WHERE id = (_stock_update->>'variant_id')::UUID;

      ELSE
        -- variant_id is null: check if this product has variants
        SELECT COUNT(*) INTO _variant_count
        FROM public.product_variants
        WHERE product_id = _product_id;

        IF _variant_count > 0 THEN
          -- Product has variants — try to resolve which variant was sold
          -- Strategy: look at the matching sale_item product_name, extract "(SIZE)" suffix
          SELECT
            regexp_replace(si.product_name, '^.*\(([^)]+)\)\s*$', '\1')
          INTO _size_from_name
          FROM public.sale_items si
          WHERE si.sale_id = _sale_id
            AND si.product_id = _product_id
          LIMIT 1;

          -- Discard if regexp didn't match (returns whole string unchanged)
          IF _size_from_name IS NOT NULL AND _size_from_name = (
            SELECT product_name FROM public.sale_items
            WHERE sale_id = _sale_id AND product_id = _product_id LIMIT 1
          ) THEN
            _size_from_name := NULL;
          END IF;

          -- Try to find a variant matching that extracted size
          _resolved_variant_id := NULL;
          IF _size_from_name IS NOT NULL AND _size_from_name != '' THEN
            SELECT id INTO _resolved_variant_id
            FROM public.product_variants
            WHERE product_id = _product_id
              AND LOWER(TRIM(size)) = LOWER(TRIM(_size_from_name))
            LIMIT 1;
          END IF;

          IF _resolved_variant_id IS NOT NULL THEN
            -- Found the matching variant — decrement it (trigger syncs product stock)
            UPDATE public.product_variants
            SET stock_quantity = GREATEST(stock_quantity - _quantity, 0)
            WHERE id = _resolved_variant_id;

          ELSIF _variant_count = 1 THEN
            -- Only one variant exists — decrement it directly (trigger syncs product)
            UPDATE public.product_variants
            SET stock_quantity = GREATEST(stock_quantity - _quantity, 0)
            WHERE product_id = _product_id;

          ELSE
            -- Multiple variants, could not resolve — update product directly as last resort
            -- This path should be rare after frontend improvements
            UPDATE public.products
            SET stock_quantity = GREATEST(stock_quantity - _quantity, 0)
            WHERE id = _product_id;
          END IF;

        ELSE
          -- No variants: update product stock directly (no trigger conflict)
          UPDATE public.products
          SET stock_quantity = GREATEST(stock_quantity - _quantity, 0)
          WHERE id = _product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 5. Insert financial splits
  IF payload->'financial_splits' IS NOT NULL AND jsonb_array_length(payload->'financial_splits') > 0 THEN
    INSERT INTO public.financial_splits (sale_id, user_id, amount, type, description)
    SELECT
      _sale_id,
      (s->>'user_id')::UUID,
      COALESCE((s->>'amount')::NUMERIC, 0),
      s->>'type',
      s->>'description'
    FROM jsonb_array_elements(payload->'financial_splits') AS s;
  END IF;

  -- 6. Create payment reminders
  IF payload->'payment_reminders' IS NOT NULL AND payload->>'payment_reminders' != 'null' THEN
    INSERT INTO public.payment_reminders (
      sale_id, owner_id, customer_name, customer_phone, customer_instagram,
      amount, due_date, payment_method_name, notes
    )
    SELECT
      _sale_id,
      _owner_id,
      NULLIF(r->>'customer_name', ''),
      NULLIF(r->>'customer_phone', ''),
      NULLIF(r->>'customer_instagram', ''),
      COALESCE((r->>'amount')::NUMERIC, 0),
      (r->>'due_date')::DATE,
      COALESCE(r->>'payment_method_name', 'Dinheiro'),
      NULLIF(r->>'notes', '')
    FROM jsonb_array_elements(payload->'payment_reminders') AS r;
  ELSIF payload->'payment_reminder' IS NOT NULL AND payload->>'payment_reminder' != 'null' THEN
    INSERT INTO public.payment_reminders (
      sale_id, owner_id, customer_name, customer_phone, customer_instagram,
      amount, due_date, payment_method_name, notes
    ) VALUES (
      _sale_id,
      _owner_id,
      NULLIF(payload->'payment_reminder'->>'customer_name', ''),
      NULLIF(payload->'payment_reminder'->>'customer_phone', ''),
      NULLIF(payload->'payment_reminder'->>'customer_instagram', ''),
      COALESCE((payload->'payment_reminder'->>'amount')::NUMERIC, 0),
      (payload->'payment_reminder'->>'due_date')::DATE,
      COALESCE(payload->'payment_reminder'->>'payment_method_name', 'Dinheiro'),
      NULLIF(payload->'payment_reminder'->>'notes', '')
    );
  END IF;

  -- 7. Create shipping expense
  IF payload->'shipping_expense' IS NOT NULL AND payload->>'shipping_expense' != 'null' THEN
    INSERT INTO public.expenses (
      owner_id, category, category_type, amount, description, expense_date, split_mode
    ) VALUES (
      _owner_id,
      'Frete',
      'variable',
      COALESCE((payload->'shipping_expense'->>'amount')::NUMERIC, 0),
      payload->'shipping_expense'->>'description',
      COALESCE((payload->'shipping_expense'->>'expense_date')::date, CURRENT_DATE),
      'none'
    );
  END IF;

  _result := jsonb_build_object(
    'success', true,
    'sale_id', _sale_id
  );

  RETURN _result;
END;
$function$;
