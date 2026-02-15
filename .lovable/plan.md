
# Correcao: Vendas de Parceiras Nao Aparecem nos Relatorios

## Problema Identificado

A tabela `sales` possui uma politica RLS que so permite ver vendas onde `owner_id = auth.uid()`. Isso impede que o usuario veja vendas feitas por suas parceiras (onde a parceira e o `owner_id`).

No codigo do relatorio (linha 368), existe a logica para processar vendas feitas por outros:
```text
if (sale.owner_id !== user.id && myTotalInSale > 0) { ... }
```
Porem essa condicao nunca e verdadeira porque essas vendas simplesmente nao sao retornadas pelo banco de dados.

A tabela `financial_splits` tem uma policy que permite ver splits onde `user_id = auth.uid()`, mas sem acesso as vendas correspondentes, o relatorio nao consegue cruzar os dados.

## Solucao

Adicionar uma nova politica RLS na tabela `sales` que permita que parceiros (membros do mesmo grupo) vejam as vendas uns dos outros. Isso e necessario para que o relatorio de acerto de contas funcione corretamente.

### 1. Nova RLS Policy na tabela `sales`

Adicionar uma policy SELECT que permite ver vendas de outros membros do mesmo grupo:

```text
CREATE POLICY "Partners can view sales from same group"
  ON public.sales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = sales.owner_id
        AND gm1.user_id != gm2.user_id
    )
  );
```

Isso permite que se voce e sua parceira estao no mesmo grupo/parceria, voce pode ver as vendas dela e ela pode ver as suas.

### 2. Nenhuma alteracao no frontend

O codigo do relatorio ja possui a logica correta para processar vendas de parceiras (linhas 367-387). O problema e exclusivamente de acesso aos dados no banco. Com a nova policy, os dados das vendas das parceiras serao retornados automaticamente e o relatorio passara a exibir:

- **"Vendas de Parceiras (Minhas Pecas)"**: vendas que a parceira fez com pecas da usuario logada
- **Saldo correto**: incluindo valores que as parceiras devem

## Arquivo a modificar

1. **Migracao SQL** -- Adicionar policy RLS na tabela `sales` para acesso entre parceiros do mesmo grupo

## Impacto de Seguranca

A policy e restrita: so permite visibilidade entre usuarios que fazem parte do mesmo grupo (vinculados pela tabela `group_members`). Nao expoe vendas para usuarios sem relacao de parceria.
