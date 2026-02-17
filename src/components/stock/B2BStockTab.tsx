import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ExternalLink, Check, AlertTriangle, Clock, Link2, RefreshCw, Copy, Package, Pencil, X } from "lucide-react";

interface B2BProduct {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  cost_price: number | null;
  b2b_product_url: string | null;
  supplier_id: string | null;
  owner_id: string;
  category: string;
  category_2: string | null;
  category_3: string | null;
  main_category: string | null;
  subcategory: string | null;
  color_label: string | null;
  model: string | null;
  custom_detail: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  video_url: string | null;
  description: string | null;
  is_new_release: boolean;
  sku: string | null;
  b2b_visible_in_store: boolean;
  suppliers?: { name: string } | null;
  product_variants?: Array<{ id: string; size: string; stock_quantity: number }>;
}

interface B2BClone {
  id: string;
  name: string;
  b2b_source_product_id: string;
  product_variants?: Array<{ id: string; size: string; stock_quantity: number }>;
}

type B2BStatus = "ready" | "no_url" | "pending" | "error" | "checking";

interface B2BCheckResult {
  available: boolean;
  sizes: string[];
  error?: string;
}

interface ProductFiltersState {
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

interface SupplierOption {
  id: string;
  name: string;
}

interface Props {
  userId: string;
  searchTerm?: string;
  filters?: ProductFiltersState;
  suppliers?: SupplierOption[];
  onEditClone?: (cloneId: string) => void;
}

export function B2BStockTab({ userId, searchTerm = "", filters, suppliers: supplierOptions = [], onEditClone }: Props) {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [clones, setClones] = useState<B2BClone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSupplierNames, setActiveSupplierNames] = useState<string[]>([]);
  const [hasActiveB2BSuppliers, setHasActiveB2BSuppliers] = useState(false);
  const [editingUrl, setEditingUrl] = useState<Record<string, string>>({});
  const [checkResults, setCheckResults] = useState<Record<string, B2BCheckResult>>({});
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [creatingIds, setCreatingIds] = useState<Set<string>>(new Set());
  const [b2bStatusFilter, setB2bStatusFilter] = useState<B2BStatus | "all">("all");

  useEffect(() => {
    fetchB2BProducts();
  }, [userId]);

  const fetchB2BProducts = async () => {
    setLoading(true);

    // Get suppliers with b2b_enabled
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("owner_id", userId)
      .eq("b2b_enabled", true);

    const activeSuppliers = suppliers || [];
    const supplierIds = activeSuppliers.map(s => s.id);
    const supplierNames = activeSuppliers.map(s => s.name);

    setHasActiveB2BSuppliers(supplierIds.length > 0);
    setActiveSupplierNames(supplierNames);

    if (supplierIds.length === 0) {
      setProducts([]);
      setClones([]);
      setLoading(false);
      return;
    }

    // Fetch products from these suppliers (excluding clones themselves)
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, image_url, image_url_2, image_url_3, video_url, price, cost_price, b2b_product_url, b2b_visible_in_store, supplier_id, owner_id, category, category_2, category_3, main_category, subcategory, color_label, model, custom_detail, description, is_new_release, sku, suppliers(name), product_variants(id, size, stock_quantity)")
      .eq("owner_id", userId)
      .in("supplier_id", supplierIds)
      .is("b2b_source_product_id", null)
      .order("name") as any;

    setProducts((prods || []) as B2BProduct[]);

    // Fetch existing clones
    const { data: cloneData } = await supabase
      .from("products")
      .select("id, name, b2b_source_product_id, product_variants(id, size, stock_quantity)")
      .eq("owner_id", userId)
      .not("b2b_source_product_id", "is", null) as any;

    setClones((cloneData || []) as B2BClone[]);
    setLoading(false);
  };

  const getCloneForProduct = (productId: string): B2BClone | undefined => {
    return clones.find(c => c.b2b_source_product_id === productId);
  };

  const getStatus = (product: B2BProduct): B2BStatus => {
    if (checkingIds.has(product.id)) return "checking";
    const clone = getCloneForProduct(product.id);
    if (clone) return "ready";
    if (!product.b2b_product_url) return "no_url";
    const result = checkResults[product.id];
    if (result?.error) return "error";
    if (result) return "pending"; // verified but not cloned yet
    return "pending";
  };

