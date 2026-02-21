
# Fluxo "Concluir Venda" da Bolsa Consignada para Registro de Venda

## Resumo

Ao clicar em "Concluir Venda" no dialog de detalhes da Bolsa Consignada, o sistema navegara para a tela de Vendas (`/sales`) com os itens marcados como "Vai Ficar" ja inseridos no carrinho e os dados do cliente preenchidos automaticamente.

## Como Funciona

1. O usuario abre o detalhe de uma malinha com status "finalized_by_client"
2. Ao clicar em "Concluir Venda", o sistema coleta os itens com status "kept" (Vai Ficar) e os dados do cliente
3. Navega para `/sales` passando esses dados via `navigate` state do React Router
4. A pagina de Vendas detecta os dados, abre o dialog de Nova Venda e preenche automaticamente o carrinho e os campos do cliente

## Arquivos a Alterar

### 1. `src/components/consignment/ConsignmentDetailsDialog.tsx`
- Importar `useNavigate` do react-router-dom
- Alterar `handleComplete` para, em vez de apenas marcar como concluido, navegar para `/sales` com os dados dos itens "kept" e do cliente via `navigate("/sales", { state: { consignmentData: {...} } })`
- Os dados passados incluem: `consignmentId`, `customerName`, `customerPhone`, lista de itens (product_id, name, price, quantity, variant info)

### 2. `src/pages/Sales.tsx`
- Importar `useLocation` do react-router-dom
- Ler `location.state?.consignmentData` ao carregar a pagina
- Se presente, abrir `isNewSaleOpen` e passar os dados como nova prop `consignmentItems` para o `NewSaleDialog`
- Limpar o state apos consumir (usando `navigate` replace)

### 3. `src/components/sales/NewSaleDialog.tsx`
- Adicionar nova prop opcional `consignmentItems` com os dados do cliente e itens
- No `useEffect` de inicializacao, se `consignmentItems` estiver presente:
  - Buscar os produtos correspondentes do banco por `product_id`
  - Montar os `CartItem[]` com os dados corretos
  - Preencher `customerName` e `customerPhone`
  - Preencher `notes` com referencia a consignacao
- Adicionar prop `onConsignmentProcessed` para limpar os dados apos uso

## Detalhes Tecnicos

### Estrutura dos dados passados via navigate state

```text
consignmentData: {
  consignmentId: string
  customerName: string
  customerPhone: string
  items: Array<{
    product_id: string
    product_name: string
    price: number
    size: string | null
    color: string | null
    variant_id: string | null
  }>
}
```

### Fluxo no NewSaleDialog

O `useEffect` detectara a prop `consignmentItems`, fara um `SELECT` nos `products` pelos IDs para obter os dados completos (stock_quantity, cost_price, etc.) necessarios para montar o `CartItem`, e preenchera o carrinho. Isso garante compatibilidade com toda a logica existente de calculo de subtotal, profit engine e splits financeiros.

### Marcacao da consignacao como concluida

A consignacao so sera marcada como "completed" APOS a venda ser registrada com sucesso. Para isso, o `consignmentId` sera incluido nos dados e, ao finalizar a venda, o sistema chamara `completeConsignment(consignmentId)`. Isso evita marcar como concluido antes do pagamento ser registrado.
