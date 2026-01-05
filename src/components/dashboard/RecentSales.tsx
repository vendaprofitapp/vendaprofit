import { ShoppingBag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  total: number;
}

interface Sale {
  id: string;
  total: number;
  created_at: string;
  sale_items?: SaleItem[];
}

interface RecentSalesProps {
  sales: Sale[];
}

export function RecentSales({ sales = [] }: RecentSalesProps) {
  // Pegar as últimas 5 vendas com itens
  const recentSales = sales
    .filter(s => s.sale_items && s.sale_items.length > 0)
    .slice(0, 5)
    .map(sale => ({
      id: sale.id,
      product: sale.sale_items?.[0]?.product_name || 'Produto',
      quantity: sale.sale_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      total: `R$ ${Number(sale.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      time: formatDistanceToNow(new Date(sale.created_at), { addSuffix: true, locale: ptBR }),
      itemCount: sale.sale_items?.length || 0,
    }));

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-card-foreground">Vendas Recentes</h3>
        <span className="text-sm text-muted-foreground">Últimas vendas</span>
      </div>
      
      <div className="space-y-4">
        {recentSales.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma venda registrada
          </p>
        ) : (
          recentSales.map((sale, index) => (
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
                  {sale.itemCount > 1 ? `${sale.product} +${sale.itemCount - 1}` : sale.product}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sale.quantity} {sale.quantity > 1 ? "unidades" : "unidade"} • {sale.time}
                </p>
              </div>
              <p className="text-sm font-semibold text-card-foreground">
                {sale.total}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
