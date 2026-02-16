

# Botao Gold "Minha Loja" como Atalho para a Pagina Publica

## Problema

O botao dourado "Minha Loja" atualmente leva para `/my-store`, que e a pagina de **configuracoes** da loja. O usuario quer que esse botao seja um atalho para **visitar** a loja publica (URL `/{store_slug}`), e que a configuracao volte a aparecer no grupo "Sistema".

## Mudancas

### 1. Sidebar (`src/components/layout/Sidebar.tsx`)

**Botao Gold - Mudar comportamento:**
- Em vez de um `<Link to="/my-store">`, o botao vai buscar o `store_slug` do usuario no banco e abrir a URL publica da loja em uma nova aba (`window.open`)
- Adicionar um estado/efeito para carregar o slug da loja do usuario logado
- Se o usuario ainda nao configurou a loja, redirecionar para `/my-store` (configuracoes)

**Restaurar "Minha Loja" no grupo Sistema:**
- Adicionar de volta `{ icon: Store, label: "Minha Loja", path: "/my-store" }` no grupo "Sistema" dos `navGroups`

### 2. Logica do botao gold

```
- Ao montar o componente, buscar store_settings do usuario logado
- Se encontrou store_slug:
    - Botao abre nova aba com window.open(`${baseUrl}/${slug}`)
- Se nao encontrou:
    - Botao navega para /my-store (configuracoes) com toast avisando para configurar
```

### Detalhe tecnico

- Adicionar query ao Supabase: `store_settings` filtrado por `owner_id = user.id` para obter o slug
- O botao gold usa `<button>` em vez de `<Link>`, com `onClick` que faz `window.open(storeUrl, '_blank')`
- Icone `ExternalLink` pode ser adicionado ao lado do `Store` para indicar que abre externamente

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/components/layout/Sidebar.tsx` | Modificar botao gold + restaurar item em Sistema |

