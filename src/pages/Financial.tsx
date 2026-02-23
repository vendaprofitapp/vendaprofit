import { useState, useMemo } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { DollarSign, TrendingUp, Wallet, Building2, Package, PieChart, Calendar, Receipt } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { useDeferredRevenueInPeriod } from "@/hooks/useDeferredPaidAmounts";
import { useConsortiumPaymentsInPeriod } from "@/hooks/useConsortiumPaymentsInPeriod";
import { ptBR } from "date-fns/locale";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ExpenseSummaryCards, useExpenseTotals } from "@/components/financial/ExpenseSummaryCards";
import { ExpensesList } from "@/components/financial/ExpensesList";
import { DREReport } from "@/components/financial/DREReport";

interface FinancialSplit {
  id: string;
  sale_id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "year", label: "Este Ano" },
  { value: "all", label: "Todo Período" },
];

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b"];

export default function Financial() {
  const { user } = useAuth();
  const [period, setPeriod] = useFormPersistence("financial_period", "month");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: new Date(2020, 0, 1), end: now };
    }
  }, [period]);

  // Fetch financial splits for current user
  const { data: receivedSplits = [] } = useQuery({
    queryKey: ["financial-splits-received", user?.id, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_splits")
        .select("*")
        .eq("user_id", user?.id)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data as FinancialSplit[];
    },
    enabled: !!user,
  });

  const { data: allSplits = [] } = useQuery({
    queryKey: ["financial-splits-all", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_splits")
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data as FinancialSplit[];
    },
    enabled: !!user,
  });

  const { data: myProducts = [] } = useQuery({
    queryKey: ["my-products-financial", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, owner_id")
        .eq("owner_id", user?.id)
        .eq("is_active", true)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: productPartnerships = [] } = useQuery({
    queryKey: ["product-partnerships-financial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Expense totals for overview
  const expenseTotals = useExpenseTotals(user?.id, dateRange);

  // Fetch completed sales revenue
  const { data: completedRevenueSales = [] } = useQuery({
    queryKey: ["revenue-completed", user?.id, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, status, total")
        .eq("owner_id", user?.id!)
        .eq("status", "completed")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch deferred revenue recognized in this period (by paid_at)
  const { deferredSaleIds: revenueDeferredIds, deferredSalesMap: revenueDeferredMap } = useDeferredRevenueInPeriod(user?.id, dateRange);

  // Consortium payments in period
  const { totalConsortiumRevenue } = useConsortiumPaymentsInPeriod(user?.id, dateRange);

  // Set of completed sale IDs for split adjustment
  const completedSaleIds = useMemo(() => new Set(completedRevenueSales.map((s: any) => s.id)), [completedRevenueSales]);

  const totalRevenue = useMemo(() => {
    const completedTotal = completedRevenueSales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
    let deferredTotal = 0;
    revenueDeferredMap.forEach(info => { deferredTotal += info.revenueInPeriod; });
    return completedTotal + deferredTotal + totalConsortiumRevenue;
  }, [completedRevenueSales, revenueDeferredMap, totalConsortiumRevenue]);

  // Calculate financial summary (regime de caixa: scale splits for pending sales)
  const financialSummary = useMemo(() => {
    let netProfit = 0;
    let costToRecover = 0;
    let payablesToPartners = 0;

    for (const split of receivedSplits) {
      let ratio = 1;
      if (!completedSaleIds.has(split.sale_id)) {
        const deferredInfo = revenueDeferredMap.get(split.sale_id);
        if (!deferredInfo) continue; // pending with no paid installments: skip
        ratio = deferredInfo.costRatioInPeriod;
      }
      if (split.type === 'profit_share') netProfit += split.amount * ratio;
      else if (split.type === 'group_commission') netProfit += split.amount * ratio;
      else if (split.type === 'cost_recovery') costToRecover += split.amount * ratio;
    }

    for (const split of allSplits) {
      if (split.user_id !== user?.id) {
        let ratio = 1;
        if (!completedSaleIds.has(split.sale_id)) {
          const deferredInfo = revenueDeferredMap.get(split.sale_id);
          if (!deferredInfo) continue;
          ratio = deferredInfo.costRatioInPeriod;
        }
        const isFromMyProduct = (split.description || '').includes('(dono)') ||
                                (split.description || '').includes('Comissão de grupo');
        if (isFromMyProduct) payablesToPartners += split.amount * ratio;
      }
    }

    const myProductIds = myProducts.map((p: any) => p.id);
    const sharedProductIds = productPartnerships
      .filter((pp: any) => myProductIds.includes(pp.product_id))
      .map((pp: any) => pp.product_id);
    const externalStockValue = myProducts
      .filter((p: any) => sharedProductIds.includes(p.id))
      .reduce((sum: number, p: any) => sum + (p.cost_price || 0), 0);

    return { netProfit, costToRecover, payablesToPartners, externalStockValue };
  }, [receivedSplits, allSplits, myProducts, productPartnerships, user?.id, completedSaleIds, revenueDeferredMap]);

  // Profit origin for pie chart (regime de caixa: scale for pending sales)
  const profitOrigin = useMemo(() => {
    let ownSales = 0, partnerships = 0, groupCommissions = 0;
    for (const split of receivedSplits) {
      let ratio = 1;
      if (!completedSaleIds.has(split.sale_id)) {
        const deferredInfo = revenueDeferredMap.get(split.sale_id);
        if (!deferredInfo) continue;
        ratio = deferredInfo.costRatioInPeriod;
      }
      const amount = split.amount * ratio;
      if (split.type === 'profit_share') {
        if ((split.description || '').includes('Lucro da venda')) ownSales += amount;
        else partnerships += amount;
      } else if (split.type === 'group_commission') {
        groupCommissions += amount;
      }
    }
    return { ownSales, partnerships, groupCommissions };
  }, [receivedSplits, completedSaleIds, revenueDeferredMap]);

  const pieChartData = useMemo(() => {
    const data = [];
    if (profitOrigin.ownSales > 0) data.push({ name: "Vendas Próprias", value: profitOrigin.ownSales, color: CHART_COLORS[0] });
    if (profitOrigin.partnerships > 0) data.push({ name: "Parcerias", value: profitOrigin.partnerships, color: CHART_COLORS[1] });
    if (profitOrigin.groupCommissions > 0) data.push({ name: "Comissões de Grupo", value: profitOrigin.groupCommissions, color: CHART_COLORS[2] });
    return data;
  }, [profitOrigin]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const totalProfit = profitOrigin.ownSales + profitOrigin.partnerships + profitOrigin.groupCommissions;
  const realNetProfit = totalProfit - expenseTotals.total;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground">Visão consolidada de lucros, custos e despesas</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="expenses">Despesas</TabsTrigger>
            <TabsTrigger value="dre">DRE</TabsTrigger>
          </TabsList>

          {/* Tab 1: Visão Geral */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards - Revenue */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                  <Wallet className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total de vendas</p>
                </CardContent>
              </Card>

              <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lucro de Vendas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(financialSummary.netProfit)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Lucro + comissões</p>
                </CardContent>
              </Card>

              <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-rose-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Despesas</CardTitle>
                  <Receipt className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(expenseTotals.total)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Custos operacionais</p>
                </CardContent>
              </Card>

              <Card className={`border-2 ${realNetProfit >= 0 ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-green-500/15" : "border-red-500/30 bg-gradient-to-br from-red-500/10 to-rose-500/15"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lucro Líquido Real</CardTitle>
                  <DollarSign className={`h-4 w-4 ${realNetProfit >= 0 ? "text-emerald-600" : "text-red-600"}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${realNetProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(realNetProfit)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Receitas - Despesas</p>
                </CardContent>
              </Card>

              <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
                  <Building2 className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{formatCurrency(financialSummary.payablesToPartners)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Para sócios/grupos</p>
                </CardContent>
              </Card>

              <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-violet-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Estoque Externo</CardTitle>
                  <Package className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(financialSummary.externalStockValue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Peças com parceiras</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    Origem do Lucro
                  </CardTitle>
                  <CardDescription>Distribuição por fonte de receita</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieChartData.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Nenhum dado de lucro no período
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Profit Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Detalhamento do Lucro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="font-medium">Vendas Próprias</span>
                    </div>
                    <p className="font-bold text-green-600">{formatCurrency(profitOrigin.ownSales)}</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <span className="font-medium">Parcerias</span>
                    </div>
                    <p className="font-bold text-blue-600">{formatCurrency(profitOrigin.partnerships)}</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-amber-500" />
                      <span className="font-medium">Comissões de Grupo</span>
                    </div>
                    <p className="font-bold text-amber-600">{formatCurrency(profitOrigin.groupCommissions)}</p>
                  </div>
                  <div className="pt-4 border-t flex items-center justify-between">
                    <span className="text-lg font-medium">Total de Lucro</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(totalProfit)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: Despesas */}
          <TabsContent value="expenses" className="space-y-6">
            <ExpenseSummaryCards dateRange={dateRange} />
            <ExpensesList dateRange={dateRange} />
          </TabsContent>

          {/* Tab 3: DRE */}
          <TabsContent value="dre" className="space-y-6">
            <DREReport dateRange={dateRange} />
          </TabsContent>
        </Tabs>

        {/* Period Info */}
        <div className="text-center text-sm text-muted-foreground">
          Período: {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} até {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
        </div>
      </div>
    </MainLayout>
  );
}
