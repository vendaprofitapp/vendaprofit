
-- Add event_name column to sales for Event Mode reports
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS event_name TEXT;

-- Drop old constraint and recreate with new sources
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_sale_source_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_sale_source_check 
  CHECK (sale_source IN ('estoque_proprio', 'estoque_parceria', 'estoque_grupo', 'manual', 'catalog', 'b2b', 'voice', 'bazar', 'consignment', 'consortium'));
