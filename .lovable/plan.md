
# Correção: Taxas por Método de Pagamento no Contrato

## Problema Identificado

Na **Cláusula 3**, quando o fluxo é `payment_receiver = "seller"`, o contrato exibe apenas uma linha genérica:

> "A taxa do meio de pagamento fixada em **0%** será descontada..."

Isso acontece porque o código usa `partner.payment_fee_pct`, que é sempre `0` no modo vendedora — as taxas reais estão dentro do array `allowed_payment_methods`, no campo `fee_percent` de **cada método individual**.

## Correção — Arquivo único

**`src/pages/PartnerContract.tsx`** — somente a Cláusula 3 do fluxo "seller" precisa mudar.

### Substituição no bloco "Pagamento à Vendedora"

**Antes** (exibe taxa única genérica `feePct` com valor 0):
```
Taxas de Transação: A taxa do meio de pagamento fixada em {feePct} será descontada...
```

**Depois** (exibe tabela com taxa real de cada método):
- Remove a frase de taxa genérica
- Adiciona uma tabela com coluna "Método", "Taxa (%)" e "Valor Mínimo" para cada método do array `allowed_payment_methods`
- Se a taxa de um método for 0, exibe "Sem taxa"
- Unifica as seções "Métodos aceitos" e "Taxas por método" em uma única tabela clara, eliminando redundância

### Exemplo visual do resultado:

| Método | Taxa | Valor Mínimo |
|---|---|---|
| Cartão de Crédito | 3,5% | R$ 50,00 |
| PIX | Sem taxa | — |
| Dinheiro | Sem taxa | R$ 20,00 |

### Detalhe técnico

O campo correto para a taxa de cada método é `m.fee_percent` (vindo do snapshot salvo em `allowed_payment_methods`), não `partner.payment_fee_pct`. A variável `feePct` que existia no código pode ser removida pois não será mais usada.
