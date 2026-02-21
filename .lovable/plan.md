

## Correção: "record 'new' has no field 'source'"

### Causa raiz

O trigger `botconversa_catalog_sale_trigger` dispara em **todo INSERT** na tabela `sales`. A função `trigger_botconversa_catalog_sale()` tenta acessar `NEW.source`, mas a tabela `sales` **não possui** a coluna `source`.

O campo `source` existe apenas na tabela `sale_items` (itens individuais da venda), não na tabela `sales` (cabeçalho da venda).

### Solução

Recriar o trigger com uma condição `WHEN` que evite o acesso a campos inexistentes, **ou** alterar a função trigger para não referenciar `NEW.source`.

A abordagem mais simples e segura: **remover o trigger**, já que vendas feitas pelo catálogo já são notificadas pelo fluxo correto (o checkout do catálogo chama a Edge Function diretamente). O trigger é redundante e está quebrando vendas normais.

### Mudança

| Tipo | O quê |
|---|---|
| Migration SQL | `DROP TRIGGER botconversa_catalog_sale_trigger ON public.sales;` |

Isso resolve o erro imediatamente. Vendas manuais voltarão a funcionar. Notificações de vendas do catálogo continuam funcionando pelo fluxo direto (Edge Function chamada no checkout).
