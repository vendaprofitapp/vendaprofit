import { ShoppingBag } from "lucide-react";

const recentSales = [
  { id: 1, product: "Legging Suplex Premium", quantity: 2, total: "R$ 159,80", time: "há 5 min" },
  { id: 2, product: "Top Esportivo Dry Fit", quantity: 1, total: "R$ 89,90", time: "há 12 min" },
  { id: 3, product: "Shorts Compressão", quantity: 3, total: "R$ 179,70", time: "há 25 min" },
  { id: 4, product: "Conjunto Fitness", quantity: 1, total: "R$ 249,90", time: "há 42 min" },
  { id: 5, product: "Regata Performance", quantity: 2, total: "R$ 99,80", time: "há 1h" },
];

export function RecentSales() {
  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-card-foreground">Vendas Recentes</h3>
        <span className="text-sm text-muted-foreground">Últimas 24h</span>
      </div>
      
      <div className="space-y-4">
        {recentSales.map((sale, index) => (
          <div
            key={sale.id}
            className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-secondary/50"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground truncate">
                {sale.product}
              </p>
              <p className="text-xs text-muted-foreground">
                {sale.quantity} {sale.quantity > 1 ? "unidades" : "unidade"} • {sale.time}
              </p>
            </div>
            <p className="text-sm font-semibold text-card-foreground">
              {sale.total}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
