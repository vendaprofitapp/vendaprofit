# Carrinho Inteligente com Rastreamento de Status + Remoção de Tamanhos B2B

## Visao Geral

Tres grandes melhorias integradas:

1. **Remover tamanhos esgotados do clone B2B** direto na tabela de Estoque B2B
2. **Salvar carrinho com ID curto** e enviar pelo WhatsApp, incluindo origem do estoque de cada item
3. **Rastrear status do carrinho** (aguardando, abandonado, convertido) vinculado ao lead, com conexao ao CRM de Marketing para follow-up

---

## Parte 1 — Remover tamanhos individuais do clone B2B

### O que muda

Na aba Estoque B2B, cada tamanho do clone aparece como um badge com botao "X". Ao clicar, a variante e deletada do banco e a lista atualiza.

### Arquivo: `src/components/stock/B2BStockTab.tsx`

- Renderizar cada tamanho como badge clicavel com icone X
- Ao clicar, deletar o `product_variant` pelo ID
- Atualizar a lista local sem recarregar tudo

---

## Parte 2 — Carrinho salvo com ID curto e origem do estoque

### Mudancas no banco de dados

**Nova tabela:** `saved_carts`


| Coluna         | Tipo          | Descricao                                |
| -------------- | ------------- | ---------------------------------------- |
| id             | uuid          | PK                                       |
| short_code     | text (unique) | Codigo curto (ex: VP-A3F2)               |
| store_id       | uuid          | FK store_settings                        |
| owner_id       | uuid          | Dono da loja                             |
| lead_id        | uuid          | FK store_leads (vincula ao cliente)      |
| customer_name  | text          | Nome do cliente                          |
| customer_phone | text          | WhatsApp                                 |
| total          | numeric       | Valor total                              |
| status         | text          | waiting, abandoned, converted, cancelled |
| created_at     | timestamptz   | Data de criacao                          |
| updated_at     | timestamptz   | Ultima atualizacao                       |


**Nova tabela:** `saved_cart_items`


| Coluna        | Tipo    | Descricao           |
| ------------- | ------- | ------------------- |
| id            | uuid    | PK                  |
| cart_id       | uuid    | FK saved_carts      |
| product_id    | uuid    | FK products         |
| product_name  | text    | Nome do produto     |
| variant_color | text    | Cor                 |
| selected_size | text    | Tamanho             |
| quantity      | integer | Quantidade          |
| unit_price    | numeric | Preco unitario      |
| source        | text    | local, partner, b2b |


**Nova coluna em** `lead_cart_items`: `source` (text, nullable) para rastrear origem do estoque de cada item existente

**RLS**: owner_id = auth.uid() para leitura/escrita. Insercao publica para permitir que o catalogo salve o carrinho.

### Logica de status do carrinho

```text
waiting    -> Carrinho criado, aguardando resposta (ate 24h)
abandoned  -> Passou 24h sem conversao
converted  -> Vendedora importou e registrou a venda
cancelled  -> Cancelado manualmente
```

Um cron ou trigger pode mover carrinhos de `waiting` para `abandoned` apos 24h, ou isso pode ser feito no frontend ao consultar (se `created_at` > 24h e status = waiting, mostrar como abandonado).

---

## Parte 3 — Fluxo completo

### No Catalogo (StoreCatalog.tsx)

Ao clicar "Enviar pelo WhatsApp":

1. Salvar o carrinho em `saved_carts` + `saved_cart_items` com status `waiting`
2. Gerar codigo curto aleatorio (ex: VP-A3F2)
3. Vincular ao `lead_id` do cliente capturado
4. Incluir na mensagem WhatsApp:
  - `Codigo do pedido: VP-A3F2` no topo
  - Em cada item, a origem: `[Estoque]`, `[Parceira]` ou `[Sob Encomenda]`
5. Tambem salvar `source` nos `lead_cart_items` existentes

### Na aba Vendas (Sales.tsx)

1. Novo campo "Importar Carrinho" com input para o codigo
2. Ao digitar o codigo e pressionar Enter:
  - Buscar `saved_carts` pelo `short_code`
  - Carregar `saved_cart_items` relacionados
  - Pre-preencher: nome do cliente, telefone, todos os produtos com tamanhos/quantidades/precos
  - Cada item ja vem com a origem do estoque marcada
3. Ao confirmar a venda, atualizar `saved_carts.status` para `converted`

### No Marketing/CRM (LeadsCRM.tsx + Marketing.tsx)

1. Adicionar nova aba ou filtro "Carrinhos" no CRM de Leads
2. Mostrar carrinhos por status: aguardando, abandonado, convertido
3. Permitir follow-up via WhatsApp direto do CRM
4. Os carrinhos `abandoned` alimentam o dashboard de Analytics existente (carrinhos abandonados)
5. O status do carrinho salvo se conecta com os status do `lead_cart_items` para manter consistencia

---

## Resumo dos arquivos modificados


| Arquivo                                           | Alteracao                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/components/stock/B2BStockTab.tsx`            | Botao X para remover tamanho individual do clone                                     |
| `src/pages/StoreCatalog.tsx`                      | Salvar carrinho no banco + ID curto + origem na msg WhatsApp                         |
| `src/pages/Sales.tsx`                             | Campo de importacao de carrinho por codigo                                           |
| `src/components/marketing/LeadsCRM.tsx`           | Exibir carrinhos salvos com status e follow-up                                       |
| `src/components/marketing/LeadDetailExpander.tsx` | Mostrar origem do estoque e codigo do carrinho                                       |
| `src/pages/Marketing.tsx`                         | Filtro por status de carrinho nos dados de follow-up                                 |
| Nova migracao SQL                                 | Tabelas `saved_carts`, `saved_cart_items`, coluna `source` em `lead_cart_items`, RLS |


---

## Detalhes Tecnicos

### Geracao do codigo curto

```text
VP- + 4 caracteres hexadecimais aleatorios em maiusculo
Exemplo: VP-A3F2, VP-9B1C
```

Verificacao de unicidade via constraint UNIQUE no banco.

### Transicao automatica waiting -> abandoned

Abordagem no frontend: ao listar carrinhos, se `status = 'waiting'` e `created_at < now() - 24h`, exibir como "Abandonado" na interface. Opcionalmente, um database function com pg_cron pode fazer o UPDATE periodico.

### Mensagem WhatsApp atualizada

```text
🧾Codigo do pedido: VP-A3F2

1. CAMISETA INFANTIL [Sob Encomenda]
   Tamanho: 6
   Quantidade: 1
   Preco: R$ 49,90

2. VESTIDO FLORAL [Estoque]
   Tamanho: M
   Quantidade: 2
   Preco unitario: R$ 89,90
   Subtotal: R$ 179,80

💲TOTAL: R$ 229,70
```