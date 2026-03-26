import { useState, useEffect, useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLoadMore } from "@/hooks/useLoadMore";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { 
  Plus, Search, Edit, Trash2, 
  ArrowRightLeft, Upload, Package, Copy, Filter, Globe
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { StockImportDialog } from "@/components/stock/StockImportDialog";
import { ProductFormDialog } from "@/components/stock/ProductFormDialog";
import { SupplierBulkImportDialog } from "@/components/stock/SupplierBulkImportDialog";
import { VoiceStockDialog } from "@/components/stock/VoiceStockDialog";
import { VoiceCommandButton } from "@/components/voice/VoiceCommandButton";
import { VoiceCommandFeedback } from "@/components/voice/VoiceCommandFeedback";
import { useStockVoiceCommand, StockVoiceCommand } from "@/hooks/useStockVoiceCommand";
import { ProductFilters, ProductFiltersState, StockStatusKey } from "@/components/products/ProductFilters";
import { useFixedCategories } from "@/components/products/FixedCategorySelector";
import { StockExportDialog } from "@/components/stock/StockExportDialog";
import { B2BStockTab } from "@/components/stock/B2BStockTab";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  category_2: string | null;
  category_3: string | null;
  price: number;
  cost_price: number | null;
  sku: string | null;
  
  // OBS: tamanho/cor principais ficam nas variantes
  size: string | null;
  color_label: string | null;
  stock_quantity: number;
  min_stock_level: number;
  group_id: string | null;
  owner_id: string;
  is_active: boolean;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  supplier_id: string | null;
  video_url: string | null;
  model: string | null;
  custom_detail: string | null;
  marketing_status: string[] | null;
  main_category: string | null;
  subcategory: string | null;
  is_new_release: boolean;
  suppliers?: { name: string } | null;
  product_variants?: Array<{
    id: string;
    size: string;
    stock_quantity: number;
    marketing_status?: string[] | null;
  }>;
}


