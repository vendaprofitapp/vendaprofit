# Notificações do Catálogo + Push Notifications (AppWeb)

## O que será feito

### Parte 1 — Notificações do Catálogo no Sininho e Dashboard

Atualmente o `useNotifications` e o `SystemAlerts` monitoram: Modo Evento, Bolsa Consignada, Bazar VIP e Pontos Parceiros. Faltam os três eventos do Catálogo (Minha Loja):

1. **Novo Lead cadastrado** — cliente preencheu nome + WhatsApp no catálogo (`store_leads` INSERT)
2. **Carrinho criado** — cliente adicionou itens ao carrinho (`lead_cart_items` INSERT, status `waiting`)
3. **Venda finalizada pelo catálogo** — venda com `source = 'catalog'` concluída na tabela `sales`

Todos os três usarão uma janela de tempo (últimas 24h para leads e carrinhos, últimos 3 dias para vendas) para evitar listas infinitas.

#### Mudanças em `src/hooks/useNotifications.tsx`

Adicionar 3 novas queries:

```typescript
// Novos leads (últimas 24h)
store_leads WHERE owner_id = user.id AND created_at > now() - 24h

// Carrinhos criados (últimas 24h) — lead_cart_items com status 'waiting'
// agrupados por lead_id para contar carrinhos únicos
lead_cart_items JOIN store_leads WHERE store_leads.owner_id = user.id
  AND lead_cart_items.status = 'waiting'
  AND lead_cart_items.created_at > now() - 24h

// Vendas pelo catálogo (últimos 3 dias)
sales WHERE owner_id = user.id AND source = 'catalog' AND status = 'completed'
  AND created_at > now() - 3 days
```

E adicionar 3 novas seções no retorno do hook com ícones, rotas e descrições.

#### Mudanças em `src/components/dashboard/SystemAlerts.tsx`

Adicionar 3 novos cards de alerta:

- **Leads Novos** — cor verde-azulado, ícone Users, rota `/whatsapp-crm`
- **Carrinhos Ativos** — cor âmbar, ícone ShoppingCart, rota `/whatsapp-crm`
- **Vendas pelo Catálogo** — cor verde, ícone CheckCircle, rota `/sales`

---

### Parte 2 — Push Notifications no celular (AppWeb instalado)

**Sim, é possível!** O projeto já tem um `manifest.json` configurado (é uma PWA instalável). O que falta é implementar **Web Push Notifications** — o padrão que permite enviar avisos para o celular mesmo com o app fechado.

#### Como funciona

```text
Evento ocorre no banco → Database Trigger → Edge Function →
Web Push API → Service Worker → Notificação no celular
```

1. **Service Worker** (`public/sw.js`) — fica em segundo plano e recebe o push
2. **Tabela `push_subscriptions**` — armazena os tokens de assinatura de cada dispositivo da usuária
3. **Edge Function `send-push-notification**` — envia o push para o dispositivo via Web Push Protocol
4. **Database Triggers** — disparam a Edge Function quando ocorre um evento relevante

#### O que será implementado

**a) Banco de dados:**

- Nova tabela `push_subscriptions` com RLS (apenas a própria usuária acessa)
- Campos: `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`

**b) Service Worker (`public/sw.js`):**

- Recebe eventos `push` e exibe a notificação nativa do sistema operacional
- Ao clicar na notificação, abre o app na rota correta

**c) Hook `usePushNotifications`:**

- Solicita permissão ao usuário (somente uma vez)
- Registra o service worker
- Salva a assinatura na tabela `push_subscriptions`

**d) Edge Function `send-push-notification`:**

- Recebe `user_id`, `title`, `body`, `url`
- Busca todas as assinaturas do usuário
- Envia o push via Web Push Protocol (usando as chaves VAPID)

**e) Triggers nos eventos:**

- Novo lead → chama `send-push-notification`
- Carrinho criado → chama `send-push-notification`
- Venda concluída (catalog) → chama `send-push-notification`
- Bolsa consignada finalizada → chama `send-push-notification`
- Item do Bazar aprovado/vendido → chama `send-push-notification`

#### Chaves VAPID (necessárias para Web Push)

Web Push requer um par de chaves VAPID (identificação do servidor). Serão geradas automaticamente pela edge function na primeira execução e armazenadas como secrets. Não é necessário nenhuma conta externa — é tudo via padrão W3C.

#### Limitação importante

- **iOS (iPhone/iPad):** Push Notifications em PWA só funciona a partir do **iOS 16.4+** com o app instalado na tela inicial (Add to Home Screen). Versões anteriores não recebem push.
- **Android:** Funciona perfeitamente em todos os browsers modernos (Chrome, Firefox, Edge).

---

## Resumo dos arquivos


| Arquivo                                              | Ação                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `src/hooks/useNotifications.tsx`                     | Adicionar 3 novas queries (leads, carrinhos, vendas catálogo) |
| `src/components/dashboard/SystemAlerts.tsx`          | Adicionar 3 novos cards de alerta                             |
| `public/sw.js`                                       | Criar Service Worker para receber e exibir push               |
| `src/hooks/usePushNotifications.tsx`                 | Criar hook para registro e permissão de push                  |
| `src/App.tsx`                                        | Chamar `usePushNotifications` para ativar ao logar            |
| `supabase/functions/send-push-notification/index.ts` | Criar Edge Function de envio                                  |
| Migração SQL                                         | Criar tabela `push_subscriptions`                             |


## O que NÃO muda

- Lógica de alertas existentes (aniversariantes, consórcio, parceiros, etc.)
- Fluxo do catálogo para o cliente final
- Todas as demais páginas e componentes