import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfitSplitDisplay } from "./ProfitSplitDisplay";
import { Package } from "lucide-react";

interface GroupProductPreviewDialogProps {
  groupId: string | null;
  groupName: string;
  profitShareSeller: number;
  profitSharePartner: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupProductPreviewDialog({
  groupId,
  groupName,
  profitShareSeller,
  profitSharePartner,
  open,
  onOpenChange,
}: GroupProductPreviewDialogProps) {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["group-preview-products", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("product_id, products!inner(name, price, image_url, category)")
        .eq("group_id", groupId)
        .limit(20);
      if (error) throw error;
      return (data || []).map((d: any) => d.products);
    },
    enabled: !!groupId && open,
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produtos do {groupName}
          </DialogTitle>
        </DialogHeader>

        <ProfitSplitDisplay
          profitShareSeller={profitShareSeller}
          profitSharePartner={profitSharePartner}
        />

        <ScrollArea className="max-h-[300px]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="h-12 w-12 bg-muted rounded" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum produto compartilhado neste grupo.
            </p>
          ) : (
            <div className="space-y-2">
              {products.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category} · {formatPrice(p.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
