
# 3 Correções no Detector de Conjuntos

## Diagnóstico dos 3 problemas

### Problema 1 — Aparecendo peças com tamanhos diferentes

Olhando o código de matching (linhas 290-326), o sistema faz **dois tipos** de match:

- `same_color_size`: mesma cor **E** mesmo tamanho ✅ (correto)
- `complementary_set`: mesma cor + subcategorias complementares (Top+Shorts, etc.) — **sem exigir mesmo tamanho** ❌

A seção "🔄 Mesma Cor e Tamanho" está correta, mas a seção "🎭 Conjuntos Complementares" está encontrando pares onde o Top é M e o Shorts é G, por exemplo — o que não forma um conjunto real.

**Correção:** Adicionar a exigência de `sameSize` também no `complementary_set`:
```typescript
// ANTES
if (sameColor && areComplementary(own.subcategory, partner.subcategory)) {

// DEPOIS
if (sameColor && sameSize && areComplementary(own.subcategory, partner.subcategory)) {
```

E atualizar o `matchLabel` para refletir que o tamanho é sempre o mesmo.

---

### Problema 2 — Adicionar filtro de fornecedor nos filtros da Varredura

O campo `supplier_id` existe na tabela `products`. A usuária tem fornecedores como YOPP, BECHOSE, INMOOV, etc.

**Plano:**
1. Adicionar `supplier_id` e join com `suppliers(name)` na query de produtos próprios
2. Adicionar `supplier_id` e join com `suppliers(name)` na query de produtos parceiros
3. Adicionar estado `ownSupplierFilter` e `partnerSupplierFilter`
4. Derivar listas de fornecedores disponíveis com `useMemo`
5. Adicionar o terceiro `<select>` de fornecedor em cada coluna do painel de filtros
6. Aplicar filtro no `selectedOwnExpanded` e no matching de parceiros

---

### Problema 3 — Parceira deve mostrar apenas peças que a própria NÃO tem

Atualmente o sistema mostra peças da parceira mesmo que sejam **idênticas** ao que a usuária já tem no próprio estoque. A lógica correta é: a parceira complementa o que a usuária **não tem**.

**Regra de exclusão:** Uma peça da parceira é excluída se a usuária **já tem** um produto com o mesmo `color_label` normalizado **e** mesmo `size` (ou variante de mesmo size). Isso evita duplicação.

**Implementação:** Criar um `Set` de chaves `"${normalizeStr(color)}|${normalizeStr(size)}"` com todas as peças próprias, e filtrar os produtos da parceira que não estejam nesse conjunto:

```typescript
// Criar set de peças próprias por cor+tamanho
const ownColorSizeKeys = useMemo(() => {
  const keys = new Set<string>();
  ownProducts.flatMap(expandProduct).forEach(p => {
    const key = `${normalizeStr(p.color_label)}|${normalizeStr(p.size)}`;
    keys.add(key);
  });
  return keys;
}, [ownProducts]);

// Na query de matches, filtrar parceiros que a usuária já tem
const partnerExpanded = filteredForMatch
  .flatMap(expandProduct)
  .filter(p => {
    const key = `${normalizeStr(p.color_label)}|${normalizeStr(p.size)}`;
    return !ownColorSizeKeys.has(key);
  });
```

**Importante:** Este filtro de exclusão se aplica no contexto do matching — a parceira só aparece em resultados se a usuária **não tiver** aquela cor+tamanho no próprio estoque, garantindo que o conjunto é de fato complementar.

---

## Resumo das mudanças técnicas

| # | Mudança | Arquivo |
|---|---|---|
| 1 | Exigir mesmo tamanho em `complementary_set` | `StockSetDetector.tsx` linha ~314 |
| 2a | Adicionar `supplier_id, suppliers(id, name)` nas queries | `StockSetDetector.tsx` linhas 130-136 e 164-174 |
| 2b | Adicionar `StockProduct.supplier_id` e `supplier_name` no tipo | `StockSetDetector.tsx` linhas 42-58 |
| 2c | Adicionar 2 estados de filtro de fornecedor + derivar listas | `StockSetDetector.tsx` ~linha 124 |
| 2d | Aplicar filtro de fornecedor no `selectedOwnExpanded` e matching | `StockSetDetector.tsx` linhas 264-286 |
| 2e | Adicionar `<select>` de fornecedor na UI do painel de filtros | `StockSetDetector.tsx` linhas 605-662 |
| 2f | Adicionar `ownSupplierFilter` e `partnerSupplierFilter` no `hasActiveFilters` e `clearFilters` | `StockSetDetector.tsx` linhas 238-245 |
| 3 | Criar `ownColorSizeKeys` e filtrar `partnerExpanded` para excluir peças que a usuária já tem | `StockSetDetector.tsx` linhas 276-329 |

## Arquivo alterado

Apenas `src/pages/StockSetDetector.tsx`.

## O que NÃO muda

- Lógica de envio de solicitações
- Modo de Busca Manual
- Queries de grupos/parcerias
- Demais filtros de categoria e subcategoria já existentes
