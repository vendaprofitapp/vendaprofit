import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Building2, Package, Inbox, TrendingUp, DollarSign, Percent, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Platform fee constant
const VENDA_PROFIT_FEE = 5.0;

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

const DEFAULT_FORM: RulesForm = {
  hub_approval_type: "automatic",
  hub_pricing_mode: "fixed",
  hub_fixed_cost: "",
  hub_minimum_sale_price: "",
  hub_commission_rate: "",
};

function FinancialSimulation({ form }: { form: RulesForm }) {
  const fixedCost = parseFloat(form.hub_fixed_cost) || 0;
  const minSalePrice = parseFloat(form.hub_minimum_sale_price) || 0;
  const commissionRate = parseFloat(form.hub_commission_rate) || 0;

  if (form.hub_pricing_mode === "fixed") {
    const netReceived = fixedCost - VENDA_PROFIT_FEE;
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-semibold text-primary flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Simulação Financeira
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Custo cobrado ao Vendedor</span>
            <span className="font-medium text-foreground">
              {fixedCost > 0 ? `R$ ${fixedCost.toFixed(2)}` : "—"}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Taxa Venda PROFIT</span>
            <span className="font-medium text-destructive">- R$ {VENDA_PROFIT_FEE.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Você vai receber</span>
            <span className={netReceived > 0 ? "text-green-600" : "text-muted-foreground"}>
              {fixedCost > 0 ? `R$ ${netReceived.toFixed(2)}` : "—"}
            </span>
          </div>
        </div>
        {fixedCost > 0 && netReceived <= 0 && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> O custo deve ser maior que a taxa da plataforma (R$ {VENDA_PROFIT_FEE.toFixed(2)}).
          </p>
        )}
      </div>
    );
  }

  const grossCommission = (minSalePrice * commissionRate) / 100;
  const netReceived = grossCommission - VENDA_PROFIT_FEE;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-semibold text-primary flex items-center gap-2">
        <TrendingUp className="h-4 w-4" /> Simulação Financeira
      </p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Preço Mínimo de Venda</span>
          <span className="font-medium text-foreground">
            {minSalePrice > 0 ? `R$ ${minSalePrice.toFixed(2)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Sua comissão ({commissionRate > 0 ? `${commissionRate}%` : "—"})</span>
          <span className="font-medium text-foreground">
            {grossCommission > 0 ? `R$ ${grossCommission.toFixed(2)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Taxa Venda PROFIT</span>
          <span className="font-medium text-destructive">- R$ {VENDA_PROFIT_FEE.toFixed(2)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-base">
          <span>Você vai receber</span>
          <span className={netReceived > 0 ? "text-green-600" : "text-muted-foreground"}>
            {minSalePrice > 0 && commissionRate > 0 ? `R$ ${netReceived.toFixed(2)}` : "—"}
          </span>
        </div>
      </div>
      {minSalePrice > 0 && commissionRate > 0 && netReceived <= 0 && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> O valor da comissão deve ser maior que R$ {VENDA_PROFIT_FEE.toFixed(2)}.
        </p>
      )}
    </div>
  );
}

