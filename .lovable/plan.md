
# Notificações: Sininho Funcional + Dashboard Completo

## Diagnóstico atual

### Sininho (Header)
O botão do sininho em `src/components/layout/Header.tsx` está **decorativo** — hardcoded com o número "3" e sem nenhuma ação ao clicar. Precisa ser conectado a dados reais e abrir um painel de notificações.

### Dashboard - notificações faltantes
O `SystemAlerts.tsx` já cobre: aniversariantes, consórcio (vencimento/atraso), vendas a prazo. Mas **faltam**:
1. **Modo Evento** — rascunhos de evento pendentes (existe como banner separado `EventDraftsBanner`, mas não como alerta no painel)
2. **Bolsa Consignada** — quando o cliente finaliza suas escolhas (status `finalized_by_client`), a lojista deve ser notificada
3. **Bazar VIP** — novos itens `pending` para curadoria + itens `sold`
4. **Pontos Parceiros** — atualizações nos itens dos pontos parceiros

---

## O que será implementado

### 1. Hook centralizado de notificações: `useNotifications`

Criar `src/hooks/useNotifications.tsx` que agrega **todas** as fontes de notificação:

```typescript
// Agrega contagens de:
- event_sale_drafts (status = 'pending') → Modo Evento
- consignments (status = 'finalized_by_client') → Bolsa Consignada  
- bazar_items (status = 'pending', owner_id = user.id) → Bazar VIP novos
- bazar_items (status = 'sold', updated_at > last 7 days) → Bazar VIP vendas
- partner_point_items (updated_at > last 24h, status IN ['returned','sold']) → Pontos Parceiros
- waitlist_notifications (status = 'pending') → Consignação (fila de espera)

// Retorna:
{
  totalCount: number,  // soma de tudo → badge no sininho
  sections: [
    { key, label, count, icon, route, color, items[] }
  ]
}
```

### 2. Sininho funcional no Header

Transformar o botão do sininho em `Header.tsx` num `Popover` que abre um painel de notificações:

```
┌─────────────────────────────────────┐
│  🔔 Notificações              [X]   │
├─────────────────────────────────────┤
│  ⚡ Modo Evento                     │
│  3 rascunhos pendentes de conciliar │
│                          [Ver →]    │
├─────────────────────────────────────┤
│  👜 Bolsa Consignada                │
│  2 clientes finalizaram escolhas    │
│                          [Ver →]    │
├─────────────────────────────────────┤
│  🛍️ Bazar VIP                      │
│  1 novo item para curadoria         │
│                          [Ver →]    │
├─────────────────────────────────────┤
│  📍 Pontos Parceiros                │
│  5 movimentações recentes           │
│                          [Ver →]    │
└─────────────────────────────────────┘
```

- Badge com número real (soma de todos os itens de atenção)
- Cada seção tem ícone, descrição e botão "Ver →" que navega para a rota correta
- Seções com zero itens são omitidas
- Se nenhuma notificação, exibe "Tudo em dia ✓"

### 3. Cards de alerta no Dashboard (SystemAlerts)

Adicionar ao `SystemAlerts.tsx` quatro novos cards:

**Bolsa Consignada — Cliente escolheu peças**
- Consulta: `consignments WHERE status = 'finalized_by_client'`
- Card cor: roxo (`purple-500`)
- Texto: "X bolsas prontas para conciliar" → botão "Ver bolsas" → `/bolsa-consignada`

**Modo Evento — Rascunhos pendentes**
- Já existe como banner separado; adicionar também como card no grid de alertas para consistência visual
- Card cor: primary/rosa
- Já tem query em `EventDraftsBanner`, reaproveitar

**Bazar VIP — Novos itens para curadoria**
- Consulta: `bazar_items WHERE owner_id = user.id AND status = 'pending'`
- Card cor: indigo (`indigo-500`)
- Texto: "X itens aguardando aprovação" → botão "Gerenciar" → `/bazar-admin`

**Bazar VIP — Vendas realizadas (últimos 7 dias)**
- Consulta: `bazar_items WHERE owner_id = user.id AND status = 'sold' AND sold_at > now() - 7 days`
- Card cor: verde (`green-500`)
- Texto: "X vendas no Bazar VIP esta semana"

**Pontos Parceiros — Movimentações**
- Consulta: `partner_point_items WHERE owner_id = user.id AND updated_at > now() - 24h AND status != 'allocated'`
- Card cor: azul (`blue-500`)
- Texto: "X movimentações em pontos parceiros" → botão "Ver" → `/pontos-parceiros`

---

## Arquivos a serem criados/editados

| Arquivo | Ação | Descrição |
|---|---|---|
| `src/hooks/useNotifications.tsx` | Criar | Hook centralizado com todas as contagens |
| `src/components/layout/Header.tsx` | Editar | Sininho → Popover com lista de notificações |
| `src/components/dashboard/SystemAlerts.tsx` | Editar | Adicionar 4 novos cards de alerta |

## O que NÃO muda
- Lógica existente de alertas (aniversariantes, consórcio, vendas a prazo, solicitações de estoque)
- Demais páginas e componentes
- Banco de dados (apenas leituras novas)

## Detalhes técnicos

**Query para Bolsa Consignada com nome do cliente:**
```sql
SELECT c.id, c.status, cu.name, cu.phone
FROM consignments c
JOIN customers cu ON cu.id = c.customer_id
WHERE c.seller_id = user.id AND c.status = 'finalized_by_client'
```

**Badge do sininho:**
```typescript
const totalBadge = eventDrafts + consignmentsReady + bazarPending + bazarSold + partnerMovements;
// Badge só aparece quando totalBadge > 0
```
