# VENDA PROFIT — Documento de Arquitetura de Software

> Gerado em: 2026-03-10 | Para uso pelo assistente especializado GEM

---

## 1. STACK TECNOLÓGICO

### Frontend
| Tecnologia | Versão | Papel |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | via vite | Tipagem estática |
| Vite | via config | Build tool (target: `es2020`, iOS 14+) |
| Tailwind CSS | via config | Estilização utility-first |
| shadcn/ui + Radix UI | múltiplas | Componentes acessíveis |
| TanStack Query | 5.83.0 | Server state / cache |
| React Hook Form + Zod | 7.x / 3.x | Formulários e validação |
| React Router DOM | 6.30.1 | Roteamento SPA |
| Recharts | 2.15.4 | Gráficos e dashboards |
| date-fns | 3.6.0 | Manipulação de datas |
| xlsx | 0.18.5 | Exportação de planilhas |
| Sonner | 1.7.4 | Notificações toast |
| next-themes | 0.3.0 | Tema claro/escuro |
| qrcode.react | 4.2.0 | Geração de QR Codes |
| browser-image-compression | 2.0.2 | Compressão de imagens no cliente |

### Backend (Lovable Cloud / Supabase)
| Tecnologia | Papel |
|---|---|
| PostgreSQL (Supabase) | Banco relacional principal |
| Row Level Security (RLS) | Isolamento de dados por `owner_id` |
| Edge Functions (Deno) | Lógica serverless, integrações externas |
| `pg_net` | HTTP assíncrono disparado por triggers |
| Supabase Realtime | Subscriptions para notificações |
| Supabase Storage | Armazenamento de imagens e vídeos |

### Build Config
```ts
// vite.config.ts — target es2020, compatibilidade iOS 14+
// tailwind.config.ts — tokens HSL em index.css
// tsconfig.app.json — strict mode ativo
```

---

## 2. MODELAGEM DE DADOS (SUPABASE)

### Tabelas Principais

#### `products`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador |
| `owner_id` | uuid | FK para auth.users (via RLS) |
| `name` | text | Nome do produto |
| `cost_price` | numeric | Preço de custo |
| `sale_price` | numeric | Preço de venda |
| `stock_quantity` | integer | **Sincronizado automaticamente** via trigger |
| `category` | text | Categoria livre |
| `supplier_id` | uuid FK | Fornecedor |
| `marketing_status` | text | Status de divulgação |
| `image_url` / `image_urls` | text / array | Imagens |

#### `product_variants`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador |
| `product_id` | uuid FK → products | Produto pai |
| `size` | text | Tamanho/variação |
| `color` | text | Cor |
| `stock_quantity` | integer | Estoque da variante |
| `sku` | text | Código interno |

> **Invariante crítica**: `products.stock_quantity` = Σ `product_variants.stock_quantity`, mantida pelo trigger `sync_product_stock_from_variants`.

#### `sales`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador |
| `owner_id` | uuid | Vendedor principal |
| `customer_id` | uuid FK → customers | Cliente (opcional) |
| `total_amount` | numeric | Valor total |
| `payment_method` | text | Método de pagamento |
| `sale_date` | timestamptz | Data da venda |
| `source` | text | `manual`, `catalog`, `voice`, `event`, `hub`, `consignment`, `bazar` |
| `shipping_cost` | numeric | Frete cobrado |
| `status` | text | `completed`, `cancelled` |

#### `sale_items`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador |
| `sale_id` | uuid FK → sales | Venda pai |
| `product_id` | uuid FK → products | Produto |
| `variant_id` | uuid FK → product_variants | Variante (opcional) |
| `quantity` | integer | Quantidade vendida |
| `unit_price` | numeric | Preço unitário aplicado |
| `cost_price` | numeric | Custo na época da venda |

#### `financial_splits`
Registra a divisão financeira de cada venda em parcerias (grupo/hub).

