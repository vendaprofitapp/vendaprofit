

# Fix: "Ver Minha Loja" Abrindo na Aba Atual

## Problema

Ao clicar no botao, a nova aba abre corretamente, mas a aba atual tambem navega para a URL da loja. Isso acontece por causa de comportamento inconsistente do `window.open` em alguns navegadores.

## Solucao

Trocar o `<button>` + `window.open` por um `<a>` com `target="_blank"` e `rel="noopener noreferrer"`. Essa e a forma mais confiavel de abrir um link em nova aba sem afetar a aba atual.

### Arquivo: `src/components/layout/Sidebar.tsx`

**Mudancas:**

1. Quando `storeSlug` existe: renderizar um `<a href="/{slug}" target="_blank" rel="noopener noreferrer">` com o estilo gold
2. Quando nao existe slug: renderizar um `<button>` que navega para `/my-store` (configuracoes)
3. Remover a funcao `handleVisitStore` e o `window.open`

**Logica simplificada:**

```
Se tem storeSlug:
  <a href="/{slug}" target="_blank"> Ver Minha Loja </a>
Senao:
  <button onClick={navigate('/my-store')}> Ver Minha Loja </button>
```

Ambos manterao o mesmo estilo dourado.

| Arquivo | Acao |
|---------|------|
| `src/components/layout/Sidebar.tsx` | Trocar button/window.open por tag `<a>` com target="_blank" |

