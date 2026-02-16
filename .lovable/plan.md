

# Correcao do Botao Gold "Minha Loja"

## Problemas Identificados

1. **404**: O botao abre a URL `/l/${storeSlug}`, mas o roteamento do app usa `/:slug` (sem o prefixo `/l/`). Isso faz a URL nao corresponder a nenhuma rota valida.
2. **Nome**: O botao mostra "Minha Loja" e precisa ser renomeado para "Ver Minha Loja".

## Solucao

### Arquivo: `src/components/layout/Sidebar.tsx`

Duas mudancas simples:

1. **Corrigir URL** (linha 133): Trocar `/l/${storeSlug}` por `/${storeSlug}`

```
// De:
window.open(`${window.location.origin}/l/${storeSlug}`, "_blank");

// Para:
window.open(`${window.location.origin}/${storeSlug}`, "_blank");
```

2. **Renomear botao** (linha ~188): Trocar o texto de "Minha Loja" para "Ver Minha Loja"

| Arquivo | Acao |
|---------|------|
| `src/components/layout/Sidebar.tsx` | Corrigir URL e renomear botao |

