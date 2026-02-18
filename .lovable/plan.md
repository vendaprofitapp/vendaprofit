
# Adicionar CPF/CNPJ ao Cadastro de Ponto Parceiro

## O que Muda

| Componente | Mudança |
|---|---|
| Banco de dados (`partner_points`) | Nova coluna `cpf_cnpj text NULL` |
| `NewPartnerDialog.tsx` | Campo de texto com formatação e máscara visual, posicionado junto aos dados do contato |

Nenhum outro arquivo precisa ser alterado.

---

## Banco de Dados — Migração Simples

Adição de coluna opcional (sem impacto em dados existentes):

```sql
ALTER TABLE partner_points
  ADD COLUMN cpf_cnpj text DEFAULT NULL;
```

- Nullable: sim — o campo é informativo/contratual, não obrigatório para o funcionamento do sistema
- Tipo texto: preserva formatação com pontos, traços e barras (ex: `123.456.789-00` ou `12.345.678/0001-90`)

---

## `NewPartnerDialog.tsx` — Detalhes da Implementação

### Posição na tela

O campo CPF/CNPJ será inserido **logo após os campos de nome e telefone do contato**, antes do campo de endereço. Fica agrupado com os dados de identificação do parceiro:

```
Nome do local *
────────────────────────────────────
Nome do contato    |  Telefone do contato
────────────────────────────────────
CPF / CNPJ   ← NOVO CAMPO
────────────────────────────────────
Endereço
```

### Comportamento do campo

- Label: **"CPF / CNPJ"**
- Placeholder: `"000.000.000-00 ou 00.000.000/0001-00"`
- Tipo `text` com `inputMode="numeric"` para abrir teclado numérico no celular
- Sem máscara automática obrigatória (usuário digita livremente) — mantém consistência com o restante do formulário que não usa bibliotecas de máscara
- Opcional: sem validação obrigatória (não bloqueia o cadastro)

### Estado e Submit

Adicionado ao objeto `form`:
```typescript
cpf_cnpj: ""
```

No `handleSubmit`, incluído no `insert`:
```typescript
cpf_cnpj: form.cpf_cnpj.trim() || null,
```

No reset após salvar:
```typescript
cpf_cnpj: ""
```

---

## Garantias de Não-Regressão

- Parceiros já cadastrados: coluna `NULL` por padrão, sem quebra de dados ou queries existentes
- `PartnerPointCard.tsx`, `PartnerSettlementTab.tsx`, `PartnerCheckoutPasses.tsx`, `PartnerCatalog.tsx`: nenhum desses arquivos precisa ser alterado — o CPF/CNPJ é dado cadastral interno, não afeta o fluxo de venda
- A migração é puramente aditiva
