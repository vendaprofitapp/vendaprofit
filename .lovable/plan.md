# Captura de Leads e Painel de Marketing (WhatsApp)

## Resumo

Implementar captura progressiva de contatos na loja publica (StoreCatalog) e criar uma pagina de Marketing no painel do vendedor com cards de acao para recuperacao de carrinhos abandonados via WhatsApp.

---

## Epico 1: Captura Progressiva na Loja

### Fluxo do usuario

1. Visitante clica "Adicionar" no primeiro produto
2. Produto e adicionado ao carrinho normalmente
3. Um Bottom Sheet (mobile) ou Dialog (desktop) aparece pedindo Nome e WhatsApp com a mensagem de "reserva de estoque"
4. Apos preencher, dados sao salvos no localStorage e no banco de dados
5. Em visitas futuras, o visitante e reconhecido pelo localStorage e nao precisa preencher novamente

### Persistencia

- **localStorage**: chave `store_lead_{slug}` com `{ name, whatsapp, captured_at }`
- **Banco de dados**: tabela `store_leads` para o vendedor acessar os contatos capturados
- **Carrinho**: ao enviar WhatsApp (checkout atual) OU apos timeout configuravel, os itens do carrinho sao registrados como `lead_cart_items` vinculados ao lead

---

## Epico 2: Dashboard de Marketing

### Nova pagina `/marketing`

- Adicionada ao Sidebar com icone de megafone
- Rota protegida como as demais

### Cards de Acao

- **Card "Recuperar Carrinho"**: mostra leads que abandonaram o carrinho (tem itens mas nao finalizaram via WhatsApp)
  - Nome do cliente, valor total do carrinho, tempo desde o abandono
  - Botao "Enviar WhatsApp" abre `wa.me/{numero}` com mensagem pre-preenchida usando nome do cliente e nome da loja
  - Apos clicar, card muda para status "contacted" e vai para aba "Contatados"
- **Abas**: "Pendentes" e "Contatados" para organizar o feed

---

## Detalhes Tecnicos

### Novas tabelas no banco de dados

`**store_leads**`


| Coluna       | Tipo                         | Descricao                             |
| ------------ | ---------------------------- | ------------------------------------- |
| id           | uuid PK                      | &nbsp;                                |
| store_id     | uuid FK -> store_settings.id | Loja onde foi capturado               |
| owner_id     | uuid                         | Dono da loja (para RLS)               |
| name         | text NOT NULL                | Nome do visitante                     |
| whatsapp     | text NOT NULL                | WhatsApp com mascara                  |
| device_id    | text                         | Identificador localStorage para dedup |
| last_seen_at | timestamptz                  | Ultima visita                         |
| created_at   | timestamptz                  | &nbsp;                                |


`**lead_cart_items**`


| Coluna        | Tipo                      | Descricao                               |
| ------------- | ------------------------- | --------------------------------------- |
| id            | uuid PK                   | &nbsp;                                  |
| lead_id       | uuid FK -> store_leads.id | &nbsp;                                  |
| product_id    | uuid                      | ID do produto                           |
| product_name  | text                      | Nome (snapshot)                         |
| variant_color | text                      | Cor                                     |
| selected_size | text                      | Tamanho                                 |
| quantity      | integer                   | &nbsp;                                  |
| unit_price    | numeric                   | Preco no momento                        |
| created_at    | timestamptz               | &nbsp;                                  |
| status        | text                      | 'abandoned' / 'contacted' / 'converted' |


**RLS**: Ambas tabelas com politica `owner_id = auth.uid()` para SELECT/UPDATE/DELETE. INSERT em `store_leads` aberto ao publico (anon) pois visitantes nao estao logados. `lead_cart_items` INSERT via service role ou politica publica vinculada ao lead.

### Alteracoes em arquivos existentes

1. `**src/pages/StoreCatalog.tsx**`:
  - Novo state para controlar o bottom sheet de captura de lead
  - No `addToCart`, verificar localStorage; se nao tem lead, abrir o sheet antes de adicionar
  - Componente `LeadCaptureSheet` com campos Nome e WhatsApp (mascara)
  - Ao submeter, salvar no localStorage e fazer upsert na tabela `store_leads`
  - No `sendCartViaWhatsApp`, registrar os itens do carrinho em `lead_cart_items` com status 'converted'
  - Registrar carrinho abandonado: ao capturar lead, salvar itens atuais do carrinho como snapshot periodico
2. `**src/pages/Marketing.tsx**` (novo):
  - Pagina com abas "Pendentes" e "Contatados"
  - Query em `store_leads` JOIN `lead_cart_items` WHERE status = 'abandoned' e created_at > agora - X horas
  - Cards com nome, valor total, tempo de abandono
  - Botao WhatsApp com `wa.me` e mensagem pre-preenchida
  - Ao clicar, UPDATE status para 'contacted'
3. `**src/components/layout/Sidebar.tsx**`: Adicionar item "Marketing" com icone Megaphone
4. `**src/App.tsx**`: Adicionar rota `/marketing` protegida
5. `**src/components/catalog/LeadCaptureSheet.tsx**` (novo):
  - Bottom Sheet (mobile via Drawer) / Dialog (desktop)
  - Campos Nome e WhatsApp com mascara brasileira
  - Botao "Garantir Minhas Pecas"
  - Validacao com zod

### Logica de deteccao de abandono

- Quando o lead e capturado e ha itens no carrinho, salvar snapshot dos itens em `lead_cart_items` com status 'abandoned'
- Quando o vendedor abre a pagina Marketing, a query busca leads com itens 'abandoned' criados ha mais de 2 horas
- Quando o checkout via WhatsApp e concluido, atualizar status dos itens para 'converted'
- Quando o vendedor clica "Enviar WhatsApp" no card, atualizar para 'contacted'

### Sequencia de implementacao

1. Criar migracao com as duas tabelas + RLS
2. Criar componente `LeadCaptureSheet`
3. Integrar no `StoreCatalog` (addToCart + sendCartViaWhatsApp)
4. Criar pagina `Marketing.tsx`
5. Adicionar rota e item no Sidebar
6. O usuário pode escolher se vai ativar a função de inserção de dados pelo usuário após inserir produtos no carrinho.