-- Add 'instagram' to allowed sale_source values
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_sale_source_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_sale_source_check 
  CHECK (sale_source = ANY (ARRAY['estoque_proprio','estoque_parceria','estoque_grupo','manual','catalog','b2b','voice','bazar','consignment','consortium','event','instagram']));
