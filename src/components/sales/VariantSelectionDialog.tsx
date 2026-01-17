import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Minus, Plus, Package, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProductVariant {
  id: string;
  product_id: string;
  color: string | null;
  size: string;
  stock_quantity: number;
  image_url: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  owner_id: string;
  group_id: string | null;
  category: string;
  color: string | null;
  size: string | null;
}

interface VariantSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onConfirm: (product: Product, variant: ProductVariant | null, quantity: number) => void;
}

// Size ordering helper
const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'EG', 'EGG', 'EGGG', 
  'U', 'UN', 'UNICO', 'ÚNICO',
  '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
  '1/2', '3/4', '5/6', '7/8', '9/10', '11/12'];

const getSizeIndex = (size: string) => {
  const upperSize = size.toUpperCase().trim();
  const idx = SIZE_ORDER.indexOf(upperSize);
  return idx === -1 ? 999 : idx;
};

export function VariantSelectionDialog({
  open,
  onOpenChange,
  product,
  onConfirm,
}: VariantSelectionDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<'color' | 'size' | 'quantity'>('color');

  // Reset state when dialog opens or product changes
  useEffect(() => {
    if (open && product) {
      setIsLoading(true);
      setVariants([]);
      setSelectedColor(null);
      setSelectedVariant(null);
      setQuantity(1);
      setStep('color');
      fetchVariants(product.id);
    }
  }, [open, product?.id]);

  const fetchVariants = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, product_id, color, size, stock_quantity, image_url")
        .eq("product_id", productId)
        .gt("stock_quantity", 0)
        .order("color")
        .order("size");

      if (error) throw error;

      const sortedData = (data || []).sort((a, b) => {
        const colorCompare = (a.color || "").localeCompare(b.color || "");
        if (colorCompare !== 0) return colorCompare;
        return getSizeIndex(a.size) - getSizeIndex(b.size);
      });

      setVariants(sortedData);

      // If no variants or only one without color, skip to simple quantity
      if (sortedData.length === 0) {
        setStep('quantity');
      } else {
        const uniqueColors = [...new Set(sortedData.map(v => v.color))];
        if (uniqueColors.length === 1) {
          setSelectedColor(uniqueColors[0]);
          const sizesForColor = sortedData.filter(v => v.color === uniqueColors[0]);
          if (sizesForColor.length === 1) {
            setSelectedVariant(sizesForColor[0]);
            setStep('quantity');
          } else {
            setStep('size');
          }
        } else {
          setStep('color');
        }
      }
    } catch (error) {
      console.error("Error fetching variants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique colors with their image
  const uniqueColors = useMemo(() => {
    const colorMap = new Map<string, { color: string; image: string | null; stock: number }>();
    variants.forEach(v => {
      const colorKey = v.color || "Sem cor";
      const existing = colorMap.get(colorKey);
      if (existing) {
        existing.stock += v.stock_quantity;
        if (!existing.image && v.image_url) {
          existing.image = v.image_url;
        }
      } else {
        colorMap.set(colorKey, {
          color: v.color || "Sem cor",
          image: v.image_url,
          stock: v.stock_quantity,
        });
      }
    });
    return Array.from(colorMap.values());
  }, [variants]);

  // Get sizes for selected color
  const sizesForColor = useMemo(() => {
    return variants.filter(v => (v.color || "Sem cor") === (selectedColor || "Sem cor"));
  }, [variants, selectedColor]);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setSelectedVariant(null);
    setQuantity(1);
    const sizes = variants.filter(v => (v.color || "Sem cor") === color);
    if (sizes.length === 1) {
      setSelectedVariant(sizes[0]);
      setStep('quantity');
    } else {
      setStep('size');
    }
  };

  const handleSizeSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setQuantity(1);
    setStep('quantity');
  };

  const handleConfirm = () => {
    if (!product) return;
    onConfirm(product, selectedVariant, quantity);
    onOpenChange(false);
  };

  const canConfirm = () => {
    if (variants.length === 0) return quantity > 0 && quantity <= (product?.stock_quantity || 0);
    return selectedVariant && quantity > 0 && quantity <= selectedVariant.stock_quantity;
  };

  const getMaxStock = () => {
    if (selectedVariant) return selectedVariant.stock_quantity;
    if (product) return product.stock_quantity;
    return 0;
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col !left-0 !top-auto !bottom-0 !translate-x-0 !translate-y-0 rounded-t-2xl sm:rounded-lg sm:!left-[50%] sm:!top-[50%] sm:!bottom-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {product.name}
          </DialogTitle>
          <p className="text-primary font-semibold text-lg">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : variants.length === 0 ? (
          // No variants - just show quantity selector
          <div className="flex-1 flex flex-col items-center justify-center py-6 gap-4">
            <p className="text-muted-foreground text-sm">
              Estoque disponível: {product.stock_quantity}
            </p>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full touch-manipulation text-lg"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-6 w-6" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={product.stock_quantity}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setQuantity(Math.min(Math.max(1, val), product.stock_quantity));
                }}
                className="w-20 h-14 text-center text-2xl font-bold"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full touch-manipulation text-lg"
                onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                disabled={quantity >= product.stock_quantity}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              {/* Color Selection */}
              {(step === 'color' || selectedColor) && uniqueColors.length > 1 && (
                <div>
                  <p className="text-sm font-medium mb-3">
                    {step === 'color' ? 'Selecione a cor:' : 'Cor selecionada:'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {uniqueColors.map(({ color, image, stock }) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all touch-manipulation",
                          selectedColor === color
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {image ? (
                          <img
                            src={image}
                            alt={color}
                            className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{color}</p>
                          <p className="text-xs text-muted-foreground">{stock} un</p>
                        </div>
                        {selectedColor === color && (
                          <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              {(step === 'size' || selectedVariant) && selectedColor && (
                <div>
                  <p className="text-sm font-medium mb-3">
                    {step === 'size' ? 'Selecione o tamanho:' : 'Tamanho selecionado:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sizesForColor.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => handleSizeSelect(variant)}
                        className={cn(
                          "px-4 py-3 rounded-xl border-2 font-medium transition-all touch-manipulation min-w-[4rem] text-center",
                          selectedVariant?.id === variant.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <span className="block text-base">{variant.size}</span>
                        <span className={cn(
                          "text-xs",
                          selectedVariant?.id === variant.id ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          {variant.stock_quantity} un
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selection */}
              {step === 'quantity' && selectedVariant && (
                <div>
                  <p className="text-sm font-medium mb-3">Quantidade:</p>
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-14 w-14 rounded-full touch-manipulation"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-6 w-6" />
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={getMaxStock()}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuantity(Math.min(Math.max(1, val), getMaxStock()));
                      }}
                      className="w-20 h-14 text-center text-2xl font-bold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-14 w-14 rounded-full touch-manipulation"
                      onClick={() => setQuantity(Math.min(getMaxStock(), quantity + 1))}
                      disabled={quantity >= getMaxStock()}
                    >
                      <Plus className="h-6 w-6" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Estoque: {getMaxStock()} unidades
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-row gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'quantity' && sizesForColor.length > 1) {
                setSelectedVariant(null);
                setStep('size');
              } else if (step === 'size' && uniqueColors.length > 1) {
                setSelectedColor(null);
                setSelectedVariant(null);
                setStep('color');
              } else {
                onOpenChange(false);
              }
            }}
            className="flex-1"
          >
            {step === 'color' || variants.length === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm()}
            className="flex-1"
          >
            Adicionar ({quantity})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
