import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Eye, Percent, ShoppingCart, CalendarIcon, TrendingUp } from "lucide-react";
import { startOfDay, subDays, startOfMonth, format, eachDayOfInterval, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AnalyticsDashboardProps {
  ownerId: string;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
}

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Mês Atual" },
  { value: "custom", label: "Personalizado" },
];

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  switch (period) {
    case "today": return { start: startOfDay(now), end };
    case "7d": return { start: startOfDay(subDays(now, 6)), end };
    case "30d": return { start: startOfDay(subDays(now, 29)), end };
    case "month": return { start: startOfMonth(now), end };
    default: return { start: startOfDay(subDays(now, 6)), end };
  }
}

export function AnalyticsDashboard({ ownerId, dateRange, onDateRangeChange }: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState("7d");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    if (value !== "custom") {
      onDateRangeChange(getDateRange(value));
    }
  };

  const handleCustomDateApply = () => {
    if (customStart && customEnd) {
      onDateRangeChange({ start: startOfDay(customStart), end: customEnd });
    }
  };

  const startISO = dateRange.start.toISOString();
  const endISO = dateRange.end.toISOString();

  // Unique visitors
  const { data: visitors = 0 } = useQuery({
    queryKey: ["analytics-visitors", ownerId, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_product_views")
        .select("device_id")
        .eq("owner_id", ownerId)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (error) throw error;
      const unique = new Set((data || []).map(r => r.device_id).filter(Boolean));
      return unique.size;
    },
  });

  // Leads captured
  const { data: leadsCount = 0 } = useQuery({
    queryKey: ["analytics-leads-count", ownerId, startISO, endISO],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("store_leads")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (error) throw error;
      return count || 0;
    },
  });

  // Abandoned carts
  const { data: abandonedCarts = 0 } = useQuery({
    queryKey: ["analytics-abandoned", ownerId, startISO, endISO],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from("store_leads")
        .select("id")
        .eq("owner_id", ownerId);
      const leadIds = (leads || []).map(l => l.id);
      if (leadIds.length === 0) return 0;

      const { data, error } = await supabase
        .from("lead_cart_items")
        .select("lead_id")
        .eq("status", "abandoned")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .in("lead_id", leadIds);
      if (error) throw error;
      const unique = new Set((data || []).map(r => r.lead_id));
      return unique.size;
    },
  });

  const captureRate = visitors > 0 ? ((leadsCount / visitors) * 100).toFixed(1) : "0";

  // Daily traffic chart data
  const { data: chartData = [] } = useQuery({
    queryKey: ["analytics-traffic-chart", ownerId, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_product_views")
        .select("created_at, device_id")
        .eq("owner_id", ownerId)
        .gte("created_at", startISO)
        .lte("created_at", endISO);
      if (error) throw error;

      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      return days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const uniqueDevices = new Set(
          (data || []).filter(r => {
            const d = parseISO(r.created_at);
            return isValid(d) && format(d, "yyyy-MM-dd") === dayStr;
          }).map(r => r.device_id).filter(Boolean)
        );
        return {
          name: format(day, "dd/MM", { locale: ptBR }),
          visitantes: uniqueDevices.size,
        };
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5", !customStart && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customStart ? format(customStart, "dd/MM/yyyy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5", !customEnd && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customEnd ? format(customEnd, "dd/MM/yyyy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={handleCustomDateApply} disabled={!customStart || !customEnd}>Aplicar</Button>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Visitantes Únicos" value={visitors.toLocaleString("pt-BR")} icon={Eye} iconColor="bg-blue-500/10 text-blue-500" />
        <MetricCard title="Taxa de Captura" value={`${captureRate}%`} icon={Percent} iconColor="bg-emerald-500/10 text-emerald-500" />
        <MetricCard title="Carrinhos Abandonados" value={abandonedCarts.toLocaleString("pt-BR")} icon={ShoppingCart} iconColor="bg-amber-500/10 text-amber-500" />
      </div>

      {/* Traffic Chart */}
      <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Tráfego Diário</h3>
        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhum dado de tráfego no período</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVisitantes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(15, 90%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(15, 90%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--card-foreground))" }}
                  formatter={(value: number) => [value, "Visitantes"]}
                />
                <Area type="monotone" dataKey="visitantes" stroke="hsl(15, 90%, 55%)" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitantes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
