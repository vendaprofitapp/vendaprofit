import { useState } from "react";
import { Link2, Loader2, Check, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SupplierImageScraperProps {
  maxImages: number;
  currentImageCount: number;
  onImagesSelected: (urls: string[]) => void;
}

export function SupplierImageScraper({ 
  maxImages, 
  currentImageCount,
  onImagesSelected 
}: SupplierImageScraperProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);

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

    try {
      const { data, error } = await supabase.functions.invoke('scrape-product-images', {
        body: { url: url.trim() },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar imagens');
      }

      if (data.images && data.images.length > 0) {
        setImages(data.images);
        setShowResults(true);
        toast.success(`${data.images.length} imagens encontradas!`);
      } else {
        toast.warning("Nenhuma imagem de produto encontrada nesta página");
      }
    } catch (error) {
      console.error('Error scraping:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao buscar imagens do fornecedor");
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

  const handleConfirmSelection = () => {
    if (selectedImages.size === 0) {
      toast.warning("Selecione pelo menos uma imagem");
      return;
    }

    onImagesSelected(Array.from(selectedImages));
    setShowResults(false);
    setUrl("");
    setImages([]);
    setSelectedImages(new Set());
    toast.success(`${selectedImages.size} imagem(ns) adicionada(s)!`);
  };

  const handleAutoSelect = () => {
    // Auto-select first N images up to available slots
    const autoSelected = new Set<string>();
    for (let i = 0; i < Math.min(images.length, availableSlots); i++) {
      autoSelected.add(images[i]);
    }
    setSelectedImages(autoSelected);
  };

  if (availableSlots <= 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm">Buscar fotos do fornecedor</Label>
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

      {showResults && images.length > 0 && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {images.length} imagens encontradas
            </span>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={handleAutoSelect}
              >
                Selecionar primeiras
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => setShowResults(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[200px]">
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

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedImages.size}/{availableSlots} selecionadas
            </span>
            <Button 
              type="button"
              size="sm"
              onClick={handleConfirmSelection}
              disabled={selectedImages.size === 0}
            >
              Adicionar selecionadas
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
