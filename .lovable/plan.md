
# CRM de WhatsApp - Reestruturacao do Modulo de Marketing

## Visao Geral

Criar uma nova pagina dedicada "WhatsApp CRM" focada em recuperacao de vendas, renomear "Marketing" para "Redes Sociais / Google" na sidebar e extrair toda a logica de leads/carrinhos abandonados da pagina Marketing atual.

## Alteracoes

### 1. Sidebar (`src/components/layout/Sidebar.tsx`)

Renomear o item "Marketing" para "Redes Sociais / Google" e adicionar "WhatsApp" logo abaixo.

Ordem final do grupo MARKETING:
- Clientes
- Redes Sociais / Google (Megaphone, /marketing)
- WhatsApp (MessageCircle, /marketing/whatsapp)
- Fidelidade
- Incentivos
- Area Secreta
- Video Vendedor

### 2. Nova pagina `src/pages/WhatsAppCRM.tsx`

**5 Cards Resumo no topo:**
- "Carrinhos Abandonados" com valor total em R$ (lead_cart_items com status "abandoned")
- "Novos Cadastros" com contagem de leads recentes sem itens no carrinho (store_leads sem lead_cart_items)
- "Aguardando Retorno" com contagem de leads com status "contacted"
- "Aniversariantes do Mes" buscando da tabela `customers` onde `birth_date` tem o mesmo mes atual
- "30 Dias sem Visita/Compra" buscando `customers` cuja ultima venda (`sales.created_at`) ou ultima visualizacao (`catalog_product_views.created_at` ou `store_leads.last_seen_at`) foi ha mais de 30 dias

**Tabs (2 abas):**

Aba "Pendentes":
- Lista filtrada pelos cards de resumo (ao clicar um card, filtra a lista)
- Cada item mostra: Nome, Telefone formatado, Badge de tipo (laranja "Carrinho Abandonado" / azul "Novo Cadastro" / rosa "Aniversariante" / cinza "Inativo 30d"), Valor do carrinho se houver
- Botao "Chamar no WhatsApp" (1-click): abre wa.me com mensagem pre-formatada de acordo com o tipo (carrinho abandonado, boas-vindas, parabens, saudade) e move para "Contatados"

Aba "Contatados":
- Lista leads ja contatados
- Botoes: "Fazer Follow-up" (reabre WhatsApp), "Converter em Venda" (CheckCircle, marca como "converted"), "Descartar" (X, marca como "cancelled")

### 3. Atualizar pagina Marketing (`src/pages/Marketing.tsx`)

- Remover as abas "Pendentes" e "Contatados" e toda logica associada (queries de leads, mutations markContacted/sendWhatsApp, componente AbandonedCartCard, interface LeadWithCart)
- Reduzir TabsList de 8 colunas para 6: Conteudo, SEO, Grupos, Analytics, Anuncios, Vitrines
- Renomear titulo de "Marketing" para "Redes Sociais / Google"

### 4. Rotas (`src/App.tsx`)

Adicionar rota protegida `/marketing/whatsapp` -> WhatsAppCRM

### 5. Banco de Dados

Nenhuma alteracao necessaria. Todas as tabelas ja existem:
- `store_leads` + `lead_cart_items` para leads/carrinhos
- `customers` com `birth_date` para aniversariantes
- `sales` para detectar inatividade de compra
- `catalog_product_views` / `store_leads.last_seen_at` para inatividade de visita

## Detalhes Tecnicos

### Queries da pagina WhatsAppCRM

1. **Carrinhos abandonados**: `lead_cart_items` com status "abandoned" + join `store_leads` filtrado por owner_id
2. **Novos cadastros**: `store_leads` que NAO possuem `lead_cart_items`, criados nos ultimos 7 dias
3. **Aguardando retorno**: `lead_cart_items` com status "contacted" + join `store_leads`
4. **Aniversariantes do mes**: `customers` filtrados pelo mes atual do `birth_date` (filtro client-side como ja feito no SystemAlerts)
5. **30 dias sem visita/compra**: `customers` com join em `sales` para pegar a ultima compra; filtrar onde a ultima compra foi ha mais de 30 dias ou nunca comprou

### Mutations

- `markContacted`: Atualiza `lead_cart_items.status` para "contacted" (para leads com carrinho)
- `convertLead`: Atualiza status para "converted"
- `discardLead`: Atualiza status para "cancelled"
- Para clientes (aniversariantes/inativos) sem lead_cart_items, o botao WhatsApp apenas abre o link sem mutation

### Mensagens pre-formatadas por tipo

- Carrinho abandonado: "Oi {nome}, vi que voce separou pecas lindas... posso ajudar?"
- Novo cadastro: "Oi {nome}, bem-vinda a {loja}! Tem novidades incriveis te esperando"
- Aniversariante: "Parabens {nome}! A {loja} preparou algo especial pra voce"
- Inativo 30d: "Oi {nome}, sentimos sua falta! Tem muita novidade na {loja}"

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/WhatsAppCRM.tsx` | Criar (pagina completa do CRM com cards + tabs) |
| `src/pages/Marketing.tsx` | Remover abas Pendentes/Contatados, renomear titulo, reduzir tabs |
| `src/components/layout/Sidebar.tsx` | Renomear "Marketing" e adicionar "WhatsApp" |
| `src/App.tsx` | Adicionar rota /marketing/whatsapp |
