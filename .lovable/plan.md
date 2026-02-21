

# Corrigir Leads da Barra Passiva no WhatsApp CRM

## Problema

Leads capturados pela barra passiva (sem carrinho) aparecem corretamente como "Novos Cadastros" no CRM, mas **nao podem ser movidos para "Contatados"** porque toda a logica de marcacao depende da tabela `lead_cart_items` -- que esses leads nao possuem.

### Pontos de falha identificados:

1. **`markContacted`**: atualiza `lead_cart_items.status` para "contacted", mas leads da barra passiva nao tem itens nessa tabela -- nada acontece
2. **`handleWhatsApp`**: ao clicar no WhatsApp de um lead tipo "new", nenhuma acao de marcacao e executada (so trata "abandoned" e "customer")
3. **Drag & drop**: arrastar um lead do tipo "new" para "Contatados" chama `markContacted` que falha silenciosamente
4. **Coluna "Contatados"**: so busca leads com `lead_cart_items.status = 'contacted'` + `crm_customer_contacts.status = 'contacted'` -- leads sem carrinho nunca aparecem aqui

## Solucao

Criar uma tabela auxiliar `crm_lead_contacts` (espelho de `crm_customer_contacts` mas para `store_leads`) que registra o status de contato de leads sem carrinho. Atualizar as queries e mutations do CRM para incluir esses leads.

## Passo 1 -- Migracao de banco

Criar tabela `crm_lead_contacts`:

```text
crm_lead_contacts
  - id (uuid, PK)
  - lead_id (uuid, FK -> store_leads.id)
  - owner_id (uuid)
  - status (text, default 'contacted')
  - contacted_at (timestamptz)
  - created_at (timestamptz)
  - UNIQUE(lead_id, owner_id)
```

Com politicas de RLS para o owner ver e gerenciar seus proprios registros.

## Passo 2 -- Alteracoes em `src/pages/WhatsAppCRM.tsx`

### 2a. Nova query: leads sem carrinho contatados

Buscar `crm_lead_contacts` com status "contacted", fazer join com `store_leads` para obter nome/whatsapp, e incluir esses leads na coluna "Contatados".

### 2b. Nova mutation: `markLeadContacted`

Para leads do tipo "new" (sourceTable "lead" sem cart items): inserir/atualizar registro em `crm_lead_contacts`.

### 2c. Nova mutation: `updateLeadContactStatus`

Para converter ou descartar leads contatados sem carrinho.

### 2d. Corrigir `handleWhatsApp`

Adicionar tratamento para leads do tipo "new":

```text
if (lead.sourceTable === "lead" && lead.type === "abandoned") {
  markContacted.mutate(lead.id);
} else if (lead.sourceTable === "lead" && lead.type === "new") {
  markLeadContacted.mutate(lead.id);  // NOVO
} else if (lead.sourceTable === "customer") {
  markCustomerContacted.mutate(lead.id);
}
```

### 2e. Corrigir drag & drop (`handleDrop`)

Distinguir leads com carrinho vs sem carrinho:

```text
if (data.sourceTable === "lead" && data.type === "new") {
  markLeadContacted.mutate(data.id);
} else if (data.sourceTable === "lead") {
  markContacted.mutate(data.id);
} else if (data.sourceTable === "customer") {
  markCustomerContacted.mutate(data.id);
}
```

### 2f. Excluir leads ja contatados da lista "Novos Cadastros"

Na query de `newLeads`, alem de excluir leads com cart items, tambem excluir leads que ja tem registro em `crm_lead_contacts`.

### 2g. Incluir leads contatados sem carrinho na coluna "Contatados"

Mesclar a nova query com `contactedLeads` e `contactedCustomers` no `allContacted`.

### 2h. Atualizar contagem no card "Novos Cadastros"

Contagem ja reflete automaticamente com a exclusao do item 2f.

## Resumo de arquivos alterados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Criar tabela `crm_lead_contacts` com RLS |
| `src/pages/WhatsAppCRM.tsx` | Adicionar query de leads contatados sem carrinho. Adicionar mutations `markLeadContacted` e `updateLeadContactStatus`. Corrigir `handleWhatsApp` e `handleDrop` para tratar leads "new". Excluir leads contatados da query "Novos Cadastros". Mesclar na coluna "Contatados". |

