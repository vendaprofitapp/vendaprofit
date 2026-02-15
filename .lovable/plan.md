# Corrigir Badge B2B no Resumo de Venda + Programa de Fidelidade Completo

## Parte 1 — Badge "Próprio" no resumo de venda para produtos B2B

### Problema

No card "Divisão de Lucros" (ProfitBreakdownCard), o badge ao lado de cada produto mostra "Próprio" para produtos B2B. Isso acontece porque o profit engine classifica produtos B2B como cenário `OWN_STOCK` (já que o clone pertence ao usuário). A badge não considera a flag `isB2B`.

### Solução

Alterar o `ProfitBreakdownCard` para verificar se o item do carrinho é B2B (`item.product.isB2B` ou `item.product.b2b_source_product_id`) e exibir "Sob Encomenda" ao invés de "Próprio" nesses casos.

### Arquivo: `src/components/sales/ProfitBreakdownCard.tsx`

- Passar a informação `isB2B` nos `details` do aggregatedSplits
- Na renderização do badge (linha ~288), verificar `isB2B` antes de chamar `getScenarioShortLabel`
- Se `isB2B === true` e scenario é `OWN_STOCK`, exibir "Sob Encomenda" com cor diferenciada (amarelo/laranja)

### Arquivo: `src/pages/Sales.tsx` (cart display, linha ~2089)

- Adicionar badge de origem para itens B2B no resumo do carrinho (similar ao que já existe para parceiros)
- Exibir "Origem: Sob Encomenda (B2B)" quando `item.product.isB2B || item.product.b2b_source_product_id`

---

## Parte 2 — Programa de Fidelidade Completo

### 2a. Atualizar funcionalidades disponíveis

O array `AVAILABLE_FEATURES` em `LoyaltyAdmin.tsx` será expandido:


| Chave           | Label                         |
| --------------- | ----------------------------- |
| `fidelidade`    | Entrar no Programa Fidelidade |
| `area_secreta`  | Acessar Área Secreta          |
| `bazar_comprar` | Comprar produtos no Bazar VIP |
| `bazar_vender`  | Vender produtos no Bazar VIP  |


As chaves antigas (`bazar_vip`, `chat`, `provador_ia`) serão substituídas.

### 2b. Criar níveis iniciais automaticamente

Alterar a lógica de auto-criação em `fetchLevels` para inserir 5 níveis quando nenhum existir:


| Nome    | Gasto Mínimo | Cor     | Funcionalidades                                       |
| ------- | ------------ | ------- | ----------------------------------------------------- |
| Inicial | R$ 0,00      | #9CA3AF | &nbsp;                                                |
| Prata   | R$ 500,00    | #A0AEC0 | fidelidade                                            |
| Ouro    | R$ 1.000,00  | #D69E2E | fidelidade, area_secreta                              |
| Gold    | R$ 2.000,00  | #B7791F | fidelidade, area_secreta, bazar_comprar               |
| VIP     | R$ 4.000,00  | #8B5CF6 | fidelidade, area_secreta, bazar_comprar, bazar_vender |


Os níveis existentes (2 "Inicial" duplicados) serão limpos via SQL antes da inserção dos novos.

### 2c. Lógica automática de controle por cliente

O sistema já possui:

- Coluna `total_spent` na tabela `customers` (atualizada por trigger ao criar vendas)
- Função RPC `get_catalog_customer_loyalty` que calcula o nível baseado no gasto

O que falta verificar/ajustar:

- Garantir que o trigger de atualização de `total_spent` está funcionando ao criar vendas
- Atualizar o `VipAreaDrawer` e `StoreCatalog` para usar as novas chaves de features (fidelidade,`area_secreta`, `bazar_comprar`, `bazar_vender`)

### 2d. Atualizar VipAreaDrawer

O `FEATURE_MAP` no `VipAreaDrawer.tsx` será atualizado para refletir as novas funcionalidades:

- `fidelidade` -> Programa Fidelidade (icon: Award)
- `area_secreta` -> Área Secreta (icon: Lock)
- `bazar_comprar` -> Comprar no Bazar VIP (icon: Store)
- `bazar_vender` -> Vender no Bazar VIP (icon: ShoppingBag)

---

## Resumo dos arquivos modificados


| Arquivo                                        | Alteração                                                  |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `src/components/sales/ProfitBreakdownCard.tsx` | Badge "Sob Encomenda" para itens B2B ao invés de "Próprio" |
| `src/pages/Sales.tsx`                          | Badge de origem B2B no resumo do carrinho                  |
| `src/pages/LoyaltyAdmin.tsx`                   | Novas funcionalidades + auto-criação de 5 níveis           |
| `src/components/catalog/VipAreaDrawer.tsx`     | Atualizar FEATURE_MAP com novas chaves                     |
| Limpeza de dados                               | Remover níveis duplicados existentes                       |
