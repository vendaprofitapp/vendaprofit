import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PartnerCheckoutPasses } from "@/components/partners/PartnerCheckoutPasses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, Search, Package, MapPin, X, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

interface PartnerPoint {
  id: string;
  name: string;
  owner_id: string;
  payment_fee_pct: number;
  access_token: string;
}

interface CatalogItem {
  id: string; // partner_point_items.id
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    category: string | null;
    description: string | null;
  };
}

interface CartItem {
  partner_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface StoreInfo {
  whatsapp_number: string | null;
  store_name: string;
}

interface PixKeyInfo {
  pix_key: string | null;
}

export default function PartnerCatalog() {
  const { token } = useParams<{ token: string }>();
  const [partnerPoint, setPartnerPoint] = useState<PartnerPoint | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<"catalog" | "checkout">("catalog");

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      // Find partner point by access_token
      const { data: pp } = await supabase
        .from("partner_points")
        .select("id, name, owner_id, payment_fee_pct, access_token")
        .eq("access_token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (!pp) { setNotFound(true); setLoading(false); return; }
      setPartnerPoint(pp as PartnerPoint);

      // Fetch allocated items + product info
      const { data: rawItems } = await supabase
        .from("partner_point_items")
        .select("id, product_id, quantity")
        .eq("partner_point_id", pp.id)
        .eq("status", "allocated");

      if (rawItems && rawItems.length > 0) {
        const productIds = [...new Set((rawItems as any[]).map(i => i.product_id))];
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price, image_url, category, description")
          .in("id", productIds)
          .eq("is_active", true);
        const productMap = Object.fromEntries((products ?? []).map(p => [p.id, p]));
        setCatalogItems(
          (rawItems as any[])
            .filter(i => productMap[i.product_id])
            .map(i => ({ id: i.id, product_id: i.product_id, quantity: i.quantity, product: productMap[i.product_id] }))
        );
      }

      // Fetch store info for WhatsApp
      const { data: store } = await supabase
        .from("store_settings")
        .select("whatsapp_number, store_name")
        .eq("owner_id", pp.owner_id)
        .maybeSingle();
      setStoreInfo(store as StoreInfo ?? null);

      setLoading(false);
    };
    load();
  }, [token]);

  const filtered = catalogItems.filter(i =>
    i.product.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.product.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (item: CatalogItem) => {
    setCart(prev => {
      const exists = prev.find(c => c.partner_item_id === item.id);
      if (exists) return prev; // already in cart
      return [...prev, {
        partner_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product.name,
        quantity: 1,
        unit_price: item.product.price,
      }];
    });
    toast.success(`${item.product.name} adicionado à sacola`);
  };

  const removeFromCart = (partner_item_id: string) =>
    setCart(prev => prev.filter(c => c.partner_item_id !== partner_item_id));

  const totalGross = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || !partnerPoint) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <MapPin className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-xl font-bold text-foreground">Ponto não encontrado</h1>
        <p className="text-sm text-muted-foreground text-center">
          Este QR Code pode ser inválido ou o ponto estar inativo.
        </p>
      </div>
    );
  }

  if (view === "checkout") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto p-4 space-y-4">
          <div className="flex items-center gap-3 py-3 border-b">
            <Button variant="ghost" size="icon" onClick={() => setView("catalog")}>
              <X className="h-5 w-5" />
            </Button>
            <h2 className="font-bold text-foreground">Finalizar compra</h2>
          </div>
          <PartnerCheckoutPasses
            cartItems={cart}
            partnerPoint={partnerPoint}
            pixKey={undefined}
            whatsappNumber={storeInfo?.whatsapp_number ?? undefined}
            onCheckoutComplete={() => {
              setCart([]);
              setView("catalog");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header banner */}
      <div className="bg-primary text-primary-foreground px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <MapPin className="h-4 w-4" />
          <p className="text-sm font-semibold">
            Estoque disponível em <strong>{partnerPoint.name}</strong>
          </p>
        </div>
        {storeInfo?.store_name && (
          <p className="text-xs opacity-80 mt-0.5">por {storeInfo.store_name}</p>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum produto disponível neste momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(item => {
              const inCart = cart.find(c => c.partner_item_id === item.id);
              return (
                <Card key={item.id} className={`overflow-hidden transition-all ${inCart ? "ring-2 ring-primary" : ""}`}>
                  <div className="relative">
                    {item.product.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-muted flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    {item.product.category && (
                      <Badge className="absolute top-2 left-2 text-xs" variant="secondary">
                        {item.product.category}
                      </Badge>
                    )}
                    {inCart && (
                      <div className="absolute top-2 right-2 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                        <ShoppingBag className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-semibold leading-tight line-clamp-2">{item.product.name}</p>
                    <p className="text-base font-bold text-primary mt-1">{fmtBRL(item.product.price)}</p>
                    {inCart ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-xs gap-1"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <X className="h-3 w-3" />
                        Remover
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full mt-2 text-xs gap-1"
                        onClick={() => addToCart(item)}
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart floating button */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg">
          <Button className="w-full max-w-2xl mx-auto flex gap-3" onClick={() => setView("checkout")}>
            <ShoppingBag className="h-5 w-5" />
            <span>Ver sacola ({cart.length} peças)</span>
            <span className="ml-auto font-bold">{fmtBRL(totalGross)}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
