
# Corrigir Exibicao de Pedidos na Aba "Pedidos da Loja"

## Diagnostico

A investigacao mostrou que:
- Os dados ESTAO sendo salvos corretamente na tabela `saved_carts` (status `waiting`)
- A requisicao de rede retorna Status 200 com os pedidos
- As politicas de seguranca (RLS) estao configuradas corretamente
- A rota e o sidebar estao registrados corretamente

O problema e que o polling atual e de 30 segundos, entao se o usuario abre a pagina logo apos fazer um pedido, pode nao ver o dado imediatamente. Alem disso, nao ha atualizacao em tempo real.

## Solucao

### 1. Arquivo: `src/pages/CatalogOrders.tsx` - Melhorias de confiabilidade

- **Reduzir o polling de 30s para 10s** para que novos pedidos aparecam mais rapido
- **Adicionar botao de "Atualizar"** manual para o usuario forcar a busca
- **Adicionar `refetchOnWindowFocus: true`** para que ao voltar para a aba, os dados sejam recarregados automaticamente
- **Remover o filtro `.eq("owner_id", user.id)`** da query de pedidos, pois a politica RLS ja filtra por owner_id automaticamente (duplo filtro pode causar conflitos em cenarios de cache)

### 2. Arquivo: `src/pages/CatalogOrders.tsx` - Melhoria na query de abandonados

- A query de carrinhos abandonados filtra por `owner_id` no lado do cliente (JavaScript) apos trazer todos os dados. Isso e ineficiente e pode falhar silenciosamente se a relacao `store_leads` nao retornar dados.
- Alterar para filtrar diretamente no banco usando o campo `store_leads.owner_id`

### 3. Validar que a query nao esta falhando silenciosamente

- Adicionar tratamento de erro visual (toast) caso a query falhe, em vez de apenas exibir "Nenhum pedido"

## Resumo de alteracoes

| Arquivo | Alteracao |
|---|---|
| `src/pages/CatalogOrders.tsx` | Reduzir polling para 10s, adicionar `refetchOnWindowFocus`, botao "Atualizar", melhor tratamento de erros, otimizar query de abandonados |

## Resultado esperado

- Pedidos aparecerao em no maximo 10 segundos apos serem criados
- Ao alternar abas do navegador e voltar, os dados serao atualizados automaticamente
- Botao de atualizar manual para garantir que o usuario possa forcar a busca
- Erros serao exibidos visualmente em vez de silenciosamente ignorados
