

# Sinalizar Produtos Consignados no Catalogo e Notificar Retorno

## Problema

Atualmente, quando produtos sao adicionados a uma Bolsa Consignada, eles continuam aparecendo como totalmente disponiveis no catalogo publico. O estoque fisico nao e decrementado (corretamente), mas o catalogo nao considera os itens reservados em consignacoes.

## Solucao em 3 Partes

### Parte 1 - Consultar itens consignados no catalogo

Na query de produtos do `StoreCatalog.tsx`, apos buscar produtos e variantes, fazer uma consulta adicional para identificar quais produtos/variantes possuem itens em consignacoes ativas (`active` ou `awaiting_approval`). Isso cria um mapa de "estoque reservado" por produto e variante.

**Logica:**
- Buscar `consignment_items` com `consignments.status IN ('active', 'awaiting_approval')` e `consignment_items.status IN ('pending', 'active')`
- Contar quantas unidades estao reservadas por `product_id` + `variant_id`
- Subtrair do estoque disponivel para exibicao

### Parte 2 - Sinalizar no card do catalogo

Para cada tamanho de um produto, calcular o "estoque disponivel" (fisico - consignado):

- **Estoque disponivel > 0**: Tamanho aparece normalmente, sem alteracao
- **Estoque disponivel = 0 mas fisico > 0**: Tamanho aparece com badge "Em Provacao" (usando o `ConsignmentStockBadge` existente adaptado). O botao de compra e substituido por "Entrar na Fila" que abre o `WaitlistDialog` ja existente
- **Estoque fisico = 0**: Tamanho nao aparece (comportamento atual mantido)

No card do produto:
- Se TODOS os tamanhos estao em provacao: exibir badge "Em Provacao" sobre a imagem e botao "Entrar na Fila"
- Se ALGUNS tamanhos estao disponiveis: exibir normalmente, mas tamanhos consignados ficam desabilitados com indicador visual (texto riscado ou cor diferente + tooltip "Em Provacao")

### Parte 3 - Notificacao de retorno ao estoque

Quando um item e devolvido de uma consignacao (status muda para `returned`), verificar se existe alguem na `product_waitlist` para aquele produto. Se existir, gerar uma notificacao.

**Implementacao:**
- Criar uma funcao de banco de dados (trigger) na tabela `consignment_items` que, ao detectar mudanca de status para `returned`, verifica a `product_waitlist`
- Criar uma tabela `waitlist_notifications` para registrar as notificacoes pendentes (produto_id, waitlist_entry_id, created_at, sent_at)
- Na interface do vendedor (pagina de Consignacoes ou Dashboard), exibir um alerta: "Produto X retornou ao estoque - 3 clientes na fila de espera" com botao para copiar lista de contatos (nome + telefone) para envio manual via WhatsApp

## Detalhes Tecnicos

### Alteracoes no Banco de Dados (Migration)

1. Criar tabela `waitlist_notifications`:

```text
waitlist_notifications
- id (uuid, PK)
- product_id (uuid, FK -> products)
- waitlist_id (uuid, FK -> product_waitlist)
- consignment_item_id (uuid, FK -> consignment_items)
- status (text, default 'pending') -- pending, notified, dismissed
- created_at (timestamptz)
```

2. Criar trigger na tabela `consignment_items` para quando `status` mudar para `returned`:
   - Buscar entradas na `product_waitlist` com `status = 'waiting'` para o `product_id`
   - Inserir registros em `waitlist_notifications`

3. Adicionar RLS policies para `waitlist_notifications` (owner do produto pode ler/atualizar)

### Alteracoes no Frontend

**`src/pages/StoreCatalog.tsx`:**
- Na `queryFn` de `catalogItems`, adicionar query para buscar contagem de itens consignados por produto
- Passar dados de consignacao para o `CatalogDisplayItem` (novo campo `consignedPerSize: Record<string, number>`)
- No `BoutiqueProductCard`, usar os dados para:
  - Desabilitar tamanhos totalmente consignados (badge amarelo "Em Provacao")
  - Mostrar `WaitlistDialog` quando clicar em tamanho indisponivel
  - Se todos os tamanhos indisponiveis, mostrar overlay "Em Provacao" + botao "Entrar na Fila"

**`src/components/catalog/ConsignmentStockBadge.tsx`:**
- Adaptar para receber dados pre-calculados em vez de fazer query propria (evitar N+1 queries)

**Dashboard / Consignments:**
- Adicionar alerta de "Clientes aguardando" quando houver notificacoes pendentes em `waitlist_notifications`
- Exibir lista de contatos para o vendedor entrar em contato manualmente

### Arquivos Modificados

1. `src/pages/StoreCatalog.tsx` - Query de consignment items + logica no card
2. `src/components/catalog/ConsignmentStockBadge.tsx` - Adaptar para dados pre-calculados
3. `src/pages/Dashboard.tsx` ou `src/pages/Consignments.tsx` - Alerta de clientes na fila
4. Migration SQL - Tabela `waitlist_notifications` + trigger
5. `src/hooks/useWaitlistNotifications.tsx` (novo) - Hook para buscar notificacoes pendentes

