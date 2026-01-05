import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  size?: string | null;
  stock_quantity: number;
  min_stock_level: number;
}

interface LowStockAlertProps {
  products: Product[];
}

export function LowStockAlert({ products = [] }: LowStockAlertProps) {
  const navigate = useNavigate();
  
  // Filtrar produtos com estoque baixo
  const lowStockItems = products
    .filter(p => p.stock_quantity <= p.min_stock_level)
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      name: p.size ? `${p.name} ${p.size}` : p.name,
      current: p.stock_quantity,
      min: p.min_stock_level,
    }));

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Estoque Baixo</h3>
          <p className="text-sm text-muted-foreground">
            {lowStockItems.length} {lowStockItems.length === 1 ? 'produto precisa' : 'produtos precisam'} de reposição
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {lowStockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todos os produtos estão com estoque adequado
          </p>
        ) : (
          lowStockItems.map((item) => {
            const percentage = item.min > 0 ? (item.current / item.min) * 100 : 0;
            return (
              <div key={item.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-card-foreground truncate max-w-[180px]">
                    {item.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.current}/{item.min}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      percentage <= 25 ? 'bg-destructive' : 'bg-warning'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {lowStockItems.length > 0 && (
        <Button 
          variant="outline" 
          className="w-full mt-4"
          onClick={() => navigate('/stock')}
        >
          Ver Todos
        </Button>
      )}
    </div>
  );
}
