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
  const [editableQuantity, setEditableQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Search for products when command changes
  useEffect(() => {
    if (open && command) {
      searchProducts(command.productSearch);
      setEditableQuantity(command.quantity);
    } else {
      // Reset state when dialog closes
      setStep('searching');
      setMatchedProduct(null);
      setSimilarProducts([]);
      setAllVariants([]);
      setSelectedColor(null);
      setSelectedSize(null);
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
        setSelectedSize(product.size);
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

  // Get available colors and sizes for the matched product name
  const { availableColors, availableSizes } = useMemo(() => {
    if (!matchedProduct) return { availableColors: [], availableSizes: [] };
    
    // Find all products with the same base name
    const baseName = normalizeText(matchedProduct.name);
    const variants = allVariants.filter(p => normalizeText(p.name) === baseName);
    
    const colors = [...new Set(variants.map(p => p.color).filter(Boolean))] as string[];
    const sizes = [...new Set(variants.map(p => p.size).filter(Boolean))] as string[];
    
    return { availableColors: colors, availableSizes: sizes };
  }, [matchedProduct, allVariants]);

  // Find the actual product based on selected color/size
  const actualProduct = useMemo(() => {
    if (!matchedProduct) return null;
    
    const baseName = normalizeText(matchedProduct.name);
    const variant = allVariants.find(p => 
      normalizeText(p.name) === baseName &&
      p.color === selectedColor &&
      p.size === selectedSize
    );
    
    return variant || matchedProduct;
  }, [matchedProduct, allVariants, selectedColor, selectedSize]);

  const handleSelectProduct = (product: Product) => {
    setMatchedProduct(product);
    setSelectedColor(product.color);
    setSelectedSize(product.size);
    setStep('confirming');
  };

  const handleConfirmOperation = async () => {
    if (!actualProduct || !command) return;

    setIsProcessing(true);

    try {
      const newQuantity = command.operation === 'entry'
        ? actualProduct.stock_quantity + editableQuantity
        : Math.max(0, actualProduct.stock_quantity - editableQuantity);

      const { error } = await supabase
        .from('products')
        .update({ stock_quantity: newQuantity })
        .eq('id', actualProduct.id);

      if (error) throw error;

      setStep('success');
      toast.success(
        command.operation === 'entry'
          ? `Entrada de ${editableQuantity} unidade(s) registrada!`
          : `Saída de ${editableQuantity} unidade(s) registrada!`
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

  const handleQuantityChange = (delta: number) => {
    setEditableQuantity(prev => Math.max(1, prev + delta));
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
        {step === 'exact_match' && matchedProduct && actualProduct && command && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
              {actualProduct.image_url ? (
                <img 
                  src={actualProduct.image_url} 
                  alt={actualProduct.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{actualProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  Estoque atual: {actualProduct.stock_quantity} un.
                </p>
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

            {/* Editable Size */}
            {availableSizes.length > 1 && (
              <div className="space-y-2">
                <Label>Tamanho</Label>
                <Select value={selectedSize || ''} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tamanho" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSizes.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Editable Quantity */}
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={editableQuantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={editableQuantity}
                  onChange={(e) => setEditableQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-center w-20"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="text-center space-y-2 pt-2 border-t">
              <p className="text-lg font-semibold">
                {command.operation === 'entry' ? '+' : '-'}{editableQuantity} unidade(s)
              </p>
              <p className="text-sm text-muted-foreground">
                Estoque: {actualProduct.stock_quantity} → 
                <span className="font-medium ml-1">
                  {command.operation === 'entry' 
                    ? actualProduct.stock_quantity + editableQuantity
                    : Math.max(0, actualProduct.stock_quantity - editableQuantity)
                  }
                </span>
              </p>
            </div>
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
        {step === 'confirming' && matchedProduct && actualProduct && command && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
              {actualProduct.image_url ? (
                <img 
                  src={actualProduct.image_url} 
                  alt={actualProduct.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{actualProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  Estoque atual: {actualProduct.stock_quantity} un.
                </p>
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

            {/* Editable Size */}
            {availableSizes.length > 1 && (
              <div className="space-y-2">
                <Label>Tamanho</Label>
                <Select value={selectedSize || ''} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tamanho" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSizes.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Editable Quantity */}
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={editableQuantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={editableQuantity}
                  onChange={(e) => setEditableQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-center w-20"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleQuantityChange(1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="text-center space-y-2 pt-2 border-t">
              <p className="text-lg font-semibold">
                {command.operation === 'entry' ? '+' : '-'}{editableQuantity} unidade(s)
              </p>
              <p className="text-sm text-muted-foreground">
                Estoque: {actualProduct.stock_quantity} → 
                <span className="font-medium ml-1">
                  {command.operation === 'entry' 
                    ? actualProduct.stock_quantity + editableQuantity
                    : Math.max(0, actualProduct.stock_quantity - editableQuantity)
                  }
                </span>
              </p>
            </div>
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
            <Button onClick={handleConfirmOperation} disabled={isProcessing}>
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
