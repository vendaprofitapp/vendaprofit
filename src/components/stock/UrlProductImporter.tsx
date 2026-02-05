 import { useState } from "react";
import { Link2, Loader2, ArrowRight, Check, X, Sparkles, Image as ImageIcon } from "lucide-react";
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
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
 
 interface ScrapedData {
   name?: string;
   description?: string;
   price?: number;
   images?: string[];
   brand?: string;
   sku?: string;
   category?: string;
   color?: string;
   sizes?: string[];
   [key: string]: any;
 }
 
 interface FieldMapping {
   scrapedField: string;
   systemField: string;
 }
 
 interface UrlProductImporterProps {
   onDataImported: (data: {
     name?: string;
     description?: string;
     price?: number;
     costPrice?: number;
     model?: string;
     colorLabel?: string;
     customDetail?: string;
     images?: string[];
     category?: string;
   }) => void;
  maxImages?: number;
  currentImageCount?: number;
 }
 
 const SYSTEM_FIELDS = [
   { key: "name", label: "Nome do Produto" },
   { key: "description", label: "Descrição" },
   { key: "price", label: "Preço de Venda" },
   { key: "costPrice", label: "Preço de Custo" },
   { key: "model", label: "Modelo (filtro)" },
   { key: "colorLabel", label: "Cor (filtro)" },
   { key: "customDetail", label: "Detalhe (filtro)" },
   { key: "category", label: "Categoria" },
   { key: "images", label: "Imagens" },
 ];
 
 const SCRAPED_FIELD_LABELS: Record<string, string> = {
   name: "Nome",
   description: "Descrição",
   price: "Preço",
   images: "Imagens",
   brand: "Marca",
   sku: "SKU/Código",
   category: "Categoria",
   color: "Cor",
   sizes: "Tamanhos",
   material: "Material",
 };
 
