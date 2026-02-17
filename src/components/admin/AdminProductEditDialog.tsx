import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, ArrowRight, ImageIcon, SkipForward, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FixedCategorySelector } from "@/components/products/FixedCategorySelector";

interface DetectedProduct {
  name: string;
  url: string;
}

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
  material?: string;
  [key: string]: any;
}

interface FieldMapping {
  scrapedField: string;
  systemField: string;
}

interface AdminProductEditDialogProps {
  open: boolean;
  onClose: () => void;
  products: DetectedProduct[];
  supplierId: string;
  adminId: string;
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
];

const SCRAPED_FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  description: "Descrição",
  price: "Preço",
  brand: "Marca",
  sku: "SKU/Código",
  category: "Categoria",
  color: "Cor",
  sizes: "Tamanhos",
  material: "Material",
};

const defaultSizes = ["PP", "P", "M", "G", "GG", "XG"];

export function AdminProductEditDialog({
  open,
  onClose,
  products,
  supplierId,
  adminId,
}: AdminProductEditDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState(0);

  // Manual form fields (editable after scrape)
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    costPrice: "",
    model: "",
    colorLabel: "",
    customDetail: "",
    mainCategory: "",
    subcategory: "",
  });

  const current = products[currentIndex];
  const isLast = currentIndex === products.length - 1;

  const handleScrape = async () => {
    if (!current) return;
    setScraping(true);
    setScrapedData(null);
    setMappings([]);
    setSelectedImages(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("scrape-product-data", {
        body: { url: current.url },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Erro ao buscar dados");

      const scraped = data.product as ScrapedData;
      setScrapedData(scraped);

      // Auto-create mappings
      const autoMappings: FieldMapping[] = [];
      if (scraped.name) autoMappings.push({ scrapedField: "name", systemField: "name" });
      if (scraped.description) autoMappings.push({ scrapedField: "description", systemField: "description" });
      if (scraped.price) autoMappings.push({ scrapedField: "price", systemField: "price" });
      if (scraped.brand) autoMappings.push({ scrapedField: "brand", systemField: "model" });
      if (scraped.color) autoMappings.push({ scrapedField: "color", systemField: "colorLabel" });
      if (scraped.category) autoMappings.push({ scrapedField: "category", systemField: "category" });
      if (scraped.material) autoMappings.push({ scrapedField: "material", systemField: "customDetail" });
      setMappings(autoMappings);

      // Auto-select first 3 images
      if (scraped.images?.length) {
        const autoSelected = new Set<string>();
        for (let i = 0; i < Math.min(scraped.images.length, 3); i++) {
          autoSelected.add(scraped.images[i]);
        }
        setSelectedImages(autoSelected);
      }

      // Pre-fill form from mappings
      setForm({
        name: scraped.name || current.name,
        description: scraped.description || "",
        price: scraped.price?.toString() || "",
        costPrice: "",
        model: scraped.brand || "",
        colorLabel: scraped.color || "",
        customDetail: scraped.material || "",
        mainCategory: scraped.category || "",
        subcategory: "",
      });

      toast.success("Dados extraídos! Revise e salve.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao buscar dados");
      // Pre-fill with just name
      setForm((prev) => ({ ...prev, name: current.name }));
    } finally {
      setScraping(false);
    }
  };

  // Auto-scrape on mount and when index changes
  useState(() => {
    if (current) handleScrape();
  });

  const toggleImageSelection = (imageUrl: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageUrl)) {
      newSelected.delete(imageUrl);
    } else {
      if (newSelected.size >= 3) {
        toast.warning("Máximo de 3 imagens");
        return;
      }
      newSelected.add(imageUrl);
    }
    setSelectedImages(newSelected);
  };

  const updateMapping = (scrapedField: string, systemField: string) => {
    setMappings((prev) => {
      const existing = prev.find((m) => m.scrapedField === scrapedField);
      if (existing) {
        if (systemField === "none") return prev.filter((m) => m.scrapedField !== scrapedField);
        return prev.map((m) => (m.scrapedField === scrapedField ? { ...m, systemField } : m));
      }
      if (systemField !== "none") return [...prev, { scrapedField, systemField }];
      return prev;
    });
  };

  const getScrapedFields = () => {
    if (!scrapedData) return [];
    return Object.entries(scrapedData)
      .filter(([key, value]) => key !== "images" && value !== null && value !== undefined && value !== "")
      .map(([key]) => key);
  };

  const getMappedSystemField = (scrapedField: string) => {
    return mappings.find((m) => m.scrapedField === scrapedField)?.systemField || "none";
  };

  const formatValue = (value: any): string => {
    if (Array.isArray(value)) return value.length === 0 ? "(vazio)" : value.join(", ");
    if (typeof value === "number") return `R$ ${value.toFixed(2)}`;
    if (typeof value === "string" && value.length > 80) return value.substring(0, 80) + "...";
    return String(value);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const images = Array.from(selectedImages).slice(0, 3);

      const { data: newProduct, error } = await supabase
        .from("products")
        .insert({
          owner_id: adminId,
          supplier_id: supplierId,
          name: form.name.trim(),
          description: form.description || null,
          price: parseFloat(form.price) || 0,
          cost_price: form.costPrice ? parseFloat(form.costPrice) : null,
          model: form.model || null,
          color_label: form.colorLabel || null,
          custom_detail: form.customDetail || null,
          category: form.mainCategory || "Sem Categoria",
          main_category: form.mainCategory || null,
          subcategory: form.subcategory || null,
          image_url: images[0] || null,
          image_url_2: images[1] || null,
          image_url_3: images[2] || null,
          stock_quantity: 0,
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Create default variants
      if (newProduct) {
        const variants = defaultSizes.map((size) => ({
          product_id: newProduct.id,
          size,
          stock_quantity: 0,
        }));
        await supabase.from("product_variants").insert(variants);
      }

      setSavedCount((c) => c + 1);
      toast.success(`"${form.name}" salvo!`);

      if (isLast) {
        toast.success(`${savedCount + 1} produto(s) adicionados ao catálogo!`);
        onClose();
      } else {
        // Next product
        setCurrentIndex((i) => i + 1);
        resetForNext();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (isLast) {
      if (savedCount > 0) toast.success(`${savedCount} produto(s) adicionados ao catálogo!`);
      onClose();
    } else {
      setCurrentIndex((i) => i + 1);
      resetForNext();
    }
  };

  const resetForNext = () => {
    setScrapedData(null);
    setMappings([]);
    setSelectedImages(new Set());
    setForm({
      name: "",
      description: "",
      price: "",
      costPrice: "",
      model: "",
      colorLabel: "",
      customDetail: "",
      mainCategory: "",
      subcategory: "",
    });
    // Trigger scrape for next product
    setTimeout(() => handleScrape(), 100);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Editar e Adicionar Produto</span>
            <Badge variant="outline">
              {currentIndex + 1} / {products.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="space-y-4">
            {/* Product URL info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium truncate">{current?.name}</span>
              <a
                href={current?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline text-xs"
              >
                Ver original
              </a>
            </div>

            {scraping && (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Extraindo dados do produto...</span>
              </div>
            )}

            {!scraping && (
              <>
                {/* Image Selection */}
                {scrapedData?.images && scrapedData.images.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        <ImageIcon className="h-4 w-4" />
                        Selecione as Fotos ({selectedImages.size}/3)
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const autoSelected = new Set<string>();
                          for (let i = 0; i < Math.min(scrapedData.images!.length, 3); i++) {
                            autoSelected.add(scrapedData.images![i]);
                          }
                          setSelectedImages(autoSelected);
                        }}
                      >
                        Auto-selecionar
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-[140px] overflow-y-auto">
                      {scrapedData.images.slice(0, 16).map((imageUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleImageSelection(imageUrl)}
                          className={cn(
                            "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                            selectedImages.has(imageUrl)
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <img
                            src={imageUrl}
                            alt={`Img ${idx + 1}`}
                            className="w-full h-full object-cover pointer-events-none"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                          {selectedImages.has(imageUrl) && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="bg-primary text-primary-foreground rounded-full p-1">
                                <Check className="h-3 w-3" />
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field Mapping (scraped fields) */}
                {scrapedData && getScrapedFields().length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <Label className="text-sm font-medium mb-2 block">Mapeamento de Campos</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                      {getScrapedFields().map((field) => (
                        <div key={field} className="flex items-center gap-2 p-2 rounded bg-background border">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {SCRAPED_FIELD_LABELS[field] || field}
                            </p>
                            <p className="text-muted-foreground truncate text-[10px]">
                              {formatValue(scrapedData[field])}
                            </p>
                          </div>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Select
                            value={getMappedSystemField(field)}
                            onValueChange={(value) => {
                              updateMapping(field, value);
                              // Update form when mapping changes
                              if (value !== "none" && scrapedData[field] !== undefined) {
                                setForm((prev) => ({
                                  ...prev,
                                  [value]: String(scrapedData[field]),
                                }));
                              }
                            }}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
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
                )}

                {/* Editable Form */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Modelo</Label>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Preço de Venda</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Preço de Custo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.costPrice}
                      onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cor</Label>
                    <Input
                      value={form.colorLabel}
                      onChange={(e) => setForm((p) => ({ ...p, colorLabel: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Detalhe</Label>
                    <Input
                      value={form.customDetail}
                      onChange={(e) => setForm((p) => ({ ...p, customDetail: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Categoria</Label>
                    <FixedCategorySelector
                      mainCategory={form.mainCategory}
                      subcategory={form.subcategory}
                      isNewRelease={false}
                      onMainCategoryChange={(v) => setForm((p) => ({ ...p, mainCategory: v }))}
                      onSubcategoryChange={(v) => setForm((p) => ({ ...p, subcategory: v }))}
                      onIsNewReleaseChange={() => {}}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between gap-2 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              <SkipForward className="h-4 w-4 mr-1" />
              Pular
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving || scraping}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            {isLast ? "Salvar e Finalizar" : "Salvar e Próximo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
