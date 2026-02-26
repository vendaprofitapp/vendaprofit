
-- Allow public (anonymous) to read hub_connections where needed for catalog
CREATE POLICY "Public can read active hub connections for catalog"
ON public.hub_connections
FOR SELECT
USING (status = 'active');

-- Allow public (anonymous) to read hub_shared_products for catalog
CREATE POLICY "Public can read active hub shared products for catalog"
ON public.hub_shared_products
FOR SELECT
USING (is_active = true);
