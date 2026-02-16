

# Correção do Reset de Dados CRM no WhatsApp CRM

## Problema

Quando a vendedora realiza ações (contatar, converter ou cancelar) em um cliente no CRM, o cliente reaparece na coluna "Pendentes" com o mesmo tempo de inatividade anterior. Isso acontece porque:

1. O filtro atual só exclui clientes com status "contacted" - quando o status muda para "converted" ou "cancelled", o cliente volta a aparecer
2. Não existe um campo de "data do último contato" para reiniciar o relógio de inatividade

## Solução

### 1. Migração: Adicionar coluna `contacted_at` na tabela `crm_customer_contacts`

Adicionar uma coluna `contacted_at` (timestamptz, default now()) para registrar quando o cliente foi contatado pela última vez, independente do status atual.

### 2. Correção da lógica de filtragem em `WhatsAppCRM.tsx`

**Antes (bugado):**
- Busca apenas `crm_customer_contacts` com `status = "contacted"`
- Filtra pendentes excluindo só esses IDs
- Resultado: clientes convertidos/cancelados voltam imediatamente

**Depois (corrigido):**
- Buscar TODOS os registros de `crm_customer_contacts` do usuario (sem filtro de status)
- Excluir dos pendentes qualquer cliente que foi contatado nos últimos 30 dias (usando `contacted_at`)
- Manter na coluna "Contatados" apenas os com `status = "contacted"`
- Resultado: clientes convertidos/cancelados ficam fora por 30 dias

### 3. Atualizar `contacted_at` no upsert

Quando a vendedora marca um cliente como "contacted" (via botao ou drag-and-drop), o campo `contacted_at` sera atualizado para `new Date().toISOString()`, reiniciando o relogio.

## Detalhes Tecnicos

### Migração SQL

```sql
ALTER TABLE crm_customer_contacts
ADD COLUMN contacted_at timestamptz NOT NULL DEFAULT now();

-- Preencher registros existentes
UPDATE crm_customer_contacts SET contacted_at = created_at;
```

### Mudanças em `WhatsAppCRM.tsx`

| Mudanca | Detalhe |
|---------|---------|
| Nova query `crm-all-contacts` | Busca TODOS os registros de `crm_customer_contacts` (sem filtro de status), retornando `customer_id` e `contacted_at` |
| Filtro de pendentes atualizado | Exclui clientes com `contacted_at` nos ultimos 30 dias (em vez de apenas `status = "contacted"`) |
| Query `crm-contacted-customers` | Continua filtrando por `status = "contacted"` (para a coluna Contatados) |
| Mutation `markCustomerContacted` | Inclui `contacted_at: new Date().toISOString()` no upsert |

### Fluxo corrigido

```text
Cliente inativo aparece em Pendentes
    |
    v (vendedora contata)
Move para Contatados + contacted_at = agora
    |
    v (vendedora converte ou cancela)
Status muda, mas contacted_at continua recente
    |
    v
Cliente NAO reaparece em Pendentes por 30 dias
    |
    v (apos 30 dias sem nova compra)
Cliente pode reaparecer como inativo novamente
```

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Adicionar coluna `contacted_at` |
| `src/pages/WhatsAppCRM.tsx` | Corrigir logica de filtragem e upsert |

