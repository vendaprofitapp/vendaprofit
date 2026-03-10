import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ShoppingBasket,
  MapPin,
  Package,
  Store,
  TrendingUp,
  ChevronRight,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  ArrowRight,
  ShoppingCart,
  Inbox,
  Sparkles,
  DollarSign,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────
const VENDA_PROFIT_FEE = 5.0;

// ─── Types ───────────────────────────────────────────────────────────────────
interface SupplierProfile {
  id: string; // owner_id
  full_name: string | null;
  address_city: string | null;
  address_state: string | null;
  store_name: string | null;  // from store_settings
  logo_url: string | null;
  connection_id: string;
  commission_pct: number;
}

interface HubProduct {
  id: string;                  // hub_shared_products.id
  product_id: string;
  name: string;
  price: number;
  cost_price: number | null;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
  hub_pricing_mode: "fixed" | "commission";
  hub_fixed_cost: number;
  hub_minimum_sale_price: number;
  hub_commission_rate: number;
  hub_approval_type: "manual" | "automatic";
  connection_id: string;
  owner_id: string;
}

interface PendingOrder {
  id: string;
  connection_id: string;
  seller_id: string | null;
  owner_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  status: string;
  shipping_label_url: string | null;
  collection_instructions: string | null;
  logistics_set_at: string | null;
  finalized_at: string | null;
  created_at: string;
  items?: OrderItem[];
  supplier_name?: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  variant_size: string | null;
  quantity: number;
  unit_price: number;
  status: string;
  rejection_reason: string | null;
}

// ─── Profit Calculator ───────────────────────────────────────────────────────
function calcProfit(p: HubProduct) {
  if (p.hub_pricing_mode === "fixed") {
    const cost = p.hub_fixed_cost;
    const minSale = p.hub_minimum_sale_price > 0 ? p.hub_minimum_sale_price : p.price;
    const profit = minSale - cost;
    return { cost, minSale, profit };
  }
  // commission mode: reseller pays nothing upfront.
  // Supplier takes hub_commission_rate% of the min sale price at settlement.
  const commissionValue = (p.hub_minimum_sale_price * p.hub_commission_rate) / 100;
  const cost = commissionValue + VENDA_PROFIT_FEE;
  const minSale = p.hub_minimum_sale_price;
  const profit = minSale - cost;
  return { cost, minSale, profit };
}

// ─── Order status helpers ────────────────────────────────────────────────────
const ORDER_STEPS = [
  { key: "pending",          label: "Aguardando Aprovação", icon: Clock,        color: "text-amber-500"  },
  { key: "approved",         label: "Aprovado",             icon: CheckCircle2,  color: "text-blue-500"   },
  { key: "logistics_ready",  label: "Etiqueta Disponível",  icon: Truck,         color: "text-violet-500" },
  { key: "completed",        label: "Enviado",              icon: CheckCircle2,  color: "text-green-600"  },
];

