import { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, Plus, Package, ArrowDown, ArrowUp, Minus } from 'lucide-react';
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
  operation: 'entry' | 'exit';
  quantity: number;
  productSearch: string;
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

type DialogStep = 'searching' | 'exact_match' | 'similar_matches' | 'no_match' | 'confirming' | 'success';

// Map to track quantities for each size variant
interface SizeQuantity {
  productId: string;
  size: string | null;
  currentStock: number;
  quantity: number;
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
  const [allVariants, setAllVariants] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Editable fields
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [sizeQuantities, setSizeQuantities] = useState<SizeQuantity[]>([]);

  // Search for products when command changes
  useEffect(() => {
    if (open && command) {
      searchProducts(command.productSearch);
    } else {
      // Reset state when dialog closes
      setStep('searching');
      setMatchedProduct(null);
      setSimilarProducts([]);
      setAllVariants([]);
      setSelectedColor(null);
      setSizeQuantities([]);
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

  const searchProducts = async (searchTerm: string) => {
    if (!searchTerm || !userId) return;
    
    setStep('searching');
    
    try {
      // Fetch all user's products
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, size, color, image_url, category')
        .eq('owner_id', userId);

      if (error) throw error;

      if (!products || products.length === 0) {
        setStep('no_match');
        return;
      }

      // Store all products for variant lookup
      setAllVariants(products);

      const normalizedSearch = normalizeText(searchTerm);
      const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1);

      // Score products by match quality
      const scoredProducts = products.map(product => {
        const normalizedName = normalizeText(product.name);
        const normalizedSize = product.size ? normalizeText(product.size) : '';
        const normalizedColor = product.color ? normalizeText(product.color) : '';
        const fullText = `${normalizedName} ${normalizedSize} ${normalizedColor}`;
        
        let score = 0;
        
        // Exact match
        if (normalizedName === normalizedSearch) {
          score = 100;
        } 
        // Check if all search words are found
        else {
          const matchedWords = searchWords.filter(word => fullText.includes(word));
          score = (matchedWords.length / searchWords.length) * 80;
          
          // Bonus for consecutive words matching
          if (normalizedName.includes(normalizedSearch)) {
            score += 15;
          }
        }

        return { product, score };
      });

      // Filter products with score > 30 and sort by score
      const matches = scoredProducts
        .filter(sp => sp.score > 30)
        .sort((a, b) => b.score - a.score);

      if (matches.length === 0) {
        setStep('no_match');
        return;
      }

      // If best match has very high score (>85), consider it exact
      if (matches[0].score > 85) {
        const product = matches[0].product;
        setMatchedProduct(product);
        setSelectedColor(product.color);
        initializeSizeQuantities(product, products, product.color, command?.quantity || 1);
        setStep('exact_match');
      } else {
        // Show similar matches
        setSimilarProducts(matches.slice(0, 5).map(m => m.product));
        setStep('similar_matches');
      }

    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Erro ao buscar produtos');
      onOpenChange(false);
    }
  };

  // Initialize size quantities when product/color changes
  const initializeSizeQuantities = (product: Product, variants: Product[], color: string | null, defaultQty: number) => {
    const baseName = normalizeText(product.name);
    
    // Find all variants with same name and color
    const colorVariants = variants.filter(p => 
      normalizeText(p.name) === baseName && p.color === color
    );
    
    // Get unique sizes for this color
    const uniqueSizes = [...new Set(colorVariants.map(p => p.size))];
    
    // If only one size or no size variations, create a single entry
    if (uniqueSizes.length <= 1) {
      const variant = colorVariants[0] || product;
      setSizeQuantities([{
        productId: variant.id,
        size: variant.size,
        currentStock: variant.stock_quantity,
        quantity: defaultQty,
      }]);
    } else {
      // Create entries for all sizes, sorted
      const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG'];
      const sorted = uniqueSizes.sort((a, b) => {
        const idxA = sizeOrder.indexOf(a?.toUpperCase() || '');
        const idxB = sizeOrder.indexOf(b?.toUpperCase() || '');
        if (idxA >= 0 && idxB >= 0) return idxA - idxB;
        if (idxA >= 0) return -1;
        if (idxB >= 0) return 1;
        return (a || '').localeCompare(b || '');
      });
      
      const quantities = sorted.map(size => {
        const variant = colorVariants.find(p => p.size === size);
        return {
          productId: variant?.id || product.id,
          size: size,
          currentStock: variant?.stock_quantity || 0,
          quantity: 0, // Start with 0, user will fill in
        };
      });
      
      setSizeQuantities(quantities);
    }
  };

  // Get available colors for the matched product name
  const availableColors = useMemo(() => {
    if (!matchedProduct) return [];
    
    // Find all products with the same base name
    const baseName = normalizeText(matchedProduct.name);
    const variants = allVariants.filter(p => normalizeText(p.name) === baseName);
    
    return [...new Set(variants.map(p => p.color).filter(Boolean))] as string[];
  }, [matchedProduct, allVariants]);

  // When color changes, reinitialize size quantities
  useEffect(() => {
    if (matchedProduct && selectedColor !== undefined) {
      initializeSizeQuantities(matchedProduct, allVariants, selectedColor, command?.quantity || 1);
    }
  }, [selectedColor]);

  // Find sample product image for display
  const displayProduct = useMemo(() => {
    if (!matchedProduct) return null;
    
    const baseName = normalizeText(matchedProduct.name);
    const variant = allVariants.find(p => 
      normalizeText(p.name) === baseName && p.color === selectedColor
    );
    
    return variant || matchedProduct;
  }, [matchedProduct, allVariants, selectedColor]);

  const handleSelectProduct = (product: Product) => {
    setMatchedProduct(product);
    setSelectedColor(product.color);
    initializeSizeQuantities(product, allVariants, product.color, command?.quantity || 1);
    setStep('confirming');
  };

  const handleSizeQuantityChange = (index: number, delta: number) => {
    setSizeQuantities(prev => prev.map((sq, i) => 
      i === index ? { ...sq, quantity: Math.max(0, sq.quantity + delta) } : sq
    ));
  };

  const handleSizeQuantityInputChange = (index: number, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setSizeQuantities(prev => prev.map((sq, i) => 
      i === index ? { ...sq, quantity: numValue } : sq
    ));
  };

  const totalQuantity = useMemo(() => {
    return sizeQuantities.reduce((sum, sq) => sum + sq.quantity, 0);
  }, [sizeQuantities]);

  const handleConfirmOperation = async () => {
    if (!command) return;

    // Filter only sizes with quantity > 0
    const toUpdate = sizeQuantities.filter(sq => sq.quantity > 0);
    
    if (toUpdate.length === 0) {
      toast.error('Informe a quantidade de pelo menos um tamanho');
      return;
    }

    setIsProcessing(true);

    try {
      // Update all products in parallel
      const updates = toUpdate.map(async (sq) => {
        const newQuantity = command.operation === 'entry'
          ? sq.currentStock + sq.quantity
          : Math.max(0, sq.currentStock - sq.quantity);

        return supabase
          .from('products')
          .update({ stock_quantity: newQuantity })
          .eq('id', sq.productId);
      });

      const results = await Promise.all(updates);
      
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error('Erro ao atualizar alguns produtos');
      }

      setStep('success');
      
      const sizesUpdated = toUpdate.map(sq => sq.size || 'Único').join(', ');
      toast.success(
        command.operation === 'entry'
          ? `Entrada registrada! Total: ${totalQuantity} un. (${sizesUpdated})`
          : `Saída registrada! Total: ${totalQuantity} un. (${sizesUpdated})`
      );

      // Close dialog after success message
      setTimeout(() => {
        onOpenChange(false);
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Erro ao atualizar estoque');
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
    if (!command) return '';
    return command.operation === 'entry' ? 'Entrada' : 'Saída';
  };

  const getOperationIcon = () => {
    if (!command) return null;
    return command.operation === 'entry' 
      ? <ArrowDown className="h-4 w-4 text-green-500" />
      : <ArrowUp className="h-4 w-4 text-red-500" />;
  };

  const renderSizeQuantityRow = (sq: SizeQuantity, index: number) => (
    <div key={sq.productId} className="flex items-center gap-2 py-2 border-b last:border-b-0">
      <div className="w-16 font-medium text-sm">
        {sq.size || 'Único'}
      </div>
      <div className="text-xs text-muted-foreground w-16">
        Est: {sq.currentStock}
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleSizeQuantityChange(index, -1)}
          disabled={sq.quantity <= 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          min={0}
          value={sq.quantity}
          onChange={(e) => handleSizeQuantityInputChange(index, e.target.value)}
          className="text-center w-14 h-7 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleSizeQuantityChange(index, 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {sq.quantity > 0 && (
        <div className="text-xs text-muted-foreground w-16 text-right">
          → {command?.operation === 'entry' 
            ? sq.currentStock + sq.quantity
            : Math.max(0, sq.currentStock - sq.quantity)
          }
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

        {/* Exact Match - Confirm with editable options */}
        {step === 'exact_match' && matchedProduct && displayProduct && command && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              {displayProduct.image_url ? (
                <img 
                  src={displayProduct.image_url} 
                  alt={displayProduct.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{displayProduct.name}</p>
                {selectedColor && (
                  <p className="text-sm text-muted-foreground">Cor: {selectedColor}</p>
                )}
              </div>
            </div>

            {/* Editable Color */}
            {availableColors.length > 1 && (
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select value={selectedColor || ''} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a cor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Size Quantities */}
            <div className="space-y-2">
              <Label>
                {sizeQuantities.length > 1 ? 'Quantidade por Tamanho' : 'Quantidade'}
              </Label>
              <div className="border rounded-lg p-2 bg-background">
                <ScrollArea className={sizeQuantities.length > 4 ? 'max-h-[200px]' : ''}>
                  {sizeQuantities.map((sq, index) => renderSizeQuantityRow(sq, index))}
                </ScrollArea>
              </div>
            </div>
            
            {totalQuantity > 0 && (
              <div className="text-center space-y-1 pt-2 border-t">
                <p className="text-lg font-semibold">
                  {command.operation === 'entry' ? '+' : '-'}{totalQuantity} unidade(s) total
                </p>
              </div>
            )}
          </div>
        )}

        {/* Similar Matches */}
        {step === 'similar_matches' && (
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-3">
              Encontramos produtos similares. Selecione o correto:
            </p>
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

        {/* Confirming (from similar selection) with editable options */}
        {step === 'confirming' && matchedProduct && displayProduct && command && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              {displayProduct.image_url ? (
                <img 
                  src={displayProduct.image_url} 
                  alt={displayProduct.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{displayProduct.name}</p>
                {selectedColor && (
                  <p className="text-sm text-muted-foreground">Cor: {selectedColor}</p>
                )}
              </div>
            </div>

            {/* Editable Color */}
            {availableColors.length > 1 && (
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select value={selectedColor || ''} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a cor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Size Quantities */}
            <div className="space-y-2">
              <Label>
                {sizeQuantities.length > 1 ? 'Quantidade por Tamanho' : 'Quantidade'}
              </Label>
              <div className="border rounded-lg p-2 bg-background">
                <ScrollArea className={sizeQuantities.length > 4 ? 'max-h-[200px]' : ''}>
                  {sizeQuantities.map((sq, index) => renderSizeQuantityRow(sq, index))}
                </ScrollArea>
              </div>
            </div>
            
            {totalQuantity > 0 && (
              <div className="text-center space-y-1 pt-2 border-t">
                <p className="text-lg font-semibold">
                  {command.operation === 'entry' ? '+' : '-'}{totalQuantity} unidade(s) total
                </p>
              </div>
            )}
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
        {(step === 'exact_match' || step === 'confirming') && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmOperation} 
              disabled={isProcessing || totalQuantity === 0}
            >
              {isProcessing ? 'Processando...' : 'Confirmar'}
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
