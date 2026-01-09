import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { subDays, startOfDay, format, eachDayOfInterval, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp } from "lucide-react";

interface Sale {
  id: string;
  total: number;
  created_at: string;
}

interface SalesChartProps {
  sales: Sale[];
}

// Safe date parser for iOS Safari compatibility
const safeParseDateString = (dateString: string): Date | null => {
  if (!dateString) return null;
  try {
    // Try parseISO first (handles ISO 8601 strings)
    const parsed = parseISO(dateString);
    if (isValid(parsed)) return parsed;
    // Fallback: try native Date (for already valid Date strings)
    const fallback = new Date(dateString);
    if (isValid(fallback)) return fallback;
    return null;
  } catch {
    return null;
  }
};

export function SalesChart({ sales = [] }: SalesChartProps) {
  // iOS Safari safety check - prevent rendering with undefined data
  if (!Array.isArray(sales)) {
    return (
      <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Carregando dados...
        </div>
      </div>
    );
  }

  const { chartData, weekTotal, percentageChange } = useMemo(() => {
    const today = startOfDay(new Date());
    const weekStart = subDays(today, 6);
    const previousWeekStart = subDays(weekStart, 7);

    // Criar array com os últimos 7 dias
    const days = eachDayOfInterval({ start: weekStart, end: today });

    const data = days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const daySales = sales.filter(s => {
        const saleDate = safeParseDateString(s.created_at);
        if (!saleDate) return false;
        return saleDate >= dayStart && saleDate <= dayEnd;
      });

      const total = daySales.reduce((sum, s) => sum + Number(s.total || 0), 0);

      return {
        name: format(day, 'EEE', { locale: ptBR }).charAt(0).toUpperCase() + 
              format(day, 'EEE', { locale: ptBR }).slice(1),
        vendas: total,
      };
    });

    // Total da semana atual
    const currentWeekTotal = sales
      .filter(s => {
        const date = safeParseDateString(s.created_at);
        return date && date >= weekStart;
      })
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    // Total da semana anterior
    const previousWeekTotal = sales
      .filter(s => {
        const date = safeParseDateString(s.created_at);
        return date && date >= previousWeekStart && date < weekStart;
      })
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    const change = previousWeekTotal > 0 
      ? ((currentWeekTotal - previousWeekTotal) / previousWeekTotal * 100).toFixed(1)
      : currentWeekTotal > 0 ? 100 : 0;

    return {
      chartData: data,
      weekTotal: currentWeekTotal,
      percentageChange: Number(change),
    };
  }, [sales]);

  // Empty state for charts - prevents iOS Safari crash
  if (!chartData || chartData.length === 0) {
    return (
      <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">Vendas da Semana</h3>
            <p className="text-sm text-muted-foreground">Total: R$ 0,00</p>
          </div>
        </div>
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
          <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">Nenhuma venda registrada</p>
          <p className="text-xs">Comece a registrar vendas para ver o gráfico</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Vendas da Semana</h3>
          <p className="text-sm text-muted-foreground">
            Total: R$ {weekTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded-lg px-3 py-1 ${
          percentageChange >= 0 ? 'bg-success/10' : 'bg-destructive/10'
        }`}>
          <span className={`text-sm font-medium ${
            percentageChange >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {percentageChange >= 0 ? '+' : ''}{percentageChange}%
          </span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(15, 90%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(15, 90%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={(value) => value >= 1000 ? `R$${(value / 1000).toFixed(0)}k` : `R$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "var(--shadow-medium)",
              }}
              labelStyle={{ color: "hsl(var(--card-foreground))" }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Vendas"]}
            />
            <Area
              type="monotone"
              dataKey="vendas"
              stroke="hsl(15, 90%, 55%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorVendas)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
