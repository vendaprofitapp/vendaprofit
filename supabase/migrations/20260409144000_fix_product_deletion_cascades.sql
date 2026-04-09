-- Fix foreign key constraints on products to permit product deletion
-- This affects hubs, waitlists, and sales, ensuring clean cascades and historical preservation.

DO $$ 
BEGIN

  -- 1. consignment_items (CASCADE)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consignment_items_product_id_fkey') THEN
    ALTER TABLE public.consignment_items DROP CONSTRAINT consignment_items_product_id_fkey;
  END IF;
  
  -- 2. product_waitlist (CASCADE)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_waitlist_product_id_fkey') THEN
    ALTER TABLE public.product_waitlist DROP CONSTRAINT product_waitlist_product_id_fkey;
  END IF;

  -- 3. sale_items (SET NULL) - Preserve historical sales records natively without breaking
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_product_id_fkey') THEN
    ALTER TABLE public.sale_items DROP CONSTRAINT sale_items_product_id_fkey;
  END IF;

  -- 4. hub_sale_splits (SET NULL) - Preserve financial splits
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_sale_splits_product_id_fkey') THEN
    ALTER TABLE public.hub_sale_splits DROP CONSTRAINT hub_sale_splits_product_id_fkey;
  END IF;

  -- 5. hub_shared_products (CASCADE) 
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_shared_products_product_id_fkey') THEN
    ALTER TABLE public.hub_shared_products DROP CONSTRAINT hub_shared_products_product_id_fkey;
  END IF;

END $$;

-- 1. consignment_items (CASCADE)
ALTER TABLE public.consignment_items 
  ADD CONSTRAINT consignment_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 2. product_waitlist (CASCADE)
ALTER TABLE public.product_waitlist 
  ADD CONSTRAINT product_waitlist_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 3. sale_items (SET NULL)
ALTER TABLE public.sale_items 
  ADD CONSTRAINT sale_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- 4. hub_sale_splits (SET NULL)
ALTER TABLE public.hub_sale_splits 
  ADD CONSTRAINT hub_sale_splits_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- 5. hub_shared_products (CASCADE)
ALTER TABLE public.hub_shared_products 
  ADD CONSTRAINT hub_shared_products_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
