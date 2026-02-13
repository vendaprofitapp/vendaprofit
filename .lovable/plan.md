
# Vendas a Prazo: Status "Pendente" ate Confirmacao do Pagamento

## Problema

Quando uma venda e feita com forma de pagamento "a prazo" (como PIX a Prazo), o sistema:
- Retira o produto do estoque (correto)
- Marca a venda como "concluida" imediatamente (errado)
- A venda aparece nos relatorios como receita concluida (errado)

## Comportamento Desejado

1. O produto sai do estoque imediatamente (ja funciona)
2. A venda e criada com status **"pending"** (pendente) em vez de "completed"
3. A venda so aparece nos relatorios de vendas concluidas apos a vendedora confirmar o recebimento
4. Quando a vendedora marca o pagamento como "recebido" nos lembretes de pagamento, o status da venda muda automaticamente para "completed"

## Mudancas Necessarias

### 1. `src/pages/Sales.tsx` - Criacao da venda
- Na mutacao `createSaleMutation` (linha 562-576), alterar o `status` de `"completed"` para `"pending"` quando o metodo de pagamento for `is_deferred`.
- Logica: `status: isDeferred ? "pending" : "completed"`

### 2. `src/components/settings/PaymentRemindersSection.tsx` - Marcar como recebido
- Na mutacao `markAsPaidMutation` (linha 49-56), alem de marcar o lembrete como pago, tambem atualizar o status da venda associada para `"completed"`.
- Apos o `update` do `payment_reminders`, fazer um `update` na tabela `sales` onde `id = sale_id`, mudando `status` para `"completed"`.
- Invalidar tambem as queries de `sales`, `financial-splits` e `reports` para que os relatorios reflitam a mudanca.

### 3. Nenhuma mudanca nos relatorios
- Os relatorios (`Reports.tsx` e `AccountSettlement.tsx`) ja filtram por `status = "completed"`, entao automaticamente vao excluir vendas pendentes. Nenhuma alteracao necessaria nesses arquivos.

### 4. Experiencia visual na pagina de Vendas
- As vendas "pending" ja possuem um badge "Pendente" na listagem (ja existe no codigo). A vendedora consegue visualizar que a venda esta aguardando pagamento.

## Resumo do fluxo

```text
Venda a Prazo criada
  |
  v
status = "pending" + estoque reduzido + lembrete criado
  |
  v
Vendedora recebe o pagamento na data combinada
  |
  v
Marca como "recebido" nos Lembretes de Pagamento
  |
  v
Sistema atualiza: lembrete is_paid=true + venda status="completed"
  |
  v
Venda aparece nos relatorios como concluida
```

## Detalhes tecnicos

**Sales.tsx** - Linha 575:
- De: `status: "completed"`
- Para: `status: isDeferred ? "pending" : "completed"`

**PaymentRemindersSection.tsx** - Mutacao markAsPaid (linha 50-56):
- Adicionar: buscar o `sale_id` do lembrete e atualizar `sales.status` para `"completed"`
- Invalidar queries: `["sales"]`, `["financial-splits"]`, `["payment-reminders"]`
