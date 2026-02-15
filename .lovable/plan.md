

# Corrigir Formulario Mobile (Teclado) + Deteccao Automatica de Cliente Retornante

## Problema 1 — Formulario sumindo quando teclado abre no mobile

O Drawer (vaul) usa `max-h-[85dvh]` e posicionamento `fixed bottom-0`. Quando o teclado virtual abre no iOS/Android, o viewport visual encolhe mas o `dvh` nao se ajusta de forma confiavel em todos os navegadores. O formulario fica "preso" atras do teclado ou e empurrado para fora da tela.

### Solucao

Substituir o Drawer por uma abordagem de **tela cheia fixa** no mobile que funciona com teclado em ambos iOS e Android:

**Arquivo: `src/components/catalog/LeadCaptureSheet.tsx`**

1. No mobile, usar `position: fixed; inset: 0` com `overflow-y: auto` — uma tela cheia simples que nao sofre com o resize do viewport pelo teclado
2. Usar `visualViewport` API para detectar quando o teclado abre e ajustar o padding-bottom dinamicamente, garantindo que o botao de submit fique sempre visivel
3. Adicionar `inputMode="text"` no campo nome e manter `inputMode="tel"` no WhatsApp para evitar problemas de foco no iOS
4. Remover `autoFocus` que causa abertura automatica do teclado (atrapalha a experiencia no mobile)
5. No `scrollInputIntoView`, usar `scrollIntoView({ block: "nearest" })` ao inves de `"center"` para evitar saltos bruscos no iOS Safari

A implementacao alternativa:
- Manter o Drawer mas adicionar CSS que responde ao `visualViewport.resize` event
- Quando teclado abre: setar `max-height` para `visualViewport.height` ao inves de `85dvh`
- Isso garante que o conteudo do drawer se ajuste ao espaco disponivel acima do teclado

**Abordagem escolhida**: Usar o VisualViewport API dentro do proprio Drawer, pois mantem a UX nativa de "puxar para fechar" que o vaul oferece. Isso funciona tanto em iOS quanto Android.

```text
Drawer abre -> max-h-[85dvh]
Teclado abre -> useEffect detecta visualViewport.resize
             -> ajusta max-height para visualViewport.height
             -> scrollIntoView do input focado
Teclado fecha -> restaura max-h original
```

---

## Problema 2 — Deteccao automatica de cliente que ja comprou

### Como funciona hoje

O sistema usa `localStorage` com a chave `store_lead_{slug}` para armazenar nome/whatsapp do cliente. Se essa chave existe, o formulario de captura nao aparece e o cliente adiciona direto ao carrinho.

**Limitacao**: Se o cliente limpar o cache do navegador, trocar de celular, ou usar outro navegador, o `localStorage` e perdido e ele tera que se cadastrar novamente.

### Solucao: Deteccao por WhatsApp via banco de dados

Quando o cliente preenche o formulario pela segunda vez (porque perdeu o localStorage), o sistema deve:

1. **Ao submeter o formulario**: Antes de criar um novo lead, buscar na tabela `store_leads` se ja existe um registro com o mesmo `whatsapp` + `store_id`
2. **Se encontrar**: Reutilizar o `lead_id` existente, atualizar `last_seen_at`, e restaurar o localStorage com os dados do lead existente
3. **Vincular com `customers`**: Buscar na tabela `customers` se existe um cliente com o mesmo `phone` (whatsapp) e `owner_id`. Se existir, o sistema sabe que e um cliente que ja comprou

**Arquivo: `src/pages/StoreCatalog.tsx`** — funcao `saveLeadData`

Alterar o fluxo de upsert:
- Mudar o `onConflict` de `"store_id,device_id"` para buscar primeiro por `store_id + whatsapp`
- Se encontrar lead existente, reutilizar o `id` dele
- Isso garante que mesmo em dispositivo novo, o whatsapp vincula ao historico anterior

**Arquivo: `src/pages/StoreCatalog.tsx`** — funcao `addToCart` / `getStoredLead`

Sem mudanca necessaria — o `getStoredLead` continuara funcionando pois o localStorage sera restaurado apos o upsert.

### Fluxo completo do cliente retornante

```text
Cliente volta a loja (novo dispositivo ou cache limpo)
  -> Clica em adicionar ao carrinho
  -> localStorage vazio -> abre formulario
  -> Digita nome e WhatsApp
  -> Sistema busca: SELECT * FROM store_leads WHERE store_id = X AND whatsapp = Y
  -> Se encontrar:
       -> Reutiliza lead_id existente
       -> Atualiza last_seen_at
       -> Salva no localStorage
       -> Toast: "Bem-vindo(a) de volta, [nome]!"
  -> Se nao encontrar:
       -> Cria novo lead normalmente
       -> Toast: "Bem-vindo(a), [nome]!"
```

---

## Resumo dos arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/catalog/LeadCaptureSheet.tsx` | Hook de VisualViewport para ajustar drawer ao teclado; remover autoFocus; melhorar scrollIntoView |
| `src/pages/StoreCatalog.tsx` | Alterar `saveLeadData` para buscar lead existente por whatsapp antes de criar novo; exibir toast de "volta" |

