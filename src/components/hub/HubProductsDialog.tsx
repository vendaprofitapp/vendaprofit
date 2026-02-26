import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFixedCategories } from "@/components/products/FixedCategorySelector";
import { toast } from "sonner";
import { Search, Filter, CheckSquare, Layers, Flame, Clock, Rocket, Lock } from "lucide-react";

interface Props {
  open: boolean;
  connectionId: string | null;
  onClose: () => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number | null;
  stock_quantity: number;
  is_active: boolean;
  isShared: boolean;
  color_label: string | null;
  model: string | null;
  supplier_id: string | null;
  main_category: string | null;
  subcategory: string | null;
  is_new_release: boolean;
  marketing_status: string[] | null;
  product_variants?: Array<{ size: string; stock_quantity: number; marketing_status?: string[] | null }>;
  suppliers?: { name: string } | null;
}

interface FiltersState {
  search: string;
  mainCategory: string;
  subcategory: string;
  isNewRelease: string;
  status: string;
  supplier: string;
  color: string;
  size: string;
  minPrice: string;
  maxPrice: string;
  minCost: string;
  maxCost: string;
  minStock: string;
  maxStock: string;
  marketingStatus: string;
}

const defaultFilters: FiltersState = {
  search: "",
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

export function HubProductsDialog({ open, connectionId, onClose }: Props) {
  const { user } = useAuth();
  const { mainCategories, subcategories } = useFixedCategories();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoShareAll, setAutoShareAll] = useState(false);

  useEffect(() => {
    if (!open || !connectionId || !user) return;
    loadProducts();
    loadSuppliers();
    loadConnectionMeta();
  }, [open, connectionId, user]);

  const loadConnectionMeta = async () => {
    const { data } = await supabase
      .from("hub_connections")
      .select("auto_share_all")
      .eq("id", connectionId!)
      .single();
    if (data) setAutoShareAll((data as any).auto_share_all ?? false);
  };

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("owner_id", user!.id)
      .order("name");
    setSuppliers(data ?? []);
  };

  const loadProducts = async () => {
    setLoading(true);
    const [prodRes, sharedRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, price, cost_price, stock_quantity, is_active, color_label, model, supplier_id, main_category, subcategory, is_new_release, marketing_status, product_variants(size, stock_quantity, marketing_status), suppliers(name)")
        .eq("owner_id", user!.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("hub_shared_products")
        .select("product_id")
        .eq("connection_id", connectionId!)
        .eq("is_active", true),
    ]);

    if (prodRes.error) { toast.error("Erro ao carregar produtos"); setLoading(false); return; }

    const sharedIds = new Set((sharedRes.data ?? []).map((s) => s.product_id));
    setProducts(
      (prodRes.data ?? []).map((p) => ({ ...p, isShared: sharedIds.has(p.id) })) as Product[]
    );
    setLoading(false);
  };

  const toggle = async (product: Product) => {
    if (product.isShared) {
      const { error } = await supabase
        .from("hub_shared_products")
        .delete()
        .eq("connection_id", connectionId!)
        .eq("product_id", product.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase
        .from("hub_shared_products")
        .upsert({ connection_id: connectionId!, product_id: product.id, is_active: true });
      if (error) { toast.error(error.message); return; }
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isShared: !p.isShared } : p))
    );
  };

  // Derived options for filter dropdowns
  const availableColors = useMemo(() => {
    const s = new Set<string>();
    products.forEach(p => { if (p.color_label) s.add(p.color_label); });
    return Array.from(s).sort();
  }, [products]);

  const availableSizes = useMemo(() => {
    const s = new Set<string>();
    products.forEach(p => { (p.product_variants ?? []).forEach(v => { if (v.size) s.add(v.size); }); });
    return Array.from(s).sort();
  }, [products]);

  const selectedMainCat = mainCategories.find(c => c.name === filters.mainCategory);
  const availableSubcategories = selectedMainCat
    ? subcategories.filter(s => s.main_category_id === selectedMainCat.id)
    : [];

  // Apply all filters
  const filtered = useMemo(() => {
    return products.filter(p => {
      const term = filters.search.toLowerCase();
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (filters.mainCategory !== "all" && p.main_category !== filters.mainCategory) return false;
      if (filters.subcategory !== "all" && p.subcategory !== filters.subcategory) return false;
      if (filters.isNewRelease === "yes" && !p.is_new_release) return false;
      if (filters.isNewRelease === "no" && p.is_new_release) return false;
      if (filters.supplier !== "all" && p.supplier_id !== filters.supplier) return false;
      if (filters.color !== "all" && p.color_label !== filters.color) return false;
      if (filters.size !== "all") {
        const hasSz = (p.product_variants ?? []).some(v => v.size === filters.size);
        if (!hasSz) return false;
      }
      if (filters.status === "available" && p.stock_quantity <= 0) return false;
      if (filters.status === "low" && !(p.stock_quantity > 0 && p.stock_quantity <= 3)) return false;
      if (filters.status === "out" && p.stock_quantity > 0) return false;
      if (filters.minPrice !== "" && p.price < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice !== "" && p.price > parseFloat(filters.maxPrice)) return false;
      if (filters.minCost !== "" && (p.cost_price ?? 0) < parseFloat(filters.minCost)) return false;
      if (filters.maxCost !== "" && (p.cost_price ?? 0) > parseFloat(filters.maxCost)) return false;
      if (filters.minStock !== "" && p.stock_quantity < parseFloat(filters.minStock)) return false;
      if (filters.maxStock !== "" && p.stock_quantity > parseFloat(filters.maxStock)) return false;
      if (filters.marketingStatus !== "all") {
        const ms = p.marketing_status ?? [];
        const varMs = (p.product_variants ?? []).flatMap(v => v.marketing_status ?? []);
        if (!ms.includes(filters.marketingStatus) && !varMs.includes(filters.marketingStatus)) return false;
      }
      return true;
    });
  }, [products, filters]);

  const hasActiveFilters = Object.entries(filters).some(([k, v]) =>
    k !== "search" && (typeof v === "string" ? v !== "all" && v !== "" : false)
  );

  const updateFilter = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters(defaultFilters);

  // Select all currently visible (filtered) products
  const selectAllCurrent = async () => {
    const unshared = filtered.filter(p => !p.isShared);
    if (unshared.length === 0) { toast.info("Todos os produtos já estão no HUB."); return; }
    const rows = unshared.map(p => ({ connection_id: connectionId!, product_id: p.id, is_active: true }));
    const { error } = await supabase.from("hub_shared_products").upsert(rows);
    if (error) { toast.error(error.message); return; }
    const ids = new Set(unshared.map(p => p.id));
    setProducts(prev => prev.map(p => ids.has(p.id) ? { ...p, isShared: true } : p));
    toast.success(`${unshared.length} produto(s) adicionado(s) ao HUB.`);
  };

  // Select all current + set auto_share_all flag
  const selectAllCurrentAndFuture = async () => {
    await selectAllCurrent();
    const { error } = await supabase
      .from("hub_connections")
      .update({ auto_share_all: true } as any)
      .eq("id", connectionId!);
    if (error) { toast.error(error.message); return; }
    setAutoShareAll(true);
    toast.success("Novos produtos também serão compartilhados automaticamente.");
  };

  const disableAutoShare = async () => {
    const { error } = await supabase
      .from("hub_connections")
      .update({ auto_share_all: false } as any)
      .eq("id", connectionId!);
    if (error) { toast.error(error.message); return; }
    setAutoShareAll(false);
    toast.success("Compartilhamento automático desativado.");
  };

  const fmtBRL = (v: number | null) =>
    (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Produtos no HUB</DialogTitle>
        </DialogHeader>

        {/* Auto-share banner */}
        {autoShareAll && (
          <div className="mx-4 mb-2 flex items-center justify-between bg-primary/10 border border-primary/30 rounded-md px-3 py-2">
            <span className="text-xs text-primary font-medium flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Novos produtos serão compartilhados automaticamente
            </span>
            <button className="text-xs text-muted-foreground underline hover:text-foreground" onClick={disableAutoShare}>
              Desativar
            </button>
          </div>
        )}

        {/* Search + filter toggle */}
        <div className="flex gap-2 px-4 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              className="pl-9"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
            />
          </div>
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="icon"
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Collapsible filters */}
        {showFilters && (
          <div className="mx-4 mb-2 border rounded-md p-3 grid grid-cols-2 gap-3 text-sm bg-muted/30 max-h-64 overflow-y-auto">
            {/* Lançamentos */}
            <div className="space-y-1">
              <Label className="text-xs">Lançamentos</Label>
              <Select value={filters.isNewRelease} onValueChange={v => updateFilter("isNewRelease", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">🚀 Apenas Lançamentos</SelectItem>
                  <SelectItem value="no">Sem Lançamentos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Categoria Principal */}
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={filters.mainCategory} onValueChange={v => setFilters(prev => ({ ...prev, mainCategory: v, subcategory: "all" }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {mainCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategoria */}
            {availableSubcategories.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Subcategoria</Label>
                <Select value={filters.subcategory} onValueChange={v => updateFilter("subcategory", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableSubcategories.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status de Estoque */}
            <div className="space-y-1">
              <Label className="text-xs">Estoque</Label>
              <Select value={filters.status} onValueChange={v => updateFilter("status", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="low">Baixo estoque</SelectItem>
                  <SelectItem value="out">Esgotado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Marketing */}
            <div className="space-y-1">
              <Label className="text-xs">Marketing</Label>
              <Select value={filters.marketingStatus} onValueChange={v => updateFilter("marketingStatus", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="opportunity"><span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" />Oportunidade</span></SelectItem>
                  <SelectItem value="presale"><span className="flex items-center gap-1"><Clock className="h-3 w-3 text-purple-500" />Pré-venda</span></SelectItem>
                  <SelectItem value="launch"><span className="flex items-center gap-1"><Rocket className="h-3 w-3 text-green-500" />Lançamento</span></SelectItem>
                  <SelectItem value="secret"><span className="flex items-center gap-1"><Lock className="h-3 w-3 text-rose-500" />Área Secreta</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fornecedor */}
            <div className="space-y-1">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={filters.supplier} onValueChange={v => updateFilter("supplier", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Cor */}
            <div className="space-y-1">
              <Label className="text-xs">Cor</Label>
              <Select value={filters.color} onValueChange={v => updateFilter("color", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {availableColors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Tamanho */}
            <div className="space-y-1">
              <Label className="text-xs">Tamanho</Label>
              <Select value={filters.size} onValueChange={v => updateFilter("size", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableSizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Faixa de Preço */}
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Faixa de Preço (R$)</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Mín" className="h-8 text-xs" value={filters.minPrice} onChange={e => updateFilter("minPrice", e.target.value)} />
                <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filters.maxPrice} onChange={e => updateFilter("maxPrice", e.target.value)} />
              </div>
            </div>

            {/* Faixa de Custo */}
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Faixa de Custo (R$)</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Mín" className="h-8 text-xs" value={filters.minCost} onChange={e => updateFilter("minCost", e.target.value)} />
                <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filters.maxCost} onChange={e => updateFilter("maxCost", e.target.value)} />
              </div>
            </div>

            {/* Faixa de Estoque */}
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Faixa de Estoque</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Mín" className="h-8 text-xs" value={filters.minStock} onChange={e => updateFilter("minStock", e.target.value)} />
                <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filters.maxStock} onChange={e => updateFilter("maxStock", e.target.value)} />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="col-span-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Bulk action buttons */}
        <div className="flex gap-2 px-4 pb-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8 gap-1.5"
            onClick={selectAllCurrent}
            disabled={loading}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Selecionar todos atuais
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8 gap-1.5"
            onClick={selectAllCurrentAndFuture}
            disabled={loading || autoShareAll}
          >
            <Layers className="h-3.5 w-3.5" />
            Atuais + futuros
          </Button>
        </div>

        {/* Counter */}
        <div className="px-4 pb-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} produto(s) · {filtered.filter(p => p.isShared).length} no HUB
          </span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">Filtros ativos</Badge>
          )}
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto space-y-2 px-4 pb-4 pt-1">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto encontrado.</p>
          ) : (
            filtered.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <Switch checked={product.isShared} onCheckedChange={() => toggle(product)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Venda: {fmtBRL(product.price)} · Custo: {fmtBRL(product.cost_price)} · Estoque: {product.stock_quantity}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
