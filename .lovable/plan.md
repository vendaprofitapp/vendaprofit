
## Persistir estado em TODAS as telas ao trocar de aba do navegador

### O que ja foi feito

Na implementacao anterior, o hook `useFormPersistence` foi criado e aplicado em algumas telas. Porem, dois problemas principais permanecem:

1. **Vendas**: os dados do carrinho sao salvos, mas o dialogo fecha ao recarregar (a usuaria nao ve os dados salvos)
2. **Outras telas**: abas ativas e buscas em varias paginas ainda usam `useState` comum e sao perdidos

### Correcoes necessarias

#### 1. Sales (`src/pages/Sales.tsx`)

- **`shippingData`**: trocar `useState` por `useFormPersistence("sales_shippingData", {...})` 
- **Auto-reabrir formulario**: adicionar `useEffect` que detecta se `cart.length > 0` na montagem e chama `setIsNewSaleOpen(true)` automaticamente — assim a usuaria volta e ve o formulario aberto com tudo preenchido
- Adicionar `clearShippingData()` no `resetForm`

#### 2. Orders (`src/pages/Orders.tsx`)

- **`activeTab`**: trocar `useState("orders")` por `useFormPersistence("orders_activeTab", "orders")`

#### 3. Marketing (`src/pages/Marketing.tsx`)

- **`activeTab`**: trocar `useState("content")` por `useFormPersistence("marketing_activeTab", "content")`

#### 4. Suppliers (`src/pages/Suppliers.tsx`)

- Verificar se ha campo de busca com `useState` e persistir se houver

#### 5. Consignments, Consortiums

- Essas paginas usam `useState` apenas para dialogs abertos e selecoes temporarias — nao precisam de persistencia (o padrao e nao persistir modais)

### Resumo de arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/Sales.tsx` | Persistir `shippingData`; adicionar `useEffect` para reabrir formulario se carrinho tiver itens; limpar `shippingData` no `resetForm` |
| `src/pages/Orders.tsx` | Persistir `activeTab` com `useFormPersistence` |
| `src/pages/Marketing.tsx` | Persistir `activeTab` com `useFormPersistence` |

### O que NAO precisa mudar (ja esta correto)

- `Reports.tsx` — todos os filtros e aba ja usam `useFormPersistence`
- `PartnerReports.tsx` — periodo, grupo, parceira e aba ja usam `useFormPersistence`
- `Financial.tsx` — periodo ja usa `useFormPersistence`
- `Customers.tsx` — busca ja usa `useFormPersistence`
- `StockControl.tsx` — busca e filtros ja usam `useFormPersistence`
- `OrderForm.tsx` — formData e searchValue ja usam `useFormPersistence`

### Comportamento esperado apos a correcao

A usuaria esta no meio de uma venda, troca de aba no navegador (ou abre outro app no celular). Ao voltar:

1. O formulario de venda reabre automaticamente (porque o carrinho tem itens)
2. Carrinho, cliente, pagamento, frete — tudo esta preenchido como antes
3. Ela continua de onde parou sem perder nenhum dado

O mesmo vale para abas ativas em Encomendas e Marketing — a usuaria volta para a mesma aba que estava vendo.
