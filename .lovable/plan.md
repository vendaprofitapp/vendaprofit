

# Correção: "Peça Desconhecida" nas Solicitações de Reserva

## Problema

Quando um usuario faz uma solicitacao de reserva de um produto de uma parceira, a pagina de Solicitacoes de Reserva exibe "Produto desconhecido" no lugar do nome do produto.

**Causa raiz**: A pagina `StockRequests.tsx` busca os produtos separadamente (`SELECT id, name, price FROM products`) e depois tenta associar pelo `product_id`. Porem, as politicas de seguranca (RLS) da tabela `products` so permitem que o usuario veja seus proprios produtos. Quando a solicitante tenta visualizar a solicitacao, o produto pertence a parceira e nao aparece na consulta -- resultando no fallback "Produto desconhecido".

## Solucao

Armazenar o nome e preco do produto diretamente na tabela `stock_requests` no momento da criacao (dado desnormalizado). Isso elimina a dependencia de consultar a tabela `products` para exibir informacoes basicas.

### 1. Migracao SQL

Adicionar duas colunas na tabela `stock_requests`:

- `product_name` (text, nullable inicialmente para nao quebrar registros existentes)
- `product_price` (numeric, nullable)

Depois, preencher os registros existentes com os dados dos produtos atuais.

### 2. Atualizar pontos de criacao de solicitacoes

Existem dois locais onde solicitacoes sao criadas:

- **`src/pages/StockControl.tsx`** (~linha 363): Adicionar `product_name` e `product_price` no INSERT
- **`src/pages/Sales.tsx`** (~linha 489): Adicionar `product_name` e `product_price` no INSERT

### 3. Atualizar exibicao em `StockRequests.tsx`

- Remover a query separada de `products` (linhas 114-124)
- Usar `req.product_name` e `req.product_price` diretamente dos dados da solicitacao
- Manter o fallback "Produto desconhecido" apenas como seguranca para registros muito antigos

### 4. Atualizar exibicao em `SystemAlerts.tsx`

- Usar `product_name` do registro de `stock_requests` ao inves de fazer join com `products`

---

## Detalhes tecnicos

### Colunas novas na tabela `stock_requests`

| Coluna | Tipo | Default |
|--------|------|---------|
| product_name | text | null |
| product_price | numeric | null |

### Migracao para dados existentes

```text
UPDATE stock_requests sr
SET product_name = p.name, product_price = p.price
FROM products p
WHERE sr.product_id = p.id AND sr.product_name IS NULL;
```

### Arquivos alterados

1. **Nova migracao SQL** -- Adicionar colunas + preencher dados existentes
2. **`src/pages/StockRequests.tsx`** -- Usar product_name/product_price do registro
3. **`src/pages/StockControl.tsx`** -- Incluir product_name/product_price no INSERT
4. **`src/pages/Sales.tsx`** -- Incluir product_name/product_price no INSERT
5. **`src/components/dashboard/SystemAlerts.tsx`** -- Usar product_name do registro

