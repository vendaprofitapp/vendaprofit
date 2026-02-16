

# Modo Evento - Backend (Banco de Dados + Storage)

## Resumo

Criar a infraestrutura de backend para o "Modo Evento", permitindo que vendedoras criem botoes rapidos e registrem rascunhos de vendas durante eventos presenciais, com fotos e notas de voz.

## Novas Tabelas

### 1. `event_quick_buttons`

Botoes customizados para registro rapido durante eventos.

| Coluna | Tipo | Nullable | Default | Descricao |
|--------|------|----------|---------|-----------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| owner_id | uuid | NOT NULL | auth.uid() | Dono do botao |
| label | text | NOT NULL | - | Rotulo (ex: "Legging") |
| default_price | numeric | YES | NULL | Preco padrao opcional |
| color | text | NOT NULL | '#8B5CF6' | Cor hex de exibicao |
| sort_order | integer | NOT NULL | 0 | Ordem de exibicao |
| created_at | timestamptz | NOT NULL | now() | - |

### 2. `event_sale_drafts`

Rascunhos de vendas registrados durante o evento.

| Coluna | Tipo | Nullable | Default | Descricao |
|--------|------|----------|---------|-----------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| owner_id | uuid | NOT NULL | auth.uid() | Dono |
| photo_urls | text[] | YES | '{}' | URLs das fotos das pecas |
| items | jsonb | NOT NULL | '[]' | Array de itens: [{button_id, label, quantity, price}] |
| notes | text | YES | NULL | Observacoes / transcricao de voz |
| estimated_total | numeric | NOT NULL | 0 | Valor total estimado |
| status | text | NOT NULL | 'pending' | 'pending' ou 'reconciled' |
| created_at | timestamptz | NOT NULL | now() | - |
| updated_at | timestamptz | NOT NULL | now() | - |

### 3. Storage Bucket: `event-photos`

Bucket publico para fotos tiradas durante eventos, com RLS para upload restrito ao dono.

## Politicas RLS

Ambas as tabelas terao politicas identicas ao padrao do projeto:
- **SELECT**: `owner_id = auth.uid()`
- **INSERT**: `owner_id = auth.uid()`
- **UPDATE**: `owner_id = auth.uid()`
- **DELETE**: `owner_id = auth.uid()`

Storage `event-photos`:
- **INSERT** (upload): autenticado, path comeca com `uid/`
- **SELECT** (download): publico
- **DELETE**: autenticado, path comeca com `uid/`

## Trigger

- `update_updated_at_column` em `event_sale_drafts` para atualizar `updated_at` automaticamente (reutilizando a funcao existente no projeto).

## Nenhuma dependencia nova

Usa apenas o que ja existe no projeto.

## Resumo de Arquivos

| Item | Acao |
|------|------|
| Migration SQL | Criar tabelas, RLS, bucket e trigger |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente apos migration |

