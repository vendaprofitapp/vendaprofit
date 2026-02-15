

# Nova Aba "Estoque B2B" com Produtos Clonados

## Conceito

Em vez de modificar os produtos locais (que podem receber reestoque a qualquer momento), o sistema vai **criar produtos B2B separados** -- clones dos seus produtos locais, mas com os tamanhos do fornecedor. Assim:

- Seus produtos locais continuam intactos com tamanhos PP, P, M, G, GG, XG
- Os clones B2B tem tamanhos 2, 4, 6, 8, 10, 12, 14 (extraidos do fornecedor)
- O sistema de prioridade ja estabelecido decide qual usar: estoque local primeiro, B2B depois

## Como vai funcionar

### Fluxo do usuario

1. Abrir Controle de Estoque e clicar na aba **"Estoque B2B"**
2. Ver a lista de todos os produtos do fornecedor com B2B ativo
3. Para cada produto, poder:
   - **Informar a URL** do produto no site do fornecedor
   - **Clicar "Verificar"** para o sistema acessar o site e extrair tamanhos
   - **Clicar "Criar Clone B2B"** para gerar automaticamente um produto identico com os tamanhos do fornecedor
4. Produtos ja clonados aparecem com status "Pronto" e link para o clone
5. Produtos com problemas (URL faltando, conexao falha, etc.) aparecem com alerta

### Status de cada produto

| Icone | Status | Significado |
|-------|--------|------------|
| Cinza | Sem URL | Falta preencher a URL do produto no fornecedor |
| Amarelo | Pendente | Tem URL mas ainda nao foi verificado/clonado |
| Vermelho | Erro | URL existe mas nao conseguiu acessar ou extrair tamanhos |
| Verde | Pronto | Clone B2B criado e funcionando |

## Detalhes Tecnicos

### 1. Nova coluna no banco de dados

Adicionar coluna `b2b_source_product_id` na tabela `products`:
- Quando preenchida, indica que este produto e um clone B2B
- Aponta para o produto original (local)
- Permite o sistema de prioridade saber: "se o original tem estoque, use ele; senao, use o clone B2B"

```text
ALTER TABLE products ADD COLUMN b2b_source_product_id uuid REFERENCES products(id);
```

### 2. Nova aba "Estoque B2B" em StockControl.tsx

A aba vai:
- Buscar todos os produtos cujo fornecedor tem `b2b_enabled = true`
- Para cada um, verificar se ja existe um clone (produto com `b2b_source_product_id` apontando para ele)
- Mostrar campo inline para editar `b2b_product_url`
- Botao "Verificar" que chama `check-b2b-stock` e mostra tamanhos encontrados
- Botao "Criar Clone B2B" que:
  1. Copia nome, imagens, preco, custo, fornecedor, categorias
  2. Adiciona sufixo " (B2B)" ao nome para diferenciar
  3. Seta `b2b_source_product_id` apontando para o original
  4. Copia a `b2b_product_url` do original
  5. Cria variantes com os tamanhos do fornecedor (estoque = 0, pois e sob encomenda)
- Botao "Atualizar Tamanhos" para clones ja existentes (re-verifica o fornecedor e sincroniza)

### 3. Atualizar StoreCatalog.tsx

Na logica do catalogo:
- Para cada produto local com estoque 0 que tenha um clone B2B, mostrar o clone B2B no lugar
- Se o produto local tem estoque > 0, mostrar o local (prioridade)
- O clone B2B aparece com badge "Sob Encomenda" e os tamanhos do fornecedor

### 4. Atualizar VariantSelectionDialog.tsx

- Se o produto selecionado tem `b2b_source_product_id` (e um clone B2B), mostrar todos os tamanhos como "Sob Encomenda"
- Nao verificar estoque local para esses tamanhos

## Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Adicionar coluna `b2b_source_product_id` em `products` |
| `src/pages/StockControl.tsx` | Nova aba "Estoque B2B" com lista, verificacao, e criacao de clones |
| `src/pages/StoreCatalog.tsx` | Logica de prioridade: local > clone B2B |
| `src/components/sales/VariantSelectionDialog.tsx` | Suporte a produtos B2B clonados |

