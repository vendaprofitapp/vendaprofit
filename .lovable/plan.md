
# Sistema Completo de Planos de Assinatura

## Situação atual
- Existem **8 usuários já cadastrados** no sistema
- Não existe nenhuma tabela de planos ainda (`user_subscriptions` não existe)
- A lógica de plano atual (`user_plan`) mencionada na memória do projeto não foi implementada no código React — o campo não existe no banco de dados atual

---

## Proteção dos usuários já cadastrados

**Regra crítica:** Todos os 8 usuários existentes receberão automaticamente o plano **Premium Mensal** com `expires_at = próximo dia 01` (01/03/2026), com `status = active`. Isso garante que nenhum usuário ativo seja bloqueado ou tenha funcionalidades removidas.

A migração SQL fará isso com um `INSERT ... SELECT` para todos os `profiles` existentes no momento da migração.

---

## Migração SQL — O que será criado

### Tabela `user_subscriptions`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Chave primária |
| `user_id` | uuid | Referência ao `profiles.id` |
| `plan_type` | text | `trial`, `basic_monthly`, `basic_annual`, `premium_monthly`, `premium_annual` |
| `status` | text | `active`, `expired`, `cancelled` |
| `started_at` | timestamptz | Início do plano |
| `expires_at` | timestamptz | Vencimento |
| `product_count_limit` | integer | 10 no trial, NULL nos demais |
| `onboarding_completed` | boolean | Para saber se já fez o wizard |
| `notes` | text | Observações do admin |
| `updated_by_admin` | uuid | Último admin que alterou |
| `created_at` / `updated_at` | timestamptz | Timestamps |

### Trigger de trial para novos usuários
Ao criar um novo registro em `profiles`, um trigger insere automaticamente um plano `trial` com `expires_at = now() + 5 days` e `product_count_limit = 10`.

### Migração dos usuários existentes
```sql
INSERT INTO user_subscriptions (user_id, plan_type, status, started_at, expires_at, product_count_limit, onboarding_completed)
SELECT id, 'premium_monthly', 'active', now(),
  date_trunc('month', now()) + interval '2 months',  -- dia 01 do próximo mês (01/03/2026)
  NULL, true
FROM profiles;
```

### RLS Policies
- Usuário vê apenas o próprio registro (`user_id = auth.uid()`)
- Admin (via `has_role`) pode ver e editar todos

---

## Arquivos criados/modificados

### 1. `src/hooks/usePlan.tsx` — Novo hook central

Retorna o estado do plano do usuário logado:

```typescript
{
  plan, planType, tier,   // "trial" | "basic" | "premium"
  isExpired, isPremium, isBasic, isTrial,
  daysLeft, productLimit,  // null = sem limite
  loading
}
```

Lógica:
- Busca `user_subscriptions` onde `user_id = auth.uid()`
- Calcula `isExpired` comparando `expires_at` com `now()`
- Deriva `tier`: planos `premium_*` = premium; `basic_*` = basic; `trial` = trial

### 2. `src/components/PlanGate.tsx` — Componente de bloqueio

Envolve itens que requerem Premium. Para usuários `basic` ou `trial`:
- Renderiza o item com **50% de opacidade**
- Exibe um **ícone de coroa dourada** (👑)
- Ao clicar, abre um **modal** explicando que a funcionalidade é Premium e listando os planos disponíveis

Funcionalidades bloqueadas para Basic/Trial:
- Consórcios (`/consortiums`)
- Bazar VIP (`/admin/bazar`)
- Pontos Parceiros (`/partner-points`)
- Redes Sociais / Google (`/marketing`)
- Fidelidade (`/admin/fidelidade`)
- Incentivos (`/marketing/incentivos`)
- Área Secreta (`/marketing/area-secreta`)
- Pedidos B2B (`/b2b-orders`)

### 3. `src/pages/PlanExpired.tsx` — Tela de bloqueio

Exibida quando o plano expirou. O usuário não acessa nenhuma outra rota interna. Mostra mensagem amigável e opções de contato/renovação.

### 4. `src/App.tsx` — ProtectedRoute atualizado

```
Usuário não logado → /auth
Usuário com plano expirado (não admin) → /plano-expirado
Caso contrário → renderiza normalmente
```

Nova rota adicionada: `/plano-expirado`

### 5. `src/components/layout/Sidebar.tsx` — Coroas nos itens Premium

Os itens bloqueados no `navGroups` são envolvidos pelo `PlanGate` e recebem visualmente a coroa dourada ao lado do label, com click handler abrindo o modal de upgrade em vez de navegar.

### 6. `src/components/stock/ProductFormDialog.tsx` — Limite de 10 produtos no trial

Antes de abrir o formulário de criação (não edição), o hook `usePlan` é consultado:
- Se `isTrial` e `productCount >= 10`: exibe alerta bloqueando o cadastro com mensagem explicativa

### 7. `src/pages/AdminUsers.tsx` — Painel admin reformulado

**Cards de resumo no topo:**
- Total de usuários
- Trials ativos
- Básicos ativos
- Premiums ativos
- Expirados

**Tabela de usuários com novas colunas:**
- Nome / Email
- Tipo de Plano (badge colorido)
- Vencimento + status (Ativo / Expira em X dias / Expirado)
- Admin (switch)
- Botão "Gerenciar Plano"

**Drawer "Gerenciar Plano":**
- Dropdown: tipo de plano (6 opções)
- Campo de data de vencimento
- Campo de observações
- Botão Salvar (atualiza `user_subscriptions`)

### 8. `src/pages/Dashboard.tsx` — Onboarding após primeiro plano pago

O `OnboardingWizard` será exibido automaticamente quando:
- `onboarding_completed = false` no registro de `user_subscriptions`
- O tier atual for `basic` ou `premium` (não trial)

Após concluir, marca `onboarding_completed = true`.

---

## Fluxo completo para novos usuários

```text
Cadastro → Trial 5 dias (máx. 10 produtos)
    ↓ expira
Tela de Plano Expirado (não consegue acessar o sistema)
    ↓ admin atribui plano
Premium ou Basic → OnboardingWizard aparece → Sistema liberado
```

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/...` | Criar `user_subscriptions` + trigger de trial + migrar 8 usuários para Premium Mensal |
| `src/hooks/usePlan.tsx` | Criar — hook central de plano |
| `src/components/PlanGate.tsx` | Criar — bloqueio visual com coroa |
| `src/pages/PlanExpired.tsx` | Criar — tela de plano expirado |
| `src/App.tsx` | Atualizar `ProtectedRoute` + nova rota `/plano-expirado` |
| `src/components/layout/Sidebar.tsx` | Adicionar `PlanGate` nos itens Premium |
| `src/pages/AdminUsers.tsx` | Reformulação completa com gestão de planos |
| `src/components/stock/ProductFormDialog.tsx` | Limite de 10 produtos no trial |
| `src/pages/Dashboard.tsx` | Onboarding após primeiro plano pago |
