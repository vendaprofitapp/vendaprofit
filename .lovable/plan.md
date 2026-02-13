
# Faturamento na Visao Geral + Despesas Parceladas

## Parte 1: Adicionar "Faturamento" ao Financeiro

Atualmente a aba "Visao Geral" mostra apenas Lucro de Vendas, Total Despesas, Lucro Liquido Real, Contas a Pagar e Estoque Externo. Falta o **Faturamento** (valor total recebido em vendas).

### Mudanca em `Financial.tsx`
- Buscar o total de vendas (soma de `sales.total`) no periodo filtrado
- Adicionar um card "Faturamento" (cor azul) como primeiro card, mostrando o valor total de vendas realizadas
- Reorganizar os cards: Faturamento | Lucro de Vendas | Total Despesas | Lucro Liquido Real | Contas a Pagar

### Mudanca em `DREReport.tsx`
- O DRE ja mostra "Receita Bruta de Vendas" que e o faturamento. Nao precisa alteracao aqui.

## Parte 2: Despesas Parceladas

Permitir que ao cadastrar uma despesa, a usuaria possa informar que sera paga em parcelas, definindo quantidade, valor e vencimento de cada parcela.

### Nova tabela: `expense_installments`

```
expense_installments
  id (uuid, PK)
  expense_id (uuid)         -- referencia a expenses
  installment_number (int)  -- 1, 2, 3...
  amount (numeric)          -- valor da parcela
  due_date (date)           -- data de vencimento
  is_paid (boolean)         -- se ja foi paga
  paid_at (timestamptz)     -- quando foi paga
  created_at (timestamptz)
```

RLS: acesso baseado no owner_id da expense pai.

### Novas colunas em `expenses`

- `is_installment` (boolean, default false) -- se a despesa e parcelada
- `installment_count` (integer, nullable) -- numero de parcelas

### Mudancas no `ExpenseFormDialog.tsx`

1. Adicionar toggle "Pagamento parcelado"
2. Quando ativo, mostrar:
   - Input "Numero de parcelas" (2 a 24)
   - Ao definir, gerar automaticamente a lista de parcelas com:
     - Valor dividido igualmente (editavel por parcela)
     - Data de vencimento mensal a partir da data da despesa (editavel por parcela)
3. Exibir lista editavel das parcelas com campos de valor e data
4. Ao salvar, criar os registros em `expense_installments`

### Mudancas no `ExpensesList.tsx`

- Mostrar badge "Parcelado 3x" quando a despesa for parcelada
- Mostrar indicador de quantas parcelas ja foram pagas (ex: "2/4 pagas")
- Ao clicar na despesa parcelada, permitir visualizar e marcar parcelas como pagas

### Mudancas no `ExpenseSummaryCards.tsx` e `useExpenseTotals`

- Para despesas parceladas, considerar apenas as parcelas com vencimento dentro do periodo filtrado (nao o valor total da despesa)
- Isso garante que o DRE e os cards reflitam corretamente o custo do periodo

### Mudancas no `DREReport.tsx`

- Ajustar para usar a mesma logica: despesas parceladas contam apenas as parcelas do periodo

## Detalhes Tecnicos

### Arquivos a Criar
1. Migration SQL para tabela `expense_installments` e colunas `is_installment`/`installment_count` em `expenses`

### Arquivos a Modificar
1. `src/pages/Financial.tsx` -- adicionar card de Faturamento com query de vendas
2. `src/components/financial/ExpenseFormDialog.tsx` -- adicionar secao de parcelamento com lista editavel
3. `src/components/financial/ExpensesList.tsx` -- exibir info de parcelas e permitir marcar como paga
4. `src/components/financial/ExpenseSummaryCards.tsx` -- ajustar calculo para considerar parcelas do periodo
5. `src/components/financial/DREReport.tsx` -- mesma logica de parcelas no periodo

### Fluxo do Usuario

1. Clica em "+ Nova Despesa"
2. Preenche: "Stand Feira Fitness - R$600 - Evento"
3. Ativa "Pagamento parcelado" -> define 3x
4. Sistema gera: Parcela 1: R$200 (venc 10/02), Parcela 2: R$200 (venc 10/03), Parcela 3: R$200 (venc 10/04)
5. Pode editar valores (ex: Parcela 1: R$250, Parcela 2: R$200, Parcela 3: R$150)
6. Pode editar datas de vencimento individualmente
7. Salva a despesa
8. Na listagem, ve "Stand Feira Fitness - R$600 - 3x (1/3 pagas)"
9. No DRE de fevereiro, aparece apenas R$200 (parcela do mes)
