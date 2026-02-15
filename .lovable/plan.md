
# Fase 4: Vitrine P2P, Calculo de Frete Dinamico e Checkout

## Resumo

Adicionar ao catalogo publico uma vitrine de itens do Bazar VIP (status "approved"), com calculo de frete dinamico P2P (CEP do vendedor da peca para CEP do comprador) e checkout que separa os valores (comissao da loja, valor do vendedor, frete).

## Alteracoes no Banco de Dados

### 1. Adicionar campos pos-venda na tabela `bazar_items`

Novos campos para rastrear a venda:
- `buyer_phone` (text) -- telefone do comprador
- `buyer_name` (text) -- nome do comprador
- `buyer_zip` (text) -- CEP do comprador (para frete)
- `shipping_cost` (numeric) -- custo do frete selecionado
- `shipping_carrier` (text) -- transportadora selecionada
- `shipping_service` (text) -- servico selecionado
- `shipping_source` (text) -- Melhor Envio ou SuperFrete
- `shipping_service_id` (integer) -- ID do servico para compra de etiqueta
- `shipping_label_url` (text) -- URL da etiqueta gerada
- `shipping_tracking` (text) -- codigo de rastreio
- `sold_at` (timestamptz) -- data da venda

### 2. Policy SELECT publica para `bazar_items`

Adicionar policy para que usuarios anonimos possam ver itens com status "approved" (necessario para a vitrine publica no catalogo).

### 3. Nova edge function `quote-bazar-shipping`

Funcao publica (sem auth) que recebe:
- `owner_id` (para buscar tokens de frete do lojista no profiles)
- `origin_zip` (CEP do vendedor da peca, ja salvo no bazar_item)
- `destination_zip` (CEP do comprador)
- Dimensoes do pacote (do bazar_item)

Usa o service_role_key para ler os tokens de frete do lojista e chama as mesmas APIs (Melhor Envio / SuperFrete) que a funcao `quote-shipping` ja usa.

Diferenca-chave: o CEP de origem e o do vendedor da peca (seller_zip no bazar_items), nao o da loja.

### 4. Nova edge function `checkout-bazar`

Funcao publica que:
1. Recebe `bazar_item_id`, dados do comprador (nome, telefone, CEP), e a opcao de frete selecionada
2. Valida que o item esta com status "approved"
3. Atualiza o item para status "sold" com os dados do comprador e frete
4. Retorna confirmacao

A compra de etiqueta sera feita pelo lojista posteriormente (como ja funciona no sistema existente).

## Alteracoes no Frontend

### 5. Componente `BazarShowcaseDialog` (novo)

Arquivo: `src/components/catalog/BazarShowcaseDialog.tsx`

Dialog/Sheet que mostra a vitrine do bazar:
- Lista itens com status "approved" daquela loja (owner_id)
- Cada card mostra: foto, titulo, descricao, preco final
- Botao "Comprar Agora" em cada item abre o fluxo de checkout

### 6. Componente `BazarCheckoutDialog` (novo)

Arquivo: `src/components/catalog/BazarCheckoutDialog.tsx`

Dialog de checkout em etapas:
1. **Dados do comprador**: Nome, WhatsApp, CEP (pre-preenchido do lead se existir)
2. **Selecao de frete**: Ao informar CEP, chama `quote-bazar-shipping` e exibe opcoes (transportadora, preco, prazo)
3. **Resumo**: Preco da peca + Frete selecionado = Total. Exibe a separacao: "Valor do vendedor: R$ X | Comissao da loja: R$ Y | Frete: R$ Z"
4. **Confirmar**: Chama `checkout-bazar`, marca item como sold, exibe mensagem de sucesso

### 7. Atualizar `VipAreaDrawer`

Adicionar botao "Comprar no Bazar" (alem do ja existente "Vender Minha Peca"). Ao clicar, abre o `BazarShowcaseDialog`.

### 8. Atualizar `BazarAdmin`

- Na aba "Vendidos", exibir dados do comprador, frete, e link da etiqueta
- Adicionar botao "Gerar Etiqueta" que chama a funcao `purchase-shipping` existente com os dados do bazar_item (usando o CEP do vendedor como origem)
- Exibir separacao de valores: Comissao da loja, Valor a pagar ao vendedor, Frete

## Fluxo do Usuario

```text
Comprador no Catalogo
  -> Abre Area VIP (FAB)
  -> Clica "Comprar no Bazar"
  -> Ve vitrine com itens aprovados
  -> Clica "Comprar Agora" em um item
  -> Informa Nome, WhatsApp, CEP
  -> Sistema cota frete (CEP vendedor -> CEP comprador)
  -> Seleciona opcao de frete
  -> Ve resumo (Peca + Frete = Total)
  -> Confirma compra
  -> Item muda para "sold"

Lojista em /admin/bazar
  -> Ve item vendido com dados do comprador
  -> Ve separacao: Comissao loja | Valor vendedor | Frete
  -> Gera etiqueta (CEP vendedor -> CEP comprador)
  -> Notifica vendedor original para enviar a peca
```

## Arquivos a criar/modificar

1. **Migracao SQL** -- Novos campos em bazar_items + policy SELECT publica
2. **`supabase/functions/quote-bazar-shipping/index.ts`** (novo) -- Cotacao de frete P2P publica
3. **`supabase/functions/checkout-bazar/index.ts`** (novo) -- Finalizacao de compra do bazar
4. **`src/components/catalog/BazarShowcaseDialog.tsx`** (novo) -- Vitrine do bazar
5. **`src/components/catalog/BazarCheckoutDialog.tsx`** (novo) -- Checkout com frete dinamico
6. **`src/components/catalog/VipAreaDrawer.tsx`** -- Adicionar botao "Comprar no Bazar"
7. **`src/pages/BazarAdmin.tsx`** -- Exibir dados pos-venda e botao de etiqueta

## Detalhes tecnicos

### Edge function `quote-bazar-shipping`

Usa `SUPABASE_SERVICE_ROLE_KEY` para buscar tokens de frete do lojista (profiles.melhor_envio_token, profiles.superfrete_token). Nao requer auth do comprador. Reutiliza a mesma logica de cotacao do `quote-shipping` existente.

```text
POST /quote-bazar-shipping
Body: { owner_id, origin_zip, destination_zip, weight_grams, width_cm, height_cm, length_cm }
Response: { options: [{ carrier, service, service_id, price, delivery_days, source }] }
```

### Edge function `checkout-bazar`

```text
POST /checkout-bazar
Body: { bazar_item_id, buyer_name, buyer_phone, buyer_zip, shipping_cost, shipping_carrier, shipping_service, shipping_source, shipping_service_id }
Response: { success: true, item: {...} }
```

### Geracao de etiqueta no BazarAdmin

Reutiliza a funcao `purchase-shipping` existente, passando:
- `origin_zip`: seller_zip do bazar_item (CEP do vendedor da peca)
- `destination_zip`: buyer_zip do bazar_item (CEP do comprador)
- Dimensoes do bazar_item
- Dados do vendedor (seller_name, seller_phone do bazar_item)
- Dados do comprador (buyer_name, buyer_phone do bazar_item)

### config.toml

Adicionar `verify_jwt = false` para as duas novas funcoes (acesso publico).
