
# Correcao: Preco de Custo Zerado nos Relatorios

## Problema Identificado

O banco de dados tem **1.874 produtos** cadastrados. O Lovable Cloud tem um limite padrao de **1.000 linhas por consulta**. Quando o sistema busca produtos para calcular custos nos relatorios, apenas os primeiros 1.000 sao retornados. Produtos que ficam fora dessa lista aparecem com preco de custo R$ 0,00.

A consulta principal no arquivo de Relatorios (`Reports.tsx`) busca produtos de **todos os usuarios** sem filtro, o que agrava o problema.

## Solucao

Corrigir todas as consultas de produtos nos relatorios para:
1. Filtrar por `owner_id` (buscar apenas os produtos do usuario logado)
2. Quando necessario buscar produtos de parceiras, fazer consultas separadas e especificas
3. Aumentar o limite explicito para consultas que precisam de mais de 1.000 registros

## Arquivos a Modificar

### 1. `src/pages/Reports.tsx`
- Linha 193: Adicionar filtro `.eq("owner_id", user?.id)` na busca de produtos
- Tambem buscar produtos de parceiras (via `product_partnerships` e grupos) separadamente
- Mesclar ambas as listas para o `productMap` completo

### 2. `src/components/financial/DREReport.tsx`
- A consulta usa `.in("id", ...)` que e segura, mas quando ha muitos IDs, o `.in()` pode falhar
- Adicionar tratamento para dividir em lotes se necessario

### 3. `src/pages/Dashboard.tsx`
- Adicionar `.limit(5000)` explicito como seguranca, ja que filtra por `owner_id`

### 4. `src/pages/Financial.tsx`
- Ja filtra por `owner_id` -- adicionar `.limit(5000)` como seguranca

## Detalhes Tecnicos

### Consulta atual (Reports.tsx):
```text
supabase.from("products")
  .select("id, name, category, color, cost_price, owner_id, group_id")
  // Sem filtro de owner_id!
  // Limite padrao: 1000 linhas
```

### Consulta corrigida:
```text
// 1. Buscar produtos proprios
supabase.from("products")
  .select("id, name, category, color, cost_price, owner_id, group_id")
  .eq("owner_id", user.id)
  .limit(5000)

// 2. Buscar IDs de produtos de parceiras
supabase.from("product_partnerships")
  .select("product_id")
  .in("group_id", userGroupIds)

// 3. Buscar dados dos produtos de parceiras
supabase.from("products")
  .select("id, name, category, color, cost_price, owner_id, group_id")
  .in("id", partnerProductIds)
```

### Impacto
Com esta correcao, todos os produtos vendidos terao seu preco de custo corretamente mapeado nos relatorios, eliminando os valores zerados.
