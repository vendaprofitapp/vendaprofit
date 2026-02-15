

# Corrigir Origem B2B no Carrinho Importado + Envio para Lista B2B

## Problema Identificado

Ao importar um carrinho salvo na aba Vendas, o produto "CAMISETA INFANTIL BRANCA C/ MARROM" aparece como "Proprio" mesmo sendo do estoque B2B. Isso acontece por dois motivos:

1. **Na importacao do carrinho**: quando o `source` do item salvo e `"b2b"`, o sistema tenta encontrar o produto na lista `ownProducts` (que inclui clones B2B), mas ao montar o CartItem nao preserva a flag `isB2B` do produto encontrado
2. **Na finalizacao da venda**: a logica que determina se um item e B2B usa `item.product.stock_quantity <= 0` ao inves de verificar a flag `isB2B` diretamente. Isso falha quando o clone tem variantes com estoque

## Correcoes

### Arquivo: `src/pages/Sales.tsx`

**Correcao 1 — Import do carrinho (handleImportCart)**
- Quando `sci.source === "b2b"`, buscar o produto nos clones B2B (produtos com `b2b_source_product_id != null`) dentro de `ownProducts`
- Garantir que o produto encontrado tenha `isB2B: true` sempre que `sci.source === "b2b"`

**Correcao 2 — Finalizacao da venda (determinacao de source/b2b_status)**
- Alterar a logica de determinacao de `itemSource` para verificar `item.product.isB2B === true` ANTES de verificar `stock_quantity <= 0`
- Se `isB2B` for `true`, marcar `source = 'b2b'` e `b2b_status = 'pending'` independente do estoque

A logica atual:
```text
if (item.isPartnerStock) -> source = 'partner'
else if (stock_quantity <= 0) -> source = 'b2b'
```

Sera alterada para:
```text
if (item.isPartnerStock) -> source = 'partner'
else if (item.product.isB2B) -> source = 'b2b', b2b_status = 'pending'
else if (stock_quantity <= 0) -> source = 'b2b', b2b_status = 'pending'
```

Isso garante que:
- Produtos B2B importados do carrinho vao para a lista de compras B2B apos a venda
- O badge "Proprio" sera substituido pela indicacao correta de B2B na divisao de lucros
- Apos finalizar a venda, o item aparecera na pagina "Pedidos B2B" com status pendente

## Resumo das alteracoes

| Local no codigo | Alteracao |
|-----------------|-----------|
| `handleImportCart` (~linha 1128) | Preservar `isB2B: true` quando `sci.source === "b2b"`, mesmo se o produto for encontrado em `ownProducts` |
| Finalizacao da venda (~linha 711-719) | Verificar `item.product.isB2B` antes do fallback de `stock_quantity <= 0` |

