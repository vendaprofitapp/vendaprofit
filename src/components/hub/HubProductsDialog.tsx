import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search } from "lucide-react";

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
}

export function HubProductsDialog({ open, connectionId, onClose }: Props) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !connectionId || !user) return;
    loadProducts();
  }, [open, connectionId, user]);

  const loadProducts = async () => {
    setLoading(true);
    const [prodRes, sharedRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, price, cost_price, stock_quantity, is_active")
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
      (prodRes.data ?? []).map((p) => ({ ...p, isShared: sharedIds.has(p.id) }))
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

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const fmtBRL = (v: number | null) =>
    (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Produtos no HUB</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-2 pr-1">
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
