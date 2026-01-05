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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type StockStatusKey = "available" | "low" | "out";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_quantity: number;
  min_stock_level: number;
  owner_id: string;
  is_active: boolean;
  created_at: string;
}

const categories = [
  "Calças",
  "Tops",
  "Shorts",
  "Conjuntos",
  "Bodies",
  "Regatas",
  "Bermudas",
  "Acessórios",
];

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
    const title = "Produtos | FitStock";
    const description = "Produtos: gerencie seu catálogo e estoque no FitStock.";

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

export default function Products() {
  usePageSeo();
  const { user } = useAuth();

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StockStatusKey | "all">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    price: "",
    stock_quantity: "",
    min_stock_level: "5",
  });

  const fetchProducts = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, category, price, stock_quantity, min_stock_level, owner_id, is_active, created_at",
      )
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

  useEffect(() => {
    if (user) fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return items.filter((p) => {
      const statusKey = getStockStatusKey(p.stock_quantity, p.min_stock_level);
      const matchesTerm = !term || p.name.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || statusKey === statusFilter;
      return matchesTerm && matchesCategory && matchesStatus;
    });
  }, [items, searchTerm, categoryFilter, statusFilter]);

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", category: "", price: "", stock_quantity: "", min_stock_level: "5" });
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
      stock_quantity: String(product.stock_quantity ?? 0),
      min_stock_level: String(product.min_stock_level ?? 5),
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
      stock_quantity: Number(form.stock_quantity) || 0,
      min_stock_level: Number(form.min_stock_level) || 5,
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
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              aria-label="Buscar produtos"
            />
          </div>

          <Button variant="outline" onClick={() => setFiltersOpen(true)}>
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </section>

        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filtros</DialogTitle>
              <DialogDescription>Refine a lista por categoria e status de estoque</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StockStatusKey | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="low">Baixo estoque</SelectItem>
                    <SelectItem value="out">Esgotado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
              >
                Limpar
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Aplicar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
              <DialogDescription>Cadastre e mantenha seu catálogo atualizado</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Preço</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Estoque</Label>
                  <Input
                    type="number"
                    value={form.stock_quantity}
                    onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Estoque mínimo</Label>
                <Input
                  type="number"
                  value={form.min_stock_level}
                  onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
                  placeholder="5"
                />
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
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.category}</TableCell>
                      <TableCell className="font-medium">R$ {product.price.toFixed(2).replace(".", ",")}</TableCell>
                      <TableCell>{product.stock_quantity} un.</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(product)} aria-label="Editar produto">
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

