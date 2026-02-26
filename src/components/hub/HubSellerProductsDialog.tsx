import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  connectionId: string | null;
  onClose: () => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string | null;
}

export function HubSellerProductsDialog({ open, connectionId, onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !connectionId) return;
    setSearch("");
    loadProducts();
  }, [open, connectionId]);

  const loadProducts = async () => {
    setLoading(true);
    // Step 1: get shared product IDs
    const { data: sharedRows, error: sharedError } = await supabase
      .from("hub_shared_products")
      .select("product_id")
      .eq("connection_id", connectionId!)
      .eq("is_active", true)
      .limit(2000);

    if (sharedError) { toast.error("Erro ao carregar produtos"); setLoading(false); return; }
    if (!sharedRows || sharedRows.length === 0) { setProducts([]); setLoading(false); return; }

    const productIds = [...new Set(sharedRows.map(r => r.product_id))];

    // Step 2: fetch products in batches
    const BATCH = 100;
    const all: Product[] = [];
    for (let i = 0; i < productIds.length; i += BATCH) {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, stock_quantity, category")
        .in("id", productIds.slice(i, i + BATCH))
        .eq("is_active", true)
        .order("name");
      if (error) { toast.error("Erro ao carregar produtos"); setLoading(false); return; }
      all.push(...(data || []));
    }
    setProducts(all);
    setLoading(false);
  };

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle>Produtos disponíveis para vender</DialogTitle>
          <p className="text-xs text-muted-foreground">{products.length} produto(s) compartilhado(s) com você</p>
        </DialogHeader>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "Nenhum produto encontrado." : "Nenhum produto compartilhado ainda."}
            </p>
          ) : (
            filtered.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-md border bg-card hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge variant={p.stock_quantity > 0 ? "default" : "secondary"} className="text-xs">
                    {p.stock_quantity > 0 ? `${p.stock_quantity} em estoque` : "Esgotado"}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{fmtBRL(p.price)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
