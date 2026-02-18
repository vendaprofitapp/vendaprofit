
# Redesign do Catálogo do Ponto Parceiro + Analytics por Ponto

## Visão Geral

Duas frentes de trabalho paralelas e complementares:

1. **`/p/:token` (PartnerCatalog)** — Redesign visual idêntico ao StoreCatalog + captura de leads + rastreamento de visualizações
2. **`/partner-points/:id` (PartnerPointDetail)** — Nova aba "Analytics" para a vendedora ver o desempenho de cada ponto individualmente

---

## Frente 1 — Redesign do Catálogo Público `/p/:token`

### O que muda no visual

A página atual é um grid simples com cards básicos. A nova versão terá:

- **Header white-label** com logo, nome da loja e banner (vindos de `store_settings` do owner)
- **Banner de identificação do ponto** (faixa colorida: "Estoque disponível em [Nome do Ponto]")
- **Grid 2 colunas (mobile) / 4 colunas (desktop)** usando os cards boutique com carrossel de fotos/vídeo
- **Barra de busca** estilizada igual ao StoreCatalog
- **Sacola flutuante** com Sheet lateral para checkout (em vez de mudar de view)
- **Modal de captura de lead** (`LeadCaptureSheet`) — igual ao catálogo principal

### Captura de Leads

O `LeadCaptureSheet` já existe e funciona no StoreCatalog. No catálogo do ponto parceiro ele será acionado na mesma lógica: ao clicar em "Adicionar à sacola" pela primeira vez, se o lead ainda não foi identificado, abre o formulário de nome + WhatsApp.

O lead será salvo em `store_leads` com `owner_id = partnerPoint.owner_id` (da vendedora dona do estoque), e os itens do carrinho em `lead_cart_items` normalmente.

Isso significa que os leads capturados no catálogo do ponto parceiro aparecem no CRM da vendedora junto com os outros leads — ela consegue ver de onde veio (será marcado com `source = "partner_point"` e o `partner_point_id`).

### Rastreamento de Visualizações (Analytics)

O StoreCatalog usa `IntersectionObserver` para registrar uma visualização em `catalog_product_views` quando um card atinge 50% de visibilidade. O mesmo comportamento será replicado no catálogo do ponto, com o `owner_id` da vendedora.

Para diferenciar que a visita veio de um ponto específico, será adicionada uma coluna `partner_point_id` à tabela `catalog_product_views` (migration necessária). Isso permite filtrar no Analytics.

---

## Frente 2 — Aba "Analytics" em `/partner-points/:id`

### Onde fica

Na página de detalhe do ponto parceiro (`PartnerPointDetail`), que já possui abas:
- Estoque | Vendas | Acerto

Será adicionada uma quarta aba: **Analytics**.

### O que a aba exibe

Reutilizando os componentes já existentes (`AnalyticsDashboard` + `LeadsCRM`) com filtro por `partner_point_id`:

| Métrica | Fonte |
|---|---|
| Visitantes únicos do QR | `catalog_product_views` filtrado por `partner_point_id` |
| Taxa de captura | leads / visitantes do ponto |
| Carrinhos ativos/abandonados | `lead_cart_items` dos leads do ponto |
| Gráfico de tráfego diário | mesmo AreaChart do AnalyticsDashboard |
| Lista de leads capturados | LeadsCRM filtrado por `partner_point_id` |

A vendedora consegue responder: "Vale a pena manter arara neste ponto? Quantas pessoas acessaram o QR? Quantas viraram leads? Quantas compraram?"

---

## Arquivos alterados

| Arquivo | Tipo |
|---|---|
| `supabase/migrations/...` | **Migration** — adiciona coluna `partner_point_id` em `catalog_product_views` |
| `src/pages/PartnerCatalog.tsx` | **Reescrita** — novo design + leads + tracking |
| `src/pages/PartnerPointDetail.tsx` | **Edição** — nova aba "Analytics" |
| `src/components/marketing/AnalyticsDashboard.tsx` | **Edição** — aceita `partnerPointId` opcional para filtrar |

### Detalhe técnico da migration

```sql
ALTER TABLE catalog_product_views
  ADD COLUMN IF NOT EXISTS partner_point_id uuid REFERENCES partner_points(id) ON DELETE SET NULL;
```

Essa coluna é nullable — visualizações do catálogo principal continuam sem `partner_point_id`. Apenas as visitas vindas do QR de um ponto preenchem o campo.

---

## Fluxo completo de dados

```text
Cliente escaneia QR → /p/:token
  → PartnerCatalog carrega identidade visual (store_settings)
  → Produtos "allocated" aparecem com cards boutique
  → IntersectionObserver registra view em catalog_product_views
      (com owner_id + partner_point_id)
  → Cliente adiciona item → LeadCaptureSheet (nome + WhatsApp)
  → Lead salvo em store_leads (owner_id da vendedora)
  → Carrinho salvo em lead_cart_items
  → Checkout via PartnerCheckoutPasses (Passes Coloridos)

Vendedora acessa /partner-points/:id → aba Analytics
  → Vê visitantes únicos do QR deste ponto
  → Vê taxa de captura e carrinhos abandonados
  → Vê lista de leads com filtros e botão WhatsApp
```

## O que NÃO muda

- Filtros de marketing (Oportunidades, Pré-venda, etc.) — sem contexto na arara
- Área VIP / Senha secreta
- Programa de Fidelidade
- O Analytics global em `/analytics` continua funcionando normalmente
