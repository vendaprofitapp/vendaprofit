import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ShoppingBasket, MapPin, Package, Store, TrendingUp, ChevronRight,
  ShoppingCart, Inbox, Sparkles, Clock, Truck, CheckCircle2, XCircle,
  ArrowRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  PLATFORM_PIX_KEY, PLATFORM_PIX_NAME,
  StatusBadge, OrderTimeline, PixCard, FileUploadZone, uploadOrderFile,
  STATUS_CONFIG,
} from "@/components/hub/HubOrderShared";
import { calcHubFee } from "@/hooks/useHubFeeCalculator";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SupplierProfile {
  id: string;
  full_name: string | null;
  address_city: string | null;
  address_state: string | null;
  store_name: string | null;
  logo_url: string | null;
  pix_key: string | null;
  hub_description: string | null;
  connection_id: string;
  commission_pct: number;
}

interface HubProduct {
  id: string;
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
  // cascade fee overrides (from admin)
  admin_hub_fee_type?: "fixed" | "percentage" | null;
  admin_hub_fee_value?: number | null;
  // supplier-level fee (joined from profiles)
  supplierFeeType?: "fixed" | "percentage" | null;
  supplierFeeValue?: number | null;
}

interface PendingOrder {
  id: string;
  connection_id: string;
  seller_id: string | null;
  owner_id: string;
  customer_name: string | null;
  total: number;
  status: string;
  shipping_label_url: string | null;
  supplier_receipt_url: string | null;
  platform_receipt_url: string | null;
  collection_instructions: string | null;
  created_at: string;
  items?: OrderItem[];
  supplier_name?: string;
  supplier_pix_key?: string | null;
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

// ─── Profit calc (uses cascade fee hook) ─────────────────────────────────────
function calcProfit(p: HubProduct & { supplierFeeType?: "fixed" | "percentage" | null; supplierFeeValue?: number | null }) {
  if (p.hub_pricing_mode === "fixed") {
    const costBase = p.hub_fixed_cost;
    const minSale = p.hub_minimum_sale_price > 0 ? p.hub_minimum_sale_price : p.price;
    const { feeAmount, totalCost } = calcHubFee({
      costPrice: costBase,
      productFeeType: (p as any).admin_hub_fee_type ?? null,
      productFeeValue: (p as any).admin_hub_fee_value ?? null,
      supplierFeeType: p.supplierFeeType ?? null,
      supplierFeeValue: p.supplierFeeValue ?? null,
    });
    return { cost: totalCost, costBase, feeAmount, minSale, profit: minSale - totalCost };
  }
  const commissionValue = (p.hub_minimum_sale_price * p.hub_commission_rate) / 100;
  const minSale = p.hub_minimum_sale_price;
  const { feeAmount, totalCost } = calcHubFee({
    costPrice: commissionValue,
    productFeeType: (p as any).admin_hub_fee_type ?? null,
    productFeeValue: (p as any).admin_hub_fee_value ?? null,
    supplierFeeType: p.supplierFeeType ?? null,
    supplierFeeValue: p.supplierFeeValue ?? null,
  });
  return { cost: totalCost, costBase: commissionValue, feeAmount, minSale, profit: minSale - totalCost };
}

// ─── Buyer Order State Card ───────────────────────────────────────────────────
function BuyerOrderCard({
  order,
  onRefresh,
}: {
  order: PendingOrder;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState(order);
  const queryClient = useQueryClient();

  // Keep localOrder in sync with prop
  if (order.id !== localOrder.id) setLocalOrder(order);

  const updateStatus = async (newStatus: string, extra?: Record<string, string>) => {
    const { error } = await supabase
      .from("hub_pending_orders")
      .update({ status: newStatus, ...extra })
      .eq("id", order.id);
    if (error) throw error;
    setLocalOrder((p) => ({ ...p, status: newStatus, ...extra }));
    onRefresh();
  };

  const handleUpload = async (
    slot: "supplier-receipt" | "platform-receipt" | "shipping-label",
    file: File
  ) => {
    setUploadingSlot(slot);
    try {
      const url = await uploadOrderFile(order.id, slot, file);
      const field =
        slot === "supplier-receipt" ? "supplier_receipt_url"
        : slot === "platform-receipt" ? "platform_receipt_url"
        : "shipping_label_url";
      const { error } = await supabase
        .from("hub_pending_orders")
        .update({ [field]: url })
        .eq("id", order.id);
      if (error) throw error;
      setLocalOrder((p) => ({ ...p, [field]: url }));
      toast.success("Ficheiro enviado!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingSlot(null);
    }
  };

  const submitPaymentProofs = async () => {
    if (!localOrder.supplier_receipt_url || !localOrder.platform_receipt_url) {
      toast.error("Anexe os dois comprovativos antes de continuar.");
      return;
    }
    try {
      await updateStatus("pagamento_em_analise");
      toast.success("Comprovativos enviados! Aguarda a confirmação do fornecedor.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const submitShippingLabel = async () => {
    if (!localOrder.shipping_label_url) {
      toast.error("Anexe a etiqueta de envio antes de continuar.");
      return;
    }
    try {
      await updateStatus("aguardando_postagem");
      toast.success("Etiqueta enviada! O fornecedor irá despachar em breve.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const status = localOrder.status;
  const isRejected = status === "rejected";

  // Calculate amounts for PIX display
  const itemsTotal = (order.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const platformFee = calcHubFee({ costPrice: Math.max(itemsTotal, 0) }).feeAmount;
  const supplierAmount = Math.max(itemsTotal - platformFee, 0);

  return (
    <Card className={cn("overflow-hidden border transition-all", isRejected && "opacity-75")}>
      {/* Click header to expand */}
      <button
        className="w-full text-left p-4 hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{localOrder.supplier_name || "Fornecedor"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {localOrder.customer_name ? `Para: ${localOrder.customer_name}` : "Sem cliente"}
              {" · "}
              {new Date(order.created_at).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-base font-bold text-primary mt-1">R$ {localOrder.total.toFixed(2)}</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </button>

      {/* Timeline */}
      {!isRejected && (
        <div className="px-4 pb-3">
          <OrderTimeline status={status} />
        </div>
      )}

      {/* Rejected banner */}
      {isRejected && (
        <div className="mx-4 mb-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex gap-2">
          <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">Pedido recusado pelo fornecedor.</p>
        </div>
      )}

      {/* Expanded body */}
      {expanded && !isRejected && (
        <div className="border-t border-border">

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="p-4 pb-2 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Itens do Pedido</p>
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.product_name}</p>
                    {item.variant_size && <p className="text-xs text-muted-foreground">Tam: {item.variant_size}</p>}
                  </div>
                  <p className="font-semibold flex-shrink-0 ml-2">
                    {item.quantity}× R$ {item.unit_price.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── STATE: AGUARDANDO_PAGAMENTO ── */}
          {(status === "aguardando_pagamento" || status === "approved") && (
            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-500/5 p-3">
                <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Ação necessária: efectuar pagamento
                </p>
                <p className="text-xs text-amber-700/80">
                  Realize os dois pagamentos via PIX e anexe os comprovativos abaixo.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PixCard
                  label="PIX ao Fornecedor"
                  pixKey={localOrder.supplier_pix_key || "Consulte o fornecedor"}
                  amount={supplierAmount}
                  name={localOrder.supplier_name ?? undefined}
                />
                <PixCard
                  label="PIX Venda PROFIT (taxa)"
                  pixKey={PLATFORM_PIX_KEY}
                  amount={platformFee}
                  name={PLATFORM_PIX_NAME}
                  accent
                />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <FileUploadZone
                  label="Comprovativo — Fornecedor"
                  hint="Foto ou PDF do comprovativo PIX"
                  currentUrl={localOrder.supplier_receipt_url}
                  onUpload={(f) => handleUpload("supplier-receipt", f)}
                  uploading={uploadingSlot === "supplier-receipt"}
                />
                <FileUploadZone
                  label="Comprovativo — Venda PROFIT"
                  hint="Foto ou PDF do comprovativo PIX"
                  currentUrl={localOrder.platform_receipt_url}
                  onUpload={(f) => handleUpload("platform-receipt", f)}
                  uploading={uploadingSlot === "platform-receipt"}
                />
              </div>

              <Button
                className="w-full gap-2"
                onClick={submitPaymentProofs}
                disabled={!localOrder.supplier_receipt_url || !localOrder.platform_receipt_url}
              >
                <CheckCircle2 className="h-4 w-4" />
                Enviar Comprovativos
              </Button>
            </div>
          )}

          {/* ── STATE: PAGAMENTO_EM_ANALISE ── */}
          {status === "pagamento_em_analise" && (
            <div className="p-4">
              <div className="rounded-xl border border-blue-300 bg-blue-500/5 p-4 text-center space-y-2">
                <Clock className="h-8 w-8 text-blue-600 mx-auto" />
                <p className="font-semibold text-blue-700">Comprovativos enviados</p>
                <p className="text-xs text-blue-600/80">
                  A aguardar a confirmação de recebimento pelo fornecedor. Assim que confirmado, poderás enviar a etiqueta de transporte.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  {localOrder.supplier_receipt_url && (
                    <a href={localOrder.supplier_receipt_url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                        Ver comprovativo fornecedor
                      </Badge>
                    </a>
                  )}
                  {localOrder.platform_receipt_url && (
                    <a href={localOrder.platform_receipt_url} target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                        Ver comprovativo plataforma
                      </Badge>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STATE: AGUARDANDO_ETIQUETA ── */}
          {status === "aguardando_etiqueta" && (
            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-violet-300 bg-violet-500/5 p-3">
                <p className="text-xs font-bold text-violet-700 mb-1 flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> Ação necessária: enviar etiqueta
                </p>
                <p className="text-xs text-violet-700/80">
                  Pagamento confirmado! Gera a etiqueta no Melhor Envio e faz o upload aqui.
                </p>
              </div>

              <FileUploadZone
                label="Etiqueta de Envio (PDF ou Imagem)"
                hint="Etiqueta gerada no Melhor Envio / SuperFrete"
                accept="application/pdf,image/*"
                currentUrl={localOrder.shipping_label_url}
                onUpload={(f) => handleUpload("shipping-label", f)}
                uploading={uploadingSlot === "shipping-label"}
              />

              <Button
                className="w-full gap-2"
                onClick={submitShippingLabel}
                disabled={!localOrder.shipping_label_url}
              >
                <Truck className="h-4 w-4" />
                Enviar Etiqueta ao Fornecedor
              </Button>
            </div>
          )}

          {/* ── STATE: AGUARDANDO_POSTAGEM ── */}
          {status === "aguardando_postagem" && (
            <div className="p-4">
              <div className="rounded-xl border border-indigo-300 bg-indigo-500/5 p-4 text-center space-y-2">
                <Truck className="h-8 w-8 text-indigo-600 mx-auto" />
                <p className="font-semibold text-indigo-700">Etiqueta recebida pelo fornecedor</p>
                <p className="text-xs text-indigo-600/80">
                  Aguarda o fornecedor fazer a postagem do produto. Receberás uma notificação quando o pedido for despachado.
                </p>
              </div>
            </div>
          )}

          {/* ── STATE: CONCLUIDO / completed ── */}
          {(status === "concluido" || status === "completed") && (
            <div className="p-4">
              <div className="rounded-xl border border-green-300 bg-green-500/5 p-4 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                <p className="font-semibold text-green-700">Pedido Concluído!</p>
                <p className="text-xs text-green-600/80">Produto despachado com sucesso.</p>
                {localOrder.shipping_label_url && (
                  <a href={localOrder.shipping_label_url} target="_blank" rel="noopener noreferrer">
                    <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted mt-1">
                      Ver etiqueta de envio
                    </Badge>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function HubProductCard({ product, onMirror }: { product: HubProduct; onMirror: (p: HubProduct) => void }) {
  const { cost, minSale, profit } = calcProfit(product);
  const profitPct = minSale > 0 ? Math.round((profit / minSale) * 100) : 0;
  const isGoodDeal = profitPct >= 30;

  return (
    <Card className="overflow-hidden border hover:border-primary/40 transition-all hover:shadow-md">
      <div className="flex gap-3 p-3">
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
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight line-clamp-2">{product.name}</p>
          {product.category && <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>}
          <div className="mt-2 grid grid-cols-3 gap-1 text-center">
            <div className="rounded-lg bg-muted/60 px-1 py-1.5">
              <p className="text-[10px] text-muted-foreground">Teu Custo</p>
              <p className="text-xs font-bold">R$ {cost.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-muted/60 px-1 py-1.5">
              <p className="text-[10px] text-muted-foreground">Venda Mín.</p>
              <p className="text-xs font-bold text-primary">R$ {minSale.toFixed(2)}</p>
            </div>
            <div className={cn("rounded-lg px-1 py-1.5", profit > 0 ? "bg-green-500/10" : "bg-destructive/10")}>
              <p className={cn("text-[10px]", profit > 0 ? "text-green-700" : "text-destructive")}>Lucro</p>
              <p className={cn("text-xs font-bold", profit > 0 ? "text-green-700" : "text-destructive")}>
                R$ {profit.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border/50 bg-muted/20 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] py-0">
            {product.hub_approval_type === "automatic" ? "⚡ Auto" : "🕐 Manual"}
          </Badge>
          <Badge variant="outline" className="text-[10px] py-0">{product.stock_quantity} un.</Badge>
          {profit > 0 && (
            <Badge className="text-[10px] py-0 bg-green-500/15 text-green-700 border-green-300 font-bold">
              +{profitPct}% margem
            </Badge>
          )}
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onMirror(product)}>
          <ShoppingCart className="h-3 w-3" /> Vender
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
  const handleMirrorProduct = (_product: HubProduct) => {
    toast.info("Em breve: espelhar produto na tua loja! 🚀");
  };

  const displayName = supplier?.store_name || supplier?.full_name || "Fornecedor";
  const location = supplier?.address_city && supplier?.address_state
    ? `${supplier.address_city}, ${supplier.address_state}`
    : supplier?.address_city || supplier?.address_state || null;

  const avgMargin = products.length > 0
    ? Math.round(products.reduce((s, p) => {
        const { minSale, profit } = calcProfit(p);
        return s + (minSale > 0 ? (profit / minSale) * 100 : 0);
      }, 0) / products.length)
    : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b border-border bg-sidebar flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-primary/20">
              {supplier?.logo_url ? (
                <img src={supplier.logo_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-bold leading-tight">{displayName}</SheetTitle>
              {location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {location}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-xs text-muted-foreground">Margem média</p>
              <p className={cn("text-base font-bold", avgMargin >= 30 ? "text-green-600" : "text-amber-600")}>
                {avgMargin}%
              </p>
            </div>
          </div>
          {supplier?.hub_description && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-t border-border pt-2">
              {supplier.hub_description}
            </p>
          )}
        </SheetHeader>
        <div className="flex divide-x divide-border border-b border-border flex-shrink-0">
          {[
            { label: "Produtos", value: products.length },
            { label: "Taxa plataforma", value: "Variável (calculada)" },
            { label: "PIX key", value: supplier?.pix_key ? "✓ Configurado" : "Não cadastrado" },
          ].map((s) => (
            <div key={s.label} className="flex-1 py-2.5 px-3 text-center">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-sm font-semibold">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16 px-6">
              <Package className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Nenhum produto configurado ainda.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {products.length} produto{products.length !== 1 ? "s" : ""} disponíve{products.length !== 1 ? "is" : "l"}
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
  supplier, productCount, bestMargin, onClick,
}: {
  supplier: SupplierProfile; productCount: number; bestMargin: number; onClick: () => void;
}) {
  const displayName = supplier.store_name || supplier.full_name || "Fornecedor";
  const location = supplier.address_city && supplier.address_state
    ? `${supplier.address_city} — ${supplier.address_state}`
    : supplier.address_city || supplier.address_state || null;

  return (
    <button onClick={onClick} className="w-full text-left group">
      <Card className="overflow-hidden border hover:border-primary/50 hover:shadow-lg transition-all duration-200 group-active:scale-[0.98]">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 to-primary" />
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
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
              {supplier.hub_description && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                  {supplier.hub_description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] py-0 gap-1">
                  <Package className="h-2.5 w-2.5" />
                  {productCount} produto{productCount !== 1 ? "s" : ""}
                </Badge>
                {bestMargin > 0 && (
                  <Badge variant="outline" className={cn(
                    "text-[10px] py-0 font-semibold",
                    bestMargin >= 40 ? "bg-green-500/15 text-green-700 border-green-300"
                    : bestMargin >= 20 ? "bg-amber-500/15 text-amber-700 border-amber-300"
                    : "bg-muted text-muted-foreground border-border"
                  )}>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HubVendedor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierProfile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── MARKETPLACE: fetch self-connections from all suppliers (open marketplace) ──
  // Self-connections are hub_connections where the owner registered their catalog
  // for the HUB marketplace (seller_id is null = self/public catalog connection)
  const { data: allActiveConnections = [], isLoading: loadingConn } = useQuery({
    queryKey: ["hub-vendedor-all-connections"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_connections")
        .select("id, owner_id, commission_pct")
        .eq("status", "active")
        .is("seller_id", null)          // self-connections have no seller_id
        .neq("owner_id", user!.id);     // exclude own catalog
      if (error) throw error;
      return data as { id: string; owner_id: string; commission_pct: number }[];
    },
  });

  // Fetch all HUB products that are active+configured across all connections
  const allConnectionIds = allActiveConnections.map((c) => c.id);

  const { data: supplierProfiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["hub-vendedor-suppliers-marketplace", allConnectionIds],
    enabled: allConnectionIds.length > 0,
    queryFn: async () => {
      // Get connections with at least 1 active configured product
      const { data: shared } = await supabase
        .from("hub_shared_products")
        .select("connection_id")
        .in("connection_id", allConnectionIds)
        .eq("is_active", true)
        .eq("hub_configured", true);

      const activeConnectionIds = new Set((shared ?? []).map((s) => s.connection_id));
      const connectionsWithStock = allActiveConnections.filter((c) => activeConnectionIds.has(c.id));
      if (!connectionsWithStock.length) return [];

      const ownerIds = [...new Set(connectionsWithStock.map((c) => c.owner_id))];
      const [profilesRes, storesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, address_city, address_state, hub_description").in("id", ownerIds),
        supabase.from("store_settings").select("owner_id, store_name, logo_url, pix_key").in("owner_id", ownerIds),
      ]);

      const profiles = profilesRes.data ?? [];
      const storeMap = Object.fromEntries((storesRes.data ?? []).map((s) => [s.owner_id, s]));

      // Deduplicate by owner (one card per supplier)
      const seen = new Set<string>();
      return connectionsWithStock
        .filter((conn) => { if (seen.has(conn.owner_id)) return false; seen.add(conn.owner_id); return true; })
        .map((conn) => {
          const prof = profiles.find((p) => p.id === conn.owner_id);
          const store = storeMap[conn.owner_id];
          return {
            id: conn.owner_id,
            full_name: prof?.full_name ?? null,
            address_city: (prof as any)?.address_city ?? null,
            address_state: (prof as any)?.address_state ?? null,
            hub_description: (prof as any)?.hub_description ?? null,
            store_name: store?.store_name ?? null,
            logo_url: store?.logo_url ?? null,
            pix_key: store?.pix_key ?? null,
            connection_id: conn.id,
            commission_pct: conn.commission_pct,
          } as SupplierProfile;
        });
    },
  });




  const { data: hubProducts = [], isLoading: loadingHubProducts } = useQuery({
    queryKey: ["hub-vendedor-products-marketplace", allConnectionIds],
    enabled: allConnectionIds.length > 0,
    queryFn: async () => {
      const { data: shared, error } = await supabase
        .from("hub_shared_products")
        .select("id, product_id, connection_id, hub_pricing_mode, hub_fixed_cost, hub_minimum_sale_price, hub_commission_rate, hub_approval_type")
        .in("connection_id", allConnectionIds)
        .eq("is_active", true)
        .eq("hub_configured", true);
      if (error) throw error;
      if (!shared?.length) return [];
      const productIds = [...new Set(shared.map((s) => s.product_id))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, cost_price, image_url, category, stock_quantity, owner_id")
        .in("id", productIds)
        .eq("is_active", true);
      const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]));
      return shared.map((s) => {
        const prod = productMap[s.product_id];
        if (!prod) return null;
        return {
          id: s.id, product_id: s.product_id, name: prod.name, price: prod.price,
          cost_price: prod.cost_price, image_url: prod.image_url, category: prod.category,
          stock_quantity: prod.stock_quantity, hub_pricing_mode: s.hub_pricing_mode as "fixed" | "commission",
          hub_fixed_cost: s.hub_fixed_cost ?? 0, hub_minimum_sale_price: s.hub_minimum_sale_price ?? 0,
          hub_commission_rate: s.hub_commission_rate ?? 0,
          hub_approval_type: s.hub_approval_type as "manual" | "automatic",
          connection_id: s.connection_id, owner_id: prod.owner_id,
        } as HubProduct;
      }).filter(Boolean) as HubProduct[];
    },
  });

  const { data: pendingOrders = [], isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["hub-vendedor-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("hub_pending_orders")
        .select("id, connection_id, seller_id, owner_id, customer_name, total, status, shipping_label_url, supplier_receipt_url, platform_receipt_url, collection_instructions, created_at")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!orders?.length) return [];
      const orderIds = orders.map((o) => o.id);
      const ownerIdsInOrders = [...new Set(orders.map((o) => o.owner_id))];
      const [{ data: items }, { data: orderProfiles }, { data: orderStores }] = await Promise.all([
        supabase.from("hub_pending_order_items").select("id, order_id, product_name, variant_size, quantity, unit_price, status, rejection_reason").in("order_id", orderIds),
        supabase.from("profiles").select("id, full_name").in("id", ownerIdsInOrders),
        supabase.from("store_settings").select("owner_id, store_name, pix_key").in("owner_id", ownerIdsInOrders),
      ]);
      const storeMap = Object.fromEntries((orderStores ?? []).map((s) => [s.owner_id, s]));
      const profileMap = Object.fromEntries((orderProfiles ?? []).map((p) => [p.id, p.full_name]));
      return orders.map((o) => ({
        ...o,
        supplier_name: storeMap[o.owner_id]?.store_name || profileMap[o.owner_id] || "Fornecedor",
        supplier_pix_key: storeMap[o.owner_id]?.pix_key ?? null,
        items: (items ?? []).filter((i) => i.order_id === o.id).map((i) => ({
          id: i.id, product_name: i.product_name, variant_size: i.variant_size,
          quantity: i.quantity, unit_price: i.unit_price, status: i.status,
          rejection_reason: i.rejection_reason,
        })),
      })) as PendingOrder[];
    },
  });

  const productsBySupplier = supplierProfiles.reduce((acc, s) => {
    acc[s.id] = hubProducts.filter((p) => p.owner_id === s.id);
    return acc;
  }, {} as Record<string, HubProduct[]>);

  function getBestMargin(products: HubProduct[]) {
    if (!products.length) return 0;
    return Math.max(...products.map((p) => {
      const { minSale, profit } = calcProfit(p);
      return minSale > 0 ? Math.round((profit / minSale) * 100) : 0;
    }));
  }

  const pendingCount = pendingOrders.filter((o) => ["pending", "aguardando_pagamento", "approved", "aguardando_etiqueta"].includes(o.status)).length;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <ShoppingBasket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">HUB Vendedor</h1>
            <p className="text-muted-foreground text-sm">Explore fornecedores parceiros e acompanhe os teus pedidos B2B.</p>
          </div>
        </div>

        <Tabs defaultValue="explorar">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="explorar" className="flex-1 sm:flex-none gap-1.5">
              <Store className="h-4 w-4" /> Explorar Fornecedores
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex-1 sm:flex-none gap-1.5">
              <Inbox className="h-4 w-4" /> Meus Pedidos B2B
              {pendingCount > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">{pendingCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Explorar ── */}
          <TabsContent value="explorar" className="mt-4">
            {loadingConn || loadingProfiles || loadingHubProducts ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1,2,3,4].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="h-1.5 bg-muted rounded-t-lg" />
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-xl bg-muted flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-muted rounded" />
                          <div className="h-3 w-1/2 bg-muted rounded" />
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
                  <p className="font-semibold text-muted-foreground">Nenhum fornecedor disponível</p>
                  <p className="text-sm text-muted-foreground/70 max-w-xs">
                    Ainda não há fornecedores com produtos ativos no HUB. Configura o teu HUB Fornecedor para aparecer aqui.
                  </p>
                </div>
              </Card>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {supplierProfiles.length} fornecedor{supplierProfiles.length !== 1 ? "es" : ""} · {hubProducts.length} produto{hubProducts.length !== 1 ? "s" : ""}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {supplierProfiles.map((supplier) => (
                    <SupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      productCount={(productsBySupplier[supplier.id] ?? []).length}
                      bestMargin={getBestMargin(productsBySupplier[supplier.id] ?? [])}
                      onClick={() => { setSelectedSupplier(supplier); setSheetOpen(true); }}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Pedidos B2B ── */}
          <TabsContent value="pedidos" className="mt-4 space-y-3">
            {loadingOrders ? (
              <div className="space-y-3">
                {[1,2].map((i) => (
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
                    Explora os fornecedores e cria o teu primeiro pedido B2B.
                  </p>
                </div>
              </Card>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { keys: ["pending"],              label: "Aguardando",  cls: "bg-amber-500/10 text-amber-700 border-amber-300" },
                    { keys: ["aguardando_pagamento", "approved"], label: "Pagamento",   cls: "bg-orange-500/10 text-orange-700 border-orange-300" },
                    { keys: ["pagamento_em_analise"], label: "Em Análise",  cls: "bg-blue-500/10 text-blue-700 border-blue-300" },
                    { keys: ["aguardando_etiqueta"],  label: "Etiqueta",    cls: "bg-violet-500/10 text-violet-700 border-violet-300" },
                    { keys: ["aguardando_postagem"],  label: "Postagem",    cls: "bg-indigo-500/10 text-indigo-700 border-indigo-300" },
                    { keys: ["concluido", "completed"], label: "Concluídos", cls: "bg-green-500/10 text-green-700 border-green-300" },
                    { keys: ["rejected"],             label: "Recusados",   cls: "bg-destructive/10 text-destructive border-destructive/30" },
                  ].map((s) => {
                    const count = pendingOrders.filter((o) => s.keys.includes(o.status)).length;
                    if (!count) return null;
                    return (
                      <Badge key={s.label} variant="outline" className={cn("text-xs", s.cls)}>
                        {count} {s.label}
                      </Badge>
                    );
                  })}
                </div>
                {pendingOrders.map((order) => (
                  <BuyerOrderCard key={order.id} order={order} onRefresh={() => refetchOrders()} />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <SupplierSheet
        supplier={selectedSupplier}
        products={selectedSupplier ? (productsBySupplier[selectedSupplier.id] ?? []) : []}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedSupplier(null); }}
      />
    </MainLayout>
  );
}
