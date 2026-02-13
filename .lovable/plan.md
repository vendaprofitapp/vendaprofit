

# Estrategia de Incentivos de Compra Personalizaveis por Vendedora

## Resumo

Criar um sistema completo de incentivos de compra com 3 pontos de contato (card do produto, ao adicionar ao carrinho, dentro do carrinho), totalmente configuravel por cada vendedora atraves das Configuracoes da Loja.

## Parte 1 - Banco de Dados: Tabela de Configuracao de Incentivos

Adicionar novos campos na tabela `store_settings` para armazenar as configuracoes de incentivos de cada vendedora:

**Novo campo JSONB: `purchase_incentives_config`**

Estrutura do JSON:

```text
{
  "enabled": true,
  
  "installments": {
    "enabled": true,
    "max_installments": 3,
    "min_amount_per_installment": 30,
    "no_interest": true
  },
  
  "pix_discount": {
    "enabled": true,
    "discount_percent": 5
  },
  
  "tiers": [
    { "min_value": 250, "benefit": "Frete gratis SP", "emoji": "truck" },
    { "min_value": 350, "benefit": "Frete gratis + mimo", "emoji": "gift" },
    { "min_value": 500, "benefit": "Brinde premium", "emoji": "star" },
    { "min_value": 700, "benefit": "Cliente VIP (cupom proximo pedido)", "emoji": "crown" }
  ],
  
  "messages": {
    "on_add": "Falta so mais uma peca para parcelar em 4x ;)",
    "near_free_shipping": "Voce esta a R${remaining} do frete gratis!",
    "unlocked_free_shipping": "Parabens! Voce ganhou frete gratis!",
    "unlocked_gift": "Seu pedido ganhou um presente!"
  }
}
```

**Migration SQL:**
- `ALTER TABLE store_settings ADD COLUMN purchase_incentives_config jsonb DEFAULT '{...}'`
- Valores padrao ja vem preenchidos para facilitar a ativacao

## Parte 2 - Ponto A: Info de Parcelamento no Card do Produto

Abaixo do preco em cada `BoutiqueProductCard`, exibir:

- "3x de R$33 sem juros" (calculado automaticamente com base no preco e config de parcelamento)
- "ou R$94 no PIX (5% OFF)" (se desconto PIX estiver ativo)

Essa informacao e calculada no frontend usando o `purchase_incentives_config` da loja.

**Arquivo modificado:** `src/pages/StoreCatalog.tsx` (componente `BoutiqueProductCard`)

## Parte 3 - Ponto B: Toast/Pop-up ao Adicionar ao Carrinho

Ao chamar `addToCart`, alem do toast "adicionado a sacola", exibir uma mensagem contextual baseada no valor atual do carrinho:

- Se esta perto do proximo tier: "Voce esta a R$X do frete gratis!"
- Se pode parcelar mais adicionando: "Com mais R$Y voce parcela em 5x sem juros"
- Mensagem customizada pela vendedora (campo `messages.on_add`)

**Implementacao:** Modificar a funcao `addToCart` no `StoreCatalog.tsx` para calcular e exibir o toast contextual usando `sonner`.

## Parte 4 - Ponto C: Barra de Progresso e Incentivos no Carrinho

Dentro do `SheetContent` do carrinho (ja existente), adicionar ACIMA da lista de itens:

1. **Barra de progresso visual** mostrando o progresso ate o proximo tier
2. **Mensagem dinamica** do tier atual e proximo
3. **Lista de beneficios** desbloqueados (com check verde) e pendentes (com valor restante)

Componente visual:

```text
[====------] Falta R$151 para Frete gratis SP
[==--------] Falta R$401 para Brinde premium

 check  R$250 - Frete gratis SP (desbloqueado!)
 lock   R$350 - Frete gratis + mimo
 lock   R$500 - Brinde premium  
 lock   R$700 - Cliente VIP
```

**Arquivo modificado:** `src/pages/StoreCatalog.tsx` (secao do cart Sheet)

## Parte 5 - Painel de Configuracao para a Vendedora

Na pagina `StoreSettings.tsx`, adicionar uma nova secao/card "Incentivos de Compra" onde a vendedora pode:

1. **Ativar/desativar** o sistema de incentivos (switch)
2. **Configurar parcelamento**: max parcelas, valor minimo por parcela, com/sem juros
3. **Configurar desconto PIX**: ativo/inativo, percentual
4. **Configurar tiers de beneficios**: adicionar/remover/reordenar faixas de valor com beneficio e emoji
5. **Personalizar mensagens**: editar cada mensagem dinamica com preview

**Arquivo modificado:** `src/pages/StoreSettings.tsx` (novo card de configuracao)

## Parte 6 - Componente Reutilizavel de Incentivos

Criar um novo componente `src/components/catalog/PurchaseIncentives.tsx` que encapsula:

- `InstallmentInfo` - exibe parcelamento abaixo do preco
- `CartProgressBar` - barra de progresso com tiers
- `CartIncentiveMessage` - mensagens contextuais
- `getNextTierMessage()` - logica de calculo do proximo tier

Isso mantem o `StoreCatalog.tsx` limpo e a logica reutilizavel.

## Arquivos Modificados/Criados

1. **Migration SQL** - Adicionar `purchase_incentives_config` em `store_settings`
2. **`src/components/catalog/PurchaseIncentives.tsx`** (novo) - Componentes de incentivo
3. **`src/pages/StoreCatalog.tsx`** - Integrar incentivos no card, addToCart e carrinho
4. **`src/pages/StoreSettings.tsx`** - Painel de configuracao de incentivos

## Fluxo do Cliente

```text
1. Cliente ve produto
   -> Abaixo do preco: "3x de R$33 | PIX R$94 (5% OFF)"

2. Cliente adiciona ao carrinho
   -> Toast: "Adicionado! Voce esta a R$151 do frete gratis"

3. Cliente abre o carrinho
   -> Barra de progresso com tiers
   -> Mensagens de incentivo
   -> Beneficios desbloqueados marcados com check

4. Cliente desbloqueia tier
   -> Toast celebratorio: "Parabens! Voce ganhou frete gratis!"
```

