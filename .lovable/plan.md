

# Estoque Zerado para Novos Usuarios + Toggle de Ativacao por Fornecedor

## Situacao Atual

O trigger `copy_admin_defaults_to_new_user` copia **todos os 284 produtos do admin** para novos usuarios (com estoque 0), sem vincular `supplier_id`. O usuario recebe um estoque cheio de produtos de fornecedores que talvez nao queira revender.

## Nova Logica

1. Novos usuarios comecam **sem nenhum produto** (trigger para de copiar produtos)
2. Na aba **Fornecedores**, cada fornecedor tera um toggle **"Ativar Catalogo"**
3. Ao ativar, o sistema puxa os produtos do admin (Central de Pecas) para aquele fornecedor especifico, com estoque zerado e `supplier_id` correto
4. No **Wizard de Onboarding**, as marcas selecionadas ativam automaticamente o catalogo dos fornecedores correspondentes

---

## Mudancas Necessarias

### 1. Nova coluna no banco: `suppliers.catalog_synced`

Adicionar coluna booleana para rastrear quais fornecedores ja tiveram o catalogo sincronizado:

```sql
ALTER TABLE suppliers ADD COLUMN catalog_synced boolean NOT NULL DEFAULT false;
```

### 2. Alterar trigger `copy_admin_defaults_to_new_user`

Remover o bloco que copia produtos. O trigger continuara copiando apenas:
- Fornecedores
- Formas de pagamento customizadas

Produtos serao adicionados sob demanda via toggle.

### 3. Aba Fornecedores (`src/pages/Suppliers.tsx`)

Adicionar nova coluna **"Catalogo"** na tabela com um toggle + badge:

```text
| Empresa | CNPJ | ... | Catalogo        | Acoes |
|---------|------|-----|-----------------|-------|
| BECHOSE | ...  | ... | [toggle] 127 pcs| ...   |
| INMOOV  | ...  | ... | [toggle] -      | ...   |
```

Ao ativar o toggle:
1. Buscar o fornecedor admin com nome igual (case-insensitive)
2. Buscar todos os produtos do admin vinculados a esse fornecedor
3. Inserir os que ainda nao existem no estoque do usuario (comparacao por nome, case-insensitive)
4. Marcar `catalog_synced = true` no fornecedor do usuario
5. Toast de sucesso com quantidade de produtos adicionados

Ao desativar o toggle:
- Apenas marca `catalog_synced = false` (nao remove produtos ja existentes)
- Mostra aviso que produtos ja importados permanecem no estoque

### 4. Wizard de Onboarding (`src/components/onboarding/OnboardingWizard.tsx`)

Na Step 3 (selecao de marcas), ao clicar "Finalizar":
1. Para cada marca selecionada, localizar o fornecedor do usuario pelo nome
2. Executar a mesma logica de sync de produtos (buscar admin products -> inserir com stock 0)
3. Marcar `catalog_synced = true` nos fornecedores correspondentes

---

## Detalhes Tecnicos

### Funcao de sync de catalogo (reutilizavel)

Criar funcao utilitaria `syncSupplierCatalog` usada tanto na pagina de Fornecedores quanto no Wizard:

```typescript
async function syncSupplierCatalog(
  userId: string,
  userSupplierId: string,
  supplierName: string
): Promise<number>
```

Logica interna:
1. Buscar admin_id via `user_roles` (role = 'admin')
2. Buscar fornecedor admin com `ilike` no nome
3. Buscar produtos do admin com `supplier_id` do admin
4. Buscar produtos existentes do usuario com `supplier_id` do usuario
5. Filtrar produtos faltantes por nome (case-insensitive)
6. Inserir com `owner_id = userId`, `supplier_id = userSupplierId`, `stock_quantity = 0`
7. Atualizar `catalog_synced = true` no fornecedor do usuario
8. Retornar quantidade de produtos inseridos

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Adicionar coluna `catalog_synced` e atualizar trigger |
| `src/utils/catalogSync.ts` | **CRIAR** — Funcao reutilizavel de sync |
| `src/pages/Suppliers.tsx` | Adicionar coluna "Catalogo" com toggle de sync |
| `src/components/onboarding/OnboardingWizard.tsx` | Chamar sync ao finalizar com marcas selecionadas |

### Interface do toggle na tabela de Fornecedores

O toggle "Catalogo" tera 3 estados visuais:
- **Desativado**: Toggle off, sem badge
- **Sincronizando**: Toggle desabilitado + spinner
- **Ativado**: Toggle on + badge com quantidade de produtos (ex: "127 pecas")

### Tratamento de casos especiais

- Se o fornecedor do usuario nao tiver correspondente no admin: toggle desabilitado com tooltip "Fornecedor nao encontrado no catalogo master"
- Se ja estiver sincronizado e usuario ativar novamente: apenas insere produtos novos que ainda nao existam (idempotente)
- Produtos removidos do admin nao sao removidos automaticamente do usuario

