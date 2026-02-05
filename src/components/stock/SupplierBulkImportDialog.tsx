import { useState, useEffect } from "react";
import {
  Globe,
  Loader2,
  Check,
  X,
  Package,
  AlertCircle,
  RefreshCw,
  Eye,
  Settings2,
  Image,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

// Preview sample data interface
interface PreviewSample {
  url: string;
  rawName: string | null;
  price: number | null;
  description: string | null;
  images: string[];
  colors: string[];
  sizes: string[];
  parsedBaseName: string;
  parsedColor: string | null;
}

interface ScrapedProduct {
  url: string;
  name: string | null;
  price: number | null;
  description: string | null;
  images: string[];
  colors: string[];
  sizes: string[];
  category: string | null;
  selected: boolean;
  status: "pending" | "loading" | "success" | "error";
  error?: string;
}

interface MainCategory {
  id: string;
  name: string;
  has_subcategories: boolean;
}

interface Subcategory {
  id: string;
  name: string;
  main_category_id: string;
}

interface GroupedProduct {
  id: string;
  baseName: string;
  mainCategory: string;
  subcategory: string;
  model: string;
  colorLabel: string;
  customDetail: string;
  costPrice: number;
  salePrice: number;
  minStockLevel: number;
  description: string;
  images: string[];
  selectedImageIndices: number[];
  selected: boolean;
  expanded: boolean;
}

interface Supplier {
  id: string;
  name: string;
  website: string | null;
}

interface SupplierBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

const MARKUP_PERCENTAGE = 1.67;

// Common color names to detect
const COMPOUND_COLORS = [
  "off white", "off-white", "verde militar", "verde menta", "verde oliva", "verde musgo",
  "azul marinho", "azul royal", "azul bebê", "azul céu", "azul petróleo",
  "rosa bebê", "rosa chá", "rosa claro", "rosa pink", "rosa chiclete",
  "amarelo mostarda", "amarelo ouro", "vermelho queimado", "vermelho vinho",
  "marrom café", "marrom chocolate", "cinza chumbo", "cinza grafite", "cinza claro",
  "branco gelo", "preto fosco", "nude rosé", "rosa antigo", "rosa seco"
];

const SIMPLE_COLORS = [
  "preto", "branco", "azul", "vermelho", "verde", "amarelo", "rosa", "roxo", 
  "laranja", "marrom", "bege", "cinza", "nude", "vinho", "burgundy", "navy", 
  "caramelo", "terracota", "coral", "lilás", "mostarda", "creme", "grafite", 
  "chumbo", "areia", "chocolate", "café", "menta", "lavanda", "pêssego", 
  "salmão", "turquesa", "esmeralda", "oliva", "ruby", "black", "white", 
  "blue", "red", "green", "pink", "orange", "brown", "grey", "gray", 
  "cream", "gold", "silver", "bronze", "champagne", "ivory", "marsala", 
  "bordô", "ferrugem", "ocre", "camel", "taupe", "malva", "militar"
];

export function SupplierBulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: SupplierBulkImportDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<"url" | "discover" | "preview" | "scrape" | "group" | "importing">("url");
  const [searchFilter, setSearchFilter] = useState("top");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [productUrls, setProductUrls] = useState<string[]>([]);
  const [products, setProducts] = useState<ScrapedProduct[]>([]);
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);
  const [scrapingProgress, setScrapingProgress] = useState(0);
  const [isScraping, setIsScraping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Categories
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  // Preview configuration
  const [previewSamples, setPreviewSamples] = useState<PreviewSample[]>([]);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [extractColorFromName, setExtractColorFromName] = useState(true);
  const [customColorKeywords, setCustomColorKeywords] = useState<string>("");
  const [colorMappingField, setColorMappingField] = useState<string>("auto");
  const [priceMappingField, setPriceMappingField] = useState<string>("price");
  const [maxPhotosPerProduct, setMaxPhotosPerProduct] = useState<number>(3);
  const [defaultCostPrice, setDefaultCostPrice] = useState<number>(0);
  const [defaultSalePrice, setDefaultSalePrice] = useState<number>(0);
  const [useDefaultPrices, setUseDefaultPrices] = useState<boolean>(false);
  const [defaultMainCategory, setDefaultMainCategory] = useState<string>("");
  const [defaultSubcategory, setDefaultSubcategory] = useState<string>("");
  const [defaultMinStock, setDefaultMinStock] = useState<number>(2);

  useEffect(() => {
    if (open && user) {
      fetchSuppliers();
      fetchCategories();
    }
  }, [open, user]);

  const fetchSuppliers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, website")
      .eq("owner_id", user.id)
      .order("name");
    setSuppliers(data ?? []);
  };

  const fetchCategories = async () => {
    const { data: mainCats } = await supabase
      .from("main_categories")
      .select("id, name, has_subcategories")
      .eq("is_active", true)
      .order("display_order");
    setMainCategories(mainCats ?? []);

    const { data: subCats } = await supabase
      .from("subcategories")
      .select("id, name, main_category_id")
      .eq("is_active", true)
      .order("display_order");
    setSubcategories(subCats ?? []);
  };

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    setSelectedSupplier(supplier || null);
    
    if (supplier && !supplier.website) {
      toast.warning("Este fornecedor não possui site cadastrado. Cadastre o site na tela de Fornecedores.");
    }
  };

  const handleDiscoverProducts = async () => {
    if (!selectedSupplier?.website) {
      toast.error("Este fornecedor não possui site cadastrado");
      return;
    }

    setIsDiscovering(true);
    setProductUrls([]);

    try {
      const { data, error } = await supabase.functions.invoke("map-supplier-site", {
        body: { url: selectedSupplier.website.trim(), search: searchFilter.trim() },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Erro ao mapear site");

      const urls = data.productUrls || [];
      setProductUrls(urls);

      if (urls.length > 0) {
        toast.success(`Encontrados ${urls.length} produtos`);
        setStep("discover");
      } else {
        toast.warning("Nenhum produto encontrado");
      }
    } catch (error) {
      console.error("Error discovering:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao descobrir produtos");
    } finally {
      setIsDiscovering(false);
    }
  };

  const getAllColorKeywords = (): string[] => {
    const customColors = customColorKeywords
      .split(",")
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);
    return [...COMPOUND_COLORS, ...SIMPLE_COLORS, ...customColors];
  };

  const extractBaseName = (fullName: string, scrapedColor?: string | null): { baseName: string; color: string | null } => {
    let detectedColor: string | null = null;
    let name = fullName.trim();

    if (colorMappingField === "auto" && extractColorFromName) {
      const lowerName = name.toLowerCase();
      const allColors = getAllColorKeywords();
      for (const color of allColors) {
        const escapedColor = color.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const colorRegex = new RegExp(`\\b${escapedColor}\\b`, "i");
        if (colorRegex.test(lowerName)) {
          detectedColor = color
            .split(" ")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          name = name.replace(colorRegex, "").trim();
          break;
        }
      }
    } else if (colorMappingField === "color" && scrapedColor) {
      detectedColor = scrapedColor
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      // Also strip the scraped color from the name to avoid duplication
      const escapedColor = scrapedColor.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const colorRegex = new RegExp(`\\b${escapedColor}\\b`, "i");
      name = name.replace(colorRegex, "").trim();
    }

    name = name.replace(/\s+/g, " ").replace(/\s*-\s*$/, "").replace(/^\s*-\s*/, "").trim();

    return { baseName: name, color: detectedColor };
  };

  const handleLoadPreview = async () => {
    if (productUrls.length === 0) return;

    setIsLoadingPreview(true);
    setPreviewSamples([]);
    setSelectedSampleIndex(0);
    setStep("preview");

    const sampleUrls = productUrls.slice(0, 5);
    const samples: PreviewSample[] = [];

    for (const url of sampleUrls) {
      try {
        const { data, error } = await supabase.functions.invoke("scrape-product-images", {
          body: { url },
        });

        if (error || !data.success) continue;

        const rawName = data.productData?.name || "";
        const scrapedColor = data.productData?.colors?.[0] || null;
        const { baseName, color } = extractBaseName(rawName, scrapedColor);

        samples.push({
          url,
          rawName,
          price: data.productData?.price || null,
          description: data.productData?.description || null,
          images: data.images || [],
          colors: data.productData?.colors || [],
          sizes: data.productData?.sizes || [],
          parsedBaseName: baseName,
          parsedColor: color,
        });
      } catch (error) {
        console.error("Error loading preview:", error);
      }
    }

    setPreviewSamples(samples);
    setIsLoadingPreview(false);

    if (samples.length === 0) {
      toast.error("Não foi possível carregar exemplos");
      setStep("discover");
    }
  };

  const reparsePreviewSamples = () => {
    setPreviewSamples(prev => 
      prev.map(sample => {
        const scrapedColor = sample.colors?.[0] || null;
        const { baseName, color } = extractBaseName(sample.rawName || "", scrapedColor);
        return {
          ...sample,
          parsedBaseName: baseName,
          parsedColor: color,
        };
      })
    );
  };

  const getCategoryFromFilter = (): string => {
    const filter = searchFilter.trim().toLowerCase();
    if (!filter) return "Geral";
    return filter.charAt(0).toUpperCase() + filter.slice(1);
  };

  const removeAccents = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const normalizeBaseName = (name: string): string => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const groupScrapedProducts = (scrapedProducts: ScrapedProduct[]): GroupedProduct[] => {
    const successProducts = scrapedProducts.filter(p => p.status === "success" && p.name);
    const results: GroupedProduct[] = [];

    for (const product of successProducts) {
      const scrapedColor = product.colors?.[0] || null;
      const { baseName, color } = extractBaseName(product.name || "", scrapedColor);
      const normalizedBaseName = normalizeBaseName(baseName);
      const productPrice = priceMappingField === "price" ? (product.price || 0) : 0;

      const allImages = [...product.images];
      const initialSelectedIndices = allImages.slice(0, maxPhotosPerProduct).map((_, idx) => idx);

      results.push({
        id: crypto.randomUUID(),
        baseName: normalizedBaseName,
        mainCategory: defaultMainCategory,
        subcategory: defaultSubcategory,
        model: "",
        colorLabel: color || "",
        customDetail: "",
        costPrice: useDefaultPrices && defaultCostPrice > 0 ? defaultCostPrice : productPrice,
        salePrice: useDefaultPrices && defaultSalePrice > 0 ? defaultSalePrice : Math.round(productPrice * MARKUP_PERCENTAGE * 100) / 100,
        minStockLevel: defaultMinStock,
        description: product.description || "",
        images: allImages,
        selectedImageIndices: initialSelectedIndices,
        selected: true,
        expanded: false,
      });
    }

    return results;
  };

  const handleScrapeProducts = async () => {
    if (productUrls.length === 0) return;

    setIsScraping(true);
    setStep("scrape");
    setScrapingProgress(0);

    const scraped: ScrapedProduct[] = productUrls.map((url) => ({
      url,
      name: null,
      price: null,
      description: null,
      images: [],
      colors: [],
      sizes: [],
      category: null,
      selected: false,
      status: "pending" as const,
    }));
    setProducts(scraped);

    const batchSize = 3;
    const maxRetries = 2;

    const scrapeProduct = async (product: ScrapedProduct, index: number, attempt = 1): Promise<void> => {
      try {
        setProducts((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], status: "loading" };
          return updated;
        });

        const { data, error } = await supabase.functions.invoke("scrape-product-images", {
          body: { url: product.url },
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "Erro");

        setProducts((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            name: data.productData?.name || extractNameFromUrl(product.url),
            price: data.productData?.price || null,
            description: data.productData?.description || null,
            images: data.images || [],
            colors: data.productData?.colors || [],
            sizes: data.productData?.sizes || [],
            category: data.productData?.category || "Top",
            selected: true,
            status: "success",
          };
          return updated;
        });
      } catch (error) {
        const isTimeout = error instanceof Error && 
          (error.message.includes('timeout') || error.message.includes('408'));
        
        if (isTimeout && attempt < maxRetries) {
          console.log(`Retry ${attempt} for ${product.url}`);
          await new Promise(r => setTimeout(r, 1000));
          return scrapeProduct(product, index, attempt + 1);
        }

        console.error(`Error scraping ${product.url}:`, error);
        setProducts((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            name: extractNameFromUrl(product.url),
            status: "error",
            error: error instanceof Error ? error.message : "Erro ao buscar",
          };
          return updated;
        });
      }
    };

    for (let i = 0; i < scraped.length; i += batchSize) {
      const batch = scraped.slice(i, i + batchSize);
      await Promise.all(
        batch.map((product, batchIndex) => scrapeProduct(product, i + batchIndex))
      );
      setScrapingProgress(Math.min(100, Math.round(((i + batchSize) / scraped.length) * 100)));
    }

    setIsScraping(false);
    
    const grouped = groupScrapedProducts(products);
    setGroupedProducts(grouped);
    setStep("group");
    toast.success("Produtos carregados! Revise antes de importar.");
  };

  useEffect(() => {
    if (step === "group" && products.length > 0) {
      const grouped = groupScrapedProducts(products);
      setGroupedProducts(grouped);
    }
  }, [step]);

  const extractNameFromUrl = (url: string): string => {
    try {
      const path = new URL(url).pathname;
      const slug = path.split("/").filter(Boolean).pop() || "";
      return slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      return "Produto";
    }
  };

  const toggleProductSelection = (id: string) => {
    setGroupedProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const toggleProductExpanded = (id: string) => {
    setGroupedProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, expanded: !p.expanded } : p))
    );
  };

  const toggleSelectAll = (selected: boolean) => {
    setGroupedProducts((prev) => prev.map((p) => ({ ...p, selected })));
  };

  const updateProduct = (id: string, updates: Partial<GroupedProduct>) => {
    setGroupedProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const toggleProductImage = (productId: string, imageIndex: number) => {
    setGroupedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const currentSelected = p.selectedImageIndices;
        if (currentSelected.includes(imageIndex)) {
          return { ...p, selectedImageIndices: currentSelected.filter(i => i !== imageIndex) };
        } else {
          if (currentSelected.length >= maxPhotosPerProduct) {
            toast.warning(`Máximo de ${maxPhotosPerProduct} ${maxPhotosPerProduct === 1 ? 'imagem' : 'imagens'} por produto`);
            return p;
          }
          return { ...p, selectedImageIndices: [...currentSelected, imageIndex].sort((a, b) => a - b) };
        }
      })
    );
  };

  const handleImport = async () => {
    if (!user) return;

    const selectedProducts = groupedProducts.filter((p) => p.selected);
    if (selectedProducts.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    if (!selectedSupplierId) {
      toast.error("Selecione um fornecedor");
      return;
    }

    setIsImporting(true);
    setStep("importing");
    setImportProgress(0);

    let imported = 0;
    const errors: string[] = [];

    for (const product of selectedProducts) {
      try {
        const selectedImages = product.selectedImageIndices
          .map(idx => product.images[idx])
          .filter(Boolean);

        // Use baseName directly - user may have already edited it to include color
        // colorLabel is only for the filter field, not for concatenation
        // Safety: remove trailing colorLabel from name if it was accidentally duplicated
        let finalName = product.baseName.trim();
        if (product.colorLabel && finalName.toLowerCase().endsWith(` ${product.colorLabel.toLowerCase()}`)) {
          const nameWithoutTrailingColor = finalName.slice(0, finalName.length - product.colorLabel.length).trim();
          // Only strip if there's still a meaningful name left
          if (nameWithoutTrailingColor.length > 2) {
            // Check if the color appears MORE than once (indicating duplication)
            const colorRegex = new RegExp(product.colorLabel.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            const matches = finalName.match(colorRegex);
            if (matches && matches.length > 1) {
              finalName = nameWithoutTrailingColor;
            }
          }
        }
        const { error: productError } = await supabase
          .from("products")
          .insert({
            name: finalName,
            main_category: product.mainCategory || null,
            subcategory: product.subcategory || null,
            category: product.mainCategory || getCategoryFromFilter(), // Backward compatibility
            model: product.model || null,
            color_label: product.colorLabel || null,
            custom_detail: product.customDetail || null,
            price: product.salePrice,
            cost_price: product.costPrice,
            description: product.description,
            stock_quantity: 0,
            min_stock_level: product.minStockLevel,
            owner_id: user.id,
            supplier_id: selectedSupplierId,
            image_url: selectedImages[0] || null,
            image_url_2: selectedImages[1] || null,
            image_url_3: selectedImages[2] || null,
          });

        if (productError) throw productError;

        imported++;
      } catch (error) {
        console.error("Error importing:", error);
        errors.push(product.baseName);
      }

      setImportProgress(Math.round((imported / selectedProducts.length) * 100));
    }

    setIsImporting(false);

    if (errors.length > 0) {
      toast.warning(`Importados ${imported} produtos. ${errors.length} erros.`);
    } else {
      toast.success(`${imported} produtos importados com sucesso!`);
    }

    onImportComplete();
    handleClose();
  };

  const handleClose = () => {
    setStep("url");
    setSearchFilter("top");
    setProductUrls([]);
    setProducts([]);
    setGroupedProducts([]);
    setScrapingProgress(0);
    setImportProgress(0);
    setPreviewSamples([]);
    setExtractColorFromName(true);
    setCustomColorKeywords("");
    setColorMappingField("auto");
    setPriceMappingField("price");
    setMaxPhotosPerProduct(3);
    setDefaultCostPrice(0);
    setDefaultSalePrice(0);
    setUseDefaultPrices(false);
    setDefaultMainCategory("");
    setDefaultSubcategory("");
    setDefaultMinStock(2);
    setSelectedSupplierId("");
    setSelectedSupplier(null);
    onOpenChange(false);
  };

  const selectedCount = groupedProducts.filter((p) => p.selected).length;

  const getSubcategoriesForMain = (mainCategoryName: string) => {
    const mainCat = mainCategories.find(c => c.name === mainCategoryName);
    if (!mainCat) return [];
    return subcategories.filter(s => s.main_category_id === mainCat.id);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-h-[95vh] overflow-hidden flex flex-col",
        step === "preview" ? "max-w-6xl w-[95vw]" : "max-w-4xl"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Importar do Site do Fornecedor
          </DialogTitle>
          <DialogDescription>
            {step === "url" && "Selecione o fornecedor e um filtro para buscar produtos"}
            {step === "discover" && `${productUrls.length} produtos encontrados`}
            {step === "preview" && "Configure como os dados serão interpretados"}
            {step === "scrape" && "Buscando informações dos produtos..."}
            {step === "group" && `${groupedProducts.length} produtos agrupados`}
            {step === "importing" && "Importando produtos..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Supplier Selection */}
          {step === "url" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {!s.website && "(sem site)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSupplier && !selectedSupplier.website && (
                  <p className="text-xs text-destructive">
                    Este fornecedor não possui site cadastrado. Vá em Fornecedores para adicionar.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Filtro de Busca / Categoria</Label>
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="top, vestido, calça..."
                />
                <p className="text-xs text-muted-foreground">
                  Filtra URLs que contêm esta palavra
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Discovered URLs */}
          {step === "discover" && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {productUrls.length} URLs de produtos encontradas
                </span>
                <Button variant="outline" size="sm" onClick={() => setStep("url")}>
                  Voltar
                </Button>
              </div>
              <ScrollArea className="h-[300px] border rounded-lg p-3">
                <div className="space-y-1">
                  {productUrls.slice(0, 50).map((url, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground truncate">
                      {url}
                    </div>
                  ))}
                  {productUrls.length > 50 && (
                    <div className="text-xs text-muted-foreground pt-2">
                      ... e mais {productUrls.length - 50} produtos
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 2.5: Preview Configuration */}
          {step === "preview" && (
            <div className="flex-1 overflow-auto">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Carregando exemplos...</p>
                </div>
              ) : previewSamples.length > 0 ? (
                <div className="flex gap-6 p-4 h-full">
                  {/* Left: Sample selection (thumbnails) */}
                  <div className="w-24 shrink-0 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Exemplos:</p>
                    <div className="flex flex-col gap-2">
                      {previewSamples.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedSampleIndex(idx)}
                          className={cn(
                            "relative h-20 w-20 rounded-lg overflow-hidden border-2 transition-all",
                            selectedSampleIndex === idx
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <img
                            src={sample.images?.[0] || '/placeholder.svg'}
                            alt={`Exemplo ${idx + 1}`}
                            className="w-full h-full object-cover pointer-events-none"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                          {selectedSampleIndex === idx && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="h-5 w-5 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Mapping configuration */}
                  <div className="flex-1 space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-4">
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">Configurações de Mapeamento Padrão</h3>
                    </div>

                    {/* Photos config */}
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Image className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Fotos por Produto</span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3].map((num) => (
                          <Button
                            key={num}
                            type="button"
                            variant={maxPhotosPerProduct === num ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMaxPhotosPerProduct(num)}
                          >
                            {num}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Category defaults */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Categoria Principal</Label>
                        <select
                          value={defaultMainCategory}
                          onChange={(e) => {
                            setDefaultMainCategory(e.target.value);
                            setDefaultSubcategory("");
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value="">Selecione...</option>
                          {mainCategories.map((cat) => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Subcategoria</Label>
                        <select
                          value={defaultSubcategory}
                          onChange={(e) => setDefaultSubcategory(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          disabled={!defaultMainCategory}
                        >
                          <option value="">Selecione...</option>
                          {getSubcategoriesForMain(defaultMainCategory).map((sub) => (
                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Color mapping */}
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Extração de Cor do Nome</span>
                        <Checkbox
                          checked={extractColorFromName}
                          onCheckedChange={(checked) => {
                            setExtractColorFromName(!!checked);
                            reparsePreviewSamples();
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Detecta cor no nome e preenche o campo "Cor" automaticamente
                      </p>
                    </div>

                    {/* Price config */}
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-1.5 mb-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Preços</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          checked={useDefaultPrices}
                          onCheckedChange={(checked) => setUseDefaultPrices(!!checked)}
                        />
                        <span className="text-xs">Usar preços fixos</span>
                      </div>
                      {useDefaultPrices && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Custo (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={defaultCostPrice}
                              onChange={(e) => setDefaultCostPrice(parseFloat(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Venda (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={defaultSalePrice}
                              onChange={(e) => setDefaultSalePrice(parseFloat(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                        </div>
                      )}
                      {!useDefaultPrices && (
                        <p className="text-xs text-muted-foreground">
                          Preço será extraído do site e multiplicado por {MARKUP_PERCENTAGE}x para venda
                        </p>
                      )}
                    </div>

                    {/* Min stock */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Estoque Mínimo Padrão</Label>
                        <Input
                          type="number"
                          value={defaultMinStock}
                          onChange={(e) => setDefaultMinStock(parseInt(e.target.value) || 2)}
                          className="h-8"
                        />
                      </div>
                    </div>

                    {/* Preview Result */}
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-xs font-medium mb-2">Exemplo de interpretação:</p>
                      <div className="flex items-start gap-3">
                        {previewSamples[selectedSampleIndex]?.images?.[0] && (
                          <img
                            src={previewSamples[selectedSampleIndex].images[0]}
                            alt=""
                            className="h-16 w-16 rounded object-cover shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium truncate">
                            {previewSamples[selectedSampleIndex]?.parsedBaseName || "—"}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {previewSamples[selectedSampleIndex]?.parsedColor && extractColorFromName && (
                              <Badge variant="default" className="text-[10px] h-5">
                                Cor: {previewSamples[selectedSampleIndex].parsedColor}
                              </Badge>
                            )}
                            {previewSamples[selectedSampleIndex]?.price && !useDefaultPrices && (
                              <span className="text-primary font-medium">
                                R$ {previewSamples[selectedSampleIndex].price?.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>
                  <Button variant="outline" size="sm" onClick={() => setStep("discover")}>
                    Voltar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Scraping Progress */}
          {step === "scrape" && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Buscando informações...</span>
                  <span>{scrapingProgress}%</span>
                </div>
                <Progress value={scrapingProgress} />
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {products.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      {p.status === "loading" && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {p.status === "success" && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      {p.status === "error" && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                      {p.status === "pending" && (
                        <div className="h-4 w-4 rounded-full border-2" />
                      )}
                      <span className="truncate flex-1">{p.name || p.url}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 4: Review Products */}
          {step === "group" && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCount === groupedProducts.length && groupedProducts.length > 0}
                    onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                  />
                  <span className="text-sm">
                    {selectedCount} de {groupedProducts.length} selecionados
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep("url");
                    setProducts([]);
                    setGroupedProducts([]);
                  }}
                >
                  Voltar
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium text-primary">💡 Revise e edite antes de importar</p>
                <p className="text-muted-foreground">
                  Clique em um produto para expandir e editar todos os campos.
                </p>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="space-y-2 pr-4">
                  {groupedProducts.map((product) => (
                    <Collapsible
                      key={product.id}
                      open={product.expanded}
                      onOpenChange={() => toggleProductExpanded(product.id)}
                    >
                      <div
                        className={cn(
                          "rounded-lg border",
                          product.selected && "bg-primary/5 border-primary/20"
                        )}
                      >
                        <div className="flex items-start gap-3 p-3">
                          <Checkbox
                            checked={product.selected}
                            onCheckedChange={() => toggleProductSelection(product.id)}
                            onClick={(e) => e.stopPropagation()}
                          />

                          {product.images[0] ? (
                            <img
                              src={product.images[product.selectedImageIndices[0]] || product.images[0]}
                              alt={product.baseName}
                              className="h-14 w-14 rounded object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder.svg';
                              }}
                            />
                          ) : (
                            <div className="h-14 w-14 rounded bg-muted flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{product.baseName}</div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Custo: R$ {product.costPrice.toFixed(2)}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="text-foreground font-medium">
                                R$ {product.salePrice.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.colorLabel && (
                                <Badge variant="default" className="text-xs">
                                  {product.colorLabel}
                                </Badge>
                              )}
                              {product.mainCategory && (
                                <Badge variant="secondary" className="text-xs">
                                  {product.mainCategory}
                                </Badge>
                              )}
                              {product.subcategory && (
                                <Badge variant="outline" className="text-xs">
                                  {product.subcategory}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {product.expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>

                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-3 border-t pt-3">
                            {/* Photos Selection */}
                            <div>
                              <Label className="text-xs flex items-center gap-2 mb-2">
                                <Image className="h-3 w-3" />
                                Fotos (selecione até {maxPhotosPerProduct})
                              </Label>
                              <div className="flex flex-wrap gap-2">
                                {product.images.slice(0, 12).map((img, imgIdx) => (
                                  <button
                                    key={imgIdx}
                                    type="button"
                                    onClick={() => toggleProductImage(product.id, imgIdx)}
                                    className={cn(
                                      "relative h-14 w-14 rounded-lg overflow-hidden border-2 transition-all",
                                      product.selectedImageIndices.includes(imgIdx)
                                        ? "border-primary ring-2 ring-primary/20"
                                        : "border-border hover:border-primary/50"
                                    )}
                                  >
                                    <img
                                      src={img}
                                      alt={`Foto ${imgIdx + 1}`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                                      }}
                                    />
                                    {product.selectedImageIndices.includes(imgIdx) && (
                                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                        <div className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                                          {product.selectedImageIndices.indexOf(imgIdx) + 1}
                                        </div>
                                      </div>
                                    )}
                                  </button>
                                ))}
                                {product.images.length > 12 && (
                                  <span className="text-xs text-muted-foreground self-center">
                                    +{product.images.length - 12}
                                  </span>
                                )}
                              </div>
                            </div>

                            <Separator />

                            {/* Name */}
                            <div>
                              <Label className="text-xs">Nome do Produto</Label>
                              <Input
                                value={product.baseName}
                                onChange={(e) => updateProduct(product.id, { baseName: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>

                            {/* Categories */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Categoria Principal</Label>
                                <select
                                  value={product.mainCategory}
                                  onChange={(e) => updateProduct(product.id, { 
                                    mainCategory: e.target.value,
                                    subcategory: ""
                                  })}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                >
                                  <option value="">Selecione...</option>
                                  {mainCategories.map((cat) => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <Label className="text-xs">Subcategoria</Label>
                                <select
                                  value={product.subcategory}
                                  onChange={(e) => updateProduct(product.id, { subcategory: e.target.value })}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                  disabled={!product.mainCategory}
                                >
                                  <option value="">Selecione...</option>
                                  {getSubcategoriesForMain(product.mainCategory).map((sub) => (
                                    <option key={sub.id} value={sub.name}>{sub.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Filter Fields */}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Modelo (opcional)</Label>
                                <Input
                                  value={product.model}
                                  onChange={(e) => updateProduct(product.id, { model: e.target.value })}
                                  placeholder="Ex: Carol"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Cor (opcional)</Label>
                                <Input
                                  value={product.colorLabel}
                                  onChange={(e) => updateProduct(product.id, { colorLabel: e.target.value })}
                                  placeholder="Ex: Rosa"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Detalhe (opcional)</Label>
                                <Input
                                  value={product.customDetail}
                                  onChange={(e) => updateProduct(product.id, { customDetail: e.target.value })}
                                  placeholder="Ex: Com Renda"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>

                            {/* Prices */}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Preço de Custo (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={product.costPrice}
                                  onChange={(e) => {
                                    const cost = parseFloat(e.target.value) || 0;
                                    updateProduct(product.id, { 
                                      costPrice: cost,
                                      salePrice: Math.round(cost * MARKUP_PERCENTAGE * 100) / 100
                                    });
                                  }}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Preço de Venda (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={product.salePrice}
                                  onChange={(e) => updateProduct(product.id, { salePrice: parseFloat(e.target.value) || 0 })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Estoque Mínimo</Label>
                                <Input
                                  type="number"
                                  value={product.minStockLevel}
                                  onChange={(e) => updateProduct(product.id, { minStockLevel: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 5: Importing */}
          {step === "importing" && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importando produtos...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancelar
          </Button>

          {step === "url" && (
            <Button 
              onClick={handleDiscoverProducts} 
              disabled={isDiscovering || !selectedSupplier?.website}
            >
              {isDiscovering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Descobrir Produtos
                </>
              )}
            </Button>
          )}

          {step === "discover" && (
            <Button onClick={handleLoadPreview}>
              <Eye className="h-4 w-4 mr-2" />
              Pré-visualizar ({productUrls.length})
            </Button>
          )}

          {step === "preview" && (
            <Button onClick={handleScrapeProducts} disabled={isLoadingPreview}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Importar Todos ({productUrls.length})
            </Button>
          )}

          {step === "group" && (
            <Button onClick={handleImport} disabled={selectedCount === 0}>
              <Check className="h-4 w-4 mr-2" />
              Importar {selectedCount} Produtos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
