-- Convert marketing_status from text to text[] (array) for multiple status support

-- 1. Drop the existing check constraints
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_marketing_status_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_marketing_status_check;

-- 2. Add temporary columns to hold array data
ALTER TABLE product_variants ADD COLUMN marketing_statuses text[];
ALTER TABLE products ADD COLUMN marketing_statuses text[];

-- 3. Migrate existing data (convert single value to array)
UPDATE product_variants 
SET marketing_statuses = CASE 
  WHEN marketing_status IS NOT NULL THEN ARRAY[marketing_status]
  ELSE NULL 
END;

UPDATE products 
SET marketing_statuses = CASE 
  WHEN marketing_status IS NOT NULL THEN ARRAY[marketing_status]
  ELSE NULL 
END;

-- 4. Drop old columns
ALTER TABLE product_variants DROP COLUMN marketing_status;
ALTER TABLE products DROP COLUMN marketing_status;

-- 5. Rename new columns to original name
ALTER TABLE product_variants RENAME COLUMN marketing_statuses TO marketing_status;
ALTER TABLE products RENAME COLUMN marketing_statuses TO marketing_status;