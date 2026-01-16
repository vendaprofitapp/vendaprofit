import { useState, useEffect } from "react";
import { Link2, Loader2, Check, X, Download, Import, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
}

interface SupplierImageScraperProps {
  maxImages: number;
  currentImageCount: number;
  onImagesSelected: (urls: string[]) => void;
  onSupplierSelected?: (supplierId: string) => void;
  currentSupplierId?: string;
}

const emptyFormData = {
  name: "",
  cnpj: "",
  phone: "",
  attendant_name: "",
  attendant_phone: "",
  purchase_rules: "",
};

export function SupplierImageScraper({ 
  maxImages, 
  currentImageCount,
  onImagesSelected,
  onSupplierSelected,
  currentSupplierId
}: SupplierImageScraperProps) {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);
  
  // Supplier states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(currentSupplierId || "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(emptyFormData);

  const availableSlots = maxImages - currentImageCount;

  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user]);

  useEffect(() => {
    if (currentSupplierId) {
      setSelectedSupplierId(currentSupplierId);
    }
  }, [currentSupplierId]);

  const fetchSuppliers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, cnpj")
      .eq("owner_id", user.id)
      .order("name");
    setSuppliers(data || []);
  };

  const handleSupplierChange = (value: string) => {
    setSelectedSupplierId(value);
    if (onSupplierSelected) {
      onSupplierSelected(value);
    }
  };

  const handleCreateSupplier = async () => {
    if (!user || !formData.name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: formData.name.trim(),
        cnpj: formData.cnpj.trim() || null,
        phone: formData.phone.trim() || null,
        attendant_name: formData.attendant_name.trim() || null,
        attendant_phone: formData.attendant_phone.trim() || null,
        purchase_rules: formData.purchase_rules.trim() || null,
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Erro ao criar fornecedor");
      return;
    }

    toast.success("Fornecedor criado!");
    setDialogOpen(false);
    setFormData(emptyFormData);
    fetchSuppliers();

    if (data) {
      setSelectedSupplierId(data.id);
      if (onSupplierSelected) {
        onSupplierSelected(data.id);
      }
    }
  };

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
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Importar do Site do Fornecedor</Label>
      </div>

      {/* Supplier Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Fornecedor</Label>
        <div className="flex gap-2">
          <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione o fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* URL Input */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">URL do Produto</Label>
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

      {/* Create Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
            <DialogDescription>Cadastre um novo fornecedor/marca</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="sm:col-span-2 space-y-2">
              <Label>Empresa *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da empresa/marca"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone Geral</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 0000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Atendente</Label>
              <Input
                value={formData.attendant_name}
                onChange={(e) => setFormData({ ...formData, attendant_name: e.target.value })}
                placeholder="Nome do atendente"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone Atendente</Label>
              <Input
                value={formData.attendant_phone}
                onChange={(e) => setFormData({ ...formData, attendant_phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Regras de Compras</Label>
              <Textarea
                value={formData.purchase_rules}
                onChange={(e) => setFormData({ ...formData, purchase_rules: e.target.value })}
                placeholder="Condições de pagamento, prazos, pedido mínimo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSupplier}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