function HubRulesDialog({
  open,
  onClose,
  product,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  existing: HubSharedProduct | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<RulesForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
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
  }, [existing, open]);

  const handleSave = async () => {
    if (!product || !user) return;
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

      if (existing) {
        const { error } = await supabase
          .from("hub_shared_products")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Need a connection_id — create a "self" hub entry or use existing active connection
        // For now we use a direct upsert referencing the owner's own products
        // The connection will be resolved when the seller fetches
        const { error } = await supabase.from("hub_shared_products").insert({
          product_id: product.id,
          ...payload,
          // connection_id will need a valid hub_connection — handled below
          connection_id: await getOrCreateSelfConnection(user.id),
        });
        if (error) throw error;
      }

      toast.success("Regras salvas com sucesso!");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Configurar Regras HUB — {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Approval Type */}
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
                <div key={opt.value} className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-all ${form.hub_approval_type === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <RadioGroupItem value={opt.value} id={`approval-${opt.value}`} className="sr-only" />
                  <Label htmlFor={`approval-${opt.value}`} className="cursor-pointer font-medium text-sm">
                    {opt.label}
                  </Label>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Pricing Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Modelo de Ganhos</Label>
            <RadioGroup
              value={form.hub_pricing_mode}
              onValueChange={(v) => setForm((f) => ({ ...f, hub_pricing_mode: v as "fixed" | "commission" }))}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { value: "fixed", label: "Valor Fixo", desc: "Cobro um custo fixo ao vendedor", icon: DollarSign },
                { value: "commission", label: "% de Comissão", desc: "Recebo % sobre a venda ao cliente", icon: Percent },
              ].map((opt) => (
                <div key={opt.value} className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-all ${form.hub_pricing_mode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <RadioGroupItem value={opt.value} id={`mode-${opt.value}`} className="sr-only" />
                  <Label htmlFor={`mode-${opt.value}`} className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                    <opt.icon className="h-3.5 w-3.5" /> {opt.label}
                  </Label>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Fixed cost fields */}
          {form.hub_pricing_mode === "fixed" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="hub_fixed_cost" className="text-sm">Custo para o Vendedor (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    id="hub_fixed_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    className="pl-9"
                    value={form.hub_fixed_cost}
                    onChange={(e) => setForm((f) => ({ ...f, hub_fixed_cost: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Preço de custo do produto: {product.cost_price ? `R$ ${product.cost_price.toFixed(2)}` : "não definido"}
                </p>
              </div>
            </div>
          )}

          {/* Commission fields */}
          {form.hub_pricing_mode === "commission" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="hub_minimum_sale_price" className="text-sm">Preço Mínimo de Venda ao Cliente (R$) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    id="hub_minimum_sale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    className="pl-9"
                    value={form.hub_minimum_sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, hub_minimum_sale_price: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hub_commission_rate" className="text-sm">Sua % de Comissão *</Label>
                <div className="relative">
                  <Input
                    id="hub_commission_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Ex: 30"
                    className="pr-9"
                    value={form.hub_commission_rate}
                    onChange={(e) => setForm((f) => ({ ...f, hub_commission_rate: e.target.value }))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            </div>
          )}

          <FinancialSimulation form={form} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Regras"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to find or create a self-referencing hub connection
async function getOrCreateSelfConnection(userId: string): Promise<string> {
  // Look for an existing self connection (owner_id = seller_id = user)
  const { data: existing } = await supabase
    .from("hub_connections")
    .select("id")
    .eq("owner_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create a placeholder active hub connection for self-sharing
  const { data: created, error } = await supabase
    .from("hub_connections")
    .insert({
      owner_id: userId,
      invited_email: "hub-catalog@vendaprofit.internal",
      status: "active",
      commission_pct: 0,
      auto_share_all: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

function ProductCard({
  product,
  hubEntry,
  onConfigure,
  onToggle,
}: {
  product: Product;
  hubEntry: HubSharedProduct | null;
  onConfigure: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const isEnabled = hubEntry?.is_active ?? false;
  const isConfigured = hubEntry?.hub_configured ?? false;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-muted overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{product.name}</p>
              {product.category && (
                <p className="text-xs text-muted-foreground">{product.category}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-primary">R$ {product.price.toFixed(2)}</span>
                <Badge variant="outline" className="text-xs py-0">
                  {product.stock_quantity} un.
                </Badge>
                {isEnabled && isConfigured && (
                  <Badge className="text-xs py-0 bg-green-500/15 text-green-700 border-green-300">
                    {hubEntry?.hub_pricing_mode === "fixed"
                      ? `Custo R$ ${hubEntry.hub_fixed_cost?.toFixed(2)}`
                      : `${hubEntry?.hub_commission_rate}% comissão`}
                  </Badge>
                )}
              </div>
            </div>

            {/* Toggle */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => {
                  if (checked && !isConfigured) {
                    onConfigure();
                  } else {
                    onToggle(checked);
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">
                {isEnabled ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>

          {isEnabled && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs mt-2 text-primary hover:text-primary"
              onClick={onConfigure}
            >
              {isConfigured ? "Editar Regras" : "Configurar Regras"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function HubFornecedor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [configExisting, setConfigExisting] = useState<HubSharedProduct | null>(null);

  // Fetch user's products
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

  // Fetch hub_shared_products for these products
  const { data: hubEntries = [] } = useQuery({
    queryKey: ["hub-fornecedor-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get all hub connections where user is owner
      const { data: connections } = await supabase
        .from("hub_connections")
        .select("id")
        .eq("owner_id", user!.id);

      if (!connections || connections.length === 0) return [];

      const connectionIds = connections.map((c) => c.id);

      const { data, error } = await supabase
        .from("hub_shared_products")
        .select("id, product_id, is_active, hub_configured, hub_approval_type, hub_pricing_mode, hub_fixed_cost, hub_minimum_sale_price, hub_commission_rate")
        .in("connection_id", connectionIds);

      if (error) throw error;
      return data as HubSharedProduct[];
    },
  });

  const hubByProductId = Object.fromEntries(hubEntries.map((e) => [e.product_id, e]));

  const toggleMutation = useMutation({
    mutationFn: async ({ productId, enabled }: { productId: string; enabled: boolean }) => {
      const entry = hubByProductId[productId];
      if (!entry) return;
      const { error } = await supabase
        .from("hub_shared_products")
        .update({ is_active: enabled })
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub-fornecedor-entries"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activeCount = hubEntries.filter((e) => e.is_active).length;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">HUB Fornecedor</h1>
            <p className="text-muted-foreground text-sm">
              Disponibilize seus produtos para outros vendedores e gerencie os pedidos recebidos.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Produtos Disponíveis</p>
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total no Catálogo</p>
            <p className="text-2xl font-bold">{products.length}</p>
          </Card>
          <Card className="p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Taxa Plataforma</p>
            <p className="text-2xl font-bold text-amber-600">R$ {VENDA_PROFIT_FEE.toFixed(2)}</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="produtos">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="produtos" className="flex-1 sm:flex-none gap-1.5">
              <Package className="h-4 w-4" /> Meus Produtos Disponíveis
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex-1 sm:flex-none gap-1.5">
              <Inbox className="h-4 w-4" /> Pedidos Recebidos
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="produtos" className="mt-4 space-y-3">
            {loadingProducts ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="flex gap-4">
                      <div className="h-16 w-16 rounded-lg bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-muted" />
                        <div className="h-3 w-1/2 rounded bg-muted" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <Card className="py-16 text-center">
                <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">Nenhum produto encontrado</p>
                <p className="text-sm text-muted-foreground/70">Adicione produtos ao estoque para disponibilizá-los no HUB.</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    hubEntry={hubByProductId[product.id] ?? null}
                    onConfigure={() => {
                      setConfigProduct(product);
                      setConfigExisting(hubByProductId[product.id] ?? null);
                    }}
                    onToggle={(enabled) =>
                      toggleMutation.mutate({ productId: product.id, enabled })
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="pedidos" className="mt-4">
            <Card className="py-16 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">Pedidos Recebidos</p>
              <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto mt-1">
                A gestão completa de pedidos recebidos dos seus vendedores estará disponível em breve.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Config Dialog */}
      <HubRulesDialog
        open={!!configProduct}
        onClose={() => { setConfigProduct(null); setConfigExisting(null); }}
        product={configProduct}
        existing={configExisting}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["hub-fornecedor-entries"] })}
      />
    </MainLayout>
  );
}
