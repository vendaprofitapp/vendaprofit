

# Fix: "Ver Minha Loja" no iOS WebApp (Standalone Mode)

## Problema

No iOS, quando o app roda como WebApp (modo standalone/PWA), tanto `target="_blank"` quanto `window.open` abrem a URL dentro do proprio WebApp, substituindo a tela atual. Isso e uma limitacao conhecida do Safari em modo standalone -- ele nao tem conceito de "abas".

## Solucao

Detectar se o app esta rodando em modo standalone (PWA) e, nesse caso, usar `navigator.share()` para permitir ao usuario abrir o link no Safari. Se `navigator.share` nao estiver disponivel, copiar o link para a area de transferencia e mostrar um aviso (toast).

Em navegadores normais (desktop, mobile browser), o comportamento atual com `<a target="_blank">` sera mantido.

## Mudancas

### Arquivo: `src/components/layout/Sidebar.tsx`

1. **Criar funcao auxiliar** `isStandaloneMode()` que detecta se o app roda como PWA:
   - Checa `(window.navigator as any).standalone === true` (iOS Safari)
   - Checa `window.matchMedia('(display-mode: standalone)').matches` (Android/outros)

2. **Modificar o botao gold** quando `storeSlug` existe:
   - Sempre renderizar como `<a target="_blank">` (funciona em navegadores normais)
   - No `onClick`, se estiver em modo standalone:
     - Chamar `e.preventDefault()` para impedir a navegacao
     - Tentar `navigator.share({ url })` para abrir no Safari
     - Se share nao disponivel, copiar URL com `navigator.clipboard.writeText()` e mostrar toast

3. **Importar** `toast` de sonner para feedback ao usuario

### Logica resumida

```
onClick(e) {
  if (isStandaloneMode()) {
    e.preventDefault();
    const url = `${window.location.origin}/${storeSlug}`;
    
    if (navigator.share) {
      navigator.share({ title: 'Minha Loja', url });
    } else {
      navigator.clipboard.writeText(url);
      toast('Link copiado! Cole no navegador para abrir.');
    }
  }
  // Em navegador normal, o <a target="_blank"> funciona normalmente
}
```

| Arquivo | Acao |
|---------|------|
| `src/components/layout/Sidebar.tsx` | Adicionar deteccao de standalone + share/clipboard fallback |

