import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Filter, X, Percent, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, subWeeks, subMonths, subYears, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["hsl(15, 90%, 55%)", "hsl(25, 95%, 60%)", "hsl(145, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(220, 10%, 50%)", "hsl(280, 60%, 55%)", "hsl(190, 70%, 45%)"];

const paymentMethodsLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  boleto: "Boleto",
};

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "year", label: "Este Ano" },
  { value: "last7days", label: "Últimos 7 dias" },
  { value: "last30days", label: "Últimos 30 dias" },
  { value: "last12months", label: "Últimos 12 meses" },
];

interface SaleWithItems {
  id: string;
  customer_name: string | null;
  payment_method: string;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  total: number;
  status: string;
  created_at: string;
  owner_id: string;
  sale_items: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  color: string | null;
  owner_id: string;
  group_id: string | null;
}

interface GroupMember {
  group_id: string;
  user_id: string;
  groups: {
    id: string;
    name: string;
    created_by: string;
  };
}

export default function Reports() {
  const { user } = useAuth();
  
  // Filter states
  const [period, setPeriod] = useState("month");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [stockTypeFilter, setStockTypeFilter] = useState("all"); // own, partner, all
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [discountFilter, setDiscountFilter] = useState("all"); // all, with_discount, no_discount

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end = endOfDay(now);

    switch (period) {
      case "today":
        start = startOfDay(now);
        break;
      case "week":
        start = startOfWeek(now, { weekStartsOn: 0 });
        break;
      case "month":
        start = startOfMonth(now);
        break;
      case "year":
        start = startOfYear(now);
        break;
      case "last7days":
        start = subDays(now, 7);
        break;
      case "last30days":
        start = subDays(now, 30);
        break;
      case "last12months":
        start = subMonths(now, 12);
        break;
      default:
        start = startOfMonth(now);
    }

    return { start, end };
  }, [period]);

  // Fetch sales with items
  const { data: salesData = [], isLoading: salesLoading } = useQuery({
    queryKey: ["sales-report", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SaleWithItems[];
    },
    enabled: !!user,
  });

  // Fetch products for category/color info
  const { data: products = [] } = useQuery({
    queryKey: ["products-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, color, owner_id, group_id");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Fetch groups for partner info
  const { data: groupMembers = [] } = useQuery({
    queryKey: ["group-members-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          group_id,
          user_id,
          groups (
            id,
            name,
            created_by
          )
        `);
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!user,
  });

  // Create product map for quick lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Get unique categories and colors from products
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

  const colors = useMemo(() => {
    const cols = [...new Set(products.map(p => p.color).filter(Boolean))] as string[];
    return cols.sort();
  }, [products]);

  // Get partners (groups where user is member)
  const partners = useMemo(() => {
    const partnerList = groupMembers
      .filter(gm => gm.groups && gm.groups.created_by !== user?.id)
      .map(gm => ({
        id: gm.groups.created_by,
        name: gm.groups.name,
        groupId: gm.group_id,
      }));
    
    // Deduplicate by groupId
    const uniquePartners = Array.from(
      new Map(partnerList.map(p => [p.groupId, p])).values()
    );
    return uniquePartners;
  }, [groupMembers, user?.id]);

  // Filter sales based on all criteria
  const filteredSales = useMemo(() => {
    return salesData.filter(sale => {
      // Payment method filter
      if (paymentMethodFilter !== "all" && sale.payment_method !== paymentMethodFilter) {
        return false;
      }

      // Discount filter
      if (discountFilter === "with_discount" && (!sale.discount_amount || sale.discount_amount <= 0)) {
        return false;
      }
      if (discountFilter === "no_discount" && sale.discount_amount && sale.discount_amount > 0) {
        return false;
      }

      // Stock type filter (own vs partner)
      if (stockTypeFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        
        if (stockTypeFilter === "own") {
          // All items must be from own stock
          const hasOwnStock = saleItemProducts.some(p => p && p.owner_id === user?.id && !p.group_id);
          if (!hasOwnStock) return false;
        } else if (stockTypeFilter === "partner") {
          // At least one item from partner stock
          const hasPartnerStock = saleItemProducts.some(p => p && p.group_id);
          if (!hasPartnerStock) return false;
          
          // Filter by specific partner if selected
          if (partnerFilter !== "all") {
            const hasSpecificPartner = saleItemProducts.some(p => p && p.group_id === partnerFilter);
            if (!hasSpecificPartner) return false;
          }
        }
      }

      // Category filter
      if (categoryFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        const hasCategory = saleItemProducts.some(p => p && p.category === categoryFilter);
        if (!hasCategory) return false;
      }

      // Color filter
      if (colorFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        const hasColor = saleItemProducts.some(p => p && p.color === colorFilter);
        if (!hasColor) return false;
      }

      return true;
    });
  }, [salesData, paymentMethodFilter, discountFilter, stockTypeFilter, partnerFilter, categoryFilter, colorFilter, productMap, user?.id]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalSales = filteredSales.length;
    const totalItems = filteredSales.reduce((sum, sale) => 
      sum + sale.sale_items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const totalDiscount = filteredSales.reduce((sum, sale) => sum + (sale.discount_amount || 0), 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Unique customers
    const uniqueCustomers = new Set(filteredSales.filter(s => s.customer_name).map(s => s.customer_name)).size;

    return { totalRevenue, totalSales, totalItems, totalDiscount, avgTicket, uniqueCustomers };
  }, [filteredSales]);

  // Chart data: Sales over time
  const salesOverTime = useMemo(() => {
    const groupedData: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      const date = parseISO(sale.created_at);
      let key: string;
      
      if (period === "today") {
        key = format(date, "HH:00");
      } else if (period === "week" || period === "last7days") {
        key = format(date, "EEE", { locale: ptBR });
      } else if (period === "month" || period === "last30days") {
        key = format(date, "dd/MM");
      } else {
        key = format(date, "MMM", { locale: ptBR });
      }
      
      groupedData[key] = (groupedData[key] || 0) + sale.total;
    });

    return Object.entries(groupedData).map(([name, vendas]) => ({ name, vendas }));
  }, [filteredSales, period]);

  // Chart data: Sales by category
  const salesByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      sale.sale_items.forEach(item => {
        const product = productMap.get(item.product_id);
        const category = product?.category || "Outros";
        categoryTotals[category] = (categoryTotals[category] || 0) + item.total;
      });
    });

    const total = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
    
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value: total > 0 ? Math.round((value / total) * 100) : 0,
        total: value,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filteredSales, productMap]);

  // Chart data: Sales by payment method
  const salesByPayment = useMemo(() => {
    const paymentTotals: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      const method = sale.payment_method;
      paymentTotals[method] = (paymentTotals[method] || 0) + sale.total;
    });

    return Object.entries(paymentTotals)
      .map(([method, total]) => ({
        name: paymentMethodsLabels[method] || method,
        value: total,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Chart data: Sales by color
  const salesByColor = useMemo(() => {
    const colorTotals: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      sale.sale_items.forEach(item => {
        const product = productMap.get(item.product_id);
        const color = product?.color || "Sem cor";
        colorTotals[color] = (colorTotals[color] || 0) + item.quantity;
      });
    });

    return Object.entries(colorTotals)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [filteredSales, productMap]);

  const clearFilters = () => {
    setPeriod("month");
    setPaymentMethodFilter("all");
    setStockTypeFilter("all");
    setPartnerFilter("all");
    setCategoryFilter("all");
    setColorFilter("all");
    setDiscountFilter("all");
  };

  const activeFiltersCount = [
    paymentMethodFilter !== "all",
    stockTypeFilter !== "all",
    categoryFilter !== "all",
    colorFilter !== "all",
    discountFilter !== "all",
  ].filter(Boolean).length;

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada do seu negócio</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="rounded-xl bg-card p-4 shadow-soft mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-card-foreground">Filtros</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">{activeFiltersCount} ativos</Badge>
          )}
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Period Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Período</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pagamento</label>
            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(paymentMethodsLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Type Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo de Estoque</label>
            <Select value={stockTypeFilter} onValueChange={(v) => {
              setStockTypeFilter(v);
              if (v !== "partner") setPartnerFilter("all");
            }}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="own">Estoque Próprio</SelectItem>
                <SelectItem value="partner">Estoque Parceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Partner Filter (visible when stockTypeFilter === "partner") */}
          {stockTypeFilter === "partner" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Parceiro</label>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Parceiros</SelectItem>
                  {partners.map(p => (
                    <SelectItem key={p.groupId} value={p.groupId}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
            <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {colors.map(color => (
                  <SelectItem key={color} value={color}>{color}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Discount Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Desconto</label>
            <Select value={discountFilter} onValueChange={setDiscountFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="with_discount">Com Desconto</SelectItem>
                <SelectItem value="no_discount">Sem Desconto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Total de Vendas</p>
          <p className="text-2xl font-bold text-foreground">{stats.totalSales}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Itens Vendidos</p>
          <p className="text-2xl font-bold text-foreground">{stats.totalItems}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.avgTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Percent className="h-3 w-3" /> Total em Descontos
          </p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.totalDiscount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Clientes Únicos
          </p>
          <p className="text-2xl font-bold text-foreground">{stats.uniqueCustomers}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Sales Over Time Chart */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Vendas no Período</h3>
          <div className="h-72">
            {salesOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(1)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Vendas"]}
                  />
                  <Bar dataKey="vendas" fill="hsl(15, 90%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhuma venda encontrada no período
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Vendas por Categoria</h3>
          <div className="h-72 flex items-center">
            {salesByCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {salesByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `R$ ${props.payload.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${value}%)`,
                        props.payload.name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 pl-4 flex-1">
                  {salesByCategory.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-muted-foreground truncate">{item.name}</span>
                      <span className="text-sm font-medium ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Chart */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Vendas por Forma de Pagamento</h3>
          <div className="h-72">
            {salesByPayment.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByPayment} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(1)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Total"]}
                  />
                  <Bar dataKey="value" fill="hsl(145, 65%, 42%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Sales by Color */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Peças Vendidas por Cor</h3>
          <div className="h-72">
            {salesByColor.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByColor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value} unidades`, "Quantidade"]}
                  />
                  <Bar dataKey="quantity" fill="hsl(280, 60%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
