
# Ecossistema de Grupos e Matchmaking de Estoque (Marketing v3)

## Resumo

Expandir o Motor de Marketing com recomendacoes inteligentes de Grupos. O sistema cruzara dados de pesquisas dos clientes, categorias de produtos do vendedor e catalogos dos grupos existentes para gerar Cards de Acao que incentivem a adesao a Grupos de Estoque Compartilhado.

---

## Cenarios de Cards

### Cenario A: Expansao de Categoria (Cross-Selling)
- **Gatilho**: Pesquisas dos visitantes por categorias que o vendedor nao possui + grupos com produtos nessa categoria
- **Card**: "Complete o Look das suas Clientes! Notamos buscas por [Categoria] na sua loja, mas seu estoque nisso e zero. O Grupo [Nome] tem [Qtd] produtos disponiveis."
- **Acao**: Botao "Solicitar Entrada no Grupo" + badge com margem de lucro do grupo

### Cenario B: Oportunidade de Marca
- **Gatilho**: Grupos com alto volume de vendas globais em categorias populares que o vendedor nao trabalha
- **Card**: "Aumente seu Ticket Medio! Vendedoras estao lucrando com esta categoria. O Grupo [Nome] e distribuidor."
- **Acao**: Botao "Ver Produtos do Grupo" que abre um preview do catalogo

### Cenario C: Criacao de Grupo (Muito Estoque)
- **Gatilho**: Vendedor com alto valor em estoque parado e baixo giro de vendas
- **Card**: "Torne-se um Fornecedor! Voce tem estoque poderoso mas giro lento. Crie um Grupo de Estoque Compartilhado."
- **Acao**: Botao "Criar Meu Grupo" que redireciona para `/partnerships` na aba de Grupos

---

## Detalhes Tecnicos

### Edge Function: Expandir `generate-marketing-tasks`

A funcao existente sera expandida com 3 novos cenarios de `task_type`:

- **`group_cross_sell`**: Cruza `catalog_search_logs` (termos com 0 resultados) com `product_partnerships` + `products` de outros owners para encontrar grupos que possuem produtos na categoria buscada
- **`group_opportunity`**: Consulta `sale_items` globais via service role para identificar grupos com alto volume de vendas onde o vendedor nao e membro
- **`group_create`**: Verifica se o vendedor tem mais de R$ 5.000 em estoque (stock_quantity * price) e menos de 10 vendas nos ultimos 30 dias, e nao possui nenhum grupo criado

Novos campos no `marketing_tasks` (ja existentes e reutilizaveis):
- `product_name`: usado para nome do grupo ou categoria
- `metric_value`: quantidade de produtos no grupo ou valor do estoque
- `metric_secondary`: margem de lucro (profit_share_seller * 100) ou valor em estoque

Novo campo necessario na tabela `marketing_tasks`:
- `group_id` (uuid, nullable): referencia ao grupo recomendado (para os cenarios A e B)

### Migracao de Banco de Dados

Uma migracao simples:
1. Adicionar coluna `group_id` (uuid, nullable) na tabela `marketing_tasks`
2. Sem foreign key rígida (para evitar problemas se o grupo for deletado)

### Novos Componentes React

1. **`src/components/marketing/GroupRecommendationCard.tsx`**
   - Card com icone de grupo, titulo, descricao, metricas
   - Badge de margem de lucro (ex: "Voce fica com 70% do lucro")
   - Botao "Solicitar Entrada" (abre dialog de confirmacao + chama join via invite_code)
   - Botao "Ver Produtos" (abre dialog com preview do catalogo do grupo)

2. **`src/components/marketing/GroupProductPreviewDialog.tsx`**
   - Dialog/Drawer que mostra os produtos compartilhados de um grupo
   - Lista simples com nome, preco, imagem (thumbnail)
   - Componente visual de "Divisao de Lucros" com barras/badges mostrando `profit_share_seller` vs `profit_share_partner`

3. **`src/components/marketing/ProfitSplitDisplay.tsx`**
   - Componente reutilizavel que exibe a divisao de lucros de um grupo
   - Usa Progress bars ou badges coloridos
   - Texto: "Neste grupo, por cada venda na sua loja, voce fica com X% do lucro limpo sem investir em estoque fisico."

### Alteracoes em Arquivos Existentes

1. **`src/pages/Marketing.tsx`**:
   - Adicionar nova aba "Grupos" (5a aba) com icone Users
   - Buscar marketing_tasks com task_type IN ('group_cross_sell', 'group_opportunity', 'group_create')
   - Renderizar `GroupRecommendationCard` para cada task
   - Botao "Atualizar Insights" tambem aparece nesta aba

2. **`supabase/functions/generate-marketing-tasks/index.ts`**:
   - Adicionar busca de grupos publicos (is_direct = false) e seus produtos via product_partnerships
   - Adicionar busca de memberships do usuario para excluir grupos onde ja e membro
   - Implementar os 3 novos cenarios de matchmaking
   - Incluir `group_id` nos tasks gerados para cenarios A e B

### Fluxo de "Solicitar Entrada no Grupo"

Quando o vendedor clica "Solicitar Entrada":
1. O sistema busca o `invite_code` do grupo (ja existe na tabela `groups`)
2. Insere o usuario como membro do grupo via `group_members` (role: 'member')
3. Marca o task como concluido
4. Invalida queries de grupos e memberships
5. Toast de sucesso com link para a pagina de Parcerias

### Fluxo de "Criar Meu Grupo"

Quando o vendedor clica "Criar Meu Grupo":
1. Redireciona para `/partnerships` com query param `?tab=groups&action=create`
2. A pagina de Parcerias detecta o param e abre automaticamente o dialog de criacao de grupo

### Sequencia de Implementacao

1. Criar migracao (adicionar coluna `group_id` em `marketing_tasks`)
2. Expandir Edge Function `generate-marketing-tasks` com os 3 novos cenarios
3. Criar componentes `ProfitSplitDisplay`, `GroupProductPreviewDialog`, `GroupRecommendationCard`
4. Atualizar `Marketing.tsx` com nova aba "Grupos"
5. Ajustar `Partnerships.tsx` para aceitar query params de auto-abertura do dialog de criacao
