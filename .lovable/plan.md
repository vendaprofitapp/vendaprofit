

## Integração Botconversa via Webhook — Um Webhook por Evento

### Por que um webhook por evento?

No Botconversa, cada URL de webhook dispara um **fluxo específico**. Como cada evento do sistema tem uma mensagem diferente (novo lead vs. venda vs. bolsa finalizada), o ideal é que cada um tenha seu próprio fluxo no Botconversa — com mensagens personalizadas pelo admin diretamente no painel do Botconversa.

Se usássemos um único webhook, o admin precisaria configurar lógica condicional (if/else) dentro de um único fluxo no Botconversa, o que é mais complexo e difícil de manter.

### Estrutura proposta

4 campos de webhook na configuração, um para cada evento:

| Evento | Chave no `system_settings` | Dados enviados no POST |
|---|---|---|
| Novo Lead | `botconversa_webhook_new_lead` | phone, name, created_at |
| Carrinho Criado | `botconversa_webhook_cart_created` | phone, lead_name, product_name, quantity, unit_price, selected_size, variant_color |
| Venda pelo Catálogo | `botconversa_webhook_catalog_sale` | phone, customer_name, customer_phone, total, payment_method, items |
| Bolsa Finalizada | `botconversa_webhook_consignment_finalized` | phone, customer_name, customer_phone |

### Fluxo de funcionamento

```text
Evento ocorre (ex: novo lead)
         |
Trigger de banco chama Edge Function botconversa-notify
         |
Edge Function busca a URL do webhook correspondente ao event_type
  (ex: botconversa_webhook_new_lead) em system_settings
         |
Se URL não configurada -> registra log "skipped" e encerra
         |
POST para a URL com: { phone, name, created_at, ... }
         |
Botconversa recebe -> encontra/cria contato -> dispara o fluxo
         |
Log salvo em botconversa_logs
```

### Alterações por arquivo

**1. Edge Function `supabase/functions/botconversa-notify/index.ts`**

- Remover o endpoint fixo da API e a montagem de mensagem interna (o Botconversa cuida da mensagem agora)
- Buscar a URL do webhook correspondente ao `event_type` na tabela `system_settings`
- Mapear: `event_type` -> chave `botconversa_webhook_{event_type}`
- Se a URL não existir ou estiver vazia, registrar log como `skipped` com motivo "Webhook não configurado"
- Fazer `POST` para a URL com o payload do evento (sem API key no header -- webhook passivo já é autenticado pela URL)
- Para testes com `test_phone`: substituir o phone do payload pelo número informado
- Manter o log em `botconversa_logs` com status success/failed/skipped

**2. Admin UI `src/components/admin/BotconversaAdminSection.tsx`**

- Remover a seção de "API Key" (não é mais necessária para webhook passivo)
- Adicionar 4 campos de URL de webhook, um para cada evento, com labels claros:
  - "Webhook: Novo Lead" 
  - "Webhook: Carrinho Criado"
  - "Webhook: Venda pelo Catálogo"
  - "Webhook: Bolsa Finalizada"
- Cada campo salva/carrega do `system_settings` com a chave correspondente
- Atualizar as instruções de configuração:
  1. No Botconversa, crie um Fluxo para cada evento (ex: "Notificação Novo Lead")
  2. Adicione um bloco de entrada tipo "Webhook" no fluxo
  3. Copie a URL gerada e cole no campo correspondente abaixo
  4. Use as variáveis recebidas ({{name}}, {{phone}}, {{product_name}}, etc.) para montar a mensagem no fluxo
- O campo de teste permanece, mas agora dispara um POST para o webhook de "Novo Lead" com o número digitado
- Carregar todas as 4 URLs no `loadSettings` e salvar cada uma individualmente com botão ou auto-save

### Payload enviado para cada webhook

**Novo Lead:**
```json
{ "phone": "5511999990000", "name": "Maria Silva", "created_at": "2026-02-20T..." }
```

**Carrinho Criado:**
```json
{ "phone": "5511999990000", "lead_name": "Maria", "product_name": "Vestido", "quantity": 1, "unit_price": 150, "selected_size": "M", "variant_color": "Rosa" }
```

**Venda pelo Catálogo:**
```json
{ "phone": "5511999990000", "customer_name": "Maria", "total": 299.90, "payment_method": "PIX", "items": [...] }
```

**Bolsa Finalizada:**
```json
{ "phone": "5511999990000", "customer_name": "Maria", "customer_phone": "11999990000" }
```

### O que acontece com a API Key existente

A `BOTCONVERSA_API_KEY` nos Secrets permanece armazenada mas não será mais usada pela Edge Function. A UI remove a referência visual. Se futuramente for necessária para outra integração com a API direta do Botconversa, ela já estará disponível.

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/botconversa-notify/index.ts` | Reescrever: buscar webhook URL por evento em system_settings, POST direto para webhook, remover montagem de mensagem |
| `src/components/admin/BotconversaAdminSection.tsx` | Adicionar 4 campos de webhook URL, remover seção de API Key, atualizar instruções |

