import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "Seg", vendas: 2400 },
  { name: "Ter", vendas: 1398 },
  { name: "Qua", vendas: 3800 },
  { name: "Qui", vendas: 3908 },
  { name: "Sex", vendas: 4800 },
  { name: "Sáb", vendas: 5200 },
  { name: "Dom", vendas: 2100 },
];

export function SalesChart() {
  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Vendas da Semana</h3>
          <p className="text-sm text-muted-foreground">Total: R$ 23.606,00</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-1">
          <span className="text-sm font-medium text-success">+12.5%</span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
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
              tickFormatter={(value) => `R$${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "var(--shadow-medium)",
              }}
              labelStyle={{ color: "hsl(var(--card-foreground))" }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Vendas"]}
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
