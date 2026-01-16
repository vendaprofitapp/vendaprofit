import { useState, useEffect } from "react";
import { Link2, Loader2, Check, X, Download, Import, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  website: string | null;
}

interface SupplierImageScraperProps {
  maxImages: number;
  currentImageCount: number;
  onImagesSelected: (urls: string[]) => void;
  onSupplierSelected?: (supplierId: string) => void;
  currentSupplierId?: string;
}

export function SupplierImageScraper({ 
  maxImages, 
  currentImageCount,
  onImagesSelected,
  onSupplierSelected,
  currentSupplierId
}: SupplierImageScraperProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);
  
  // Supplier states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(currentSupplierId || "");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const availableSlots = maxImages - currentImageCount;

  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user]);

  useEffect(() => {
    if (currentSupplierId) {
      setSelectedSupplierId(currentSupplierId);
      const supplier = suppliers.find(s => s.id === currentSupplierId);
      setSelectedSupplier(supplier || null);
    }
  }, [currentSupplierId, suppliers]);

  const fetchSuppliers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, website")
      .eq("owner_id", user.id)
      .order("name");
    setSuppliers(data || []);
  };

  const handleSupplierChange = (value: string) => {
    setSelectedSupplierId(value);
    const supplier = suppliers.find(s => s.id === value);
    setSelectedSupplier(supplier || null);
    
    if (onSupplierSelected && value !== "none") {
      onSupplierSelected(value);
    }
    
    // Reset images when changing supplier
    setImages([]);
    setSelectedImages(new Set());
    setShowResults(false);
  };

  const handleScrape = async () => {
    if (!selectedSupplier?.website) {
      toast.error("Este fornecedor não possui site cadastrado");
      return;
    }

    setIsLoading(true);
    setImages([]);
    setSelectedImages(new Set());
    setShowResults(false);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-product-images', {
        body: { url: selectedSupplier.website.trim() },
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

  // Filter only suppliers with website
  const suppliersWithWebsite = suppliers.filter(s => s.website);

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Importar do Site do Fornecedor</Label>
      </div>

      {suppliersWithWebsite.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum fornecedor com site cadastrado. Cadastre um fornecedor com o site dele primeiro.
        </p>
      ) : (
        <>
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Selecione o Fornecedor</Label>
            <div className="flex gap-2">
              <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliersWithWebsite.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleScrape}
                disabled={isLoading || !selectedSupplier?.website}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
            {selectedSupplier?.website && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                <span className="truncate">{selectedSupplier.website}</span>
              </div>
            )}
          </div>

          {showResults && images.length > 0 && (
            <div className="border rounded-lg p-3 space-y-3 bg-background">
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
        </>
      )}
    </div>
  );
}