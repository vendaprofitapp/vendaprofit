import { useState, useEffect } from "react";
import {
  Globe,
  Loader2,
  Check,
  X,
  Package,
  AlertCircle,
  RefreshCw,
  Edit2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
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

// Common color names to detect
const COLOR_KEYWORDS = [
  "preto", "branco", "azul", "vermelho", "verde", "amarelo", "rosa", "roxo", 
  "laranja", "marrom", "bege", "cinza", "nude", "off white", "off-white",
  "vinho", "burgundy", "navy", "caramelo", "terracota", "coral", "lilás",
  "mostarda", "creme", "grafite", "chumbo", "areia", "chocolate", "café",
  "menta", "lavanda", "pêssego", "salmão", "turquesa", "esmeralda", "oliva",
  "ruby", "black", "white", "blue", "red", "green", "pink", "orange", "brown",
  "grey", "gray", "cream", "gold", "silver", "bronze", "champagne", "ivory",
  "marsala", "bordô", "ferrugem", "ocre", "camel", "taupe", "malva"
];

// Size patterns
const SIZE_PATTERN = /\b(pp|p|m|g|gg|xg|xxg|xxxg|eg|exg|u|un|uni|único|unico|36|38|40|42|44|46|48|50)\b/i;

export function SupplierBulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: SupplierBulkImportDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<"url" | "discover" | "scrape" | "group" | "review" | "importing">("url");
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

  const extractBaseName = (fullName: string): { baseName: string; color: string | null; size: string | null } => {
    let name = fullName.trim();
    let detectedColor: string | null = null;
    let detectedSize: string | null = null;

    // Extract size first
    const sizeMatch = name.match(SIZE_PATTERN);
    if (sizeMatch) {
      detectedSize = sizeMatch[1].toUpperCase();
      if (detectedSize === "UN" || detectedSize === "UNI" || detectedSize === "UNICO" || detectedSize === "ÚNICO") {
        detectedSize = "U";
      }
      name = name.replace(SIZE_PATTERN, "").trim();
    }

    // Extract color
    const lowerName = name.toLowerCase();
    for (const color of COLOR_KEYWORDS) {
      const colorRegex = new RegExp(`\\b${color}\\b`, "i");
      if (colorRegex.test(lowerName)) {
        detectedColor = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
        name = name.replace(colorRegex, "").trim();
        break;
      }
    }

    // Clean up extra spaces and dashes
    name = name.replace(/\s+/g, " ").replace(/\s*-\s*$/, "").replace(/^\s*-\s*/, "").trim();

    return { baseName: name, color: detectedColor, size: detectedSize };
  };

  const groupScrapedProducts = (scrapedProducts: ScrapedProduct[]): GroupedProduct[] => {
    const successProducts = scrapedProducts.filter(p => p.status === "success" && p.name);
    const productMap = new Map<string, GroupedProduct>();

    for (const product of successProducts) {
      const { baseName, color, size } = extractBaseName(product.name || "");
      const key = baseName.toLowerCase();

      if (!productMap.has(key)) {
        productMap.set(key, {
          id: crypto.randomUUID(),
          baseName,
          category: product.category || "Top",
          costPrice: product.price || 0,
          salePrice: Math.round((product.price || 0) * MARKUP_PERCENTAGE * 100) / 100,
          description: product.description || "",
          images: [...product.images],
          variants: [],
          selected: true,
          expanded: false,
        });
      }

      const grouped = productMap.get(key)!;
      
      // Add images if new
      for (const img of product.images) {
        if (!grouped.images.includes(img)) {
          grouped.images.push(img);
        }
      }

      // Add variant
      const colors = color ? [color] : (product.colors.length > 0 ? product.colors : ["Sem cor"]);
      const sizes = size ? [size] : (product.sizes.length > 0 ? product.sizes : ["U"]);

      for (const c of colors) {
        for (const s of sizes) {
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
                <Label>Filtro de Busca (opcional)</Label>
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="top, vestido, calça..."
                />
                <p className="text-xs text-muted-foreground">
                  Filtra URLs que contêm esta palavra
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
            <Button onClick={handleScrapeProducts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Buscar Detalhes ({productUrls.length})
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
