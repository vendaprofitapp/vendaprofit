import { Receipt, TrendingDown, CalendarCheck, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface ExpenseSummaryCardsProps {
  dateRange: { start: Date; end: Date };
}

export function ExpenseSummaryCards({ dateRange }: ExpenseSummaryCardsProps) {
  const { user } = useAuth();
  const totals = useExpenseTotals(user?.id, dateRange);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-rose-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Despesas</CardTitle>
          <Receipt className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totals.total)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Minha parte no período</p>
        </CardContent>
      </Card>

      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Custos Fixos</CardTitle>
          <CalendarCheck className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(totals.byType.fixed)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Aluguel, internet, etc.</p>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-yellow-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Custos Variáveis</CardTitle>
          <TrendingDown className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            {formatCurrency(totals.byType.variable)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Frete, embalagem, etc.</p>
        </CardContent>
      </Card>

      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-violet-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Eventos</CardTitle>
          <Briefcase className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(totals.byType.event)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Gasolina, alimentação, etc.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function useExpenseTotals(userId: string | undefined, dateRange: { start: Date; end: Date }) {
  const startDate = dateRange.start.toISOString().split("T")[0];
  const endDate = dateRange.end.toISOString().split("T")[0];

  // Fetch non-installment expenses in the period
  const { data: regularExpenses = [] } = useQuery({
    queryKey: ["expenses-totals-regular", userId, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category_type, split_mode, id")
        .eq("owner_id", userId!)
        .eq("is_installment", false)
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch installment expenses (all, regardless of expense_date)
  const { data: installmentExpenses = [] } = useQuery({
    queryKey: ["expenses-totals-installment", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, category_type, split_mode, is_installment")
        .eq("owner_id", userId!)
        .eq("is_installment", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch installments with due_date in the period
  const installmentExpenseIds = installmentExpenses.map((e: any) => e.id);
  const { data: periodInstallments = [] } = useQuery({
    queryKey: ["installments-in-period", installmentExpenseIds, dateRange],
    queryFn: async () => {
      if (installmentExpenseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("expense_installments")
        .select("expense_id, amount")
        .in("expense_id", installmentExpenseIds)
        .gte("due_date", startDate)
        .lte("due_date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: installmentExpenseIds.length > 0,
  });

  // Build installment amounts per expense in the period
  const installmentAmountByExpense = new Map<string, number>();
  periodInstallments.forEach((inst: any) => {
    installmentAmountByExpense.set(
      inst.expense_id,
      (installmentAmountByExpense.get(inst.expense_id) || 0) + inst.amount
    );
  });

  // Fetch splits for all relevant expenses
  const allExpenseIds = [
    ...regularExpenses.map((e: any) => e.id),
    ...installmentExpenseIds.filter((id: string) => installmentAmountByExpense.has(id)),
  ];

  const { data: mySplits = [] } = useQuery({
    queryKey: ["expense-splits-totals", userId, allExpenseIds],
    queryFn: async () => {
      if (allExpenseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("expense_splits")
        .select("expense_id, amount")
        .eq("user_id", userId!)
        .in("expense_id", allExpenseIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && allExpenseIds.length > 0,
  });

  const mySplitMap = new Map<string, number>();
  mySplits.forEach((s: any) => mySplitMap.set(s.expense_id, s.amount));

  let total = 0;
  const byType: Record<string, number> = { fixed: 0, variable: 0, event: 0, other: 0 };

  // Regular expenses: use full amount (or split)
  for (const exp of regularExpenses) {
    const myPart = exp.split_mode !== "none" && mySplitMap.has(exp.id)
      ? mySplitMap.get(exp.id)!
      : exp.amount;
    total += myPart;
    byType[exp.category_type] = (byType[exp.category_type] || 0) + myPart;
  }

  // Installment expenses: use only the installments due in the period
  for (const exp of installmentExpenses) {
    const periodAmount = installmentAmountByExpense.get(exp.id);
    if (!periodAmount) continue;

    // If split, proportionally adjust
    let myPart = periodAmount;
    if (exp.split_mode !== "none" && mySplitMap.has(exp.id)) {
      const splitRatio = mySplitMap.get(exp.id)! / exp.amount;
      myPart = periodAmount * splitRatio;
    }

    total += myPart;
    byType[exp.category_type] = (byType[exp.category_type] || 0) + myPart;
  }

  return { total, byType };
}
