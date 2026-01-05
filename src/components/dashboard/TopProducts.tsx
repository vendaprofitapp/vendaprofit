import { TrendingUp } from "lucide-react";
import { useMemo } from "react";

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  total: number;
}

interface Sale {
  id: string;
  created_at: string;
  sale_items?: SaleItem[];
}

interface TopProductsProps {
  sales: Sale[];
}

export function TopProducts({ sales }: TopProductsProps) {
  const topProducts = useMemo(() => {
    // Agregar vendas por produto
    const productMap = new Map<string, { name: string; sold: number; revenue: number }>();

    sales.forEach(sale => {
      sale.sale_items?.forEach(item => {
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.sold += item.quantity;
          existing.revenue += Number(item.total);
        } else {
          productMap.set(item.product_id, {
            name: item.product_name,
            sold: item.quantity,
            revenue: Number(item.total),
          });
        }
      });
    });

    // Converter para array e ordenar por quantidade vendida
    return Array.from(productMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 4);
  }, [sales]);

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
          <TrendingUp className="h-5 w-5 text-success" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Mais Vendidos</h3>
          <p className="text-sm text-muted-foreground">Geral</p>
        </div>
      </div>

      <div className="space-y-4">
        {topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma venda registrada
          </p>
        ) : (
          topProducts.map((product, index) => (
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
                  {product.sold} {product.sold === 1 ? 'vendido' : 'vendidos'}
                </p>
              </div>
              <p className="text-sm font-semibold text-success">
                R$ {product.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