#### Outras tabelas relevantes
- `customers` — CRM de clientes com histórico de gasto
- `hub_connections` / `hub_pending_orders` / `hub_sale_splits` — Módulo Hub de Vendas
- `consignments` / `consignment_items` — Módulo de Consignação
- `partner_points` / `partner_point_items` — Pontos Parceiros
- `bazar_items` — Módulo Bazar C2C
- `expenses` / `expense_installments` — Financeiro / DRE
- `consortiums` / `consortium_participants` — Consórcios
- `groups` / `group_members` — Grupos de parceria
- `store_leads` / `lead_cart_items` — Leads do catálogo público

### Relacionamentos Essenciais
```
products ──< product_variants
products ──< sale_items >── sales
sales >── customers
sales ──< financial_splits >── profiles
hub_connections >── hub_pending_orders ──< hub_pending_order_items
consignments ──< consignment_items >── products
```

### Triggers Ativos

| Trigger | Tabela | Função | Descrição |
|---|---|---|---|
| `sync_product_stock_from_variants` | `product_variants` | AFTER INSERT/UPDATE/DELETE | Recalcula `products.stock_quantity` |
| `accumulate_customer_spending` | `sales` | AFTER INSERT | Soma `total_amount` em `customers.total_spent` |
| `notify_botconversa_on_sale` | `sales` | AFTER INSERT | Chama Edge Function via `pg_net` |
| `notify_botconversa_catalog_sale` | `sales` | AFTER INSERT (source=catalog) | **Resolvido recentemente** — trigger separado para notificações de venda pelo catálogo |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | Cria registro em `profiles` |
| `update_hub_order_on_sale` | `sales` | AFTER INSERT | Vincula venda ao pedido Hub |

---

## 3. FLUXOS DE NEGÓCIO E ARQUITETURA DE PASTAS

### Fluxo de Nova Venda (PDV)

```
src/components/sales/NewSaleDialog.tsx   ← Monolito (~3.100 linhas) — GARGALO
│
├── Origem da venda (source):
│   ├── manual        → seleção direta de produtos
│   ├── voice         → VoiceSaleDialog → Edge Function parse-voice-sale
│   ├── catalog       → venda originada do catálogo público
│   ├── event         → EventMode.tsx (PDV simplificado p/ feiras)
│   ├── hub           → HubFinalizeOrderDialog
│   ├── consignment   → ConsignmentDetailsDialog
│   └── bazar         → BazarCheckoutDialog
│
├── Carrinho: estado local (useState/useReducer)
├── Pagamento: múltiplos métodos + parcelamento + custom
├── Frete: ShippingSection → Edge Function quote-shipping
└── Persistência: RPC create_sale_transaction (atômico)
    ├── INSERT sales
    ├── INSERT sale_items
    ├── UPDATE product_variants.stock_quantity
    └── TRIGGER → financial_splits / botconversa
```

### Fluxo de Venda pelo Catálogo Público

```
src/pages/StoreCatalog.tsx   ← Catálogo público (URL: /loja/:slug)
│
├── LeadCaptureSheet      → captura lead antes de finalizar
├── BazarShowcaseDialog   → exibe itens do Bazar
├── VipAreaDrawer         → área VIP por nível de fidelidade
├── WaitlistDialog        → lista de espera para produtos
└── BazarCheckoutDialog   → checkout C2C
    └── Edge Function checkout-bazar
```

### Gestão de Estoque

```
src/pages/StockControl.tsx   ← ~13 filtros client-side — GARGALO
│
├── ProductFormDialog     → cadastro/edição de produto
│   ├── ProductVariantsSection  → grade de variantes
│   ├── ProductMediaSection     → upload de imagens (Storage)
│   └── ProductVideoUpload      → vídeo do produto
│
├── StockImportDialog     → importação via XML (NF-e)
├── SupplierBulkImportDialog → importação em lote
├── UrlProductImporter    → scraping via Firecrawl
├── VoiceStockDialog      → comando de voz → parse-voice-stock
└── StockExportDialog     → exportação XLSX
```

### Estrutura de Pastas `src/components/`

