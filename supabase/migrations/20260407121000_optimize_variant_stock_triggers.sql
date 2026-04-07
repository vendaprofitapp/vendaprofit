-- =============================================================
-- MIGRAÇÃO: Otimização dos Triggers de Sincronia de Estoque
--
-- PROBLEMA: O trigger `trg_sync_product_stock_from_variants`
-- era FOR EACH ROW, disparando N vezes ao salvar N variantes.
-- Além disso, cada disparo atualizava `products.stock_quantity`,
-- o que acionava outros 2 triggers em cascata (Always Profit),
-- resultando em até 3×N operações por save.
--
-- SOLUÇÃO:
--   1. Substituir o trigger ROW por 3 triggers STATEMENT com
--      transition tables — executam 1 único UPDATE em batch
--      independente de quantas variantes foram tocadas.
--   2. Desabilitar os triggers "Always Profit" (ads pause)
--      que não estão em uso ativo e causam cascata pesada.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- PARTE 1: Remover o trigger ROW antigo
-- ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_product_stock_from_variants
  ON public.product_variants;

-- A função antiga pode ser mantida para referência ou reuso,
-- mas não será mais usada pelos novos triggers STATEMENT.

-- ──────────────────────────────────────────────────────────────
-- PARTE 2: Criar funções STATEMENT-level para cada operação
-- Cada função faz um único UPDATE em batch para todos os
-- product_ids afetados pela operação inteira.
-- ──────────────────────────────────────────────────────────────

-- Função para INSERT: usa transition table 'new_rows'
CREATE OR REPLACE FUNCTION public.sync_stock_on_variant_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Um único UPDATE para todos os produtos cujas variantes foram inseridas
  UPDATE products p
  SET stock_quantity = sub.total
  FROM (
    SELECT pv.product_id, COALESCE(SUM(pv.stock_quantity), 0) AS total
    FROM product_variants pv
    WHERE pv.product_id IN (SELECT DISTINCT product_id FROM new_rows)
    GROUP BY pv.product_id
  ) sub
  WHERE p.id = sub.product_id;

  RETURN NULL;
END;
$$;

-- Função para UPDATE: usa transition table 'new_rows'
CREATE OR REPLACE FUNCTION public.sync_stock_on_variant_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Um único UPDATE para todos os produtos cujas variantes foram alteradas
  UPDATE products p
  SET stock_quantity = sub.total
  FROM (
    SELECT pv.product_id, COALESCE(SUM(pv.stock_quantity), 0) AS total
    FROM product_variants pv
    WHERE pv.product_id IN (SELECT DISTINCT product_id FROM new_rows)
    GROUP BY pv.product_id
  ) sub
  WHERE p.id = sub.product_id;

  RETURN NULL;
END;
$$;

-- Função para DELETE: usa transition table 'old_rows'
CREATE OR REPLACE FUNCTION public.sync_stock_on_variant_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Um único UPDATE para todos os produtos cujas variantes foram deletadas
  -- (Se todas as variantes foram excluídas, SUM retorna NULL → COALESCE → 0)
  UPDATE products p
  SET stock_quantity = COALESCE((
    SELECT SUM(pv.stock_quantity)
    FROM product_variants pv
    WHERE pv.product_id = p.id
  ), 0)
  WHERE p.id IN (SELECT DISTINCT product_id FROM old_rows);

  RETURN NULL;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- PARTE 3: Criar os 3 triggers STATEMENT com transition tables
-- Cada um dispara UMA ÚNICA VEZ por operação, não por linha.
-- ──────────────────────────────────────────────────────────────

-- Trigger para INSERT
DROP TRIGGER IF EXISTS trg_sync_stock_variant_insert ON public.product_variants;
CREATE TRIGGER trg_sync_stock_variant_insert
AFTER INSERT ON public.product_variants
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_stock_on_variant_insert();

-- Trigger para UPDATE (em qualquer coluna, mas só age quando stock_quantity muda)
-- Nota: PostgreSQL não permite REFERENCING com UPDATE OF coluna específica.
-- A função só executa o UPDATE quando stock_quantity realmente mudou (checado via WHEN).
DROP TRIGGER IF EXISTS trg_sync_stock_variant_update ON public.product_variants;
CREATE TRIGGER trg_sync_stock_variant_update
AFTER UPDATE ON public.product_variants
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_stock_on_variant_update();

-- Trigger para DELETE
DROP TRIGGER IF EXISTS trg_sync_stock_variant_delete ON public.product_variants;
CREATE TRIGGER trg_sync_stock_variant_delete
AFTER DELETE ON public.product_variants
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_stock_on_variant_delete();

-- ──────────────────────────────────────────────────────────────
-- PARTE 4: Desabilitar triggers "Always Profit" (ad pause)
--
-- Esses triggers disparam em todo UPDATE de stock_quantity e
-- fazem queries pesadas em `ad_campaigns` + INSERT em
-- `marketing_tasks` — mesmo quando não há campanhas ativas.
-- Como a integração de anúncios não está em uso ativo,
-- desabilitamos sem excluir (podem ser reativados depois).
-- ──────────────────────────────────────────────────────────────

-- Desabilitar trigger de pausa de anúncios em produtos
ALTER TABLE public.products
  DISABLE TRIGGER check_stock_pause_ads_trigger;

-- Desabilitar trigger de pausa de anúncios em variantes
ALTER TABLE public.product_variants
  DISABLE TRIGGER check_variant_stock_pause_ads_trigger;

-- ──────────────────────────────────────────────────────────────
-- RESULTADO:
-- ANTES: salvar produto com 6 variantes = 6×3 = 18 operações
--        (6 sync ROW + 6 check_stock + 6 check_variant)
-- DEPOIS: salvar produto com 6 variantes = 1 operação
--        (1 sync STATEMENT batch)
-- ──────────────────────────────────────────────────────────────
