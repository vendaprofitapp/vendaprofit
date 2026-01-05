import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const lowStockItems = [
  { id: 1, name: "Legging Suplex P", current: 3, min: 10 },
  { id: 2, name: "Top Esportivo M", current: 5, min: 15 },
  { id: 3, name: "Shorts G", current: 2, min: 8 },
];

export function LowStockAlert() {
  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Estoque Baixo</h3>
          <p className="text-sm text-muted-foreground">{lowStockItems.length} produtos precisam de reposição</p>
        </div>
      </div>

      <div className="space-y-3">
        {lowStockItems.map((item) => {
          const percentage = (item.current / item.min) * 100;
          return (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-card-foreground">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {item.current}/{item.min}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-warning transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Button variant="outline" className="w-full mt-4">
        Ver Todos
      </Button>
    </div>
  );
}
