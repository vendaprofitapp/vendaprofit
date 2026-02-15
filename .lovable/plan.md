
# Estoque Hibrido Automatico (Dropshipping B2B)

## Resumo

Sistema que prioriza o estoque fisico local, depois sociedades 1-1, depois parcerias, e por ultimo verifica disponibilidade no site B2B do fornecedor para venda sob encomenda. Produtos sem estoque em nenhuma fonte sao ocultados do catalogo.

---

## Passo 1: Migracoes de Banco de Dados

### 1a. Novos campos na tabela `suppliers`
- `b2b_url` (text, nullable) -- URL do portal B2B logado
- `b2b_login` (text, nullable) -- Usuario de login B2B
- `b2b_password` (text, nullable) -- Senha B2B
- `b2b_enabled` (boolean, default false) -- Toggle para ativar dropshipping deste fornecedor no catalogo

### 1b. Novo campo na tabela `products`
- `b2b_product_url` (text, nullable) -- URL direta do produto no portal B2B

### 1c. Novo campo na tabela `sale_items`
- `source` (text, nullable) -- Origem do item: 'local', 'partner', 'b2b'. Null = local
- `b2b_status` (text, nullable) -- Status do pedido B2B: 'pending', 'ordered', 'received'. Null = nao e B2B

### 1d. RLS
- Os novos campos seguem as mesmas politicas RLS existentes das tabelas `suppliers`, `products` e `sale_items`

---

## Passo 2: Interface de Fornecedores (Suppliers.tsx)

Expandir o formulario de fornecedores existente com:
- Secao "Dados B2B / Dropshipping" (colapsavel ou separada)
- Campo "URL do Portal B2B"
- Campo "Usuario B2B"
- Campo "Senha B2B"
- Na listagem, adicionar coluna com Switch (Toggle) para `b2b_enabled`, atualizando em tempo real

Impacto: `src/pages/Suppliers.tsx`, `src/components/stock/SupplierSelect.tsx` (atualizar interface)

---

## Passo 3: Cadastro de Produtos (ProductFormDialog.tsx)

Adicionar campo "URL do Produto B2B" no formulario de produto, abaixo do seletor de fornecedor.
- Campo de texto com placeholder "https://portal.fornecedor.com/produto/123"
- Visivel apenas quando um fornecedor esta selecionado

Impacto: `src/components/stock/ProductFormDialog.tsx`

---

## Passo 4: Edge Function `check-b2b-stock`

Nova Edge Function que:
1. Recebe `product_id` e busca o `b2b_product_url` do produto e as credenciais do fornecedor
2. Usa Firecrawl (ja configurado no projeto) para acessar a URL do produto B2B
3. Analisa o HTML retornado para detectar se o produto esta disponivel (botao de compra ativo, badges de "esgotado", etc.)
4. Retorna `{ available: boolean }`

Nota: A checagem via login automatizado e complexa e fragil. A abordagem pragmatica inicial sera:
- Para fornecedores com paginas B2B publicas: scraping direto via Firecrawl
- Para portais que exigem login: marcar como "disponivel" por padrao (confiando no toggle manual do admin) e adicionar verificacao manual futura
- O admin pode desligar o toggle do fornecedor a qualquer momento se souber que o estoque acabou

Impacto: `supabase/functions/check-b2b-stock/index.ts`, `supabase/config.toml`

---

## Passo 5: Logica de Exibicao no Catalogo (StoreCatalog.tsx)

Atualizar a logica de filtragem de produtos para seguir a cascata:

```text
Prioridade 1: stock_quantity > 0 (estoque local) -> exibe normalmente
Prioridade 2: Estoque Sociedade 1-1 > 0 -> exibe com regras existentes
Prioridade 3: Estoque Parcerias > 0 -> exibe com regras existentes
Prioridade 4: b2b_product_url preenchida + fornecedor b2b_enabled -> chama check-b2b-stock
  -> Se disponivel: exibe com badge "Sob Encomenda" e icone de aviso
  -> Se nao: oculta produto
```

A checagem B2B sera feita de forma lazy (sob demanda) com cache local para evitar chamadas excessivas.

Impacto: `src/pages/StoreCatalog.tsx`

---

## Passo 6: Fluxo de Pedidos B2B

### 6a. Marcar itens B2B na venda
Quando uma venda inclui um produto cuja origem foi dropshipping (estoque local = 0, veio do B2B), o `sale_items.source` e marcado como `'b2b'` e `b2b_status` como `'pending'`.

Impacto: `src/pages/Sales.tsx` (logica de criacao de venda)

### 6b. Tela "Pedidos B2B"
Nova pagina/aba no admin que lista todos os `sale_items` com `source = 'b2b'`.
- Mostra: produto, cliente, data da venda, status B2B
- Botao "Comprar no Fornecedor" que abre `b2b_product_url` em nova aba
- Botao para marcar como "Comprado" (`b2b_status = 'ordered'`) e "Recebido" (`b2b_status = 'received'`)

Impacto: Nova pagina `src/pages/B2BOrders.tsx`, rota em `App.tsx`, link no `Sidebar.tsx`

---

## Arquivos a Modificar/Criar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Adicionar colunas em suppliers, products, sale_items |
| `src/pages/Suppliers.tsx` | Campos B2B + toggle na listagem |
| `src/components/stock/ProductFormDialog.tsx` | Campo URL B2B |
| `supabase/functions/check-b2b-stock/index.ts` | Nova Edge Function |
| `supabase/config.toml` | Registro da nova funcao |
| `src/pages/StoreCatalog.tsx` | Logica de cascata + badge "Sob Encomenda" |
| `src/pages/Sales.tsx` | Marcar source/b2b_status nos itens |
| `src/pages/B2BOrders.tsx` | Nova pagina de pedidos B2B |
| `src/App.tsx` | Nova rota /b2b-orders |
| `src/components/layout/Sidebar.tsx` | Link "Pedidos B2B" |
| `src/components/layout/MainLayout.tsx` | Titulo da pagina |

---

## Consideracoes Tecnicas

- **Seguranca**: Credenciais B2B (usuario/senha) ficam no banco com RLS, acessiveis apenas pelo owner. A Edge Function busca via service role key.
- **Performance**: Checagem B2B e feita com cache de 5 minutos no frontend para evitar chamadas excessivas ao Firecrawl.
- **Limitacao honesta**: Login automatizado em portais B2B e fragil e depende de cada fornecedor. A primeira versao usa scraping de paginas publicas + toggle manual como fallback.
