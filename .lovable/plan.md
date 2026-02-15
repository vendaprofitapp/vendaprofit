

# Fase 1: Motor de Gamificacao e Painel Admin de Fidelidade

## Resumo

Criar um sistema de fidelidade white-label onde cada lojista configura seus proprios niveis de recompensa, e o sistema calcula automaticamente o nivel de cada cliente com base no gasto acumulado.

## Estrutura de Dados

### Tabela `loyalty_levels` (nova)

Armazena os niveis de fidelidade configurados por cada lojista.

| Coluna | Tipo | Obs |
|--------|------|-----|
| id | uuid | PK |
| owner_id | uuid | Lojista dono |
| name | text | Ex: "Bronze", "Ouro" |
| min_spent | numeric | Gasto minimo acumulado |
| color | text | Cor hexadecimal |
| features | jsonb | Array de features liberadas |
| display_order | integer | Ordenacao |
| created_at | timestamptz | |

RLS: owner_id = auth.uid() para todas as operacoes.

### Coluna `total_spent` na tabela `customers` (nova)

Adicionar uma coluna `total_spent numeric DEFAULT 0` na tabela `customers` para rastrear o gasto acumulado de cada cliente.

### Funcao SQL `get_customer_loyalty_level`

Funcao que recebe um `customer_id` e retorna o nivel atual do cliente, comparando `customers.total_spent` com os `loyalty_levels` do `owner_id` daquele cliente.

### Trigger para acumular gasto

Como `sales` referencia clientes por `customer_name` + `customer_phone` (nao por FK), criaremos uma funcao trigger que, ao inserir uma venda com status "completed", busca o cliente correspondente na tabela `customers` pelo `owner_id` + `customer_phone` e incrementa o `total_spent`.

## Pagina Admin `/admin/fidelidade`

Interface onde o lojista configura os niveis:

- Lista dos niveis existentes ordenados por `min_spent`
- Botao para adicionar novo nivel
- Dialogo de edicao com: Nome, Valor Minimo, Cor (input hex com preview), e checkboxes para features (Bazar VIP, Chat, Provador IA)
- O nivel "Inicial" (min_spent = 0) e criado automaticamente e nao pode ser excluido
- Botoes de editar e excluir para cada nivel

## Navegacao

- Adicionar item "Fidelidade" no Sidebar com icone `Award`
- Adicionar rota `/admin/fidelidade` no App.tsx como rota protegida

## Arquivos a criar/modificar

1. **Nova migracao SQL** -- Tabela `loyalty_levels`, coluna `total_spent` em `customers`, trigger de acumulo, funcao de calculo de nivel
2. **`src/pages/LoyaltyAdmin.tsx`** (novo) -- Pagina de configuracao dos niveis
3. **`src/components/layout/Sidebar.tsx`** -- Adicionar link para Fidelidade
4. **`src/App.tsx`** -- Adicionar rota `/admin/fidelidade`

## Detalhes tecnicos

### Trigger de acumulo de gasto

```text
AFTER INSERT ON sales (quando status = 'completed')
-> Busca customer em customers WHERE owner_id = sales.owner_id AND phone = customer_phone
-> UPDATE customers SET total_spent = total_spent + sales.total
```

Tambem precisamos de um trigger para UPDATE (caso uma venda seja editada) e DELETE (caso seja removida), ajustando o total_spent de acordo.

### Funcao de calculo de nivel

```text
get_customer_loyalty_level(customer_id uuid)
RETURNS jsonb {name, color, features}
-> Busca owner_id e total_spent do customer
-> Busca loyalty_levels WHERE owner_id = customer.owner_id AND min_spent <= customer.total_spent
-> ORDER BY min_spent DESC LIMIT 1
-> Retorna o nivel correspondente
```

### Seed do nivel inicial

Ao acessar a pagina pela primeira vez, se nao existir nenhum nivel, o frontend cria automaticamente o nivel "Inicial" com min_spent = 0.
