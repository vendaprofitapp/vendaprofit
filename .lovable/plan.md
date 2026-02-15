# Correcao: Dessincronizacao entre Estoque de Variantes e Produto Principal

## Problema Identificado

O estoque do produto principal (`products.stock_quantity`) ficou zerado enquanto a variante tamanho M tinha 1 unidade. Isso causou:

- Produto nao aparecer no PDV (Nova Venda) -- que filtra por `stock_quantity > 0`
- Produto aparecer com estoque 0 na lista do Controle de Estoque
- Ao editar o produto, o formulario recalculou a soma das variantes e corrigiu o valor

### Causa raiz: Bug de subtracao dupla no `Sales.tsx`

No codigo de finalizacao de venda (linha ~695-712 de `Sales.tsx`), quando um item tem variante:

1. Atualiza o estoque da variante (subtrai a quantidade vendida) -- CORRETO
2. Re-busca todas as variantes do produto (que ja inclui o valor decrementado do passo 1)
3. Soma o estoque de todas as variantes E subtrai a quantidade vendida novamente -- BUG

Resultado: o `products.stock_quantity` fica menor que a soma real das variantes. Com o tempo, fica zerado ou negativo (protegido por `Math.max(0, ...)`).

## Solucao

### 1. Corrigir a subtracao dupla em `Sales.tsx`

Na linha 708, remover o `- item.quantity` pois os dados ja foram atualizados no passo anterior:

```
// ANTES (bug):
const totalVariantStock = allVariants.reduce((sum, v) => sum + v.stock_quantity, 0) - item.quantity;

// DEPOIS (correto):
const totalVariantStock = allVariants.reduce((sum, v) => sum + v.stock_quantity, 0);
```

### 2. Criar trigger de sincronizacao automatica (protecao definitiva)

Criar um trigger na tabela `product_variants` que, ao alterar `stock_quantity`, recalcula automaticamente o `products.stock_quantity` como a soma de todas as variantes. Isso protege contra qualquer futuro bug no codigo frontend.

```text
AFTER INSERT OR UPDATE OR DELETE ON product_variants
-> Recalcula products.stock_quantity = SUM(product_variants.stock_quantity)
```

### 3. Migracao para corrigir dados existentes

Executar um UPDATE para sincronizar todos os produtos que tenham variantes:

```text
UPDATE products p
SET stock_quantity = sub.total
FROM (
  SELECT product_id, COALESCE(SUM(stock_quantity), 0) as total
  FROM product_variants
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND p.stock_quantity != sub.total;
```

### 4. Remover sincronizacoes manuais redundantes

Com o trigger automatico, os trechos de codigo que manualmente recalculam `products.stock_quantity` a partir das variantes se tornam redundantes. Simplificar:

- `**Sales.tsx**` (linhas 700-712): Remover o bloco de recalculo manual -- o trigger cuida disso
- `**VoiceStockDialog.tsx**` (linhas 530-540): Remover recalculo manual
- `**StockImportDialog.tsx**` (linhas 1141-1155): Remover recalculo manual
- `**approve_stock_request**` (funcao SQL): Remover o `UPDATE products SET stock_quantity` -- o trigger cuida disso

A funcao `ProductFormDialog.tsx` continuara setando `stock_quantity: totalStock` no INSERT/UPDATE do produto, o que e correto para edicao manual.

---

## Arquivos alterados

1. **Nova migracao SQL** -- Trigger `sync_product_stock_from_variants` + correcao de dados existentes
2. `**src/pages/Sales.tsx**` -- Remover subtracao dupla e recalculo manual
3. `**src/components/stock/VoiceStockDialog.tsx**` -- Remover recalculo manual
4. `**src/components/stock/StockImportDialog.tsx**` -- Remover recalculo manual

## Impacto

- Corrige o bug imediato do usuario [teamwodbrasil@gmail.com e previne que não aconteça em qualquer usuário](mailto:teamwodbrasil@gmail.com)
- Previne qualquer dessincronizacao futura com o trigger automatico
- Simplifica o codigo removendo logica duplicada