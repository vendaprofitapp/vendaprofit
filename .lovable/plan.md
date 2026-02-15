
# Correcao: Atualizar Status da Solicitacao apos Venda Concretizada

## Problema Identificado

Quando uma reserva aprovada e convertida em venda pela pagina de Vendas, o status do `stock_request` permanece como "approved" para sempre. O `requestId` e armazenado no `sessionStorage` junto com os dados do produto, mas **nunca e utilizado** apos a venda ser criada para atualizar o registro na tabela `stock_requests`.

## Solucao

### 1. Novo status "completed" na tabela `stock_requests`

Adicionar o status "completed" como estado final para solicitacoes que se tornaram vendas.

### 2. Modificar `src/pages/Sales.tsx`

- Ao ler os dados do `sessionStorage` (linha ~1253), preservar o `requestId` em um estado local (ex: `pendingRequestId`)
- Apos a venda ser criada com sucesso na mutacao `createSaleMutation` (apos linha ~708), verificar se existe um `pendingRequestId` e atualizar o `stock_request` correspondente para status "completed"

### 3. Modificar `src/pages/StockRequests.tsx`

- Adicionar "completed" ao tipo `StockRequest.status`
- Adicionar "completed" ao `statusConfig` com label "Concluida", variante "default" e icone `CheckCircle`
- Nao mostrar botoes "Vender Agora" / "WhatsApp" para solicitacoes com status "completed"

### 4. Correcao retroativa dos dados existentes

Usar uma query para marcar como "completed" as solicitacoes da usuaria `teamwodbrasil@gmail.com` que ja foram convertidas em vendas (os 3 registros com status "approved" que ja viraram vendas).

## Arquivos a modificar

1. **`src/pages/Sales.tsx`** -- Adicionar estado `pendingRequestId`, salvar o ID ao ler sessionStorage, e atualizar o status apos venda criada
2. **`src/pages/StockRequests.tsx`** -- Adicionar status "completed" ao tipo e ao mapa de configuracao visual
3. **`src/components/dashboard/SystemAlerts.tsx`** -- Verificar se o alerta de solicitacoes pendentes desconsidera as "completed" (provavelmente ja funciona, pois filtra por "pending")

## Detalhes tecnicos

### Estado no Sales.tsx

```text
const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

// No useEffect do sessionStorage:
setPendingRequestId(saleData.requestId || null);

// No onSuccess da createSaleMutation:
if (pendingRequestId) {
  await supabase
    .from("stock_requests")
    .update({ status: "completed" })
    .eq("id", pendingRequestId);
  setPendingRequestId(null);
}
```

### statusConfig atualizado no StockRequests.tsx

```text
completed: { label: "Concluída", variant: "default" as const, icon: CheckCircle }
```

### Correcao retroativa

Atualizar os 3 registros aprovados da usuaria teamwodbrasil (requester_id = 98191e2a-0eb6-4c35-aa19-2f7e1a258a95) que ja foram vendidos para status "completed".
