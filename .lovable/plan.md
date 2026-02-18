
# Módulo "Pontos Parceiros" — Implementação em 3 Fases (Zero Impacto no Sistema Atual)

## Princípio Fundamental de Todas as Fases

**Regra de Ouro:** Cada fase é completamente aditiva. Nenhuma linha de código existente em `StockControl.tsx`, `StoreCatalog.tsx`, `profitEngine.ts`, `ProductFormDialog.tsx`, `consignments` ou qualquer outra feature atual será modificada. O sistema existente opera exatamente igual para quem não usa Pontos Parceiros.

---

## Fase 1 — Infraestrutura e Gerenciamento de Locais (Entrega Isolada)

### O que será entregue
A Fase 1 cria apenas a estrutura de dados e a tela de gerenciamento de parceiros. Nenhum produto existente é tocado. Nenhuma tela existente é modificada.

### Banco de Dados — 2 Novas Tabelas

**Tabela `partner_points`** — Cadastro dos locais parceiros:
```
id, owner_id, name, contact_name, contact_phone, address,
rack_commission_pct (%), pickup_commission_pct (%),
payment_fee_pct (taxa maquininha do parceiro),
loss_risk_enabled (boolean),
replenishment_cycle_days, min_stock_alert,
access_token (para QR Code — gerado automaticamente),
is_active, created_at, updated_at
```

**Tabela `partner_point_items`** — "Etiqueta de localização" de cada peça:
```
id, partner_point_id, product_id, variant_id (nullable),
owner_id, quantity (int),
status: allocated | sold_online | sold_at_location | returning | returned | lost,
allocated_at, returned_at, notes, updated_at
```

**RLS de todas as tabelas:**
- `owner_id = auth.uid()` para operações da vendedora
- Leitura pública por `access_token` (para o catálogo do QR Code na Fase 2)

**Sem triggers, sem modificações em tabelas existentes.**

### Telas a Criar (Fase 1)

**`/partner-points`** — Listagem e gestão de parceiros:
- Cards com nome do parceiro, quantidade de peças alocadas, status
- Botão "Novo Parceiro" → formulário de cadastro (nome, contato, endereço, comissões, taxa, ciclo de reposição)
- Botão de copiar link do QR Code (para uso na Fase 2)

**`/partner-points/:id`** — Detalhe de um parceiro:
- Lista de peças atualmente alocadas com status visual
- Aba "Enviar Peças" → seleção do estoque central com busca por nome, filtragem por categoria
  - Seleciona produto/variante + quantidade → gera registro em `partner_point_items`
  - Gera mensagem pré-formatada para WhatsApp de confirmação ao parceiro
- Aba "Recolher Peças" → lista de itens alocados + seleção para devolver
  - Ao confirmar devolução: `status → returned` em `partner_point_items`
- Aba "Vendas" → histórico de vendas registradas no ponto (Fase 2)
- Botão "Extrato de Acerto" → relatório simples em tela (Fase 2)

### Arquivos Criados na Fase 1

| Arquivo | Tipo | Impacto em código existente |
|---------|------|----------------------------|
| `src/pages/PartnerPoints.tsx` | Criar | Nenhum |
| `src/pages/PartnerPointDetail.tsx` | Criar | Nenhum |
| `src/components/partners/PartnerPointCard.tsx` | Criar | Nenhum |
| `src/components/partners/TransferItemsDialog.tsx` | Criar | Nenhum |
| `src/components/partners/ReturnItemsDialog.tsx` | Criar | Nenhum |
| `src/components/layout/Sidebar.tsx` | Modificar | **Apenas adiciona** um item `MapPin` "Pontos Parceiros" no grupo "Estratégias" — zero risco |
| `src/App.tsx` | Modificar | **Apenas adiciona** 2 rotas (`/partner-points` e `/partner-points/:id`) — zero risco |
| migração SQL | Criar | Tabelas novas, RLS novas — sem alterar tabelas existentes |

### O que a Fase 1 NÃO faz
- Não altera `stock_quantity` de nenhum produto (a "etiqueta" é informativa)
- Não modifica `StoreCatalog.tsx`, `StockControl.tsx`, `ProductFormDialog.tsx`
- Não cria catálogo público ainda (Fase 2)
- Não registra vendas ainda (Fase 2)
- Não calcula comissões ainda (Fase 3)

---

## Fase 2 — Catálogo Localizado e Self-Checkout (QR Code)

### Pré-requisito: Fase 1 finalizada e testada

### O que será entregue
A Fase 2 cria a experiência do cliente no QR Code: catálogo restrito ao local, sacola e os 4 passes coloridos. Continua sem modificar nada existente.

### Nova Rota Pública: `/p/:token`

Funciona com a mesma lógica de `/bag/:token` (PublicBag) mas para Pontos Parceiros:
- Lê `access_token` da URL → busca o `partner_point` correspondente
- Busca `partner_point_items` com `status = allocated` para esse ponto
- Cruza com `products` e `product_variants` para obter fotos, preços, tamanhos
- Exibe **somente** as peças daquele local com banner: "Você está vendo o estoque disponível em [Nome do Parceiro]"

