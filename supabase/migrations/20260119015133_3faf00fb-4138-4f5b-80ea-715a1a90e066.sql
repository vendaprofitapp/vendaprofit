-- Add variant_id column to stock_requests for tracking specific variants
ALTER TABLE public.stock_requests 
ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Add variant details columns for display purposes (color/size from the variant)
ALTER TABLE public.stock_requests 
ADD COLUMN variant_color TEXT,
ADD COLUMN variant_size TEXT;

-- Create a function to atomically approve a stock request
-- This subtracts stock from the owner and marks the request as approved
CREATE OR REPLACE FUNCTION public.approve_stock_request(
  _request_id UUID,
  _response_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _request RECORD;
  _current_stock INTEGER;
  _result JSONB;
BEGIN
  -- Get the request details
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
  
  -- Check if user is the owner
  IF _request.owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o dono do produto pode aprovar');
  END IF;
  
  -- Check and update stock based on whether it's a variant or main product
  IF _request.variant_id IS NOT NULL THEN
    -- Get current variant stock
    SELECT stock_quantity INTO _current_stock
    FROM product_variants
    WHERE id = _request.variant_id
    FOR UPDATE;
    
    IF _current_stock < _request.quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente na variante');
    END IF;
    
    -- Subtract from variant stock
    UPDATE product_variants
    SET stock_quantity = stock_quantity - _request.quantity
    WHERE id = _request.variant_id;
    
    -- Also update the main product stock
    UPDATE products
    SET stock_quantity = stock_quantity - _request.quantity
    WHERE id = _request.product_id;
  ELSE
    -- Get current product stock
    SELECT stock_quantity INTO _current_stock
    FROM products
    WHERE id = _request.product_id
    FOR UPDATE;
    
    IF _current_stock < _request.quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente');
    END IF;
    
    -- Subtract from product stock
    UPDATE products
    SET stock_quantity = stock_quantity - _request.quantity
    WHERE id = _request.product_id;
  END IF;
  
  -- Update the request status
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
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.approve_stock_request(UUID, TEXT) TO authenticated;