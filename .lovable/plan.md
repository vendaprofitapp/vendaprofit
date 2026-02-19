
# Correções: Captura de Dados do Cliente e Posição do Toggle

## Problema 1 — Dados do cliente não capturados ao finalizar pelo WhatsApp

### Causa raiz

Em `StoreCatalog.tsx`, o botão "Finalizar pelo WhatsApp" chama `sendCartViaWhatsApp` diretamente, sem verificar se os dados do cliente (nome e WhatsApp) já foram coletados. O `LeadCaptureSheet` só é exibido **ao adicionar uma peça ao carrinho** — e apenas se `lead_capture_enabled` estiver ligado.

Consequência: qualquer cliente que tenha o toggle desligado, ou que ignore a captura ao adicionar, finaliza o pedido sem deixar seus dados. O carrinho é salvo com `customer_name: "Cliente"` e `customer_phone: ""`.

### Solução

Mover a captura de dados para o momento do **checkout** (ao clicar em "Finalizar pelo WhatsApp"), independentemente do toggle `lead_capture_enabled`.

**Mudanças em `StoreCatalog.tsx`:**

1. Modificar `sendCartViaWhatsApp` para verificar se `getStoredLead()` existe antes de prosseguir.
2. Se não houver lead salvo, abrir o `LeadCaptureSheet` e armazenar a intenção de finalizar (`pendingCheckout = true`).
3. Quando o lead for submetido via `handleLeadSubmit`, verificar se havia uma intenção de checkout pendente e então chamar `sendCartViaWhatsApp` após salvar os dados.
4. Remover a verificação de lead do `addToCart` — deixar sempre livre para adicionar itens ao carrinho (o `lead_capture_enabled` passa a controlar apenas se o lead é pedido no momento do checkout versus no momento de adicionar).

> Nota: o toggle `lead_capture_enabled` muda *quando* o dado é pedido — se ligado, pergunta ao adicionar; se desligado, pergunta ao finalizar. Em ambos os casos, o dado sempre é capturado antes de enviar o WhatsApp.

**Lógica revisada:**

```ts
// addToCart — sempre adiciona sem bloquear
const addToCart = (...) => {
  doAddToCart(item, size, effectivePrice);
  // Se lead_capture_enabled e não há lead salvo: pede logo
  if (leadCaptureEnabled && !getStoredLead()) {
    setShowLeadCapture(true);
    // mas o item JÁ foi adicionado
  }
};

// sendCartViaWhatsApp — bloqueia até ter lead
const sendCartViaWhatsApp = async () => {
  const storedLead = getStoredLead();
  if (!storedLead) {
    setPendingCheckout(true);
    setShowLeadCapture(true);
    return;
  }
  // prossegue com o envio normal...
};

// handleLeadSubmit — se havia checkout pendente, dispara o envio
const handleLeadSubmit = async (data) => {
  setShowLeadCapture(false);
  await saveLeadData(data);
  if (pendingCheckout) {
    setPendingCheckout(false);
    await sendCartViaWhatsApp();
  }
};
```

Isso garante que **sempre** haverá nome e telefone antes de enviar o pedido, salvando corretamente `customer_name` e `customer_phone` no banco de dados e alimentando o CRM de WhatsApp.

---

## Problema 2 — Toggle "Captura de Leads" na aba errada

### Causa raiz

O toggle está renderizado em `Marketing.tsx` (página "Redes Sociais / Google"), mas deveria estar em `WhatsAppCRM.tsx` (página "WhatsApp").

### Solução

1. **Remover** o `Card` com o toggle de `Marketing.tsx`, incluindo:
   - O `useQuery` de `store_settings` (ou reduzir o select removendo `lead_capture_enabled`)
   - A `useMutation` `toggleLeadCapture`
   - O componente `Switch` e `Card` associados
   - Os imports de `Switch`, `Label`, `UserPlus` se não forem usados em outro lugar

2. **Adicionar** o mesmo toggle em `WhatsAppCRM.tsx`:
   - Novo `useQuery` para buscar `store_settings` com `id` e `lead_capture_enabled`
   - Nova `useMutation` `toggleLeadCapture` para atualizar o campo
   - Card com Switch idêntico ao atual, posicionado no topo da página de WhatsApp
   - Atualizar a descrição para refletir o novo comportamento: *"Solicitar nome e WhatsApp ao adicionar itens ao carrinho"*

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/StoreCatalog.tsx` | Mover captura de lead para o checkout; adicionar `pendingCheckout` state; ajustar `addToCart`, `handleLeadSubmit` e `sendCartViaWhatsApp` |
| `src/pages/Marketing.tsx` | Remover toggle de Captura de Leads e toda lógica associada |
| `src/pages/WhatsAppCRM.tsx` | Adicionar toggle de Captura de Leads com query e mutation próprias |

Nenhuma migration de banco de dados necessária.
