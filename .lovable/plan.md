

# Substituir Pop-up de Checkout por Pagina Completa

## Problema
O pop-up (Dialog/Drawer) que aparece ao clicar "Finalizar pelo WhatsApp" causa erros em diversos celulares. A sobreposicao de modal sobre a Sheet do carrinho gera conflitos de z-index, scroll e teclado virtual.

## Solucao
Criar uma nova pagina dedicada de checkout (`/:slug/checkout`) que recebe os dados do carrinho via navigate state. Esta pagina mostra o resumo completo do pedido, coleta Nome/WhatsApp, e ao enviar:
1. Salva o carrinho no banco (saved_carts + saved_cart_items)
2. Cria um registro na tabela `sales` com `source = 'catalog'` (dispara automaticamente a notificacao BotConversa via trigger existente `botconversa_catalog_sale_trigger`)
3. Notifica a vendedora via dashboard/sininho (o sistema de notificacoes ja cobre vendas pelo catalogo via saved_carts)
4. Redireciona para o WhatsApp da vendedora com a mensagem do pedido

## Arquivos a Criar

### 1. `src/pages/CatalogCheckout.tsx`
Pagina publica de checkout com:
- Resumo do pedido: lista de itens com imagem, nome, cor, tamanho, quantidade, preco unitario e subtotal
- Total do pedido em destaque
- Formulario: campos Nome e WhatsApp (reaproveitando a validacao e formatacao do LeadCaptureSheet)
- Botao "Enviar Pedido" com cor primaria da loja
- Se o lead ja estiver salvo no localStorage, pre-preenche os campos
- Ao submeter:
  - Salva/reatualiza o lead no banco (store_leads)
  - Salva o carrinho (saved_carts + saved_cart_items) com status "waiting"
  - Insere um registro em `sales` com `source = 'catalog'` para disparar o trigger do BotConversa
  - Marca lead_cart_items como "converted"
  - Abre WhatsApp com a mensagem formatada
  - Mostra toast de sucesso e navega de volta para o catalogo

## Arquivos a Alterar

### 2. `src/App.tsx`
- Importar `CatalogCheckout`
- Adicionar rota `/:slug/checkout` ANTES da rota `/:slug`

### 3. `src/pages/StoreCatalog.tsx`
- Alterar `sendCartViaWhatsApp` para, em vez de fazer todo o processamento inline, navegar para `/${slug}/checkout` passando via state: `{ cart, store, cartTotal }`
- Remover a logica de lead capture do checkout (o LeadCaptureSheet continua existindo para captura ao adicionar itens)
- Remover `pendingCheckout` state e logica associada

## Detalhes Tecnicos

### Dados passados via navigate state para o checkout
```text
{
  cart: CartItem[]           -- itens do carrinho com precos efetivos
  store: StoreSettings       -- dados da loja (whatsapp, cores, nome, id, owner_id)
  cartTotal: number          -- total pre-calculado
  slug: string               -- slug da loja
}
```

### Fluxo de notificacoes (ja existente, sem alteracao)
- O trigger `botconversa_catalog_sale_trigger` dispara automaticamente quando um registro com `source = 'catalog'` e inserido na tabela `sales`
- As notificacoes do dashboard/sininho ja cobrem vendas via `saved_carts` (visivel no CRM de WhatsApp)
- Para garantir que a venda apareca no sininho, vamos inserir tambem na tabela `saved_carts` com status adequado

### Estrutura da pagina de checkout
- Layout limpo e simples, sem header complexo
- Botao de voltar no topo
- Logo/nome da loja
- Lista de itens com imagens
- Totalizador
- Formulario de dados
- Botao de envio em destaque
- 100% responsivo, sem modais ou overlays

