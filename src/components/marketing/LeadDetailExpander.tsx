import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";

interface LeadDetailExpanderProps {
  leadId: string;
}

export function LeadDetailExpander({ leadId }: LeadDetailExpanderProps) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["lead-cart-items", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_cart_items")
        .select("id, product_name, variant_color, selected_size, quantity, unit_price, status")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (isLoading) {
    return <div className="p-3 text-sm text-muted-foreground animate-pulse">Carregando itens...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
        <Package className="h-4 w-4" />
        Nenhum item no carrinho
      </div>
    );
  }

  return (
    <div className="border-t p-3 space-y-2 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens do Carrinho</p>
      {items.map(item => (
        <div key={item.id} className="flex justify-between text-sm">
          <span className="truncate flex-1">
            {item.product_name}
            {item.variant_color ? ` - ${item.variant_color}` : ""}
            {item.selected_size ? ` (${item.selected_size})` : ""}
            {item.quantity > 1 ? ` x${item.quantity}` : ""}
          </span>
          <span className="ml-2 shrink-0 font-medium">{formatPrice(item.unit_price * item.quantity)}</span>
        </div>
      ))}
      <div className="flex justify-between text-sm font-semibold border-t pt-2">
        <span>Total</span>
        <span>{formatPrice(items.reduce((s, i) => s + i.unit_price * i.quantity, 0))}</span>
      </div>
    </div>
  );
}
