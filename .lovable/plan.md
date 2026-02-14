
# Integracoes de Trafego Pago (Google Ads, Meta Ads, TikTok Ads)

## Resumo

Criar toda a infraestrutura para que o utilizador conecte contas de anuncios (Google, Meta, TikTok) e lance campanhas com "1 clique" diretamente da aba Marketing, com trava de seguranca que pausa anuncios automaticamente quando o stock chega a zero.

---

## Epico 10: Conexao de Contas

### Migracao de Banco de Dados

Nova tabela `user_ad_integrations`:

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid NOT NULL | Vinculo ao utilizador |
| platform | text NOT NULL | 'google_ads', 'meta_ads', 'tiktok_ads' |
| access_token | text | Token de acesso (encriptado logicamente) |
| refresh_token | text | Token de refresh |
| account_id | text | ID da conta de anuncios na plataforma |
| account_name | text | Nome amigavel da conta |
| is_active | boolean DEFAULT true | Conexao ativa |
| token_expires_at | timestamptz | Expiracao do access_token |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

Restricao UNIQUE em (owner_id, platform).

RLS: owner_id = auth.uid() para todas as operacoes (SELECT, INSERT, UPDATE, DELETE).

Nova tabela `ad_campaigns`:

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid NOT NULL | |
| integration_id | uuid NOT NULL | FK para user_ad_integrations |
| product_id | uuid | Produto vinculado |
| platform | text NOT NULL | 'google_ads', 'meta_ads', 'tiktok_ads' |
| platform_campaign_id | text | ID da campanha na plataforma |
| campaign_name | text | Nome gerado automaticamente |
| daily_budget | numeric NOT NULL | Orcamento diario em BRL |
| status | text DEFAULT 'pending' | 'pending', 'active', 'paused', 'paused_no_stock', 'completed', 'error' |
| campaign_type | text | 'boost', 'performance_max', 'search' |
| target_url | text | URL de destino do anuncio |
| error_message | text | Mensagem de erro se houver |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

RLS: owner_id = auth.uid() para todas as operacoes.

### UI: Seccao "Integracoes de Trafego" na pagina Settings

Novo componente `src/components/settings/AdIntegrationsSection.tsx`:
- Card com titulo "Integracoes de Trafego Pago"
- 3 linhas, uma para cada plataforma (Google Ads, Meta/Instagram Ads, TikTok Ads)
- Cada linha mostra: icone da plataforma, nome, status (Conectado/Desconectado), botao "Conectar" ou "Desconectar"
- Quando conectado, mostra o nome da conta e badge verde "Ativo"
- Botao "Conectar" abre um Dialog explicando que o fluxo OAuth sera ativado quando as credenciais estiverem configuradas. Por enquanto, permite inserir manualmente um token de teste

O componente busca dados de `user_ad_integrations` filtrado pelo owner_id.

### Edge Function: `ad-oauth-callback`

Esqueleto da Edge Function `supabase/functions/ad-oauth-callback/index.ts`:
- Recebe `platform`, `code` e `state` como parametros
- Comentarios documentando o fluxo OAuth para cada plataforma:
  - Google: exchange code via `https://oauth2.googleapis.com/token`
  - Meta: exchange code via `https://graph.facebook.com/v19.0/oauth/access_token`
  - TikTok: exchange code via `https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/`
- Guarda access_token e refresh_token em `user_ad_integrations`
- Retorna sucesso com redirect para `/settings`

### Edge Function: `ad-refresh-token`

Esqueleto da Edge Function `supabase/functions/ad-refresh-token/index.ts`:
- Recebe `integration_id`
- Verifica `token_expires_at` e faz refresh se necessario
- Atualiza `access_token` e `token_expires_at` na tabela
- Comentarios documentando endpoints de refresh para cada plataforma

---

## Epico 11: Cards de Acao para Anuncios (1 Clique)

### Nova aba "Anuncios" na pagina Marketing

Adicionar 7a aba "Anuncios" com icone `Megaphone` (ou `Zap`) no `TabsList`:
- Busca `ad_campaigns` do utilizador para mostrar campanhas ativas
- Busca `marketing_tasks` com novos task_types para mostrar recomendacoes

### Novos task_types no generate-marketing-tasks

Expandir a Edge Function existente com 2 novos cenarios:

1. **`ad_boost_meta`**: Produto com alto stock (>10 unidades) E alta conversao organica (>5% taxa de conversao nas views). Card: "Multiplique suas Vendas! Tem [Qtd] unidades de [Produto]. Vamos mostrar a mais pessoas?"

2. **`ad_google_pmax`**: Produto com stock parado (>15 dias sem venda, >5 unidades). Card: "Ativar Maquina de Vendas no Google para [Produto]."

Ambos incluem `product_id` e `metric_value` (quantidade em stock).

### Novo componente `src/components/marketing/AdBoostCard.tsx`

