import { useState, useEffect, useMemo } from "react";
import { 
  Plus, Search, Edit, Trash2, Users, 
  ArrowRightLeft, Check, X, Clock, Upload, Package, Copy, Filter, Globe
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
  DialogTrigger,
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
import { Category } from "@/components/products/CategoryManager";
import { StockExportDialog } from "@/components/stock/StockExportDialog";

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
  color: string | null;
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
  marketing_status: string[] | null;
  suppliers?: { name: string } | null;
  product_variants?: Array<{
    id: string;
    size: string;
    stock_quantity: number;
    marketing_status?: string[] | null;
  }>;
}

interface StockRequest {
  id: string;
  product_id: string;
  requester_id: string;
  owner_id: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes: string | null;
  response_notes: string | null;
  created_at: string;
  products?: { name: string; sku: string | null };
  requester?: { full_name: string; store_name: string | null };
}

export default function StockControl() {
  const { user } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [partnerProducts, setPartnerProducts] = useState<Product[]>([]);
  const [myRequests, setMyRequests] = useState<StockRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFiltersState>({
    category: "all",
    status: "all",
    supplier: "all",
    color: "all",
    size: "all",
    minPrice: "",
    maxPrice: "",
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
      const unsubscribe = subscribeToRequests();
      return unsubscribe;
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    await Promise.all([
      fetchProducts(),
      fetchPartnerProducts(),
      fetchRequests(),
      fetchSuppliers(),
      fetchCategories()
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

  const fetchCategories = async () => {
    if (!user) return;
    // Fetch all categories globally so all users see the same list
    const { data } = await supabase
      .from("categories")
      .select("id, name, owner_id")
      .order("name");
    setCategories(data ?? []);
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

  const fetchPartnerProducts = async () => {
    if (!user) return;

    // 1) grupos/parcerias que eu participo
    const { data: memberships, error: membershipsError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (membershipsError) {
      // se falhar, não bloqueia tela toda, só zera lista
      setPartnerProducts([]);
      return;
    }

    const groupIds = (memberships || []).map((m) => m.group_id);
    if (groupIds.length === 0) {
      setPartnerProducts([]);
      return;
    }

    // 2) produtos liberados nessas parcerias
    const { data: partnerships, error: ppError } = await supabase
      .from("product_partnerships")
      .select("product_id")
      .in("group_id", groupIds);

    if (ppError) {
      setPartnerProducts([]);
      return;
    }

    const productIds = Array.from(new Set((partnerships || []).map((p) => p.product_id)));
    if (productIds.length === 0) {
      setPartnerProducts([]);
      return;
    }

    // 3) carrega dados dos produtos (exceto meus)
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_variants ( id, size, stock_quantity, marketing_status )
      `)
      .in("id", productIds)
      .neq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setPartnerProducts((data || []) as Product[]);
    }
  };
  const fetchRequests = async () => {
    const { data: myReqs } = await supabase
      .from("stock_requests")
      .select(`
        *,
        products:product_id (name, sku)
      `)
      .eq("requester_id", user?.id)
      .order("created_at", { ascending: false });
    
    setMyRequests(myReqs || []);

    const { data: incomingReqs } = await supabase
      .from("stock_requests")
      .select(`
        *,
        products:product_id (name, sku)
      `)
      .eq("owner_id", user?.id)
      .order("created_at", { ascending: false });
    
    setIncomingRequests(incomingReqs || []);
  };

  const subscribeToRequests = () => {
    const channel = supabase
      .channel("stock_requests_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_requests" },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        notes: requestNotes || null
      });

    if (error) {
      toast.error("Erro ao criar requisição");
    } else {
      toast.success("Requisição enviada!");
      setRequestDialogOpen(false);
      setSelectedProduct(null);
      setRequestQuantity("1");
      setRequestNotes("");
      fetchRequests();
    }
  };

  const handleUpdateRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from("stock_requests")
      .update({ 
        status, 
        responded_at: new Date().toISOString() 
      })
      .eq("id", requestId);

    if (error) {
      toast.error("Erro ao atualizar requisição");
    } else {
      toast.success(status === 'approved' ? "Requisição aprovada!" : "Requisição rejeitada");
      fetchRequests();
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
    return product.color_label || product.color || "-";
  };

  const getRequestStatus = (status: string) => {
    switch (status) {
      case 'pending': return { label: "Pendente", variant: "secondary" as const, icon: Clock };
      case 'approved': return { label: "Aprovado", variant: "default" as const, icon: Check };
      case 'rejected': return { label: "Rejeitado", variant: "destructive" as const, icon: X };
      default: return { label: status, variant: "secondary" as const, icon: Clock };
    }
  };

  // Extract unique colors and sizes from products
  const { uniqueColors, uniqueSizes } = useMemo(() => {
    const colors = new Set<string>();
    const sizes = new Set<string>();

    products.forEach((p) => {
      if (p.color) colors.add(p.color);
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

  const filteredProducts = useMemo(() => {
    // Normalize search term - remove extra spaces and convert to lowercase
    const term = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return products.filter((p) => {
      const stockNum = Number(p.stock_quantity) || 0;
      const minLevelNum = Number(p.min_stock_level) || 0;
      const statusKey = getStockStatusKey(stockNum, minLevelNum);
      
      // Search term - normalize and search in name, SKU, colors, and sizes
      const normalize = (str: string | null | undefined) => 
        (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const normalizedName = normalize(p.name);
      const normalizedSku = normalize(p.sku);
      const normalizedProductColor = normalize(p.color);
      const normalizedProductSize = normalize(p.size);
      
      // Get all variant colors and sizes
      const variantColors = (p.product_variants || []).map(v => normalize(v.color));
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
      const productCategories = [p.category, p.category_2, p.category_3].filter(Boolean) as string[];
      const matchesCategory = filters.category === "all" || productCategories.includes(filters.category);
      
      // Status filter
      const matchesStatus = filters.status === "all" || statusKey === filters.status;
      
      // Supplier - compare by name to handle duplicated suppliers across users
      const selectedSupplierName = filters.supplier === "all" 
        ? null 
        : suppliers.find(s => s.id === filters.supplier)?.name;
      const productSupplierName = p.suppliers?.name;
      const matchesSupplier = filters.supplier === "all" || 
        (selectedSupplierName && productSupplierName && 
         productSupplierName.toLowerCase() === selectedSupplierName.toLowerCase());
      
      // Color - check product color and variants (case-insensitive)
      const productColors = [p.color, ...(p.product_variants || []).map(v => v.color)].filter(Boolean);
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
        matchesCategory &&
        matchesStatus &&
        matchesSupplier &&
        matchesColor &&
        matchesSize &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesMinStock &&
        matchesMaxStock &&
        matchesMarketingStatus
      );
    });
  }, [products, searchTerm, filters, suppliers]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category !== "all") count++;
    if (filters.status !== "all") count++;
    if (filters.supplier !== "all") count++;
    if (filters.color !== "all") count++;
    if (filters.size !== "all") count++;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    if (filters.minStock) count++;
    if (filters.maxStock) count++;
    if (filters.marketingStatus !== "all") count++;
    return count;
  }, [filters]);

  const filteredPartnerProducts = partnerProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        categories={categories}
        suppliers={suppliers}
        colors={uniqueColors}
        sizes={uniqueSizes}
      />

      <Tabs defaultValue="my-stock" className="space-y-6">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="my-stock" className="text-xs sm:text-sm">Meu Estoque</TabsTrigger>
          <TabsTrigger value="partner-stock" className="text-xs sm:text-sm">Parceiros</TabsTrigger>
          <TabsTrigger value="my-requests" className="text-xs sm:text-sm">Requisições</TabsTrigger>
          <TabsTrigger value="incoming-requests" className="text-xs sm:text-sm">
            Recebidas
            {incomingRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-1 sm:ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {incomingRequests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
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
                  filteredProducts.map((product) => {
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
        </TabsContent>

        {/* Partner Stock Tab */}
        <TabsContent value="partner-stock">
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
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredPartnerProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum produto de parceiro disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPartnerProducts.map((product) => {
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
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(product);
                              setRequestDialogOpen(true);
                            }}
                          >
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

        {/* My Requests Tab */}
        <TabsContent value="my-requests">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead className="hidden sm:table-cell">Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma requisição feita
                    </TableCell>
                  </TableRow>
                ) : (
                  myRequests.map((request) => {
                    const status = getRequestStatus(request.status);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          <span className="truncate max-w-[120px] sm:max-w-none block">
                            {request.products?.name || "Produto removido"}
                          </span>
                        </TableCell>
                        <TableCell>{request.quantity}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {new Date(request.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">{status.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                          {request.notes || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Incoming Requests Tab */}
        <TabsContent value="incoming-requests">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead className="hidden sm:table-cell">Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Notas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomingRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma requisição recebida
                    </TableCell>
                  </TableRow>
                ) : (
                  incomingRequests.map((request) => {
                    const status = getRequestStatus(request.status);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          <span className="truncate max-w-[120px] sm:max-w-none block">
                            {request.products?.name || "Produto removido"}
                          </span>
                        </TableCell>
                        <TableCell>{request.quantity}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {new Date(request.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">{status.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                          {request.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleUpdateRequest(request.id, 'approved')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleUpdateRequest(request.id, 'rejected')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
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
