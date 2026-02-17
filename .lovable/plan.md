
# Central de Controle de Cadastro de Pecas (Admin)

## Visao Geral

Criar uma nova pagina exclusiva para admins que centraliza o gerenciamento do catalogo master de produtos, organizado por fornecedor. Essa central permite ao admin manter o catalogo "fonte da verdade" que e copiado para todos os usuarios, e inclui um sistema de busca automatica de novos produtos nos sites dos fornecedores via Firecrawl.

## Dados Atuais no Admin

| Fornecedor | Produtos |
|---|---|
| POWERED BY COFFEE LTDA | 187 |
| BECHOSE MODA FITNESS | 116 |
| INMOOV MODA FITNESS | 5 |
| YOPP | 0 |

## Funcionalidades

### 1. Visao por Fornecedor (Tabs/Accordion)
- Cada fornecedor do admin aparece como uma aba ou secao
- Mostra a lista de produtos cadastrados com nome, preco, imagem, categoria e quantidade de variantes
- Permite buscar/filtrar dentro de cada fornecedor
- Badge com contagem de produtos por fornecedor

### 2. Sincronizacao de Novos Produtos (Firecrawl)
- Botao "Buscar Novidades" por fornecedor que acessa o site B2C/B2B do fornecedor via Firecrawl (map + scrape)
- Compara os produtos encontrados no site com os ja cadastrados (por nome, case-insensitive)
- Exibe lista de "Novos Produtos Detectados" que o admin pode revisar e adicionar ao catalogo master
- Os produtos adicionados ao admin sao automaticamente propagados aos usuarios via o trigger existente (para novos usuarios) ou via um botao "Propagar para Usuarios"

### 3. Propagacao para Usuarios Existentes
- Botao "Propagar Novos Produtos" que copia produtos do admin que ainda nao existem nos usuarios
- Funciona por fornecedor: busca todos os usuarios que tem aquele fornecedor e insere os produtos faltantes (com estoque 0)

### 4. Gestao de Solicitacoes de Marcas
- Secao que mostra as `brand_requests` pendentes (da tabela que sera criada no onboarding wizard)
- Admin pode aprovar (cadastrar a marca) ou rejeitar

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---|---|
| `src/pages/AdminCatalog.tsx` | Criar - Pagina principal da Central de Controle |
| `src/components/admin/SupplierCatalogTab.tsx` | Criar - Componente de aba por fornecedor (lista de produtos + busca de novidades) |
| `src/components/admin/NewProductsScanner.tsx` | Criar - Componente que usa Firecrawl para detectar novos produtos |
| `src/components/admin/BrandRequestsList.tsx` | Criar - Lista de solicitacoes de marcas pendentes |
| `src/components/admin/PropagateProductsDialog.tsx` | Criar - Dialog de confirmacao para propagar produtos aos usuarios |
| `src/App.tsx` | Modificar - Adicionar rota `/admin/catalog` |
| `src/components/layout/Sidebar.tsx` | Modificar - Adicionar link no menu admin |
| Migracao SQL | Criar tabela `brand_requests` (se ainda nao existir do plano anterior) |

## Detalhes Tecnicos

### Pagina AdminCatalog
- Verifica se o usuario e admin via `has_role` (igual ao AdminUsers)
- Carrega fornecedores do admin (`owner_id = ADMIN_ID`)
- Renderiza tabs, uma por fornecedor
- Secao separada para Brand Requests

### SupplierCatalogTab
- Recebe `supplierId` e `supplierName`
- Carrega produtos do admin filtrados por `supplier_id`
- Tabela com: Imagem (thumbnail), Nome, Categoria, Preco, Variantes (count), Acoes (editar/excluir)
- Busca por nome
- Botao "Buscar Novidades no Site" (abre NewProductsScanner)

### NewProductsScanner
- Usa a edge function `firecrawl-map` para mapear URLs do site do fornecedor
- Filtra URLs que parecem ser paginas de produto (heuristica por padrao de URL)
- Faz scrape das paginas encontradas para extrair nome e preco
- Compara com produtos existentes do admin para aquele fornecedor
- Exibe lista de novos produtos com checkbox para selecao
- Botao "Adicionar Selecionados" que insere no banco do admin

### PropagateProductsDialog
- Busca todos os usuarios que tem o fornecedor correspondente (por nome, via `suppliers` table)
- Para cada usuario, verifica quais produtos do admin ainda nao existem (por nome)
- Insere os faltantes com estoque 0
- Mostra progresso e resultado

### Rota e Menu
```typescript
// App.tsx - nova rota
<Route path="/admin/catalog" element={<ProtectedRoute><AdminCatalog /></ProtectedRoute>} />

// Sidebar.tsx - no grupo admin (ja existem /admin/users e /admin/landing-page)
{ icon: Package, label: "Central de Pecas", path: "/admin/catalog" }
```

### Fluxo de Busca de Novidades

```text
1. Admin clica "Buscar Novidades" no fornecedor BECHOSE
2. Sistema usa firecrawl-map com URL "https://www.bechose.com.br/"
3. Recebe lista de URLs do site
4. Filtra URLs que parecem produtos (ex: /produto/, /p/, /product/)
5. Faz scrape de cada URL candidata (batch, max 20)
6. Extrai nome do produto de cada pagina
7. Compara com nomes existentes no admin para BECHOSE
8. Exibe: "3 novos produtos encontrados" com nome e link
9. Admin seleciona e clica "Adicionar ao Catalogo"
10. Produtos sao criados no admin com dados basicos
11. Admin pode entao completar manualmente (preco, imagens, categorias)
```

### Propagacao para Usuarios

```text
1. Admin clica "Propagar para Usuarios" no fornecedor BECHOSE
2. Sistema busca todos os usuarios que tem um supplier chamado "BECHOSE" (ilike)
3. Para cada usuario, busca os produtos do admin para BECHOSE
4. Compara com os produtos do usuario para aquele supplier
5. Insere os faltantes com estoque 0 e mesmos dados (nome, preco, imagens, etc.)
6. Exibe resultado: "15 produtos propagados para 8 usuarios"
```