Card de acao para anuncios com:
- Titulo e descricao do cenario
- Badge da plataforma (Meta/Google/TikTok)
- **Slider de orcamento**: Range de R$15 a R$100/dia usando o componente Slider existente
- Valor selecionado exibido em tempo real (ex: "R$ 30/dia")
- Estimativa simples: "Alcance estimado: ~{budget * 100} pessoas/dia"
- Botao "Criar Anuncio Agora" com icone de foguete
- Se a plataforma nao estiver conectada, mostra aviso com link para Settings

### Novo componente `src/components/marketing/ActiveCampaignsList.tsx`

Lista de campanhas ativas/recentes:
- Status com badge colorido (Ativo=verde, Pausado=amarelo, Pausado por Stock=vermelho, Erro=vermelho)
- Orcamento diario
- Botoes de Pausar/Retomar
- Indicador "Pausado automaticamente - stock esgotado" quando aplicavel

### Edge Function: `create-ad-campaign`

`supabase/functions/create-ad-campaign/index.ts`:
- Recebe: `product_id`, `platform`, `daily_budget`, `campaign_type`
- Verifica se a integracao esta ativa em `user_ad_integrations`
- Monta o payload da campanha baseado na plataforma:
  - **Meta**: Comentarios documentando chamada a `POST /act_{ad_account_id}/campaigns` com objetivo OUTCOME_TRAFFIC ou OUTCOME_SALES
  - **Google**: Comentarios documentando criacao de campanha Performance Max via Google Ads API
  - **TikTok**: Comentarios documentando `POST /campaign/create/` via TikTok Marketing API
- Gera a `target_url` automaticamente: `{origin}/{store_slug}?utm_source={platform}&utm_campaign=vp_boost&product={product_id}`
- Insere registro em `ad_campaigns` com status 'active' (ou 'pending' em producao)
- Retorna o ID da campanha criada

### Edge Function: `manage-ad-campaign`

`supabase/functions/manage-ad-campaign/index.ts`:
- Acoes: 'pause', 'resume', 'delete'
- Recebe `campaign_id` e `action`
- Atualiza status em `ad_campaigns`
- Comentarios documentando chamadas de pause/enable para cada plataforma

---

## Epico 12: Trava de Seguranca "Always Profit"

### Trigger de banco de dados

Criar funcao e trigger `check_stock_and_pause_ads`:
- Dispara em UPDATE da tabela `products` quando `stock_quantity` muda para 0
- Busca campanhas ativas em `ad_campaigns` com o `product_id` afetado
- Atualiza status para `'paused_no_stock'`
- Insere um `marketing_task` com task_type `'ad_stock_paused'` e titulo "Anuncios pausados automaticamente - [Produto] esgotou!"

Trigger tambem em `product_variants`:
- Quando todas as variantes de um produto chegam a stock 0, verificar se o produto pai tem campanhas ativas

### Novo task_type para avisos

`ad_stock_paused`: Card de aviso vermelho no Marketing mostrando:
- "Os anuncios de [Produto] foram pausados automaticamente porque o stock acabou. Dinheiro salvo!"
- Badge "Always Profit" em destaque
- Botao "Reativar quando repor stock" (marca como concluido)

### Componente `src/components/marketing/AdStockPausedCard.tsx`

Card de alerta com visual diferenciado (borda vermelha, icone de escudo):
- Mensagem clara sobre a pausa automatica
- Valor estimado que foi "salvo" (orcamento diario da campanha)
- Checkbox para marcar como visto/concluido

---

## Alteracoes em Arquivos Existentes

### `src/pages/Marketing.tsx`
- Adicionar nova aba "Anuncios" (7a aba) com icone Zap entre "Analytics" e "Contatados"
- Importar `AdBoostCard`, `ActiveCampaignsList`, `AdStockPausedCard`
- Buscar tasks com task_types: `ad_boost_meta`, `ad_google_pmax`, `ad_stock_paused`
- Buscar campanhas ativas de `ad_campaigns`
- Buscar integracoes de `user_ad_integrations` para saber quais plataformas estao conectadas

### `src/pages/Settings.tsx`
- Importar e renderizar `AdIntegrationsSection` entre ShippingSettings e AISettings

### `supabase/functions/generate-marketing-tasks/index.ts`
- Adicionar logica para gerar tasks `ad_boost_meta` e `ad_google_pmax`
- Verificar se o utilizador tem integracoes ativas antes de gerar os cards

### `supabase/config.toml`
- Adicionar entradas para as novas Edge Functions com `verify_jwt = false`

---

## Sequencia de Implementacao

1. Migracao: criar tabelas `user_ad_integrations` e `ad_campaigns` com RLS + trigger de stock
2. Criar Edge Functions esqueleto: `ad-oauth-callback`, `ad-refresh-token`, `create-ad-campaign`, `manage-ad-campaign`
3. Criar componente `AdIntegrationsSection` e adicionar a Settings
4. Criar componentes `AdBoostCard`, `ActiveCampaignsList`, `AdStockPausedCard`
5. Expandir `generate-marketing-tasks` com novos cenarios de anuncios
6. Atualizar `Marketing.tsx` com nova aba "Anuncios"
