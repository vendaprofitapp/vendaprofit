import { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, Plus, Package, ArrowDown, ArrowUp, Minus } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  stock_quantity: number;
  size: string | null;
  color: string | null;
  image_url: string | null;
  category: string;
}

interface VoiceStockCommand {
  operation: 'entry' | 'exit' | 'none';
  quantity: number;
  productSearch: string;
  color?: string | null;
  size?: string | null;
  isAmbiguous?: boolean;
  confidence?: number;
  rawText: string;
}

interface VoiceStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: VoiceStockCommand | null;
  userId: string;
  onSuccess: () => void;
  onCreateNewProduct: (productName: string) => void;
}

// Updated steps: color_selection for picking color, variant_selection for picking size
type DialogStep = 'searching' | 'exact_match' | 'similar_matches' | 'color_selection' | 'variant_selection' | 'no_match' | 'confirming' | 'success';

// Track quantities for each variant (from product_variants table)
interface VariantQuantity {
  variantId: string;
  productId: string;
  color: string | null;
  size: string;
  currentStock: number;
  quantity: number;
  image_url: string | null;
}

export function VoiceStockDialog({
  open,
  onOpenChange,
  command,
  userId,
  onSuccess,
  onCreateNewProduct,
}: VoiceStockDialogProps) {
  const [step, setStep] = useState<DialogStep>('searching');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [variantQuantities, setVariantQuantities] = useState<VariantQuantity[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<'entry' | 'exit'>('entry');

  // Search for products when command changes
  useEffect(() => {
    if (open && command) {
      // Set initial operation based on command (default to entry if none specified)
      if (command.operation === 'entry' || command.operation === 'exit') {
        setSelectedOperation(command.operation);
      } else {
        setSelectedOperation('entry');
      }
      searchProducts(command.productSearch);
    } else {
      // Reset state when dialog closes
      setStep('searching');
      setMatchedProduct(null);
      setSimilarProducts([]);
      setProductVariants([]);
      setVariantQuantities([]);
      setSelectedColor(null);
      setSelectedOperation('entry');
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

  // Fetch variants for a specific product from product_variants table
  const fetchProductVariants = async (productId: string): Promise<ProductVariant[]> => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('id, color, size, stock_quantity, image_url')
      .eq('product_id', productId);
    
    if (error) {
      console.error('Error fetching variants:', error);
      return [];
    }
    return data || [];
  };

  // Sort variants by size order
  const sortVariantsBySize = (variants: VariantQuantity[]): VariantQuantity[] => {
    const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG'];
    return [...variants].sort((a, b) => {
      // First sort by color
      const colorA = a.color || '';
      const colorB = b.color || '';
      if (colorA !== colorB) {
        return colorA.localeCompare(colorB);
      }
      // Then by size
      const idxA = sizeOrder.indexOf(a.size?.toUpperCase() || '');
      const idxB = sizeOrder.indexOf(b.size?.toUpperCase() || '');
      if (idxA >= 0 && idxB >= 0) return idxA - idxB;
      if (idxA >= 0) return -1;
      if (idxB >= 0) return 1;
      return (a.size || '').localeCompare(b.size || '');
    });
  };

  // Process product after identification - fetch variants and decide flow
  const processProductWithVariants = async (
    product: Product, 
    detectedColor: string | null, 
    detectedSize: string | null, 
    quantity: number
  ) => {
    setMatchedProduct(product);
    
    // Fetch all variants for this product from product_variants table
    const variants = await fetchProductVariants(product.id);
    setProductVariants(variants);
    
    // If no variants in product_variants table, use the product itself
    if (variants.length === 0) {
      // Product without variants - go directly to confirmation
      setSelectedColor(product.color);
      setVariantQuantities([{
        variantId: product.id, // Use product ID as variant ID
        productId: product.id,
        color: product.color,
        size: product.size || 'Único',
        currentStock: product.stock_quantity,
        quantity: quantity,
        image_url: product.image_url,
      }]);
      setStep('exact_match');
      return;
    }

    // Normalize detected values for matching
    const normalizedDetectedColor = detectedColor ? normalizeText(detectedColor) : null;
    const normalizedDetectedSize = detectedSize ? normalizeText(detectedSize) : null;

    // Try to find exact matching variant
    let matchingVariant: ProductVariant | null = null;
    
    if (normalizedDetectedColor && normalizedDetectedSize) {
      // Both color and size detected - try to find exact match
      matchingVariant = variants.find(v => {
        const variantColor = v.color ? normalizeText(v.color) : null;
        const variantSize = normalizeText(v.size);
        const colorMatches = variantColor && (
          variantColor.includes(normalizedDetectedColor) || 
          normalizedDetectedColor.includes(variantColor)
        );
        const sizeMatches = variantSize === normalizedDetectedSize || 
          variantSize.includes(normalizedDetectedSize) ||
          normalizedDetectedSize.includes(variantSize);
        return colorMatches && sizeMatches;
      }) || null;
    }

    if (matchingVariant) {
      // Exact variant found - pre-fill and show confirmation
      setSelectedColor(matchingVariant.color);
      setVariantQuantities([{
        variantId: matchingVariant.id,
        productId: product.id,
        color: matchingVariant.color,
        size: matchingVariant.size,
        currentStock: matchingVariant.stock_quantity,
        quantity: quantity,
        image_url: matchingVariant.image_url,
      }]);
      setStep('exact_match');
      return;
    }

    // No exact match - check if we need color selection first
    const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))] as string[];
    
    // If multiple colors and no color detected, show color selection grid
    if (uniqueColors.length > 1 && !normalizedDetectedColor) {
      // Prepare all variants but don't pre-select any
      const variantQtys = variants.map(v => ({
        variantId: v.id,
        productId: product.id,
        color: v.color,
        size: v.size,
        currentStock: v.stock_quantity,
        quantity: 0,
        image_url: v.image_url,
      }));
      setVariantQuantities(sortVariantsBySize(variantQtys));
      setStep('color_selection');
      return;
    }

    // If only color was detected, filter variants by that color
    if (normalizedDetectedColor) {
      const colorFilteredVariants = variants.filter(v => {
        const variantColor = v.color ? normalizeText(v.color) : null;
        return variantColor && (
          variantColor.includes(normalizedDetectedColor) || 
          normalizedDetectedColor.includes(variantColor)
        );
      });
      
      if (colorFilteredVariants.length > 0) {
        // Found variants with the detected color - show size selection
        setSelectedColor(colorFilteredVariants[0].color);
        const variantQtys = colorFilteredVariants.map(v => ({
          variantId: v.id,
          productId: product.id,
          color: v.color,
          size: v.size,
          currentStock: v.stock_quantity,
          quantity: normalizedDetectedSize && normalizeText(v.size).includes(normalizedDetectedSize) ? quantity : 0,
          image_url: v.image_url,
        }));
        setVariantQuantities(sortVariantsBySize(variantQtys));
        setStep('variant_selection');
        return;
      } else {
        // Color not found in variants - show color selection
        const variantQtys = variants.map(v => ({
          variantId: v.id,
          productId: product.id,
          color: v.color,
          size: v.size,
          currentStock: v.stock_quantity,
          quantity: 0,
          image_url: v.image_url,
        }));
        setVariantQuantities(sortVariantsBySize(variantQtys));
        setStep('color_selection');
        return;
      }
    }

    // If only size was detected but no color, show color selection first if multiple colors
    if (normalizedDetectedSize && uniqueColors.length > 1) {
      const variantQtys = variants.map(v => ({
        variantId: v.id,
        productId: product.id,
        color: v.color,
        size: v.size,
        currentStock: v.stock_quantity,
        quantity: normalizeText(v.size).includes(normalizedDetectedSize) ? quantity : 0,
        image_url: v.image_url,
      }));
      setVariantQuantities(sortVariantsBySize(variantQtys));
      setStep('color_selection');
      return;
    }

    // Single color or no colors - go straight to variant selection
    if (uniqueColors.length === 1) {
      setSelectedColor(uniqueColors[0]);
    }
    
    const variantQtys = variants.map(v => ({
      variantId: v.id,
      productId: product.id,
      color: v.color,
      size: v.size,
      currentStock: v.stock_quantity,
      quantity: normalizedDetectedSize && normalizeText(v.size).includes(normalizedDetectedSize) ? quantity : 0,
      image_url: v.image_url,
    }));
    setVariantQuantities(sortVariantsBySize(variantQtys));
    setStep('variant_selection');
  };

  const searchProducts = async (searchTerm: string) => {
    if (!searchTerm || !userId) return;
    
    setStep('searching');
    
    try {
      // Extract search words for ilike query
      const searchWords = searchTerm.trim().split(/\s+/).filter(w => w.length > 1);
      const primarySearch = searchWords.slice(0, 2).join(' '); // Use first 2 words for ilike
      
      // Search for products with ilike
      const { data: similarData, error: similarError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, size, color, image_url, category')
        .eq('owner_id', userId)
        .ilike('name', `%${primarySearch}%`)
        .limit(10);

      if (similarError) throw similarError;

      // Also fetch all products for fallback
      const { data: allProducts, error: allError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, size, color, image_url, category')
        .eq('owner_id', userId);

      if (allError) throw allError;

      const products = similarData && similarData.length > 0 ? similarData : allProducts;

      if (!products || products.length === 0) {
        setStep('no_match');
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
          setSimilarProducts(allProducts.slice(0, 5));
          setStep('similar_matches');
        } else {
          setStep('no_match');
        }
        return;
      }

      const isAmbiguous = command?.isAmbiguous || (command?.confidence && command.confidence < 0.6);
      
      // If ambiguous or multiple products with similar scores, show product selection
      if (isAmbiguous || (matches.length > 1 && matches[0].score < 85)) {
        const uniqueProducts = new Map<string, Product>();
        for (const m of matches.slice(0, 8)) {
          const baseName = normalizeText(m.product.name);
          if (!uniqueProducts.has(baseName)) {
            uniqueProducts.set(baseName, m.product);
          }
        }
        
        setSimilarProducts(Array.from(uniqueProducts.values()).slice(0, 5));
        setStep('similar_matches');
        return;
      }

      // Single best match - immediately fetch variants
      if (matches[0].score >= 50) {
        const product = matches[0].product;
        await processProductWithVariants(
          product, 
          command?.color || null, 
          command?.size || null, 
          command?.quantity || 1
        );
      } else {
        setSimilarProducts(matches.slice(0, 5).map(m => m.product));
        setStep('similar_matches');
      }

    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Erro ao buscar produtos');
      onOpenChange(false);
    }
  };

  // Get available colors from current variants
  const availableColors = useMemo(() => {
    if (productVariants.length === 0) return [];
    return [...new Set(productVariants.map(v => v.color).filter(Boolean))] as string[];
  }, [productVariants]);

  // Filter variants by selected color
  const filteredVariantQuantities = useMemo(() => {
    if (!selectedColor) return variantQuantities;
    return variantQuantities.filter(vq => 
      normalizeText(vq.color || '') === normalizeText(selectedColor)
    );
  }, [variantQuantities, selectedColor]);

  // Handle selecting a product from similar matches
  const handleSelectProduct = async (product: Product) => {
    await processProductWithVariants(
      product,
      command?.color || null,
      command?.size || null,
      command?.quantity || 1
    );
  };

  // Handle variant quantity changes
  const handleVariantQuantityChange = (variantId: string, delta: number) => {
    setVariantQuantities(prev => prev.map(vq => 
      vq.variantId === variantId 
        ? { ...vq, quantity: Math.max(0, vq.quantity + delta) } 
        : vq
    ));
  };

  const handleVariantQuantityInputChange = (variantId: string, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setVariantQuantities(prev => prev.map(vq => 
      vq.variantId === variantId ? { ...vq, quantity: numValue } : vq
    ));
  };

  // Handle color selection change (from dropdown)
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    // Reset quantities for the new color
    setVariantQuantities(prev => prev.map(vq => ({
      ...vq,
      quantity: normalizeText(vq.color || '') === normalizeText(color) ? vq.quantity : 0
    })));
  };

  // Handle color chip selection - go to size selection after picking color
  const handleColorChipSelect = (color: string) => {
    setSelectedColor(color);
    
    // Filter variants for this color and set quantity for detected size if any
    const detectedSize = command?.size ? normalizeText(command.size) : null;
    
    setVariantQuantities(prev => prev.map(vq => {
      const isMatchingColor = normalizeText(vq.color || '') === normalizeText(color);
      const isMatchingSize = detectedSize && normalizeText(vq.size).includes(detectedSize);
      return {
        ...vq,
        quantity: isMatchingColor && isMatchingSize ? (command?.quantity || 1) : (isMatchingColor ? 0 : 0)
      };
    }));
    
    // Move to variant/size selection
    setStep('variant_selection');
  };

  const totalQuantity = useMemo(() => {
    return variantQuantities.reduce((sum, vq) => sum + vq.quantity, 0);
  }, [variantQuantities]);

  const handleConfirmOperation = async () => {
    if (!command) return;

    // Filter only variants with quantity > 0
    const toUpdate = variantQuantities.filter(vq => vq.quantity > 0);
    
    if (toUpdate.length === 0) {
      toast.error('Informe a quantidade de pelo menos uma variante');
      return;
    }

    setIsProcessing(true);

    try {
      // Check if we're updating product_variants or products table
      const hasRealVariants = productVariants.length > 0;

      console.log('[VoiceStock] Iniciando atualização de estoque:', {
        hasRealVariants,
        operation: selectedOperation,
        toUpdate: toUpdate.map(vq => ({
          variantId: vq.variantId,
          productId: vq.productId,
          color: vq.color,
          size: vq.size,
          currentStock: vq.currentStock,
          quantity: vq.quantity,
        }))
      });

      const results = await Promise.all(
        toUpdate.map(async (vq) => {
          const newQuantity = selectedOperation === 'entry'
            ? vq.currentStock + vq.quantity
            : Math.max(0, vq.currentStock - vq.quantity);

          console.log(`[VoiceStock] Atualizando ${hasRealVariants ? 'product_variants' : 'products'}:`, {
            id: hasRealVariants ? vq.variantId : vq.productId,
            newQuantity,
          });

          if (hasRealVariants) {
            // Update product_variants table
            const { data, error } = await supabase
              .from('product_variants')
              .update({ stock_quantity: newQuantity })
              .eq('id', vq.variantId)
              .select();

            if (error) {
              console.error('[VoiceStock] Erro RLS/FK ao atualizar product_variants:', {
                variantId: vq.variantId,
                error: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
              });
            } else {
              console.log('[VoiceStock] Sucesso ao atualizar product_variants:', data);
            }

            return { data, error, variantId: vq.variantId };
          } else {
            // Update products table (product without variants)
            const { data, error } = await supabase
              .from('products')
              .update({ stock_quantity: newQuantity })
              .eq('id', vq.productId)
              .select();

            if (error) {
              console.error('[VoiceStock] Erro RLS/FK ao atualizar products:', {
                productId: vq.productId,
                error: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
              });
            } else {
              console.log('[VoiceStock] Sucesso ao atualizar products:', data);
            }

            return { data, error, productId: vq.productId };
          }
        })
      );

      // Check for errors in results
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error('[VoiceStock] Erros encontrados:', errors);
        throw new Error(`Erro ao atualizar ${errors.length} item(s)`);
      }

      // IMPORTANT: if product has variants, also sync the main product stock_quantity
      // so lists/dashboards that read from `products.stock_quantity` reflect the change.
      if (hasRealVariants) {
        const productIdsToSync = Array.from(new Set(toUpdate.map(vq => vq.productId)));

        const syncResults = await Promise.all(
          productIdsToSync.map(async (productId) => {
            const { data: allVariants, error: variantsError } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('product_id', productId);

            if (variantsError) {
              console.error('[VoiceStock] Erro ao buscar variants para sync do produto:', {
                productId,
                error: variantsError.message,
                code: variantsError.code,
                details: variantsError.details,
                hint: variantsError.hint,
              });
              return { productId, error: variantsError };
            }

            const totalVariantStock = allVariants?.reduce((sum, v) => sum + (v.stock_quantity || 0), 0) || 0;

            const { error: productUpdateError } = await supabase
              .from('products')
              .update({ stock_quantity: totalVariantStock })
              .eq('id', productId);

            if (productUpdateError) {
              console.error('[VoiceStock] Erro RLS/FK ao sincronizar products.stock_quantity:', {
                productId,
                error: productUpdateError.message,
                code: productUpdateError.code,
                details: productUpdateError.details,
                hint: productUpdateError.hint,
              });
              return { productId, error: productUpdateError };
            }

            console.log('[VoiceStock] products.stock_quantity sincronizado:', { productId, totalVariantStock });
            return { productId, error: null };
          })
        );

        const syncErrors = syncResults.filter(r => r.error);
        if (syncErrors.length > 0) {
          throw new Error('Erro ao sincronizar estoque do produto');
        }
      }

      // Only show success after database confirmation (updates + sync)
      setStep('success');

      const sizesUpdated = toUpdate.map(vq => `${vq.color || ''} ${vq.size}`.trim() || 'Único').join(', ');
      toast.success(
        selectedOperation === 'entry'
          ? `Entrada registrada! Total: ${totalQuantity} un. (${sizesUpdated})`
          : `Saída registrada! Total: ${totalQuantity} un. (${sizesUpdated})`
      );

      // Close dialog after success message
      setTimeout(() => {
        onOpenChange(false);
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error('[VoiceStock] Erro geral na operação:', error);
      toast.error('Erro ao atualizar estoque. Verifique o console para detalhes.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNew = () => {
    onOpenChange(false);
    if (command) {
      onCreateNewProduct(command.productSearch);
    }
  };

  const getOperationLabel = () => {
    return selectedOperation === 'entry' ? 'Entrada' : 'Saída';
  };

  const getOperationIcon = () => {
    return selectedOperation === 'entry' 
      ? <ArrowDown className="h-4 w-4 text-green-500" />
      : <ArrowUp className="h-4 w-4 text-red-500" />;
  };

  // Helper to render operation toggle buttons
  const renderOperationToggle = () => (
    <div className="flex gap-2 p-1 bg-muted rounded-lg">
      <button
        onClick={() => setSelectedOperation('entry')}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-md font-medium text-sm transition-all touch-manipulation",
          selectedOperation === 'entry'
            ? "bg-green-500 text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowDown className="h-4 w-4" />
        Entrada
      </button>
      <button
        onClick={() => setSelectedOperation('exit')}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-md font-medium text-sm transition-all touch-manipulation",
          selectedOperation === 'exit'
            ? "bg-red-500 text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowUp className="h-4 w-4" />
        Saída
      </button>
    </div>
  );

  const renderVariantQuantityRow = (vq: VariantQuantity) => (
    <div key={vq.variantId} className="flex items-center gap-2 py-2 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {vq.color && (
            <Badge variant="outline" className="text-xs">
              {vq.color}
            </Badge>
          )}
          <span className="font-medium text-sm">{vq.size}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Estoque: {vq.currentStock}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleVariantQuantityChange(vq.variantId, -1)}
          disabled={vq.quantity <= 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          min={0}
          value={vq.quantity}
          onChange={(e) => handleVariantQuantityInputChange(vq.variantId, e.target.value)}
          className="text-center w-14 h-7 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleVariantQuantityChange(vq.variantId, 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {vq.quantity > 0 && (
        <div className="text-xs text-muted-foreground w-12 text-right">
          → {selectedOperation === 'entry' 
            ? vq.currentStock + vq.quantity
            : Math.max(0, vq.currentStock - vq.quantity)
          }
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6 gap-3 sm:gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getOperationIcon()}
            {getOperationLabel()} de Estoque por Voz
          </DialogTitle>
          <DialogDescription>
            {command && (
              <span className="italic">"{command.rawText}"</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Searching State */}
        {step === 'searching' && (
          <div className="py-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Buscando produto...</p>
          </div>
        )}

        {/* Exact Match - Ready to confirm */}
        {step === 'exact_match' && matchedProduct && command && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              {variantQuantities[0]?.image_url || matchedProduct.image_url ? (
                <img 
                  src={variantQuantities[0]?.image_url || matchedProduct.image_url || ''} 
                  alt={matchedProduct.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{matchedProduct.name}</p>
                {variantQuantities[0] && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {variantQuantities[0].color && <span>{variantQuantities[0].color}</span>}
                    {variantQuantities[0].size && <span>• {variantQuantities[0].size}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Show detected info */}
            {(command?.color || command?.size) && (
              <div className="flex flex-wrap gap-2">
                {command?.color && (
                  <Badge variant="secondary" className="text-xs">
                    ✓ Cor: {command.color}
                  </Badge>
                )}
                {command?.size && (
                  <Badge variant="secondary" className="text-xs">
                    ✓ Tamanho: {command.size}
                  </Badge>
                )}
              </div>
            )}

            {/* Operation toggle */}
            {renderOperationToggle()}

            {/* Quantity display */}
            <div className="border rounded-lg p-3 bg-background">
              {variantQuantities.map(vq => renderVariantQuantityRow(vq))}
            </div>
            
            {totalQuantity > 0 && (
              <div className="text-center space-y-1 pt-2 border-t">
                <p className="text-lg font-semibold">
                  {selectedOperation === 'entry' ? '+' : '-'}{totalQuantity} unidade(s)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Color Selection - Large touch-friendly color chips */}
        {step === 'color_selection' && matchedProduct && command && (
          <div className="py-3 space-y-3">
            <div className="flex items-center gap-3 p-2 sm:p-3 rounded-lg bg-secondary/50">
              {matchedProduct.image_url ? (
                <img 
                  src={matchedProduct.image_url} 
                  alt={matchedProduct.name}
                  className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-5 w-5 sm:h-7 sm:w-7 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base sm:text-lg truncate">{matchedProduct.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Toque para selecionar a cor
                </p>
              </div>
            </div>

            {/* Large color chips grid - optimized for one-hand use */}
            <div className="space-y-2">
              <Label className="text-sm sm:text-base font-medium">Qual cor?</Label>
              <div className="max-h-[45dvh] sm:max-h-[400px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 p-1">
                  {availableColors.map((color) => {
                    // Get stock count for this color
                    const colorVariants = variantQuantities.filter(vq => 
                      normalizeText(vq.color || '') === normalizeText(color)
                    );
                    const totalStock = colorVariants.reduce((sum, vq) => sum + vq.currentStock, 0);
                    const sizesAvailable = colorVariants.map(vq => vq.size).join(', ');
                    
                    return (
                      <button
                        key={color}
                        onClick={() => handleColorChipSelect(color)}
                        className="flex flex-col items-start p-3 sm:p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 active:bg-primary/10 active:scale-[0.98] transition-all text-left min-h-[72px] sm:min-h-[88px] touch-manipulation"
                      >
                        <span className="font-semibold text-sm sm:text-base">{color}</span>
                        <span className="text-[11px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                          {sizesAvailable}
                        </span>
                        <Badge variant="secondary" className="mt-2 text-[11px] sm:text-xs">
                          {totalStock} em estoque
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Show detected size if any */}
            {command?.size && (
              <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50">
                <Badge variant="outline" className="text-xs sm:text-sm">
                  Tamanho detectado: {command.size}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Variant Selection - User needs to pick size/quantity */}
        {step === 'variant_selection' && matchedProduct && command && (
          <div className="py-3 space-y-3">
            <div className="flex items-center gap-3 p-2 sm:p-3 rounded-lg bg-secondary/50">
              {matchedProduct.image_url ? (
                <img 
                  src={matchedProduct.image_url} 
                  alt={matchedProduct.name}
                  className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-5 w-5 sm:h-7 sm:w-7 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base sm:text-lg truncate">{matchedProduct.name}</p>
                {selectedColor && (
                  <Badge variant="default" className="mt-1">
                    {selectedColor}
                  </Badge>
                )}
              </div>
            </div>

            {/* Back to color selection if needed */}
            {availableColors.length > 1 && selectedColor && (
              <button
                onClick={() => setStep('color_selection')}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                ← Trocar cor
              </button>
            )}

            {/* Operation toggle */}
            {renderOperationToggle()}

            {/* Size selection with large touch targets */}
            <div className="space-y-2">
              <Label className="text-sm sm:text-base font-medium">Quantidade por tamanho</Label>
              <div className="border rounded-xl bg-background">
                <div className="max-h-[45dvh] sm:max-h-[400px] overflow-y-auto p-2 sm:p-3 space-y-1">
                  {filteredVariantQuantities.map(vq => (
                    <div key={vq.variantId} className="flex items-center gap-3 py-2 sm:py-3 border-b last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm sm:text-base">{vq.size}</span>
                        <div className="text-[11px] sm:text-xs text-muted-foreground">
                          Estoque: {vq.currentStock}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 sm:h-12 sm:w-12 rounded-full touch-manipulation"
                          onClick={() => handleVariantQuantityChange(vq.variantId, -1)}
                          disabled={vq.quantity <= 0}
                        >
                          <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          value={vq.quantity}
                          onChange={(e) => handleVariantQuantityInputChange(vq.variantId, e.target.value)}
                          className="text-center w-14 sm:w-16 h-10 sm:h-12 text-base sm:text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 sm:h-12 sm:w-12 rounded-full touch-manipulation"
                          onClick={() => handleVariantQuantityChange(vq.variantId, 1)}
                        >
                          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                      </div>
                      {vq.quantity > 0 && (
                        <div className="text-sm text-muted-foreground w-12 text-right">
                          → {selectedOperation === 'entry' 
                            ? vq.currentStock + vq.quantity
                            : Math.max(0, vq.currentStock - vq.quantity)
                          }
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {totalQuantity > 0 && (
              <div className="text-center space-y-1 pt-2 border-t">
                <p className="text-lg sm:text-xl font-bold">
                  {selectedOperation === 'entry' ? '+' : '-'}{totalQuantity} unidade(s)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Similar Matches - User needs to pick product */}
        {step === 'similar_matches' && (
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-2">
              Encontramos produtos similares. Selecione o correto:
            </p>
            
            {/* Show AI-detected info */}
            {(command?.color || command?.size) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {command?.color && (
                  <Badge variant="secondary" className="text-xs">
                    Cor detectada: {command.color}
                  </Badge>
                )}
                {command?.size && (
                  <Badge variant="secondary" className="text-xs">
                    Tamanho detectado: {command.size}
                  </Badge>
                )}
              </div>
            )}
            
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {/* New Product Option */}
                <button
                  onClick={handleCreateNew}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">+ Novo Produto</p>
                    <p className="text-sm text-muted-foreground">
                      Cadastrar "{command?.productSearch}"
                    </p>
                  </div>
                </button>

                {similarProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-primary hover:bg-secondary/50 transition-colors text-left"
                  >
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {product.size && <span>{product.size}</span>}
                        {product.color && <span>• {product.color}</span>}
                        <Badge variant="secondary" className="ml-auto">
                          {product.stock_quantity} un.
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* No Match */}
        {step === 'no_match' && (
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Produto não encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Não encontramos "{command?.productSearch}" no seu estoque.
              </p>
            </div>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Novo Produto
            </Button>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="py-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium text-lg">Estoque atualizado!</p>
          </div>
        )}

        {/* Footer */}
        {(step === 'exact_match' || step === 'variant_selection') && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmOperation} 
              disabled={isProcessing || totalQuantity === 0}
              className="min-h-[44px] text-base"
            >
              {isProcessing ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        )}

        {step === 'color_selection' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
              Cancelar
            </Button>
          </DialogFooter>
        )}

        {step === 'no_match' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
