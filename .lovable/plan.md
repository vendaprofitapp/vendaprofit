
# Fix: Não solicitar dados do cliente 2x no Catálogo Parceiro

## Diagnóstico

O fluxo atual tem dois pontos de coleta de dados do cliente:

1. **Ao adicionar ao carrinho** → `addToCart` em `PartnerCatalog.tsx` verifica o localStorage. Se não há lead salvo, abre o `LeadCaptureSheet`. Os dados são salvos em `store_leads` e no localStorage (`partner_lead_${token}`).

2. **Ao finalizar compra** → `PartnerCheckoutPasses` sempre inicia no `step === "info"` e exibe os campos "Seu nome" e "Seu WhatsApp" novamente, sem checar se já existem dados salvos.

## Solução

### 1. `PartnerCheckoutPasses` — Aceitar dados pré-preenchidos e pular o step "info"

Adicionar duas novas props opcionais:
- `initialName?: string`
- `initialPhone?: string`

**Lógica de inicialização do step:**
- Se `initialName` e `initialPhone` forem fornecidos:
  - Para modo `payment_receiver === "partner"`: ir direto para a confirmação da venda (chama `handleConfirmSale` via `useEffect`)
  - Para modo `seller`: pular para `step === "method"` diretamente
- Se não forem fornecidos: manter o comportamento atual, inicializando em `step === "info"`

**Adicionalmente:** Quando o usuário preenche os dados no step "info" (caso não tenha lead), acionar um callback `onCustomerCaptured(name, phone)` para que o `PartnerCatalog` possa salvar o lead no banco.

### 2. `PartnerCatalog.tsx` — Passar dados do lead armazenado

Ao renderizar `PartnerCheckoutPasses`, ler o lead do localStorage e passar os dados:

```tsx
const storedLead = getStoredLead();

<PartnerCheckoutPasses
  cartItems={cart}
  partnerPoint={partnerPoint}
  initialName={storedLead?.name}
  initialPhone={storedLead?.whatsapp}
  onCustomerCaptured={async (name, phone) => {
    await saveLeadData({ name, whatsapp: phone });
  }}
  ...
/>
```

### 3. Casos cobertos

| Situação | Comportamento |
|---|---|
| Lead capturado ao adicionar ao carrinho | Checkout pula direto para método de pagamento (ou finaliza se modo parceiro) |
| Usuário clicou "Continuar sem reservar" | Checkout mostra step de info normalmente; ao preencher, salva o lead |
| Usuário abre checkout sem nenhum produto adicionado antes | Impossível (botão só aparece com items no carrinho, e o primeiro add sempre pede lead) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/partners/PartnerCheckoutPasses.tsx` | Adicionar props `initialName`, `initialPhone`, `onCustomerCaptured`; ajustar lógica de step inicial |
| `src/pages/PartnerCatalog.tsx` | Passar dados do lead salvo para `PartnerCheckoutPasses` e tratar `onCustomerCaptured` |

Nenhuma migration de banco necessária.
