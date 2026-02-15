

# Backup Completo: Botao Manual + Email Diario Automatico

## Resumo

Criar um sistema de backup de dados com duas funcionalidades:
1. **Botao "Baixar Backup"** na area admin para download imediato de todos os dados
2. **Email diario automatico** enviando o backup como anexo JSON para o email do admin

Para o envio de email, usaremos o **Resend** (servico de email gratuito ate 3.000 emails/mes). Voce precisara criar uma conta gratuita em [resend.com](https://resend.com) e copiar sua API key -- e um processo de 2 minutos, muito mais simples que o Google Cloud.

---

## Passo a passo para o Resend (antes de implementar)

1. Acesse [resend.com](https://resend.com) e crie uma conta gratuita (pode usar login com Google)
2. No painel, va em **API Keys** e clique **Create API Key**
3. Copie a chave gerada (comeca com `re_...`)
4. Eu vou pedir para voce colar essa chave no sistema

O plano gratuito do Resend permite 3.000 emails/mes e 100 emails/dia -- mais que suficiente para 1 backup diario.

Nota: Com o plano gratuito, os emails serao enviados do remetente `onboarding@resend.dev`. Para usar seu proprio dominio como remetente, basta configurar o dominio no painel do Resend (opcional).

---

## Arquitetura

```text
[Admin clica "Baixar Backup"]
        |
        v
[Edge Function: backup-data]
  - Usa service_role_key
  - Consulta todas as tabelas por usuario
  - Retorna JSON completo
        |
        +--> Download direto (modo manual)

[Cron diario 03:00 UTC]
        |
        v
[Edge Function: backup-data?mode=email]
  - Gera o mesmo JSON
  - Envia por email via Resend API
  - Para o email do admin
```

---

## Tabelas incluidas no backup (por usuario)

Todos os dados operacionais, excluindo fotos/videos (apenas URLs sao salvas):

- **Perfil**: profiles
- **Produtos**: products, product_variants, colors
- **Vendas**: sales, sale_items
- **Clientes**: customers
- **Financeiro**: expenses, expense_splits, expense_installments, financial_splits
- **Fornecedores**: suppliers
- **Encomendas**: customer_orders
- **Consignacao**: consignments, consignment_items
- **Consorcios**: consortiums, consortium_participants, consortium_payments, consortium_drawings, consortium_winners, consortium_items, consortium_settings
- **Parcerias**: groups, group_members, partnership_rules, partnership_auto_share, product_partnerships
- **Loja**: store_settings, store_leads, store_partnerships, lead_cart_items
- **Marketing**: marketing_tasks, ad_campaigns, user_ad_integrations
- **Pagamentos**: custom_payment_methods, payment_fees, payment_reminders
- **Waitlist**: product_waitlist, waitlist_notifications
- **Estoque**: stock_requests

---

## Implementacao

### 1. Secret necessaria

- **RESEND_API_KEY**: Chave da API do Resend (sera solicitada antes de implementar)

### 2. Edge Function: `backup-data`

Funcao backend que aceita dois modos:

- **`mode=download`** (padrao): Retorna o JSON completo para download direto
- **`mode=email`**: Gera o JSON e envia como anexo por email via Resend

A funcao usa `SUPABASE_SERVICE_ROLE_KEY` para acessar dados de todos os usuarios (bypassa RLS). Busca o email do admin na tabela `user_roles` + `profiles`.

Estrutura do JSON gerado:
```text
{
  "backup_date": "2026-02-15T03:00:00Z",
  "total_users": 6,
  "users": [
    {
      "user_id": "...",
      "user_name": "Maria Silva",
      "user_email": "maria@email.com",
      "data": {
        "products": [...],
        "sales": [...],
        "customers": [...],
        ...
      }
    },
    ...
  ]
}
```

### 3. Tabela `backup_logs` (nova)

Para registrar o historico de backups:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| backup_type | text | 'manual' ou 'scheduled' |
| status | text | 'success' ou 'failed' |
| file_size_kb | integer | Tamanho do backup em KB |
| users_count | integer | Quantidade de usuarios no backup |
| error_message | text | Mensagem de erro (se falhou) |
| triggered_by | uuid | ID do admin que disparou (null se cron) |
| created_at | timestamptz | Data/hora do backup |

RLS: Apenas admins podem visualizar.

### 4. Cron Job (agendamento diario)

Usar `pg_cron` + `pg_net` para chamar a edge function diariamente as 03:00 UTC (meia-noite no horario de Brasilia):

```text
Agenda: 0 3 * * * (todo dia as 03:00 UTC)
Acao: POST para backup-data?mode=email
```

### 5. UI na pagina AdminUsers.tsx

Adicionar uma secao "Backup de Dados" com:

- Botao **"Baixar Backup Agora"** que chama a edge function e inicia o download do JSON
- Indicador de loading durante a geracao
- Tabela com historico dos ultimos backups (data, tipo, status, tamanho)
- Badge mostrando quando foi o ultimo backup automatico

---

## Arquivos criados/alterados

1. **`supabase/functions/backup-data/index.ts`** -- Edge function principal (nova)
2. **Nova migracao SQL** -- Tabela `backup_logs` + extensoes `pg_cron`/`pg_net`
3. **`supabase/config.toml`** -- Adicionar `[functions.backup-data]` com `verify_jwt = false`
4. **`src/pages/AdminUsers.tsx`** -- Adicionar secao de backup com botao + historico
5. **SQL (cron job)** -- Agendamento diario

### Sequencia

1. Solicitar a RESEND_API_KEY
2. Criar a migracao (tabela backup_logs)
3. Criar a edge function backup-data
4. Configurar o cron job
5. Atualizar a UI do admin

