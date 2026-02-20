
# Correção: Detector de Conjuntos — "Nenhum estoque de parceiro disponível"

## Diagnóstico completo

A sociedade 1-1 entre teamwodbrasil e isabellegalx1 existe corretamente:
- Grupo `23198f24` com `is_direct: true`
- 672 produtos compartilhados no `product_partnerships`
- 122 produtos da parceira com estoque > 0 acessíveis via RLS

O banco de dados está correto. O problema é **exclusivamente no código JavaScript** da página `StockSetDetector.tsx`, em dois pontos:

### Problema 1 — URL excessivamente longa (causa principal da falha)

A query atual faz **duas chamadas ao banco em sequência**:

1. Busca todos os `product_id` de `product_partnerships` → retorna **até 672 IDs**
2. Usa esses IDs num `.in("id", productIds)` na tabela `products`

Com 672 IDs, a cláusula `.in()` gera uma URL de requisição GET que pode **ultrapassar o limite de tamanho de URL** (~8KB), fazendo a requisição falhar silenciosamente (retornando array vazio `[]`). Isso explica exatamente o erro mostrado.

### Problema 2 — Correspondência de cores inconsistente

Mesmo quando os produtos são carregados, o matching de `color_label` falha porque há:
- Espaços extras no início/fim: `" Amarelo"` vs `"Amarelo"`, `"café "` vs `"Café"`
- Capitalização mista: `"verde Jade"` vs `"Verde Jade"` vs `"verde jade"`

A função `normalizeStr` remove acentos e faz lowercase, então o trim e lowercase já ajudam, mas há casos como `"verde Jade"` vs `"Verde Jade"` onde após normalização ficaria `"verde jade"` vs `"verde jade"` — isso funcionaria. O problema real de espaço (`" Amarelo"` → `" amarelo"` vs `"Amarelo"` → `"amarelo"`) é resolvido pelo `.trim()` já presente.

Portanto o **único problema real** é o Problema 1 — a URL longa.

## Solução

### Substituir a abordagem de duas queries por um JOIN direto

Em vez de buscar os `product_id` e depois usar `.in()`, fazer **uma única query** que já une `product_partnerships` com `products` diretamente, evitando a URL longa.

**Query atual (problemática):**
```javascript
// Query 1: busca IDs
const { data: partnerships } = await supabase
  .from("product_partnerships")
  .select("product_id")
  .in("group_id", groupIds);

const productIds = Array.from(new Set(...)); // até 672 IDs

// Query 2: usa 672 IDs num .in() → URL gigante
const { data } = await supabase
  .from("products")
  .select("...")
  .in("id", productIds)  // PROBLEMA: URL muito longa
  .neq("owner_id", user!.id)
  .eq("is_active", true)
  .gt("stock_quantity", 0);
```

**Query nova (corrigida):**
```javascript
// Uma única query via join reverso pelo Supabase
// Usa product_partnerships!inner para filtrar diretamente
const { data } = await supabase
  .from("products")
  .select(`
    id, name, color_label, size, price, stock_quantity,
    image_url, main_category, subcategory, owner_id,
    product_variants(id, size, stock_quantity),
    product_partnerships!inner(group_id)
  `)
  .in("product_partnerships.group_id", groupIds)
  .neq("owner_id", user!.id)
  .eq("is_active", true)
  .gt("stock_quantity", 0)
  .order("name");
```

Porém o Supabase JS não suporta filtros aninhados no `.in()` de relacionamentos diretamente. A alternativa correta é usar uma **função RPC** ou **reformular a query** para passar o `group_id` como filtro principal.

### Abordagem alternativa robusta: usar `product_partnerships` como tabela principal com embedding de `products`

```javascript
const { data: rawData } = await supabase
  .from("product_partnerships")
  .select(`
    product_id,
    products!inner(
      id, name, color_label, size, price, stock_quantity,
      image_url, main_category, subcategory, owner_id,
      product_variants(id, size, stock_quantity)
    )
  `)
  .in("group_id", groupIds)
  .neq("products.owner_id", user!.id)
  .eq("products.is_active", true)
  .gt("products.stock_quantity", 0);

// Extrair e deduplicar
const seen = new Set<string>();
const products = (rawData || [])
  .map((r: any) => r.products)
  .filter((p: any) => p && !seen.has(p.id) && seen.add(p.id));
```

Esta abordagem elimina completamente a etapa intermediária de acumulação de IDs, passando um único `group_id` na query.

**Atenção:** Filtros aninhados (`neq("products.owner_id", ...)`) podem não funcionar no Supabase JS. A filtragem por `owner_id` e `is_active` será feita no **JavaScript** após receber os dados, que é seguro pois a RLS já garante que só produtos autorizados são retornados.

### Query final limpa:

```javascript
const { data: rawData, error } = await supabase
  .from("product_partnerships")
  .select(`
    products!inner(
      id, name, color_label, size, price, stock_quantity,
      image_url, main_category, subcategory, owner_id,
      product_variants(id, size, stock_quantity)
    )
  `)
  .in("group_id", groupIds);

// Deduplicar e filtrar no cliente
const seen = new Set<string>();
return (rawData || [])
  .map((r: any) => r.products)
  .filter((p: any) =>
    p &&
    p.owner_id !== user!.id &&
    p.is_active &&
    p.stock_quantity > 0 &&
    !seen.has(p.id) &&
    seen.add(p.id)
  ) as StockProduct[];
```

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/StockSetDetector.tsx` | Reescrever a query de busca de produtos parceiros para usar join via `product_partnerships` como tabela principal, evitando a URL longa com centenas de IDs |

## O que NÃO muda

- Lógica de matching de cores e subcategorias (já funciona corretamente após trim+normalize)
- UI e demais funcionalidades do Detector
- RLS e estrutura do banco de dados

## Resultado esperado

Após a correção, ao selecionar "Próprio × Sociedade 1-1" e clicar em "Iniciar Varredura Completa", a usuária teamwodbrasil verá os 122 produtos com estoque da isabellegalx1 e o sistema detectará conjuntos entre os 168 produtos próprios e esses 122 produtos da parceira.
