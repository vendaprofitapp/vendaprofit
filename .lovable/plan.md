

## Correção Definitiva: Detector de Conjuntos — Anti-Duplicação Excessiva

### Causa raiz

O filtro de anti-duplicação (linhas 286-326) constrói um conjunto de chaves `cor|tamanho` de TODOS os produtos próprios. Depois, remove qualquer produto do parceiro que tenha a mesma `cor|tamanho`.

O problema: se você tem um Shorts Rosa M no seu estoque, e a parceira tem um Top Rosa M, o Top é excluído — porque a chave `rosa|m` já existe no seu estoque. Mas são peças DIFERENTES (subcategorias diferentes). O filtro deveria excluir apenas peças que são realmente duplicatas (mesma subcategoria + cor + tamanho).

### Exemplo do bug

- Seu estoque: Shorts Rosa M, Shorts Rosa G
- Parceira: Top Rosa M, Top Rosa G
- Chaves geradas: `rosa|m`, `rosa|g`
- Filtro remove Top Rosa M e Top Rosa G (mesma cor+tamanho)
- Resultado: 0 conjuntos detectados

### Correção

Incluir a **subcategoria** na chave de anti-duplicação. Assim, apenas peças que são realmente o mesmo item (mesma subcategoria + cor + tamanho) são excluídas.

**Antes:**
```
chave = cor|tamanho
```

**Depois:**
```
chave = cor|tamanho|subcategoria
```

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/pages/StockSetDetector.tsx` | Alterar `ownColorSizeKeys` (linha 286-292) para incluir subcategoria na chave; alterar o filtro de anti-duplicação (linha 321-326) para usar a mesma chave com subcategoria |

### Mudança no código (2 pontos)

**1. Construção das chaves (linhas 286-292):**
Adicionar `normalizeStr(p.subcategory)` na chave:
```ts
keys.add(`${normalizeStr(p.color_label)}|${normalizeStr(p.size)}|${normalizeStr(p.subcategory)}`);
```

**2. Filtro de anti-duplicação (linhas 321-326):**
Usar a mesma chave com subcategoria:
```ts
const key = `${normalizeStr(p.color_label)}|${normalizeStr(p.size)}|${normalizeStr(p.subcategory)}`;
return !ownColorSizeKeys.has(key);
```

### Resultado esperado

- Shorts Rosa M (seu) + Top Rosa M (parceira) = Conjunto detectado
- Top Rosa M (seu) + Top Rosa M (parceira) = Excluído (duplicata real)
- Funciona corretamente com ou sem filtros de fornecedor/categoria
