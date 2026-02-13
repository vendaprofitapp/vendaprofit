

## Plano: Corrigir SuperFrete + Salvar Rastreio na Venda + Botao WhatsApp nos Detalhes

### Problema 1: SuperFrete nao retorna cotacoes

A funcao `quoteSuperfrete` no edge function `quote-shipping` esta usando um formato de body incorreto para a API da SuperFrete. De acordo com a documentacao oficial, os campos `from` e `to` devem ser objetos com `postal_code`, nao strings simples. Alem disso, o campo `services` deve ser uma string de IDs de servicos validos, e a estrutura do `package` precisa de ajustes.

**Correcao**: Ajustar o body da requisicao para seguir o formato correto da API SuperFrete (`from.postal_code`, `to.postal_code`), e melhorar o parsing da resposta.

### Problema 2: Rastreio nao aparece nos detalhes da venda

O campo `shipping_tracking` ja eh salvo na criacao da venda (linha 635 de Sales.tsx), porem no dialog de "Detalhes da Venda" (linhas 2438-2458) o rastreio nao eh exibido. Alem disso, nao ha botao para enviar o rastreio via WhatsApp a partir dos detalhes de uma venda ja registrada.

### Alteracoes Planejadas

#### 1. Edge Function `quote-shipping` - Corrigir formato SuperFrete

- Alterar os campos `from` e `to` de strings para objetos `{ postal_code: "CEP" }`
- Ajustar o campo `services` para o formato correto
- Melhorar o parsing da resposta para cobrir diferentes formatos retornados pela API

#### 2. Dialog "Detalhes da Venda" em `Sales.tsx`

Na secao de informacoes de envio do dialog de visualizacao (linhas 2438-2458), adicionar:

- Exibicao do codigo de rastreio (`shipping_tracking`) quando disponivel
- Botao "Enviar Rastreio via WhatsApp" que abre o WhatsApp com mensagem pre-formatada contendo o codigo de rastreio e nome do cliente
- Botao para copiar o codigo de rastreio

#### 3. Garantir que `shipping_label_url` esteja na interface Sale

A interface `Sale` (linhas 86-106) nao inclui `shipping_label_url`. Adicionar esse campo para poder exibir o link da etiqueta nos detalhes.

### Detalhes Tecnicos

**`supabase/functions/quote-shipping/index.ts` - funcao `quoteSuperfrete`:**
- Mudar `from: originZip` para `from: { postal_code: originZip }`
- Mudar `to: destinationZip` para `to: { postal_code: destinationZip }`

**`src/pages/Sales.tsx` - Interface Sale:**
- Adicionar `shipping_label_url: string | null`

**`src/pages/Sales.tsx` - Dialog de detalhes (apos linha 2457):**
- Exibir `selectedSale.shipping_tracking` com icone de copia
- Botao WhatsApp que abre `wa.me` com mensagem formatada
- Link para baixar etiqueta se `shipping_label_url` estiver disponivel

