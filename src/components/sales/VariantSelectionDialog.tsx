import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Minus, Plus, Package, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ProductVariant {
  id: string;
  product_id: string;
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
  onConfirm: (product: Product, variant: ProductVariant | null, quantity: number, isPartnerStock: boolean, ownerName?: string) => void;
  b2bSizes?: string[]; // Supplier sizes for B2B products
  isB2B?: boolean;
}

// Size ordering helper
const SIZE_ORDER = ['2', '4', '6', '8', '10', '12', '14',
  'PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'EG', 'EGG', 'EGGG', 
  'U', 'UN', 'UNICO', 'ÚNICO',
  '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
  '1', '3', '5', '7', '9', '11',
  '1/2', '3/4', '5/6', '7/8', '9/10', '11/12',
  'POTE 220 GRS', 'POTE 350 GRS', 'POTE 400 GRS', 'PACOTE 500 GRS', 'PACOTE 1 KG'];

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
  b2bSizes,
  isB2B,
}: VariantSelectionDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedB2BSize, setSelectedB2BSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<'size' | 'quantity'>('size');
  const b2bFetchedSizesRef = useRef<string[]>([]);

  // Reset state when dialog opens or product changes
  useEffect(() => {
    if (open && product) {
      setSelectedVariant(null);
      setSelectedB2BSize(null);
      setQuantity(1);
      
      // B2B mode: use supplier sizes directly, no DB fetch needed
      if (isB2B && b2bSizes && b2bSizes.length > 0) {
        setIsLoading(false);
        setVariants([]);
        if (b2bSizes.length === 1) {
          setSelectedB2BSize(b2bSizes[0]);
          setStep('quantity');
        } else {
          setStep('size');
        }
        return;
      }
      
      if (isB2B) {
        // B2B clone without explicit sizes - fetch variants from DB and treat as sob encomenda
        setIsLoading(true);
        setVariants([]);
        setStep('size');
        fetchB2BVariants(product);
        return;
      }
      
      setIsLoading(true);
      setVariants([]);
      setStep('size');
      fetchAllVariants(product);
    }
  }, [open, product?.id, isB2B, b2bSizes]);

  const fetchAllVariants = async (prod: Product) => {
    try {
      // Fetch ONLY own product variants (never partner variants)
      const { data: ownVariants, error: ownError } = await supabase
        .from("product_variants")
        .select("id, product_id, size, stock_quantity, image_url")
        .eq("product_id", prod.id)
        .gt("stock_quantity", 0)
        .order("size");

      if (ownError) throw ownError;

      const sortedData = (ownVariants || []).sort((a, b) => 
        getSizeIndex(a.size) - getSizeIndex(b.size)
      );

      setVariants(sortedData);

      // If no variants or only one, skip to quantity
      if (sortedData.length === 0) {
        setStep('quantity');
      } else if (sortedData.length === 1) {
        setSelectedVariant(sortedData[0]);
        setStep('quantity');
      } else {
        setStep('size');
      }
    } catch (error) {
      console.error("Error fetching variants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchB2BVariants = async (prod: Product) => {
    try {
      // Fetch ALL variants for B2B clone (regardless of stock - they are sob encomenda)
      const { data: variants, error } = await supabase
        .from("product_variants")
        .select("id, product_id, size, stock_quantity, image_url")
        .eq("product_id", prod.id)
        .order("size");

      if (error) throw error;

      const sizes = (variants || []).map(v => v.size).sort((a, b) => getSizeIndex(a) - getSizeIndex(b));
      
      if (sizes.length === 0) {
        setStep('quantity');
      } else if (sizes.length === 1) {
        setSelectedB2BSize(sizes[0]);
        setStep('quantity');
      } else {
        setStep('size');
      }
      // Store sizes in b2bSizes-like state via selectedB2BSize flow
      // We use variants as empty and rely on b2b size buttons
      setVariants([]);
      // Inject sizes into the component by setting a local ref
      b2bFetchedSizesRef.current = sizes;
    } catch (error) {
      console.error("Error fetching B2B variants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSizeSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setSelectedB2BSize(null);
    setQuantity(1);
    setStep('quantity');
  };

  const handleB2BSizeSelect = (size: string) => {
    setSelectedB2BSize(size);
    setSelectedVariant(null);
    setQuantity(1);
    setStep('quantity');
  };

  const handleConfirm = () => {
    if (!product) return;
    
    if (isB2B) {
      // For B2B, create a virtual variant with the selected supplier size
      const virtualVariant: ProductVariant | null = selectedB2BSize ? {
        id: `b2b_${product.id}_${selectedB2BSize}`,
        product_id: product.id,
        size: selectedB2BSize,
        stock_quantity: 999,
        image_url: null,
      } : null;
      onConfirm(product, virtualVariant, quantity, false);
      onOpenChange(false);
      return;
    }
    
    // Always own stock (partner variants no longer shown here)
    onConfirm(product, selectedVariant, quantity, false);
    onOpenChange(false);
  };

  const canConfirm = () => {
    const effectiveSizes = b2bSizes || b2bFetchedSizesRef.current;
    if (isB2B) {
      if (effectiveSizes && effectiveSizes.length > 0) {
        return !!selectedB2BSize && quantity > 0;
      }
      return quantity > 0;
    }
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
      <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[85vh] flex flex-col">
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
        ) : isB2B && (b2bSizes?.length || b2bFetchedSizesRef.current.length) > 0 ? (
          // B2B mode: show supplier sizes
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              {(step === 'size' || selectedB2BSize) && (
                <div>
                  <p className="text-sm font-medium mb-3">
                    {step === 'size' ? 'Selecione o tamanho:' : 'Tamanho selecionado:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(b2bSizes || b2bFetchedSizesRef.current).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleB2BSizeSelect(size)}
                        className={cn(
                          "px-4 py-3 rounded-xl border-2 font-medium transition-all touch-manipulation min-w-[4rem] text-center relative",
                          selectedB2BSize === size
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <span className="block text-base">{size}</span>
                        <span className={cn(
                          "text-xs",
                          selectedB2BSize === size ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          📦 Sob Encomenda
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'quantity' && selectedB2BSize && (
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
                      max={99}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuantity(Math.min(Math.max(1, val), 99));
                      }}
                      className="w-20 h-14 text-center text-2xl font-bold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-14 w-14 rounded-full touch-manipulation"
                      onClick={() => setQuantity(Math.min(99, quantity + 1))}
                      disabled={quantity >= 99}
                    >
                      <Plus className="h-6 w-6" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    📦 Produto sob encomenda do fornecedor
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : isB2B ? (
          // B2B without sizes - just quantity
          <div className="flex-1 flex flex-col items-center justify-center py-6 gap-4">
            <Badge variant="outline" className="text-sm">📦 Sob Encomenda</Badge>
            <div className="flex items-center gap-4">
              <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-full touch-manipulation" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                <Minus className="h-6 w-6" />
              </Button>
              <Input type="number" inputMode="numeric" min={1} max={99} value={quantity} onChange={(e) => { const val = parseInt(e.target.value) || 1; setQuantity(Math.min(Math.max(1, val), 99)); }} className="w-20 h-14 text-center text-2xl font-bold" />
              <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-full touch-manipulation" onClick={() => setQuantity(Math.min(99, quantity + 1))} disabled={quantity >= 99}>
                <Plus className="h-6 w-6" />
              </Button>
            </div>
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
              {/* Size Selection */}
              {(step === 'size' || selectedVariant) && (
                <div>
                  <p className="text-sm font-medium mb-3">
                    {step === 'size' ? 'Selecione o tamanho:' : 'Tamanho selecionado:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => handleSizeSelect(variant)}
                        className={cn(
                          "px-4 py-3 rounded-xl border-2 font-medium transition-all touch-manipulation min-w-[4rem] text-center relative",
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
              const effectiveSizes = b2bSizes || b2bFetchedSizesRef.current;
              if (step === 'quantity' && (variants.length > 1 || (isB2B && effectiveSizes && effectiveSizes.length > 1))) {
                setSelectedVariant(null);
                setSelectedB2BSize(null);
                setStep('size');
              } else {
                onOpenChange(false);
              }
            }}
            className="flex-1"
          >
            {step === 'size' || (variants.length === 0 && !(isB2B && (b2bSizes?.length || b2bFetchedSizesRef.current.length) > 1)) ? 'Cancelar' : 'Voltar'}
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