```
src/components/
├── admin/          → Ferramentas de super-admin (scanner de produtos, backup, usuários)
│   ├── AdminProductEditDialog.tsx
│   ├── BackupSection.tsx
│   ├── BotconversaAdminSection.tsx
│   ├── BrandRequestsList.tsx
│   ├── NewProductsScanner.tsx
│   ├── PropagateProductsDialog.tsx
│   ├── SupplierCatalogTab.tsx
│   ├── TutorialTab.tsx
│   └── VideoUploader.tsx
│
├── catalog/        → Componentes do catálogo público (B2C)
│   ├── AIFittingRoomDialog.tsx    → IA de experimentação virtual
│   ├── BazarCheckoutDialog.tsx
│   ├── BazarShowcaseDialog.tsx
│   ├── BazarSubmissionDialog.tsx
│   ├── ConsignmentStockBadge.tsx
│   ├── CustomerFilters.tsx
│   ├── FeaturedProductsDialog.tsx
│   ├── LeadCaptureSheet.tsx       → captura de leads
│   ├── LivingProductCard.tsx      → card de produto animado
│   ├── LoyaltyHeader.tsx
│   ├── PartnerOrdersSection.tsx
│   ├── PurchaseIncentives.tsx
│   ├── VipAreaDrawer.tsx
│   └── WaitlistDialog.tsx
│
├── sales/          → PDV e dialogs de venda
├── stock/          → Gestão de produtos e estoque
├── hub/            → Módulo Hub de Vendas B2B
├── consignment/    → Módulo de Consignação
├── partners/       → Pontos Parceiros
├── consortium/     → Módulo de Consórcios
├── bazar/          → Módulo Bazar C2C
├── financial/      → DRE e Despesas
├── marketing/      → CRM, Leads, Campanhas de Ads
├── dashboard/      → Métricas e gráficos
├── settings/       → Configurações do lojista
├── layout/         → Header, Sidebar, MainLayout
└── ui/             → shadcn/ui base components
```

---

## 4. INTEGRAÇÕES

### Botconversa / WhatsApp
**Arquitetura passiva multi-evento via triggers + pg_net:**

```
Database Trigger (AFTER INSERT on sales)
    └── pg_net.http_post(...)
        └── Edge Function: botconversa-notify/index.ts
            ├── Busca configuração do owner (API key, webhooks)
            ├── Monta payload do evento (nova_venda, venda_catalogo, etc.)
            └── POST → https://api.botconversa.com.br/api/v1/...
                └── Dispara automação no WhatsApp do cliente
```

**Eventos suportados:**
- `nova_venda` — qualquer venda no PDV
- `venda_catalogo` — venda originada do catálogo público (**trigger recentemente corrigido**)
- `novo_lead` — lead capturado no catálogo
- `lembrete_pagamento` — cobranças via `PaymentRemindersSection`

**Logs:** Tabela `botconversa_logs` para auditoria de disparos.

### Melhor Envio (Frete)
- Edge Functions: `quote-shipping`, `quote-bazar-shipping`, `purchase-shipping`
- Calcula frete em tempo real no PDV e no Bazar
- Compra etiqueta e armazena URL em `sales.shipping_label_url`

### Firecrawl (Web Scraping)
- Edge Functions: `firecrawl-scrape`, `scrape-product-data`, `scrape-product-images`, `map-supplier-site`
- Usado em `UrlProductImporter` e `SupplierImageScraper` para importar produtos de fornecedores

### Meta Ads / Google Ads
- Edge Functions: `create-ad-campaign`, `manage-ad-campaign`, `ad-oauth-callback`, `ad-refresh-token`
- Fluxo OAuth completo, gestão de campanhas por produto
- Tabela `ad_campaigns` e `user_ad_integrations`

### IA (Gemini / OpenAI via Lovable AI)
- `parse-voice-sale` → transcrição de áudio em itens de venda
- `parse-voice-stock` → transcrição de áudio em entrada de estoque
- `transcribe-audio` → transcrição genérica
- `ai-fitting-room` → experimentação virtual de roupas (`AIFittingRoomDialog`)
- `generate-marketing-tasks` → geração de tarefas de marketing
- `scrape-product-data` → extração inteligente de dados de produtos
- Configuração via `src/hooks/useAIConfig.tsx` e `src/components/settings/AISettingsSection.tsx`

### Always Profit (Webhook)
- Edge Function: `always-profit-webhook`
- Integração com plataforma parceira para sincronização de dados

### Parse Invoice (NF-e)
- Edge Function: `parse-invoice`
- Leitura de XML de Nota Fiscal para importação automática de produtos/estoque

