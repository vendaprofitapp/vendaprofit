import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Radar, Send, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewProductsScanner } from "./NewProductsScanner";
import { PropagateProductsDialog } from "./PropagateProductsDialog";
import { ProductFormDialog } from "@/components/stock/ProductFormDialog";
import { ProductFilters, ProductFiltersState, type MarketingStatusFilter } from "@/components/products/ProductFilters";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price: number | null;
  model: string | null;
  image_url: string | null;
  stock_quantity: number;
  color: string | null;
  color_label: string | null;
  variantCount: number;
  main_category: string | null;
  subcategory: string | null;
  is_new_release: boolean | null;
  size: string | null;
  marketing_status: string | null;
}

interface SupplierCatalogTabProps {
  supplierId: string;
  supplierName: string;
  supplierWebsite: string | null;
  supplierB2bUrl: string | null;
  adminId: string;
}

const defaultFilters: ProductFiltersState = {
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
};

export function SupplierCatalogTab({
  supplierId,
  supplierName,
  supplierWebsite,
  supplierB2bUrl,
  adminId,
}: SupplierCatalogTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showPropagate, setShowPropagate] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ProductFiltersState>(defaultFilters);
  const [mainCategories, setMainCategories] = useState<{ id: string; name: string }[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string; main_category_id: string }[]>([]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, price, cost_price, model, image_url, stock_quantity, color, color_label, main_category, subcategory, is_new_release, size, marketing_status, product_variants(id)")
      .eq("owner_id", adminId)
      .eq("supplier_id", supplierId)
      .order("name");

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const productsWithVariants: Product[] = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      cost_price: p.cost_price,
      model: p.model,
      image_url: p.image_url,
      stock_quantity: p.stock_quantity,
      color: p.color,
      color_label: p.color_label,
      variantCount: p.product_variants?.length || 0,
      main_category: p.main_category,
      subcategory: p.subcategory,
      is_new_release: p.is_new_release,
      size: p.size,
      marketing_status: p.marketing_status,
    }));

    setProducts(productsWithVariants);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const [{ data: mc }, { data: sc }] = await Promise.all([
      supabase.from("main_categories").select("id, name").eq("is_active", true).order("display_order"),
      supabase.from("subcategories").select("id, name, main_category_id").order("name"),
    ]);
    setMainCategories(mc || []);
    setSubcategories(sc || []);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [supplierId]);

  // Extract unique colors and sizes from loaded products
  const uniqueColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.color_label) set.add(p.color_label);
      else if (p.color) set.add(p.color);
    });
    return Array.from(set).sort();
  }, [products]);

  const uniqueSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.size) set.add(p.size);
    });
    return Array.from(set).sort();
  }, [products]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.mainCategory !== "all") count++;
    if (filters.subcategory !== "all") count++;
    if (filters.isNewRelease !== "all") count++;
    if (filters.status !== "all") count++;
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

  const handleProductClick = async (productId: string) => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (data) {
      setEditingProduct(data);
      setShowEditDialog(true);
    }
  };

  // Apply search + filters
  const filtered = useMemo(() => {
    return products.filter((p) => {
      // Text search
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;

      // Main category
      if (filters.mainCategory !== "all" && p.main_category !== filters.mainCategory) return false;

      // Subcategory
      if (filters.subcategory !== "all" && p.subcategory !== filters.subcategory) return false;

      // New release
      if (filters.isNewRelease === "yes" && !p.is_new_release) return false;
      if (filters.isNewRelease === "no" && p.is_new_release) return false;

      // Stock status
      if (filters.status === "out" && p.stock_quantity > 0) return false;
      if (filters.status === "low" && (p.stock_quantity <= 0 || p.stock_quantity > 5)) return false;
      if (filters.status === "available" && p.stock_quantity <= 0) return false;

      // Color
      if (filters.color !== "all") {
        const prodColor = p.color_label || p.color || "";
        if (prodColor !== filters.color) return false;
      }

      // Size
      if (filters.size !== "all" && p.size !== filters.size) return false;

      // Price range
      if (filters.minPrice && p.price < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice && p.price > parseFloat(filters.maxPrice)) return false;

      // Cost range
      if (filters.minCost && (!p.cost_price || p.cost_price < parseFloat(filters.minCost))) return false;
      if (filters.maxCost && (!p.cost_price || p.cost_price > parseFloat(filters.maxCost))) return false;

      // Stock range
      if (filters.minStock && p.stock_quantity < parseInt(filters.minStock)) return false;
      if (filters.maxStock && p.stock_quantity > parseInt(filters.maxStock)) return false;

      // Marketing status
      if (filters.marketingStatus !== "all" && p.marketing_status !== filters.marketingStatus) return false;

      return true;
    });
  }, [products, search, filters]);

  const siteUrl = supplierWebsite || supplierB2bUrl;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{supplierName}</CardTitle>
            <Badge variant="secondary">{products.length} peças</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {siteUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScanner(true)}
              >
                <Radar className="h-4 w-4 mr-1" />
                Buscar Novidades
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPropagate(true)}
            >
              <Send className="h-4 w-4 mr-1" />
              Propagar para Usuários
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1 sm:max-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(true)}
            className="relative"
          >
            <SlidersHorizontal className="h-4 w-4 mr-1" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {filtered.length} de {products.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Img</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Variantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => handleProductClick(p.id)}
                  >
                    <TableCell>
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.color_label || p.color || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.model || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.category}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {p.cost_price ? `R$ ${p.cost_price.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {p.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{p.variantCount}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <ProductFilters
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onFiltersChange={setFilters}
        mainCategories={mainCategories}
        subcategories={subcategories}
        suppliers={[]}
        colors={uniqueColors}
        sizes={uniqueSizes}
      />

      {showScanner && siteUrl && (
        <NewProductsScanner
          open={showScanner}
          onClose={() => {
            setShowScanner(false);
            fetchProducts();
          }}
          supplierName={supplierName}
          supplierId={supplierId}
          siteUrl={siteUrl}
          adminId={adminId}
          existingProductNames={products.map((p) => p.name.toLowerCase())}
        />
      )}

      {showPropagate && (
        <PropagateProductsDialog
          open={showPropagate}
          onClose={() => setShowPropagate(false)}
          supplierName={supplierName}
          supplierId={supplierId}
          adminId={adminId}
        />
      )}

      {showEditDialog && editingProduct && (
        <ProductFormDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditingProduct(null);
          }}
          editingProduct={editingProduct}
          onSuccess={() => {
            setShowEditDialog(false);
            setEditingProduct(null);
            fetchProducts();
          }}
        />
      )}
    </Card>
  );
}
