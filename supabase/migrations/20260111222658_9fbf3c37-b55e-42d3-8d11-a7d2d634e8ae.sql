-- Update foreign key on product_variants to cascade delete
ALTER TABLE public.product_variants 
DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;

ALTER TABLE public.product_variants 
ADD CONSTRAINT product_variants_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;