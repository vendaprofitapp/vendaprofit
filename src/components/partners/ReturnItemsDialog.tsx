import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Package, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AllocatedItem {
  id: string;
  product_id: string;
  quantity: number;
  status: string;
  allocated_at: string;
  notes: string | null;
  variant_id: string | null;
  product?: { name: string; image_url: string | null; price: number };
  variant?: { size: string };
}

interface ReturnItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerPointId: string;
  partnerName: string;
  onReturned: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  allocated: "Alocado",
  sold_online: "Vendido Online",
  returning: "Retornando",
};

const STATUS_COLORS: Record<string, string> = {
  allocated: "default",
  sold_online: "destructive",
  returning: "secondary",
};

export function ReturnItemsDialog({ open, onOpenChange, partnerPointId, partnerName, onReturned }: ReturnItemsDialogProps) {
  const [items, setItems] = useState<AllocatedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open) {
      setFetching(true);
      supabase
        .from("partner_point_items")
        .select("id, product_id, variant_id, quantity, status, allocated_at, notes")
        .eq("partner_point_id", partnerPointId)
        .in("status", ["allocated", "sold_online", "returning"])
        .order("allocated_at", { ascending: false })
        .then(async ({ data }) => {
          if (!data) { setFetching(false); return; }
          const productIds = [...new Set(data.map(i => i.product_id))];
          const variantIds = [...new Set(data.map(i => i.variant_id).filter(Boolean))];
          
          const [{ data: products }, { data: variants }] = await Promise.all([
            supabase.from("products").select("id, name, image_url, price").in("id", productIds),
            supabase.from("product_variants").select("id, size").in("id", variantIds)
          ]);
          
          const productMap = Object.fromEntries((products ?? []).map(p => [p.id, p]));
          const variantMap = Object.fromEntries((variants ?? []).map(v => [v.id, v]));
          
          setItems(data.map(i => ({ 
            ...i, 
            product: productMap[i.product_id],
            variant: i.variant_id ? variantMap[i.variant_id] : null
          })));
          setFetching(false);
        });
    } else {
      setSelected(new Set());
    }
  }, [open, partnerPointId]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleReturn = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    const { error } = await supabase
      .from("partner_point_items")
      .update({ status: "returned", returned_at: new Date().toISOString() })
      .in("id", Array.from(selected));
    setLoading(false);
    if (error) { toast.error("Erro ao registrar devolução."); return; }
    toast.success(`${selected.size} peça(s) devolvidas ao estoque central!`);
    onReturned();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Recolher Peças de {partnerName}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] h-[500px] border rounded-lg">
          {fetching ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma peça alocada neste ponto
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {items.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selected.has(item.id) ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"}`}
                  onClick={() => toggle(item.id)}
                >
                  <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
                  {item.product?.image_url ? (
                    <img src={item.product.image_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.product?.name ?? item.product_id}
                      {item.variant?.size ? ` - ${item.variant.size}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={STATUS_COLORS[item.status] as any ?? "outline"} className="text-xs py-0">
                        {STATUS_LABELS[item.status] ?? item.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{item.quantity} un.</span>
                      {item.status === "sold_online" && (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(item.allocated_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <div className="text-sm text-muted-foreground mr-auto">
            {selected.size > 0 ? `${selected.size} peça(s) selecionada(s)` : "Selecione as peças a devolver"}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleReturn} disabled={loading || selected.size === 0} variant="destructive">
            {loading ? "Registrando..." : `Confirmar Devolução (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
