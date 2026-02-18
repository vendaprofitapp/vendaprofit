
# Configuração de Pagamento por Ponto Parceiro — Plano de Implementação

## Contexto e Análise do Estado Atual

Hoje, o cadastro de um Ponto Parceiro tem apenas um campo genérico `payment_fee_pct` (taxa da maquininha) e nenhuma configuração sobre **quem recebe o pagamento** nem **quais formas de pagamento estão disponíveis** no catálogo do QR Code.

A nova funcionalidade exige:

1. **Nova configuração no cadastro do parceiro:** quem recebe o pagamento — "Ponto Parceiro" ou "Vendedora"
2. **Se for a vendedora:** quais formas de pagamento (das personalizadas já cadastradas no sistema) estarão disponíveis naquele ponto, com as taxas de cada uma aplicadas automaticamente
3. **No catálogo do QR Code (`/p/:token`):** o checkout exibe apenas as formas de pagamento habilitadas para aquele ponto
4. **Nos relatórios e acertos:** o pagamento via forma selecionada aparece com a taxa correta nos cálculos

---

## O que Muda e o que NÃO Muda

| Componente | O que muda |
|---|---|
| `partner_points` (tabela) | Adiciona `payment_receiver` (`seller` ou `partner`) e `allowed_payment_methods` (jsonb com ids das formas habilitadas) |
| `partner_point_sales` (tabela) | Já tem `payment_method` — passa a armazenar o `custom_payment_method_id` quando aplicável |
| `NewPartnerDialog.tsx` | Adiciona seção "Como o cliente paga?" com toggle e seletor de formas de pagamento |
| `PartnerCheckoutPasses.tsx` | Quando `payment_receiver = seller`, exibe as formas de pagamento configuradas (personalizadas) no lugar do menu fixo PIX/Cartão/Casa 24h |
| `PartnerSettlementTab.tsx` | Usa a taxa da forma de pagamento selecionada em vez do `payment_fee_pct` fixo |
| `PartnerCatalog.tsx` | Busca as formas de pagamento habilitadas e as passa para o checkout |
| `StoreCatalog.tsx`, `profitEngine.ts`, `consignments`, qualquer outra tela | **Nada muda** |

---

## Banco de Dados — Migração Aditiva

### Alteração em `partner_points`:

```sql
ALTER TABLE partner_points
  ADD COLUMN payment_receiver text NOT NULL DEFAULT 'partner',
  ADD COLUMN allowed_payment_methods jsonb DEFAULT '[]'::jsonb;
```

- `payment_receiver`: `'seller'` = pagamento vai para a vendedora (formas personalizadas); `'partner'` = parceiro gerencia o pagamento como quiser
- `allowed_payment_methods`: array de objetos `{ id: string, name: string, fee_percent: number }` — snapshot das formas habilitadas no momento do cadastro/edição

### Alteração em `partner_point_sales`:

```sql
ALTER TABLE partner_point_sales
  ADD COLUMN payment_fee_applied numeric DEFAULT 0,
  ADD COLUMN custom_payment_method_id text DEFAULT NULL;
```

- `payment_fee_applied`: taxa percentual efetivamente aplicada na venda (vem da forma de pagamento escolhida, não do valor genérico do parceiro)
- `custom_payment_method_id`: referência ao id da forma de pagamento personalizada usada

**Nenhuma tabela existente é modificada além de `partner_points` e `partner_point_sales`, que são novas.**

---

## Arquivos a Criar/Modificar

### 1. `NewPartnerDialog.tsx` — Nova seção de pagamento

Após a seção "Comissões e Taxas", adicionar nova seção "Como o cliente paga?":

**Toggle "Quem recebe o pagamento?":**
- Opção A — **Ponto Parceiro** (padrão): o parceiro usa sua própria maquininha/dinheiro. O campo `payment_fee_pct` atual continua sendo usado para calcular o acerto. O cliente no QR Code vê apenas um aviso para pagar no local.
- Opção B — **Vendedora**: o pagamento vem direto para a vendedora. Exibe multi-seletor das formas de pagamento personalizadas ativas da vendedora (busca da tabela `custom_payment_methods` filtrando por `owner_id` + `is_active = true`). A vendedora marca quais formas quer disponibilizar naquele ponto.

