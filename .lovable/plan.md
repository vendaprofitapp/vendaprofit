
# Filtros de Categoria na Varredura Automática do Detector de Conjuntos

## O que será feito

Na aba "Varredura Automática", adicionar um painel de filtros de categoria que permite à usuária escolher:
- **Categorias e subcategorias do seu estoque próprio** (peça A do conjunto)
- **Categorias e subcategorias do estoque parceiro** (peça B do conjunto)

O sistema então comparará apenas produtos que atendam aos filtros escolhidos, encontrando pares com mesma cor e tamanho.

### Exemplo de uso (caso da usuária):
1. Escolhe "Varredura Automática"
2. No filtro "Meu estoque": seleciona **Feminino → Top**
3. No filtro "Estoque parceiro": seleciona **Feminino → Shorts**
4. Clica "Iniciar Varredura"
5. O sistema mostra todos os conjuntos Top + Shorts com mesma cor e tamanho

---

## Lógica técnica

### Estado adicionado (filtros de categoria)

```typescript
const [ownCategoryFilter, setOwnCategoryFilter] = useState<string>(""); // ex: "Feminino"
const [ownSubcategoryFilter, setOwnSubcategoryFilter] = useState<string>(""); // ex: "Top"
const [partnerCategoryFilter, setPartnerCategoryFilter] = useState<string>("");
const [partnerSubcategoryFilter, setPartnerSubcategoryFilter] = useState<string>("");
```

### Derivação dinâmica de categorias disponíveis

As opções de categoria/subcategoria são derivadas diretamente dos dados já carregados (sem nova query ao banco):

```typescript
const ownCategories = useMemo(() =>
  [...new Set(ownProducts.map(p => p.main_category).filter(Boolean))].sort(),
  [ownProducts]
);

const ownSubcategories = useMemo(() =>
  [...new Set(
    ownProducts
      .filter(p => !ownCategoryFilter || p.main_category === ownCategoryFilter)
      .map(p => p.subcategory)
      .filter(Boolean)
  )].sort(),
  [ownProducts, ownCategoryFilter]
);
// Mesmo padrão para partnerCategories / partnerSubcategories
```

### Aplicação dos filtros na varredura

O `selectedOwnExpanded` (produtos próprios expandidos que entram na comparação) será filtrado:

```typescript
const selectedOwnExpanded = useMemo(() => {
  if (scanMode === "auto") {
    let filtered = ownProducts;
    if (ownCategoryFilter) filtered = filtered.filter(p => p.main_category === ownCategoryFilter);
    if (ownSubcategoryFilter) filtered = filtered.filter(p => p.subcategory === ownSubcategoryFilter);
    return filtered.flatMap(expandProduct);
  }
  // modo manual: sem mudanças
  return ownProducts.filter(p => selectedOwnItems.has(p.id)).flatMap(expandProduct);
}, [ownProducts, selectedOwnItems, scanMode, ownCategoryFilter, ownSubcategoryFilter]);
```

O mesmo para `partnerExpanded` dentro do `useMemo` de `matches`:

```typescript
let filteredPartner = partnerProducts;
if (partnerCategoryFilter) filteredPartner = filteredPartner.filter(p => p.main_category === partnerCategoryFilter);
if (partnerSubcategoryFilter) filteredPartner = filteredPartner.filter(p => p.subcategory === partnerSubcategoryFilter);
const partnerExpanded = filteredPartner.flatMap(expandProduct);
```

---

## Interface dos filtros

Na seção "Varredura Automática" (Step 2), antes do botão "Iniciar Varredura", será exibido um painel de filtros com dois grupos lado a lado:

```
┌─────────────────────────────────────────────────────────┐
│  Filtrar peças da varredura (opcional)                   │
│                                                         │
│  MEU ESTOQUE              ESTOQUE PARCEIRO              │
│  [Categoria ▼]            [Categoria ▼]                  │
│  [Subcategoria ▼]         [Subcategoria ▼]               │
│                                                         │
│  ℹ️ Deixe em branco para comparar tudo                   │
└─────────────────────────────────────────────────────────┘
```

- Selects nativos simples (sem Radix) para evitar problemas de z-index dentro do Card
- A subcategoria só aparece se a categoria tiver subcategorias disponíveis
- Um botão "Limpar filtros" aparece se algum filtro estiver ativo
- O contador no `CardDescription` é atualizado dinamicamente: "Compara **X peças filtradas** do seu estoque com..."

---

## Resumo da varredura atualizado

O bloco de sumário após a varredura exibirá os filtros aplicados:
```
Filtros: Meu estoque: Feminino / Top  |  Parceiro: Feminino / Shorts
```

---

## Arquivo alterado

| Arquivo | Mudanças |
|---|---|
| `src/pages/StockSetDetector.tsx` | Adicionar 4 estados de filtro, derivar categorias disponíveis com `useMemo`, aplicar filtros no `selectedOwnExpanded` e no matching de parceiros, adicionar UI de filtros na seção "Varredura Automática" |

## O que NÃO muda
- Lógica de matching (mesma cor + tamanho, pares complementares)
- Modo de Busca Manual
- Query ao banco de dados
- Confirmação e envio de solicitações
