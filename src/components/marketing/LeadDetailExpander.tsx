import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingCart, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadDetailExpanderProps {
  leadId: string;
}

const CART_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  waiting: { label: "Aguardando", variant: "secondary" },
  abandoned: { label: "Abandonado", variant: "destructive" },
  converted: { label: "Convertido", variant: "default" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

const SOURCE_LABELS: Record<string, string> = {
  local: "Estoque",
  partner: "Parceira",
  b2b: "Sob Encomenda",
};

export function LeadDetailExpander({ leadId }: LeadDetailExpanderProps) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["lead-cart-items", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_cart_items")
        .select("id, product_name, variant_color, selected_size, quantity, unit_price, status, source")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: savedCarts = [] } = useQuery({
    queryKey: ["lead-saved-carts", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_carts")
        .select("id, short_code, total, status, created_at, saved_cart_items(id, product_name, variant_color, selected_size, quantity, unit_price, source)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }) as any;
      if (error) throw error;
      return (data || []).map((cart: any) => {
        // Auto-detect abandoned: waiting > 24h
        if (cart.status === "waiting" && differenceInHours(new Date(), parseISO(cart.created_at)) > 24) {
          return { ...cart, display_status: "abandoned" };
        }
        return { ...cart, display_status: cart.status };
      });
    },
  });

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (isLoading) {
    return <div className="p-3 text-sm text-muted-foreground animate-pulse">Carregando itens...</div>;
  }

  return (
    <div className="border-t p-3 space-y-3 bg-muted/30">
      {/* Saved Carts */}
      {savedCarts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingCart className="h-3 w-3" />
            Carrinhos Salvos
          </p>
          {savedCarts.map((cart: any) => {
            const statusCfg = CART_STATUS_CONFIG[cart.display_status] || CART_STATUS_CONFIG.waiting;
            return (
              <div key={cart.id} className="rounded-lg border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold">{cart.short_code}</span>
                    <Badge variant={statusCfg.variant} className="text-[9px]">{statusCfg.label}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(cart.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {(cart.saved_cart_items || []).map((sci: any) => (
                  <div key={sci.id} className="flex justify-between text-xs">
                    <span className="truncate flex-1">
                      {sci.product_name}
                      {sci.variant_color ? ` - ${sci.variant_color}` : ""}
                      {sci.selected_size ? ` (${sci.selected_size})` : ""}
                      {sci.quantity > 1 ? ` x${sci.quantity}` : ""}
                      {sci.source && sci.source !== "local" && (
                        <span className="text-muted-foreground ml-1">[{SOURCE_LABELS[sci.source] || sci.source}]</span>
                      )}
                    </span>
                    <span className="ml-2 shrink-0 font-medium">{formatPrice(sci.unit_price * sci.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold border-t pt-1">
                  <span>Total</span>
                  <span>{formatPrice(cart.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Regular Cart Items */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens do Carrinho</p>
          {items.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="truncate flex-1">
                {item.product_name}
                {item.variant_color ? ` - ${item.variant_color}` : ""}
                {item.selected_size ? ` (${item.selected_size})` : ""}
                {item.quantity > 1 ? ` x${item.quantity}` : ""}
                {item.source && item.source !== "local" && (
                  <span className="text-muted-foreground ml-1">[{SOURCE_LABELS[item.source] || item.source}]</span>
                )}
              </span>
              <span className="ml-2 shrink-0 font-medium">{formatPrice(item.unit_price * item.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span>Total</span>
            <span>{formatPrice(items.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0))}</span>
          </div>
        </div>
      )}

      {items.length === 0 && savedCarts.length === 0 && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Package className="h-4 w-4" />
          Nenhum item no carrinho
        </div>
      )}
    </div>
  );
}
