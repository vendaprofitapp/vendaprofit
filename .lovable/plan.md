

# Controle Financeiro Completo - Com Divisao de Despesas em Parcerias

## Resumo

Criar uma aba completa de controle financeiro dentro da pagina Financeiro, permitindo cadastrar custos fixos, variaveis e de eventos. Alem disso, despesas podem ser vinculadas a uma parceria e divididas automaticamente seguindo as regras ja configuradas (cost_split_ratio) ou com divisao personalizada.

## Estrutura da Tabela `expenses`

```text
expenses
  id (uuid, PK)
  owner_id (uuid)              -- quem cadastrou a despesa
  amount (numeric)             -- valor total da despesa
  category (text)              -- ex: "frete", "gasolina", "embalagem"
  category_type (text)         -- "fixed" | "variable" | "event" | "other"
  description (text)           -- descricao livre
  expense_date (date)          -- data da despesa
  is_recurring (boolean)       -- custo fixo recorrente mensal
  recurring_day (integer)      -- dia do mes para recorrencia
  
  -- Campos de parceria
  group_id (uuid, nullable)    -- se vinculada a uma parceria/grupo
  split_mode (text)            -- "none" | "partnership_rules" | "custom"
  custom_split_percent (numeric, nullable) -- ex: 60 = eu pago 60%, parceiro 40%
  
  created_at, updated_at
```

### Logica de Divisao

- **`split_mode = 'none'`**: Despesa 100% minha, sem divisao
- **`split_mode = 'partnership_rules'`**: Usa o `cost_split_ratio` ja configurado na parceria (ex: 50/50)
- **`split_mode = 'custom'`**: Percentual personalizado definido na hora (ex: eu pago 70%, parceiro 30%)

### Tabela auxiliar `expense_splits`

```text
expense_splits
  id (uuid, PK)
  expense_id (uuid)            -- referencia a expenses
  user_id (uuid)               -- quem deve essa parte
  amount (numeric)             -- valor da parte
  is_paid (boolean)            -- se ja foi acertado
  created_at
```

Quando uma despesa e vinculada a parceria, o sistema cria automaticamente os splits (um para cada parceiro) usando as regras selecionadas.

## Categorias Pre-definidas

**Custos Fixos**: Aluguel, Internet, Assinaturas, Contador

**Custos Variaveis (por venda)**: Frete, Embalagens, Impressoes, Sacolas/caixas

**Custos de Eventos**: Gasolina, Alimentacao, Stand/espaco, Material divulgacao, Insumos (arara, cabides)

**Outros**: Categoria livre

## Interface - 3 Abas na pagina Financeiro

### Aba 1: Visao Geral (atualizada)
- Cards existentes MAIS novo card "Total Despesas" (vermelho)
- Card "Lucro Liquido Real" = Receitas - Despesas

### Aba 2: Despesas
- Botao "+ Nova Despesa" abre formulario com:
  - Tipo (Fixo / Variavel / Evento / Outro)
  - Categoria (dropdown pre-definido + campo livre)
  - Valor, Data, Descricao
  - Toggle "Recorrente" (para custos fixos)
  - **Secao "Dividir com Parceria"** (aparece se usuario tem parcerias ativas):
    - Dropdown: selecionar parceria
    - Radio: "Seguir regras da parceria (50/50)" | "Divisao personalizada"
    - Se personalizada: slider ou input de porcentagem
- Tabela listando despesas com badge indicando se e dividida
- Filtro por tipo e por parceria
- Totais por categoria

### Aba 3: DRE Simplificado
Demonstrativo de resultado:

```text
(+) Receita Bruta de Vendas
(-) Taxas de Pagamento
(=) Receita Liquida
(-) Custo das Mercadorias (CMV)
(=) Lucro Bruto
(-) Custos Fixos (minha parte)
(-) Custos Variaveis (minha parte)
(-) Custos de Eventos (minha parte)
(-) Outras Despesas
(=) LUCRO LIQUIDO REAL
```

Nota: quando uma despesa e dividida com parceiro, apenas a parte da usuaria entra no DRE.

## Integracao com Acerto de Contas

As despesas divididas com parceiros aparecerao no relatorio de acerto (PartnerReports / AccountSettlement) como itens a mais no calculo do saldo:

- Se eu paguei uma despesa dividida -> parceiro me deve sua parte
- Se parceiro pagou -> eu devo minha parte

Isso sera feito consultando `expense_splits` onde `is_paid = false`.

## Arquivos a Criar

1. **Migration SQL** - tabelas `expenses` e `expense_splits` com RLS
2. **`src/components/financial/ExpenseFormDialog.tsx`** - formulario de cadastro com opcao de divisao
3. **`src/components/financial/ExpensesList.tsx`** - tabela de despesas com filtros
4. **`src/components/financial/DREReport.tsx`** - demonstrativo de resultado
5. **`src/components/financial/ExpenseSummaryCards.tsx`** - cards resumo

## Arquivos a Modificar

1. **`src/pages/Financial.tsx`** - reorganizar com Tabs, integrar novos componentes
2. **`src/components/reports/AccountSettlement.tsx`** - incluir despesas divididas no calculo de saldo

## Seguranca (RLS)

- `expenses`: SELECT/INSERT/UPDATE/DELETE restrito a `owner_id = auth.uid()`
- `expense_splits`: SELECT onde `user_id = auth.uid()` OU onde o expense pertence ao usuario
- UPDATE de `is_paid` permitido para ambos os parceiros envolvidos

## Fluxo do Usuario

1. Acessa Financeiro -> aba "Despesas"
2. Clica "+ Nova Despesa"
3. Preenche: "Gasolina - Feira Fitness - R$120 - 10/02/2026"
4. Ativa "Dividir com Parceria" -> seleciona "Parceria com Isabelle"
5. Escolhe "Seguir regras da parceria (50/50)"
6. Sistema cria: R$60 para cada parceira
7. No Acerto de Contas, Isabelle ve que deve R$60 dessa despesa
8. Na aba DRE, apenas R$60 (minha parte) e descontado do lucro

