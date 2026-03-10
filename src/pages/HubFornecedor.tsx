import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Building2, Package, Inbox, TrendingUp, DollarSign, Percent,
  AlertCircle, CheckCircle2, XCircle, Truck, Clock, Eye,
  SlidersHorizontal, Settings2, Filter, ChevronDown, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  StatusBadge, OrderTimeline,
  FileUploadZone, uploadOrderFile,
} from "@/components/hub/HubOrderShared";
import { calcHubFee, HUB_DEFAULT_FEE_VALUE } from "@/hooks/useHubFeeCalculator";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number | null;
  stock_quantity: number;
  image_url: string | null;
  category: string | null;
  is_active: boolean;
}

interface HubSharedProduct {
  id: string;
  product_id: string;
  is_active: boolean;
  hub_configured: boolean;
  hub_approval_type: "manual" | "automatic";
  hub_pricing_mode: "fixed" | "commission";
  hub_fixed_cost: number;
  hub_minimum_sale_price: number;
  hub_commission_rate: number;
}

interface RulesForm {
  hub_approval_type: "manual" | "automatic";
  hub_pricing_mode: "fixed" | "commission";
  hub_fixed_cost: string;
  hub_minimum_sale_price: string;
  hub_commission_rate: string;
}

interface SupplierOrder {
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
  created_at: string;
  items?: SupplierOrderItem[];
  seller_name?: string;
}

interface SupplierOrderItem {
  id: string;
  product_name: string;
  variant_size: string | null;
  quantity: number;
  unit_price: number;
  status: string;
  rejection_reason: string | null;
}

const DEFAULT_FORM: RulesForm = {
  hub_approval_type: "automatic",
  hub_pricing_mode: "fixed",
  hub_fixed_cost: "",
  hub_minimum_sale_price: "",
  hub_commission_rate: "",
};

