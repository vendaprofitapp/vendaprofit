
# Garantir que o Sync de Marcas Nunca Altere Dados Existentes do Usuário

## Situação Atual

A função `syncSupplierCatalog` (em `src/utils/catalogSync.ts`) já tem proteção parcial:
- Ela busca produtos existentes do usuário para aquele `supplier_id` específico
- Filtra por nome (case-insensitive) e só insere o que não existe
- Nunca faz `UPDATE`, apenas `INSERT` — então dados já editados (estoque, preço) não são sobrescritos

**Porém, há uma brecha:** A verificação de duplicatas usa `.eq("supplier_id", userSupplierId)` — ou seja, só checa produtos daquele fornecedor específico. Se o usuário tem produtos da marca BECHOSE com um `supplier_id` diferente (ou sem `supplier_id`), eles não são detectados e o produto pode ser inserido em duplicata.

## Solução

### 1. Ampliar a busca de produtos existentes (`src/utils/catalogSync.ts`)

Ao verificar duplicatas, buscar **todos os produtos do usuário** (sem filtrar por `supplier_id`), comparando apenas por nome. Isso garante que nenhum produto já cadastrado — independente do fornecedor vinculado — seja duplicado.

**Antes:**
```typescript
const { data: existingProducts } = await supabase
  .from("products")
  .select("name")
  .eq("owner_id", userId)
  .eq("supplier_id", userSupplierId)  // ← restringe demais
  .limit(5000);
```

**Depois:**
```typescript
const { data: existingProducts } = await supabase
  .from("products")
  .select("name")
  .eq("owner_id", userId)  // ← verifica todo o estoque do usuário
  .limit(5000);
```

### 2. Adicionar aviso visual no Step 3 do Wizard (`src/components/onboarding/OnboardingWizard.tsx`)

Na tela de seleção de marcas, adicionar uma nota informativa abaixo do título explicando que produtos já cadastrados não serão alterados. Isso deixa o usuário tranquilo ao ver a tela:

```
ℹ️ Apenas produtos ainda não cadastrados no seu estoque serão adicionados.
   Seus dados existentes (preços, estoque, fotos) nunca serão alterados.
```

### 3. Melhorar o feedback ao finalizar

Atualmente, se todas as marcas selecionadas já existem no estoque (`totalSynced === 0`), nenhum toast é exibido. Adicionar um toast informativo nesses casos:

- Se `totalSynced > 0`: "X produtos novos adicionados ao seu catálogo!"
- Se `totalSynced === 0` e havia marcas selecionadas: "Seu catálogo já está atualizado — nenhum produto novo foi encontrado."

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/utils/catalogSync.ts` | Remover filtro `supplier_id` na busca de produtos existentes do usuário |
| `src/components/onboarding/OnboardingWizard.tsx` | Adicionar aviso informativo no Step 3 + melhorar toast de feedback |

## Comportamento Resultante

- **Usuário sem nenhum produto daquela marca:** produtos são inseridos normalmente com estoque 0
- **Usuário com produtos daquela marca (qualquer `supplier_id`):** nenhum produto duplicado é criado; estoque, preços e fotos existentes nunca são tocados
- **Usuário com todos os produtos já cadastrados:** recebe mensagem informando que o catálogo já está atualizado