export function UrlProductImporter({ onDataImported, maxImages = 3, currentImageCount = 0 }: UrlProductImporterProps) {
   const [url, setUrl] = useState("");
   const [isLoading, setIsLoading] = useState(false);
   const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
   const [mappings, setMappings] = useState<FieldMapping[]>([]);
   const [showMapping, setShowMapping] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const availableSlots = maxImages - currentImageCount;
 
   const handleScrape = async () => {
     if (!url.trim()) {
       toast.error("Cole a URL do produto");
       return;
     }
 
     setIsLoading(true);
     setScrapedData(null);
     setMappings([]);
     setShowMapping(false);
 
     try {
       const { data, error } = await supabase.functions.invoke('scrape-product-data', {
         body: { url: url.trim() },
       });
 
       if (error) throw new Error(error.message);
       if (!data.success) throw new Error(data.error || 'Erro ao buscar dados');
 
       const scraped = data.product as ScrapedData;
       setScrapedData(scraped);
       
       // Auto-create suggested mappings
       const autoMappings: FieldMapping[] = [];
       if (scraped.name) autoMappings.push({ scrapedField: "name", systemField: "name" });
       if (scraped.description) autoMappings.push({ scrapedField: "description", systemField: "description" });
       if (scraped.price) autoMappings.push({ scrapedField: "price", systemField: "price" });
       if (scraped.brand) autoMappings.push({ scrapedField: "brand", systemField: "model" });
       if (scraped.color) autoMappings.push({ scrapedField: "color", systemField: "colorLabel" });
       if (scraped.category) autoMappings.push({ scrapedField: "category", systemField: "category" });
       if (scraped.material) autoMappings.push({ scrapedField: "material", systemField: "customDetail" });
       
       setMappings(autoMappings);
      
      // Auto-select first images up to available slots
      if (scraped.images?.length) {
        const autoSelected = new Set<string>();
        for (let i = 0; i < Math.min(scraped.images.length, availableSlots); i++) {
          autoSelected.add(scraped.images[i]);
        }
        setSelectedImages(autoSelected);
      }
      
       setShowMapping(true);
       toast.success("Dados encontrados! Configure o mapeamento.");
     } catch (error) {
       console.error('Error scraping:', error);
       toast.error(error instanceof Error ? error.message : "Erro ao buscar dados do produto");
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

   const updateMapping = (scrapedField: string, systemField: string) => {
     setMappings(prev => {
       const existing = prev.find(m => m.scrapedField === scrapedField);
       if (existing) {
         if (systemField === "none") {
           return prev.filter(m => m.scrapedField !== scrapedField);
         }
         return prev.map(m => m.scrapedField === scrapedField ? { ...m, systemField } : m);
       }
       if (systemField !== "none") {
         return [...prev, { scrapedField, systemField }];
       }
       return prev;
     });
   };
 
   const getScrapedFields = () => {
     if (!scrapedData) return [];
     return Object.entries(scrapedData)
      .filter(([key, value]) => key !== 'images' && value !== null && value !== undefined && value !== "")
       .map(([key]) => key);
   };
 
   const getMappedSystemField = (scrapedField: string) => {
     return mappings.find(m => m.scrapedField === scrapedField)?.systemField || "none";
   };
 
   const formatValue = (value: any): string => {
     if (Array.isArray(value)) {
       if (value.length === 0) return "(vazio)";
       if (typeof value[0] === 'string' && value[0].startsWith('http')) {
         return `${value.length} imagem(ns)`;
       }
       return value.join(", ");
     }
     if (typeof value === 'number') {
       return `R$ ${value.toFixed(2)}`;
     }
     if (typeof value === 'string' && value.length > 100) {
       return value.substring(0, 100) + "...";
     }
     return String(value);
   };
 
   const handleApplyMapping = () => {
     if (!scrapedData || mappings.length === 0) {
       toast.warning("Configure pelo menos um mapeamento");
       return;
     }
 
     const importedData: Record<string, any> = {};
     
     for (const mapping of mappings) {
       const value = scrapedData[mapping.scrapedField];
       if (value !== undefined && value !== null) {
         importedData[mapping.systemField] = value;
       }
     }
    
    // Add selected images
    if (selectedImages.size > 0) {
      importedData.images = Array.from(selectedImages);
    }
 
     onDataImported(importedData);
     toast.success("Dados importados com sucesso!");
     
     // Reset
     setShowMapping(false);
     setScrapedData(null);
     setUrl("");
   };
 
   const handleCancel = () => {
     setShowMapping(false);
     setScrapedData(null);
     setMappings([]);
    setSelectedImages(new Set());
   };
 
  return (
    <div className="space-y-2 border rounded-lg p-3 bg-gradient-to-r from-primary/5 to-primary/10">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3 w-3 text-primary" />
        <Label className="text-xs font-medium">Importar do Site</Label>
        <Badge variant="secondary" className="text-[9px] h-4">Novo</Badge>
      </div>
 
      {!showMapping ? (
        <div className="space-y-1">
          <div className="flex gap-2">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://loja.com.br/produto"
              className="flex-1 text-xs h-8"
            />
            <Button 
              type="button" 
              size="sm"
              className="h-8"
              onClick={handleScrape}
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Link2 className="h-3 w-3 mr-1" />
                  Buscar
                </>
              )}
            </Button>
          </div>
          <p className="text-[9px] text-muted-foreground">
            Cole o link para importar dados do produto
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Dados Encontrados</span>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              className="h-5 w-5 p-0"
              onClick={handleCancel}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
 
          {/* Image Selection */}
          {scrapedData?.images && scrapedData.images.length > 0 && (
            <div className="p-2 bg-background rounded-lg border">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] font-medium flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  Fotos ({selectedImages.size}/{availableSlots})
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-2"
                  onClick={() => {
                    const autoSelected = new Set<string>();
                    for (let i = 0; i < Math.min(scrapedData.images!.length, availableSlots); i++) {
                      autoSelected.add(scrapedData.images![i]);
                    }
                    setSelectedImages(autoSelected);
                  }}
                >
                  Auto
                </Button>
              </div>
              
              <div className="grid grid-cols-6 gap-1 max-h-[100px] overflow-y-auto">
                {scrapedData.images.slice(0, 20).map((imageUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleImageSelection(imageUrl)}
                    className={cn(
                      "relative aspect-square rounded overflow-hidden border-2 transition-all",
                      selectedImages.has(imageUrl) 
                        ? "border-primary ring-1 ring-primary/20" 
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
                        <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="h-2 w-2" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Field Mapping */}
           <div className="space-y-1">
            <Label className="text-[10px] font-medium">Mapeamento</Label>
             <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
               {getScrapedFields().map((field) => (
                 <div key={field} className="flex items-center gap-1 p-1.5 rounded bg-background border text-[10px]">
                   <div className="flex-1 min-w-0">
                     <p className="font-medium truncate">
                       {SCRAPED_FIELD_LABELS[field] || field}
                     </p>
                     <p className="text-muted-foreground truncate text-[9px]">
                       {formatValue(scrapedData?.[field])}
                     </p>
                   </div>
                   
                   <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                   
                   <Select
                     value={getMappedSystemField(field)}
                     onValueChange={(value) => updateMapping(field, value)}
                   >
                     <SelectTrigger className="w-[100px] h-6 text-[10px]">
                       <SelectValue placeholder="Ignorar" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none">Ignorar</SelectItem>
                       {SYSTEM_FIELDS.map((sf) => (
                         <SelectItem key={sf.key} value={sf.key}>
                           {sf.label}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
               ))}
             </div>
           </div>

           <div className="flex items-center justify-between pt-2 border-t mt-2">
              <span className="text-[10px] text-muted-foreground">
                {mappings.length} campo(s)
              </span>
              <Button 
                type="button"
                size="sm"
                onClick={handleApplyMapping}
                disabled={mappings.length === 0}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Aplicar
              </Button>
            </div>
         </div>
       )}
     </div>
   );
 }