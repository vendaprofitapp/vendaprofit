import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear,
  parseISO, isValid, eachDayOfInterval
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, TrendingDown, ShoppingBag, Package, CreditCard, Truck,
  Building2, ChevronDown, X, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Canal de Venda options ───────────────────────────────────────────────────
const SALE_SOURCE_OPTIONS = [
  { value: "manual", label: "Venda Direta" },
  { value: "catalog", label: "Minha Loja" },
  { value: "event", label: "Evento" },
  { value: "b2b", label: "B2B / Atacado" },
  { value: "bazar", label: "Bazar VIP" },
  { value: "consignment", label: "Consignação" },
  { value: "instagram", label: "Instagram" },
  { value: "partner_point", label: "Ponto Parceiro" },
  { value: "consortium", label: "Consórcio" },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface SaleItem {
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Sale {
  id: string;
  total: number;
  subtotal: number | null;
  discount_amount: number | null;
  shipping_cost: number | null;
  shipping_payer: string | null;
  payment_method: string;
  created_at: string;
  customer_name: string | null;
  sale_source: string | null;
  sale_items: SaleItem[];
}

interface ProductCost {
  id: string;
  cost_price: number | null;
}

interface CustomPaymentMethod {
  name: string;
  fee_percent: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HARDCODED_FEES: Record<string, number> = {
  credito_1x: 2.5,
  credito_2x: 3.5,
  credito_3x: 4.5,
  credito_4x: 5.5,
  credito_5x: 6.5,
  credito_6x: 7.5,
  credito_8x: 9.5,
  credito_10x: 11.0,
  credito_12x: 13.0,
  debito: 1.5,
  credito: 2.5,
  boleto: 1.9,
  pix: 0,
  dinheiro: 0,
};

function safeParseDate(s: string): Date | null {
  try {
    const d = parseISO(s);
    if (isValid(d)) return d;
    const d2 = new Date(s);
    if (isValid(d2)) return d2;
  } catch { /* empty */ }
  return null;
}

function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Period presets ──────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "year", label: "Este Ano" },
  { value: "custom", label: "Personalizado" },
];

function buildDateRange(period: string, customStart: string, customEnd: string) {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfDay(now) };
    case "month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "year":
      return { start: startOfYear(now), end: endOfDay(now) };
    case "custom": {
      const s = customStart ? startOfDay(new Date(customStart + "T00:00:00")) : startOfMonth(now);
      const e = customEnd ? endOfDay(new Date(customEnd + "T00:00:00")) : endOfDay(now);
      return { start: s, end: e };
    }
    default:
      return { start: startOfMonth(now), end: endOfDay(now) };
  }
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricProps {
  label: string;
  value: number;
  icon: React.ElementType;
  negative?: boolean;
  highlight?: boolean;
  loading?: boolean;
}

