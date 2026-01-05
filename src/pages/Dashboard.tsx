import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentSales } from "@/components/dashboard/RecentSales";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { TopProducts } from "@/components/dashboard/TopProducts";

export default function Dashboard() {
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
          value="R$ 4.850"
          change="+12% vs ontem"
          changeType="positive"
          icon={DollarSign}
          iconColor="bg-success/10 text-success"
        />
        <MetricCard
          title="Pedidos"
          value="48"
          change="+8 novos"
          changeType="positive"
          icon={ShoppingCart}
          iconColor="bg-primary/10 text-primary"
        />
        <MetricCard
          title="Produtos em Estoque"
          value="1,248"
          change="15 baixo estoque"
          changeType="negative"
          icon={Package}
          iconColor="bg-warning/10 text-warning"
        />
        <MetricCard
          title="Ticket Médio"
          value="R$ 156"
          change="+5% esta semana"
          changeType="positive"
          icon={TrendingUp}
          iconColor="bg-primary/10 text-primary"
        />
      </div>

      {/* Charts & Lists Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <div>
          <LowStockAlert />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <RecentSales />
        <TopProducts />
      </div>
    </MainLayout>
  );
}
