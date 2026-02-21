# Nova Aba: Pedidos do Catalogo

## Objetivo

Criar uma nova pagina dedicada para exibir todas as acoes realizadas na pagina de vendas (catalogo), com detalhamento completo de pedidos gerados e carrinhos abandonados. O link ficara no sidebar logo abaixo de "Minha Loja".

## Estrutura da Pagina

A pagina tera duas abas (Tabs):

### Aba 1 - Pedidos Recebidos

Consulta a tabela `saved_carts` (status `waiting`) com os itens de `saved_cart_items`:

- Codigo do pedido (short_code)
- Nome do cliente e telefone
- Data/hora do pedido
- Valor total
- Lista detalhada de itens: nome do produto, cor, tamanho, quantidade, preco unitario, origem (estoque/sob encomenda)
- Botao para abrir WhatsApp do cliente
- Badge de status (Aguardando / Convertido)

### Aba 2 - Carrinhos Abandonados

Consulta a tabela `lead_cart_items` (status `abandoned`) com dados do lead via `store_leads`:

- Nome e WhatsApp do cliente
- Data em que o carrinho foi criado
- Lista de produtos abandonados: nome, cor, tamanho, quantidade, preco
- Botao para contatar via WhatsApp
- Botao para marcar como "contatado"

## Alteracoes por Arquivo


| Arquivo                             | Alteracao                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/pages/CatalogOrders.tsx`       | **Novo arquivo** - Pagina completa com duas abas (Pedidos e Abandonados)                         |
| `src/components/layout/Sidebar.tsx` | Adicionar link "Pedidos do Catalogo" com icone `ShoppingCart` logo apos o botao "Ver Minha Loja" |
| `src/App.tsx`                       | Registrar rota `/catalog-orders` como rota protegida                                             |


## Detalhes Tecnicos

### Pagina `CatalogOrders.tsx`

- Usa `useQuery` para buscar dados com polling a cada 30s
- Pedidos: `saved_carts` com join em `saved_cart_items`, ordenados por data desc
- Abandonados: `lead_cart_items` com join em `store_leads`, status `abandoned`, ordenados por data desc
- Cards expansiveis mostrando os itens detalhados de cada pedido/carrinho
- Formatacao de preco em BRL e datas com `date-fns`
- Filtro por periodo (hoje, 7 dias, 30 dias)

### Sidebar

- O item sera adicionado logo abaixo do botao dourado "Ver Minha Loja", fora dos grupos, com destaque visual sutil
- Icone: `ShoppingCart`
- Texto: "Pedidos da Loja"
- Rota: `/catalog-orders`