function MetricCard({ label, value, icon: Icon, negative, highlight, loading }: MetricProps) {
  const isPositive = !negative && value >= 0;
  return (
    <div className={cn(
      "rounded-xl p-5 shadow-soft flex flex-col gap-2 border",
      highlight
        ? value >= 0
          ? "bg-success/10 border-success/30"
          : "bg-destructive/10 border-destructive/30"
        : "bg-card border-border"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={cn(
          "rounded-lg p-2",
          highlight
            ? value >= 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
            : negative ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {loading ? (
        <div className="h-7 w-28 bg-muted animate-pulse rounded" />
      ) : (
        <span className={cn(
          "text-2xl font-bold",
          highlight
            ? value >= 0 ? "text-success" : "text-destructive"
            : negative ? "text-destructive" : "text-card-foreground"
        )}>
          {negative ? "− " : ""}{fmtCurrency(Math.abs(value))}
        </span>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReportMyPerformance() {
  const { user } = useAuth();

  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const dateRange = useMemo(
    () => buildDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  // ── 1. Fetch completed sales ─────────────────────────────────────────────
  const { data: salesRaw = [], isLoading: salesLoading } = useQuery({
    queryKey: ["my-performance-sales", user?.id, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id, total, subtotal, discount_amount, shipping_cost, shipping_payer, payment_method, sale_source, created_at, customer_name,
          sale_items ( product_id, product_name, quantity, unit_price, total )
        `)
        .eq("owner_id", user!.id)
        .eq("status", "completed")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Sale & { sale_source?: string | null })[];
    },
    enabled: !!user,
  });

  // ── Derive available payment methods from fetched sales ──────────────────
  const availablePayments = useMemo(() => {
    const methods = new Set(salesRaw.map(s => s.payment_method).filter(Boolean));
    return Array.from(methods).sort();
  }, [salesRaw]);

  // ── Apply client-side filters ────────────────────────────────────────────
  const sales = useMemo(() => {
    return salesRaw.filter(s => {
      if (selectedSources.length > 0) {
        const src = s.sale_source ?? "manual";
        if (!selectedSources.includes(src)) return false;
      }
      if (selectedPayments.length > 0) {
        if (!selectedPayments.includes(s.payment_method)) return false;
      }
      return true;
    });
  }, [salesRaw, selectedSources, selectedPayments]);

  // ── 2. Collect product IDs from sales ────────────────────────────────────
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sales)
      for (const item of s.sale_items)
        if (item.product_id) ids.add(item.product_id);
    return Array.from(ids);
  }, [sales]);

  // ── 3. Fetch product costs ───────────────────────────────────────────────
  const { data: productCosts = [], isLoading: costsLoading } = useQuery({
    queryKey: ["my-performance-costs", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const results: ProductCost[] = [];
      for (let i = 0; i < productIds.length; i += 500) {
        const { data, error } = await supabase
          .from("products")
          .select("id, cost_price")
          .in("id", productIds.slice(i, i + 500));
        if (error) throw error;
        if (data) results.push(...(data as ProductCost[]));
      }
      return results;
    },
    enabled: productIds.length > 0,
  });

  const costMap = useMemo(() => {
    const m = new Map<string, number>();
    productCosts.forEach(p => m.set(p.id, p.cost_price ?? 0));
    return m;
  }, [productCosts]);

  // ── 4a. Fetch concluded HUB orders where I am the SUPPLIER (fornecedor) ──
  const { data: hubSupplierOrders = [], isLoading: hubLoading } = useQuery({
    queryKey: ["my-performance-hub-supplier", user?.id, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_pending_order_items")
        .select(`
          quantity, unit_price, cost_price, product_id,
          hub_pending_orders!inner ( status, finalized_at )
        `)
        .eq("hub_owner_id", user!.id)
        .eq("hub_pending_orders.status", "CONCLUIDO")
        .gte("hub_pending_orders.finalized_at", dateRange.start.toISOString())
        .lte("hub_pending_orders.finalized_at", dateRange.end.toISOString());
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  // ── 4b. Fetch product costs for HUB supplier items ───────────────────────
  const hubProductIds = useMemo(() => {
    return [...new Set(hubSupplierOrders.map((i: any) => i.product_id).filter(Boolean))];
  }, [hubSupplierOrders]);

  const { data: hubProductCosts = [] } = useQuery({
    queryKey: ["my-performance-hub-costs", hubProductIds],
    queryFn: async () => {
      if (hubProductIds.length === 0) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, cost_price")
        .in("id", hubProductIds);
      if (error) throw error;
      return (data ?? []) as ProductCost[];
    },
    enabled: hubProductIds.length > 0,
  });

  const hubCostMap = useMemo(() => {
    const m = new Map<string, number>();
    hubProductCosts.forEach((p: any) => m.set(p.id, p.cost_price ?? 0));
    return m;
  }, [hubProductCosts]);

  // Aggregate HUB supplier metrics
  const hubSupplierMetrics = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    for (const item of hubSupplierOrders) {
      const qty = item.quantity ?? 1;
      revenue += (item.unit_price ?? 0) * qty;
      const c = hubCostMap.get(item.product_id) ?? (item.cost_price ?? 0);
      cost += c * qty;
    }
    return { revenue, cost, profit: revenue - cost, count: hubSupplierOrders.length };
  }, [hubSupplierOrders, hubCostMap]);

  // ── 4. Fetch payment method fees ─────────────────────────────────────────
  const { data: customPaymentMethods = [] } = useQuery({
    queryKey: ["my-performance-fees", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("name, fee_percent")
        .eq("owner_id", user!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data as CustomPaymentMethod[];
    },
    enabled: !!user,
  });

  const feesMap = useMemo(() => {
    const m = new Map<string, number>();
    // Hardcoded first
    Object.entries(HARDCODED_FEES).forEach(([k, v]) => m.set(k, v));
    // Custom override
    customPaymentMethods.forEach(pm => m.set(pm.name.toLowerCase(), pm.fee_percent));
    return m;
  }, [customPaymentMethods]);

  // ── 5. Compute metrics (includes HUB supplier revenue) ──────────────────
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCMV = 0;
    let totalFees = 0;
    let totalShipping = 0;
    let totalDiscounts = 0;

    for (const sale of sales) {
      // Revenue: use subtotal (pre-discount) so discount appears as explicit deduction
      totalRevenue += sale.subtotal ?? sale.total;

      // Discounts (explicit deduction)
      totalDiscounts += sale.discount_amount ?? 0;

      // CMV
      for (const item of sale.sale_items) {
        const cost = item.product_id ? (costMap.get(item.product_id) ?? 0) : 0;
        totalCMV += cost * item.quantity;
      }

      // Payment fees
      const method = (sale.payment_method ?? "").toLowerCase();
      const feePercent = feesMap.get(method) ?? 0;
      totalFees += sale.total * (feePercent / 100);

      // Shipping (only if seller paid)
      if (sale.shipping_payer === "seller" && sale.shipping_cost) {
        totalShipping += sale.shipping_cost;
      }
    }

    // Add HUB supplier (fornecedor) revenue and cost
    const hubRevenue = hubSupplierMetrics.revenue;
    const hubCost = hubSupplierMetrics.cost;
    totalRevenue += hubRevenue;
    totalCMV += hubCost;

    const netProfit = totalRevenue - totalCMV - totalDiscounts - totalFees - totalShipping;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCMV, totalFees, totalShipping, totalDiscounts, netProfit, margin, hubRevenue, hubCost };
  }, [sales, costMap, feesMap, hubSupplierMetrics]);

  // ── 6. Daily chart data ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    // Limit to 60 days for readability
    const displayDays = days.length > 60 ? days.slice(-60) : days;

    return displayDays.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      let revenue = 0;
      let cmv = 0;
      let fees = 0;
      let shipping = 0;

      for (const sale of sales) {
        const saleDate = safeParseDate(sale.created_at);
        if (!saleDate || saleDate < dayStart || saleDate > dayEnd) continue;

        revenue += sale.subtotal ?? sale.total;

        for (const item of sale.sale_items) {
          const cost = item.product_id ? (costMap.get(item.product_id) ?? 0) : 0;
          cmv += cost * item.quantity;
        }

        const method = (sale.payment_method ?? "").toLowerCase();
        fees += sale.total * ((feesMap.get(method) ?? 0) / 100);

        if (sale.shipping_payer === "seller" && sale.shipping_cost) {
          shipping += sale.shipping_cost;
        }
      }

        const discounts = sales
          .filter(s => {
            const sd = safeParseDate(s.created_at);
            return sd && sd >= dayStart && sd <= dayEnd;
          })
          .reduce((acc, s) => acc + (s.discount_amount ?? 0), 0);
        const profit = revenue - cmv - fees - shipping - discounts;

      return {
        name: days.length > 31
          ? format(day, "dd/MM", { locale: ptBR })
          : format(day, "EEE dd", { locale: ptBR }),
        "Vendas": parseFloat(revenue.toFixed(2)),
        "Lucro": parseFloat(profit.toFixed(2)),
      };
    });
  }, [sales, dateRange, costMap, feesMap]);

  const isLoading = salesLoading || costsLoading || hubLoading;
  const totalSales = sales.length;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">Minha Performance</h1>
          <p className="text-sm text-muted-foreground">
            Lucro real das suas vendas — deduzindo todos os custos operacionais
          </p>
        </div>

        {/* Period Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {PERIOD_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={period === opt.value ? "default" : "outline"}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </Button>
          ))}

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs whitespace-nowrap">De</Label>
                <Input
                  type="date"
                  className="h-8 text-xs w-36"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs whitespace-nowrap">Até</Label>
                <Input
                  type="date"
                  className="h-8 text-xs w-36"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Extra Filters Row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Canal de Venda */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8">
                Canal de Venda
                {selectedSources.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-xs">{selectedSources.length}</Badge>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs">Filtrar por canal</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SALE_SOURCE_OPTIONS.map(opt => (
                <DropdownMenuCheckboxItem
                  key={opt.value}
                  checked={selectedSources.includes(opt.value)}
                  onCheckedChange={checked => {
                    setSelectedSources(prev =>
                      checked ? [...prev, opt.value] : prev.filter(v => v !== opt.value)
                    );
                  }}
                >
                  {opt.label}
                </DropdownMenuCheckboxItem>
              ))}
              {selectedSources.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setSelectedSources([])}
                    className="text-destructive"
                  >
                    Limpar filtro
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Forma de Pagamento */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8">
                Forma de Pagamento
                {selectedPayments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-xs">{selectedPayments.length}</Badge>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs">Filtrar por pagamento</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availablePayments.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhum dado no período</p>
              ) : (
                availablePayments.map(method => (
                  <DropdownMenuCheckboxItem
                    key={method}
                    checked={selectedPayments.includes(method)}
                    onCheckedChange={checked => {
                      setSelectedPayments(prev =>
                        checked ? [...prev, method] : prev.filter(v => v !== method)
                      );
                    }}
                  >
                    {method}
                  </DropdownMenuCheckboxItem>
                ))
              )}
              {selectedPayments.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setSelectedPayments([])}
                    className="text-destructive"
                  >
                    Limpar filtro
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Active filter chips */}
          {selectedSources.map(src => (
            <Badge key={src} variant="secondary" className="gap-1 pr-1 h-7">
              {SALE_SOURCE_OPTIONS.find(o => o.value === src)?.label ?? src}
              <button onClick={() => setSelectedSources(p => p.filter(v => v !== src))} className="ml-0.5 rounded hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedPayments.map(pay => (
            <Badge key={pay} variant="secondary" className="gap-1 pr-1 h-7">
              {pay}
              <button onClick={() => setSelectedPayments(p => p.filter(v => v !== pay))} className="ml-0.5 rounded hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          <span className="ml-auto text-xs text-muted-foreground">
            {totalSales} venda{totalSales !== 1 ? "s" : ""}
            {hubSupplierMetrics.count > 0 && (
              <> · <span className="text-primary font-medium">{hubSupplierMetrics.count} item{hubSupplierMetrics.count !== 1 ? "s" : ""} HUB</span></>
            )}
          </span>
        </div>

        {/* 6 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <MetricCard
            label="Receita Bruta"
            value={metrics.totalRevenue}
            icon={ShoppingBag}
            loading={isLoading}
          />
          <MetricCard
            label="Custo dos Produtos (CMV)"
            value={metrics.totalCMV}
            icon={Package}
            negative
            loading={isLoading}
          />
          <MetricCard
            label="Descontos Concedidos"
            value={metrics.totalDiscounts}
            icon={TrendingDown}
            negative
            loading={isLoading}
          />
          <MetricCard
            label="Taxas de Pagamento"
            value={metrics.totalFees}
            icon={CreditCard}
            negative
            loading={isLoading}
          />
          <MetricCard
            label="Custo com Frete"
            value={metrics.totalShipping}
            icon={Truck}
            negative
            loading={isLoading}
          />
          <MetricCard
            label="Lucro Líquido"
            value={metrics.netProfit}
            icon={metrics.netProfit >= 0 ? TrendingUp : TrendingDown}
            highlight
            loading={isLoading}
          />
        </div>

        {/* Margin badge */}
        {!isLoading && metrics.totalRevenue > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Margem líquida:</span>
            <span className={cn(
              "text-sm font-semibold px-2.5 py-0.5 rounded-full",
              metrics.margin >= 20
                ? "bg-success/15 text-success"
                : metrics.margin >= 5
                  ? "bg-warning/15 text-warning"
                  : "bg-destructive/15 text-destructive"
            )}>
              {metrics.margin.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">
              {metrics.margin >= 20
                ? "✓ Saudável"
                : metrics.margin >= 5
                  ? "⚠ Apertada"
                  : "✗ Atenção"}
            </span>
          </div>
        )}

        {/* Chart */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-soft">
          <h3 className="text-base font-semibold text-card-foreground mb-4">
            Evolução: Vendas vs Lucro Líquido
          </h3>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : chartData.every(d => d["Vendas"] === 0) ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma venda no período selecionado</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradVendas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2, 145 65% 42%))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2, 145 65% 42%))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(var(--card-foreground))", fontWeight: 600 }}
                    formatter={(value: number, name: string) => [
                      fmtCurrency(value),
                      name,
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Vendas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#gradVendas)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Lucro"
                    stroke="hsl(var(--chart-2, 145 65% 42%))"
                    strokeWidth={2}
                    fill="url(#gradLucro)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Breakdown table */}
        {!isLoading && metrics.totalRevenue > 0 && (
          <div className="rounded-xl bg-card border border-border p-5 shadow-soft">
            <h3 className="text-base font-semibold text-card-foreground mb-3">
              Composição do Resultado
            </h3>
            <div className="space-y-2">
              {[
                { label: "Receita Bruta (Vendas)", value: metrics.totalRevenue, color: "text-card-foreground" },
                ...(metrics.hubRevenue > 0 ? [
                  { label: "  ↳ inclui Receita HUB Fornecedor", value: metrics.hubRevenue, color: "text-primary" },
                ] : []),
                { label: "− Custo dos Produtos (CMV)", value: -metrics.totalCMV, color: "text-destructive" },
                { label: "− Descontos Concedidos", value: -metrics.totalDiscounts, color: "text-destructive" },
                { label: "− Taxas de Pagamento", value: -metrics.totalFees, color: "text-destructive" },
                { label: "− Custo com Frete", value: -metrics.totalShipping, color: "text-destructive" },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={cn("text-sm font-medium", row.color)}>
                    {fmtCurrency(Math.abs(row.value))}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 mt-1">
                <span className="text-sm font-bold text-card-foreground">= Lucro Líquido</span>
                <span className={cn(
                  "text-sm font-bold",
                  metrics.netProfit >= 0 ? "text-success" : "text-destructive"
                )}>
                  {fmtCurrency(metrics.netProfit)}
                </span>
              </div>
            </div>
          </div>
        )}
        {/* HUB supplier banner */}
        {!isLoading && hubSupplierMetrics.count > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3 text-sm">
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Receita HUB Fornecedor incluída:</strong>{" "}
              {hubSupplierMetrics.count} item{hubSupplierMetrics.count !== 1 ? "s" : ""} B2B concluídos →{" "}
              <span className="text-primary font-semibold">{fmtCurrency(hubSupplierMetrics.revenue)}</span> receita,{" "}
              <span className="text-success font-semibold">{fmtCurrency(hubSupplierMetrics.profit)}</span> lucro
            </span>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