**UX do seletor:** checkboxes com nome da forma + taxa (ex: "✓ PIX — 0%" / "✓ Cartão Crédito 3x — 3.5%"). Mínimo 1 deve ser selecionado se `payment_receiver = seller`.

A taxa genérica `payment_fee_pct` fica visível somente quando `payment_receiver = partner` (para o acerto). Quando `payment_receiver = seller`, a taxa vem automaticamente de cada forma de pagamento.

### 2. `PartnerCatalog.tsx` — Buscar e repassar configuração de pagamento

Na query de carregamento do `partner_point`, adicionar os campos novos:
```
payment_receiver, allowed_payment_methods
```

Passar essas informações para `PartnerCheckoutPasses`.

### 3. `PartnerCheckoutPasses.tsx` — Checkout adaptável

**Cenário A — `payment_receiver = partner`:**
- Exibe uma única opção "Pagar no Local" com instrução genérica
- Gera um passe simples para o cliente mostrar na recepção
- O parceiro cuida do pagamento como bem entender
- O status da venda entra como `pass_status = 'validated'` automaticamente (responsabilidade do parceiro)

**Cenário B — `payment_receiver = seller`:**
- Exibe a lista das formas de pagamento habilitadas (`allowed_payment_methods`) como cards selecionáveis
- Cada forma tem cor/ícone específico
- Mantém o fluxo existente de PIX (com chave), Cartão (link), e o Passe Azul 24h se a forma for a prazo (`is_deferred = true`)
- Ao confirmar, grava `payment_fee_applied` com a taxa da forma escolhida e `custom_payment_method_id`

### 4. `PartnerSettlementTab.tsx` — Usar taxa real da venda

Ao calcular o split de cada venda, usar `sale.payment_fee_applied` em vez do `partner.payment_fee_pct` fixo. Isso garante que cada venda seja calculada com a taxa correta da forma de pagamento que o cliente usou.

### 5. `PartnerSalesQueue.tsx` — Exibir forma de pagamento real

Na fila de validações, exibir o nome da forma de pagamento ao lado do status do passe para facilitar a conferência.

---

## Fluxo Completo por Cenário

**Cenário Ponto Parceiro (payment_receiver = partner):**
```text
Cliente lê QR → Vê catálogo → Adiciona itens → Preenche nome/WhatsApp
→ Tela "Pague no local com a recepção" → Passe único gerado
→ Vendedora recebe notificação WhatsApp
→ Na fila de validação: vendedora confirma que o parceiro pagou
→ Acerto: usa payment_fee_pct do parceiro (taxa negociada)
```

**Cenário Vendedora (payment_receiver = seller):**
```text
Cliente lê QR → Vê catálogo → Adiciona itens → Preenche nome/WhatsApp
→ Seleciona forma de pagamento da lista habilitada pela vendedora
→ PIX: chave copia-e-cola + Passe Verde
   Cartão: link enviado pela vendedora + Passe Amarelo
   A prazo (is_deferred): Passe Azul 24h
→ Venda gravada com payment_fee_applied = taxa da forma escolhida
→ Relatório de acerto usa taxa real de cada venda individualmente
```

---

## Garantias de Não-Regressão

- `StoreCatalog.tsx`: não tocado
- `consignments`: não tocado
- `profitEngine.ts`: a função `calculatePartnerPointSplit` já aceita `paymentFeePct` como parâmetro — basta passar `sale.payment_fee_applied` em vez de `partner.payment_fee_pct`. Sem modificar a assinatura da função.
- Parceiros já cadastrados: `payment_receiver` tem `DEFAULT 'partner'` → funcionamento atual preservado. `allowed_payment_methods` tem `DEFAULT '[]'` → sem quebra.
- `PartnerCheckoutPasses` atual: o novo `payment_receiver` é opcional com fallback para o comportamento atual.
