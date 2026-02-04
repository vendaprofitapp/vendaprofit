import { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, Package, Minus, Plus, ShoppingCart, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductVariant {
  id: string;
  size: string;
  stock_quantity: number;
  image_url: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price?: number;
  stock_quantity: number;
  owner_id: string;
  group_id: string | null;
  category: string;
  color: string | null;
  size: string | null;
  image_url?: string | null;
}

interface VoiceSaleCommand {
  productSearch: string;
  quantity: number;
  color?: string | null;
  size?: string | null;
  customerName?: string | null;
  paymentMethod?: string | null;
}

interface VoiceSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: VoiceSaleCommand | null;
  userId: string;
  onProductSelected: (product: Product, variant: ProductVariant | null, quantity: number) => void;
}

type DialogStep = 'searching' | 'similar_matches' | 'size_selection' | 'quantity_confirmation' | 'auto_added';

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

export function VoiceSaleDialog({
  open,
  onOpenChange,
  command,
  userId,
  onProductSelected,
}: VoiceSaleDialogProps) {
  const [step, setStep] = useState<DialogStep>('searching');
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Reset and search when dialog opens with a command
  useEffect(() => {
    if (open && command) {
      setQuantity(command.quantity || 1);
      searchProducts(command.productSearch);
    } else {
      // Reset state when dialog closes
      setStep('searching');
      setSimilarProducts([]);
      setSelectedProduct(null);
      setProductVariants([]);
      setSelectedVariant(null);
      setQuantity(1);
    }
  }, [open, command]);

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  };

  // Fetch variants for a specific product
  const fetchProductVariants = async (productId: string): Promise<ProductVariant[]> => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('id, size, stock_quantity, image_url')
      .eq('product_id', productId)
      .gt('stock_quantity', 0);
    
    if (error) {
      console.error('Error fetching variants:', error);
      return [];
    }
    
    // Sort by size
    return (data || []).sort((a, b) => {
      return getSizeIndex(a.size) - getSizeIndex(b.size);
    });
  };

  const searchProducts = async (searchTerm: string) => {
    if (!searchTerm || !userId) {
      onOpenChange(false);
      return;
    }
    
    setStep('searching');
    setIsLoading(true);
    
    try {
      const normalizedSearch = normalizeText(searchTerm);
      const normalizedWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1);
      
      // Search for products with first word(s) - more flexible search
      const primarySearch = normalizedWords.slice(0, 2).join(' ');
      
      // Search for products with ilike
      const { data: similarData, error: similarError } = await supabase
        .from('products')
        .select('id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, image_url')
        .eq('owner_id', userId)
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .ilike('name', `%${primarySearch}%`)
        .limit(20);

      if (similarError) throw similarError;

      // Also fetch all active products for fallback scoring
      const { data: allProducts, error: allError } = await supabase
        .from('products')
        .select('id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, image_url')
        .eq('owner_id', userId)
        .eq('is_active', true)
        .gt('stock_quantity', 0);

      if (allError) throw allError;

      const products = similarData && similarData.length > 0 ? similarData : allProducts;

      if (!products || products.length === 0) {
        toast.error('Nenhum produto encontrado');
        onOpenChange(false);
        return;
      }

      // Fetch variants to match size in search term
      const productIds = products.map(p => p.id);
      const { data: variantsData } = await supabase
        .from('product_variants')
        .select('product_id, size, stock_quantity')
        .in('product_id', productIds)
        .gt('stock_quantity', 0);

      const variantsByProduct = new Map<string, Array<{ size: string; stock_quantity: number }>>();
      (variantsData || []).forEach(v => {
        const existing = variantsByProduct.get(v.product_id) || [];
        existing.push({ size: v.size, stock_quantity: v.stock_quantity });
        variantsByProduct.set(v.product_id, existing);
      });

      // Score products by match quality - considering variants
      const scoredProducts = products.map(product => {
        const normalizedName = normalizeText(product.name);
        const productVariants = variantsByProduct.get(product.id) || [];
        let score = 0;
        let matchedSize: string | null = null;
        
        // Identify words that match product name vs potential size
        const nameWords = normalizedName.split(/\s+/);
        const searchWordsMatchingName: string[] = [];
        const remainingSearchWords: string[] = [];
        
        for (const searchWord of normalizedWords) {
          const matchesName = nameWords.some(nw => nw.includes(searchWord) || searchWord.includes(nw));
          if (matchesName) {
            searchWordsMatchingName.push(searchWord);
          } else {
            remainingSearchWords.push(searchWord);
          }
        }

        // Score based on name match
        if (normalizedName === normalizedSearch) {
          score = 100;
        } else if (searchWordsMatchingName.length > 0) {
          // Good match if most name words are found
          score = (searchWordsMatchingName.length / Math.max(nameWords.length, 1)) * 70;
          
          if (normalizedName.includes(primarySearch)) {
            score += 20;
          }
        }
        
        // Check if remaining words match variant sizes
        for (const word of remainingSearchWords) {
          for (const variant of productVariants) {
            if (normalizeText(variant.size).includes(word)) {
              matchedSize = variant.size;
              score += 10; // Bonus for size match in variant
            }
          }
        }

        return { product, score, matchedSize };
      });

      const matches = scoredProducts
        .filter(sp => sp.score > 20)
        .sort((a, b) => b.score - a.score);

      if (matches.length === 0) {
        if (allProducts && allProducts.length > 0) {
          setSimilarProducts(allProducts.slice(0, 5) as Product[]);
          setStep('similar_matches');
        } else {
          toast.error('Nenhum produto encontrado');
          onOpenChange(false);
        }
        setIsLoading(false);
        return;
      }

      // If single strong match or best match has size already matched
      const bestMatch = matches[0];
      if (matches.length === 1 || 
          (bestMatch.score >= 70 && bestMatch.score - (matches[1]?.score || 0) > 15) ||
          bestMatch.matchedSize) {
        // Pass detected size to command for auto-selection
        if (bestMatch.matchedSize && command) {
          command.size = bestMatch.matchedSize;
        }
        await processSelectedProduct(bestMatch.product as Product);
      } else {
        // Multiple potential matches - show selection
        const uniqueProducts = new Map<string, Product>();
        for (const m of matches.slice(0, 8)) {
          const baseName = normalizeText(m.product.name);
          if (!uniqueProducts.has(baseName)) {
            uniqueProducts.set(baseName, m.product as Product);
          }
        }
        
        setSimilarProducts(Array.from(uniqueProducts.values()).slice(0, 6));
        setStep('similar_matches');
      }
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Erro ao buscar produtos');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const processSelectedProduct = async (product: Product) => {
    setSelectedProduct(product);
    setIsLoading(true);
    
    try {
      // Fetch variants
      const variants = await fetchProductVariants(product.id);
      setProductVariants(variants);
      
      // If no variants, go to quantity confirmation
      if (variants.length === 0) {
        setStep('quantity_confirmation');
        setIsLoading(false);
        return;
      }

      // Try to match detected size from voice command
      const detectedSize = command?.size ? normalizeText(command.size) : null;
      
      // Try to find exact variant match - AUTO ADD TO CART if found
      if (detectedSize) {
        const exactMatch = variants.find(v => {
          const sizeMatch = normalizeText(v.size).includes(detectedSize);
          return sizeMatch;
        });
        
        if (exactMatch) {
          // AUTO-ADD: Directly add to cart and close dialog
          setSelectedVariant(exactMatch);
          setIsLoading(false);
          
          // Auto-add to cart immediately
          onProductSelected(product, exactMatch, command?.quantity || 1);
          onOpenChange(false);
          toast.success(`✓ ${product.name} - ${exactMatch.size} adicionado!`);
          return;
        }
      }
      
      // Multiple sizes - show size selection
      if (variants.length === 1) {
        setSelectedVariant(variants[0]);
        setStep('quantity_confirmation');
      } else {
        setStep('size_selection');
      }
    } catch (error) {
      console.error('Error processing product:', error);
      toast.error('Erro ao carregar variantes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductSelect = async (product: Product) => {
    await processSelectedProduct(product);
  };

  const handleSizeSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setStep('quantity_confirmation');
  };

  const handleConfirm = () => {
    if (!selectedProduct) return;
    onProductSelected(selectedProduct, selectedVariant, quantity);
    onOpenChange(false);
  };

  const getMaxStock = () => {
    if (selectedVariant) return selectedVariant.stock_quantity;
    if (selectedProduct) return selectedProduct.stock_quantity;
    return 0;
  };

  const canConfirm = () => {
    if (!selectedProduct) return false;
    if (productVariants.length === 0) return quantity > 0 && quantity <= (selectedProduct.stock_quantity || 0);
    return selectedVariant && quantity > 0 && quantity <= selectedVariant.stock_quantity;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col !left-0 !top-auto !bottom-0 !translate-x-0 !translate-y-0 rounded-t-2xl sm:rounded-lg sm:!left-[50%] sm:!top-[50%] sm:!bottom-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Adicionar à Venda
          </DialogTitle>
          <DialogDescription>
            {command?.productSearch && (
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscando: "{command.productSearch}"
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Searching State */}
          {step === 'searching' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Buscando produtos...</p>
            </div>
          )}

          {/* Similar Products List */}
          {step === 'similar_matches' && (
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium text-muted-foreground">
                Selecione o produto:
              </p>
              <div className="space-y-2">
                {similarProducts.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductSelect(product)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-border hover:border-primary/50 transition-all text-left"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-sm text-primary font-semibold">
                        R$ {product.price.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selection */}
          {step === 'size_selection' && selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-primary font-semibold">
                    R$ {selectedProduct.price.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium mb-3">Selecione o tamanho:</p>
                <div className="flex flex-wrap gap-2">
                  {productVariants.map(variant => (
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
            </div>
          )}

          {/* Quantity Confirmation */}
          {step === 'quantity_confirmation' && selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{selectedProduct.name}</p>
                  {selectedVariant && (
                    <Badge variant="outline" className="mt-1">
                      {selectedVariant.size}
                    </Badge>
                  )}
                </div>
              </div>

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
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-row gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'quantity_confirmation' && productVariants.length > 1) {
                setSelectedVariant(null);
                setStep('size_selection');
              } else if (step === 'size_selection' && similarProducts.length > 1) {
                setSelectedProduct(null);
                setProductVariants([]);
                setStep('similar_matches');
              } else {
                onOpenChange(false);
              }
            }}
            className="flex-1"
          >
            {step === 'similar_matches' || (step === 'searching') ? 'Cancelar' : 'Voltar'}
          </Button>
          {(step === 'quantity_confirmation' || (step === 'size_selection' && productVariants.length === 0)) && (
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm()}
              className="flex-1"
            >
              Adicionar ({quantity})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
