
CREATE POLICY "Public can read products allocated to partner points"
ON products
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM partner_point_items ppi
    WHERE ppi.product_id = products.id
      AND ppi.status = 'allocated'
  )
);
