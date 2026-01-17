import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, Wallet, Building2, Package, PieChart, Calendar } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ptBR } from "date-fns/locale";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface FinancialSplit {
  id: string;
  sale_id: string;
  user_id: string;
  amount: number;
  type: 'cost_recovery' | 'profit_share' | 'group_commission';
  description: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number | null;
  owner_id: string;
}

interface ProductPartnership {
  id: string;
  product_id: string;
  group_id: string;
}

interface GroupMember {
  group_id: string;
  user_id: string;
}

interface FinancialSummary {
  netProfit: number;           // Lucro Líquido Real
  costToRecover: number;       // Custo a Recuperar
  payablesToPartners: number;  // Contas a Pagar
  externalStockValue: number;  // Valor em Estoque Externo
}

interface ProfitOrigin {
  ownSales: number;
  partnerships: number;
  groupCommissions: number;
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
  const [period, setPeriod] = useState("month");

  // Calculate date range based on period
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

  // Fetch financial splits for current user (received)
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

  // Fetch all financial splits (to calculate payables)
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

  // Fetch user's products
  const { data: myProducts = [] } = useQuery({
    queryKey: ["my-products-financial", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, owner_id")
        .eq("owner_id", user?.id)
        .eq("is_active", true);
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Fetch product partnerships
  const { data: productPartnerships = [] } = useQuery({
    queryKey: ["product-partnerships-financial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("*");
      if (error) throw error;
      return data as ProductPartnership[];
    },
    enabled: !!user,
  });

  // Fetch group members
  const { data: groupMembers = [] } = useQuery({
    queryKey: ["group-members-financial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, user_id");
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!user,
  });

  // Calculate financial summary
  const financialSummary = useMemo<FinancialSummary>(() => {
    let netProfit = 0;
    let costToRecover = 0;
    let payablesToPartners = 0;

    // Calculate net profit from received splits
    for (const split of receivedSplits) {
      if (split.type === 'profit_share') {
        netProfit += split.amount;
      } else if (split.type === 'group_commission') {
        netProfit += split.amount;
      } else if (split.type === 'cost_recovery') {
        costToRecover += split.amount;
      }
    }

    // Calculate payables (splits for other users from sales I made)
    // These are splits where I'm NOT the recipient but the sale was from my products
    for (const split of allSplits) {
      if (split.user_id !== user?.id) {
        // Check if this split is from a product I own
        const isFromMyProduct = split.description.includes('(dono)') || 
                                split.description.includes('Comissão de grupo');
        if (isFromMyProduct) {
          payablesToPartners += split.amount;
        }
      }
    }

    // Calculate external stock value (cost of my products shared with groups)
    const myProductIds = myProducts.map(p => p.id);
    const sharedProductIds = productPartnerships
      .filter(pp => myProductIds.includes(pp.product_id))
      .map(pp => pp.product_id);
    
    const externalStockValue = myProducts
      .filter(p => sharedProductIds.includes(p.id))
      .reduce((sum, p) => sum + (p.cost_price || p.price * 0.5), 0);

    return {
      netProfit,
      costToRecover,
      payablesToPartners,
      externalStockValue,
    };
  }, [receivedSplits, allSplits, myProducts, productPartnerships, user?.id]);

  // Calculate profit origin for pie chart
  const profitOrigin = useMemo<ProfitOrigin>(() => {
    let ownSales = 0;
    let partnerships = 0;
    let groupCommissions = 0;

    for (const split of receivedSplits) {
      if (split.type === 'profit_share') {
        if (split.description.includes('Lucro da venda')) {
          ownSales += split.amount;
        } else {
          partnerships += split.amount;
        }
      } else if (split.type === 'group_commission') {
        groupCommissions += split.amount;
      }
    }

    return { ownSales, partnerships, groupCommissions };
  }, [receivedSplits]);

  // Prepare pie chart data
  const pieChartData = useMemo(() => {
    const data = [];
    if (profitOrigin.ownSales > 0) {
      data.push({ name: "Vendas Próprias", value: profitOrigin.ownSales, color: CHART_COLORS[0] });
    }
    if (profitOrigin.partnerships > 0) {
      data.push({ name: "Parcerias", value: profitOrigin.partnerships, color: CHART_COLORS[1] });
    }
    if (profitOrigin.groupCommissions > 0) {
      data.push({ name: "Comissões de Grupo", value: profitOrigin.groupCommissions, color: CHART_COLORS[2] });
    }
    return data;
  }, [profitOrigin]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalProfit = profitOrigin.ownSales + profitOrigin.partnerships + profitOrigin.groupCommissions;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground">
              Visão consolidada de lucros, custos e contas
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Lucro Líquido Real */}
          <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Líquido Real</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(financialSummary.netProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lucro + comissões recebidas
              </p>
            </CardContent>
          </Card>

          {/* Custo a Recuperar */}
          <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo a Recuperar</CardTitle>
              <Wallet className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(financialSummary.costToRecover)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Recuperação das suas peças
              </p>
            </CardContent>
          </Card>

          {/* Contas a Pagar */}
          <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
              <Building2 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(financialSummary.payablesToPartners)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                A transferir para sócios/grupos
              </p>
            </CardContent>
          </Card>

          {/* Valor em Estoque Externo */}
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-violet-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Externo</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(financialSummary.externalStockValue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Suas peças com parceiras
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Profit Origin Chart */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Origem do Lucro
              </CardTitle>
              <CardDescription>
                Distribuição por fonte de receita
              </CardDescription>
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
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado de lucro no período selecionado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Detalhamento do Lucro
              </CardTitle>
              <CardDescription>
                Valores por categoria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="font-medium">Vendas Próprias</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(profitOrigin.ownSales)}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalProfit > 0 ? ((profitOrigin.ownSales / totalProfit) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="font-medium">Parcerias</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{formatCurrency(profitOrigin.partnerships)}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalProfit > 0 ? ((profitOrigin.partnerships / totalProfit) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="font-medium">Comissões de Grupo</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-600">{formatCurrency(profitOrigin.groupCommissions)}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalProfit > 0 ? ((profitOrigin.groupCommissions / totalProfit) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium">Total de Lucro</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(totalProfit)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period Info */}
        <div className="text-center text-sm text-muted-foreground">
          Período: {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} até {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
        </div>
      </div>
    </MainLayout>
  );
}