---

## 5. PONTOS DE ATENÇÃO / GARGALOS (Mobile-First)

### 🔴 Gargalo 1 — `NewSaleDialog.tsx` (~3.100 linhas)
**Problema:** Componente monolítico com estado global para carrinho, pagamento, frete, variantes e múltiplas origens de venda. Re-renderizações custosas em cada keystroke.

**Impacto mobile:** Em dispositivos de baixo desempenho, o dialog trava ao adicionar itens ao carrinho.

**Solução recomendada:**
```
Decomposição em hooks especializados:
- useCartManager()      → estado e operações do carrinho
- usePaymentManager()   → métodos e parcelamento
- useShippingQuote()    → cotação de frete
- useSaleSubmit()       → submit final e RPC

+ Lazy loading das seções de pagamento e frete
```

### 🟡 Gargalo 2 — `StockControl.tsx` (filtros client-side)
**Problema:** Carrega todos os produtos do `owner_id` (até 1000 via limite Supabase) e aplica 13 filtros no cliente com `useMemo`. Com catálogos grandes (500+ produtos), isso gera processamento excessivo no thread principal.

**Impacto mobile:** Scroll lento e travamentos ao aplicar filtros.

**Solução recomendada:**
```typescript
// Migrar para server-side filtering + paginação
const { data, fetchNextPage } = useInfiniteQuery({
  queryFn: ({ pageParam }) =>
    supabase.from('products')
      .eq('owner_id', userId)
      .ilike('name', `%${search}%`)  // filtro no banco
      .range(pageParam, pageParam + 49)
      .order('created_at', { ascending: false })
});
```

### 🟡 Gargalo 3 — `Sidebar.tsx` (queries redundantes)
**Problema:** O Sidebar executa queries independentes para `profiles`, `store_settings`, notificações e plano do usuário a cada mount. Em navegações frequentes (especialmente mobile com histórico de rotas), isso gera múltiplas requisições duplicadas.

**Impacto mobile:** Flicker de conteúdo e consumo desnecessário de dados.

**Solução recomendada:**
```typescript
// Mover para contexto global — ex: UserContext
const { profile, settings, plan, notifications } = useUserContext();
// staleTime: Infinity para dados que mudam raramente (profile, settings)
// staleTime: 30s para notificações
```

---

## Resumo de Edge Functions Ativas (28 total)

| Função | Propósito |
|---|---|
| `botconversa-notify` | Notificações WhatsApp |
| `parse-voice-sale` | IA → venda por voz |
| `parse-voice-stock` | IA → estoque por voz |
| `transcribe-audio` | Transcrição de áudio |
| `ai-fitting-room` | IA de moda |
| `generate-marketing-tasks` | Tarefas de marketing via IA |
| `quote-shipping` | Cotação de frete (PDV) |
| `quote-bazar-shipping` | Cotação de frete (Bazar) |
| `purchase-shipping` | Compra de etiqueta |
| `checkout-bazar` | Checkout Bazar C2C |
| `firecrawl-scrape` | Scraping de URLs |
| `scrape-product-data` | Extração de dados de produto |
| `scrape-product-images` | Extração de imagens |
| `map-supplier-site` | Mapeamento de site de fornecedor |
| `parse-invoice` | Leitura de NF-e XML |
| `create-ad-campaign` | Criação de campanha de anúncios |
| `manage-ad-campaign` | Gerenciamento de anúncios |
| `ad-oauth-callback` | OAuth para plataformas de ads |
| `ad-refresh-token` | Renovação de token de ads |
| `hub-accept-invite` | Aceite de convite Hub |
| `hub-debug` | Debug do módulo Hub |
| `accept-partner-contract` | Aceite de contrato de parceria |
| `recalculate-partnership-splits` | Recalculo de divisões |
| `backup-data` | Backup dos dados do lojista |
| `always-profit-webhook` | Integração Always Profit |
| `product-feed` | Feed de produtos (Meta/Google) |
| `check-b2b-stock` | Verificação de estoque B2B |
| `_shared/ai-adapter` | Adaptador unificado de IA |

---

*Documento gerado automaticamente para o assistente GEM — Venda Profit*