  const handleSaveUrl = async (productId: string) => {
    const url = editingUrl[productId];
    if (!url) return;

    const { error } = await supabase
      .from("products")
      .update({ b2b_product_url: url })
      .eq("id", productId);

    if (error) {
      toast.error("Erro ao salvar URL");
    } else {
      toast.success("URL salva!");
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, b2b_product_url: url } : p));
      setEditingUrl(prev => { const n = { ...prev }; delete n[productId]; return n; });
    }
  };

  const handleToggleVisibility = async (product: B2BProduct) => {
    const newValue = !product.b2b_visible_in_store;
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, b2b_visible_in_store: newValue } : p));

    const { error } = await supabase
      .from("products")
      .update({ b2b_visible_in_store: newValue } as any)
      .eq("id", product.id);

    if (error) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, b2b_visible_in_store: !newValue } : p));
      toast.error("Erro ao atualizar visibilidade");
    } else {
      toast.success(newValue ? "Produto visível na loja" : "Produto oculto da loja");
    }
  };

  const handleCheck = async (product: B2BProduct) => {
    setCheckingIds(prev => new Set(prev).add(product.id));

    try {
      const { data, error } = await supabase.functions.invoke("check-b2b-stock", {
        body: { product_id: product.id },
      });

      if (error || !data?.success) {
        setCheckResults(prev => ({ ...prev, [product.id]: { available: false, sizes: [], error: data?.error || "Falha na verificação" } }));
        toast.error("Erro ao verificar: " + (data?.error || "Falha"));
      } else {
        setCheckResults(prev => ({ ...prev, [product.id]: { available: data.available, sizes: data.sizes || [] } }));
        const sizesStr = (data.sizes || []).join(", ");
        toast.success(`Verificado! ${data.available ? "Disponível" : "Esgotado"}${sizesStr ? ` — Tamanhos: ${sizesStr}` : ""}`);
      }
    } catch (err: any) {
      setCheckResults(prev => ({ ...prev, [product.id]: { available: false, sizes: [], error: err.message } }));
      toast.error("Erro na verificação");
    } finally {
      setCheckingIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  };

  const handleCreateClone = async (product: B2BProduct) => {
    const result = checkResults[product.id];
    if (!result || result.sizes.length === 0) {
      toast.error("Verifique o produto primeiro para extrair os tamanhos");
      return;
    }

    setCreatingIds(prev => new Set(prev).add(product.id));

    try {
      // Create clone product
      const { data: cloneProduct, error: cloneError } = await supabase
        .from("products")
        .insert({
          name: `${product.name} (B2B)`,
          description: product.description,
          price: product.price,
          cost_price: product.cost_price,
          category: product.category,
          category_2: product.category_2,
          category_3: product.category_3,
          main_category: product.main_category,
          subcategory: product.subcategory,
          color_label: product.color_label,
          model: product.model,
          custom_detail: product.custom_detail,
          image_url: product.image_url,
          image_url_2: product.image_url_2,
          image_url_3: product.image_url_3,
          video_url: product.video_url,
          supplier_id: product.supplier_id,
          owner_id: product.owner_id,
          b2b_product_url: product.b2b_product_url,
          b2b_source_product_id: product.id,
          stock_quantity: 0,
          min_stock_level: 0,
          is_active: true,
          sku: product.sku ? `${product.sku}-B2B` : null,
          is_new_release: product.is_new_release,
        } as any)
        .select("id")
        .single();

      if (cloneError) throw cloneError;

      // Create variants with supplier sizes
      const variants = result.sizes.map(size => ({
        product_id: cloneProduct.id,
        size,
        stock_quantity: 0, // sob encomenda
      }));

      const { error: varError } = await supabase
        .from("product_variants")
        .insert(variants);

      if (varError) throw varError;

      toast.success(`Clone B2B criado com ${result.sizes.length} tamanhos!`);
      fetchB2BProducts();
    } catch (err: any) {
      toast.error("Erro ao criar clone: " + err.message);
    } finally {
      setCreatingIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  };

  const handleUpdateSizes = async (product: B2BProduct) => {
    const clone = getCloneForProduct(product.id);
    if (!clone) return;

    // First verify to get latest sizes
    setCheckingIds(prev => new Set(prev).add(product.id));

    try {
      const { data, error } = await supabase.functions.invoke("check-b2b-stock", {
        body: { product_id: product.id },
      });

      if (error || !data?.success || !data.sizes?.length) {
        toast.error("Não foi possível extrair tamanhos do fornecedor");
        return;
      }

      const newSizes = new Set(data.sizes as string[]);
      const existingSizes = new Set((clone.product_variants || []).map(v => v.size));

      // Add missing sizes
      const toAdd = [...newSizes].filter(s => !existingSizes.has(s));
      if (toAdd.length > 0) {
        await supabase.from("product_variants").insert(
          toAdd.map(size => ({ product_id: clone.id, size, stock_quantity: 0 }))
        );
      }

      // Remove sizes no longer available
      const toRemove = (clone.product_variants || []).filter(v => !newSizes.has(v.size)).map(v => v.id);
      if (toRemove.length > 0) {
        await supabase.from("product_variants").delete().in("id", toRemove);
      }

      toast.success(`Tamanhos atualizados! +${toAdd.length} -${toRemove.length}`);
      setCheckResults(prev => ({ ...prev, [product.id]: { available: data.available, sizes: data.sizes } }));
      fetchB2BProducts();
    } catch {
      toast.error("Erro ao atualizar tamanhos");
    } finally {
      setCheckingIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  };

  const handleCheckAll = async () => {
    const productsWithUrl = products.filter(p => p.b2b_product_url);
    if (productsWithUrl.length === 0) {
      toast.error("Nenhum produto tem URL configurada");
      return;
    }
    toast.info(`Verificando ${productsWithUrl.length} produtos...`);
    for (const p of productsWithUrl) {
      await handleCheck(p);
    }
    toast.success("Verificação concluída!");
  };

  const statusBadge = (status: B2BStatus) => {
    switch (status) {
      case "ready": return <Badge className="bg-green-500/10 text-green-600 border-green-200">✅ Pronto</Badge>;
      case "no_url": return <Badge variant="outline" className="text-muted-foreground">⬜ Sem URL</Badge>;
      case "pending": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">🟡 Pendente</Badge>;
      case "error": return <Badge variant="destructive">❌ Erro</Badge>;
      case "checking": return <Badge variant="outline"><Loader2 className="h-3 w-3 animate-spin mr-1" />Verificando</Badge>;
    }
  };

  const normalize = (str: string | null | undefined) =>
    (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filteredProducts = useMemo(() => {
    const term = normalize(searchTerm);

    return products.filter((p) => {
      // Search term
      if (term) {
        const matchesTerm =
          normalize(p.name).includes(term) ||
          normalize(p.sku).includes(term) ||
          normalize(p.color_label).includes(term) ||
          normalize(p.suppliers?.name).includes(term) ||
          (p.product_variants || []).some(v => normalize(v.size).includes(term));
        if (!matchesTerm) return false;
      }

      if (!filters) return true;

      // Supplier
      if (filters.supplier !== "all") {
        const selectedName = supplierOptions.find(s => s.id === filters.supplier)?.name;
        if (!selectedName || normalize(p.suppliers?.name) !== normalize(selectedName)) return false;
      }

      // Main category
      if (filters.mainCategory !== "all" && p.main_category !== filters.mainCategory) return false;
      // Subcategory
      if (filters.subcategory !== "all" && p.subcategory !== filters.subcategory) return false;
      // Color
      if (filters.color !== "all" && normalize(p.color_label) !== normalize(filters.color)) return false;
      // Size
      if (filters.size !== "all") {
        const sizes = (p.product_variants || []).map(v => normalize(v.size));
        if (!sizes.includes(normalize(filters.size))) return false;
      }
      // Cost price range
      if (filters.minCost && (p.cost_price || 0) < Number(filters.minCost)) return false;
      if (filters.maxCost && (p.cost_price || 0) > Number(filters.maxCost)) return false;
      // Price range
      if (filters.minPrice && p.price < Number(filters.minPrice)) return false;
      if (filters.maxPrice && p.price > Number(filters.maxPrice)) return false;

      // B2B status filter
      if (b2bStatusFilter !== "all") {
        const productStatus = getStatus(p);
        if (productStatus !== b2bStatusFilter) return false;
      }

      return true;
    });
  }, [products, searchTerm, filters, supplierOptions, b2bStatusFilter, checkingIds, clones, checkResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) {
    if (hasActiveB2BSuppliers) {
      return (
        <div className="text-center py-12 text-muted-foreground max-w-md mx-auto">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-foreground">
            Você tem {activeSupplierNames.length} fornecedor(es) B2B ativo(s)
          </p>
          <p className="text-sm mt-1 font-semibold text-primary">
            {activeSupplierNames.join(", ")}
          </p>
          <p className="text-sm mt-3 leading-relaxed">
            Mas ainda não há produtos cadastrados vinculados a {activeSupplierNames.length === 1 ? "ele" : "eles"}.
          </p>
          <p className="text-sm mt-2 leading-relaxed">
            Para usar o B2B, cadastre produtos na aba <span className="font-semibold">Próprio</span> do Controle de Estoque e vincule-os ao fornecedor <span className="font-semibold">{activeSupplierNames[0]}</span>.
          </p>
        </div>
      );
    }
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum fornecedor com B2B ativo.</p>
        <p className="text-sm mt-1">Ative o B2B em um fornecedor na página de Fornecedores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {filteredProducts.length} de {products.length} produto(s) B2B · {clones.length} clone(s)
          </p>
          <Select value={b2bStatusFilter} onValueChange={(v) => setB2bStatusFilter(v as B2BStatus | "all")}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Status B2B" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="ready">✅ Pronto</SelectItem>
              <SelectItem value="no_url">⬜ Sem URL</SelectItem>
              <SelectItem value="pending">🟡 Pendente</SelectItem>
              <SelectItem value="error">❌ Erro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleCheckAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Verificar Todos
        </Button>
      </div>

      <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Na Loja</TableHead>
              <TableHead>Tam. Local</TableHead>
              <TableHead>Tam. Fornecedor</TableHead>
              <TableHead>URL B2B</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map(product => {
              const status = getStatus(product);
              const clone = getCloneForProduct(product.id);
              const result = checkResults[product.id];
              const localSizes = (product.product_variants || []).map(v => v.size).join(", ") || "-";
              const supplierSizes = result?.sizes?.join(", ") || (clone?.product_variants || []).map(v => v.size).join(", ") || "-";
              const isEditing = product.id in editingUrl;
              const isChecking = checkingIds.has(product.id);
              const isCreating = creatingIds.has(product.id);

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium text-sm">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{product.suppliers?.name || "-"}</TableCell>
                  <TableCell>{statusBadge(status)}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={product.b2b_visible_in_store}
                      onCheckedChange={() => handleToggleVisibility(product)}
                      disabled={status !== "ready"}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{localSizes}</TableCell>
                  <TableCell className="text-xs max-w-[180px]">
                    {clone && clone.product_variants && clone.product_variants.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {clone.product_variants.map(v => (
                          <Badge key={v.id} variant="secondary" className="text-[10px] gap-0.5 pr-0.5">
                            {v.size}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const { error } = await supabase.from("product_variants").delete().eq("id", v.id);
                                if (error) { toast.error("Erro ao remover tamanho"); return; }
                                setClones(prev => prev.map(c => c.id === clone.id ? {
                                  ...c,
                                  product_variants: (c.product_variants || []).filter(pv => pv.id !== v.id)
                                } : c));
                                toast.success(`Tamanho ${v.size} removido`);
                              }}
                              className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                            >
                              <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : result?.sizes?.length ? (
                      <span className="text-primary font-medium">{result.sizes.join(", ")}</span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Input
                          value={editingUrl[product.id] || ""}
                          onChange={e => setEditingUrl(prev => ({ ...prev, [product.id]: e.target.value }))}
                          placeholder="https://..."
                          className="h-8 text-xs w-40"
                        />
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleSaveUrl(product.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {product.b2b_product_url || "—"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1"
                          onClick={() => setEditingUrl(prev => ({ ...prev, [product.id]: product.b2b_product_url || "" }))}
                        >
                          <Link2 className="h-3 w-3" />
                        </Button>
                        {product.b2b_product_url && (
                          <a href={product.b2b_product_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {product.b2b_product_url && !clone && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCheck(product)} disabled={isChecking}>
                          {isChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                          Verificar
                        </Button>
                      )}
                      {!clone && result && result.sizes.length > 0 && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleCreateClone(product)} disabled={isCreating}>
                          {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3 mr-1" />}
                          Criar Clone
                        </Button>
                      )}
                      {clone && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEditClone?.(clone.id)}>
                            <Pencil className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdateSizes(product)} disabled={isChecking}>
                            {isChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                            Atualizar
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
