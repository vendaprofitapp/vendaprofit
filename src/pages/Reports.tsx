import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Download, Filter, X, Percent, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const COLORS = ["hsl(15, 90%, 55%)", "hsl(25, 95%, 60%)", "hsl(145, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(220, 10%, 50%)", "hsl(280, 60%, 55%)", "hsl(190, 70%, 45%)"];

const paymentMethodsLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  credito_1x: "Crédito 1x",
  credito_2x: "Crédito 2x",
  credito_3x: "Crédito 3x",
  credito_4x: "Crédito 4x",
  credito_5x: "Crédito 5x",
  credito_6x: "Crédito 6x",
  credito_8x: "Crédito 8x",
  credito_10x: "Crédito 10x",
  credito_12x: "Crédito 12x",
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
  cost_price: number | null;
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

interface PaymentFee {
  payment_method: string;
  fee_percent: number;
}

export default function Reports() {
  const { user } = useAuth();
  
  // Filter states
  const [period, setPeriod] = useState("month");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [stockTypeFilter, setStockTypeFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [discountFilter, setDiscountFilter] = useState("all");

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

  // Fetch products for category/color/cost info
  const { data: products = [] } = useQuery({
    queryKey: ["products-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, color, cost_price, owner_id, group_id");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Fetch payment fees
  const { data: paymentFees = [] } = useQuery({
    queryKey: ["payment-fees-report", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_fees")
        .select("payment_method, fee_percent")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data as PaymentFee[];
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

  // Create payment fees map
  const feesMap = useMemo(() => {
    const map = new Map<string, number>();
    paymentFees.forEach(f => map.set(f.payment_method, f.fee_percent));
    return map;
  }, [paymentFees]);

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
    
    const uniquePartners = Array.from(
      new Map(partnerList.map(p => [p.groupId, p])).values()
    );
    return uniquePartners;
  }, [groupMembers, user?.id]);

  // Filter sales based on all criteria
  const filteredSales = useMemo(() => {
    return salesData.filter(sale => {
      if (paymentMethodFilter !== "all" && sale.payment_method !== paymentMethodFilter) {
        return false;
      }

      if (discountFilter === "with_discount" && (!sale.discount_amount || sale.discount_amount <= 0)) {
        return false;
      }
      if (discountFilter === "no_discount" && sale.discount_amount && sale.discount_amount > 0) {
        return false;
      }

      if (stockTypeFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        
        if (stockTypeFilter === "own") {
          const hasOwnStock = saleItemProducts.some(p => p && p.owner_id === user?.id && !p.group_id);
          if (!hasOwnStock) return false;
        } else if (stockTypeFilter === "partner") {
          const hasPartnerStock = saleItemProducts.some(p => p && p.group_id);
          if (!hasPartnerStock) return false;
          
          if (partnerFilter !== "all") {
            const hasSpecificPartner = saleItemProducts.some(p => p && p.group_id === partnerFilter);
            if (!hasSpecificPartner) return false;
          }
        }
      }

      if (categoryFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        const hasCategory = saleItemProducts.some(p => p && p.category === categoryFilter);
        if (!hasCategory) return false;
      }

      if (colorFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        const hasColor = saleItemProducts.some(p => p && p.color === colorFilter);
        if (!hasColor) return false;
      }

      return true;
    });
  }, [salesData, paymentMethodFilter, discountFilter, stockTypeFilter, partnerFilter, categoryFilter, colorFilter, productMap, user?.id]);

  // Detailed sales data for table
  const detailedSalesData = useMemo(() => {
    return filteredSales.flatMap(sale => {
      const feePercent = feesMap.get(sale.payment_method) || 0;
      
      return sale.sale_items.map(item => {
        const product = productMap.get(item.product_id);
        const costPrice = product?.cost_price || 0;
        const totalCost = costPrice * item.quantity;
        const totalSale = item.total;
        const grossProfit = totalSale - totalCost;
        const feeAmount = (totalSale * feePercent) / 100;
        const realProfit = grossProfit - feeAmount;

        return {
          saleId: sale.id,
          date: sale.created_at,
          customer: sale.customer_name || "Não informado",
          productName: item.product_name,
          quantity: item.quantity,
          totalCost,
          totalSale,
          grossProfit,
          feePercent,
          feeAmount,
          realProfit,
          paymentMethod: sale.payment_method,
        };
      });
    });
  }, [filteredSales, productMap, feesMap]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalSales = filteredSales.length;
    const totalItems = filteredSales.reduce((sum, sale) => 
      sum + sale.sale_items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const totalDiscount = filteredSales.reduce((sum, sale) => sum + (sale.discount_amount || 0), 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const uniqueCustomers = new Set(filteredSales.filter(s => s.customer_name).map(s => s.customer_name)).size;

    // Calculate totals from detailed data
    const totalCost = detailedSalesData.reduce((sum, d) => sum + d.totalCost, 0);
    const totalGrossProfit = detailedSalesData.reduce((sum, d) => sum + d.grossProfit, 0);
    const totalFees = detailedSalesData.reduce((sum, d) => sum + d.feeAmount, 0);
    const totalRealProfit = detailedSalesData.reduce((sum, d) => sum + d.realProfit, 0);

    return { totalRevenue, totalSales, totalItems, totalDiscount, avgTicket, uniqueCustomers, totalCost, totalGrossProfit, totalFees, totalRealProfit };
  }, [filteredSales, detailedSalesData]);

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

  // Export to CSV
  const handleExport = () => {
    if (detailedSalesData.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const headers = [
      "Data",
      "Cliente",
      "Produto",
      "Quantidade",
      "Preço de Custo Total",
      "Preço de Venda Total",
      "Lucro Bruto",
      "Taxa (%)",
      "Valor da Taxa",
      "Lucro Real",
      "Forma de Pagamento"
    ];

    const rows = detailedSalesData.map(d => [
      format(parseISO(d.date), "dd/MM/yyyy HH:mm"),
      d.customer,
      d.productName,
      d.quantity,
      d.totalCost.toFixed(2).replace(".", ","),
      d.totalSale.toFixed(2).replace(".", ","),
      d.grossProfit.toFixed(2).replace(".", ","),
      d.feePercent.toFixed(2).replace(".", ","),
      d.feeAmount.toFixed(2).replace(".", ","),
      d.realProfit.toFixed(2).replace(".", ","),
      paymentMethodsLabels[d.paymentMethod] || d.paymentMethod
    ]);

    // Add totals row
    rows.push([
      "TOTAIS",
      "",
      "",
      detailedSalesData.reduce((s, d) => s + d.quantity, 0).toString(),
      stats.totalCost.toFixed(2).replace(".", ","),
      stats.totalRevenue.toFixed(2).replace(".", ","),
      stats.totalGrossProfit.toFixed(2).replace(".", ","),
      "",
      stats.totalFees.toFixed(2).replace(".", ","),
      stats.totalRealProfit.toFixed(2).replace(".", ","),
      ""
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.join(";"))
    ].join("\n");

    // Add BOM for Excel UTF-8 compatibility
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-vendas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Relatório exportado com sucesso!");
  };

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada do seu negócio</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleExport}>
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
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 mb-6">
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Custo Total</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Lucro Bruto</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.totalGrossProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Percent className="h-3 w-3" /> Taxas Descontadas
          </p>
          <p className="text-2xl font-bold text-destructive">
            R$ {stats.totalFees.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Lucro Real</p>
          <p className="text-2xl font-bold text-green-600">
            R$ {stats.totalRealProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
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
            <Users className="h-3 w-3" /> Clientes Únicos
          </p>
          <p className="text-2xl font-bold text-foreground">{stats.uniqueCustomers}</p>
        </div>
      </div>

      {/* Detailed Sales Table */}
      <div className="rounded-xl bg-card p-6 shadow-soft mb-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Detalhamento das Vendas</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
                <TableHead className="text-right">Venda Total</TableHead>
                <TableHead className="text-right">Lucro Bruto</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Lucro Real</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : detailedSalesData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda encontrada no período
                  </TableCell>
                </TableRow>
              ) : (
                detailedSalesData.slice(0, 50).map((item, index) => (
                  <TableRow key={`${item.saleId}-${index}`}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(item.date), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{item.customer}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.productName}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      R$ {item.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      R$ {item.totalSale.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      R$ {item.grossProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-destructive">
                      {item.feePercent > 0 ? `${item.feePercent}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium text-green-600">
                      R$ {item.realProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {detailedSalesData.length > 50 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Mostrando 50 de {detailedSalesData.length} registros. Exporte para ver todos.
            </p>
          )}
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
