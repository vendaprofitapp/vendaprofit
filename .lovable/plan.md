

# Replicar Produtos da Camila para Tessa

## Situacao Atual

| | Camila (teamwodbrasil) | Tessa (tessaforwod) |
|---|---|---|
| User ID | `98191e2a-...` | `26699c3e-...` |
| Produtos (POWERED BY COFFEE) | 179 (com categorias, fornecedor, variantes) | 274 (sem fornecedor, sem categorias) |
| Variantes | 1.011 | desconhecidas |
| Supplier ID (POWERED BY COFFEE) | `1942efb6-...` | `1c4161e9-...` |

## Plano de Execucao

### Passo 1 - Limpar produtos atuais da Tessa

Deletar as variantes e depois os 274 produtos atuais da Tessa, pois estao incompletos (sem fornecedor, sem categorias).

### Passo 2 - Copiar 179 produtos da Camila para Tessa

Inserir os produtos com:
- `owner_id` = Tessa
- `supplier_id` = fornecedor POWERED BY COFFEE da Tessa (`1c4161e9-...`)
- `stock_quantity` = 0
- Todos os demais campos copiados: nome, descricao, categorias (`main_category`, `subcategory`, `category`), preco, custo, SKU, cor, modelo, imagens, video, marketing_status, is_new_release, etc.

### Passo 3 - Copiar variantes (tamanhos)

Para cada produto copiado, replicar as variantes usando mapeamento posicional (ROW_NUMBER por data de criacao) para garantir vinculacao 1:1 correta entre produto origem e destino. Todas as variantes terao `stock_quantity` = 0.

## Detalhes Tecnicos

Serao executadas 3 queries SQL via migration/insert tool:

1. `DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE owner_id = 'tessa_id')`
2. `DELETE FROM products WHERE owner_id = 'tessa_id'`
3. `INSERT INTO products (...) SELECT ... FROM products WHERE owner_id = 'camila_id' AND supplier_id = 'camila_supplier_id'` -- com owner_id e supplier_id substituidos, stock = 0
4. `INSERT INTO product_variants (...) SELECT ...` -- usando mapeamento posicional ROW_NUMBER para vincular variantes aos novos produtos

Nenhuma alteracao de schema e necessaria. Apenas operacoes de dados (DELETE + INSERT).
