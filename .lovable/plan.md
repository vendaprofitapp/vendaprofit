
# Filtros Avancados no Dialog de Produtos Liberados

## Resumo

Adicionar ao `ProductPartnershipDialog` o mesmo conjunto de filtros disponivel no Controle de Estoque (categoria principal, subcategoria, fornecedor, cor, tamanho, status de estoque, status de marketing, lancamentos, faixa de preco e faixa de estoque), com busca por texto. Os filtros funcionarao tanto nas parcerias 1-1 quanto nos grupos. Adicionalmente, um filtro exclusivo "Status de Liberacao" (Liberados / Nao Liberados / Todos) para facilitar a gestao.

---

## Alteracoes

### 1. Expandir a query de produtos (ambos os locais)

**Arquivos**: `src/pages/Partnerships.tsx` e `src/components/partnerships/DirectPartnerships.tsx`

Alterar o SELECT de:
```
id, name, price, category, stock_quantity
```
Para:
```
id, name, price, category, category_2, category_3, main_category, subcategory, stock_quantity, supplier_id, color_label, model, is_new_release, marketing_status, min_stock_level, product_variants(size, stock_quantity, marketing_status)
```

Atualizar a interface `Product` em ambos os ficheiros para incluir os novos campos.

Tambem buscar `suppliers` e `main_categories`/`subcategories` para popular os selects de filtro.

### 2. Reformular o `ProductPartnershipDialog`

**Arquivo**: `src/components/partnerships/ProductPartnershipDialog.tsx`

- Atualizar a interface `Product` com todos os novos campos
- Adicionar props para `suppliers`, `mainCategories`, `subcategories` (listas de referencia)
- Substituir o filtro unico de categoria por um sistema completo:

**Filtros implementados** (no padrao do estoque):

| Filtro | Tipo | Logica |
|--------|------|--------|
| Busca por texto | Input | Filtra por nome, modelo ou cor |
| Categoria Principal | Select | Filtra por `main_category` |
| Subcategoria | Select | Filtra por `subcategory` (visivel quando categoria principal selecionada) |
| Fornecedor | Select | Filtra por `supplier_id` |
| Cor | Select | Valores unicos de `color_label` |
| Tamanho | Select | Valores unicos dos `product_variants.size` |
| Status de Estoque | Select | Disponivel (>0), Baixo (<=min_stock_level), Esgotado (=0) |
| Status de Marketing | Select | Oportunidade, Pre-venda, Lancamento, Area Secreta |
| Lancamentos | Select | Sim/Nao (baseado em `is_new_release`) |
| Faixa de Preco | 2x Input | Min e Max em R$ |
| Faixa de Estoque | 2x Input | Min e Max |
| **Status de Liberacao** | Select | Todos / Liberados / Nao Liberados |

**Layout da UI**:
- Barra superior: Input de busca por texto + botao "Filtros" que abre um Dialog/Popover com todos os filtros avancados (mesmo padrao do estoque)
- Badges de filtros ativos removiveis abaixo da barra
- Botao "Limpar Filtros" quando ha filtros ativos
- Manter os botoes de acao "Liberar Todos" / "Liberar Categoria" adaptados ao contexto filtrado

### 3. Adaptar a passagem de props

**Arquivos**: `src/pages/Partnerships.tsx` e `src/components/partnerships/DirectPartnerships.tsx`

Passar as novas props (`suppliers`, `mainCategories`, `subcategories`) ao `ProductPartnershipDialog`. Reutilizar as queries de `main_categories` e `subcategories` que ja existem no sistema, adicionando-as nestes componentes.

---

## Detalhes Tecnicos

### Sequencia de implementacao

1. Atualizar interfaces `Product` e queries em `Partnerships.tsx` e `DirectPartnerships.tsx` (expandir SELECT + buscar suppliers/categories)
2. Reformular `ProductPartnershipDialog.tsx` com o sistema de filtros completo
3. Passar as novas props nos 2 pontos de uso do dialog

### Notas

- Nenhuma migracao de banco necessaria -- todos os campos ja existem
- Os filtros sao aplicados em cascata no `useMemo` do `filteredProducts`
- O filtro de tamanho verifica se o produto possui pelo menos uma variante com aquele tamanho
- O filtro de status de marketing verifica tanto `products.marketing_status` quanto `product_variants.marketing_status`
- O botao "Liberar Todos" aplica-se apenas aos produtos visiveis apos todos os filtros
