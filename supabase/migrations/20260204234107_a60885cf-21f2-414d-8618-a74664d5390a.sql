-- =====================================================
-- REESTRUTURAÇÃO COMPLETA DO SISTEMA DE PRODUTOS
-- =====================================================
-- ATENÇÃO: Este script APAGA todos os produtos existentes!

-- 1. LIMPEZA TOTAL (RESET)
-- Cuidado: Isso apaga todos os produtos e histórico de estoque para começar limpo.
TRUNCATE TABLE public.products CASCADE;

-- 2. ATUALIZAÇÃO DA TABELA PRODUCTS (PAI)
-- Novos campos para filtros e mídia
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS model text,          -- Ex: "Top Carol" (Para filtros)
ADD COLUMN IF NOT EXISTS color_label text,    -- Ex: "Vermelho" (Para filtros)
ADD COLUMN IF NOT EXISTS custom_detail text;  -- Ex: "Tecido Brilhante" (Para filtros)

-- Nota: video_url, image_url, image_url_2, image_url_3 já existem na tabela products

-- 3. ATUALIZAÇÃO DA TABELA PRODUCT_VARIANTS (FILHO)
-- Removemos a cor, pois a cor agora está definida no nome do Produto Pai
ALTER TABLE public.product_variants
DROP COLUMN IF EXISTS color;

-- 4. CRIAR ÍNDICES PARA OS NOVOS CAMPOS DE FILTRO
CREATE INDEX IF NOT EXISTS idx_products_model ON public.products(model);
CREATE INDEX IF NOT EXISTS idx_products_color_label ON public.products(color_label);
CREATE INDEX IF NOT EXISTS idx_products_custom_detail ON public.products(custom_detail);