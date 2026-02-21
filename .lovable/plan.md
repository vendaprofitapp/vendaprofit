

## Correcao: Acoes do Catalogo nao geram resultados no aplicativo

### Diagnostico completo

Apos investigacao detalhada no banco de dados e no codigo, identifiquei **3 problemas distintos** que impedem o fluxo completo:

---

### Problema 1: Botconversa nao envia notificacao porque a vendedora nao tem telefone no perfil

O edge function `botconversa-notify` busca o telefone do perfil da vendedora (`profiles.phone`) para incluir no payload do webhook. Se o perfil nao tem telefone, a funcao **pula silenciosamente** com `{ skipped: true, reason: "no_phone" }`.

A vendedora `teamwodbrasil@gmail.com` tem `phone: NULL` no perfil.

**Correcao**: No edge function, quando `profiles.phone` for null, buscar o `whatsapp_number` da `store_settings` como fallback. Toda vendedora que tem uma loja configurada tem esse campo preenchido.

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/botconversa-notify/index.ts` | Adicionar fallback para `store_settings.whatsapp_number` quando `profiles.phone` for null |

---

### Problema 2: Trigger de "cart_created" nunca dispara

O trigger `botconversa_cart_created_trigger` esta configurado com a clausula:

```
WHEN (NEW.status = 'waiting')
```

Porem, o codigo do catalogo insere itens na tabela `lead_cart_items` com `status = 'abandoned'` (funcao `saveAbandonedCart`). Como os status nao coincidem, o trigger **nunca executa**.

**Correcao**: Alterar o trigger para disparar em qualquer INSERT (remover a clausula WHEN), ja que a funcao trigger internamente ja decide o que fazer.

| Tipo | Mudanca |
|---|---|
| Migration SQL | Recriar trigger `botconversa_cart_created_trigger` sem clausula WHEN |

---

### Problema 3: Notificacoes in-app nao incluem eventos do catalogo

O hook `useNotifications` rastreia: Modo Evento, Bolsa Consignada, Bazar VIP e Pontos Parceiros. **Nao inclui** eventos do catalogo (novos leads, carrinhos abandonados, vendas do catalogo).

Isso significa que mesmo com leads e carrinhos sendo criados corretamente, a vendedora nao ve nenhum alerta no sininho do app.

**Correcao**: Adicionar 2 novas secoes ao `useNotifications`:
- Novos Leads (ultimas 24h)
- Carrinhos Abandonados (lead_cart_items com status 'abandoned' nos ultimos 7 dias)

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useNotifications.tsx` | Adicionar queries para `store_leads` (24h) e `lead_cart_items` com status abandoned (7 dias), e criar as secoes correspondentes no sininho |

---

### Resumo tecnico das mudancas

| # | Arquivo | O que muda |
|---|---|---|
| 1 | `supabase/functions/botconversa-notify/index.ts` | Fallback: se `profiles.phone` for null, buscar `store_settings.whatsapp_number` |
| 2 | Migration SQL | Recriar trigger `botconversa_cart_created_trigger` removendo `WHEN (NEW.status = 'waiting')` |
| 3 | `src/hooks/useNotifications.tsx` | Adicionar secoes "Novos Leads" e "Carrinhos Abandonados" ao sininho de notificacoes |

### Resultado esperado

Apos as correcoes:
1. Um novo lead no catalogo gera notificacao via Botconversa (usando o WhatsApp da loja) E aparece no sininho do app
2. Itens adicionados ao carrinho geram o evento "cart_created" no Botconversa
3. Carrinhos abandonados aparecem como alerta no sininho
4. O CRM de Leads continua funcionando normalmente (ja esta correto)

