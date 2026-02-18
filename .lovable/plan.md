
# Correção: Produtos não aparecem no Link QR do Ponto Parceiro

## Causa Raiz

O catálogo do Ponto Parceiro (`/p/:token`) busca produtos em dois passos:

1. Busca os `partner_point_items` com `status = "allocated"` — **funciona** (policy pública existe)
2. Busca os dados dos produtos pelos IDs encontrados — **falha silenciosamente**

Na etapa 2, o código usa um cliente anônimo (sem login). As policies públicas de leitura da tabela `products` exigem que a loja tenha um registro em `store_settings` com `is_active = true`. Se esse registro não existir ainda, **todos os produtos ficam invisíveis** para o catálogo do parceiro — mesmo com o item alocado.

Adicionalmente, uma das policies exige `stock_quantity > 0`, o que pode bloquear produtos zerados futuramente.

## Solução

Adicionar uma policy RLS específica para o caso de uso do Ponto Parceiro:

> "Um produto pode ser lido anonimamente se existir um `partner_point_items` com `status = 'allocated'` referenciando esse produto."

Isso é cirúrgico: não abre o acesso geral da tabela `products`, apenas permite leitura do produto quando ele foi explicitamente colocado numa arara de parceiro.

## Migração SQL

```sql
CREATE POLICY "Public can read products allocated to partner points"
ON products
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM partner_point_items ppi
    WHERE ppi.product_id = products.id
      AND ppi.status = 'allocated'
  )
);
```

Esta policy é segura porque:
- Não exige autenticação (necessário pois o catálogo é público via QR Code)
- Só expõe produtos que a vendedora explicitamente colocou na arara
- Não depende de `store_settings`, `stock_quantity` ou qualquer outro dado que possa estar ausente

## O que Muda

| Componente | Tipo | Detalhe |
|---|---|---|
| `products` (RLS) | Migração | Nova policy pública baseada em alocação em arara |

Nenhum arquivo de código precisa mudar — apenas a regra de acesso ao banco.
