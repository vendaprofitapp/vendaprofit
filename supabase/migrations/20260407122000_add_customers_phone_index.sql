-- =============================================================
-- MIGRAÇÃO: Índice composto em customers(owner_id, phone)
--
-- PROBLEMA: Os triggers de fidelidade fazem este UPDATE a cada venda:
--   UPDATE customers SET total_spent = ...
--   WHERE owner_id = $1 AND phone = $2
--
-- Sem índice nessa combinação, o banco faz full scan na tabela
-- de clientes para cada venda registrada.
--
-- SOLUÇÃO: Criar índice composto covering (owner_id, phone) +
--          índice em sales(owner_id, customer_phone) para os
--          triggers de loyalty e queries de vendas por cliente.
-- =============================================================

-- Índice principal: suporte aos triggers de fidelidade
CREATE INDEX IF NOT EXISTS idx_customers_owner_phone
  ON public.customers (owner_id, phone);

-- Índice auxiliar: suporte às queries em sales por cliente
CREATE INDEX IF NOT EXISTS idx_sales_owner_customer_phone
  ON public.sales (owner_id, customer_phone)
  WHERE customer_phone IS NOT NULL AND customer_phone != '';

-- Índice auxiliar: suporte à busca de clientes por nome
CREATE INDEX IF NOT EXISTS idx_customers_owner_name
  ON public.customers (owner_id, name);

-- Índice auxiliar: suporte ao total_spent nas queries de fidelidade
CREATE INDEX IF NOT EXISTS idx_customers_owner_total_spent
  ON public.customers (owner_id, total_spent DESC)
  WHERE total_spent > 0;
