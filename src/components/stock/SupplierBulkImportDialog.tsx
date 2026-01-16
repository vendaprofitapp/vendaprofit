import { useState, useEffect } from "react";
import {
  Globe,
  Loader2,
  Check,
  X,
  Package,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  Settings2,
  Image,
  Tag,
  Palette,
  Ruler,
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
  // Parsed result
  parsedBaseName: string;
  parsedColor: string | null;
  parsedSize: string | null;
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

interface ProductVariant {
  color: string;
  size: string;
  quantity: number;
}

interface GroupedProduct {
  id: string;
  baseName: string;
  category: string;
  costPrice: number;
  salePrice: number;
  description: string;
  images: string[];
  variants: ProductVariant[];
  selected: boolean;
  expanded: boolean;
}

interface Supplier {
  id: string;
  name: string;
}

interface SupplierBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

const MARKUP_PERCENTAGE = 1.67;

// Common color names to detect - includes compound colors (e.g., "verde militar")
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

// Size patterns
const SIZE_PATTERN = /\b(pp|p|m|g|gg|xg|xxg|xxxg|eg|exg|u|un|uni|único|unico|36|38|40|42|44|46|48|50)\b/i;

export function SupplierBulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: SupplierBulkImportDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<"url" | "discover" | "preview" | "scrape" | "group" | "importing">("url");
  const [siteUrl, setSiteUrl] = useState("https://inmoov.se");
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
  const [editingProduct, setEditingProduct] = useState<GroupedProduct | null>(null);
  
  // Photo selection - which photo indices to import (1-based for user)
  const [selectedPhotoIndices, setSelectedPhotoIndices] = useState<number[]>([1, 2, 3]);
  const [maxPhotosAvailable] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // Preview configuration
  const [previewSamples, setPreviewSamples] = useState<PreviewSample[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [extractColorFromName, setExtractColorFromName] = useState(true);
  const [extractSizeFromName, setExtractSizeFromName] = useState(true);
  const [customColorKeywords, setCustomColorKeywords] = useState<string>("");
  const [markupPercentage, setMarkupPercentage] = useState(1.67);
  // Number of words that form the product base name (e.g., "TOP LIVIA" = 2 words)
  const [baseNameWordCount, setBaseNameWordCount] = useState<number>(2);
  // Available sizes for the product - will create all combinations
  const [availableSizes, setAvailableSizes] = useState<string[]>(["P", "M", "G", "GG"]);
  const [newSizeInput, setNewSizeInput] = useState<string>("");

  useEffect(() => {
    if (open && user) {
      fetchSuppliers();
    }
  }, [open, user]);

  const fetchSuppliers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("name");
    setSuppliers(data ?? []);
    
    const inmoov = data?.find(s => s.name.toLowerCase().includes("inmoov"));
    if (inmoov) {
      setSelectedSupplierId(inmoov.id);
    }
  };

  const handleDiscoverProducts = async () => {
    if (!siteUrl.trim()) {
      toast.error("Digite a URL do site");
      return;
    }

    setIsDiscovering(true);
    setProductUrls([]);

    try {
      const { data, error } = await supabase.functions.invoke("map-supplier-site", {
        body: { url: siteUrl.trim(), search: searchFilter.trim() },
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

  // Get all color keywords including custom ones - compound colors first for better matching
  const getAllColorKeywords = (): string[] => {
    const customColors = customColorKeywords
      .split(",")
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);
    // Put compound colors first, then simple colors, then custom
    return [...COMPOUND_COLORS, ...SIMPLE_COLORS, ...customColors];
  };

  const extractBaseName = (fullName: string): { baseName: string; color: string | null; size: string | null } => {
    const words = fullName.trim().split(/\s+/);
    let detectedColor: string | null = null;
    let detectedSize: string | null = null;

    // If baseNameWordCount is set, use that approach
    if (baseNameWordCount > 0 && words.length > baseNameWordCount) {
      // Take first N words as base name
      const baseName = words.slice(0, baseNameWordCount).join(" ");
      const remaining = words.slice(baseNameWordCount).join(" ");
      
      // Extract size from remaining
      if (extractSizeFromName) {
        const sizeMatch = remaining.match(SIZE_PATTERN);
        if (sizeMatch) {
          detectedSize = sizeMatch[1].toUpperCase();
          if (detectedSize === "UN" || detectedSize === "UNI" || detectedSize === "UNICO" || detectedSize === "ÚNICO") {
            detectedSize = "U";
          }
        }
      }

      // Everything else after base name (excluding size) is the color
      if (extractColorFromName) {
        let colorPart = remaining;
        if (detectedSize) {
          colorPart = colorPart.replace(SIZE_PATTERN, "").trim();
        }
        // Clean up dashes and extra spaces
        colorPart = colorPart.replace(/\s+/g, " ").replace(/\s*-\s*/g, " ").trim();
        if (colorPart) {
          // Capitalize each word
          detectedColor = colorPart
            .split(" ")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
        }
      }

      return { baseName, color: detectedColor, size: detectedSize };
    }

    // Fallback: Original logic using color detection
    let name = fullName.trim();

    // Extract size first (if enabled)
    if (extractSizeFromName) {
      const sizeMatch = name.match(SIZE_PATTERN);
      if (sizeMatch) {
        detectedSize = sizeMatch[1].toUpperCase();
        if (detectedSize === "UN" || detectedSize === "UNI" || detectedSize === "UNICO" || detectedSize === "ÚNICO") {
          detectedSize = "U";
        }
        name = name.replace(SIZE_PATTERN, "").trim();
      }
    }

    // Extract color (if enabled) - try compound colors first
    if (extractColorFromName) {
      const lowerName = name.toLowerCase();
      const allColors = getAllColorKeywords();
      for (const color of allColors) {
        // Escape regex special chars and handle multi-word colors
        const escapedColor = color.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const colorRegex = new RegExp(`\\b${escapedColor}\\b`, "i");
        if (colorRegex.test(lowerName)) {
          // Capitalize properly
          detectedColor = color
            .split(" ")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          name = name.replace(colorRegex, "").trim();
          break;
        }
      }
    }

    // Clean up extra spaces and dashes
    name = name.replace(/\s+/g, " ").replace(/\s*-\s*$/, "").replace(/^\s*-\s*/, "").trim();

    return { baseName: name, color: detectedColor, size: detectedSize };
  };

  // Load preview samples from first few products
  const handleLoadPreview = async () => {
    if (productUrls.length === 0) return;

    setIsLoadingPreview(true);
    setPreviewSamples([]);
    setStep("preview");

    // Get up to 3 sample products
    const sampleUrls = productUrls.slice(0, 3);
    const samples: PreviewSample[] = [];

    for (const url of sampleUrls) {
      try {
        const { data, error } = await supabase.functions.invoke("scrape-product-images", {
          body: { url },
        });

        if (error || !data.success) continue;

        const rawName = data.productData?.name || "";
        const { baseName, color, size } = extractBaseName(rawName);

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
          parsedSize: size,
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

  // Reparse preview samples when extraction settings change
  const reparsePreviewSamples = () => {
    setPreviewSamples(prev => 
      prev.map(sample => {
        const { baseName, color, size } = extractBaseName(sample.rawName || "");
        return {
          ...sample,
          parsedBaseName: baseName,
          parsedColor: color,
          parsedSize: size,
        };
      })
    );
  };

  // Filter images based on selected indices (convert from 1-based to 0-based)
  const filterImagesBySelectedIndices = (images: string[]): string[] => {
    return selectedPhotoIndices
      .map(idx => images[idx - 1]) // Convert 1-based to 0-based
      .filter(Boolean) as string[];
  };

  // Get category from search filter
  const getCategoryFromFilter = (): string => {
    const filter = searchFilter.trim().toLowerCase();
    if (!filter) return "Geral";
    // Capitalize first letter
    return filter.charAt(0).toUpperCase() + filter.slice(1);
  };

  // Helper to remove accents from string for comparison
  const removeAccents = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  // Helper to normalize base name for consistent comparison
  const normalizeBaseName = (name: string): string => {
    // Convert to title case for consistent display
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const groupScrapedProducts = (scrapedProducts: ScrapedProduct[]): GroupedProduct[] => {
    const successProducts = scrapedProducts.filter(p => p.status === "success" && p.name);
    const productMap = new Map<string, GroupedProduct>();
    const categoryFromFilter = getCategoryFromFilter();

    for (const product of successProducts) {
      const { baseName, color, size } = extractBaseName(product.name || "");
      // Use lowercase + remove accents for grouping (case-insensitive and accent-insensitive)
      const key = removeAccents(baseName.toLowerCase().trim());
      // Normalize the display name to title case
      const normalizedBaseName = normalizeBaseName(baseName);

      if (!productMap.has(key)) {
        // Filter images based on user selection
        const filteredImages = filterImagesBySelectedIndices(product.images);
        
        productMap.set(key, {
          id: crypto.randomUUID(),
          baseName: normalizedBaseName,
          category: categoryFromFilter, // Use filter as category
          costPrice: product.price || 0,
          salePrice: Math.round((product.price || 0) * markupPercentage * 100) / 100,
          description: product.description || "",
          images: filteredImages,
          variants: [],
          selected: true,
          expanded: false,
        });
      }

      const grouped = productMap.get(key)!;
      
      // Add filtered images if new
      const filteredProductImages = filterImagesBySelectedIndices(product.images);
      for (const img of filteredProductImages) {
        if (!grouped.images.includes(img)) {
          grouped.images.push(img);
        }
      }

      // Add variant - use availableSizes to create all combinations
      const colors = color ? [color] : (product.colors.length > 0 ? product.colors : ["Sem cor"]);
      // Use availableSizes from preview configuration instead of extracted sizes
      const sizesToUse = availableSizes.length > 0 ? availableSizes : (size ? [size] : (product.sizes.length > 0 ? product.sizes : ["U"]));

      for (const c of colors) {
        for (const s of sizesToUse) {
          const exists = grouped.variants.some(v => 
            v.color.toLowerCase() === c.toLowerCase() && 
            v.size.toLowerCase() === s.toLowerCase()
          );
          if (!exists) {
            grouped.variants.push({ color: c, size: s, quantity: 0 });
          }
        }
      }
    }

    return Array.from(productMap.values());
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
    
    // Group products
    const grouped = groupScrapedProducts(products);
    setGroupedProducts(grouped);
    setStep("group");
    toast.success("Produtos agrupados! Revise antes de importar.");
  };

  // Watch products changes to update grouped when scraping finishes
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

  const addVariant = (productId: string) => {
    setGroupedProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, variants: [...p.variants, { color: "Nova cor", size: "M", quantity: 0 }] }
          : p
      )
    );
  };

  const updateVariant = (productId: string, variantIndex: number, updates: Partial<ProductVariant>) => {
    setGroupedProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              variants: p.variants.map((v, i) =>
                i === variantIndex ? { ...v, ...updates } : v
              ),
            }
          : p
      )
    );
  };

  const removeVariant = (productId: string, variantIndex: number) => {
    setGroupedProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, variants: p.variants.filter((_, i) => i !== variantIndex) }
          : p
      )
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
        // Create main product
        const { data: newProduct, error: productError } = await supabase
          .from("products")
          .insert({
            name: product.baseName,
            category: product.category,
            price: product.salePrice,
            cost_price: product.costPrice,
            description: product.description,
            stock_quantity: 0,
            min_stock_level: 2,
            owner_id: user.id,
            supplier_id: selectedSupplierId,
            image_url: product.images[0] || null,
            image_url_2: product.images[1] || null,
            image_url_3: product.images[2] || null,
          })
          .select("id")
          .single();

        if (productError) throw productError;

        // Create variants
        if (newProduct && product.variants.length > 0) {
          const variants = product.variants.map((v) => ({
            product_id: newProduct.id,
            color: v.color,
            size: v.size,
            stock_quantity: v.quantity,
            image_url: product.images[0] || null,
          }));

          await supabase.from("product_variants").insert(variants);
        }

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
    setSiteUrl("https://inmoov.se");
    setSearchFilter("top");
    setProductUrls([]);
    setProducts([]);
    setGroupedProducts([]);
    setScrapingProgress(0);
    setImportProgress(0);
    setEditingProduct(null);
    setSelectedPhotoIndices([1, 2, 3]);
    setPreviewSamples([]);
    setExtractColorFromName(true);
    setExtractSizeFromName(true);
    setCustomColorKeywords("");
    setMarkupPercentage(1.67);
    setBaseNameWordCount(2);
    setAvailableSizes(["P", "M", "G", "GG"]);
    setNewSizeInput("");
    onOpenChange(false);
  };

  const selectedCount = groupedProducts.filter((p) => p.selected).length;
  const totalVariants = groupedProducts.reduce((acc, p) => acc + p.variants.length, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Importar do Site do Fornecedor
          </DialogTitle>
          <DialogDescription>
            {step === "url" && "Digite a URL do site e um filtro para buscar produtos"}
            {step === "discover" && `${productUrls.length} produtos encontrados`}
            {step === "preview" && "Configure como os dados serão interpretados"}
            {step === "scrape" && "Buscando informações dos produtos..."}
            {step === "group" && `${groupedProducts.length} produtos agrupados com ${totalVariants} variantes`}
            {step === "importing" && "Importando produtos..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: URL Input */}
          {step === "url" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>URL do Site</Label>
                <Input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://inmoov.se"
                />
              </div>
              <div className="space-y-2">
                <Label>Filtro de Busca / Categoria</Label>
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="top, vestido, calça..."
                />
                <p className="text-xs text-muted-foreground">
                  Filtra URLs que contêm esta palavra e define a categoria dos produtos
                </p>
              </div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fotos a Importar</Label>
                <div className="flex flex-wrap gap-2">
                  {maxPhotosAvailable.map((photoNum) => (
                    <label
                      key={photoNum}
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg border-2 cursor-pointer transition-all",
                        selectedPhotoIndices.includes(photoNum)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-muted-foreground/30"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selectedPhotoIndices.includes(photoNum)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPhotoIndices([...selectedPhotoIndices, photoNum].sort((a, b) => a - b));
                          } else {
                            setSelectedPhotoIndices(selectedPhotoIndices.filter((i) => i !== photoNum));
                          }
                        }}
                      />
                      <span className="font-medium">{photoNum}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione quais fotos importar (ex: apenas 1, 2 e 3). Fotos não selecionadas serão ignoradas.
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
            <div className="space-y-4 py-4">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Carregando exemplos...</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Configurar Importação</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setStep("discover")}>
                      Voltar
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Left: Configuration */}
                    <div className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Estrutura do Nome
                        </h4>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Quantas palavras formam o nome do produto?</Label>
                          <div className="flex items-center gap-2">
                            <Select
                              value={baseNameWordCount.toString()}
                              onValueChange={(val) => {
                                setBaseNameWordCount(parseInt(val));
                                setTimeout(reparsePreviewSamples, 0);
                              }}
                            >
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">Auto</SelectItem>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground">
                              palavras
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Ex: "TOP LIVIA" = 2 palavras. O resto é cor/tamanho.
                          </p>
                        </div>

                        <Separator />
                        
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="extractColor"
                            checked={extractColorFromName}
                            onCheckedChange={(checked) => {
                              setExtractColorFromName(!!checked);
                              setTimeout(reparsePreviewSamples, 0);
                            }}
                          />
                          <Label htmlFor="extractColor" className="text-sm flex items-center gap-2">
                            <Palette className="h-3 w-3" />
                            Extrair cor
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="extractSize"
                            checked={extractSizeFromName}
                            onCheckedChange={(checked) => {
                              setExtractSizeFromName(!!checked);
                              setTimeout(reparsePreviewSamples, 0);
                            }}
                          />
                          <Label htmlFor="extractSize" className="text-sm flex items-center gap-2">
                            <Ruler className="h-3 w-3" />
                            Extrair tamanho
                          </Label>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Cores adicionais (vírgula)</Label>
                          <Input
                            value={customColorKeywords}
                            onChange={(e) => {
                              setCustomColorKeywords(e.target.value);
                              setTimeout(reparsePreviewSamples, 100);
                            }}
                            placeholder="ex: flamingo, mirtilo"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                        <h4 className="font-medium text-sm">Markup / Margem</h4>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="1"
                            value={markupPercentage}
                            onChange={(e) => setMarkupPercentage(parseFloat(e.target.value) || 1)}
                            className="h-8 text-sm w-20"
                          />
                          <span className="text-sm text-muted-foreground">
                            = {((markupPercentage - 1) * 100).toFixed(0)}% de margem
                          </span>
                        </div>
                        {previewSamples[0]?.price && (
                          <p className="text-xs text-muted-foreground">
                            Ex: R$ {previewSamples[0].price.toFixed(2)} → R$ {(previewSamples[0].price * markupPercentage).toFixed(2)}
                          </p>
                        )}
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Ruler className="h-4 w-4" />
                          Tamanhos Disponíveis
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          Defina todos os tamanhos que este produto oferece. Variantes serão criadas para cada combinação cor + tamanho.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {availableSizes.map((size) => (
                            <Badge
                              key={size}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                              onClick={() => setAvailableSizes(availableSizes.filter(s => s !== size))}
                            >
                              {size} <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={newSizeInput}
                            onChange={(e) => setNewSizeInput(e.target.value.toUpperCase())}
                            placeholder="Ex: PP, XG..."
                            className="h-8 text-sm flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newSizeInput.trim()) {
                                e.preventDefault();
                                if (!availableSizes.includes(newSizeInput.trim())) {
                                  setAvailableSizes([...availableSizes, newSizeInput.trim()]);
                                }
                                setNewSizeInput("");
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (newSizeInput.trim() && !availableSizes.includes(newSizeInput.trim())) {
                                setAvailableSizes([...availableSizes, newSizeInput.trim()]);
                              }
                              setNewSizeInput("");
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          {["PP", "P", "M", "G", "GG", "XG", "U"].map((preset) => (
                            <Button
                              key={preset}
                              type="button"
                              size="sm"
                              variant={availableSizes.includes(preset) ? "default" : "outline"}
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                if (availableSizes.includes(preset)) {
                                  setAvailableSizes(availableSizes.filter(s => s !== preset));
                                } else {
                                  setAvailableSizes([...availableSizes, preset]);
                                }
                              }}
                            >
                              {preset}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          Fotos a Importar
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {maxPhotosAvailable.map((photoNum) => (
                            <label
                              key={photoNum}
                              className={cn(
                                "flex items-center justify-center w-8 h-8 rounded border-2 cursor-pointer transition-all text-sm",
                                selectedPhotoIndices.includes(photoNum)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background hover:bg-muted border-muted-foreground/30"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={selectedPhotoIndices.includes(photoNum)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPhotoIndices([...selectedPhotoIndices, photoNum].sort((a, b) => a - b));
                                  } else {
                                    setSelectedPhotoIndices(selectedPhotoIndices.filter((i) => i !== photoNum));
                                  }
                                }}
                              />
                              {photoNum}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Preview Results */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Pré-visualização ({previewSamples.length} exemplos)
                      </h4>

                      <ScrollArea className="h-[320px]">
                        <div className="space-y-3 pr-2">
                          {previewSamples.map((sample, idx) => (
                            <div key={idx} className="border rounded-lg p-3 space-y-2">
                              {/* Images */}
                              <div className="flex gap-1">
                                {filterImagesBySelectedIndices(sample.images).slice(0, 3).map((img, imgIdx) => (
                                  <img
                                    key={imgIdx}
                                    src={img}
                                    alt=""
                                    className="h-12 w-12 rounded object-cover"
                                  />
                                ))}
                                {sample.images.length === 0 && (
                                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                                    <Package className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                              </div>

                              {/* Raw name */}
                              <div>
                                <p className="text-xs text-muted-foreground">Nome original:</p>
                                <p className="text-sm font-mono bg-muted px-2 py-1 rounded">{sample.rawName || "—"}</p>
                              </div>

                              <Separator />

                              {/* Parsed results */}
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground mb-1">Nome Base</p>
                                  <Badge variant="secondary" className="font-medium">
                                    {sample.parsedBaseName || "—"}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-muted-foreground mb-1">Cor</p>
                                  <Badge variant={sample.parsedColor ? "default" : "outline"}>
                                    {sample.parsedColor || "Não detectada"}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-muted-foreground mb-1">Tamanho</p>
                                  <Badge variant={sample.parsedSize ? "default" : "outline"}>
                                    {sample.parsedSize || "Não detectado"}
                                  </Badge>
                                </div>
                              </div>

                              {/* Price */}
                              {sample.price && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Preço: </span>
                                  <span>R$ {sample.price.toFixed(2)}</span>
                                  <span className="text-muted-foreground"> → </span>
                                  <span className="font-medium text-primary">
                                    R$ {(sample.price * markupPercentage).toFixed(2)}
                                  </span>
                                </div>
                              )}

                              {/* Additional colors/sizes from scrape */}
                              {(sample.colors.length > 0 || sample.sizes.length > 0) && (
                                <div className="text-xs text-muted-foreground">
                                  {sample.colors.length > 0 && (
                                    <span>Cores detectadas: {sample.colors.join(", ")} | </span>
                                  )}
                                  {sample.sizes.length > 0 && (
                                    <span>Tamanhos: {sample.sizes.join(", ")}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </>
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

          {/* Step 4: Grouped Products Review */}
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
                  Clique em um produto para expandir e editar o nome, variantes (cor/tamanho).
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
                              src={product.images[0]}
                              alt={product.baseName}
                              className="h-14 w-14 rounded object-cover"
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
                              <span>→</span>
                              <span className="text-foreground font-medium">
                                R$ {product.salePrice.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {product.variants.length} variantes
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {product.category}
                              </Badge>
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
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Nome do Produto</Label>
                                <Input
                                  value={product.baseName}
                                  onChange={(e) => updateProduct(product.id, { baseName: e.target.value })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Categoria</Label>
                                <Input
                                  value={product.category}
                                  onChange={(e) => updateProduct(product.id, { category: e.target.value })}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
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
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs">Variantes (Cor / Tamanho)</Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => addVariant(product.id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Adicionar
                                </Button>
                              </div>
                              <div className="space-y-1.5">
                                {product.variants.map((variant, vIdx) => (
                                  <div key={vIdx} className="flex items-center gap-2">
                                    <Input
                                      value={variant.color}
                                      onChange={(e) => updateVariant(product.id, vIdx, { color: e.target.value })}
                                      placeholder="Cor"
                                      className="h-7 text-xs flex-1"
                                    />
                                    <Input
                                      value={variant.size}
                                      onChange={(e) => updateVariant(product.id, vIdx, { size: e.target.value })}
                                      placeholder="Tam"
                                      className="h-7 text-xs w-16"
                                    />
                                    <Input
                                      type="number"
                                      value={variant.quantity}
                                      onChange={(e) => updateVariant(product.id, vIdx, { quantity: parseInt(e.target.value) || 0 })}
                                      placeholder="Qtd"
                                      className="h-7 text-xs w-14"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => removeVariant(product.id, vIdx)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
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
            <Button onClick={handleDiscoverProducts} disabled={isDiscovering}>
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
