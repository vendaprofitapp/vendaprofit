
# Correção da Mensagem de Estado Vazio na Aba B2B

## Diagnóstico

O fornecedor "NEW HYPE" está corretamente com `b2b_enabled = true` no banco. O sistema funciona como esperado: a aba B2B lista **produtos cadastrados** que pertencem a fornecedores com B2B ativo. Como o usuário ainda não cadastrou nenhum produto vinculado ao NEW HYPE, a lista retorna vazia.

O problema é a mensagem exibida:

- **Mensagem atual (enganosa):** "Nenhum fornecedor com B2B ativo. Ative o B2B em um fornecedor na página de Fornecedores."
- **Mensagem correta:** Distinguir entre "não há fornecedor B2B ativo" e "há fornecedor B2B ativo, mas sem produtos cadastrados"

## Correção Proposta

### Arquivo: `src/components/stock/B2BStockTab.tsx`

Atualizar a função `fetchB2BProducts` para separar dois estados:

1. `supplierIds.length === 0` → Nenhum fornecedor B2B ativo (mensagem atual está correta para este caso)
2. `products.length === 0` mas `supplierIds.length > 0` → Fornecedor B2B ativo, mas sem produtos vinculados (nova mensagem)

A nova mensagem para o segundo caso será:

```
📦 Você tem X fornecedor(es) B2B ativo(s) (ex: NEW HYPE), mas ainda não 
há produtos cadastrados vinculados a eles.

Para usar o B2B, cadastre produtos no Controle de Estoque (aba Próprio) 
e vincule-os ao fornecedor NEW HYPE.
```

### Mudança Técnica

Adicionar um estado `hasActiveB2BSuppliers` (boolean) e `activeSupplierNames` (string[]) no componente. Quando `products.length === 0` mas `hasActiveB2BSuppliers === true`, exibir a mensagem orientativa com o nome do(s) fornecedor(es) B2B ativos.

### Arquivo a Modificar

- `src/components/stock/B2BStockTab.tsx` — apenas a lógica de estado vazio e a mensagem de feedback ao usuário
