import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProductSwap } from "@/hooks/useProductSwap";
import { Package, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SwapSelection {
  productId: string;
  productName: string;
  variantId?: string;
  size: string | null;
}

interface ProductSwapDialogProps {
  item: {
    id: string;
    product_id: string;
    variant_id: string | null;
    products: {
      id: string;
      name: string;
      category: string;
      size: string | null;
      color: string | null;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwapComplete: (selection?: SwapSelection) => void;
  primaryColor: string;
}

export function ProductSwapDialog({ 
  item, 
  open, 
  onOpenChange, 
  onSwapComplete,
  primaryColor 
}: ProductSwapDialogProps) {
  const { loading, suggestions, findSwapOptions, findSizeAlternatives } = useProductSwap();
  const [selectedSwap, setSelectedSwap] = useState<string | null>(null);

  useEffect(() => {
    if (open && item.products) {
      // First try to find size alternatives for the same product (same color)
      findSizeAlternatives(item.product_id, item.products.size, item.products.color).then(alternatives => {
        if (alternatives.length === 0) {
          // If no size alternatives with same color, look for similar products
          findSwapOptions({
            id: item.product_id,
            name: item.products.name,
            category: item.products.category,
            size: item.products.size,
            color: item.products.color,
          });
        }
      });
    }
  }, [open, item]);

  const handleSwapRequest = (suggestion: typeof suggestions[0]) => {
    // Pass the selected swap details back to the parent
    onSwapComplete({
      productId: suggestion.id,
      productName: suggestion.name,
      variantId: suggestion.variant_id,
      size: suggestion.size,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Trocar Tamanho</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          <p>O tamanho não serviu? Veja outras opções disponíveis:</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: primaryColor }} />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Não encontramos outros tamanhos disponíveis no momento.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Entre em contato com a vendedora para mais opções.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedSwap === suggestion.variant_id || selectedSwap === suggestion.id
                      ? "border-2 bg-muted/50"
                      : "hover:bg-muted/30"
                  }`}
                  style={
                    selectedSwap === suggestion.variant_id || selectedSwap === suggestion.id
                      ? { borderColor: primaryColor }
                      : {}
                  }
                  onClick={() => setSelectedSwap(suggestion.variant_id || suggestion.id)}
                >
                  <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                    {suggestion.image_url ? (
                      <img 
                        src={suggestion.image_url} 
                        alt={suggestion.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{suggestion.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {suggestion.size && (
                        <Badge variant="outline" className="text-xs">{suggestion.size}</Badge>
                      )}
                      {suggestion.color && (
                        <Badge variant="outline" className="text-xs">{suggestion.color}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-medium" style={{ color: primaryColor }}>
                      {formatPrice(suggestion.price)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.availableStock} em estoque
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button 
            className="flex-1 gap-2"
            style={{ backgroundColor: primaryColor }}
            disabled={!selectedSwap || loading}
            onClick={() => {
              const selected = suggestions.find(s => (s.variant_id || s.id) === selectedSwap);
              if (selected) handleSwapRequest(selected);
            }}
          >
            Solicitar Troca
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
