import { DollarSign, Package, ShoppingCart, TrendingUp, Store } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentSales } from "@/components/dashboard/RecentSales";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { TopProducts } from "@/components/dashboard/TopProducts";
import { SystemAlerts } from "@/components/dashboard/SystemAlerts";
import { EventDraftsBanner } from "@/components/dashboard/EventDraftsBanner";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useMemo, useState } from "react";
import { startOfDay, startOfWeek, subDays } from "date-fns";


export default function Dashboard() {
  const { user } = useAuth();
  const { isTrial, onboardingCompleted, plan, refetch: refetchPlan } = usePlan();

  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`onboarding_dismissed_${user?.id}`) === 'true'
  );

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['onboarding-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_name, phone, origin_zip, cpf')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: storeSettings } = useQuery({
    queryKey: ['onboarding-store', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('id')
        .eq('owner_id', user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Show onboarding for paid plans that haven't completed it yet
  const needsOnboarding = !!profile && (!profile.store_name || !profile.phone || !profile.origin_zip);
  const showOnboardingForPaidPlan = !isTrial && !onboardingCompleted && !!plan;
  const showOnboarding = (needsOnboarding && !dismissed && !storeSettings) || showOnboardingForPaidPlan;

  const handleOnboardingComplete = async () => {
    await refetchProfile();
    // Mark onboarding_completed in user_subscriptions
    if (plan && showOnboardingForPaidPlan) {
      await supabase.from("user_subscriptions").update({ onboarding_completed: true }).eq("id", plan.id);
      refetchPlan();
    }
  };


  const { data: sales = [] } = useQuery({
    queryKey: ['dashboard-sales', user?.id],
    queryFn: async () => {
      // Filtrar apenas últimos 30 dias para não engasgar com histórico total
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('owner_id', user?.id)
        .gte('created_at', thirtyDaysAgo)
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
        .eq('owner_id', user?.id)
        .limit(5000);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: hubCommissions = [] } = useQuery({
    queryKey: ['dashboard-hub-commissions', user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('hub_sale_splits')
        .select('commission_amount, owner_amount, seller_amount, created_at')
        .eq('seller_id', user?.id)
        .gte('created_at', thirtyDaysAgo);
      return data ?? [];
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

    // HUB commissions (last 30 days)
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentHubCommissions = hubCommissions.filter(
      h => new Date(h.created_at) >= thirtyDaysAgo
    );
    const hubCommissionsTotal = recentHubCommissions.reduce(
      (sum, h) => sum + Number(h.commission_amount), 0
    );

    return {
      todayTotal,
      todayVsYesterday: Number(todayVsYesterday),
      ordersToday,
      newOrders,
      totalStock,
      lowStock,
      avgTicket,
      ticketChange: Number(ticketChange),
      hubCommissionsTotal,
    };
  }, [sales, products, hubCommissions]);

  return (
    <MainLayout>
      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={showOnboarding}
        existingProfile={profile}
        onComplete={handleOnboardingComplete}
        onDismiss={() => {
          localStorage.setItem(`onboarding_dismissed_${user?.id}`, 'true');
          setDismissed(true);
        }}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo de volta! Aqui está o resumo das suas operações.</p>
      </div>

      {/* System Alerts */}
      <SystemAlerts />

      {/* Event Drafts Banner */}
      <EventDraftsBanner />

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

      {/* HUB Commissions Alert */}
      {metrics.hubCommissionsTotal > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <Store className="h-5 w-5 text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Comissões a Pagar (HUB) — últimos 30 dias</p>
            <p className="text-xs text-muted-foreground">Valor retido para parceiros donos de peças vendidas pelo HUB</p>
          </div>
          <p className="text-lg font-bold text-warning shrink-0">
            {metrics.hubCommissionsTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      )}

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
