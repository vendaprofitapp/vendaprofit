
# Busca Automática de Conjuntos no Detector

## Objetivo

Adicionar um modo de **varredura automática** que detecta *todas* as correspondências entre o estoque próprio e o estoque do parceiro — sem precisar que o usuário selecione peças manualmente uma a uma.

---

## Fluxo atual vs. novo

**Atual (manual):**
Escolher modo → Selecionar peças do estoque próprio → Clicar "Detectar Conjuntos" → Ver resultados

**Novo (automático):**
Escolher modo → Clicar "Varredura Automática" → Ver **todas** as correspondências de uma vez → Selecionar quais solicitar

Ambos os modos coexistem na mesma página — o usuário escolhe qual prefere usar.

---

## Mudanças no `src/pages/StockSetDetector.tsx`

### 1. Novo estado e modo de busca

Adicionar um estado `scanMode: "manual" | "auto"` (padrão `"manual"`).

Quando `scanMode === "auto"`:
- Ignorar a seleção manual de peças (`selectedOwnItems`)
- Usar **todo** o `ownProducts` expandido como fonte de comparação
- O cálculo de matches já existente (`useMemo`) roda igual — apenas a entrada muda

### 2. Switcher visual entre modos

Logo abaixo do Passo 1 (Escolha de estoques), adicionar dois botões de alternância (Tab Pills):

```
┌───────────────────────────────────────────────────────┐
│  [ 🔍 Busca Manual ]   [ ⚡ Varredura Automática ]    │
└───────────────────────────────────────────────────────┘
```

- **Busca Manual**: comportamento atual (Passo 2 aparece, usuário seleciona peças)
- **Varredura Automática**: Passo 2 some; um botão "Iniciar Varredura" aparece diretamente

### 3. UI do modo automático

Quando `scanMode === "auto"`, o Passo 2 (seleção manual) é ocultado e substituído por:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ Varredura Automática                                          │
│  Compara todas as X peças do seu estoque com o estoque parceiro  │
│                                                                   │
│  [  ⚡ Iniciar Varredura Completa  ]                             │
└─────────────────────────────────────────────────────────────────┘
```

Ao clicar em "Iniciar Varredura", define `resultsVisible = true`. Os resultados são calculados instantaneamente via o `useMemo` já existente (agora alimentado por todo `ownProducts`).

### 4. Sumário dos resultados (modo automático)

No topo do Passo 3 (Resultados), exibir um resumo estatístico quando em modo automático:

```
┌──────────────────────────────────────────────────┐
│  Varredura concluída                              │
│  🎭 X conjuntos complementares encontrados        │
│  🔄 Y peças com mesma cor e tamanho               │
│  Total: Z correspondências em todo o estoque     │
└──────────────────────────────────────────────────┘
```

### 5. Seleção em massa nos resultados

Adicionar botões de conveniência no cabeçalho do Passo 3:
- **"Selecionar Todos"** — marca todos os matches
- **"Limpar Seleção"** — desmarca todos

---

## Lógica técnica

A mudança é cirúrgica — apenas a entrada do `useMemo` de matches muda:

```ts
// Antes (manual):
const selectedOwnExpanded = useMemo(() => {
  return ownProducts
    .filter((p) => selectedOwnItems.has(p.id))
    .flatMap(expandProduct);
}, [ownProducts, selectedOwnItems]);

// Depois (com modo automático):
const selectedOwnExpanded = useMemo(() => {
  if (scanMode === "auto") {
    return ownProducts.flatMap(expandProduct); // TODOS os produtos próprios
  }
  return ownProducts
    .filter((p) => selectedOwnItems.has(p.id))
    .flatMap(expandProduct);
}, [ownProducts, selectedOwnItems, scanMode]);
```

O `matches` `useMemo` não muda nada — continua recebendo `selectedOwnExpanded` e comparando com `partnerExpanded`.

---

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/StockSetDetector.tsx` | Adicionar estado `scanMode`, switcher de modo, UI do modo automático, sumário de resultados, botões de seleção em massa |

Nenhuma migration necessária. Nenhum novo endpoint. Toda a lógica é client-side.
