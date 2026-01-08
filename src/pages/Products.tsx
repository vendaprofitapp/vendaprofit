import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Filter, Package, Edit, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CategoryManager, Category } from "@/components/products/CategoryManager";
import { ProductFilters, ProductFiltersState, StockStatusKey } from "@/components/products/ProductFilters";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price: number | null;
  stock_quantity: number;
  min_stock_level: number;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  supplier_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

const statusConfig: Record<
  StockStatusKey,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  available: { label: "Disponível", variant: "default" },
  low: { label: "Baixo Estoque", variant: "secondary" },
  out: { label: "Esgotado", variant: "destructive" },
};

function getStockStatusKey(stock: number, minLevel: number): StockStatusKey {
  if (stock <= 0) return "out";
  if (stock <= minLevel) return "low";
  return "available";
}

function usePageSeo() {
  useEffect(() => {
    const title = "Produtos | Venda PROFIT";
    const description = "Produtos: gerencie seu catálogo e estoque no Venda PROFIT";

    document.title = title;

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
  }, []);
}

const initialFilters: ProductFiltersState = {
  category: "all",
  status: "all",
  supplier: "all",
  color: "all",
  size: "all",
  minPrice: "",
  maxPrice: "",
  minStock: "",
  maxStock: "",
};

export default function Products() {
  usePageSeo();
  const { user } = useAuth();

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<ProductFiltersState>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    price: "",
    cost_price: "",
    stock_quantity: "",
    min_stock_level: "5",
    color: "",
    size: "",
    sku: "",
    supplier_id: "",
  });

  const fetchProducts = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, price, cost_price, stock_quantity, min_stock_level, owner_id, is_active, created_at, color, size, sku, supplier_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar produtos");
      setItems([]);
    } else {
      setItems((data as Product[]) ?? []);
    }
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

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchSuppliers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Extract unique colors and sizes from products
  const { uniqueColors, uniqueSizes } = useMemo(() => {
    const colors = new Set<string>();
    const sizes = new Set<string>();

    items.forEach((p) => {
      if (p.color) colors.add(p.color);
      if (p.size) sizes.add(p.size);
    });

    return {
      uniqueColors: Array.from(colors).sort(),
      uniqueSizes: Array.from(sizes).sort(),
    };
  }, [items]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return items.filter((p) => {
      const statusKey = getStockStatusKey(p.stock_quantity, p.min_stock_level);
      
      // Search term
      const matchesTerm = !term || 
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term));
      
      // Category
      const matchesCategory = filters.category === "all" || p.category === filters.category;
      
      // Status
      const matchesStatus = filters.status === "all" || statusKey === filters.status;
      
      // Supplier
      const matchesSupplier = filters.supplier === "all" || p.supplier_id === filters.supplier;
      
      // Color
      const matchesColor = filters.color === "all" || p.color === filters.color;
      
      // Size
      const matchesSize = filters.size === "all" || p.size === filters.size;
      
      // Price range
      const minPrice = filters.minPrice ? Number(filters.minPrice) : null;
      const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null;
      const matchesMinPrice = minPrice === null || p.price >= minPrice;
      const matchesMaxPrice = maxPrice === null || p.price <= maxPrice;
      
      // Stock range
      const minStock = filters.minStock ? Number(filters.minStock) : null;
      const maxStock = filters.maxStock ? Number(filters.maxStock) : null;
      const matchesMinStock = minStock === null || p.stock_quantity >= minStock;
      const matchesMaxStock = maxStock === null || p.stock_quantity <= maxStock;

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
        matchesMaxStock
      );
    });
  }, [items, searchTerm, filters]);

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
    return count;
  }, [filters]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: "",
      category: "",
      price: "",
      cost_price: "",
      stock_quantity: "",
      min_stock_level: "5",
      color: "",
      size: "",
      sku: "",
      supplier_id: "",
    });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price ?? 0),
      cost_price: String(product.cost_price ?? ""),
      stock_quantity: String(product.stock_quantity ?? 0),
      min_stock_level: String(product.min_stock_level ?? 5),
      color: product.color ?? "",
      size: product.size ?? "",
      sku: product.sku ?? "",
      supplier_id: product.supplier_id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;

    if (!form.name.trim() || !form.category) {
      toast.error("Preencha nome e categoria");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price) || 0,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      stock_quantity: Number(form.stock_quantity) || 0,
      min_stock_level: Number(form.min_stock_level) || 5,
      color: form.color.trim() || null,
      size: form.size.trim() || null,
      sku: form.sku.trim() || null,
      supplier_id: form.supplier_id || null,
    };

    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) {
        toast.error("Erro ao atualizar produto");
        return;
      }
      toast.success("Produto atualizado!");
    } else {
      const { error } = await supabase.from("products").insert({ ...payload, owner_id: user.id });
      if (error) {
        toast.error("Erro ao criar produto");
        return;
      }
      toast.success("Produto criado!");
    }

    setDialogOpen(false);
    resetForm();
    fetchProducts();
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${product.name}"?`)) return;

    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      toast.error("Erro ao excluir produto");
      return;
    }

    toast.success("Produto excluído!");
    fetchProducts();
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return "-";
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier?.name ?? "-";
  };

  return (
    <MainLayout>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seu catálogo de roupas fitness</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </header>

      <main>
        <section className="flex items-center gap-4 mb-6" aria-label="Busca e filtros de produtos">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              aria-label="Buscar produtos"
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
        </section>

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

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
              <DialogDescription>Cadastre e mantenha seu catálogo atualizado</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>Categoria *</Label>
                <CategoryManager
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  onCategoriesChange={setCategories}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Preço de Venda</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Preço de Custo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Estoque</Label>
                  <Input
                    type="number"
                    value={form.stock_quantity}
                    onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Estoque Mínimo</Label>
                  <Input
                    type="number"
                    value={form.min_stock_level}
                    onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Cor</Label>
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="Ex: Preto"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tamanho</Label>
                  <Input
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    placeholder="Ex: M"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Código do produto"
                />
              </div>

              <div className="grid gap-2">
                <Label>Fornecedor</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                >
                  <option value="">Sem fornecedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <section className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in" aria-label="Lista de produtos">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Cor/Tamanho</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
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
                  const statusKey = getStockStatusKey(product.stock_quantity, product.min_stock_level);
                  const status = statusConfig[statusKey];

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <span className="font-medium block">{product.name}</span>
                            {product.sku && (
                              <span className="text-xs text-muted-foreground">{product.sku}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.category}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.color || product.size
                          ? `${product.color || "-"} / ${product.size || "-"}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getSupplierName(product.supplier_id)}
                      </TableCell>
                      <TableCell className="font-medium">
                        R$ {product.price.toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell>{product.stock_quantity} un.</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(product)}
                            aria-label="Editar produto"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product)}
                            aria-label="Excluir produto"
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
        </section>
      </main>
    </MainLayout>
  );
}
