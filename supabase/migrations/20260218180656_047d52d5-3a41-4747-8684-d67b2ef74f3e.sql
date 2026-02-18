ALTER TABLE catalog_product_views
  ADD COLUMN IF NOT EXISTS partner_point_id uuid REFERENCES partner_points(id) ON DELETE SET NULL;