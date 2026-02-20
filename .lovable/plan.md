
# Admins: Acesso Total Sem Restrições de Plano

## Problema identificado

O `usePlan` hook busca apenas os dados de `user_subscriptions` e deriva o tier a partir do tipo de plano. Ele **não verifica se o usuário é admin**. Isso causa dois problemas:

1. **`PlanGate`**: bloqueia funcionalidades Premium mesmo para admins que possam ter um plano Basic ou sem plano.
2. **`usePlan`**: retorna `isExpired = true` para admins cujo plano venceu, o que poderia redirecioná-los para `/plano-expirado` (protegido no `ProtectedRoute`, mas o hook em si retorna valores errados para outros componentes).

O `ProtectedRoute` em `App.tsx` já corretamente deixa admins passarem mesmo com plano expirado (`if (isExpired && !isAdmin)`), mas o `PlanGate` e outros componentes que usam `usePlan` não têm essa mesma lógica.

## Solução

### 1. `src/hooks/usePlan.tsx` — Adicionar verificação de admin

O hook fará uma chamada para `has_role` (RPC do banco) para verificar se o usuário é admin. Se for admin:
- `isPremium` → sempre `true`
- `isBasic` → `false`
- `isTrial` → `false`
- `isExpired` → sempre `false`
- `productLimit` → `null` (sem limite)
- `tier` → `"premium"`

A verificação é feita no mesmo `useEffect` que busca o plano, em paralelo.

```typescript
// Dentro do usePlan hook:
const [isAdmin, setIsAdmin] = useState(false);

// Busca admin em paralelo
useEffect(() => {
  if (!user) return;
  supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })
    .then(({ data }) => setIsAdmin(!!data));
}, [user]);

// No retorno:
return {
  ...
  isPremium: isAdmin || tier === "premium",
  isBasic: !isAdmin && tier === "basic",
  isTrial: !isAdmin && tier === "trial",
  isExpired: isAdmin ? false : isExpiredValue,
  productLimit: isAdmin ? null : plan?.product_count_limit ?? null,
  tier: isAdmin ? "premium" : tier,
};
```

### 2. `src/pages/AdminUsers.tsx` — Coluna "Admin" não precisa de vencimento

Na tabela de usuários, quando um usuário é marcado como **Admin**, a coluna de "Vencimento" exibirá um badge especial **"Acesso Total"** em vez de data e dias restantes. O drawer de "Gerenciar Plano" também exibirá essa informação claramente.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/hooks/usePlan.tsx` | Adicionar verificação `has_role` para admin; sobrescrever tier/expired/limit para admins |
| `src/pages/AdminUsers.tsx` | Badge "Acesso Total" para usuários admin na coluna de vencimento |

## Por que essa abordagem é segura

- A verificação de admin usa `has_role` via RPC do banco com `SECURITY DEFINER`, que é a mesma função usada no `ProtectedRoute` — consistente e segura.
- Não há hardcode de IDs ou verificação client-side de role.
- Admin continua sendo definido apenas pela tabela `user_roles` no banco.
