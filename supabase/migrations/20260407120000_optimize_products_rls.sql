-- =============================================================
-- MIGRAÇÃO: Otimização das RLS Policies da tabela `products`
--
-- PROBLEMA: As 8 policies de SELECT em `products` usavam EXISTS
-- com subqueries e JOINs avaliados linha por linha, causando
-- lentidão extrema em todas as telas do sistema.
--
-- SOLUÇÃO: Funções STABLE SECURITY DEFINER que o PostgreSQL
-- cacheia UMA VEZ por transação, substituindo os EXISTS repetidos.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- PARTE 0: Garantir que o schema 'private' existe PRIMEIRO
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'private') THEN
    CREATE SCHEMA private;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- PARTE 1: Funções auxiliares cacheáveis (STABLE)
-- Chamadas apenas UMA VEZ por query; resultado cacheado pelo PG.
-- ──────────────────────────────────────────────────────────────

-- Retorna os group_ids dos quais o usuário atual é membro.
CREATE OR REPLACE FUNCTION private.my_group_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(group_id), '{}')
  FROM group_members
  WHERE user_id = auth.uid()
$$;

-- Retorna os owner_ids de conexões HUB onde o usuário atual é seller ativo.
CREATE OR REPLACE FUNCTION private.my_hub_owner_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT owner_id), '{}')
  FROM hub_connections
  WHERE seller_id = auth.uid()
    AND status = 'active'
$$;

-- Retorna os product_ids compartilhados via HUB ativo com o usuário atual.
CREATE OR REPLACE FUNCTION private.my_hub_shared_product_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT hsp.product_id), '{}')
  FROM hub_shared_products hsp
  JOIN hub_connections hc ON hc.id = hsp.connection_id
  WHERE hc.seller_id = auth.uid()
    AND hc.status = 'active'
    AND hsp.is_active = true
$$;

-- Retorna os product_ids compartilhados via parcerias de grupos.
CREATE OR REPLACE FUNCTION private.my_partnership_product_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT pp.product_id), '{}')
  FROM product_partnerships pp
  WHERE pp.group_id = ANY(private.my_group_ids())
$$;

-- Retorna os owner_ids de lojas ativas no catálogo público.
CREATE OR REPLACE FUNCTION private.active_store_owner_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT owner_id), '{}')
  FROM store_settings
  WHERE is_active = true
    AND show_own_products = true
$$;

-- ──────────────────────────────────────────────────────────────
-- PARTE 2: Índices de suporte para as funções acima
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON public.group_members (user_id);

CREATE INDEX IF NOT EXISTS idx_hub_connections_seller_status
  ON public.hub_connections (seller_id, status);

CREATE INDEX IF NOT EXISTS idx_hub_connections_owner_status
  ON public.hub_connections (owner_id, status);

CREATE INDEX IF NOT EXISTS idx_hub_shared_products_connection_active
  ON public.hub_shared_products (connection_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_hub_shared_products_product_id
  ON public.hub_shared_products (product_id);

CREATE INDEX IF NOT EXISTS idx_product_partnerships_group_id
  ON public.product_partnerships (group_id);

CREATE INDEX IF NOT EXISTS idx_store_settings_owner_active
  ON public.store_settings (owner_id, is_active)
  WHERE is_active = true;

-- ──────────────────────────────────────────────────────────────
-- PARTE 3: Dropar policies antigas e recriar otimizadas
-- ──────────────────────────────────────────────────────────────

-- Policy: "Users can view group products"
-- ANTES: chama is_group_member() (PL/pgSQL) para cada linha
-- DEPOIS: array check com função cacheada
DROP POLICY IF EXISTS "Users can view group products" ON public.products;
CREATE POLICY "Users can view group products"
ON public.products FOR SELECT
USING (
  group_id IS NOT NULL
  AND group_id = ANY(private.my_group_ids())
);

-- Policy: "Users can view products shared in their partnerships"
-- ANTES: EXISTS com JOIN duplo (product_partnerships + group_members) por linha
-- DEPOIS: product_ids resolvidos uma vez via função cacheada
DROP POLICY IF EXISTS "Users can view products shared in their partnerships" ON public.products;
CREATE POLICY "Users can view products shared in their partnerships"
ON public.products FOR SELECT
USING (
  id = ANY(private.my_partnership_product_ids())
);

-- Policy: "Hub sellers can view owner products"
-- ANTES: EXISTS com full scan em hub_connections para cada produto
-- DEPOIS: owner_ids resolvidos uma vez
DROP POLICY IF EXISTS "Hub sellers can view owner products" ON public.products;
CREATE POLICY "Hub sellers can view owner products"
ON public.products FOR SELECT
USING (
  owner_id = ANY(private.my_hub_owner_ids())
);

-- Policy: "Public can view products shared via hub connections"
-- ANTES: EXISTS com JOIN duplo (hub_shared_products + hub_connections) por linha
-- DEPOIS: product_ids resolvidos uma vez via função cacheada
DROP POLICY IF EXISTS "Public can view products shared via hub connections" ON public.products;
CREATE POLICY "Public can view products shared via hub connections"
ON public.products FOR SELECT
USING (
  id = ANY(private.my_hub_shared_product_ids())
);

-- Policy: "Public can read products from active stores"
-- ANTES: EXISTS com scan em store_settings para cada produto
-- DEPOIS: owner_ids de lojas ativas resolvidos uma vez
DROP POLICY IF EXISTS "Public can read products from active stores" ON public.products;
CREATE POLICY "Public can read products from active stores"
ON public.products FOR SELECT
USING (
  is_active = true
  AND stock_quantity > 0
  AND owner_id = ANY(private.active_store_owner_ids())
);

-- Policy: "Public can view products in active stores"
-- ANTES: duplo EXISTS com JOIN store_settings + product_partnerships por linha
-- DEPOIS: usa arrays cacheados para ambos os casos
DROP POLICY IF EXISTS "Public can view products in active stores" ON public.products;
CREATE POLICY "Public can view products in active stores"
ON public.products FOR SELECT
USING (
  is_active = true
  AND (
    owner_id = ANY(private.active_store_owner_ids())
    OR
    id = ANY(private.my_partnership_product_ids())
  )
);

-- Policy: "Admins can view all products"
-- ANTES: chama has_role() (função PL/pgSQL) para cada linha
-- DEPOIS: EXISTS direto na tabela user_roles (simples e indexável)
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
CREATE POLICY "Admins can view all products"
ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);
