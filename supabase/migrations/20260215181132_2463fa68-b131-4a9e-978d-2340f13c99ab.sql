
-- RPC function for catalog loyalty (public/anon access via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_catalog_customer_loyalty(_owner_id uuid, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_spent numeric;
  _current_level RECORD;
  _next_level RECORD;
  _progress numeric;
  _levels jsonb;
BEGIN
  -- Get customer total_spent
  SELECT COALESCE(c.total_spent, 0) INTO _total_spent
  FROM customers c
  WHERE c.owner_id = _owner_id
    AND c.phone = _phone
  LIMIT 1;

  -- If no customer found, default to 0
  IF _total_spent IS NULL THEN
    _total_spent := 0;
  END IF;

  -- Get current level (highest min_spent <= total_spent)
  SELECT ll.name, ll.color, ll.features, ll.min_spent
  INTO _current_level
  FROM loyalty_levels ll
  WHERE ll.owner_id = _owner_id
    AND ll.min_spent <= _total_spent
  ORDER BY ll.min_spent DESC
  LIMIT 1;

  -- Get next level
  SELECT ll.name, ll.color, ll.min_spent
  INTO _next_level
  FROM loyalty_levels ll
  WHERE ll.owner_id = _owner_id
    AND ll.min_spent > _total_spent
  ORDER BY ll.min_spent ASC
  LIMIT 1;

  -- Calculate progress
  IF _next_level.min_spent IS NOT NULL AND _current_level.min_spent IS NOT NULL THEN
    IF (_next_level.min_spent - _current_level.min_spent) > 0 THEN
      _progress := ((_total_spent - _current_level.min_spent) / (_next_level.min_spent - _current_level.min_spent)) * 100;
    ELSE
      _progress := 100;
    END IF;
  ELSE
    _progress := 100;
  END IF;

  -- Get all levels for display
  SELECT jsonb_agg(jsonb_build_object(
    'name', ll.name,
    'color', ll.color,
    'min_spent', ll.min_spent,
    'features', ll.features
  ) ORDER BY ll.min_spent ASC)
  INTO _levels
  FROM loyalty_levels ll
  WHERE ll.owner_id = _owner_id;

  RETURN jsonb_build_object(
    'total_spent', _total_spent,
    'current_level', CASE WHEN _current_level.name IS NOT NULL THEN
      jsonb_build_object('name', _current_level.name, 'color', _current_level.color, 'features', _current_level.features, 'min_spent', _current_level.min_spent)
    ELSE NULL END,
    'next_level', CASE WHEN _next_level.name IS NOT NULL THEN
      jsonb_build_object('name', _next_level.name, 'color', _next_level.color, 'min_spent', _next_level.min_spent)
    ELSE NULL END,
    'progress_percent', LEAST(_progress, 100),
    'levels', COALESCE(_levels, '[]'::jsonb)
  );
END;
$$;

-- Public SELECT policy on loyalty_levels so catalog can list levels
CREATE POLICY "Public can view loyalty levels"
ON public.loyalty_levels
FOR SELECT
USING (true);
