
-- Passo 1a: Novos campos na tabela suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS b2b_url text,
  ADD COLUMN IF NOT EXISTS b2b_login text,
  ADD COLUMN IF NOT EXISTS b2b_password text,
  ADD COLUMN IF NOT EXISTS b2b_enabled boolean NOT NULL DEFAULT false;

-- Passo 1b: Novo campo na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS b2b_product_url text;

-- Passo 1c: Novos campos na tabela sale_items
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS b2b_status text;
