import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Calendar, Download } from "lucide-react";

const monthlySales = [
  { name: "Jan", vendas: 18500 },
  { name: "Fev", vendas: 22300 },
  { name: "Mar", vendas: 19800 },
  { name: "Abr", vendas: 24500 },
  { name: "Mai", vendas: 28700 },
  { name: "Jun", vendas: 26200 },
];

const categoryData = [
  { name: "Leggings", value: 35 },
  { name: "Tops", value: 25 },
  { name: "Shorts", value: 20 },
  { name: "Conjuntos", value: 15 },
  { name: "Outros", value: 5 },
];

const COLORS = ["hsl(15, 90%, 55%)", "hsl(25, 95%, 60%)", "hsl(145, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(220, 10%, 50%)"];

export default function Reports() {
  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada do seu negócio</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Último Semestre
          </Button>
          <Button variant="secondary">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="rounded-xl bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="text-3xl font-bold text-foreground">R$ 140.000</p>
          <p className="text-xs text-success mt-1">+18% vs período anterior</p>
        </div>
        <div className="rounded-xl bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">Total de Vendas</p>
          <p className="text-3xl font-bold text-foreground">892</p>
          <p className="text-xs text-success mt-1">+12% vs período anterior</p>
        </div>
        <div className="rounded-xl bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">Produtos Vendidos</p>
          <p className="text-3xl font-bold text-foreground">2,456</p>
          <p className="text-xs text-success mt-1">+22% vs período anterior</p>
        </div>
        <div className="rounded-xl bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">Novos Clientes</p>
          <p className="text-3xl font-bold text-foreground">156</p>
          <p className="text-xs text-success mt-1">+8% vs período anterior</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Sales Chart */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Vendas Mensais</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySales}>
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
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Vendas"]}
                />
                <Bar dataKey="vendas" fill="hsl(15, 90%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Vendas por Categoria</h3>
          <div className="h-72 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Participação"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 pl-4">
              {categoryData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index] }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                  <span className="text-sm font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
