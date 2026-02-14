
# Analytics da "Minha Loja" e CRM de Leads

## Resumo

Criar uma nova aba "Analytics" dentro da pagina Marketing com dashboard de metricas da loja (visitantes, taxa de captura, carrinhos) e um CRM completo de leads com tabela gerencial, filtros, acoes diretas via WhatsApp e exportacao CSV.

---

## Epico 8: Dashboard de Metricas

### Filtro Global de Periodo

Seletor de datas no topo com opcoes pre-definidas:
- Hoje, Ultimos 7 dias, Ultimos 30 dias, Mes Atual, Personalizado (date picker)
- Todos os dados (cards de metricas + grafico + tabela de leads) reagem ao filtro selecionado

### Cards de Metricas Principais

3 cards usando o componente MetricCard existente:

1. **Visitantes Unicos**: COUNT(DISTINCT device_id) de `catalog_product_views` no periodo
2. **Taxa de Captura**: (total de `store_leads` criados no periodo / visitantes unicos) * 100, exibido como porcentagem
3. **Carrinhos Ativos/Abandonados**: COUNT de `lead_cart_items` com status 'abandoned' no periodo

### Grafico de Trafego

- Grafico de area (Recharts, ja instalado) mostrando visitantes unicos por dia no periodo selecionado
- Segue o padrao visual do `SalesChart` existente (AreaChart com gradiente)
- Dados: agrupamento diario de `catalog_product_views` por `device_id` unico

---

## Epico 9: CRM de Leads

### Tabela/Lista de Leads

Interface mobile-first usando cards (nao tabela HTML pura), com layout de tabela em desktop:

Para cada lead:
- **Data/Hora**: formatada com `date-fns`
- **Nome**: do `store_leads.name`
- **WhatsApp**: formatado com mascara
- **Status do Funil**: Badge visual baseado nos itens do carrinho:
  - "Novo Lead" (sem itens no carrinho)
  - "Carrinho Abandonado" (tem itens com status 'abandoned')
  - "Em Atendimento" (tem itens com status 'contacted')
  - "Venda Concluida" (tem itens com status 'converted')

### Acoes Diretas

- **Botao WhatsApp**: Icone verde ao lado do numero que abre `wa.me/55{numero}`
- **Expandir Detalhes**: Botao que expande a linha mostrando os produtos no carrinho (nome, cor, tamanho, preco)

### Filtros e Exportacao

- **Busca rapida**: Input de texto para filtrar leads por nome
- **Filtro por status**: Select para filtrar por status do funil
- **Exportacao CSV**: Botao que gera e baixa um CSV com colunas: Nome, WhatsApp, Status, Data, Produtos no Carrinho, Valor Total
- **Paginacao**: 20 leads por pagina com controles de navegacao

---

## Detalhes Tecnicos

### Nenhuma migracao necessaria

Todas as tabelas ja existem (`store_leads`, `lead_cart_items`, `catalog_product_views`). As queries serao feitas diretamente no frontend usando o Supabase client com filtros de data.

### Novos componentes

1. **`src/components/marketing/AnalyticsDashboard.tsx`**
   - Componente principal que contem o filtro de periodo, os 3 MetricCards e o grafico
   - Recebe `ownerId` e gerencia o estado do periodo selecionado
   - Queries independentes para cada metrica (visitors, capture rate, abandoned carts)
   - Grafico de area usando Recharts (AreaChart) seguindo o padrao do SalesChart

2. **`src/components/marketing/LeadsCRM.tsx`**
   - Tabela/lista de leads com busca, filtro por status e paginacao
   - Cada linha tem botao WhatsApp e expandir detalhes
   - Botao de exportar CSV usando a biblioteca `xlsx` (ja instalada)
   - Query paginada em `store_leads` com JOIN em `lead_cart_items` para determinar status

3. **`src/components/marketing/LeadDetailExpander.tsx`**
   - Componente colapsavel que mostra os itens do carrinho de um lead especifico
   - Nome do produto, cor, tamanho, quantidade, preco

### Alteracoes em arquivos existentes

1. **`src/pages/Marketing.tsx`**:
   - Adicionar nova aba "Analytics" (6a aba) com icone BarChart3 entre "Grupos" e "Contatados"
   - A aba renderiza `AnalyticsDashboard` seguido de `LeadsCRM`
   - O filtro de periodo do AnalyticsDashboard tambem e passado ao LeadsCRM para sincronizar

### Queries de dados

**Visitantes Unicos**:
```sql
SELECT COUNT(DISTINCT device_id) FROM catalog_product_views
WHERE owner_id = :uid AND created_at BETWEEN :start AND :end
```

**Taxa de Captura**:
```sql
-- Leads capturados no periodo
SELECT COUNT(*) FROM store_leads
WHERE owner_id = :uid AND created_at BETWEEN :start AND :end
-- Dividido pelos visitantes unicos acima
```

**Carrinhos Abandonados**:
```sql
SELECT COUNT(DISTINCT lead_id) FROM lead_cart_items
WHERE status = 'abandoned' AND created_at BETWEEN :start AND :end
AND lead_id IN (SELECT id FROM store_leads WHERE owner_id = :uid)
```

**Grafico de Trafego Diario**:
```sql
SELECT DATE(created_at) as day, COUNT(DISTINCT device_id) as visitors
FROM catalog_product_views
WHERE owner_id = :uid AND created_at BETWEEN :start AND :end
GROUP BY DATE(created_at)
ORDER BY day
```

**Leads com Status (paginado)**:
- Busca `store_leads` filtrado por owner_id e periodo
- Para cada lead, busca `lead_cart_items` para determinar status
- Usa `.range(offset, offset + 19)` para paginacao

### Exportacao CSV

Usar a biblioteca `xlsx` ja instalada para gerar o arquivo:
- Colunas: Nome, WhatsApp, Status, Data de Captura, Produtos, Valor Total
- Filtrado pelo periodo e status selecionados
- Download automatico no navegador

### Sequencia de implementacao

1. Criar `AnalyticsDashboard.tsx` com filtro de periodo, MetricCards e grafico
2. Criar `LeadDetailExpander.tsx` para exibir itens do carrinho
3. Criar `LeadsCRM.tsx` com tabela, busca, filtros, paginacao e exportacao CSV
4. Atualizar `Marketing.tsx` com nova aba "Analytics"
