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

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-summary", user?.id, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category_type, split_mode, id")
        .eq("owner_id", user?.id!)
        .gte("expense_date", dateRange.start.toISOString().split("T")[0])
        .lte("expense_date", dateRange.end.toISOString().split("T")[0]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch my actual splits
  const expenseIds = expenses.map((e: any) => e.id);
  const { data: mySplits = [] } = useQuery({
    queryKey: ["expense-splits-summary", user?.id, expenseIds],
    queryFn: async () => {
      if (expenseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("expense_splits")
        .select("expense_id, amount")
        .eq("user_id", user?.id!)
        .in("expense_id", expenseIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && expenseIds.length > 0,
  });

  const mySplitMap = new Map<string, number>();
  mySplits.forEach((s: any) => mySplitMap.set(s.expense_id, s.amount));

  // Calculate my actual expense portion
  let totalMyExpenses = 0;
  let fixedExpenses = 0;
  let variableExpenses = 0;
  let eventExpenses = 0;

  for (const exp of expenses) {
    const myPart = exp.split_mode !== "none" && mySplitMap.has(exp.id)
      ? mySplitMap.get(exp.id)!
      : exp.amount;

    totalMyExpenses += myPart;
    if (exp.category_type === "fixed") fixedExpenses += myPart;
    else if (exp.category_type === "variable") variableExpenses += myPart;
    else if (exp.category_type === "event") eventExpenses += myPart;
  }

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
            {formatCurrency(totalMyExpenses)}
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
            {formatCurrency(fixedExpenses)}
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
            {formatCurrency(variableExpenses)}
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
            {formatCurrency(eventExpenses)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Gasolina, alimentação, etc.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function useExpenseTotals(userId: string | undefined, dateRange: { start: Date; end: Date }) {
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-totals", userId, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category_type, split_mode, id")
        .eq("owner_id", userId!)
        .gte("expense_date", dateRange.start.toISOString().split("T")[0])
        .lte("expense_date", dateRange.end.toISOString().split("T")[0]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const expenseIds = expenses.map((e: any) => e.id);
  const { data: mySplits = [] } = useQuery({
    queryKey: ["expense-splits-totals", userId, expenseIds],
    queryFn: async () => {
      if (expenseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("expense_splits")
        .select("expense_id, amount")
        .eq("user_id", userId!)
        .in("expense_id", expenseIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && expenseIds.length > 0,
  });

  const mySplitMap = new Map<string, number>();
  mySplits.forEach((s: any) => mySplitMap.set(s.expense_id, s.amount));

  let total = 0;
  const byType: Record<string, number> = { fixed: 0, variable: 0, event: 0, other: 0 };

  for (const exp of expenses) {
    const myPart = exp.split_mode !== "none" && mySplitMap.has(exp.id)
      ? mySplitMap.get(exp.id)!
      : exp.amount;
    total += myPart;
    byType[exp.category_type] = (byType[exp.category_type] || 0) + myPart;
  }

  return { total, byType };
}
