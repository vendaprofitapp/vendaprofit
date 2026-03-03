import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Package, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Variant {
  id: string;
  size: string;
  stock_quantity: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string | null;
  image_url: string | null;
  product_variants: Variant[];
}

// Key: "productId" (no variants) or "productId__variantId"
interface SelectedItem {
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_size: string | null;
  quantity: number;
  unit_price: number;
}

interface TransferItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerPointId: string;
  partnerName: string;
  partnerPhone: string | null;
  onTransferred: () => void;
}

export function TransferItemsDialog({
  open, onOpenChange, partnerPointId, partnerName, partnerPhone, onTransferred
}: TransferItemsDialogProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open && user) {
      setFetching(true);
      supabase
        .from("products")
        .select("id, name, price, stock_quantity, category, image_url, product_variants(id, size, stock_quantity)")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .order("name")
        .then(({ data }) => {
          setProducts((data as any) ?? []);
          setFetching(false);
        });
    } else {
      setSelected({});
      setExpanded({});
    }
  }, [open, user]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const hasVariants = (p: Product) => p.product_variants && p.product_variants.filter(v => v.stock_quantity > 0).length > 0;

  // Toggle variant selection
  const toggleVariant = (product: Product, variant: Variant) => {
    const key = `${product.id}__${variant.id}`;
    setSelected(prev => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          product_id: product.id,
          product_name: product.name,
          variant_id: variant.id,
          variant_size: variant.size,
          quantity: 1,
          unit_price: product.price,
        },
      };
    });
  };

  // Toggle product (no variants)
  const toggleProduct = (product: Product) => {
    if (hasVariants(product)) {
      setExpanded(prev => ({ ...prev, [product.id]: !prev[product.id] }));
      return;
    }
    setSelected(prev => {
      if (prev[product.id]) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
      return {
        ...prev,
        [product.id]: {
          product_id: product.id,
          product_name: product.name,
          variant_id: null,
          variant_size: null,
          quantity: 1,
          unit_price: product.price,
        },
      };
    });
  };

  const setQty = (key: string, qty: number) => {
    setSelected(prev => prev[key] ? { ...prev, [key]: { ...prev[key], quantity: Math.max(1, qty) } } : prev);
  };

  const selectedList = Object.entries(selected);
  const totalItems = selectedList.length;

  // Count how many variant keys belong to a product
  const productHasAnySelected = (productId: string) =>
    selectedList.some(([k]) => k === productId || k.startsWith(`${productId}__`));

  const buildWhatsAppMessage = () => {
    const lines = selectedList.map(([, i]) => {
      const size = i.variant_size ? ` - ${i.variant_size}` : "";
      return `• ${i.product_name}${size} (${i.quantity}x)`;
    });
    return encodeURIComponent(`Olá! Segue a lista de peças enviadas para o ponto *${partnerName}*:\n\n${lines.join("\n")}\n\nTotal: ${totalItems} ${totalItems === 1 ? "item" : "itens"}\n\nPor favor, confirme o recebimento! 🙏`);
  };

  const handleTransfer = async () => {
    if (!user || totalItems === 0) return;
    setLoading(true);

    const items = selectedList.map(([, i]) => ({
      partner_point_id: partnerPointId,
      product_id: i.product_id,
      variant_id: i.variant_id ?? undefined,
      owner_id: user.id,
      quantity: i.quantity,
      status: "allocated",
    }));

    const { error } = await supabase.from("partner_point_items").insert(items);
    setLoading(false);

    if (error) {
      toast.error("Erro ao transferir peças.");
      return;
    }

    toast.success(`${totalItems} item(ns) transferido(s) com sucesso!`);

    if (partnerPhone) {
      const phone = partnerPhone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}?text=${buildWhatsAppMessage()}`, "_blank");
    }

    setSelected({});
    setExpanded({});
    onTransferred();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Enviar Peças para {partnerName}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou categoria..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-lg">
          {fetching ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Carregando estoque...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhum produto encontrado
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map(product => {
                const withVariants = hasVariants(product);
                const isExpanded = !!expanded[product.id];
                const anySelected = productHasAnySelected(product.id);
                const isDirectSelected = !!selected[product.id];
                const activeVariants = product.product_variants?.filter(v => v.stock_quantity > 0) ?? [];

                return (
                  <div key={product.id}>
                    {/* Product row */}
                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${anySelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"}`}
                      onClick={() => toggleProduct(product)}
                    >
                      {!withVariants ? (
                        <Checkbox checked={isDirectSelected} onCheckedChange={() => toggleProduct(product)} />
                      ) : (
                        <div className="h-4 w-4 flex items-center justify-center text-muted-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      )}
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {product.category && <Badge variant="outline" className="text-xs py-0">{product.category}</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {withVariants ? `${activeVariants.length} tamanhos disponíveis` : `${product.stock_quantity} em estoque`}
                          </span>
                        </div>
                      </div>
                      {/* Direct product qty control */}
                      {!withVariants && isDirectSelected && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setQty(product.id, (selected[product.id]?.quantity ?? 1) - 1)}>-</Button>
                          <span className="text-sm font-medium w-6 text-center">{selected[product.id]?.quantity}</span>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setQty(product.id, (selected[product.id]?.quantity ?? 1) + 1)}>+</Button>
                        </div>
                      )}
                    </div>

                    {/* Variant rows (expanded) */}
                    {withVariants && isExpanded && (
                      <div className="ml-10 mt-1 mb-1 space-y-1">
                        {activeVariants.map(variant => {
                          const key = `${product.id}__${variant.id}`;
                          const isVariantSelected = !!selected[key];
                          return (
                            <div
                              key={variant.id}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isVariantSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50 border border-transparent"}`}
                              onClick={() => toggleVariant(product, variant)}
                            >
                              <Checkbox checked={isVariantSelected} onCheckedChange={() => toggleVariant(product, variant)} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs font-semibold">{variant.size}</Badge>
                                  <span className="text-xs text-muted-foreground">{variant.stock_quantity} em estoque</span>
                                </div>
                              </div>
                              {isVariantSelected && (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setQty(key, (selected[key]?.quantity ?? 1) - 1)}>-</Button>
                                  <span className="text-sm font-medium w-6 text-center">{selected[key]?.quantity}</span>
                                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setQty(key, (selected[key]?.quantity ?? 1) + 1)}>+</Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground mr-auto">
            {totalItems > 0 ? `${totalItems} item(ns) selecionado(s)` : "Selecione os produtos"}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {partnerPhone && totalItems > 0 && (
            <Button variant="outline" className="gap-2" onClick={() => {
              const phone = partnerPhone.replace(/\D/g, "");
              window.open(`https://wa.me/55${phone}?text=${buildWhatsAppMessage()}`, "_blank");
            }}>
              <MessageCircle className="h-4 w-4" />
              Só WhatsApp
            </Button>
          )}
          <Button onClick={handleTransfer} disabled={loading || totalItems === 0}>
            {loading ? "Transferindo..." : `Confirmar Envio (${totalItems})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
