# Correção: Bloqueio Total de Venda de Produtos de Parceiros sem Reserva

## Problema Identificado

Existem **duas brechas** no sistema que permitem vender produtos de parceiros sem passar pela Solicitação de Reserva:

1. **Brecha no Diálogo de Variantes (VariantSelectionDialog)**: Quando o usuário clica em um produto PRÓPRIO para selecionar tamanho, o sistema busca variantes de parceiros com o mesmo nome e as exibe junto com as próprias. Se o usuário seleciona uma variante de parceiro, ela é adicionada diretamente ao carrinho sem exigir reserva.
2. **Brecha na validação da venda (createSaleMutation)**: A verificação que deveria bloquear itens de parceiros no carrinho é fraca -- ela só bloqueia se o item não tem `ownerName`, mas itens vindos do VariantSelectionDialog sempre têm `ownerName`, passando pela validação.  
3. Na usuaria teamwodbrasil@gmail.com, aparece as divisões da parceria no momento da venda, mas na usuaria [isabellegalx1@gmail.com](mailto:isabellegalx1@gmail.com) não aparece, como se ela não estivesse em uam parceria, mas consta a parceria no cadastro dela.

## Solução

### 1. Remover variantes de parceiros do VariantSelectionDialog

O diálogo de seleção de variantes (tamanhos) só deve exibir variantes do estoque próprio do usuário. A lógica de buscar variantes de parceiros (linhas 96-155 do componente) será removida, já que o fluxo correto para produtos de parceiros é sempre via Solicitação de Reserva.

### 2. Fortalecer a validação no createSaleMutation

A verificação no momento de finalizar a venda será reforçada: qualquer item marcado como `isPartnerStock: true` será bloqueado, A MENOS que tenha sido adicionado via o fluxo de reserva aprovada (detectado via `sessionStorage`).

### 3. Bloquear a função handleVariantConfirm

Adicionar uma verificação extra: se o `handleVariantConfirm` receber `isPartnerStock: true`, redirecionar automaticamente para o fluxo de Solicitação de Reserva em vez de adicionar ao carrinho.

---

## Detalhes Técnicos

### Arquivo: `src/components/sales/VariantSelectionDialog.tsx`

- Remover toda a lógica de busca de variantes de parceiros (o bloco que consulta `product_partnerships` e `product_variants` de parceiros)
- Manter apenas a busca de variantes do produto selecionado (próprias)
- Remover as props `userGroups`, `profiles`, `userId` que serviam apenas para esta funcionalidade

### Arquivo: `src/pages/Sales.tsx`

- **handleVariantConfirm** (linha 983): Adicionar guarda que bloqueia qualquer tentativa de adicionar `isPartnerStock: true` e redireciona para reserva
- **createSaleMutation** (linha 500-508): Substituir a verificação fraca por uma mais rigorosa -- bloquear QUALQUER item com `isPartnerStock: true` que não veio do fluxo de reserva aprovada (verificar via flag no CartItem)
- **CartItem interface**: Adicionar campo `fromApprovedRequest: boolean` para marcar itens que vieram de reservas aprovadas, tornando a validação inequívoca
- Atualizar o fluxo de `pendingSaleFromRequest` (sessionStorage) para marcar `fromApprovedRequest: true` nos itens adicionados  

  &nbsp;