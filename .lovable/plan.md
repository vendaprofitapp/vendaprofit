
# Melhorias na Central de Pecas: Filtros Completos + Propagacao Seletiva

## 1. Filtros Completos por Marca

Adicionar ao `SupplierCatalogTab` o mesmo sistema de filtros existente no Estoque (`ProductFilters`), adaptado para o contexto da Central de Pecas (sem filtro de fornecedor, ja que estamos dentro de uma aba por fornecedor).

**Mudancas em `src/components/admin/SupplierCatalogTab.tsx`:**
- Importar e reutilizar o componente `ProductFilters` existente
- Adicionar botao "Filtros" ao lado da busca
- Carregar dados auxiliares necessarios (categorias principais, subcategorias, cores e tamanhos unicos dos produtos daquele fornecedor)
- Aplicar os filtros na listagem local (categoria, cor, modelo, preco, custo, estoque, lancamento, status de marketing)
- Mostrar badge com contagem de filtros ativos
- Buscar campos extras na query: `main_category`, `subcategory`, `is_new_release`, `size` para alimentar os filtros

## 2. Propagacao Seletiva com Lista de Usuarios

Reescrever o `PropagateProductsDialog` para ter duas etapas:

**Etapa 1 - Escolher modo:**
- Opcao "Todos os usuarios" (comportamento atual)
- Opcao "Escolher usuarios" (nova)

**Etapa 2 - Se "Escolher usuarios":**
- Buscar todos os usuarios que possuem o fornecedor (via tabela `suppliers` + join com `profiles` para pegar nome e email)
- Exibir lista com checkboxes mostrando: Nome completo, Email, Nome da loja
- Permitir selecionar/deselecionar todos
- Botao "Propagar" so executa para os usuarios marcados

**Mudancas em `src/components/admin/PropagateProductsDialog.tsx`:**
- Adicionar estado para modo (todos vs seletivo)
- Adicionar estado para lista de usuarios carregados
- Adicionar estado para usuarios selecionados (Set de user_ids)
- Na abertura do dialog, buscar usuarios com o fornecedor e seus perfis
- Exibir a lista com checkboxes
- Filtrar a propagacao pelos usuarios selecionados

## Detalhes Tecnicos

### SupplierCatalogTab - Filtros
- Reutiliza o componente `ProductFilters` existente passando `suppliers` como array vazio (nao necessario filtrar por fornecedor)
- Extrai cores e tamanhos unicos dos produtos carregados
- Carrega `main_categories` e `subcategories` do banco
- Adiciona campos `main_category`, `subcategory`, `is_new_release` a interface Product e a query
- Aplica filtros client-side sobre a lista de produtos ja carregada

### PropagateProductsDialog - Selecao de Usuarios
- Query para buscar usuarios:
```sql
-- Busca suppliers com mesmo nome + profiles
suppliers (id, owner_id, name) WHERE ilike name AND neq owner_id admin
profiles (full_name, email, store_name) WHERE id IN (owner_ids encontrados)
```
- Interface de usuario com:
  - Radio group: "Todos" / "Selecionar"
  - Lista de usuarios com Checkbox, nome, email e loja
  - Campo de busca para filtrar usuarios na lista
  - Botao "Selecionar todos" / "Desmarcar todos"
- A logica de propagacao existente e filtrada pelo Set de user_ids selecionados

### Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/admin/SupplierCatalogTab.tsx` | Adicionar botao de filtros, carregar categorias, aplicar filtros completos usando ProductFilters |
| `src/components/admin/PropagateProductsDialog.tsx` | Reescrever com modo todos/seletivo, lista de usuarios com checkboxes |
