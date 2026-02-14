

# Corrigir Favicon Dinâmico + PWA com Identidade Personalizada

## Problemas Identificados

1. **Favicon nao atualiza no navegador**: Os browsers fazem cache agressivo do favicon. Apenas trocar o `href` nao forca o reload. Precisa de cache-busting (ex: `?v=timestamp`).

2. **`apple-touch-icon` nao e atualizado**: Quando o usuario salva como webapp no iPhone, o iOS usa o `<link rel="apple-touch-icon">`, que continua apontando para `/icon-192.png` (icone padrao do Venda PROFIT).

3. **`manifest.json` e estatico**: Quando o usuario "Adiciona a Tela Inicial" (PWA), o navegador le o `manifest.json` que tem `name: "Venda PROFIT"` e icones fixos. Precisamos gerar um manifest dinamico por loja.

4. **Cast desnecessario `(store as any)`**: A interface `StoreData` ja tem `favicon_url` e `page_title`, mas o codigo usa `as any`.

---

## Correcoes

### 1. StoreCatalog.tsx -- Favicon com cache-busting + apple-touch-icon

No `useEffect` existente:

- Ao trocar o favicon, adicionar `?v={Date.now()}` ao URL para forcar o browser a recarregar
- Tambem atualizar o `<link rel="apple-touch-icon">` com o mesmo URL do favicon personalizado
- Remover os casts `(store as any)` -- usar `store.favicon_url` e `store.page_title` diretamente
- No cleanup, restaurar ambos (icon e apple-touch-icon)

### 2. StoreCatalog.tsx -- Manifest dinamico para PWA

Adicionar no mesmo `useEffect`:

- Se o lojista tem `favicon_url`, `page_title` ou `store_name`:
  - Criar um objeto manifest dinamico com `name`, `short_name` e `icons` personalizados
  - Converter para Blob URL e substituir o `href` do `<link rel="manifest">` no `<head>`
  - O `start_url` sera `/{store_slug}` para que o PWA abra direto na loja
- No cleanup, restaurar o manifest original (`/manifest.json`)

Isso garante que ao "Adicionar a Tela Inicial", o PWA usa o nome e icone do lojista.

### 3. PublicBag.tsx -- Mesmas correcoes

Aplicar a mesma logica de cache-busting no favicon e apple-touch-icon. Para o manifest, como a bolsa publica e temporaria, apenas favicon + titulo sao suficientes (sem PWA install).

---

## Detalhes Tecnicos

### Logica do favicon com cache-busting

```text
const bustUrl = faviconUrl + (faviconUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();

// Atualizar favicon
link.href = bustUrl;

// Atualizar apple-touch-icon
const appleIcon = document.querySelector("link[rel='apple-touch-icon']");
if (appleIcon) appleIcon.href = bustUrl;
```

### Logica do manifest dinamico

```text
const dynamicManifest = {
  name: store.page_title || store.store_name || "Venda PROFIT",
  short_name: store.store_name || "Loja",
  start_url: "/" + store.store_slug,
  display: "standalone",
  background_color: store.background_color || "#ffffff",
  theme_color: store.primary_color || "#DA2576",
  icons: [
    { src: store.favicon_url, type: "image/png", sizes: "192x192" },
    { src: store.favicon_url, type: "image/png", sizes: "512x512" }
  ]
};
const blob = new Blob([JSON.stringify(dynamicManifest)], { type: "application/json" });
const manifestUrl = URL.createObjectURL(blob);
manifestLink.href = manifestUrl;
```

### Arquivos alterados

1. `src/pages/StoreCatalog.tsx` -- corrigir useEffect (favicon cache-busting, apple-touch-icon, manifest dinamico, remover `as any`)
2. `src/pages/PublicBag.tsx` -- corrigir useEffect (favicon cache-busting, apple-touch-icon)

### Nenhuma migracao necessaria

Todos os campos ja existem no banco.

