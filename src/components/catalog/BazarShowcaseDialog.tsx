import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Package } from "lucide-react";
import { BazarCheckoutDialog } from "./BazarCheckoutDialog";

interface BazarShowcaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  primaryColor?: string;
}

export function BazarShowcaseDialog({ open, onOpenChange, ownerId, primaryColor = "#8B5CF6" }: BazarShowcaseDialogProps) {
  const [checkoutItem, setCheckoutItem] = useState<any>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["bazar-showcase", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazar_items")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!ownerId,
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-center pb-3">
            <div className="flex items-center justify-center gap-2">
              <ShoppingBag className="h-5 w-5" style={{ color: primaryColor }} />
              <SheetTitle>Bazar VIP</SheetTitle>
            </div>
            <p className="text-sm text-muted-foreground">Peças exclusivas com preços incríveis</p>
          </SheetHeader>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma peça disponível no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {items.map((item) => {
                const img = item.image_url || item.image_url_2 || item.image_url_3;
                return (
                  <div key={item.id} className="border rounded-xl overflow-hidden bg-card">
                    {img && (
                      <img src={img} alt={item.title} className="w-full h-36 object-cover" />
                    )}
                    <div className="p-2.5 space-y-1.5">
                      <h3 className="font-semibold text-sm line-clamp-1">{item.title}</h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs font-bold" style={{ color: primaryColor }}>
                          R$ {Number(item.final_price || item.seller_price).toFixed(2).replace(".", ",")}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        className="w-full text-xs h-8"
                        style={{ backgroundColor: primaryColor }}
                        onClick={() => {
                          onOpenChange(false);
                          setCheckoutItem(item);
                        }}
                      >
                        Comprar Agora
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {checkoutItem && (
        <BazarCheckoutDialog
          open={!!checkoutItem}
          onOpenChange={(o) => { if (!o) setCheckoutItem(null); }}
          item={checkoutItem}
          ownerId={ownerId}
          primaryColor={primaryColor}
        />
      )}
    </>
  );
}
