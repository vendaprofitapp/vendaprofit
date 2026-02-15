
ALTER TABLE products ADD COLUMN IF NOT EXISTS b2b_source_product_id uuid REFERENCES products(id);

CREATE INDEX IF NOT EXISTS idx_products_b2b_source ON products(b2b_source_product_id) WHERE b2b_source_product_id IS NOT NULL;
