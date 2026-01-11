import { useState } from "react";
import { Link2, Loader2, Check, X, Download, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProductData {
  name?: string;
  price?: number;
  description?: string;
  colors?: string[];
  sizes?: string[];
  category?: string;
}

interface SupplierImageScraperProps {
  maxImages: number;
  currentImageCount: number;
  onImagesSelected: (urls: string[]) => void;
  onProductDataImport?: (data: ProductData) => void;
}

export function SupplierImageScraper({ 
  maxImages, 
  currentImageCount,
  onImagesSelected,
  onProductDataImport
}: SupplierImageScraperProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [selectedDataFields, setSelectedDataFields] = useState<Set<string>>(new Set());

  const availableSlots = maxImages - currentImageCount;

  const handleScrape = async () => {
    if (!url.trim()) {
      toast.error("Insira a URL do produto");
      return;
    }

    setIsLoading(true);
    setImages([]);
    setSelectedImages(new Set());
    setShowResults(false);
    setProductData(null);
    setSelectedDataFields(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('scrape-product-images', {
        body: { url: url.trim() },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar dados');
      }

      if (data.images && data.images.length > 0) {
        setImages(data.images);
      }

      if (data.productData) {
        setProductData(data.productData);
        // Auto-select fields that have data
        const autoSelect = new Set<string>();
        if (data.productData.name) autoSelect.add('name');
        if (data.productData.price) autoSelect.add('price');
        if (data.productData.description) autoSelect.add('description');
        if (data.productData.colors?.length) autoSelect.add('color');
        if (data.productData.sizes?.length) autoSelect.add('size');
        if (data.productData.category) autoSelect.add('category');
        setSelectedDataFields(autoSelect);
      }

      setShowResults(true);
      
      const foundItems = [];
      if (data.images?.length) foundItems.push(`${data.images.length} imagens`);
      if (data.productData?.name) foundItems.push('nome');
      if (data.productData?.price) foundItems.push('preço');
      
      if (foundItems.length > 0) {
        toast.success(`Encontrado: ${foundItems.join(', ')}`);
      } else {
        toast.warning("Nenhum dado encontrado nesta página");
      }
    } catch (error) {
      console.error('Error scraping:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao buscar dados do fornecedor");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleImageSelection = (imageUrl: string) => {
    const newSelected = new Set(selectedImages);
    
    if (newSelected.has(imageUrl)) {
      newSelected.delete(imageUrl);
    } else {
      if (newSelected.size >= availableSlots) {
        toast.warning(`Você só pode selecionar mais ${availableSlots} imagem(ns)`);
        return;
      }
      newSelected.add(imageUrl);
    }
    
    setSelectedImages(newSelected);
  };

  const toggleDataField = (field: string) => {
    const newSelected = new Set(selectedDataFields);
    if (newSelected.has(field)) {
      newSelected.delete(field);
    } else {
      newSelected.add(field);
    }
    setSelectedDataFields(newSelected);
  };

  const handleConfirmSelection = () => {
    const hasImages = selectedImages.size > 0;
    const hasData = selectedDataFields.size > 0 && productData;

    if (!hasImages && !hasData) {
      toast.warning("Selecione imagens ou dados para importar");
      return;
    }

    // Import images
    if (hasImages) {
      onImagesSelected(Array.from(selectedImages));
    }

    // Import product data
    if (hasData && onProductDataImport) {
      const dataToImport: ProductData = {};
      
      if (selectedDataFields.has('name') && productData.name) {
        dataToImport.name = productData.name;
      }
      if (selectedDataFields.has('price') && productData.price) {
        dataToImport.price = productData.price;
      }
      if (selectedDataFields.has('description') && productData.description) {
        dataToImport.description = productData.description;
      }
      if (selectedDataFields.has('color') && productData.colors?.length) {
        dataToImport.colors = productData.colors;
      }
      if (selectedDataFields.has('size') && productData.sizes?.length) {
        dataToImport.sizes = productData.sizes;
      }
      if (selectedDataFields.has('category') && productData.category) {
        dataToImport.category = productData.category;
      }

      onProductDataImport(dataToImport);
    }

    const imported = [];
    if (hasImages) imported.push(`${selectedImages.size} imagem(ns)`);
    if (hasData) imported.push('dados do produto');
    
    toast.success(`Importado: ${imported.join(' e ')}`);

    setShowResults(false);
    setUrl("");
    setImages([]);
    setSelectedImages(new Set());
    setProductData(null);
    setSelectedDataFields(new Set());
  };

  const handleAutoSelect = () => {
    const autoSelected = new Set<string>();
    for (let i = 0; i < Math.min(images.length, availableSlots); i++) {
      autoSelected.add(images[i]);
    }
    setSelectedImages(autoSelected);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm">Importar do fornecedor</Label>
      </div>
      
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o link da página do produto"
          className="flex-1"
          disabled={isLoading}
        />
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleScrape}
          disabled={isLoading || !url.trim()}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </div>

      {showResults && (
        <div className="border rounded-lg p-3 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Import className="h-4 w-4" />
              Dados encontrados
            </span>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => setShowResults(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Product Data Section */}
          {productData && (
            <div className="space-y-2 border-b pb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Dados do Produto
              </span>
              
              <div className="space-y-2">
                {productData.name && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="import-name"
                      checked={selectedDataFields.has('name')}
                      onCheckedChange={() => toggleDataField('name')}
                    />
                    <label htmlFor="import-name" className="text-sm flex-1 cursor-pointer">
                      <span className="text-muted-foreground">Nome:</span> {productData.name}
                    </label>
                  </div>
                )}

                {productData.price && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="import-price"
                      checked={selectedDataFields.has('price')}
                      onCheckedChange={() => toggleDataField('price')}
                    />
                    <label htmlFor="import-price" className="text-sm flex-1 cursor-pointer">
                      <span className="text-muted-foreground">Preço:</span> {formatPrice(productData.price)}
                    </label>
                  </div>
                )}

                {productData.category && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="import-category"
                      checked={selectedDataFields.has('category')}
                      onCheckedChange={() => toggleDataField('category')}
                    />
                    <label htmlFor="import-category" className="text-sm flex-1 cursor-pointer">
                      <span className="text-muted-foreground">Categoria:</span> {productData.category}
                    </label>
                  </div>
                )}

                {productData.colors && productData.colors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="import-color"
                      checked={selectedDataFields.has('color')}
                      onCheckedChange={() => toggleDataField('color')}
                    />
                    <label htmlFor="import-color" className="text-sm flex-1 cursor-pointer flex items-center gap-2">
                      <span className="text-muted-foreground">Cor:</span>
                      <div className="flex gap-1 flex-wrap">
                        {productData.colors.map((color, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs capitalize">
                            {color}
                          </Badge>
                        ))}
                      </div>
                    </label>
                  </div>
                )}

                {productData.sizes && productData.sizes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="import-size"
                      checked={selectedDataFields.has('size')}
                      onCheckedChange={() => toggleDataField('size')}
                    />
                    <label htmlFor="import-size" className="text-sm flex-1 cursor-pointer flex items-center gap-2">
                      <span className="text-muted-foreground">Tamanhos:</span>
                      <div className="flex gap-1 flex-wrap">
                        {productData.sizes.map((size, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {size}
                          </Badge>
                        ))}
                      </div>
                    </label>
                  </div>
                )}

                {productData.description && (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="import-description"
                      checked={selectedDataFields.has('description')}
                      onCheckedChange={() => toggleDataField('description')}
                      className="mt-0.5"
                    />
                    <label htmlFor="import-description" className="text-sm flex-1 cursor-pointer">
                      <span className="text-muted-foreground">Descrição:</span>{' '}
                      <span className="line-clamp-2">{productData.description}</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Images Section */}
          {images.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Imagens ({images.length})
                </span>
                {availableSlots > 0 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={handleAutoSelect}
                    className="h-6 text-xs"
                  >
                    Selecionar primeiras
                  </Button>
                )}
              </div>

              {availableSlots > 0 ? (
                <ScrollArea className="h-[180px]">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {images.map((imageUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleImageSelection(imageUrl)}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                          selectedImages.has(imageUrl) 
                            ? "border-primary ring-2 ring-primary/20" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <img
                          src={imageUrl}
                          alt={`Imagem ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                        {selectedImages.has(imageUrl) && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="bg-primary text-primary-foreground rounded-full p-1">
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Limite de imagens atingido. Remova uma imagem para adicionar novas.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {selectedDataFields.size > 0 && `${selectedDataFields.size} campo(s)`}
              {selectedDataFields.size > 0 && selectedImages.size > 0 && ' + '}
              {selectedImages.size > 0 && `${selectedImages.size} imagem(ns)`}
            </span>
            <Button 
              type="button"
              size="sm"
              onClick={handleConfirmSelection}
              disabled={selectedImages.size === 0 && selectedDataFields.size === 0}
            >
              <Import className="h-4 w-4 mr-2" />
              Importar selecionados
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}