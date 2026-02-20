
# Notificações WhatsApp via Botconversa — API Central do Admin

## Diagnóstico da arquitetura atual

A solução é totalmente viável e mais simples que o plano anterior. Em vez de cada vendedora configurar sua própria API, usaremos:

- **Uma única chave da API do Botconversa** guardada como secret do sistema (acessível só pelo admin)
- **O campo `phone` já existente na tabela `profiles`** como número de destino de cada vendedora
- **Triggers no banco de dados** que chamam uma Edge Function ao detectar eventos relevantes
- **Edge Function `botconversa-notify`** que monta a mensagem e faz o envio

---

## Fluxo completo

```text
Evento no banco de dados
(novo lead, carrinho, venda, bolsa)
         ↓
   Trigger PostgreSQL
         ↓
Edge Function "botconversa-notify"
         ↓
Busca o phone da vendedora (profiles.phone)
         ↓
POST API do Botconversa
         ↓
WhatsApp da vendedora ✅
```

---

## O que o Admin precisa fazer (uma única vez)

1. Ir até **Administração de Usuários** (`/admin/users`) — nova aba "Integrações"
2. Inserir a **API Key do Botconversa** (gerada no painel Botconversa > Integrações > API)
3. Salvar — a partir daí, todas as vendedoras passam a receber notificações automaticamente

---

## Pré-requisito das vendedoras

Cada vendedora precisa ter o **número de WhatsApp cadastrado no perfil** (`Configurações > Perfil > Telefone`). Se o número estiver vazio, a notificação é ignorada silenciosamente sem erros.

---

## Eventos que disparam mensagem

| Evento | Tabela monitorada | Condição |
|---|---|---|
| Novo lead cadastrado | `store_leads` | INSERT |
| Carrinho criado | `lead_cart_items` | INSERT com status `waiting` |
| Venda finalizada pelo catálogo | `sales` | INSERT com `source = 'catalog'` |
| Bolsa consignada finalizada | `consignments` | UPDATE para `status = 'finalized_by_client'` |

---

## Exemplo das mensagens enviadas

**Novo lead:**
```
🆕 Novo lead na sua loja!

👤 Nome: Maria Silva
📱 WhatsApp: (11) 98765-4321
🕐 Horário: 20/02/2026 às 14h32

Acesse o CRM para acompanhar:
https://vendaprofit.lovable.app/marketing/whatsapp
```

**Carrinho criado:**
```
🛒 Carrinho criado na sua loja!

👤 Cliente: Maria Silva
📦 Produto: Blusa Floral Rosa (M, Rosa)
   Qtd: 2 × R$ 79,90

💰 Total estimado: R$ 159,80

Entre em contato para fechar a venda:
https://vendaprofit.lovable.app/marketing/whatsapp
```

**Venda finalizada:**
```
🎉 Nova venda pelo catálogo!

👤 Cliente: Maria Silva
📱 WhatsApp: (11) 98765-4321
💳 Pagamento: PIX
💰 Total: R$ 189,90

📦 Itens:
• 2× Blusa Floral Rosa — R$ 79,90 un
• 1× Calça Wide Leg — R$ 30,10

Acesse para confirmar:
https://vendaprofit.lovable.app/sales
```

**Bolsa consignada:**
```
👜 Cliente finalizou escolhas na Bolsa!

👤 Cliente: Ana Paula
📱 WhatsApp: (11) 91234-5678

Acesse para conciliar a bolsa:
https://vendaprofit.lovable.app/consignments
```

---

## Detalhes técnicos

### 1. Secret do sistema

A API Key do Botconversa será armazenada como um **Supabase Secret** chamado `BOTCONVERSA_API_KEY`. Isso garante que a chave nunca fique exposta no código ou no banco de dados.

### 2. Tabela `system_settings` (nova — apenas 1 linha)

Para o admin configurar e testar a integração via interface, criaremos uma tabela mínima com RLS restrita a admins:

```sql
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- RLS: apenas admin pode ler/escrever
```

Aqui ficará, por exemplo, um flag `botconversa_enabled = true/false` que o admin pode ligar/desligar sem precisar remover o secret.

### 3. Edge Function `botconversa-notify`

Recebe via POST:
```json
{
  "event_type": "new_lead" | "cart_created" | "catalog_sale" | "consignment_finalized",
  "owner_id": "uuid-da-vendedora",
  "payload": { ... dados do evento ... }
}
```

Lógica interna:
1. Verifica se `BOTCONVERSA_API_KEY` está configurada
2. Busca `profiles.phone` da vendedora pelo `owner_id`
3. Se não houver telefone cadastrado → registra log e encerra sem erro
4. Monta a mensagem de acordo com o tipo de evento
5. Faz POST para `https://backend.botconversa.com.br/api/v1/webhook/subscriber/send-message/`

### 4. Triggers PostgreSQL (via `pg_net`)

Quatro triggers que chamam a Edge Function assincronamente:

- `AFTER INSERT ON store_leads` → event_type: `new_lead`
- `AFTER INSERT ON lead_cart_items WHERE NEW.status = 'waiting'` → event_type: `cart_created`
- `AFTER INSERT ON sales WHERE NEW.source = 'catalog'` → event_type: `catalog_sale`
- `AFTER UPDATE ON consignments WHERE NEW.status = 'finalized_by_client'` → event_type: `consignment_finalized`

### 5. Tela de configuração do Admin

Nova aba "Botconversa" na página `/admin/users` com:
- Toggle para ativar/desativar notificações
- Campo para inserir/atualizar a API Key
- Botão "Enviar mensagem de teste" (envia para o próprio telefone do admin)
- Aviso sobre o pré-requisito: as vendedoras precisam ter o telefone cadastrado no perfil

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `system_settings` com RLS admin-only + 4 triggers com `pg_net` |
| `supabase/functions/botconversa-notify/index.ts` | Criar Edge Function de envio |
| `src/components/admin/BotconversaAdminSection.tsx` | Criar seção de configuração do admin |
| `src/pages/AdminUsers.tsx` | Adicionar aba/seção com `BotconversaAdminSection` |

## O que NÃO muda

- Nenhuma configuração para as vendedoras (automático para quem tem telefone no perfil)
- Sininho e dashboard continuam funcionando normalmente em paralelo
- Fluxo do catálogo para os clientes finais
- Todas as demais integrações e configurações existentes
