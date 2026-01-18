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
  color: string | null;
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

type DialogStep = 'searching' | 'similar_matches' | 'color_selection' | 'size_selection' | 'quantity_confirmation' | 'auto_added';

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
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
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
      setSelectedColor(null);
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
      .select('id, color, size, stock_quantity, image_url')
      .eq('product_id', productId)
      .gt('stock_quantity', 0);
    
    if (error) {
      console.error('Error fetching variants:', error);
      return [];
    }
    
    // Sort by color then size
    return (data || []).sort((a, b) => {
      const colorCompare = (a.color || "").localeCompare(b.color || "");
      if (colorCompare !== 0) return colorCompare;
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
      // Extract search words for ilike query
      const searchWords = searchTerm.trim().split(/\s+/).filter(w => w.length > 1);
      const primarySearch = searchWords.slice(0, 2).join(' ');
      
      // Search for products with ilike
      const { data: similarData, error: similarError } = await supabase
        .from('products')
        .select('id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, image_url')
        .eq('owner_id', userId)
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .ilike('name', `%${primarySearch}%`)
        .limit(10);

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

      const normalizedSearch = normalizeText(searchTerm);
      const normalizedWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1);

      // Score products by match quality
      const scoredProducts = products.map(product => {
        const normalizedName = normalizeText(product.name);
        let score = 0;
        
        if (normalizedName === normalizedSearch) {
          score = 100;
        } else {
          const matchedWords = normalizedWords.filter(word => normalizedName.includes(word));
          score = (matchedWords.length / normalizedWords.length) * 80;
          
          if (normalizedName.includes(normalizedSearch)) {
            score += 15;
          }
          
          // Partial word matching
          for (const word of normalizedWords) {
            if (word.length >= 3) {
              const nameWords = normalizedName.split(/\s+/);
              for (const nameWord of nameWords) {
                if (nameWord.startsWith(word) || word.startsWith(nameWord)) {
                  score += 10;
                }
              }
            }
          }
        }

        return { product, score };
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

      // If single strong match, process it directly
      if (matches.length === 1 || (matches[0].score >= 85 && matches[0].score - (matches[1]?.score || 0) > 20)) {
        await processSelectedProduct(matches[0].product as Product);
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

      // Check unique colors
      const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))] as string[];
      
      // Try to match detected color from voice command
      const detectedColor = command?.color ? normalizeText(command.color) : null;
      const detectedSize = command?.size ? normalizeText(command.size) : null;
      
      // Try to find exact variant match - AUTO ADD TO CART if found
      if (detectedColor && detectedSize) {
        const exactMatch = variants.find(v => {
          const colorMatch = v.color && normalizeText(v.color).includes(detectedColor);
          const sizeMatch = normalizeText(v.size).includes(detectedSize);
          return colorMatch && sizeMatch;
        });
        
        if (exactMatch) {
          // AUTO-ADD: Directly add to cart and close dialog
          setSelectedColor(exactMatch.color);
          setSelectedVariant(exactMatch);
          setIsLoading(false);
          
          // Auto-add to cart immediately
          onProductSelected(product, exactMatch, command?.quantity || 1);
          onOpenChange(false);
          toast.success(`✓ ${product.name} - ${exactMatch.color || ''} ${exactMatch.size} adicionado!`);
          return;
        }
      }
      
      // Try to match just color
      if (detectedColor) {
        const colorMatch = variants.find(v => v.color && normalizeText(v.color).includes(detectedColor));
        if (colorMatch) {
          setSelectedColor(colorMatch.color);
          const sizesForColor = variants.filter(v => v.color === colorMatch.color);
          if (sizesForColor.length === 1) {
            setSelectedVariant(sizesForColor[0]);
            setStep('quantity_confirmation');
          } else {
            setStep('size_selection');
          }
          setIsLoading(false);
          return;
        }
      }

      // Multiple colors - show color selection
      if (uniqueColors.length > 1) {
        setStep('color_selection');
      } else if (uniqueColors.length === 1) {
        // Single color - move to size
        setSelectedColor(uniqueColors[0]);
        if (variants.length === 1) {
          setSelectedVariant(variants[0]);
          setStep('quantity_confirmation');
        } else {
          setStep('size_selection');
        }
      } else {
        // No colors but has sizes
        if (variants.length === 1) {
          setSelectedVariant(variants[0]);
          setStep('quantity_confirmation');
        } else {
          setStep('size_selection');
        }
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

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setSelectedVariant(null);
    const sizesForColor = productVariants.filter(v => (v.color || "Sem cor") === color);
    if (sizesForColor.length === 1) {
      setSelectedVariant(sizesForColor[0]);
      setStep('quantity_confirmation');
    } else {
      setStep('size_selection');
    }
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

  // Get unique colors with images
  const uniqueColors = useMemo(() => {
    const colorMap = new Map<string, { color: string; image: string | null; stock: number }>();
    productVariants.forEach(v => {
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
  }, [productVariants]);

  // Get sizes for selected color
  const sizesForColor = useMemo(() => {
    return productVariants.filter(v => (v.color || "Sem cor") === (selectedColor || "Sem cor"));
  }, [productVariants, selectedColor]);

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
                {similarProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductSelect(product)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all touch-manipulation",
                      "border-border hover:border-primary/50 hover:bg-accent/50"
                    )}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-primary font-semibold">
                        R$ {product.price.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Estoque: {product.stock_quantity} un
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Selection */}
          {step === 'color_selection' && selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <Package className="h-5 w-5 text-primary" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-primary font-semibold">
                    R$ {selectedProduct.price.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Selecione a cor:</p>
                <Badge variant="outline" className="text-xs">
                  {uniqueColors.length} cores disponíveis
                </Badge>
              </div>
              
              {/* Scrollable color grid for many colors */}
              <div className="max-h-[45vh] overflow-y-auto pr-1 -mr-1">
                <div className="grid grid-cols-2 gap-3">
                  {uniqueColors.map(({ color, image, stock }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorSelect(color)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center transition-all touch-manipulation active:scale-95",
                        selectedColor === color
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50 hover:bg-accent/30"
                      )}
                    >
                      {image ? (
                        <img
                          src={image}
                          alt={color}
                          className="h-16 w-16 rounded-xl object-cover flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center flex-shrink-0">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="w-full">
                        <p className="font-semibold text-sm truncate">{color}</p>
                        <p className="text-xs text-muted-foreground">{stock} un</p>
                      </div>
                      {selectedColor === color && (
                        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Size Selection */}
          {step === 'size_selection' && selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <Package className="h-5 w-5 text-primary" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{selectedProduct.name}</p>
                  {selectedColor && (
                    <Badge variant="secondary" className="mt-1">{selectedColor}</Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Selecione o tamanho:</p>
                <Badge variant="outline" className="text-xs">
                  {sizesForColor.length} tamanhos
                </Badge>
              </div>
              
              {/* Large touch-friendly size buttons */}
              <div className="max-h-[40vh] overflow-y-auto pr-1 -mr-1">
                <div className="grid grid-cols-3 gap-3">
                  {sizesForColor.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => handleSizeSelect(variant)}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 font-medium transition-all touch-manipulation min-h-[5rem] active:scale-95",
                        selectedVariant?.id === variant.id
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : "border-border hover:border-primary/50 hover:bg-accent/30"
                      )}
                    >
                      <span className="block text-xl font-bold">{variant.size}</span>
                      <span className={cn(
                        "text-xs mt-1",
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
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium">{selectedProduct.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedColor && <Badge variant="secondary">{selectedColor}</Badge>}
                    {selectedVariant && <Badge variant="outline">{selectedVariant.size}</Badge>}
                  </div>
                  <p className="text-primary font-semibold mt-1">
                    R$ {selectedProduct.price.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium text-center">Quantidade:</p>
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
              <p className="text-xs text-muted-foreground text-center">
                Estoque disponível: {getMaxStock()} un
              </p>
              
              {/* Total preview */}
              <div className="mt-4 p-3 rounded-xl bg-primary/10 text-center">
                <p className="text-sm text-muted-foreground">Total do item</p>
                <p className="text-2xl font-bold text-primary">
                  R$ {(selectedProduct.price * quantity).toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-row gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'quantity_confirmation' && (sizesForColor.length > 1 || productVariants.length > 1)) {
                if (selectedVariant && sizesForColor.length > 1) {
                  setSelectedVariant(null);
                  setStep('size_selection');
                } else if (selectedColor && uniqueColors.length > 1) {
                  setSelectedColor(null);
                  setSelectedVariant(null);
                  setStep('color_selection');
                } else if (selectedProduct) {
                  setSelectedProduct(null);
                  setProductVariants([]);
                  setStep('similar_matches');
                } else {
                  onOpenChange(false);
                }
              } else if (step === 'size_selection' && uniqueColors.length > 1) {
                setSelectedColor(null);
                setSelectedVariant(null);
                setStep('color_selection');
              } else if (step === 'color_selection' || step === 'size_selection') {
                setSelectedProduct(null);
                setProductVariants([]);
                setStep('similar_matches');
              } else {
                onOpenChange(false);
              }
            }}
            className="flex-1"
            disabled={isLoading}
          >
            {step === 'similar_matches' ? 'Cancelar' : 'Voltar'}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm() || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Adicionar ({quantity})</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
