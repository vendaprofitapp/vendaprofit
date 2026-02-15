
# Fase 3: Submissao do Bazar VIP e Coleta de Dados Logisticos

## Resumo

Criar o fluxo completo de submissao de itens para o Bazar VIP: o cliente-vendedor envia pecas pelo catalogo (com dados logisticos obrigatorios) e o lojista faz curadoria e precificacao em uma pagina administrativa dedicada.

## Alteracoes no Banco de Dados

### 1. Adicionar campos de endereco na tabela `profiles`

A tabela `profiles` nao possui campos de endereco. Precisamos adicionar para que vendedores do bazar tenham endereco de origem para calculo de frete:

- `address_street` (text, nullable)
- `address_number` (text, nullable)
- `address_complement` (text, nullable)
- `address_neighborhood` (text, nullable)
- `address_city` (text, nullable)
- `address_state` (text, nullable)
- `address_zip` (text, nullable)

Nota: A tabela `customers` ja possui esses campos, mas `profiles` (usuarios autenticados) nao.

### 2. Criar tabela `bazar_items`

Nova tabela para itens submetidos ao bazar:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | ID do item |
| owner_id | uuid NOT NULL | Lojista dono da loja |
| seller_phone | text NOT NULL | Telefone do vendedor (lead) |
| seller_name | text | Nome do vendedor |
| title | text NOT NULL | Titulo do item |
| description | text | Descricao |
| seller_price | numeric NOT NULL | Valor que o vendedor quer receber |
| store_commission | numeric | Comissao da loja (preenchida pelo lojista) |
| final_price | numeric | Preco final (seller_price + commission) |
| weight_grams | integer NOT NULL | Peso em gramas |
| height_cm | integer NOT NULL | Altura em cm |
| width_cm | integer NOT NULL | Largura em cm |
| length_cm | integer NOT NULL | Comprimento em cm |
| image_url | text | Foto 1 |
| image_url_2 | text | Foto 2 |
| image_url_3 | text | Foto 3 |
| status | text NOT NULL DEFAULT 'pending' | pending, approved, rejected, sold |
| seller_zip | text | CEP do vendedor (para frete) |
| seller_street | text | Endereco do vendedor |
| seller_number | text | Numero |
| seller_neighborhood | text | Bairro |
| seller_city | text | Cidade |
| seller_state | text | Estado |
| admin_notes | text | Notas do lojista |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de atualizacao |

Politicas RLS:
- SELECT: owner_id = auth.uid() (lojista ve seus itens)
- INSERT: anon pode inserir (formulario publico do catalogo)
- UPDATE: owner_id = auth.uid() (lojista aprova/rejeita)

### 3. Criar bucket de storage `bazar-images`

Bucket publico para fotos dos itens do bazar, com politica de upload para anon.

## Alteracoes no Frontend

### 4. Componente `BazarSubmissionDialog` (novo)

Arquivo: `src/components/catalog/BazarSubmissionDialog.tsx`

Dialog em duas etapas:
1. **Etapa 1 - Verificacao de endereco**: Formulario com CEP, Rua, Numero, Bairro, Cidade, Estado. Se o lead ja tem endereco salvo (localStorage), pula direto para etapa 2.
2. **Etapa 2 - Dados do item**: Upload de ate 3 fotos, Titulo, Descricao, Valor desejado (R$), e campos obrigatorios de embalagem (Peso kg, Altura cm, Largura cm, Comprimento cm).

Ao submeter, salva na tabela `bazar_items` com status `pending`, vinculado ao `owner_id` da loja e `seller_phone` do lead.

### 5. Atualizar `VipAreaDrawer`

Modificar o botao "Bazar VIP" para abrir o `BazarSubmissionDialog` ao inves de ser apenas placeholder. Adicionar tambem um label "Vender Minha Peca" ao botao.

### 6. Criar pagina `/admin/bazar` (BazarAdmin)

Arquivo: `src/pages/BazarAdmin.tsx`

Pagina protegida para o lojista com:
- Lista de itens pendentes com fotos, titulo, preco desejado, dimensoes
- Cada card mostra as fotos em miniatura e os dados de embalagem
- Campo para inserir "Comissao da Loja" (R$)
- Exibicao automatica do "Preco Final" (preco vendedor + comissao)
- Botoes "Aprovar" (status -> approved) e "Rejeitar" (status -> rejected)
- Filtros por status (Pendentes, Aprovados, Rejeitados, Vendidos)

### 7. Registrar rota no App.tsx

Adicionar rota protegida: `/admin/bazar` -> `BazarAdmin`

### 8. Adicionar link no menu lateral (Sidebar)

Adicionar item "Bazar VIP" no menu, agrupado com os itens administrativos.

## Fluxo do Usuario

```text
Cliente no Catalogo
  -> Abre Area VIP (FAB)
  -> Clica "Vender Minha Peca"
  -> Se nao tem endereco: preenche endereco
  -> Preenche formulario (fotos, titulo, preco, dimensoes)
  -> Submete -> status "pending"

Lojista em /admin/bazar
  -> Ve itens pendentes
  -> Analisa fotos e dimensoes
  -> Define comissao da loja
  -> Ve preco final calculado
  -> Aprova ou Rejeita
```

## Arquivos a criar/modificar

1. **Migracao SQL** -- Campos de endereco em profiles, tabela bazar_items, bucket bazar-images
2. **`src/components/catalog/BazarSubmissionDialog.tsx`** (novo) -- Formulario de submissao do bazar
3. **`src/components/catalog/VipAreaDrawer.tsx`** -- Conectar botao bazar_vip ao dialog
4. **`src/pages/BazarAdmin.tsx`** (novo) -- Pagina de curadoria do lojista
5. **`src/App.tsx`** -- Adicionar rota /admin/bazar
6. **`src/components/layout/Sidebar.tsx`** -- Adicionar link ao menu
