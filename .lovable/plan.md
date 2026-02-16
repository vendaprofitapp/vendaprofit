
# WhatsApp CRM - Permitir arrastar clientes inativos e aniversariantes

## Problema
Ao arrastar um cliente inativo ou aniversariante no Kanban, o sistema bloqueia a acao e exibe um toast "Cliente inativo - contate via WhatsApp" em vez de permitir que o usuario mova o card livremente para a coluna "Contatados".

## Solucao

Criar uma tabela no banco de dados para registrar quando clientes (birthday/inactive) sao marcados como contatados, e permitir o drag-and-drop livre para todos os tipos de leads/clientes.

### 1. Nova tabela: `crm_customer_contacts`

Armazena o status de contato de clientes (que nao possuem `lead_cart_items`).

```text
crm_customer_contacts
---------------------
id           UUID (PK)
customer_id  UUID (referencia customers.id)
owner_id     UUID
status       TEXT (contacted, converted, cancelled)
created_at   TIMESTAMPTZ
```

Com politica RLS para que cada usuario veja apenas seus proprios registros.

### 2. Arquivo: `src/pages/WhatsAppCRM.tsx`

**Remover:**
- O bloco no `handleDrop` que verifica `sourceTable === "customer"` e exibe toast bloqueando a acao

**Adicionar:**
- Nova mutation `markCustomerContacted` que insere um registro em `crm_customer_contacts` com status "contacted"
- Nova query para buscar clientes ja contatados da tabela `crm_customer_contacts`
- No `handleDrop`, quando `sourceTable === "customer"`, chamar `markCustomerContacted` em vez de bloquear
- Filtrar clientes contatados da lista de "Pendentes" (birthday/inactive)
- Exibir clientes contatados na coluna "Contatados" junto com os leads contatados
- Botoes de "Converter" e "Descartar" tambem funcionam para clientes contatados (atualizando o status na nova tabela)

### Fluxo apos a mudanca

```text
Pendentes                          Contatados
+----------------------------+     +----------------------------+
| [Inativo] Maria            |     | [Contatado] Joao           |
| [Chamar no WhatsApp]       | --> | [Follow-up] [Converter] [X]|
| (arrastar livremente)      |     |                            |
+----------------------------+     +----------------------------+
```

## Detalhes tecnicos

| Item | Detalhe |
|------|---------|
| Nova tabela | `crm_customer_contacts` com RLS por `owner_id` |
| Arquivo alterado | `src/pages/WhatsAppCRM.tsx` |
| Queries novas | Buscar clientes contatados, mutation para inserir/atualizar status |
| Sem dependencias novas | Usa apenas o que ja existe no projeto |
