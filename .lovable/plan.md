
# Melhorias na Central de Pecas do Admin

## Problema Atual

1. A listagem de produtos por fornecedor ja existe, mas pode ser melhorada com paginacao e mais detalhes visiveis.
2. O scanner de novidades (NewProductsScanner) adiciona produtos apenas com nome e dados basicos (preco 0, sem imagem, sem categoria). O admin precisa editar cada produto depois manualmente.

## Solucao

### 1. Listagem completa de pecas por fornecedor

A tabela atual ja mostra Imagem, Nome, Cor, Categoria, Preco e Variantes. Melhorias:
- Adicionar coluna "Custo" (cost_price) para o admin ver o preco de custo
- Adicionar coluna "Modelo" (model) para filtros
- Permitir clicar em um produto para abrir o ProductFormDialog existente (o mesmo usado no Estoque) para edicao completa
- Mostrar total de produtos no header

### 2. Edicao de novidades antes de inserir

Atualmente o scanner detecta novos produtos e os insere com dados vazios. A mudanca principal:

**Novo fluxo apos deteccao:**
1. Admin seleciona os produtos detectados (como ja funciona)
2. Ao clicar "Adicionar Selecionados", em vez de inserir direto no banco, abre uma tela de edicao sequencial
3. Para cada produto selecionado, o sistema faz scrape da URL do produto (usando a edge function `scrape-product-data` existente) e exibe a interface de mapeamento igual ao UrlProductImporter:
   - Selecao de fotos
   - Mapeamento de campos (nome, preco, cor, categoria, modelo, etc.)
4. Apos confirmar os dados de cada produto, ele e inserido no banco com os dados completos
5. O admin avanca para o proximo produto ate completar todos

### Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/admin/SupplierCatalogTab.tsx` | Modificar - Adicionar colunas extras e clique para editar produto |
| `src/components/admin/NewProductsScanner.tsx` | Modificar - Adicionar step de edicao/scrape individual antes de inserir |
| `src/components/admin/AdminProductEditDialog.tsx` | Criar - Dialog que usa scrape-product-data + mapeamento de campos para editar dados antes de salvar (inspirado no UrlProductImporter) |

### Detalhes Tecnicos

#### SupplierCatalogTab - Melhorias na tabela
- Adicionar colunas: Custo, Modelo
- Adicionar estado para produto selecionado para edicao
- Ao clicar numa linha, abrir o ProductFormDialog existente passando o produto para edicao (reutilizando o componente ja existente no Estoque)

#### AdminProductEditDialog - Novo componente
- Recebe uma lista de produtos detectados (nome + URL)
- Processa um produto por vez
- Para cada produto:
  1. Chama `scrape-product-data` com a URL
  2. Exibe interface de selecao de imagens (grid de fotos)
  3. Exibe mapeamento de campos com auto-sugestao
  4. Botao "Salvar e Proximo" que insere no banco com dados completos
- Campos mapeados: nome, preco (venda), preco de custo, cor, modelo, categoria, detalhe, descricao, imagens (ate 3)
- Ao salvar, insere em `products` com `owner_id = adminId`, `supplier_id`, e todas as imagens/campos preenchidos
- Cria variantes padrao (PP, P, M, G, GG) com estoque 0

#### NewProductsScanner - Modificacao do fluxo
- O botao "Adicionar Selecionados" nao insere mais direto no banco
- Em vez disso, abre o AdminProductEditDialog passando os produtos selecionados (nome + URL)
- Ao fechar o dialog de edicao, fecha o scanner e atualiza a lista

```text
Fluxo revisado:
1. Mapear URLs do site
2. Extrair dados (detectar novos produtos por nome)
3. Selecionar produtos novos desejados
4. Clicar "Editar e Adicionar"
5. Para cada produto:
   a. Scrape completo da URL (dados + imagens)
   b. Admin seleciona fotos e mapeia campos
   c. Salva com dados formatados
6. Todos inseridos -> fecha scanner -> atualiza lista
```
