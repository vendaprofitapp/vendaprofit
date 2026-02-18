
# Valor Mínimo por Forma de Pagamento no Ponto Parceiro

## Diagnóstico do Estado Atual

O snapshot de formas de pagamento salvo no campo `allowed_payment_methods` (JSONB) da tabela `partner_points` tem a estrutura:

```json
{ "id": "...", "name": "PIX", "fee_percent": 0, "is_deferred": false }
```

Não há campo `min_amount`. Isso precisa ser adicionado em toda a cadeia: cadastro → armazenamento → exibição no catálogo → validação no checkout.

---

## Escopo de Mudanças — Apenas 2 Arquivos

Toda a lógica está concentrada em dois arquivos. Nenhum outro arquivo precisa ser tocado.

| Arquivo | O que muda |
|---|---|
| `NewPartnerDialog.tsx` | Adiciona campo "Valor mínimo" por forma de pagamento selecionada |
| `PartnerCheckoutPasses.tsx` | Valida o total do carrinho contra o `min_amount` da forma selecionada e exibe aviso |

Banco de dados: **não precisa de migração** — `allowed_payment_methods` já é JSONB e aceita o campo `min_amount` adicionalmente sem qualquer alteração de schema.

---

## Detalhe das Mudanças

### 1. `NewPartnerDialog.tsx`

**Interface `CustomPaymentMethod`**: Adicionar estado local para guardar o `min_amount` de cada método selecionado.

```typescript
// Estado local: mapa de id → valor mínimo configurado
const [methodMinAmounts, setMethodMinAmounts] = useState<Record<string, string>>({});
```

**UI na lista de formas de pagamento selecionáveis**: Quando um método está marcado (checked), exibir abaixo do checkbox um campo de input "Valor mínimo (opcional)" com prefixo R$.

Exemplo visual:
```
☑ Link de Pagamento 4x          Taxa: 3.5%  [A prazo]
  └─ Valor mínimo para esta forma:  R$ [500,00]
```

O campo só aparece se o método estiver selecionado (checked), ficando oculto quando desmarcado.

**No `handleSubmit`**, ao construir o snapshot `allowedMethods`, incluir `min_amount`:

```typescript
.map(m => ({
  id: m.id,
  name: m.name,
  fee_percent: m.fee_percent,
  is_deferred: m.is_deferred,
  min_amount: parseFloat(methodMinAmounts[m.id]?.replace(",", ".") || "0") || 0,
}))
```

---

### 2. `PartnerCheckoutPasses.tsx`

**Interface `AllowedMethod`**: Adicionar campo opcional `min_amount?: number`.

**Etapa de seleção do método (step = "method")**: 
- Exibir o valor mínimo no card de cada forma de pagamento quando `min_amount > 0`.
- Métodos com `min_amount` maior que o total do carrinho ficam **desabilitados** (não clicáveis), com badge de aviso.

Exemplo visual do card desabilitado:
```
┌─────────────────────────────────────────────────┐
│ 💳  Link de Pagamento 4x                         │
│     Taxa: 3.5%  •  Mínimo: R$ 500,00            │
│     ⚠️ Seu pedido (R$ 180,00) não atinge o valor │
│        mínimo para esta forma de pagamento        │
└─────────────────────────────────────────────────┘  [desabilitado, opacidade reduzida]
```

Cards disponíveis ficam normais e selecionáveis como hoje.

**Validação extra no `handleConfirmMethod`**: Verificação de segurança antes de prosseguir caso o usuário tente confirmar uma forma cujo mínimo não foi atingido (não deveria acontecer se o card estiver desabilitado, mas é uma camada extra de proteção).

---

## Fluxo Completo

```text
Vendedora cadastra parceiro
  → Seleciona "Link de Pagamento 4x"
  → Define valor mínimo: R$ 500,00
  → Salvo em allowed_payment_methods: [...{ min_amount: 500 }]

Cliente acessa QR do ponto parceiro
  → Adiciona 2 peças → Total: R$ 180,00
  → Tela de pagamento: "PIX" disponível, "Link 4x" desabilitado com aviso

Cliente adiciona mais 3 peças → Total: R$ 620,00
  → Tela de pagamento: "PIX" disponível, "Link 4x" disponível e selecionável
```

---

## Garantias de Não-Regressão

- Parceiros já cadastrados sem `min_amount` no snapshot: o campo será `undefined`, tratado como `0` (sem restrição) — comportamento idêntico ao atual.
- Nenhum arquivo além dos dois listados é tocado.
- Nenhuma migração de banco de dados necessária.
- A lógica de acerto (`PartnerSettlementTab.tsx`) não precisa de mudança — ela já usa `payment_fee_applied` e não depende de `min_amount`.
