
# Correcao do Dropshipping B2B: Extracao de Tamanhos do Fornecedor

## Problemas Identificados

1. **Falso "Esgotado"**: A Edge Function `check-b2b-stock` encontra a palavra "Esgotado" na secao de "Produtos similares" do HTML e marca o produto como indisponivel. Na verdade, o produto TEM estoque (221 unidades, conforme metadata `nuvemshop:stock`).

2. **Tamanhos errados**: O produto local tem variantes PP, P, M, G, GG, XG, mas o fornecedor oferece tamanhos 2, 4, 6, 8, 10, 12, 14. O catalogo precisa mostrar os tamanhos do fornecedor.

3. **Falta extracao de tamanhos**: A Edge Function nao extrai os tamanhos disponiveis do fornecedor -- ela so verifica se esta "esgotado" ou nao.

---

## Solucao

### 1. Atualizar Edge Function `check-b2b-stock`

Melhorar a logica para:
- **Usar metadata** (`nuvemshop:stock`) como indicador primario de disponibilidade quando disponivel
- **Limitar a analise de "esgotado"** ao conteudo principal do produto (antes da secao "Produtos similares")
- **Extrair tamanhos** do markdown usando regex (ex: "Tamanho\n\n2468101214" -> ["2","4","6","8","10","12","14"])
- Retornar `{ available: true, sizes: ["2","4","6","8","10","12","14"] }` 

Arquivo: `supabase/functions/check-b2b-stock/index.ts`

### 2. Atualizar Catalogo para buscar tamanhos B2B

No `StoreCatalog.tsx`, para produtos B2B:
- Chamar `check-b2b-stock` durante o carregamento do catalogo (com cache de 5 min)
- Se retornar `available: true` com `sizes`, usar esses tamanhos no lugar das variantes locais
- Se nao retornar tamanhos, mostrar o produto sem selecao de tamanho (apenas "Sob Encomenda")

Arquivo: `src/pages/StoreCatalog.tsx`

### 3. Atualizar VariantSelectionDialog para B2B

Quando o produto e B2B, o dialog de selecao de tamanho deve mostrar os tamanhos do fornecedor (sem verificar estoque local).

Arquivo: `src/components/sales/VariantSelectionDialog.tsx`

---

## Detalhes Tecnicos

### Edge Function - Nova logica de extracao

```text
// 1. Verificar metadata primeiro
if (metadata['nuvemshop:stock'] && parseInt(metadata['nuvemshop:stock']) > 0) {
  available = true;
}

// 2. Extrair tamanhos da secao principal (antes de "Produtos similares")
const mainContent = markdown.split(/##\s*produtos?\s*similares/i)[0];
// Regex para "Tamanho\n\n2468101214" -> split em numeros/letras de tamanho
const sizeMatch = mainContent.match(/tamanho[:\s]*\n+\n*([^\n]+)/i);
// Parse: "2468101214" ou "P M G GG"

// 3. Verificar esgotado APENAS no conteudo principal
const isOutOfStock = outOfStockPatterns.some(p => mainContent.includes(p));
```

### Catalogo - Cache de verificacao B2B

```text
// Para cada produto B2B, chamar check-b2b-stock uma vez
// Armazenar resultado em Map com TTL de 5 minutos
// Usar tamanhos retornados como sizeInfos do card
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/check-b2b-stock/index.ts` | Extrair tamanhos + corrigir deteccao de "esgotado" + usar metadata |
| `src/pages/StoreCatalog.tsx` | Chamar check-b2b-stock para produtos B2B e usar tamanhos retornados |
| `src/components/sales/VariantSelectionDialog.tsx` | Suportar tamanhos B2B (sem estoque local) |
