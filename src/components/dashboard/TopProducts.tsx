import { TrendingUp } from "lucide-react";

const topProducts = [
  { id: 1, name: "Legging Suplex Premium", sold: 156, revenue: "R$ 12.480" },
  { id: 2, name: "Conjunto Fitness Pro", sold: 89, revenue: "R$ 22.250" },
  { id: 3, name: "Top Esportivo Dry Fit", sold: 124, revenue: "R$ 11.160" },
  { id: 4, name: "Shorts Compressão", sold: 98, revenue: "R$ 5.880" },
];

export function TopProducts() {
  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
          <TrendingUp className="h-5 w-5 text-success" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Mais Vendidos</h3>
          <p className="text-sm text-muted-foreground">Este mês</p>
        </div>
      </div>

      <div className="space-y-4">
        {topProducts.map((product, index) => (
          <div
            key={product.id}
            className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-secondary/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground truncate">
                {product.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {product.sold} vendidos
              </p>
            </div>
            <p className="text-sm font-semibold text-success">
              {product.revenue}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