function getStepIndex(status: string) {
  if (status === "completed")        return 3;
  if (status === "logistics_ready" || (status === "approved"))  return 2;
  if (status === "approved")         return 1;
  return 0;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending:         { label: "Aguardando Aprovação", className: "bg-amber-500/10 text-amber-700 border-amber-300" },
    approved:        { label: "Aprovado",             className: "bg-blue-500/10 text-blue-700 border-blue-300" },
    logistics_ready: { label: "Etiqueta Disponível",  className: "bg-violet-500/10 text-violet-700 border-violet-300" },
    completed:       { label: "Concluído",            className: "bg-green-500/10 text-green-700 border-green-300" },
    rejected:        { label: "Rejeitado",            className: "bg-destructive/10 text-destructive border-destructive/30" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

// ─── Product Card (inside supplier sheet) ────────────────────────────────────
function HubProductCard({ product, onMirror }: { product: HubProduct; onMirror: (p: HubProduct) => void }) {
  const { cost, minSale, profit } = calcProfit(product);
  const profitPct = minSale > 0 ? Math.round((profit / minSale) * 100) : 0;
  const isGoodDeal = profitPct >= 30;

  return (
    <Card className="overflow-hidden border border-border hover:border-primary/40 transition-all hover:shadow-md group">
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="relative h-20 w-20 flex-shrink-0 rounded-xl bg-muted overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-7 w-7 text-muted-foreground/30" />
            </div>
          )}
          {isGoodDeal && (
            <div className="absolute top-1 left-1 rounded-full bg-green-500 p-0.5">
              <Sparkles className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight line-clamp-2">{product.name}</p>
          {product.category && (
            <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
          )}

          {/* Pricing grid */}
          <div className="mt-2 grid grid-cols-3 gap-1 text-center">
            <div className="rounded-lg bg-muted/60 px-1 py-1.5">
              <p className="text-[10px] text-muted-foreground leading-tight">Teu Custo</p>
              <p className="text-xs font-bold text-foreground">R$ {cost.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-muted/60 px-1 py-1.5">
              <p className="text-[10px] text-muted-foreground leading-tight">Venda Mín.</p>
              <p className="text-xs font-bold text-primary">R$ {minSale.toFixed(2)}</p>
            </div>
            <div className={cn("rounded-lg px-1 py-1.5", profit > 0 ? "bg-green-500/10" : "bg-destructive/10")}>
              <p className={cn("text-[10px] leading-tight", profit > 0 ? "text-green-700" : "text-destructive")}>
                Lucro
              </p>
              <p className={cn("text-xs font-bold", profit > 0 ? "text-green-700" : "text-destructive")}>
                R$ {profit.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 bg-muted/20 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] py-0">
            {product.hub_approval_type === "automatic" ? "⚡ Auto" : "🕐 Manual"}
          </Badge>
          <Badge variant="outline" className="text-[10px] py-0">
            {product.stock_quantity} un.
          </Badge>
          {profit > 0 && (
            <Badge className="text-[10px] py-0 bg-green-500/15 text-green-700 border-green-300 font-bold">
              +{profitPct}% margem
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => onMirror(product)}
        >
          <ShoppingCart className="h-3 w-3" />
          Vender
        </Button>
      </div>
    </Card>
  );
}

// ─── Supplier Sheet ───────────────────────────────────────────────────────────
function SupplierSheet({
  supplier,
  products,
  open,
  onClose,
}: {
  supplier: SupplierProfile | null;
  products: HubProduct[];
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const handleMirrorProduct = async (product: HubProduct) => {
    // TODO Fase 3: espelhar produto no catálogo do revendedor
    // A estrutura base está aqui para ser expandida
    toast.info("Em breve: você poderá espelhar este produto na sua loja! 🚀");
  };

  const displayName = supplier?.store_name || supplier?.full_name || "Fornecedor";
  const location =
    supplier?.address_city && supplier?.address_state
      ? `${supplier.address_city}, ${supplier.address_state}`
      : supplier?.address_city || supplier?.address_state || null;

  const avgMargin = products.length > 0
    ? Math.round(
        products.reduce((sum, p) => {
          const { minSale, profit } = calcProfit(p);
          return sum + (minSale > 0 ? (profit / minSale) * 100 : 0);
        }, 0) / products.length
      )
    : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 pb-3 border-b border-border bg-sidebar flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-primary/20">
              {supplier?.logo_url ? (
                <img src={supplier.logo_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold leading-tight">{displayName}</SheetTitle>
              {location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {location}
                </p>
              )}
            </div>
            <div className="ml-auto flex-shrink-0 text-right">
              <p className="text-xs text-muted-foreground">Margem média</p>
              <p className={cn("text-base font-bold", avgMargin >= 30 ? "text-green-600" : "text-amber-600")}>
                {avgMargin}%
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Stats bar */}
        <div className="flex divide-x divide-border border-b border-border flex-shrink-0">
          {[
            { label: "Produtos", value: products.length },
            {
              label: "Taxa plataforma",
              value: `R$ ${VENDA_PROFIT_FEE.toFixed(2)}`,
            },
            {
              label: "Aprovação",
              value:
                products.every((p) => p.hub_approval_type === "automatic")
                  ? "⚡ Auto"
                  : products.some((p) => p.hub_approval_type === "automatic")
                  ? "Misto"
                  : "Manual",
            },
          ].map((s) => (
            <div key={s.label} className="flex-1 py-2.5 px-3 text-center">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-sm font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16 px-6">
              <Package className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">
                Este fornecedor ainda não configurou produtos no HUB.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {products.length} produto{products.length !== 1 ? "s" : ""} disponível{products.length !== 1 ? "is" : ""}
              </p>
              {products.map((p) => (
                <HubProductCard key={p.id} product={p} onMirror={handleMirrorProduct} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Supplier Card ────────────────────────────────────────────────────────────
function SupplierCard({
  supplier,
  productCount,
  bestMargin,
  onClick,
}: {
  supplier: SupplierProfile;
  productCount: number;
  bestMargin: number;
  onClick: () => void;
}) {
  const displayName = supplier.store_name || supplier.full_name || "Fornecedor";
  const location =
    supplier.address_city && supplier.address_state
      ? `${supplier.address_city} — ${supplier.address_state}`
      : supplier.address_city || supplier.address_state || null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group"
    >
      <Card className="overflow-hidden border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200 group-active:scale-[0.98]">
        {/* Top accent stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 to-primary" />

        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-primary/10">
              {supplier.logo_url ? (
                <img src={supplier.logo_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-6 w-6 text-primary" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="font-bold text-sm truncate">{displayName}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
              </div>

              {location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{location}</span>
                </p>
              )}

              {/* Metrics */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] py-0 gap-1">
                  <Package className="h-2.5 w-2.5" />
                  {productCount} produto{productCount !== 1 ? "s" : ""}
                </Badge>
                {bestMargin > 0 && (
                  <Badge
                    className={cn(
                      "text-[10px] py-0 font-semibold",
                      bestMargin >= 40
                        ? "bg-green-500/15 text-green-700 border-green-300"
                        : bestMargin >= 20
                        ? "bg-amber-500/15 text-amber-700 border-amber-300"
                        : "bg-muted text-muted-foreground border-border"
                    )}
                    variant="outline"
                  >
                    <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                    até {bestMargin}% margem
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order }: { order: PendingOrder }) {
  const [expanded, setExpanded] = useState(false);

  const stepIndex = getStepIndex(order.status);
  const isRejected = order.status === "rejected";

  return (
    <Card className="overflow-hidden border border-border">
      {/* Header */}
      <button
        className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm truncate">
                {order.supplier_name || "Fornecedor"}
              </p>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {order.customer_name ? `Para: ${order.customer_name}` : "Sem cliente"}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-sm font-bold text-primary">R$ {order.total.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Status pipeline */}
      {!isRejected && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1">
            {ORDER_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isDone = idx <= stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0",
                        isDone
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-muted border-border text-muted-foreground"
                      )}
                    >
                      <StepIcon className="h-3 w-3" />
                    </div>
                    <span
                      className={cn(
                        "text-[9px] text-center leading-tight hidden sm:block",
                        isDone ? "text-foreground font-medium" : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < ORDER_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 mx-1 mb-3 rounded transition-all",
                        idx < stepIndex ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isRejected && (
        <div className="mx-4 mb-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">Pedido rejeitado pelo fornecedor.</p>
        </div>
      )}

      {/* Expanded: items + logistics */}
      {expanded && (
        <div className="border-t border-border">
          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens</p>
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.product_name}</p>
                    {item.variant_size && (
                      <p className="text-xs text-muted-foreground">Tamanho: {item.variant_size}</p>
                    )}
                    {item.status === "rejected" && item.rejection_reason && (
                      <p className="text-xs text-destructive">Rejeitado: {item.rejection_reason}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold">
                      {item.quantity}x R$ {item.unit_price.toFixed(2)}
                    </p>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Logistics info */}
          {order.shipping_label_url && (
            <div className="mx-4 mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary">Etiqueta disponível</p>
                <a
                  href={order.shipping_label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline text-primary truncate block"
                >
                  Abrir etiqueta de envio
                </a>
              </div>
            </div>
          )}

          {order.collection_instructions && (
            <div className="mx-4 mb-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold mb-1">Instruções de Coleta</p>
              <p className="text-xs text-muted-foreground">{order.collection_instructions}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HubVendedor() {
  const { user } = useAuth();
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProfile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── 1. Load active hub connections where user is the seller ─────────────────
  const { data: connections = [], isLoading: loadingConn } = useQuery({
    queryKey: ["hub-vendedor-connections", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_connections")
        .select("id, owner_id, commission_pct")
        .eq("seller_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return data as { id: string; owner_id: string; commission_pct: number }[];
    },
  });

  const ownerIds = connections.map((c) => c.owner_id);
  const connectionIds = connections.map((c) => c.id);

  // ── 2. Load supplier profiles (profiles + store_settings) ───────────────────
  const { data: supplierProfiles = [] } = useQuery({
    queryKey: ["hub-vendedor-suppliers", ownerIds],
    enabled: ownerIds.length > 0,
    queryFn: async () => {
      const [profilesRes, storesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, address_city, address_state")
          .in("id", ownerIds),
        supabase
          .from("store_settings")
          .select("owner_id, store_name, logo_url")
          .in("owner_id", ownerIds),
      ]);

      const profiles = profilesRes.data ?? [];
      const stores = storesRes.data ?? [];
      const storeMap = Object.fromEntries(stores.map((s) => [s.owner_id, s]));

      return connections.map((conn) => {
        const prof = profiles.find((p) => p.id === conn.owner_id);
        const store = storeMap[conn.owner_id];
        return {
          id: conn.owner_id,
          full_name: prof?.full_name ?? null,
          address_city: prof?.address_city ?? null,
          address_state: prof?.address_state ?? null,
          store_name: store?.store_name ?? null,
          logo_url: store?.logo_url ?? null,
          connection_id: conn.id,
          commission_pct: conn.commission_pct,
        } as SupplierProfile;
      });
    },
  });

  // ── 3. Load hub products for all connections ────────────────────────────────
  const { data: hubProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["hub-vendedor-products", connectionIds],
    enabled: connectionIds.length > 0,
    queryFn: async () => {
      const { data: shared, error } = await supabase
        .from("hub_shared_products")
        .select("id, product_id, connection_id, hub_pricing_mode, hub_fixed_cost, hub_minimum_sale_price, hub_commission_rate, hub_approval_type")
        .in("connection_id", connectionIds)
        .eq("is_active", true)
        .eq("hub_configured", true);

      if (error) throw error;
      if (!shared || shared.length === 0) return [];

      const productIds = [...new Set(shared.map((s) => s.product_id))];
      const { data: products, error: pe } = await supabase
        .from("products")
        .select("id, name, price, cost_price, image_url, category, stock_quantity, owner_id")
        .in("id", productIds)
        .eq("is_active", true);

      if (pe) throw pe;
      const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]));

      return shared
        .map((s) => {
          const prod = productMap[s.product_id];
          if (!prod) return null;
          return {
            id: s.id,
            product_id: s.product_id,
            name: prod.name,
            price: prod.price,
            cost_price: prod.cost_price,
            image_url: prod.image_url,
            category: prod.category,
            stock_quantity: prod.stock_quantity,
            hub_pricing_mode: s.hub_pricing_mode as "fixed" | "commission",
            hub_fixed_cost: s.hub_fixed_cost ?? 0,
            hub_minimum_sale_price: s.hub_minimum_sale_price ?? 0,
            hub_commission_rate: s.hub_commission_rate ?? 0,
            hub_approval_type: s.hub_approval_type as "manual" | "automatic",
            connection_id: s.connection_id,
            owner_id: prod.owner_id,
          } as HubProduct;
        })
        .filter(Boolean) as HubProduct[];
    },
  });

  // ── 4. Load pending orders where user is buyer ──────────────────────────────
  const { data: pendingOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["hub-vendedor-orders", user?.id, connectionIds],
    enabled: !!user,
    queryFn: async () => {
      let ordersQuery = supabase
        .from("hub_pending_orders")
        .select("id, connection_id, seller_id, owner_id, customer_name, customer_phone, total, status, shipping_label_url, collection_instructions, logistics_set_at, finalized_at, created_at")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });

      const { data: orders, error } = await ordersQuery;
      if (error) throw error;
      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map((o) => o.id);
      const { data: items } = await supabase
        .from("hub_pending_order_items")
        .select("id, order_id, product_name, variant_size, quantity, unit_price, status, rejection_reason")
        .in("order_id", orderIds);

      // Map supplier names
      const ownerIdsInOrders = [...new Set(orders.map((o) => o.owner_id))];
      const { data: orderProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIdsInOrders);
      const { data: orderStores } = await supabase
        .from("store_settings")
        .select("owner_id, store_name")
        .in("owner_id", ownerIdsInOrders);

      const storeMap = Object.fromEntries((orderStores ?? []).map((s) => [s.owner_id, s.store_name]));
      const profileMap = Object.fromEntries((orderProfiles ?? []).map((p) => [p.id, p.full_name]));

      return orders.map((o) => ({
        ...o,
        supplier_name: storeMap[o.owner_id] || profileMap[o.owner_id] || "Fornecedor",
        items: (items ?? [])
          .filter((i) => i.order_id === o.id)
          .map((i) => ({
            id: i.id,
            product_name: i.product_name,
            variant_size: i.variant_size,
            quantity: i.quantity,
            unit_price: i.unit_price,
            status: i.status,
            rejection_reason: i.rejection_reason,
          })),
      })) as PendingOrder[];
    },
  });

  // ── Supplier → products map ─────────────────────────────────────────────────
  const productsBySupplier = supplierProfiles.reduce(
    (acc, s) => {
      acc[s.id] = hubProducts.filter((p) => p.owner_id === s.id);
      return acc;
    },
    {} as Record<string, HubProduct[]>
  );

  // Best margin per supplier
  function getBestMargin(products: HubProduct[]) {
    if (!products.length) return 0;
    const margins = products.map((p) => {
      const { minSale, profit } = calcProfit(p);
      return minSale > 0 ? Math.round((profit / minSale) * 100) : 0;
    });
    return Math.max(...margins);
  }

  const isLoading = loadingConn || loadingProducts;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <ShoppingBasket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">HUB Vendedor</h1>
            <p className="text-muted-foreground text-sm">
              Explore fornecedores parceiros e acompanhe seus pedidos B2B.
            </p>
          </div>
        </div>

        <Tabs defaultValue="explorar">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="explorar" className="flex-1 sm:flex-none gap-1.5">
              <Store className="h-4 w-4" /> Explorar Fornecedores
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex-1 sm:flex-none gap-1.5">
              <Inbox className="h-4 w-4" /> Meus Pedidos B2B
              {pendingOrders.filter((o) => o.status === "pending").length > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                  {pendingOrders.filter((o) => o.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Explorar Fornecedores ─────────────────────────────────── */}
          <TabsContent value="explorar" className="mt-4">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="h-1.5 bg-muted rounded-t-lg" />
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-xl bg-muted flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-muted rounded" />
                          <div className="h-3 w-1/2 bg-muted rounded" />
                          <div className="h-5 w-24 bg-muted rounded-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : supplierProfiles.length === 0 ? (
              <Card className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 px-6">
                  <div className="rounded-full bg-muted p-4">
                    <Store className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="font-semibold text-muted-foreground">Nenhum fornecedor conectado</p>
                  <p className="text-sm text-muted-foreground/70 max-w-xs">
                    Você ainda não tem conexões HUB ativas. Aguarde um fornecedor te convidar ou acesse o "HUB Fornecedor" para configurar o seu.
                  </p>
                </div>
              </Card>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {supplierProfiles.length} fornecedor{supplierProfiles.length !== 1 ? "es" : ""} conectado{supplierProfiles.length !== 1 ? "s" : ""}
                  {" "}· {hubProducts.length} produto{hubProducts.length !== 1 ? "s" : ""} disponíve{hubProducts.length !== 1 ? "is" : "l"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {supplierProfiles.map((supplier) => {
                    const supplierProducts = productsBySupplier[supplier.id] ?? [];
                    return (
                      <SupplierCard
                        key={supplier.id}
                        supplier={supplier}
                        productCount={supplierProducts.length}
                        bestMargin={getBestMargin(supplierProducts)}
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setSheetOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Tab: Meus Pedidos B2B ──────────────────────────────────────── */}
          <TabsContent value="pedidos" className="mt-4 space-y-3">
            {loadingOrders ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="animate-pulse p-4">
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/2 bg-muted rounded" />
                        <div className="h-3 w-1/3 bg-muted rounded" />
                      </div>
                      <div className="h-5 w-20 bg-muted rounded-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : pendingOrders.length === 0 ? (
              <Card className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 px-6">
                  <div className="rounded-full bg-muted p-4">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="font-semibold text-muted-foreground">Nenhum pedido ainda</p>
                  <p className="text-sm text-muted-foreground/70 max-w-xs">
                    Explore os fornecedores e crie o seu primeiro pedido B2B.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      const trigger = document.querySelector<HTMLButtonElement>('[data-radix-collection-item][value="explorar"]');
                      trigger?.click();
                    }}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Explorar Fornecedores
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                {/* Status summary pills */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "pending",  label: "Aguardando",  color: "bg-amber-500/10 text-amber-700 border-amber-300" },
                    { key: "approved", label: "Aprovados",   color: "bg-blue-500/10 text-blue-700 border-blue-300" },
                    { key: "completed",label: "Concluídos",  color: "bg-green-500/10 text-green-700 border-green-300" },
                    { key: "rejected", label: "Rejeitados",  color: "bg-destructive/10 text-destructive border-destructive/30" },
                  ].map((s) => {
                    const count = pendingOrders.filter((o) => o.status === s.key).length;
                    if (count === 0) return null;
                    return (
                      <Badge key={s.key} variant="outline" className={cn("text-xs", s.color)}>
                        {count} {s.label}
                      </Badge>
                    );
                  })}
                </div>

                {pendingOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Supplier Sheet */}
      <SupplierSheet
        supplier={selectedSupplier}
        products={selectedSupplier ? (productsBySupplier[selectedSupplier.id] ?? []) : []}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedSupplier(null); }}
      />
    </MainLayout>
  );
}
