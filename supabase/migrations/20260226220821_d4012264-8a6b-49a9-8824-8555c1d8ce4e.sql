-- Add 'hub' as a valid sale source
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_sale_source_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_sale_source_check 
  CHECK (sale_source = ANY (ARRAY[
    'estoque_proprio'::text,
    'estoque_parceria'::text,
    'estoque_grupo'::text,
    'manual'::text,
    'catalog'::text,
    'b2b'::text,
    'voice'::text,
    'bazar'::text,
    'consignment'::text,
    'consortium'::text,
    'event'::text,
    'instagram'::text,
    'partner_point'::text,
    'hub'::text
  ]));