// ─── Financial Simulation ─────────────────────────────────────────────────────
function FinancialSimulation({ form }: { form: RulesForm }) {
  const fixedCost = parseFloat(form.hub_fixed_cost) || 0;
  const minSalePrice = parseFloat(form.hub_minimum_sale_price) || 0;
  const commissionRate = parseFloat(form.hub_commission_rate) || 0;

  const isFixed = form.hub_pricing_mode === "fixed";
  const grossCommission = isFixed ? fixedCost : (minSalePrice * commissionRate) / 100;
  const hubFee = calcHubFee({ costPrice: grossCommission }).feeAmount;
  const netReceived = grossCommission - hubFee;
  const hasData = isFixed ? fixedCost > 0 : (minSalePrice > 0 && commissionRate > 0);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-semibold text-primary flex items-center gap-2">
        <TrendingUp className="h-4 w-4" /> Simulação Financeira
      </p>
      <div className="space-y-1 text-sm">
        {!isFixed && (
          <div className="flex justify-between text-muted-foreground">
            <span>Preço Mínimo de Venda</span>
            <span className="font-medium text-foreground">{minSalePrice > 0 ? `R$ ${minSalePrice.toFixed(2)}` : "—"}</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>{isFixed ? "Custo ao Vendedor" : `Tua comissão (${commissionRate}%)`}</span>
          <span className="font-medium text-foreground">{hasData ? `R$ ${grossCommission.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Taxa Venda PROFIT (calculada)</span>
          <span className="font-medium text-destructive">- R$ {hubFee.toFixed(2)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-base">
          <span>Você vai receber</span>
          <span className={netReceived > 0 ? "text-green-600" : "text-muted-foreground"}>
            {hasData ? `R$ ${netReceived.toFixed(2)}` : "—"}
          </span>
        </div>
        {hasData && netReceived <= 0 && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> O valor deve cobrir a taxa da plataforma (R$ {hubFee.toFixed(2)}).
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Hub Rules Dialog (single or bulk) ───────────────────────────────────────
async function getOrCreateSelfConnection(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("hub_connections")
    .select("id")
    .eq("owner_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("hub_connections")
    .insert({ owner_id: userId, invited_email: "hub-catalog@vendaprofit.internal", status: "active", commission_pct: 0, auto_share_all: false })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

function HubRulesDialog({
  open, onClose, product, existing, onSaved,
  // Bulk mode: pass selectedIds + all hubEntries
  bulkMode, selectedProductIds, allHubEntries,
}: {
  open: boolean; onClose: () => void;
  product?: Product | null;
  existing?: HubSharedProduct | null;
  onSaved: () => void;
  bulkMode?: boolean;
  selectedProductIds?: string[];
  allHubEntries?: HubSharedProduct[];
  allProducts?: Product[];
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<RulesForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bulkMode && existing) {
      setForm({
        hub_approval_type: existing.hub_approval_type,
        hub_pricing_mode: existing.hub_pricing_mode,
        hub_fixed_cost: existing.hub_fixed_cost?.toString() || "",
        hub_minimum_sale_price: existing.hub_minimum_sale_price?.toString() || "",
        hub_commission_rate: existing.hub_commission_rate?.toString() || "",
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [existing, open, bulkMode]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        hub_approval_type: form.hub_approval_type,
        hub_pricing_mode: form.hub_pricing_mode,
        hub_fixed_cost: parseFloat(form.hub_fixed_cost) || 0,
        hub_minimum_sale_price: parseFloat(form.hub_minimum_sale_price) || 0,
        hub_commission_rate: parseFloat(form.hub_commission_rate) || 0,
        hub_configured: true,
        is_active: true,
      };

      if (bulkMode && selectedProductIds && allHubEntries) {
        // Separate products into already-configured vs new
        const hubMap = Object.fromEntries(allHubEntries.map((e) => [e.product_id, e]));
        const toUpdate = selectedProductIds.filter((pid) => hubMap[pid]);
        const toInsert = selectedProductIds.filter((pid) => !hubMap[pid]);

        const connId = await getOrCreateSelfConnection(user.id);

        await Promise.all([
          toUpdate.length > 0
            ? supabase.from("hub_shared_products").update(payload).in("id", toUpdate.map((pid) => hubMap[pid].id))
            : Promise.resolve(),
          toInsert.length > 0
            ? supabase.from("hub_shared_products").insert(
                toInsert.map((pid) => ({ product_id: pid, ...payload, connection_id: connId }))
              )
            : Promise.resolve(),
        ]);
        toast.success(`Regras aplicadas em ${selectedProductIds.length} produto(s)!`);
      } else if (!bulkMode && product) {
        if (existing) {
          const { error } = await supabase.from("hub_shared_products").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("hub_shared_products").insert({
            product_id: product.id, ...payload,
            connection_id: await getOrCreateSelfConnection(user.id),
          });
          if (error) throw error;
        }
        toast.success("Regras salvas!");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const title = bulkMode
    ? `Configurar Regras HUB — ${selectedProductIds?.length ?? 0} produto(s)`
    : `Configurar Regras HUB — ${product?.name ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {bulkMode && (
            <div className="rounded-lg border border-amber-300 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-700 font-medium">
                ⚠️ As regras definidas abaixo serão aplicadas a <strong>todos os {selectedProductIds?.length} produtos selecionados</strong>, substituindo as configurações existentes.
              </p>
            </div>
          )}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Tipo de Aprovação</Label>
            <RadioGroup
              value={form.hub_approval_type}
              onValueChange={(v) => setForm((f) => ({ ...f, hub_approval_type: v as "manual" | "automatic" }))}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { value: "automatic", label: "Aprovação Automática", desc: "Pedidos aprovados instantaneamente" },
                { value: "manual", label: "Aprovação Manual", desc: "Você revisa cada pedido" },
              ].map((opt) => (
                <div key={opt.value} className={cn("relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-all",
                  form.hub_approval_type === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                )}>
                  <RadioGroupItem value={opt.value} id={`approval-${opt.value}`} className="sr-only" />
                  <Label htmlFor={`approval-${opt.value}`} className="cursor-pointer font-medium text-sm">{opt.label}</Label>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </div>
              ))}
            </RadioGroup>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Modelo de Ganhos</Label>
            <RadioGroup
              value={form.hub_pricing_mode}
              onValueChange={(v) => setForm((f) => ({ ...f, hub_pricing_mode: v as "fixed" | "commission" }))}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { value: "fixed", label: "Valor Fixo", desc: "Cobro um custo fixo ao vendedor", icon: DollarSign },
                { value: "commission", label: "% de Comissão", desc: "Recebo % sobre a venda", icon: Percent },
              ].map((opt) => (
                <div key={opt.value} className={cn("relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-all",
                  form.hub_pricing_mode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                )}>
                  <RadioGroupItem value={opt.value} id={`mode-${opt.value}`} className="sr-only" />
                  <Label htmlFor={`mode-${opt.value}`} className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                    <opt.icon className="h-3.5 w-3.5" /> {opt.label}
                  </Label>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </div>
              ))}
            </RadioGroup>
          </div>
          {form.hub_pricing_mode === "fixed" && (
            <div className="space-y-1.5">
              <Label htmlFor="hub_fixed_cost" className="text-sm">Custo para o Vendedor (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input id="hub_fixed_cost" type="number" min="0" step="0.01" placeholder="0,00" className="pl-9"
                  value={form.hub_fixed_cost} onChange={(e) => setForm((f) => ({ ...f, hub_fixed_cost: e.target.value }))} />
              </div>
            </div>
          )}
          {form.hub_pricing_mode === "commission" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Preço Mínimo de Venda (R$) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input type="number" min="0" step="0.01" placeholder="0,00" className="pl-9"
                    value={form.hub_minimum_sale_price} onChange={(e) => setForm((f) => ({ ...f, hub_minimum_sale_price: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Tua % de Comissão *</Label>
                <div className="relative">
                  <Input type="number" min="0" max="100" step="0.1" placeholder="Ex: 30" className="pr-9"
                    value={form.hub_commission_rate} onChange={(e) => setForm((f) => ({ ...f, hub_commission_rate: e.target.value }))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            </div>
          )}
          <FinancialSimulation form={form} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : bulkMode ? `Aplicar em ${selectedProductIds?.length} produto(s)` : "Salvar Regras"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Row (Meus Produtos com checkbox) ──────────────────────────────────
function ProductRow({
  product, hubEntry, onConfigure, onToggle, selected, onSelect,
}: {
  product: Product; hubEntry: HubSharedProduct | null;
  onConfigure: () => void; onToggle: (enabled: boolean) => void;
  selected: boolean; onSelect: (checked: boolean) => void;
}) {
  const isEnabled = hubEntry?.is_active ?? false;
  const isConfigured = hubEntry?.hub_configured ?? false;
  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-md", selected && "ring-2 ring-primary/40")}>
      <div className="flex gap-3 p-3 items-center">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelect(!!v)}
          className="flex-shrink-0 mt-1"
          aria-label={`Selecionar ${product.name}`}
        />
        <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-muted overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{product.name}</p>
              {product.category && <p className="text-xs text-muted-foreground">{product.category}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm font-bold text-primary">R$ {product.price.toFixed(2)}</span>
                <Badge variant="outline" className="text-xs py-0">{product.stock_quantity} un.</Badge>
                {isEnabled && isConfigured && (
                  <Badge className="text-xs py-0 bg-green-500/15 text-green-700 border-green-300">
                    {hubEntry?.hub_pricing_mode === "fixed"
                      ? `Custo R$ ${hubEntry.hub_fixed_cost?.toFixed(2)}`
                      : `${hubEntry?.hub_commission_rate}% comissão`}
                  </Badge>
                )}
                {isEnabled && !isConfigured && (
                  <Badge variant="outline" className="text-xs py-0 text-amber-600 border-amber-300">Sem regras</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => {
                  if (checked && !isConfigured) onConfigure();
                  else onToggle(checked);
                }}
              />
              <span className="text-[10px] text-muted-foreground">{isEnabled ? "Ativo" : "Inativo"}</span>
            </div>
          </div>
          {isEnabled && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs mt-1.5 text-primary hover:text-primary" onClick={onConfigure}>
              {isConfigured ? "Editar Regras" : "Configurar Regras"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Supplier Order Card (Pedidos Recebidos) ──────────────────────────────────
function SupplierOrderCard({
  order, onRefresh,
}: {
  order: SupplierOrder; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [uploadingLabel, setUploadingLabel] = useState(false);
  const [localOrder, setLocalOrder] = useState(order);

  if (order.id !== localOrder.id) setLocalOrder(order);

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from("hub_pending_orders")
      .update({ status: newStatus })
      .eq("id", order.id);
    if (error) throw error;
    setLocalOrder((p) => ({ ...p, status: newStatus }));
    onRefresh();
  };

  const handleApprove = async () => {
    try {
      await updateStatus("aguardando_pagamento");
      toast.success("Pedido aprovado! O vendedor será notificado para efectuar o pagamento.");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error("Informe o motivo da recusa."); return; }
    try {
      const { error } = await supabase
        .from("hub_pending_orders")
        .update({ status: "rejected" })
        .eq("id", order.id);
      if (error) throw error;
      setLocalOrder((p) => ({ ...p, status: "rejected" }));
      setRejecting(false);
      setRejectReason("");
      onRefresh();
      toast.success("Pedido recusado.");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleConfirmPayment = async () => {
    try {
      await updateStatus("aguardando_etiqueta");
      toast.success("Pagamento confirmado! O vendedor já pode enviar a etiqueta.");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDispatch = async () => {
    try {
      await updateStatus("concluido");
      toast.success("Produto despachado! Pedido concluído.");
    } catch (err: any) { toast.error(err.message); }
  };

  const status = localOrder.status;
  const isRejected = status === "rejected";

  return (
    <>
      <Card className={cn("overflow-hidden border transition-all", isRejected && "opacity-75")}>
        <button
          className="w-full text-left p-4 hover:bg-muted/20 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">
                {localOrder.seller_name || "Vendedor"}
                {localOrder.customer_name && (
                  <span className="font-normal text-muted-foreground"> → {localOrder.customer_name}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(order.created_at).toLocaleDateString("pt-BR")}
              </p>
              <p className="text-base font-bold text-primary mt-1">R$ {localOrder.total.toFixed(2)}</p>
            </div>
            <StatusBadge status={status} />
          </div>
        </button>

        {!isRejected && (
          <div className="px-4 pb-3">
            <OrderTimeline status={status} />
          </div>
        )}

        {isRejected && (
          <div className="mx-4 mb-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex gap-2">
            <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">Pedido recusado.</p>
          </div>
        )}

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
                    <p className="font-semibold flex-shrink-0 ml-2">{item.quantity}× R$ {item.unit_price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── PENDING: Approve / Reject ── */}
            {status === "pending" && (
              <div className="p-4 space-y-3">
                <div className="rounded-xl border border-amber-300 bg-amber-500/5 p-3">
                  <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Aguardando sua aprovação
                  </p>
                  <p className="text-xs text-amber-700/80">Este produto requer aprovação manual.</p>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={handleApprove}>
                    <CheckCircle2 className="h-4 w-4" /> Aprovar Pedido
                  </Button>
                  <Button variant="destructive" className="flex-1 gap-2" onClick={() => setRejecting(true)}>
                    <XCircle className="h-4 w-4" /> Recusar
                  </Button>
                </div>
              </div>
            )}

            {/* ── PAGAMENTO_EM_ANALISE: review proofs ── */}
            {status === "pagamento_em_analise" && (
              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-blue-300 bg-blue-500/5 p-3">
                  <p className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> Comprovativos recebidos — confirme o pagamento
                  </p>
                  <p className="text-xs text-blue-700/80">O vendedor enviou os comprovativos. Confirme se os pagamentos foram recebidos.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { url: localOrder.supplier_receipt_url, label: "Comprovativo Fornecedor" },
                    { url: localOrder.platform_receipt_url, label: "Comprovativo Plataforma" },
                  ].map((receipt) => (
                    <div key={receipt.label} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                      <p className="text-xs font-semibold">{receipt.label}</p>
                      {receipt.url ? (
                        receipt.url.toLowerCase().endsWith(".pdf") ? (
                          <a href={receipt.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary underline">
                            Abrir PDF
                          </a>
                        ) : (
                          <a href={receipt.url} target="_blank" rel="noopener noreferrer">
                            <img src={receipt.url} alt={receipt.label} className="w-full max-h-32 rounded-lg object-contain bg-muted" />
                          </a>
                        )
                      ) : (
                        <p className="text-xs text-muted-foreground">Não anexado</p>
                      )}
                    </div>
                  ))}
                </div>
                <Button className="w-full gap-2" onClick={handleConfirmPayment}>
                  <CheckCircle2 className="h-4 w-4" /> Confirmar Recebimento do Pagamento
                </Button>
              </div>
            )}

            {/* ── AGUARDANDO_POSTAGEM: download label + dispatch ── */}
            {status === "aguardando_postagem" && (
              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-indigo-300 bg-indigo-500/5 p-3">
                  <p className="text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" /> Etiqueta recebida — pronto para despachar
                  </p>
                  <p className="text-xs text-indigo-700/80">O vendedor enviou a etiqueta. Descarregue, embale e despache o produto.</p>
                </div>
                {localOrder.shipping_label_url ? (
                  <a href={localOrder.shipping_label_url} target="_blank" rel="noopener noreferrer" className="flex w-full">
                    <Button variant="outline" className="w-full gap-2">
                      <Truck className="h-4 w-4" /> Descarregar Etiqueta PDF
                    </Button>
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">Etiqueta ainda não disponível.</p>
                )}
                <Button className="w-full gap-2" onClick={handleDispatch}>
                  <CheckCircle2 className="h-4 w-4" /> Produto Despachado ✓
                </Button>
              </div>
            )}

            {/* ── CONCLUIDO ── */}
            {(status === "concluido" || status === "completed") && (
              <div className="p-4">
                <div className="rounded-xl border border-green-300 bg-green-500/5 p-4 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="font-semibold text-green-700">Pedido Concluído!</p>
                  <p className="text-xs text-green-600/80">Produto despachado com sucesso.</p>
                </div>
              </div>
            )}

            {/* ── AGUARDANDO_PAGAMENTO ── */}
            {(status === "aguardando_pagamento" || status === "approved") && (
              <div className="p-4">
                <div className="rounded-xl border border-orange-300 bg-orange-500/5 p-4 text-center space-y-2">
                  <Clock className="h-8 w-8 text-orange-600 mx-auto" />
                  <p className="font-semibold text-orange-700">Aguardando pagamento do vendedor</p>
                  <p className="text-xs text-orange-600/80">O vendedor foi notificado e está a preparar o pagamento PIX.</p>
                </div>
              </div>
            )}

            {/* ── AGUARDANDO_ETIQUETA ── */}
            {status === "aguardando_etiqueta" && (
              <div className="p-4">
                <div className="rounded-xl border border-violet-300 bg-violet-500/5 p-4 text-center space-y-2">
                  <Truck className="h-8 w-8 text-violet-600 mx-auto" />
                  <p className="font-semibold text-violet-700">Aguardando etiqueta de envio</p>
                  <p className="text-xs text-violet-600/80">Pagamento confirmado. O vendedor está a gerar e enviar a etiqueta.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Reject Dialog */}
      <AlertDialog open={rejecting} onOpenChange={setRejecting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da recusa. O vendedor será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Ex: produto esgotado, preço desatualizado..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRejecting(false); setRejectReason(""); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleReject}
            >
              Recusar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HubFornecedor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Single-product dialog
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [configExisting, setConfigExisting] = useState<HubSharedProduct | null>(null);

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkToggling, setBulkToggling] = useState(false);

  const bulkToggleActive = async (activate: boolean) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkToggling(true);
    try {
      // Only update products that already have a hub_shared_products entry
      const existingIds = ids.filter((pid) => hubByProductId[pid]);
      if (existingIds.length > 0) {
        const { error } = await supabase
          .from("hub_shared_products")
          .update({ is_active: activate })
          .in("product_id", existingIds);
        if (error) throw error;
      }

      // For products without a hub entry, we need to create one first via getOrCreateSelfConnection
      const newIds = ids.filter((pid) => !hubByProductId[pid]);
      if (newIds.length > 0) {
        const connId = await getOrCreateSelfConnection(user!.id);
        const inserts = newIds.map((pid) => ({
          product_id: pid,
          connection_id: connId,
          is_active: activate,
          hub_configured: false,
          hub_approval_type: "automatic" as const,
          hub_pricing_mode: "fixed" as const,
          hub_fixed_cost: 0,
          hub_minimum_sale_price: 0,
          hub_commission_rate: 0,
        }));
        const { error } = await supabase.from("hub_shared_products").insert(inserts);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["hub-fornecedor-entries"] });
      toast.success(`${ids.length} produto${ids.length !== 1 ? "s" : ""} ${activate ? "ativado" : "inativado"}${ids.length !== 1 ? "s" : ""} no HUB`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error("Erro ao atualizar produtos: " + err.message);
    } finally {
      setBulkToggling(false);
    }
  };


  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterHubStatus, setFilterHubStatus] = useState<string>("all");

  // Description / PIX settings
  const [hubDescription, setHubDescription] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: settingsData } = useQuery({
    queryKey: ["hub-fornecedor-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, storeRes] = await Promise.all([
        supabase.from("profiles").select("hub_description").eq("id", user!.id).maybeSingle(),
        supabase.from("store_settings").select("pix_key").eq("owner_id", user!.id).maybeSingle(),
      ]);
      return {
        hub_description: (profileRes.data as any)?.hub_description ?? "",
        pix_key: storeRes.data?.pix_key ?? "",
      };
    },
  });

  useEffect(() => {
    if (settingsData) {
      setHubDescription(settingsData.hub_description || "");
      setPixKey(settingsData.pix_key || "");
    }
  }, [settingsData]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      await Promise.all([
        supabase.from("profiles").update({ hub_description: hubDescription } as any).eq("id", user.id),
        supabase.from("store_settings").upsert({ owner_id: user.id, pix_key: pixKey } as any, { onConflict: "owner_id" }),
      ]);
      toast.success("Configurações salvas!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["hub-fornecedor-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, stock_quantity, image_url, category, is_active")
        .eq("owner_id", user!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: hubEntries = [] } = useQuery({
    queryKey: ["hub-fornecedor-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: connections } = await supabase
        .from("hub_connections")
        .select("id")
        .eq("owner_id", user!.id);
      if (!connections?.length) return [];
      const { data, error } = await supabase
        .from("hub_shared_products")
        .select("id, product_id, is_active, hub_configured, hub_approval_type, hub_pricing_mode, hub_fixed_cost, hub_minimum_sale_price, hub_commission_rate")
        .in("connection_id", connections.map((c) => c.id));
      if (error) throw error;
      return data as HubSharedProduct[];
    },
  });

  // Load supplier orders (where user is owner)
  const { data: supplierOrders = [], isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["hub-fornecedor-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("hub_pending_orders")
        .select("id, connection_id, seller_id, owner_id, customer_name, total, status, shipping_label_url, supplier_receipt_url, platform_receipt_url, created_at")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!orders?.length) return [];
      const orderIds = orders.map((o) => o.id);
      const sellerIds = [...new Set(orders.map((o) => o.seller_id).filter(Boolean))] as string[];
      const [{ data: items }, { data: sellerProfiles }, { data: sellerStores }] = await Promise.all([
        supabase.from("hub_pending_order_items").select("id, order_id, product_name, variant_size, quantity, unit_price, status, rejection_reason").in("order_id", orderIds),
        supabase.from("profiles").select("id, full_name").in("id", sellerIds),
        supabase.from("store_settings").select("owner_id, store_name").in("owner_id", sellerIds),
      ]);
      const storeMap = Object.fromEntries((sellerStores ?? []).map((s) => [s.owner_id, s.store_name]));
      const profileMap = Object.fromEntries((sellerProfiles ?? []).map((p) => [p.id, p.full_name]));
      return orders.map((o) => ({
        ...o,
        seller_name: storeMap[o.seller_id ?? ""] || profileMap[o.seller_id ?? ""] || "Vendedor",
        items: (items ?? []).filter((i) => i.order_id === o.id).map((i) => ({
          id: i.id, product_name: i.product_name, variant_size: i.variant_size,
          quantity: i.quantity, unit_price: i.unit_price, status: i.status,
          rejection_reason: i.rejection_reason,
        })),
      })) as SupplierOrder[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ productId, enabled }: { productId: string; enabled: boolean }) => {
      const entry = hubByProductId[productId];
      if (!entry) return;
      const { error } = await supabase.from("hub_shared_products").update({ is_active: enabled }).eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hub-fornecedor-entries"] }),
    onError: (err: any) => toast.error(err.message),
  });

  const hubByProductId = Object.fromEntries(hubEntries.map((e) => [e.product_id, e]));
  const activeCount = hubEntries.filter((e) => e.is_active).length;
  const pendingOrdersCount = supplierOrders.filter((o) => o.status === "pending").length;
  const reviewPaymentCount = supplierOrders.filter((o) => o.status === "pagamento_em_analise").length;
  const actionNeeded = pendingOrdersCount + reviewPaymentCount;

  // Unique categories for filter
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const hubEntry = hubByProductId[p.id];
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterHubStatus === "active" && !(hubEntry?.is_active)) return false;
    if (filterHubStatus === "inactive" && hubEntry?.is_active) return false;
    return true;
  });

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">HUB Fornecedor</h1>
            <p className="text-muted-foreground text-sm">Disponibilize produtos e gira os pedidos dos teus revendedores.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Produtos Ativos</p>
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Pedidos Pendentes</p>
            <p className={cn("text-2xl font-bold", actionNeeded > 0 ? "text-amber-600" : "text-foreground")}>
              {supplierOrders.length}
            </p>
          </Card>
          <Card className="p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Taxa Plataforma</p>
            <p className="text-2xl font-bold text-amber-600">R$ {HUB_DEFAULT_FEE_VALUE.toFixed(2)}</p>
          </Card>
        </div>

        <Tabs defaultValue="produtos">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="produtos" className="flex-1 sm:flex-none gap-1.5">
              <Package className="h-4 w-4" /> Meus Produtos Disponíveis
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex-1 sm:flex-none gap-1.5">
              <Inbox className="h-4 w-4" /> Pedidos Recebidos
              {actionNeeded > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">{actionNeeded}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="flex-1 sm:flex-none gap-1.5">
              <Settings2 className="h-4 w-4" /> Configurações
            </TabsTrigger>
          </TabsList>

          {/* ── Products Tab ── */}
          <TabsContent value="produtos" className="mt-4 space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                <Filter className="h-3.5 w-3.5" /> Filtros:
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterHubStatus} onValueChange={setFilterHubStatus}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="Status HUB" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos no HUB</SelectItem>
                  <SelectItem value="inactive">Inativos no HUB</SelectItem>
                </SelectContent>
              </Select>
              {(filterCategory !== "all" || filterHubStatus !== "all") && (
                <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setFilterCategory("all"); setFilterHubStatus("all"); }}>
                  Limpar
                </Button>
              )}
            </div>

            {/* Bulk select header */}
            {filteredProducts.length > 0 && (
              <div className="flex items-center gap-3 px-1">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos"
                />
                <span className="text-xs text-muted-foreground">
                  {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
                  {" "}({filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""})
                </span>
              </div>
            )}

            {loadingProducts ? (
              <div className="space-y-3">
                {[1,2,3,4].map((i) => (
                  <Card key={i} className="p-3 animate-pulse">
                    <div className="flex gap-3">
                      <div className="h-5 w-5 rounded bg-muted" />
                      <div className="h-14 w-14 rounded-lg bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-muted" />
                        <div className="h-3 w-1/2 rounded bg-muted" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <Card className="py-16 text-center">
                <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">Nenhum produto encontrado</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    hubEntry={hubByProductId[product.id] ?? null}
                    selected={selectedIds.has(product.id)}
                    onSelect={(checked) => toggleSelect(product.id, checked)}
                    onConfigure={() => { setConfigProduct(product); setConfigExisting(hubByProductId[product.id] ?? null); }}
                    onToggle={(enabled) => toggleMutation.mutate({ productId: product.id, enabled })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Orders Tab ── */}
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
            ) : supplierOrders.length === 0 ? (
              <Card className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 px-6">
                  <div className="rounded-full bg-muted p-4">
                    <Inbox className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="font-semibold text-muted-foreground">Nenhum pedido recebido</p>
                  <p className="text-sm text-muted-foreground/70 max-w-xs">
                    Quando revendedores fizerem pedidos dos teus produtos, aparecerão aqui.
                  </p>
                </div>
              </Card>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { keys: ["pending"],              label: "Aprovação",    cls: "bg-amber-500/10 text-amber-700 border-amber-300" },
                    { keys: ["aguardando_pagamento", "approved"], label: "Pagamento", cls: "bg-orange-500/10 text-orange-700 border-orange-300" },
                    { keys: ["pagamento_em_analise"], label: "Análise",      cls: "bg-blue-500/10 text-blue-700 border-blue-300" },
                    { keys: ["aguardando_etiqueta"],  label: "Etiqueta",     cls: "bg-violet-500/10 text-violet-700 border-violet-300" },
                    { keys: ["aguardando_postagem"],  label: "Postagem",     cls: "bg-indigo-500/10 text-indigo-700 border-indigo-300" },
                    { keys: ["concluido", "completed"], label: "Concluídos", cls: "bg-green-500/10 text-green-700 border-green-300" },
                  ].map((s) => {
                    const count = supplierOrders.filter((o) => s.keys.includes(o.status)).length;
                    if (!count) return null;
                    return (
                      <Badge key={s.label} variant="outline" className={cn("text-xs", s.cls)}>
                        {count} {s.label}
                      </Badge>
                    );
                  })}
                </div>
                {supplierOrders.map((order) => (
                  <SupplierOrderCard key={order.id} order={order} onRefresh={() => refetchOrders()} />
                ))}
              </>
            )}
          </TabsContent>

          {/* ── Configurações Tab ── */}
          <TabsContent value="configuracoes" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-5">
                <div>
                  <h3 className="font-semibold text-sm mb-1">Configurações do HUB Fornecedor</h3>
                  <p className="text-xs text-muted-foreground">Estas informações são exibidas aos revendedores no catálogo B2B.</p>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <Label htmlFor="hub-description" className="text-sm font-medium">
                    Descrição da Loja <span className="text-muted-foreground font-normal">(Atraia Vendedores)</span>
                  </Label>
                  <Textarea
                    id="hub-description"
                    placeholder="Ex: Especialista em moda feminina plus size. Despacho em até 48h. Aceitamos trocas em até 30 dias. Mais de 500 revendedores ativos em todo o Brasil..."
                    value={hubDescription}
                    onChange={(e) => setHubDescription(e.target.value)}
                    className="min-h-[110px] resize-none"
                    maxLength={500}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{hubDescription.length}/500 caracteres</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pix-key" className="text-sm font-medium">
                    Chave PIX para Recebimentos
                  </Label>
                  <Input
                    id="pix-key"
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Esta chave será exibida ao revendedor para efetuar o pagamento dos pedidos.</p>
                </div>
                <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full sm:w-auto">
                  {savingSettings ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Floating Bulk Action Bar ── */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-background shadow-2xl px-4 py-3 min-w-[320px] max-w-[95vw] flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[120px]">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-foreground">{selectedCount}</span>
              </div>
              <span className="text-sm font-medium">produto{selectedCount !== 1 ? "s" : ""} selecionado{selectedCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs flex-shrink-0 border-green-500/40 text-green-600 hover:bg-green-50 hover:text-green-700"
                disabled={bulkToggling}
                onClick={() => bulkToggleActive(true)}
              >
                <ToggleRight className="h-3.5 w-3.5" />
                Ativar todos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs flex-shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={bulkToggling}
                onClick={() => bulkToggleActive(false)}
              >
                <ToggleLeft className="h-3.5 w-3.5" />
                Inativar todos
              </Button>
              <Button
                size="sm"
                className="gap-1.5 h-8 text-xs flex-shrink-0"
                onClick={() => setBulkDialogOpen(true)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Configurar Regras
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedIds(new Set())}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single product rules dialog */}
      <HubRulesDialog
        open={!!configProduct}
        onClose={() => { setConfigProduct(null); setConfigExisting(null); }}
        product={configProduct}
        existing={configExisting}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["hub-fornecedor-entries"] })}
      />

      {/* Bulk rules dialog */}
      <HubRulesDialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        bulkMode
        selectedProductIds={[...selectedIds]}
        allHubEntries={hubEntries}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["hub-fornecedor-entries"] });
          setSelectedIds(new Set());
        }}
      />
    </MainLayout>
  );
}
