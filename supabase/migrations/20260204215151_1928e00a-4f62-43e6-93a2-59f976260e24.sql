-- Drop existing constraints
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_marketing_status_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_marketing_status_check;

-- Add updated constraints with 'secret' option
ALTER TABLE product_variants ADD CONSTRAINT product_variants_marketing_status_check 
  CHECK (marketing_status IS NULL OR marketing_status = ANY (ARRAY['opportunity', 'presale', 'launch', 'secret']));

ALTER TABLE products ADD CONSTRAINT products_marketing_status_check 
  CHECK (marketing_status IS NULL OR marketing_status = ANY (ARRAY['opportunity', 'presale', 'launch', 'secret']));