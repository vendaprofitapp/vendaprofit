
# Correção Completa do Importador NewHype (Dooca Commerce)

## Diagnóstico Confirmado por Teste Real

Executei chamadas diretas ao edge function com dados reais do site newhype.com.br e identifiquei 3 problemas distintos:

---

### Problema 1 — Campo "Filtro de Busca" com valor padrão "top" zera os resultados

No `SupplierBulkImportDialog.tsx`, linha 150:
```typescript
const [searchFilter, setSearchFilter] = useState("top");
```

Quando o usuário clica em "Descobrir Produtos", o sistema envia `search: "top"` para o `map-supplier-site`. O edge function então filtra apenas URLs que contêm a string "top" no caminho. As URLs da NewHype são:
- `/conjunto-pump/preto`
- `/macaquinho-speed/verde-menta`
- `/colete-like/purpura`
- `/regata-tule/preto`

Nenhuma contém "top", então `productUrls` retorna vazio (`[]`). O usuário vê "Nenhum produto encontrado" mesmo com 90+ produtos no site.

**Fix:** Mudar o valor padrão de `searchFilter` de `"top"` para `""` (vazio), e atualizar o placeholder e descrição do campo para deixar claro que o filtro é opcional.

---

### Problema 2 — Combos aparecem junto com produtos individuais

Com `search: ""`, os `productUrls` retornados incluem tanto peças individuais quanto combos:
- Peças: `conjunto-pump/preto`, `macaquinho-speed/verde-menta` (5 segmentos)
- Combos: `combo-premium-352`, `combo-premium-376` (4 segmentos)

Os combos passam no filtro genérico de 4 partes porque têm hífen e correspondem ao padrão `/^[a-z0-9]+-[a-z0-9]/`. A exclusão de "combo" na `doocaCategorySlugs` só funciona para o slug exato `"combo"`, não para `"combo-premium-352"` (que é um slug composto).

**Fix no `map-supplier-site`:** Adicionar regra para excluir slugs de 4 partes que **começam** com palavras de categoria (como `combo-`, `kit-`, `novidade-`, etc.) em vez de apenas verificar igualdade exata.

---

### Problema 3 — `extractNameFromUrl` extrai a COR como nome do produto

Em `SupplierBulkImportDialog.tsx`, linha 520-530:
```typescript
const extractNameFromUrl = (url: string): string => {
  const path = new URL(url).pathname;
  const slug = path.split("/").filter(Boolean).pop() || ""; // ← pega "preto" de /conjunto-pump/preto
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};
```

Para URLs Dooca (`/produto/cor`), o `pop()` retorna o **último segmento** — que é a cor. Então `conjunto-pump/preto` vira `"Preto"` no nome, em vez de `"Conjunto Pump"`.

Este fallback é usado quando o scraping individual falha. Com a extração de nomes via `scrape-product-images`, o `h1` ou JSON-LD podem retornar `"CONJUNTO PUMP PRETO"` — onde a cor está concatenada e precisa ser separada pelo `extractBaseName` da linha 268.

**Fix no `SupplierBulkImportDialog.tsx`:** Atualizar `extractNameFromUrl` para, em URLs com 2+ segmentos no path, usar o **penúltimo** segmento (o nome do produto) em vez do último (a cor).

---

## Correções a Implementar

### Arquivo 1: `src/components/stock/SupplierBulkImportDialog.tsx`

**Mudança 1a — Valor padrão do searchFilter:**
```typescript
// ANTES:
const [searchFilter, setSearchFilter] = useState("top");

// DEPOIS:
const [searchFilter, setSearchFilter] = useState("");
```

**Mudança 1b — extractNameFromUrl para Dooca:**
```typescript
const extractNameFromUrl = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const parts = path.split("/").filter(Boolean);
    // Para URLs Dooca (produto/cor), usar penúltimo segmento como nome
    const slug = parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1] || "";
    return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return "Produto";
  }
};
```

**Mudança 1c — Placeholder do campo filtro:**
```typescript
// Atualizar placeholder e descrição
placeholder="conjunto, top, vestido... (deixe vazio para todos)"
// Descrição:
"Filtra URLs que contêm esta palavra (opcional — deixe vazio para importar tudo)"
```

---

### Arquivo 2: `supabase/functions/map-supplier-site/index.ts`

**Mudança 2a — Excluir slugs que COMEÇAM com prefixos de categoria:**

Na seção de filtragem para URLs de 4 partes, adicionar verificação de prefixo:

```typescript
// Exclude slugs starting with category prefixes (combos, kits, novidades)
const categoryPrefixes = ['combo-', 'kit-', 'novidade-', 'lancamento-', 'sale-', 'outlet-'];
if (categoryPrefixes.some(prefix => slug.startsWith(prefix))) return false;
```

Isso excluirá `combo-premium-352`, `combo-premium-376`, etc. sem afetar slugs válidos de produtos.

---

## Resumo das Mudanças

| # | Arquivo | Linha(s) | Mudança |
|---|---------|----------|---------|
| 1 | `SupplierBulkImportDialog.tsx` | 150 | `searchFilter` padrão: `"top"` → `""` |
| 2 | `SupplierBulkImportDialog.tsx` | 520–530 | `extractNameFromUrl` usa penúltimo segmento para Dooca |
| 3 | `SupplierBulkImportDialog.tsx` | 742–748 | Placeholder e descrição do campo filtro atualizados |
| 4 | `map-supplier-site/index.ts` | ~132–144 | Excluir slugs com prefixos de categoria (`combo-`, `kit-`, etc.) |

---

## Resultado Esperado Após a Correção

Ao abrir "Importar do Site" com o fornecedor **NEW HYPE**:

1. O campo "Filtro" começa vazio — ao clicar "Descobrir Produtos", todos os ~90 produtos são encontrados
2. Se o usuário quiser filtrar, pode digitar `conjunto`, `macaquinho`, `regata`, etc.
3. Os combos (`combo-premium-352`) **não aparecem** na lista
4. Produtos como `conjunto-pump/preto` aparecem com nome **"Conjunto Pump"** (não "Preto")
5. Ao importar, o nome do produto fica correto e a cor vai para o campo "Cor (filtro)"
