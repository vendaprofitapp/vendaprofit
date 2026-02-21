
# Correcao de Rotas Invalidas nas Notificacoes

## Problema Identificado

As rotas configuradas no sistema de notificacoes (sininho no cabecalho e alertas do Dashboard) nao correspondem as rotas reais registradas no React Router. Ao clicar, o usuario e levado para uma pagina 404 ou para o catalogo publico (via a rota `/:slug`).

## Rotas Incorretas vs Corretas

| Notificacao | Rota Atual (ERRADA) | Rota Correta |
|---|---|---|
| Bolsa Consignada | `/bolsa-consignada` | `/consignments` |
| Bazar VIP - Curadoria | `/bazar-admin` | `/admin/bazar` |
| Bazar VIP - Vendas | `/bazar-admin` | `/admin/bazar` |
| Pontos Parceiros | `/pontos-parceiros` | `/partner-points` |
| Novos Leads | `/whatsapp-crm` | `/marketing/whatsapp` |
| Carrinhos Abandonados | `/whatsapp-crm` | `/marketing/whatsapp` |

A rota do Modo Evento (`/evento/conciliacao`) esta correta.

## Arquivos a Alterar

### 1. `src/hooks/useNotifications.tsx`
Corrigir as 5 rotas erradas nas secoes de notificacao:
- Linha 166: `/bolsa-consignada` para `/consignments`
- Linha 178: `/bazar-admin` para `/admin/bazar`
- Linha 190: `/bazar-admin` para `/admin/bazar`
- Linha 202: `/pontos-parceiros` para `/partner-points`
- Linhas 214 e 226: `/whatsapp-crm` para `/marketing/whatsapp`

### 2. `src/components/dashboard/SystemAlerts.tsx`
Corrigir as mesmas rotas nos botoes de navegacao do Dashboard:
- Linha 664: `/bolsa-consignada` para `/consignments`
- Linha 708: `/bazar-admin` para `/admin/bazar`
- Linha 730: `/bazar-admin` para `/admin/bazar`
- Linha 752: `/pontos-parceiros` para `/partner-points`

## Detalhes Tecnicos

As rotas corretas foram confirmadas diretamente no `src/App.tsx` e no `src/components/layout/Sidebar.tsx`. A correcao e pontual (apenas strings de rota) e nao afeta nenhuma outra logica.