### Os 4 Passes Coloridos

| Opção | Passe | Comportamento |
|-------|-------|---------------|
| Pagar Agora (PIX) | 🟢 Verde | Exibe chave Pix + aviso; registra venda em `partner_point_sales` com `pass_status = pending`; envia WhatsApp à vendedora |
| Pagar no Cartão | 🟡 Amarelo | Registra venda com `pass_status = pending`; dispara WhatsApp à vendedora para enviar link |
| Provar em Casa 24h | 🔵 Azul | Exibe termo de responsabilidade; registra com contador de 24h |
| Encomenda (Prateleira Infinita) | 🟣 Roxo | Reserva sem estoque no local; integra com `customer_orders` existente (só leitura) |

### Tabela Nova: `partner_point_sales`
```
id, partner_point_id, owner_id,
customer_name, customer_phone,
items (jsonb: [{product_id, variant_id, product_name, quantity, unit_price}]),
total_gross,
payment_method (pix | card | try_home | infinite_shelf),
pass_color (green | yellow | blue | purple),
pass_status (pending | validated | completed | returned),
payment_proof_url (nullable), notes,
created_at, updated_at
```

### Trava de Venda Online (Lógica Isolada)

Uma função utilitária nova `src/utils/partnerPointUtils.ts` que, após uma venda registrada no `StoreCatalog.tsx`, verifica se o produto estava alocado em algum parceiro e atualiza o status para `sold_online`. Isso **não modifica** `StoreCatalog.tsx` — é um hook adicional opcional `usePartnerPointSync` que pode ser chamado por fora.

> Nota: A forma exata de integrar esta sincronização com o fluxo de venda do `StoreCatalog.tsx` (que tem ~3000 linhas) será avaliada na Fase 2 com cuidado, podendo usar um trigger no banco de dados em vez de código frontend, para não tocar nenhuma linha existente.

### Arquivos Criados/Modificados na Fase 2

| Arquivo | Tipo | Impacto |
|---------|------|---------|
| `src/pages/PartnerCatalog.tsx` | Criar | Nenhum |
| `src/components/partners/PartnerCheckoutPasses.tsx` | Criar | Nenhum |
| `src/components/partners/PartnerSalesQueue.tsx` | Criar | Nenhum |
| `src/utils/partnerPointUtils.ts` | Criar | Nenhum |
| `src/App.tsx` | Modificar | Apenas adiciona rota `/p/:token` |
| migração SQL | Criar | Tabela `partner_point_sales` nova |

---

## Fase 3 — Motor de Lucro para Parceiros e Acerto de Contas

### Pré-requisito: Fases 1 e 2 finalizadas e testadas

### O que será entregue
A Fase 3 adiciona o cálculo de comissão e o extrato de acerto. O `profitEngine.ts` ganha a função `calculatePartnerPointSplit` como uma **exportação adicional** sem alterar nenhuma das funções existentes (`calculateSaleSplits` continua inalterado).

### Novo Cálculo (Cenário P — Partner Point)

```typescript
// NOVA função, não altera calculateSaleSplits existente
export function calculatePartnerPointSplit(input: PartnerPointSplitInput): PartnerPointSplitResult {
  const paymentFeeAmount = grossPrice × (payment_fee_pct / 100);
  const netRevenue = grossPrice - paymentFeeAmount;
  const partnerCommission = netRevenue × rack_commission_pct;
  const sellerNet = netRevenue - partnerCommission - costPrice;
  // ...
}
```

### Tela de Acerto (dentro de `/partner-points/:id`)

Nova aba "Extrato de Acerto" que exibe:
- Período do ciclo
- Todas as vendas validadas
- Total bruto, taxas, comissão do parceiro, líquido da vendedora
- Botão "Gerar Extrato" → exporta para PDF/WhatsApp

### Fila de Validação (na tela de detalhe do parceiro)

- Vendas com `pass_status = pending` aparecem para ação da vendedora
- Passe Verde (Pix): campo para marcar como recebido + upload do comprovante
- Passe Amarelo (Cartão): botão para gerar link de pagamento
- Passe Azul (24h): contador regressivo + botão "Confirmar devolução"

---

## Resumo das Garantias de Segurança

| Risco | Mitigação |
|-------|-----------|
| Quebrar fluxo de vendas existente | `StoreCatalog.tsx` nunca é modificado na Fase 1 e 2 |
| Duplicar lógica de consignações | Entidade `partner_points` completamente separada de `consignments` |
| Alterar estoque de produtos existentes | `partner_point_items` é apenas uma "etiqueta" — `stock_quantity` nos produtos não muda |
| Quebrar motor de lucro atual | `calculateSaleSplits` nunca é alterado; nova função é adicionada separadamente |
| Quebrar catálogo público atual | Nova rota `/p/:token` é independente de `/:slug` e `/bag/:token` |
| Regressão no Sidebar | Apenas um `NavItem` é adicionado ao array `navGroups` |

## Proposta de Execução

Implementar a **Fase 1** agora, com commit separado e testável de forma independente. As Fases 2 e 3 ficam para aprovação posterior, após a Fase 1 estar funcionando em produção.
