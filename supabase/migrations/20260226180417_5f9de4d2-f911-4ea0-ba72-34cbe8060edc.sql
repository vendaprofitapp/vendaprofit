
-- 1. Ensure public RLS for product_images (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_images') THEN
    -- Enable RLS if not already enabled
    ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
    
    -- Drop if exists to avoid conflict
    DROP POLICY IF EXISTS "Public can read images of hub shared products" ON public.product_images;
    
    CREATE POLICY "Public can read images of hub shared products"
    ON public.product_images FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.hub_shared_products hsp
        JOIN public.hub_connections hc ON hc.id = hsp.connection_id
        WHERE hsp.product_id = product_images.product_id
          AND hsp.is_active = true
          AND hc.status = 'active'
      )
    );
  END IF;
END $$;

-- 2. Ensure all existing public HUB policies exist (idempotent)

-- hub_connections: public read for active
DROP POLICY IF EXISTS "Public can read active hub connections for catalog" ON public.hub_connections;
CREATE POLICY "Public can read active hub connections for catalog"
ON public.hub_connections FOR SELECT
USING (status = 'active');

-- hub_shared_products: public read for active
DROP POLICY IF EXISTS "Public can read active hub shared products for catalog" ON public.hub_shared_products;
CREATE POLICY "Public can read active hub shared products for catalog"
ON public.hub_shared_products FOR SELECT
USING (is_active = true);

-- products: public read for hub shared
DROP POLICY IF EXISTS "Public can view products shared via hub connections" ON public.products;
CREATE POLICY "Public can view products shared via hub connections"
ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hub_shared_products hsp
    JOIN public.hub_connections hc ON hc.id = hsp.connection_id
    WHERE hsp.product_id = products.id
      AND hsp.is_active = true
      AND hc.status = 'active'
  )
);

-- product_variants: public read for hub shared
DROP POLICY IF EXISTS "Public can read variants of hub shared products" ON public.product_variants;
CREATE POLICY "Public can read variants of hub shared products"
ON public.product_variants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hub_shared_products hsp
    JOIN public.hub_connections hc ON hc.id = hsp.connection_id
    WHERE hsp.product_id = product_variants.product_id
      AND hsp.is_active = true
      AND hc.status = 'active'
  )
);

-- 3. Trigger: auto-share new products to hub connections with auto_share_all=true
CREATE OR REPLACE FUNCTION public.auto_share_new_product_to_hub()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a new active product is created, add to any active hub connections
  -- where the owner has auto_share_all enabled
  IF NEW.is_active = true THEN
    INSERT INTO public.hub_shared_products (connection_id, product_id, is_active)
    SELECT hc.id, NEW.id, true
    FROM public.hub_connections hc
    WHERE hc.owner_id = NEW.owner_id
      AND hc.status = 'active'
      AND hc.auto_share_all = true
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_share_product_to_hub ON public.products;
CREATE TRIGGER trigger_auto_share_product_to_hub
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.auto_share_new_product_to_hub();

-- 4. Trigger: when hub_connection becomes active with auto_share_all=true,
--    auto-share all existing owner products
CREATE OR REPLACE FUNCTION public.auto_share_on_hub_connection_activate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a connection is activated and has auto_share_all=true
  IF NEW.status = 'active' AND NEW.auto_share_all = true 
     AND (OLD.status IS DISTINCT FROM 'active' OR OLD.auto_share_all IS DISTINCT FROM true) THEN
    INSERT INTO public.hub_shared_products (connection_id, product_id, is_active)
    SELECT NEW.id, p.id, true
    FROM public.products p
    WHERE p.owner_id = NEW.owner_id
      AND p.is_active = true
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_share_on_hub_activate ON public.hub_connections;
CREATE TRIGGER trigger_auto_share_on_hub_activate
AFTER UPDATE ON public.hub_connections
FOR EACH ROW
EXECUTE FUNCTION public.auto_share_on_hub_connection_activate();
