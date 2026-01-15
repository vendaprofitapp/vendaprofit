import { useState } from "react";
import { Link2, Loader2, Check, X, Download, Import } from "lucide-react";
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
        throw new Error(data.error || 'Erro ao buscar dados');
      }

      if (data.images && data.images.length > 0) {
        setImages(data.images);
        setShowResults(true);
        toast.success(`Encontradas ${data.images.length} imagens`);
      } else {
        toast.warning("Nenhuma imagem encontrada nesta página");
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
      toast.warning("Selecione imagens para importar");
      return;
    }

    onImagesSelected(Array.from(selectedImages));
    toast.success(`${selectedImages.size} imagem(ns) importada(s)`);

    setShowResults(false);
    setUrl("");
    setImages([]);
    setSelectedImages(new Set());
  };

  const handleAutoSelect = () => {
    const autoSelected = new Set<string>();
    for (let i = 0; i < Math.min(images.length, availableSlots); i++) {
      autoSelected.add(images[i]);
    }
    setSelectedImages(autoSelected);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm">Importar fotos do fornecedor</Label>
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
            <span className="text-sm font-medium flex items-center gap-2">
              <Import className="h-4 w-4" />
              Imagens encontradas ({images.length})
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

          {availableSlots > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Selecione até {availableSlots} imagem(ns)
                </span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={handleAutoSelect}
                  className="h-6 text-xs"
                >
                  Selecionar primeiras
                </Button>
              </div>

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
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Limite de imagens atingido. Remova uma imagem para adicionar novas.
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {selectedImages.size > 0 && `${selectedImages.size} imagem(ns) selecionada(s)`}
            </span>
            <Button 
              type="button"
              size="sm"
              onClick={handleConfirmSelection}
              disabled={selectedImages.size === 0}
            >
              <Import className="h-4 w-4 mr-2" />
              Importar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
