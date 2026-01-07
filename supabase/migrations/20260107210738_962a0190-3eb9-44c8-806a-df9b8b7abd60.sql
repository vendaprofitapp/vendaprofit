-- Public catalog: allow read access to active stores and their catalog data

-- store_settings: public can read only active stores
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active stores" ON public.store_settings;
CREATE POLICY "Public can read active stores"
ON public.store_settings
FOR SELECT
USING (is_active = true);

-- store_partnerships: public can read partnerships only for active stores
ALTER TABLE public.store_partnerships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read partnerships for active stores" ON public.store_partnerships;
CREATE POLICY "Public can read partnerships for active stores"
ON public.store_partnerships
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.store_settings s
    WHERE s.id = store_partnerships.store_id
      AND s.is_active = true
  )
);

-- products: public can read products that belong to an active store and are sellable
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read products from active stores" ON public.products;
CREATE POLICY "Public can read products from active stores"
ON public.products
FOR SELECT
USING (
  is_active = true
  AND stock_quantity > 0
  AND EXISTS (
    SELECT 1
    FROM public.store_settings s
    WHERE s.owner_id = products.owner_id
      AND s.is_active = true
  )
);

-- product_partnerships: ensure public can read (needed for public join queries)
ALTER TABLE public.product_partnerships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read product partnerships" ON public.product_partnerships;
CREATE POLICY "Public can read product partnerships"
ON public.product_partnerships
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.store_partnerships sp
    JOIN public.store_settings s ON s.id = sp.store_id
    WHERE sp.group_id = product_partnerships.group_id
      AND s.is_active = true
  )
);
