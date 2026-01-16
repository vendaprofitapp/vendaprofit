import { useState, useEffect } from "react";
import {
  Globe,
  Loader2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Package,
  AlertCircle,
  RefreshCw,
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

interface Supplier {
  id: string;
  name: string;
}

interface SupplierBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

const MARKUP_PERCENTAGE = 1.67; // 40% markup

export function SupplierBulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: SupplierBulkImportDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<"url" | "discover" | "scrape" | "review" | "importing">("url");
  const [siteUrl, setSiteUrl] = useState("https://inmoov.se");
  const [searchFilter, setSearchFilter] = useState("top");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [productUrls, setProductUrls] = useState<string[]>([]);
  const [products, setProducts] = useState<ScrapedProduct[]>([]);
  const [scrapingProgress, setScrapingProgress] = useState(0);
  const [isScraping, setIsScraping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

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
    
    // Auto-select Inmoov if exists
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

    // Scrape in batches of 3
    const batchSize = 3;
    for (let i = 0; i < scraped.length; i += batchSize) {
      const batch = scraped.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (product, batchIndex) => {
          const index = i + batchIndex;
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
                name: data.productName || extractNameFromUrl(product.url),
                price: data.price || null,
                description: data.description || null,
                images: data.images || [],
                colors: data.colors || [],
                sizes: data.sizes || [],
                category: data.category || "Top",
                selected: true,
                status: "success",
              };
              return updated;
            });
          } catch (error) {
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
        })
      );

      setScrapingProgress(Math.min(100, Math.round(((i + batchSize) / scraped.length) * 100)));
    }

    setIsScraping(false);
    setStep("review");
    toast.success("Produtos processados!");
  };

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

  const toggleProductSelection = (index: number) => {
    setProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  };

  const toggleSelectAll = (selected: boolean) => {
    setProducts((prev) =>
      prev.map((p) => (p.status === "success" ? { ...p, selected } : p))
    );
  };

  const handleImport = async () => {
    if (!user) return;

    const selectedProducts = products.filter((p) => p.selected && p.status === "success");
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
        const costPrice = product.price || 0;
        const salePrice = Math.round(costPrice * MARKUP_PERCENTAGE * 100) / 100;

        // Create main product
        const { data: newProduct, error: productError } = await supabase
          .from("products")
          .insert({
            name: product.name || "Produto",
            category: product.category || "Top",
            price: salePrice,
            cost_price: costPrice,
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

        // Create variants for each color/size combination
        if (newProduct && (product.colors.length > 0 || product.sizes.length > 0)) {
          const colors = product.colors.length > 0 ? product.colors : [null];
          const sizes = product.sizes.length > 0 ? product.sizes : ["P", "M", "G", "GG"];

          const variants = [];
          for (const color of colors) {
            for (const size of sizes) {
              variants.push({
                product_id: newProduct.id,
                color: color,
                size: size,
                stock_quantity: 0,
                image_url: product.images[0] || null,
              });
            }
          }

          if (variants.length > 0) {
            await supabase.from("product_variants").insert(variants);
          }
        }

        imported++;
      } catch (error) {
        console.error("Error importing:", error);
        errors.push(product.name || "Produto desconhecido");
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
    setScrapingProgress(0);
    setImportProgress(0);
    onOpenChange(false);
  };

  const selectedCount = products.filter((p) => p.selected && p.status === "success").length;
  const successCount = products.filter((p) => p.status === "success").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Importar do Site do Fornecedor
          </DialogTitle>
          <DialogDescription>
            {step === "url" && "Digite a URL do site e um filtro para buscar produtos"}
            {step === "discover" && `${productUrls.length} produtos encontrados`}
            {step === "scrape" && "Buscando informações dos produtos..."}
            {step === "review" && `${successCount} produtos prontos para importar`}
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
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm"
                    >
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
          {step === "review" && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCount === successCount && successCount > 0}
                    onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                  />
                  <span className="text-sm">
                    {selectedCount} de {successCount} selecionados
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep("url");
                    setProducts([]);
                  }}
                >
                  Voltar
                </Button>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {products.map((product, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border",
                        product.status === "error" && "bg-destructive/5 border-destructive/20",
                        product.selected && product.status === "success" && "bg-primary/5 border-primary/20"
                      )}
                    >
                      {product.status === "success" ? (
                        <Checkbox
                          checked={product.selected}
                          onCheckedChange={() => toggleProductSelection(idx)}
                        />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive mt-1" />
                      )}

                      {product.images[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name || ""}
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{product.name || "Sem nome"}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {product.price && (
                            <span>
                              Custo: R$ {product.price.toFixed(2)} →{" "}
                              <span className="text-foreground font-medium">
                                R$ {(product.price * MARKUP_PERCENTAGE).toFixed(2)}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.colors.slice(0, 3).map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {c}
                            </Badge>
                          ))}
                          {product.colors.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{product.colors.length - 3}
                            </Badge>
                          )}
                          {product.sizes.slice(0, 4).map((s, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                        {product.status === "error" && (
                          <p className="text-xs text-destructive mt-1">{product.error}</p>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {product.images.length} img
                      </div>
                    </div>
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

          {step === "review" && (
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