export default function StockControl() {
  const { user } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [directPartnerProducts, setDirectPartnerProducts] = useState<Product[]>([]);
  const [groupPartnerProducts, setGroupPartnerProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useFormPersistence("stock_searchTerm", "");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Use fixed categories hook
  const { mainCategories, subcategories } = useFixedCategories();
  
  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useFormPersistence<ProductFiltersState>("stock_filters", {
    mainCategory: "all",
    subcategory: "all",
    isNewRelease: "all",
    status: "all",
    supplier: "all",
    color: "all",
    size: "all",
    minPrice: "",
    maxPrice: "",
    minCost: "",
    maxCost: "",
    minStock: "",
    maxStock: "",
    marketingStatus: "all",
  });
  
  // Product form state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [supplierImportDialogOpen, setSupplierImportDialogOpen] = useState(false);

  // Request form state
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [requestNotes, setRequestNotes] = useState("");

  // Voice stock state
  const [voiceStockDialogOpen, setVoiceStockDialogOpen] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState<StockVoiceCommand | null>(null);
  const [initialProductName, setInitialProductName] = useState<string>("");
  
  // Duplicate product state
  const [duplicatingProduct, setDuplicatingProduct] = useState<Product | null>(null);

  // Voice command hook
  const {
    isListening,
    isProcessing: isVoiceProcessing,
    transcript,
    isSupported,
    startListening,
    stopListening,
  } = useStockVoiceCommand({
    onCommand: (command) => {
      setVoiceCommand(command);
      setVoiceStockDialogOpen(true);
    },
    onError: (error) => toast.error(error),
    userId: user?.id,
  });

  const handleVoiceClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleCreateNewFromVoice = (productName: string) => {
    setInitialProductName(productName);
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    await Promise.all([
      fetchProducts(),
      fetchDirectPartnerProducts(),
      fetchGroupPartnerProducts(),
      fetchSuppliers()
    ]);
    
    setLoading(false);
  };

  const fetchSuppliers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("name");
    setSuppliers(data ?? []);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_variants ( id, size, stock_quantity, marketing_status ),
        suppliers ( name )
      `)
      .eq("owner_id", user?.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar produtos");
    } else {
      setProducts((data || []) as Product[]);
    }
  };

  const fetchPartnerProductsByType = async (isDirect: boolean) => {
    if (!user) return [];

    // 1) get groups with is_direct flag
    const { data: memberships, error: membershipsError } = await supabase
      .from("group_members")
      .select("group_id, groups!inner(id, is_direct)")
      .eq("user_id", user.id);

    if (membershipsError || !memberships) return [];

    const groupIds = memberships
      .filter((m: any) => m.groups?.is_direct === isDirect)
      .map((m) => m.group_id);

    if (groupIds.length === 0) return [];

    // 2) products shared in those groups
    const { data: partnerships } = await supabase
      .from("product_partnerships")
      .select("product_id")
      .in("group_id", groupIds);

    const productIds = Array.from(new Set((partnerships || []).map((p) => p.product_id)));
    if (productIds.length === 0) return [];

    // 3) load products (excluding my own)
    const { data } = await supabase
      .from("products")
      .select(`*, product_variants ( id, size, stock_quantity, marketing_status )`)
      .in("id", productIds)
      .neq("owner_id", user.id)
      .order("created_at", { ascending: false });

    return (data || []) as Product[];
  };

  const fetchDirectPartnerProducts = async () => {
    const products = await fetchPartnerProductsByType(true);
    setDirectPartnerProducts(products);
  };

  const fetchGroupPartnerProducts = async () => {
    const products = await fetchPartnerProductsByType(false);
    setGroupPartnerProducts(products);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      toast.error("Erro ao excluir produto");
    } else {
      toast.success("Produto excluído!");
      fetchProducts();
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setDuplicatingProduct(null);
    setProductDialogOpen(true);
  };

  const handleDuplicateProduct = (product: Product) => {
    // Create a copy of the product for duplication (without id)
    setDuplicatingProduct(product);
    setEditingProduct(null);
    setInitialProductName("");
    setProductDialogOpen(true);
  };

  const handleRequestProduct = async () => {
    if (!user || !selectedProduct) return;

    const { error } = await supabase
      .from("stock_requests")
      .insert({
        product_id: selectedProduct.id,
        requester_id: user.id,
        owner_id: selectedProduct.owner_id,
        quantity: parseInt(requestQuantity) || 1,
        notes: requestNotes || null,
        product_name: selectedProduct.name,
        product_price: selectedProduct.price,
      });

    if (error) {
      toast.error("Erro ao criar requisição");
    } else {
      toast.success("Requisição enviada!");
      setRequestDialogOpen(false);
      setSelectedProduct(null);
      setRequestQuantity("1");
      setRequestNotes("");
    }
  };


  const getStockStatus = (quantity: number, minLevel: number) => {
    if (quantity === 0) return { label: "Esgotado", variant: "destructive" as const };
    if (quantity <= minLevel) return { label: "Baixo", variant: "secondary" as const };
    return { label: "OK", variant: "default" as const };
  };

  const getProductSizesLabel = (product: Product) => {
    const sizes = new Set(
      (product.product_variants || [])
        .map((v) => (v.size || "").trim())
        .filter(Boolean)
    );

    if (sizes.size > 0) return Array.from(sizes).join(", ");
    return product.size || "-";
  };

  const getProductColorsLabel = (product: Product) => {
    // Color is now at the product level (color_label)
    return product.color_label || "-";
  };


  // Extract unique colors and sizes from products
  const { uniqueColors, uniqueSizes } = useMemo(() => {
    const colors = new Set<string>();
    const sizes = new Set<string>();

    products.forEach((p) => {
      if (p.color_label) colors.add(p.color_label);
      if (p.size) sizes.add(p.size);
      (p.product_variants || []).forEach((v) => {
        if (v.size) sizes.add(v.size);
      });
    });

    return {
      uniqueColors: Array.from(colors).sort(),
      uniqueSizes: Array.from(sizes).sort(),
    };
  }, [products]);

  const getStockStatusKey = (stock: number, minLevel: number): StockStatusKey => {
    // Ensure we're working with numbers
    const stockNum = Number(stock) || 0;
    const minLevelNum = Number(minLevel) || 0;
    
    if (stockNum <= 0) return "out";
    if (stockNum <= minLevelNum) return "low";
    return "available";
  };

  const debouncedSearch = useDebouncedValue(searchTerm);

  const filteredProducts = useMemo(() => {
    // Normalize search term - remove extra spaces and convert to lowercase
    const term = debouncedSearch.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return products.filter((p) => {
      const stockNum = Number(p.stock_quantity) || 0;
      const minLevelNum = Number(p.min_stock_level) || 0;
      const statusKey = getStockStatusKey(stockNum, minLevelNum);
      
      // Search term - normalize and search in name, SKU, colors, and sizes
      const normalize = (str: string | null | undefined) => 
        (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const normalizedName = normalize(p.name);
      const normalizedSku = normalize(p.sku);
      const normalizedProductColor = normalize(p.color_label);
      const normalizedProductSize = normalize(p.size);
      
      // Get all variant colors and sizes
      const variantColors: string[] = []; // Color is now at product level only
      const variantSizes = (p.product_variants || []).map(v => normalize(v.size));
      
      // Search across name, SKU, colors, and sizes
      const matchesTerm = !term || 
        normalizedName.includes(term) ||
        normalizedSku.includes(term) ||
        normalizedProductColor.includes(term) ||
        normalizedProductSize.includes(term) ||
        variantColors.some(c => c.includes(term)) ||
        variantSizes.some(s => s.includes(term));
      
      // Category - check all 3 category fields
      const matchesMainCategory = filters.mainCategory === "all" || p.main_category === filters.mainCategory;
      const matchesSubcategory = filters.subcategory === "all" || p.subcategory === filters.subcategory;
      const matchesNewRelease = filters.isNewRelease === "all" || 
        (filters.isNewRelease === "yes" ? p.is_new_release === true : p.is_new_release !== true);
      
      // Status filter - "available" means any product with stock > 0 (includes low stock)
      const matchesStatus = filters.status === "all" || 
        (filters.status === "available" ? stockNum > 0 : statusKey === filters.status);
      
      // Supplier - compare by name to handle duplicated suppliers across users
      const selectedSupplierName = filters.supplier === "all" 
        ? null 
        : suppliers.find(s => s.id === filters.supplier)?.name;
      const productSupplierName = p.suppliers?.name;
      const matchesSupplier = filters.supplier === "all" || 
        (selectedSupplierName && productSupplierName && 
         productSupplierName.toLowerCase() === selectedSupplierName.toLowerCase());
      
      // Color - check product color and variants (case-insensitive)
      const productColors = [p.color_label].filter(Boolean);
      const normalizedFilterColor = normalize(filters.color);
      const matchesColor = filters.color === "all" || 
        productColors.some(c => normalize(c) === normalizedFilterColor);
      
      // Size - check product size and variants (case-insensitive)
      const productSizes = [p.size, ...(p.product_variants || []).map(v => v.size)].filter(Boolean);
      const normalizedFilterSize = normalize(filters.size);
      const matchesSize = filters.size === "all" || 
        productSizes.some(s => normalize(s) === normalizedFilterSize);
      
      // Price range
      const minPrice = filters.minPrice ? Number(filters.minPrice) : null;
      const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null;
      const matchesMinPrice = minPrice === null || p.price >= minPrice;
      const matchesMaxPrice = maxPrice === null || p.price <= maxPrice;
      
      // Cost price range
      const minCost = filters.minCost ? Number(filters.minCost) : null;
      const maxCost = filters.maxCost ? Number(filters.maxCost) : null;
      const costPrice = p.cost_price || 0;
      const matchesMinCost = minCost === null || costPrice >= minCost;
      const matchesMaxCost = maxCost === null || costPrice <= maxCost;
      
      // Stock range
      const minStock = filters.minStock ? Number(filters.minStock) : null;
      const maxStock = filters.maxStock ? Number(filters.maxStock) : null;
      const matchesMinStock = minStock === null || stockNum >= minStock;
      const matchesMaxStock = maxStock === null || stockNum <= maxStock;

      // Marketing status - check product and variants (now arrays)
      const allMarketingStatuses: string[] = [];
      if (p.marketing_status) allMarketingStatuses.push(...p.marketing_status);
      (p.product_variants || []).forEach(v => {
        if (v.marketing_status) allMarketingStatuses.push(...v.marketing_status);
      });
      const matchesMarketingStatus = filters.marketingStatus === "all" || 
        allMarketingStatuses.includes(filters.marketingStatus);

      return (
        matchesTerm &&
        matchesMainCategory &&
        matchesSubcategory &&
        matchesNewRelease &&
        matchesStatus &&
        matchesSupplier &&
        matchesColor &&
        matchesSize &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesMinCost &&
        matchesMaxCost &&
        matchesMinStock &&
        matchesMaxStock &&
        matchesMarketingStatus
      );
    });
  }, [products, debouncedSearch, filters, suppliers]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.mainCategory !== "all") count++;
    if (filters.subcategory !== "all") count++;
    if (filters.isNewRelease !== "all") count++;
    if (filters.status !== "all") count++;
    if (filters.supplier !== "all") count++;
    if (filters.color !== "all") count++;
    if (filters.size !== "all") count++;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    if (filters.minCost) count++;
    if (filters.maxCost) count++;
    if (filters.minStock) count++;
    if (filters.maxStock) count++;
    if (filters.marketingStatus !== "all") count++;
    return count;
  }, [filters]);

  const filteredDirectPartnerProducts = directPartnerProducts.filter(p => 
    p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const filteredGroupPartnerProducts = groupPartnerProducts.filter(p => 
    p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  // Pagination
  const { visibleItems: visibleProducts, hasMore: hasMoreProducts, loadMore: loadMoreProducts, totalCount: totalProducts } = useLoadMore(filteredProducts);
  const { visibleItems: visibleDirectPartner, hasMore: hasMoreDirect, loadMore: loadMoreDirect, totalCount: totalDirect } = useLoadMore(filteredDirectPartnerProducts);
  const { visibleItems: visibleGroupPartner, hasMore: hasMoreGroup, loadMore: loadMoreGroup, totalCount: totalGroup } = useLoadMore(filteredGroupPartnerProducts);

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
          <p className="text-muted-foreground text-sm">Gerencie seu estoque e requisições de parceiros</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StockExportDialog 
            products={filteredProducts} 
            suppliers={suppliers} 
            activeFiltersCount={activeFiltersCount} 
          />
          
          <VoiceCommandButton
            isListening={isListening}
            isSupported={isSupported}
            onClick={handleVoiceClick}
            size="sm"
            showLabel
            className="gap-2"
          />
          
          <Button variant="outline" size="sm" onClick={() => setSupplierImportDialogOpen(true)}>
            <Globe className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Importar do Site</span>
            <span className="sm:hidden">Site</span>
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          
          <Button size="sm" onClick={() => {
            setInitialProductName("");
            setEditingProduct(null);
            setProductDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Novo Produto</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Voice Feedback */}
      <VoiceCommandFeedback isListening={isListening} transcript={transcript} />

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setFiltersOpen(true)} className="relative">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      <ProductFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onFiltersChange={setFilters}
        mainCategories={mainCategories}
        subcategories={subcategories}
        suppliers={suppliers}
        colors={uniqueColors}
        sizes={uniqueSizes}
      />

      <Tabs defaultValue="my-stock" className="space-y-6">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="my-stock" className="text-xs sm:text-sm">Próprio</TabsTrigger>
          <TabsTrigger value="direct-stock" className="text-xs sm:text-sm">Sociedade</TabsTrigger>
          <TabsTrigger value="group-stock" className="text-xs sm:text-sm">Parcerias</TabsTrigger>
          <TabsTrigger value="b2b-stock" className="text-xs sm:text-sm">B2B</TabsTrigger>
        </TabsList>

        {/* My Stock Tab */}
        <TabsContent value="my-stock">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden sm:table-cell">Tamanho</TableHead>
                  <TableHead className="hidden sm:table-cell">Cor</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleProducts.map((product) => {
                    const status = getStockStatus(product.stock_quantity, product.min_stock_level);
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="font-medium block break-words">{product.name}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{product.category}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {getProductSizesLabel(product)}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {getProductColorsLabel(product)}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </TableCell>
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDuplicateProduct(product)}
                              title="Duplicar produto"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditProduct(product)}
                              title="Editar produto"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteProduct(product.id)}
                              title="Excluir produto"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <LoadMoreButton hasMore={hasMoreProducts} loadMore={loadMoreProducts} visibleCount={visibleProducts.length} totalCount={totalProducts} />
        </TabsContent>

        {/* Sociedade Stock Tab */}
        <TabsContent value="direct-stock">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden sm:table-cell">Tamanho</TableHead>
                  <TableHead className="hidden sm:table-cell">Cor</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : filteredDirectPartnerProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto de sociedade disponível</TableCell>
                  </TableRow>
                ) : (
                  visibleDirectPartner.map((product) => {
                    const status = getStockStatus(product.stock_quantity, product.min_stock_level);
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1"><span className="font-medium block break-words">{product.name}</span></div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{product.category}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{getProductSizesLabel(product)}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{getProductColorsLabel(product)}</TableCell>
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedProduct(product); setRequestDialogOpen(true); }}>
                            <ArrowRightLeft className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Requisitar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Parcerias Stock Tab */}
        <TabsContent value="group-stock">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden sm:table-cell">Tamanho</TableHead>
                  <TableHead className="hidden sm:table-cell">Cor</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : filteredGroupPartnerProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto de parceria disponível</TableCell>
                  </TableRow>
                ) : (
                  filteredGroupPartnerProducts.map((product) => {
                    const status = getStockStatus(product.stock_quantity, product.min_stock_level);
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1"><span className="font-medium block break-words">{product.name}</span></div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{product.category}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{getProductSizesLabel(product)}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{getProductColorsLabel(product)}</TableCell>
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedProduct(product); setRequestDialogOpen(true); }}>
                            <ArrowRightLeft className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Requisitar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* B2B Stock Tab */}
        <TabsContent value="b2b-stock">
          {user && <B2BStockTab userId={user.id} searchTerm={searchTerm} filters={filters} suppliers={suppliers} onEditClone={async (cloneId) => {
            const { data } = await supabase
              .from("products")
              .select("*, product_variants(id, size, stock_quantity, marketing_status), suppliers(name)")
              .eq("id", cloneId)
              .single();
            if (data) {
              setEditingProduct(data as Product);
              setDuplicatingProduct(null);
              setProductDialogOpen(true);
            } else {
              toast.error("Erro ao carregar clone para edição");
            }
          }} />}
        </TabsContent>
      </Tabs>

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            setDuplicatingProduct(null);
            setInitialProductName("");
          }
        }}
        editingProduct={editingProduct}
        duplicatingProduct={duplicatingProduct}
        onSuccess={fetchProducts}
        initialProductName={initialProductName}
      />

      {/* Voice Stock Dialog */}
      <VoiceStockDialog
        open={voiceStockDialogOpen}
        onOpenChange={setVoiceStockDialogOpen}
        command={voiceCommand}
        userId={user?.id || ""}
        onSuccess={fetchProducts}
        onCreateNewProduct={handleCreateNewFromVoice}
      />

      {/* Request Product Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Requisitar Produto</DialogTitle>
            <DialogDescription>
              Solicite estoque do parceiro: {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={requestQuantity}
                onChange={(e) => setRequestQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Alguma observação para o parceiro..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRequestProduct}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <StockImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={fetchProducts}
      />

      {/* Supplier Bulk Import Dialog */}
      <SupplierBulkImportDialog
        open={supplierImportDialogOpen}
        onOpenChange={setSupplierImportDialogOpen}
        onImportComplete={fetchProducts}
      />
    </MainLayout>
  );
}
