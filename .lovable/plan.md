
# Fase 2: Hub Central do Cliente -- Gamificacao no Catalogo

## Resumo

Adicionar ao catalogo publico (`StoreCatalog.tsx`) um painel de fidelidade do cliente com nivel atual, barra de progresso ate o proximo nivel, e uma gaveta "Area VIP" com botoes condicionais baseados nas permissoes do nivel.

## Estrutura

### 1. Hook `useCatalogLoyalty` (novo arquivo)

Criar `src/hooks/useCatalogLoyalty.tsx` que encapsula toda a logica de fidelidade para o catalogo:

- Recebe `store_owner_id` (do store settings)
- Busca os `loyalty_levels` do owner via query publica (precisa de policy SELECT para isso)
- Se o usuario estiver logado, busca o `total_spent` do cliente na tabela `customers` (match por phone/owner_id) OU diretamente se houver um vinculo
- Calcula o nivel atual e o proximo nivel
- Retorna: `{ currentLevel, nextLevel, totalSpent, progress, unlockedFeatures, levels, isLoading }`

Nota: Como o catalogo e publico e os clientes nao tem conta Supabase, usaremos os dados do lead capturado (localStorage) para buscar o `total_spent` via uma query anonima. Precisamos de uma policy SELECT publica limitada na tabela `customers` ou uma funcao RPC.

### 2. Funcao RPC `get_catalog_customer_loyalty` (migracao SQL)

Criar funcao SECURITY DEFINER que:
- Recebe `_owner_id uuid` e `_phone text`
- Busca `total_spent` do customer
- Busca os loyalty_levels do owner
- Retorna o nivel atual, proximo nivel, progresso percentual e features liberadas
- Isso evita expor dados sensiveis via RLS publica

Tambem adicionar policy SELECT publica em `loyalty_levels` para que o catalogo possa listar os niveis (sem dados sensiveis).

### 3. Componente `LoyaltyHeader` (novo)

Criar `src/components/catalog/LoyaltyHeader.tsx`:

- **Logado (lead com telefone salvo)**: Mostra o nivel atual com cor/nome, barra de progresso ate o proximo nivel, e texto "Falta R$ X para [ProximoNivel]"
- **Nao logado**: Botao "Entrar para ver meu Nivel" que abre um Dialog simples pedindo telefone/WhatsApp (reutiliza o lead capture existente)

Layout: painel compacto fixo abaixo do header existente do catalogo.

### 4. Componente `VipAreaDrawer` (novo)

Criar `src/components/catalog/VipAreaDrawer.tsx`:

- Botao flutuante (FAB) no canto inferior esquerdo com icone de coroa/estrela
- Ao clicar, abre um Drawer (bottom sheet) com titulo "Area VIP"
- Dentro, renderiza condicionalmente os botoes de features desbloqueadas (Bazar VIP, Chat, Provador IA)
- Se nenhuma feature desbloqueada: mostra mensagem de incentivo com barra de progresso
- Os botoes nao fazem nada ainda (apenas placeholders visuais)

### 5. Integracao no `StoreCatalog.tsx`

- Importar e renderizar `LoyaltyHeader` abaixo do header existente
- Importar e renderizar `VipAreaDrawer` como FAB flutuante
- Passar dados do store (owner_id) e do lead (phone do localStorage)

## Arquivos a criar/modificar

1. **Nova migracao SQL** -- Funcao RPC `get_catalog_customer_loyalty` + policy SELECT publica em `loyalty_levels`
2. **`src/hooks/useCatalogLoyalty.tsx`** (novo) -- Hook de logica de fidelidade
3. **`src/components/catalog/LoyaltyHeader.tsx`** (novo) -- Painel de nivel no header
4. **`src/components/catalog/VipAreaDrawer.tsx`** (novo) -- Gaveta VIP flutuante
5. **`src/pages/StoreCatalog.tsx`** -- Integrar os novos componentes

## Detalhes tecnicos

### Funcao RPC

```text
get_catalog_customer_loyalty(_owner_id uuid, _phone text)
RETURNS jsonb {
  total_spent, 
  current_level: {name, color, features, min_spent},
  next_level: {name, color, min_spent} | null,
  progress_percent
}
```

Funcao SECURITY DEFINER acessivel por anon, pois o catalogo e publico.

### Barra de progresso

Calculo: `(total_spent - current_level.min_spent) / (next_level.min_spent - current_level.min_spent) * 100`

Se nao houver proximo nivel (nivel maximo), mostra 100% com mensagem "Voce atingiu o nivel maximo!".

### FAB positioning

O botao flutuante da Area VIP ficara no canto inferior esquerdo (`fixed bottom-20 left-4`) para nao conflitar com o carrinho/WhatsApp que ficam a direita.
