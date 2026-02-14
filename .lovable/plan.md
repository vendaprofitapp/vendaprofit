

# Diretor de Conteudo e Inteligencia de Pesquisa (Marketing v2)

## Resumo

Expandir a pagina de Marketing com dois novos modulos: (1) Cards de Acao inteligentes baseados em visualizacoes, conversoes e estoque, e (2) Inteligencia de Pesquisa que rastreia buscas dos visitantes na loja e sugere otimizacoes de catalogo.

---

## Epico 3: Motor de Conteudo para Redes Sociais

### Dados necessarios (novas tabelas)

**`catalog_product_views`** - Registra cada visualizacao de produto na loja publica

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| store_id | uuid | Loja onde ocorreu |
| owner_id | uuid | Dono da loja (RLS) |
| product_id | uuid | Produto visualizado |
| device_id | text | Fingerprint do visitante (localStorage) |
| created_at | timestamptz | Momento da visualizacao |

**`marketing_tasks`** - Cards de acao gerados pelo sistema

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| owner_id | uuid | Dono da loja (RLS) |
| product_id | uuid | Produto relacionado |
| task_type | text | 'high_objection' / 'hidden_gold' / 'capital_freeze' / 'search_demand' |
| title | text | Titulo do card |
| description | text | Texto instrucional |
| product_name | text | Nome do produto (snapshot) |
| metric_value | integer | Numero principal (views, pesquisas, unidades) |
| metric_secondary | numeric | Metrica secundaria (taxa conversao, valor stock) |
| is_completed | boolean DEFAULT false | Se o vendedor marcou como concluido |
| completed_at | timestamptz | Quando foi concluido |
| expires_at | timestamptz | Para nao mostrar tasks velhos |
| store_slug | text | Para gerar o link UTM |
| created_at | timestamptz | |

RLS: `owner_id = auth.uid()` para todas as operacoes.

### Rastreamento de visualizacoes (frontend)

- No `StoreCatalog.tsx`, quando o visitante clica na imagem do produto (abre o lightbox), registrar uma visualizacao na tabela `catalog_product_views`
- Usar debounce: acumular views em memoria e enviar em batch a cada 5 segundos via `setTimeout`, para nao impactar performance
- Identificar visitante por `device_id` gerado no localStorage (reutilizar o mesmo do lead capture)

### Rastreamento de adicoes ao carrinho (ja existe)

- A tabela `lead_cart_items` ja registra quando um produto e adicionado ao carrinho
- Podemos usar essa tabela para calcular a taxa de conversao view -> cart

### Geracao dos Cards de Acao

Sera implementada como uma **Edge Function** chamada `generate-marketing-tasks` que o vendedor pode invocar manualmente (botao "Atualizar Insights") na pagina de Marketing. A funcao:

1. Busca as metricas do vendedor dos ultimos 30 dias (views, cart adds, sales, stock)
2. Aplica as 3 regras de negocio:
   - **Alta Objecao**: produto com >= 10 views e 0 cart adds
   - **Ouro Escondido**: produto com < 5 views mas >= 2 cart adds ou vendas
   - **Giro de Capital**: produto com >= 5 unidades em stock e 0 views nos ultimos 15 dias
3. Gera/atualiza registros na tabela `marketing_tasks`
4. Retorna os tasks gerados

### UI dos Cards de Conteudo

Na pagina de Marketing, adicionar uma nova aba "Conteudo" com os cards gamificados:

- Cada card mostra icone tematico, titulo, descricao com instrucao, metricas
- Botao "Copiar Link do Produto" que copia a URL da loja com `?utm_source=instagram_task`
- Checkbox "Tarefa Concluida" que marca o card como completo e o remove do feed
- Cards concluidos ficam numa sub-aba "Concluidos"

---

## Epico 4: Inteligencia de Pesquisa Interna (SEO)

### Nova tabela

**`catalog_search_logs`** - Registra cada pesquisa na loja

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| store_id | uuid | Loja |
| owner_id | uuid | Dono da loja (RLS) |
| search_term | text | Termo pesquisado (lowercase, trimmed) |
| results_count | integer | Quantos resultados retornaram |
| device_id | text | Identificador do visitante |
| created_at | timestamptz | |

RLS: `owner_id = auth.uid()` para SELECT/UPDATE/DELETE. INSERT publico (visitantes nao logados).

### Rastreamento de pesquisas (frontend)

- No `StoreCatalog.tsx`, usar debounce de 1 segundo apos o visitante digitar na barra de busca
- Salvar o termo e a contagem de resultados na tabela `catalog_search_logs`
- Nao registrar termos com menos de 3 caracteres

### Geracao de Cards de SEO

A mesma Edge Function `generate-marketing-tasks` tambem processa pesquisas:

- **Demanda Reprimida**: Agrupa termos com >= 3 pesquisas e 0 resultados
- Gera card com o termo e sugere edicao de nomes de produtos
- Inclui botao de "Edicao Rapida": abre um dialogo inline que permite ao vendedor selecionar um produto existente e adicionar o termo ao nome ou descricao, sem navegar para outra pagina

---

## Detalhes Tecnicos

### Alteracoes em arquivos existentes

1. **`src/pages/StoreCatalog.tsx`**:
   - Adicionar funcao `trackProductView()` ao abrir o lightbox de imagem - debounced, batch insert
   - Adicionar funcao `trackSearch()` na barra de pesquisa - debounce 1s, salvar termo + results_count
   - Gerar `device_id` unico no localStorage para visitantes anonimos

2. **`src/pages/Marketing.tsx`**:
   - Expandir Tabs para 4 abas: "Pendentes" (carrinhos), "Conteudo" (tasks de marketing), "SEO" (pesquisas), "Contatados"
   - Nova secao de cards de conteudo com UI gamificada
   - Botao "Atualizar Insights" que chama a Edge Function
   - Componente `ContentTaskCard` com copiar link, marcar concluido
   - Componente `SearchDemandCard` com edicao rapida de produto
   - Dialogo `QuickProductRenameDialog` para editar nome/descricao inline

3. **`src/App.tsx`**: Sem alteracoes (rota ja existe)

4. **`src/components/layout/Sidebar.tsx`**: Sem alteracoes (item ja existe)

### Nova Edge Function

**`supabase/functions/generate-marketing-tasks/index.ts`**:
- Recebe `owner_id` via auth token
- Consulta `catalog_product_views`, `lead_cart_items`, `products`, `catalog_search_logs`
- Aplica as regras de negocio (3 cenarios de conteudo + 1 de SEO)
- Upsert na tabela `marketing_tasks`
- Retorna os tasks gerados

### Migracao de banco de dados

Uma unica migracao que cria:
1. `catalog_product_views` com RLS (INSERT publico, SELECT por owner)
2. `catalog_search_logs` com RLS (INSERT publico, SELECT por owner)
3. `marketing_tasks` com RLS completo por owner
4. Indices em `product_id`, `owner_id`, `store_id` para performance

### Sequencia de implementacao

1. Criar migracao com as 3 tabelas + RLS + indices
2. Atualizar `StoreCatalog.tsx` com tracking de views e pesquisas (debounced)
3. Criar Edge Function `generate-marketing-tasks`
4. Expandir `Marketing.tsx` com abas de Conteudo e SEO
5. Criar componentes auxiliares (ContentTaskCard, SearchDemandCard, QuickProductRenameDialog)

