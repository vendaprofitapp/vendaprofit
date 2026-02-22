import { useState, useMemo } from "react";
import { Package, Filter, CheckSquare, Search, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ProductVariant {
  size: string;
  stock_quantity: number;
  marketing_status: string[] | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price?: number | null;
  category: string;
  category_2?: string | null;
  category_3?: string | null;
  main_category?: string | null;
  subcategory?: string | null;
  stock_quantity: number;
  supplier_id?: string | null;
  color_label?: string | null;
  model?: string | null;
  is_new_release?: boolean | null;
  marketing_status?: string[] | null;
  min_stock_level?: number | null;
  product_variants?: ProductVariant[];
}

interface ProductPartnership {
  id: string;
  product_id: string;
  group_id: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface MainCategory {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
  main_category_id: string;
}

interface Filters {
  mainCategory: string;
  subcategory: string;
  supplier: string;
  color: string;
  size: string;
  stockStatus: string;
  marketingStatus: string;
  newRelease: string;
  priceMin: string;
  priceMax: string;
  stockMin: string;
  stockMax: string;
  releaseStatus: string;
}

const defaultFilters: Filters = {
  mainCategory: "all",
  subcategory: "all",
  supplier: "all",
  color: "all",
  size: "all",
  stockStatus: "all",
  marketingStatus: "all",
  newRelease: "all",
  priceMin: "",
  priceMax: "",
  stockMin: "",
  stockMax: "",
  releaseStatus: "all",
};

interface ProductPartnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  products: Product[];
  productPartnerships: ProductPartnership[];
  suppliers?: Supplier[];
  mainCategories?: MainCategory[];
  subcategories?: Subcategory[];
  isAutoShareEnabled?: boolean;
  onToggleAutoShare?: () => void;
  isAutoSharePending?: boolean;
  showAutoShare?: boolean;
}

export function ProductPartnershipDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  products,
  productPartnerships,
  suppliers = [],
  mainCategories = [],
  subcategories = [],
  isAutoShareEnabled = false,
  onToggleAutoShare,
  isAutoSharePending = false,
  showAutoShare = false,
}: ProductPartnershipDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  // Derived filter options from products
  const uniqueColors = useMemo(() => {
    return [...new Set(products.map((p) => p.color_label).filter(Boolean) as string[])].sort();
  }, [products]);

  const uniqueSizes = useMemo(() => {
    const sizes = products.flatMap((p) => p.product_variants?.map((v) => v.size) || []);
    return [...new Set(sizes)].sort();
  }, [products]);

  const filteredSubcategories = useMemo(() => {
    if (filters.mainCategory === "all") return subcategories;
    const mc = mainCategories.find((c) => c.name === filters.mainCategory);
    if (!mc) return [];
    return subcategories.filter((s) => s.main_category_id === mc.id);
  }, [filters.mainCategory, mainCategories, subcategories]);

  // Check if a product is in partnership
  const isProductInPartnership = (productId: string) => {
    return productPartnerships.some(
      (pp) => pp.product_id === productId && pp.group_id === groupId
    );
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesModel = p.model?.toLowerCase().includes(q);
        const matchesColor = p.color_label?.toLowerCase().includes(q);
        if (!matchesName && !matchesModel && !matchesColor) return false;
      }

      // Main category
      if (filters.mainCategory !== "all" && p.main_category !== filters.mainCategory) return false;

      // Subcategory
      if (filters.subcategory !== "all" && p.subcategory !== filters.subcategory) return false;

      // Supplier
      if (filters.supplier !== "all" && p.supplier_id !== filters.supplier) return false;

      // Color
      if (filters.color !== "all" && p.color_label !== filters.color) return false;

      // Size - check variants
      if (filters.size !== "all") {
        const hasSize = p.product_variants?.some((v) => v.size === filters.size);
        if (!hasSize) return false;
      }

      // Stock status
      if (filters.stockStatus !== "all") {
        const minLevel = p.min_stock_level ?? 0;
        if (filters.stockStatus === "available" && p.stock_quantity <= 0) return false;
        if (filters.stockStatus === "low" && (p.stock_quantity <= 0 || p.stock_quantity > minLevel)) return false;
        if (filters.stockStatus === "out" && p.stock_quantity > 0) return false;
      }

      // Marketing status
      if (filters.marketingStatus !== "all") {
        const productMs = p.marketing_status || [];
        const variantMs = p.product_variants?.flatMap((v) => v.marketing_status || []) || [];
        const allMs = [...productMs, ...variantMs];
        if (!allMs.includes(filters.marketingStatus)) return false;
      }

      // New release
      if (filters.newRelease !== "all") {
        if (filters.newRelease === "yes" && !p.is_new_release) return false;
        if (filters.newRelease === "no" && p.is_new_release) return false;
      }

      // Price range
      if (filters.priceMin && p.price < Number(filters.priceMin)) return false;
      if (filters.priceMax && p.price > Number(filters.priceMax)) return false;

      // Stock range
      if (filters.stockMin && p.stock_quantity < Number(filters.stockMin)) return false;
      if (filters.stockMax && p.stock_quantity > Number(filters.stockMax)) return false;

      // Release status
      if (filters.releaseStatus !== "all") {
        const released = isProductInPartnership(p.id);
        if (filters.releaseStatus === "released" && !released) return false;
        if (filters.releaseStatus === "not_released" && released) return false;
      }

      return true;
    });
  }, [products, search, filters, productPartnerships, groupId]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.mainCategory !== "all") count++;
    if (filters.subcategory !== "all") count++;
    if (filters.supplier !== "all") count++;
    if (filters.color !== "all") count++;
    if (filters.size !== "all") count++;
    if (filters.stockStatus !== "all") count++;
    if (filters.marketingStatus !== "all") count++;
    if (filters.newRelease !== "all") count++;
    if (filters.priceMin) count++;
    if (filters.priceMax) count++;
    if (filters.stockMin) count++;
    if (filters.stockMax) count++;
    if (filters.releaseStatus !== "all") count++;
    return count;
  }, [filters]);

  // Active filter badges
  const activeFilterBadges = useMemo(() => {
    const badges: { key: keyof Filters; label: string }[] = [];
    if (filters.mainCategory !== "all") badges.push({ key: "mainCategory", label: `Cat: ${filters.mainCategory}` });
    if (filters.subcategory !== "all") badges.push({ key: "subcategory", label: `Sub: ${filters.subcategory}` });
    if (filters.supplier !== "all") {
      const s = suppliers.find((s) => s.id === filters.supplier);
      badges.push({ key: "supplier", label: `Forn: ${s?.name || "..."}` });
    }
    if (filters.color !== "all") badges.push({ key: "color", label: `Cor: ${filters.color}` });
    if (filters.size !== "all") badges.push({ key: "size", label: `Tam: ${filters.size}` });
    if (filters.stockStatus !== "all") {
      const labels: Record<string, string> = { available: "Disponível", low: "Baixo", out: "Esgotado" };
      badges.push({ key: "stockStatus", label: `Estoque: ${labels[filters.stockStatus] || filters.stockStatus}` });
    }
    if (filters.marketingStatus !== "all") badges.push({ key: "marketingStatus", label: `Mkt: ${filters.marketingStatus}` });
    if (filters.newRelease !== "all") badges.push({ key: "newRelease", label: filters.newRelease === "yes" ? "Lançamento" : "Não lançamento" });
    if (filters.priceMin) badges.push({ key: "priceMin", label: `Preço ≥ R$${filters.priceMin}` });
    if (filters.priceMax) badges.push({ key: "priceMax", label: `Preço ≤ R$${filters.priceMax}` });
    if (filters.stockMin) badges.push({ key: "stockMin", label: `Estoque ≥ ${filters.stockMin}` });
    if (filters.stockMax) badges.push({ key: "stockMax", label: `Estoque ≤ ${filters.stockMax}` });
    if (filters.releaseStatus !== "all") {
      badges.push({ key: "releaseStatus", label: filters.releaseStatus === "released" ? "Liberados" : "Não Liberados" });
    }
    return badges;
  }, [filters, suppliers]);

  const clearFilter = (key: keyof Filters) => {
    setFilters((prev) => ({ ...prev, [key]: key === "priceMin" || key === "priceMax" || key === "stockMin" || key === "stockMax" ? "" : "all" }));
  };

  const clearAllFilters = () => {
    setFilters(defaultFilters);
    setSearch("");
  };

  // Count released in current filter
  const releasedCount = filteredProducts.filter((p) => isProductInPartnership(p.id)).length;

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Get count of partnerships for a product
  const getProductPartnershipsCount = (productId: string) => {
    return productPartnerships.filter((pp) => pp.product_id === productId).length;
  };

  // Toggle single product mutation
  const toggleProductMutation = useMutation({
    mutationFn: async ({ productId, isEnabled }: { productId: string; isEnabled: boolean }) => {
      if (isEnabled) {
        const { error } = await supabase
          .from("product_partnerships")
          .delete()
          .eq("product_id", productId)
          .eq("group_id", groupId);
        if (error) throw error;
      } else {
        // Validate cost_price before releasing
        const product = products.find(p => p.id === productId);
        if (!product?.cost_price && product?.cost_price !== 0) {
          throw new Error(`O produto "${product?.name || ''}" não possui preço de custo cadastrado. Cadastre o custo antes de liberar para parceria.`);
        }
        const { error } = await supabase
          .from("product_partnerships")
          .upsert(
            { product_id: productId, group_id: groupId },
            { onConflict: "product_id,group_id", ignoreDuplicates: true }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"], exact: false });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar produto", description: error.message, variant: "destructive" });
    },
  });

  // Release all visible products mutation
  const releaseAllMutation = useMutation({
    mutationFn: async () => {
      const notReleased = filteredProducts.filter((p) => !isProductInPartnership(p.id));
      // Filter out products without cost_price
      const withoutCost = notReleased.filter(p => !p.cost_price && p.cost_price !== 0);
      const productsToRelease = notReleased.filter(p => p.cost_price || p.cost_price === 0);

      if (productsToRelease.length === 0 && withoutCost.length > 0) {
        throw new Error(`${withoutCost.length} produto(s) sem preço de custo cadastrado. Cadastre o custo antes de liberar.`);
      }
      if (productsToRelease.length === 0) throw new Error("Todos os produtos já estão liberados");

      const inserts = productsToRelease.map((p) => ({ product_id: p.id, group_id: groupId }));
      const { error } = await supabase
        .from("product_partnerships")
        .upsert(inserts, { onConflict: "product_id,group_id", ignoreDuplicates: true });
      if (error) throw error;
      return { released: productsToRelease.length, skipped: withoutCost.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"], exact: false });
      const msg = result.skipped > 0
        ? `${result.released} liberado(s). ${result.skipped} ignorado(s) por falta de preço de custo.`
        : `${result.released} produto${result.released !== 1 ? "s" : ""} liberado${result.released !== 1 ? "s" : ""}.`;
      toast({ title: "Produtos liberados!", description: msg });
    },
    onError: (error) => {
      toast({ title: "Erro ao liberar produtos", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = toggleProductMutation.isPending || releaseAllMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Produtos Liberados - {groupName}</DialogTitle>
          <DialogDescription>Selecione quais produtos liberar para esta parceria.</DialogDescription>
        </DialogHeader>

        {/* Auto-share toggle */}
        {showAutoShare && onToggleAutoShare && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
            <div>
              <p className="font-medium text-sm">Liberar todos automaticamente</p>
              <p className="text-xs text-muted-foreground">Inclui produtos atuais e futuros</p>
            </div>
            <Button
              variant={isAutoShareEnabled ? "default" : "outline"}
              size="sm"
              onClick={onToggleAutoShare}
              disabled={isAutoSharePending}
            >
              {isAutoShareEnabled ? "Ativado" : "Ativar"}
            </Button>
          </div>
        )}

        {/* Search + Filters Bar */}
        <div className="flex flex-col gap-2 py-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, modelo ou cor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="default" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-[60vh] overflow-y-auto" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Filtros Avançados</p>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
                        Limpar tudo
                      </Button>
                    )}
                  </div>

                  {/* Release Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status de Liberação</Label>
                    <Select value={filters.releaseStatus} onValueChange={(v) => setFilters((f) => ({ ...f, releaseStatus: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="released">Liberados</SelectItem>
                        <SelectItem value="not_released">Não Liberados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Main Category */}
                  {mainCategories.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categoria Principal</Label>
                      <Select
                        value={filters.mainCategory}
                        onValueChange={(v) => setFilters((f) => ({ ...f, mainCategory: v, subcategory: "all" }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {mainCategories.map((c) => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Subcategory */}
                  {filters.mainCategory !== "all" && filteredSubcategories.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subcategoria</Label>
                      <Select value={filters.subcategory} onValueChange={(v) => setFilters((f) => ({ ...f, subcategory: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {filteredSubcategories.map((s) => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Supplier */}
                  {suppliers.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fornecedor</Label>
                      <Select value={filters.supplier} onValueChange={(v) => setFilters((f) => ({ ...f, supplier: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Color */}
                  {uniqueColors.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cor</Label>
                      <Select value={filters.color} onValueChange={(v) => setFilters((f) => ({ ...f, color: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {uniqueColors.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Size */}
                  {uniqueSizes.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tamanho</Label>
                      <Select value={filters.size} onValueChange={(v) => setFilters((f) => ({ ...f, size: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueSizes.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Stock Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status de Estoque</Label>
                    <Select value={filters.stockStatus} onValueChange={(v) => setFilters((f) => ({ ...f, stockStatus: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="available">Disponível</SelectItem>
                        <SelectItem value="low">Estoque Baixo</SelectItem>
                        <SelectItem value="out">Esgotado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Marketing Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status de Marketing</Label>
                    <Select value={filters.marketingStatus} onValueChange={(v) => setFilters((f) => ({ ...f, marketingStatus: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="opportunity">🔥 Oportunidade</SelectItem>
                        <SelectItem value="presale">⏳ Pré-venda</SelectItem>
                        <SelectItem value="launch">🚀 Lançamento</SelectItem>
                        <SelectItem value="secret">🔒 Área Secreta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* New Release */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lançamentos</Label>
                    <Select value={filters.newRelease} onValueChange={(v) => setFilters((f) => ({ ...f, newRelease: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="yes">Sim</SelectItem>
                        <SelectItem value="no">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Faixa de Preço (R$)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Mín"
                        value={filters.priceMin}
                        onChange={(e) => setFilters((f) => ({ ...f, priceMin: e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Máx"
                        value={filters.priceMax}
                        onChange={(e) => setFilters((f) => ({ ...f, priceMax: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Stock Range */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Faixa de Estoque</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Mín"
                        value={filters.stockMin}
                        onChange={(e) => setFilters((f) => ({ ...f, stockMin: e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Máx"
                        value={filters.stockMax}
                        onChange={(e) => setFilters((f) => ({ ...f, stockMax: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Release All Button */}
            <Button
              variant="default"
              size="default"
              onClick={() => releaseAllMutation.mutate()}
              disabled={isLoading}
              className="whitespace-nowrap"
            >
              <Package className="h-4 w-4 mr-2" />
              Liberar Todos ({filteredProducts.filter((p) => !isProductInPartnership(p.id)).length})
            </Button>
          </div>

          {/* Active Filter Badges */}
          {activeFilterBadges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFilterBadges.map((badge) => (
                <Badge key={badge.key} variant="secondary" className="text-xs gap-1 pr-1">
                  {badge.label}
                  <button onClick={() => clearFilter(badge.key)} className="ml-0.5 hover:bg-muted rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 text-xs px-2">
                Limpar tudo
              </Button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-2">
          <span>
            {releasedCount} de {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""} liberado{releasedCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Você ainda não tem produtos cadastrados.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum produto encontrado com os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">Liberar</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const isEnabled = isProductInPartnership(product.id);
                  const partnershipsCount = getProductPartnershipsCount(product.id);

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={() => {
                            toggleProductMutation.mutate({ productId: product.id, isEnabled });
                          }}
                          disabled={isLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <div className="flex gap-1 mt-0.5">
                            {product.color_label && (
                              <span className="text-xs text-muted-foreground">{product.color_label}</span>
                            )}
                            {partnershipsCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                · {partnershipsCount} parceria{partnershipsCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{product.main_category || product.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                      <TableCell className="text-right">{product.stock_quantity}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
