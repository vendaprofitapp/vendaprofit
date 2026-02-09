import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Minus, Plus, Package, Check, Users } from "lucide-react";
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

// Extended variant with partner info
interface ExtendedVariant extends ProductVariant {
  isPartner: boolean;
  ownerName?: string;
  ownerId?: string;
  productName?: string;
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

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface VariantSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onConfirm: (product: Product, variant: ExtendedVariant | null, quantity: number, isPartnerStock: boolean, ownerName?: string) => void;
  userGroups?: string[];
  profiles?: Profile[];
  userId?: string;
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
  userGroups = [],
  profiles = [],
  userId,
}: VariantSelectionDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [variants, setVariants] = useState<ExtendedVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ExtendedVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<'size' | 'quantity'>('size');

  // Reset state when dialog opens or product changes
  useEffect(() => {
    if (open && product) {
      setIsLoading(true);
      setVariants([]);
      setSelectedVariant(null);
      setQuantity(1);
      setStep('size');
      fetchAllVariants(product);
    }
  }, [open, product?.id]);

  const fetchAllVariants = async (prod: Product) => {
    try {
      // Fetch own product variants
      const { data: ownVariants, error: ownError } = await supabase
        .from("product_variants")
        .select("id, product_id, size, stock_quantity, image_url")
        .eq("product_id", prod.id)
        .gt("stock_quantity", 0)
        .order("size");

      if (ownError) throw ownError;

      // Map own variants with partner flag = false
      const ownExtended: ExtendedVariant[] = (ownVariants || []).map(v => ({
        ...v,
        isPartner: false,
        ownerId: prod.owner_id,
      }));

      // Fetch partner product variants (same name, different owner, in shared groups)
      let partnerExtended: ExtendedVariant[] = [];
      
      if (userGroups.length > 0 && userId) {
        // Normalize the product name for comparison (remove extra spaces, lowercase)
        const normalizedName = prod.name.toLowerCase().trim().replace(/\s+/g, ' ');
        
        // Find partner products with same name that are shared with user
        const { data: partnerProducts, error: partnerError } = await supabase
          .from("product_partnerships")
          .select(`
            group_id,
            product:products!inner(
              id, 
              name, 
              price, 
              owner_id, 
              stock_quantity
            )
          `)
          .in("group_id", userGroups)
          .neq("products.owner_id", userId)
          .eq("products.is_active", true);

        if (!partnerError && partnerProducts) {
          // Get unique partner product IDs that match the name (normalized comparison)
          const partnerProductIds = new Set<string>();
          const productOwnerMap = new Map<string, string>();
          
          for (const pp of partnerProducts) {
            const p = (pp as any).product;
            if (p && p.id !== prod.id) {
              // Normalize partner product name for comparison
              const partnerNormalizedName = p.name.toLowerCase().trim().replace(/\s+/g, ' ');
              
              // Match if names are equal after normalization
              if (partnerNormalizedName === normalizedName) {
                partnerProductIds.add(p.id);
                productOwnerMap.set(p.id, p.owner_id);
              }
            }
          }

          if (partnerProductIds.size > 0) {
            // Fetch variants for partner products
            const { data: pVariants, error: pVarError } = await supabase
              .from("product_variants")
              .select("id, product_id, size, stock_quantity, image_url")
              .in("product_id", Array.from(partnerProductIds))
              .gt("stock_quantity", 0)
              .order("size");

            if (!pVarError && pVariants) {
              partnerExtended = pVariants.map(v => {
                const ownerId = productOwnerMap.get(v.product_id);
                const owner = profiles.find(p => p.id === ownerId);
                return {
                  ...v,
                  isPartner: true,
                  ownerId: ownerId,
                  ownerName: owner?.full_name || "Parceira",
                };
              });
            }
          }
        }
      }

      // Combine and sort all variants
      const allVariants = [...ownExtended, ...partnerExtended];
      
      const sortedData = allVariants.sort((a, b) => {
        // Own variants first
        if (a.isPartner !== b.isPartner) return a.isPartner ? 1 : -1;
        return getSizeIndex(a.size) - getSizeIndex(b.size);
      });

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

  const handleSizeSelect = (variant: ExtendedVariant) => {
    setSelectedVariant(variant);
    setQuantity(1);
    setStep('quantity');
  };

  const handleConfirm = () => {
    if (!product) return;
    const isPartner = selectedVariant?.isPartner || false;
    const ownerName = selectedVariant?.ownerName;
    onConfirm(product, selectedVariant, quantity, isPartner, ownerName);
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
                        {variant.isPartner && (
                          <span className={cn(
                            "block text-[10px] mt-0.5",
                            selectedVariant?.id === variant.id ? "text-primary-foreground/70" : "text-amber-600"
                          )}>
                            {variant.ownerName || "Parceira"}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selection */}
              {step === 'quantity' && selectedVariant && (
                <div>
                  <p className="text-sm font-medium mb-3">Quantidade:</p>
                  {selectedVariant.isPartner && (
                    <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800">
                      <Users className="h-4 w-4" />
                      <span>Estoque da <strong>{selectedVariant.ownerName}</strong></span>
                    </div>
                  )}
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
              if (step === 'quantity' && variants.length > 1) {
                setSelectedVariant(null);
                setStep('size');
              } else {
                onOpenChange(false);
              }
            }}
            className="flex-1"
          >
            {step === 'size' || variants.length === 0 ? 'Cancelar' : 'Voltar'}
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
