
# Correcao: Ganhos da Parceira Zerados nos Relatorios

## Problema

A tabela `financial_splits` possui duas politicas RLS de SELECT:
1. "Users can view splits for their sales" -- onde `sales.owner_id = auth.uid()`
2. "Users can view their own financial splits" -- onde `user_id = auth.uid()`

Quando Isabelle vende pecas de Camila, Camila consegue ver a venda (politica adicionada anteriormente) e seus proprios splits, mas NAO consegue ver os splits de Isabelle naquela venda. Por isso, o codigo na linha 370 que calcula `sellerTotalInSale` filtrando por `s.user_id === sale.owner_id` retorna 0.

## Solucao

Adicionar uma nova politica RLS na tabela `financial_splits` que permita parceiros do mesmo grupo verem os splits de vendas compartilhadas. Isso e analogo as politicas ja adicionadas em `sales` e `sale_items`.

### Migracao SQL

Nova policy SELECT em `financial_splits`:

```text
CREATE POLICY "Partners can view splits from same group sales"
  ON public.financial_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      JOIN group_members gm1 ON gm1.user_id = auth.uid()
      JOIN group_members gm2 ON gm2.group_id = gm1.group_id AND gm2.user_id = s.owner_id
      WHERE s.id = financial_splits.sale_id
        AND gm1.user_id != gm2.user_id
    )
  );
```

### Nenhuma alteracao no frontend

O codigo do relatorio ja possui a logica correta para calcular os ganhos da parceira (linha 370 de PartnerReports.tsx). O problema e exclusivamente de visibilidade dos dados no banco.

## Arquivo a modificar

1. **Migracao SQL** -- Adicionar policy RLS na tabela `financial_splits`

## Impacto

Com esta policy, ao abrir o relatorio de parcerias, os splits de Isabelle nas vendas dela serao visiveis para Camila (e vice-versa), fazendo com que a coluna "Ganho de Isabelle Santos" exiba os valores corretos.
