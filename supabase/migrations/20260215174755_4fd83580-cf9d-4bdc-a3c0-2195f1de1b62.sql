
-- 1. Create trigger function to sync product stock from variants
CREATE OR REPLACE FUNCTION public.sync_product_stock_from_variants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _product_id uuid;
  _total integer;
BEGIN
  -- Determine which product_id to sync
  IF TG_OP = 'DELETE' THEN
    _product_id := OLD.product_id;
  ELSE
    _product_id := NEW.product_id;
  END IF;

  -- Recalculate total stock from all variants
  SELECT COALESCE(SUM(stock_quantity), 0) INTO _total
  FROM product_variants
  WHERE product_id = _product_id;

  -- Update the parent product
  UPDATE products
  SET stock_quantity = _total
  WHERE id = _product_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 2. Create the trigger
CREATE TRIGGER trg_sync_product_stock_from_variants
AFTER INSERT OR UPDATE OF stock_quantity OR DELETE
ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_stock_from_variants();

-- 3. Fix existing desynchronized data
UPDATE products p
SET stock_quantity = sub.total
FROM (
  SELECT product_id, COALESCE(SUM(stock_quantity), 0) as total
  FROM product_variants
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND p.stock_quantity != sub.total;

-- 4. Fix approve_stock_request: remove manual product stock update for variants
-- (the trigger now handles it automatically)
CREATE OR REPLACE FUNCTION public.approve_stock_request(_request_id uuid, _response_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _request RECORD;
  _current_stock INTEGER;
  _result JSONB;
BEGIN
  SELECT sr.*, p.name as product_name, p.price as product_price
  INTO _request
  FROM stock_requests sr
  JOIN products p ON p.id = sr.product_id
  WHERE sr.id = _request_id
    AND sr.status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada ou já processada');
  END IF;
  
  IF _request.owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o dono do produto pode aprovar');
  END IF;
  
  IF _request.variant_id IS NOT NULL THEN
    SELECT stock_quantity INTO _current_stock
    FROM product_variants
    WHERE id = _request.variant_id
    FOR UPDATE;
    
    IF _current_stock < _request.quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente na variante');
    END IF;
    
    -- Only update variant; trigger will sync product automatically
    UPDATE product_variants
    SET stock_quantity = stock_quantity - _request.quantity
    WHERE id = _request.variant_id;
  ELSE
    SELECT stock_quantity INTO _current_stock
    FROM products
    WHERE id = _request.product_id
    FOR UPDATE;
    
    IF _current_stock < _request.quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente');
    END IF;
    
    UPDATE products
    SET stock_quantity = stock_quantity - _request.quantity
    WHERE id = _request.product_id;
  END IF;
  
  UPDATE stock_requests
  SET status = 'approved',
      response_notes = _response_notes,
      responded_at = now()
  WHERE id = _request_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'product_name', _request.product_name,
    'product_price', _request.product_price,
    'quantity', _request.quantity,
    'variant_color', _request.variant_color,
    'variant_size', _request.variant_size
  );
END;
$function$;
