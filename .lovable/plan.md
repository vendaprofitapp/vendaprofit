

# Separar abas do Estoque: Proprio, Sociedade, Parcerias, B2B

## Resumo

Reorganizar as abas da pagina de Estoque (`/stock`) removendo as abas "Requisicoes" e "Recebidas" (que ja existem na pagina dedicada `/stock-requests`) e separando o estoque em 4 abas claras:

1. **Proprio** - Somente produtos do usuario (como "Meu Estoque" atual)
2. **Sociedade** - Produtos de parceiras via Sociedade 1-1 (`is_direct=true`)
3. **Parcerias** - Produtos de parcerias em grupo (`is_direct=false`)
4. **B2B** - Exatamente como esta funcionando hoje

## Alteracoes

### Arquivo: `src/pages/StockControl.tsx`

**Remover:**
- Abas "Requisicoes" (`my-requests`) e "Recebidas" (`incoming-requests`) - ja existem em `/stock-requests`
- Estado e logica de `myRequests`, `incomingRequests`, `fetchRequests`, `subscribeToRequests`, `handleUpdateRequest`, `handleRequestProduct`, `requestDialogOpen`, `selectedProduct`, `requestQuantity`, `requestNotes`
- Dialog de "Requisitar Produto"

**Modificar:**
- Renomear aba "Meu Estoque" para **"Proprio"**
- Renomear aba "Parceiros" para criar duas abas separadas

**Adicionar:**
- Separar `fetchPartnerProducts` em duas funcoes:
  - `fetchDirectPartnerProducts()` - busca produtos de grupos com `is_direct=true` (Sociedade 1-1)
  - `fetchGroupPartnerProducts()` - busca produtos de grupos com `is_direct=false` (Parcerias)
- Estado separado: `directPartnerProducts` e `groupPartnerProducts`
- Aba **"Sociedade"** - exibe `directPartnerProducts` com botao de "Requisitar"
- Aba **"Parcerias"** - exibe `groupPartnerProducts` com botao de "Requisitar"
- Manter o Dialog de "Requisitar Produto" para solicitar estoque de parceiras (sociedade e parcerias)

### Estrutura das abas (resultado final)

```text
[ Proprio ] [ Sociedade ] [ Parcerias ] [ B2B ]
```

### Logica de separacao

A query atual de `fetchPartnerProducts` busca todos os grupos do usuario via `group_members`. A separacao sera feita assim:

1. Buscar memberships com `groups!inner(id, is_direct)` para ter a flag
2. Separar `groupIds` em `directGroupIds` (is_direct=true) e `regularGroupIds` (is_direct=false)
3. Buscar `product_partnerships` para cada conjunto de grupos separadamente
4. Carregar produtos de cada conjunto

### Nenhuma alteracao no banco de dados

Apenas reorganizacao da UI.

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/StockControl.tsx` | Reorganizar abas, separar parceiros em Sociedade e Parcerias, remover abas de requisicoes |

