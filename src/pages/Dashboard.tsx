import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentSales } from "@/components/dashboard/RecentSales";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { TopProducts } from "@/components/dashboard/TopProducts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";
import { startOfDay, startOfWeek, subDays, format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: sales = [] } = useQuery({
    queryKey: ['dashboard-sales', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['dashboard-products', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const metrics = useMemo(() => {
    const today = startOfDay(new Date());
    const yesterday = startOfDay(subDays(new Date(), 1));
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    // Vendas de hoje
    const todaySales = sales.filter(s => new Date(s.created_at) >= today);
    const todayTotal = todaySales.reduce((sum, s) => sum + Number(s.total), 0);

    // Vendas de ontem
    const yesterdaySales = sales.filter(s => {
      const date = new Date(s.created_at);
      return date >= yesterday && date < today;
    });
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + Number(s.total), 0);

    // Variação vs ontem
    const todayVsYesterday = yesterdayTotal > 0 
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal * 100).toFixed(0)
      : todayTotal > 0 ? 100 : 0;

    // Pedidos hoje
    const ordersToday = todaySales.length;
    const ordersYesterday = yesterdaySales.length;
    const newOrders = ordersToday - ordersYesterday;

    // Produtos em estoque
    const totalStock = products.reduce((sum, p) => sum + p.stock_quantity, 0);
    const lowStock = products.filter(p => p.stock_quantity <= p.min_stock_level).length;

    // Ticket médio (semana atual)
    const weekSales = sales.filter(s => new Date(s.created_at) >= weekStart);
    const weekTotal = weekSales.reduce((sum, s) => sum + Number(s.total), 0);
    const avgTicket = weekSales.length > 0 ? weekTotal / weekSales.length : 0;

    // Semana passada para comparação
    const lastWeekStart = subDays(weekStart, 7);
    const lastWeekSales = sales.filter(s => {
      const date = new Date(s.created_at);
      return date >= lastWeekStart && date < weekStart;
    });
    const lastWeekTotal = lastWeekSales.reduce((sum, s) => sum + Number(s.total), 0);
    const lastWeekAvg = lastWeekSales.length > 0 ? lastWeekTotal / lastWeekSales.length : 0;
    const ticketChange = lastWeekAvg > 0 
      ? ((avgTicket - lastWeekAvg) / lastWeekAvg * 100).toFixed(0) 
      : 0;

    return {
      todayTotal,
      todayVsYesterday: Number(todayVsYesterday),
      ordersToday,
      newOrders,
      totalStock,
      lowStock,
      avgTicket,
      ticketChange: Number(ticketChange),
    };
  }, [sales, products]);

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo de volta! Aqui está o resumo das suas operações.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Vendas Hoje"
          value={`R$ ${metrics.todayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          change={`${metrics.todayVsYesterday >= 0 ? '+' : ''}${metrics.todayVsYesterday}% vs ontem`}
          changeType={metrics.todayVsYesterday >= 0 ? "positive" : "negative"}
          icon={DollarSign}
          iconColor="bg-success/10 text-success"
        />
        <MetricCard
          title="Pedidos Hoje"
          value={metrics.ordersToday.toString()}
          change={`${metrics.newOrders >= 0 ? '+' : ''}${metrics.newOrders} vs ontem`}
          changeType={metrics.newOrders >= 0 ? "positive" : "negative"}
          icon={ShoppingCart}
          iconColor="bg-primary/10 text-primary"
        />
        <MetricCard
          title="Produtos em Estoque"
          value={metrics.totalStock.toLocaleString('pt-BR')}
          change={`${metrics.lowStock} baixo estoque`}
          changeType={metrics.lowStock > 0 ? "negative" : "neutral"}
          icon={Package}
          iconColor="bg-warning/10 text-warning"
        />
        <MetricCard
          title="Ticket Médio"
          value={`R$ ${metrics.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          change={`${metrics.ticketChange >= 0 ? '+' : ''}${metrics.ticketChange}% esta semana`}
          changeType={metrics.ticketChange >= 0 ? "positive" : "negative"}
          icon={TrendingUp}
          iconColor="bg-primary/10 text-primary"
        />
      </div>

      {/* Charts & Lists Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart sales={sales} />
        </div>
        <div>
          <LowStockAlert products={products} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <RecentSales sales={sales} />
        <TopProducts sales={sales} />
      </div>
    </MainLayout>
  );
}
