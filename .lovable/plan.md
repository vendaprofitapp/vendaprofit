

## Plano: Gerar Etiqueta Antes da Venda + Envio de Rastreio via WhatsApp

### Problema Atual
O fluxo atual exige que a venda seja registrada primeiro para depois gerar a etiqueta. Isso faz com que o numero de rastreio nao fique vinculado a venda e nao possa ser compartilhado facilmente.

### Solucao Proposta

#### 1. Alterar o fluxo da etiqueta para ser independente da venda

Atualmente, o botao "Gerar Etiqueta" so aparece apos selecionar uma cotacao e exige um `sale_id`. A mudanca sera:
- Remover a dependencia de `sale_id` da funcao de gerar etiqueta
- Permitir gerar a etiqueta ANTES de registrar a venda
- Armazenar o `tracking` e `label_url` no estado local
- Quando a venda for registrada, salvar esses dados junto com a venda

#### 2. Atualizar a Edge Function `purchase-shipping`

- Tornar o campo `sale_id` opcional
- Se `sale_id` for fornecido, atualizar a venda com tracking/label
- Se nao for fornecido, apenas retornar o tracking e label_url sem atualizar nenhuma venda

#### 3. Atualizar `ShippingSection.tsx`

- Permitir gerar etiqueta sem `saleId` (chamar a edge function sem esse campo)
- Armazenar o `tracking` retornado no estado e exibi-lo na interface
- Adicionar callback `onTrackingGenerated` para passar o tracking de volta ao componente pai
- Exibir o numero de rastreio apos gerar a etiqueta
- Adicionar botao "Enviar Rastreio via WhatsApp" que abre o WhatsApp com mensagem pre-formatada contendo o codigo de rastreio

#### 4. Atualizar `Sales.tsx`

- Adicionar estado para `shippingTracking`
- Ao registrar a venda, incluir `shipping_tracking` e `shipping_label_url` ja preenchidos
- Passar `customerPhone` e `customerName` para a secao de frete para montar a mensagem do WhatsApp

#### 5. Botao WhatsApp com mensagem de rastreio

Apos gerar a etiqueta, aparecera um botao para enviar o rastreio via WhatsApp com mensagem como:

```
Ola [nome]! Seu pedido foi enviado!
Codigo de rastreio: [tracking]
Acompanhe em: https://www.linkcorreios.com.br/?id=[tracking]
```

### Detalhes Tecnicos

**Edge Function `purchase-shipping`:**
- `sale_id` passa a ser opcional
- Se presente, faz o UPDATE na tabela sales
- Se ausente, apenas retorna `{ label_url, tracking }`

**`ShippingSection.tsx`:**
- Nova prop `onTrackingGenerated?: (tracking: string, labelUrl: string) => void`
- O botao "Gerar Etiqueta" funciona sem `saleId`
- Apos gerar, exibe tracking + botao WhatsApp + botao baixar etiqueta

**`Sales.tsx`:**
- Novos estados: `shippingTracking`
- No `mutationFn` do `createSaleMutation`, incluir `shipping_tracking` e `shipping_label_url` no INSERT da venda
- Passar o callback `onTrackingGenerated` para o `ShippingSection`

