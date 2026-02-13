
# Corrigir Lógica de Parcelamento para Mostrar Sempre

## Análise do Problema Atual

A função `getInstallmentInfo()` em `PurchaseIncentives.tsx` (linhas 70-90) retorna `null` quando `installments < 2`, impedindo a exibição de parcelamento para produtos com valores baixos.

**Exemplo atual (quebrado):**
- Produto R$145 com mínimo R$120 por parcela
- Cálculo: `Math.floor(145 / 120) = 1` → retorna `null` → nada aparece no card

**Resultado esperado:**
- Produto R$145 deve mostrar: "4x de R$36,25" (máximo configurado pelo vendedor)
- No carrinho, avisar: "⚠️ Valor mínimo por parcela não atingido. Adicione mais itens."

## Estratégia de Solução

### Parte 1: Modificar a Lógica de Cálculo (`PurchaseIncentives.tsx`)

**Mudança na função `getInstallmentInfo()`:**

1. **Sempre calcular e retornar dados**, mesmo que `installments < 2`
2. Adicionar um flag `minNotReached: boolean` ao retorno para indicar quando o mínimo não foi atingido
3. Quando `installments < 2`, retornar com `installments = max_installments` (ex: 4x)
4. Adicionar `amountPerInstallment` no retorno para comparação com mínimo

**Exemplo de retorno:**
```typescript
{
  installments: 4,          // máximo do vendedor
  perInstallment: 36.25,    // R$145 ÷ 4
  minNotReached: true,      // R$36,25 < R$120 (mínimo)
  noInterest: true
}
```

### Parte 2: Atualizar Exibição no Card (`PurchaseIncentives.tsx` - componente `InstallmentInfo`)

O componente já exibe corretamente quando há dados. Não precisa modificação (linha 2178 em `StoreCatalog.tsx` já integra corretamente).

### Parte 3: Avisar no Carrinho (`StoreCatalog.tsx`)

Adicionar lógica no carrinho (Sheet) para:

1. **Verificar se algum item tem `minNotReached = true`**
2. **Exibir aviso claro** (antes ou depois da barra de progresso)
3. **Indicar quanto falta** para atingir o mínimo por parcela

Exemplo de mensagem:
```
⚠️ Atenção: Para parcelar em 4x, o valor por parcela precisa ser mínimo R$120.
Seu carrinho: R$87,50 por parcela. Adicione mais R$52,50 para desbloquear.
```

### Parte 4: Verificar Salvamento do PIX (`StoreSettings.tsx`)

Investigar por que `pix_discount.enabled` está como `false` apesar de ter sido configurado.

**Possíveis causas:**
- Switch não está sendo capturado corretamente no estado do formulário
- A mutation não está enviando o valor corretamente
- JSON está sendo salvo com estrutura diferente

**Solução:**
- Verificar se o switch está vinculado ao estado correto (linhas 1599-1609 em `StoreSettings.tsx`)
- Adicionar `console.log()` para debug durante o salvamento
- Validar que o objeto `purchase_incentives_config` está sendo stringificado/parseado corretamente

## Arquivos a Modificar

1. **`src/components/catalog/PurchaseIncentives.tsx`**
   - Modificar `getInstallmentInfo()`: sempre retornar dados com flag `minNotReached`
   - Atualizar interface de retorno

2. **`src/pages/StoreCatalog.tsx`**
   - Adicionar lógica no Sheet do carrinho para detectar `minNotReached`
   - Exibir aviso claro sobre o mínimo não atingido
   - Calcular quanto falta para atingir

3. **`src/pages/StoreSettings.tsx`**
   - Verificar/corrigir o salvamento do `pix_discount.enabled`
   - Adicionar validação ou debug se necessário

## Fluxo Esperado Após Correção

```
1. Vendedora configura: 4x, mínimo R$120 por parcela, PIX 5% OFF
2. Produto R$145 no card mostra:
   - "💳 4x de R$36,25 sem juros"
   - "ou R$137,75 no PIX (5% OFF)"
3. Cliente adiciona ao carrinho
4. No carrinho, se mínimo não atingido:
   ⚠️ Aviso: "Para parcelar em 4x, precisa ser R$120 por parcela. 
                 Seu carrinho: R$87,50/parcela. Faltam R$52,50"
5. Cliente adiciona mais itens
6. Aviso desaparece quando `minReached = true`
```

## Considerações Técnicas

- A mudança é **backward compatible**: produtos com preços altos continuarão funcionando igual
- O `minNotReached` flag é apenas informativo, não bloqueia a compra
- A avaliação do mínimo deve considerar o **valor total do carrinho**, não por item

