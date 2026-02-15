
# Ajustar Texto do Nivel de Fidelidade + Toggle de Ativacao

## 1. Alterar texto da barra de progresso no catalogo

**Arquivo: `src/components/catalog/LoyaltyHeader.tsx`**

O texto atual e:
> "Falta R$ 12,00 para Prata"

Sera alterado para:
> "Falta R$ 500,00 para Cliente Nivel Prata"

Mudanca na linha 85-88: alterar o template da mensagem para incluir "Cliente Nivel" antes do nome do proximo nivel.

## 2. Toggle para ativar/desativar fidelidade na loja

### 2a. Nova coluna no banco de dados

Adicionar coluna `loyalty_enabled` (boolean, default `false`) na tabela `store_settings`. Isso permite que cada usuario escolha se quer exibir o programa de fidelidade na sua loja.

### 2b. Toggle nas configuracoes da loja

**Arquivo: `src/pages/StoreSettings.tsx`**

Adicionar um Switch "Programa de Fidelidade" na secao de configuracoes da loja, similar aos outros toggles existentes (como `lead_capture_enabled`, `secret_area_active`). Quando desativado, o header de fidelidade nao aparece no catalogo.

### 2c. Condicional no catalogo

**Arquivo: `src/pages/StoreCatalog.tsx`**

Verificar se `store.loyalty_enabled === true` antes de renderizar o `LoyaltyHeader` e antes de carregar os dados de fidelidade. Se desativado, nada relacionado a fidelidade aparece.

## Resumo das alteracoes

| Local | Alteracao |
|-------|-----------|
| Banco de dados | Nova coluna `loyalty_enabled` (boolean, default false) em `store_settings` |
| `LoyaltyHeader.tsx` | Texto alterado para "Falta R$ X para Cliente Nivel [Nome]" |
| `StoreSettings.tsx` | Novo Switch para ativar/desativar fidelidade |
| `StoreCatalog.tsx` | Condicional para mostrar fidelidade apenas quando habilitado |
