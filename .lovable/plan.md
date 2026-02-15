

# Editar Produto Clone B2B

## O que muda

Adicionar um botao "Editar" nos produtos que ja tem clone criado na aba Estoque B2B. Ao clicar, o sistema abre o mesmo formulario de produto (ProductFormDialog) ja existente, carregando os dados do clone para que o usuario possa corrigir tamanhos errados, nome, precos, etc.

## Como funciona

1. O componente `B2BStockTab` recebe uma nova prop `onEditClone` que e uma callback
2. Quando o usuario clica "Editar" em um produto com clone, o componente chama `onEditClone(cloneId)` 
3. O `StockControl.tsx` busca o produto clone pelo ID e abre o `ProductFormDialog` com ele como `editingProduct`
4. O usuario corrige os dados (ex: tamanhos 24 -> 2, remover tamanhos errados, adicionar corretos)
5. Ao salvar, o callback `onSuccess` atualiza tanto a lista principal quanto a aba B2B

## Detalhes Tecnicos

### Arquivo: `src/components/stock/B2BStockTab.tsx`
- Adicionar prop `onEditClone: (cloneId: string) => void` na interface Props
- Adicionar botao "Editar" ao lado do botao "Atualizar" para produtos com status "ready" (que ja tem clone)
- O botao chama `onEditClone(clone.id)`

### Arquivo: `src/pages/StockControl.tsx`
- Passar a nova prop `onEditClone` para o `B2BStockTab`
- A callback busca o produto clone no banco, monta o objeto `Product` e abre o `ProductFormDialog` com `setEditingProduct(cloneProduct)` + `setProductDialogOpen(true)`
- Adicionar `fetchB2BProducts` no `onSuccess` do ProductFormDialog para que a aba B2B atualize apos edicao

