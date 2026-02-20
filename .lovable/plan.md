
## Persistência de Formulários ao Trocar de Aba do Navegador

### Causa do problema

Ao trocar para outra aba do Chrome ou Safari e voltar, alguns navegadores (especialmente Safari no iOS/macOS) **descarregam a aba da memória** para economizar recursos. Quando a usuária retorna, a página é recarregada do zero — e todo estado em `useState` é perdido.

A solução é salvar os dados no `sessionStorage` do navegador. Ele persiste durante toda a sessão da aba (incluindo recarregamentos), e é limpo automaticamente quando a aba é fechada — sem acumular dados velhos.

### Estratégia: hook `useFormPersistence`

Será criado um único hook reutilizável que qualquer formulário pode usar com uma linha de código, substituindo `useState` por uma versão que salva automaticamente no `sessionStorage`.

```
useState("") → useFormPersistence("chave_unica", "")
```

O hook:
- Lê o valor inicial do `sessionStorage` (se houver) ou usa o padrão
- Salva automaticamente toda vez que o valor muda
- Retorna uma função `clearPersistence()` para limpar após o envio bem-sucedido

### Formulários que serão persistidos

| Página | Campos salvos |
|---|---|
| **Vendas** (`/sales`) | Carrinho completo, nome e telefone do cliente, Instagram, método de pagamento, tipo/valor de desconto, observações, parcelas, data de vencimento |
| **Encomendas** (`/orders`) | Produto selecionado, fornecedor, nome do cliente, quantidade, observações |
| **Relatórios** (`/reports`) | Período selecionado, filtros de pagamento, estoque, parceira, categoria, cor, desconto, aba ativa |
| **Relatórios de Socias** (`/partner-reports`) | Período, grupo selecionado, parceira selecionada, aba ativa |
| **Financeiro** (`/financial`) | Período selecionado |
| **Clientes** (`/customers`) | Termo de busca |
| **Estoque** (`/stock`) | Termo de busca, todos os filtros aplicados |

### O que NÃO será persistido (intencional)

- Modais e dialogs abertos — sempre iniciam fechados
- Produto em edição — estado temporário de diálogos
- Dados retornados pelo banco — já cacheados pelo React Query

### Chaves únicas no sessionStorage

Cada campo usa uma chave com namespace para evitar conflitos:

```
sales_cart, sales_customerName, sales_customerPhone, sales_instagram,
sales_paymentMethodId, sales_discountType, sales_discountValue,
sales_notes, sales_installments, sales_dueDate

orders_formData, orders_searchValue, orders_selectedProduct

reports_period, reports_activeTab, reports_paymentFilter,
reports_stockFilter, reports_partnerFilter, reports_categoryFilter,
reports_colorFilter, reports_discountFilter

partnerReports_period, partnerReports_groupId,
partnerReports_partnerId, partnerReports_activeTab

financial_period

customers_searchTerm

stock_searchTerm, stock_filters
```

### Limpeza após submissão

Após cada envio bem-sucedido, as chaves são removidas do `sessionStorage` para que o formulário comece limpo na próxima vez:

- Vendas: após `createSaleMutation.onSuccess`
- Encomendas: após `createOrder.mutateAsync` no `handleSubmit`
- Filtros/buscas: nunca limpam (é desejável que filtros sejam lembrados)

### Arquivos criados/modificados

| Arquivo | Ação |
|---|---|
| `src/hooks/useFormPersistence.ts` | Criar hook reutilizável |
| `src/pages/Sales.tsx` | Substituir `useState` por `useFormPersistence` nos campos do formulário de venda |
| `src/components/orders/OrderForm.tsx` | Persistir `formData` e `searchValue` |
| `src/pages/Reports.tsx` | Persistir período, filtros e aba ativa |
| `src/pages/PartnerReports.tsx` | Persistir período, grupo, parceira e aba |
| `src/pages/Financial.tsx` | Persistir período selecionado |
| `src/pages/Customers.tsx` | Persistir `searchTerm` |
| `src/pages/StockControl.tsx` | Persistir `searchTerm` e `filters` |
