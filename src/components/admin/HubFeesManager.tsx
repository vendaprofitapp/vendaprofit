/**
 * HubFeesManager.tsx
 * Super-admin panel to manage per-supplier and per-product HUB platform fees.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Percent, DollarSign, Building2, Package, Edit2, ChevronRight,
  Info, Globe,
} from "lucide-react";
import {
  HUB_DEFAULT_FEE_TYPE,
  HUB_DEFAULT_FEE_VALUE,
  calcHubFee,
} from "@/hooks/useHubFeeCalculator";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SupplierRow {
  id: string;
  full_name: string | null;
  email: string | null;
  hub_fee_type: "fixed" | "percentage" | null;
  hub_fee_value: number | null;
  address_city: string | null;
  address_state: string | null;
}

interface ProductFeeRow {
  id: string;
  name: string;
  price: number;
  cost_price: number | null;
  admin_hub_fee_type: "fixed" | "percentage" | null;
  admin_hub_fee_value: number | null;
  image_url: string | null;
}

// ─── Fee badge helper ─────────────────────────────────────────────────────────
function FeeBadge({
  feeType,
  feeValue,
  isDefault = false,
}: {
  feeType: "fixed" | "percentage" | null;
  feeValue: number | null;
  isDefault?: boolean;
}) {
  if (isDefault || !feeType || feeValue == null) {
    return (
      <Badge variant="outline" className="text-xs gap-1 text-muted-foreground border-muted">
        <Globe className="h-3 w-3" />
        Padrão ({HUB_DEFAULT_FEE_TYPE === "fixed" ? `R$ ${HUB_DEFAULT_FEE_VALUE.toFixed(2)}` : `${HUB_DEFAULT_FEE_VALUE}%`})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/40 bg-primary/5">
      {feeType === "fixed" ? <DollarSign className="h-3 w-3" /> : <Percent className="h-3 w-3" />}
      {feeType === "fixed" ? `R$ ${feeValue.toFixed(2)}` : `${feeValue}%`}
    </Badge>
  );
}

// ─── Edit Supplier Fee Dialog ─────────────────────────────────────────────────
function EditSupplierFeeDialog({
  supplier,
  open,
  onClose,
  onSaved,
}: {
  supplier: SupplierRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [feeType, setFeeType] = useState<"fixed" | "percentage" | "default">("default");
  const [feeValue, setFeeValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync state when supplier changes
  if (supplier && open) {
    const currentType = supplier.hub_fee_type ?? "default";
    // Only set once when opening
  }

  const handleOpen = () => {
    if (supplier) {
      setFeeType(supplier.hub_fee_type ?? "default");
      setFeeValue(supplier.hub_fee_value?.toString() ?? "");
    }
  };

  const simulatedFee = calcHubFee({
    costPrice: 100,
    supplierFeeType: feeType !== "default" ? feeType : null,
    supplierFeeValue: feeType !== "default" ? parseFloat(feeValue) || 0 : null,
  });

  const handleSave = async () => {
    if (!supplier) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        hub_fee_type: feeType !== "default" ? feeType : null,
        hub_fee_value: feeType !== "default" ? (parseFloat(feeValue) || null) : null,
      };
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", supplier.id);
      if (error) throw error;
      toast.success("Taxa do fornecedor salva!");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
        else handleOpen();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Taxa HUB — {supplier?.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tipo de Taxa</Label>
            <Select
              value={feeType}
              onValueChange={(v) => setFeeType(v as "fixed" | "percentage" | "default")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  Usar Padrão Global (R$ {HUB_DEFAULT_FEE_VALUE.toFixed(2)})
                </SelectItem>
                <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                <SelectItem value="percentage">Percentagem sobre o Custo (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {feeType !== "default" && (
            <div className="space-y-1.5">
              <Label>{feeType === "fixed" ? "Valor em R$" : "Percentagem (%)"}</Label>
              <div className="relative">
                {feeType === "fixed" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                )}
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={feeType === "fixed" ? "0,00" : "Ex: 10"}
                  className={feeType === "fixed" ? "pl-9" : "pr-9"}
                  value={feeValue}
                  onChange={(e) => setFeeValue(e.target.value)}
                />
                {feeType === "percentage" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="rounded-xl border border-muted bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Info className="h-3 w-3" /> Simulação (custo base R$ 100,00)
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa da plataforma</span>
              <span className="font-semibold text-primary">R$ {simulatedFee.feeAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Custo total vendedor</span>
              <span className="font-bold">R$ {simulatedFee.totalCost.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Fonte: {simulatedFee.feeLabel}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Taxa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Product Fee Dialog ──────────────────────────────────────────────────
function EditProductFeeDialog({
  product,
  supplierFeeType,
  supplierFeeValue,
  open,
  onClose,
  onSaved,
}: {
  product: ProductFeeRow | null;
  supplierFeeType: "fixed" | "percentage" | null;
  supplierFeeValue: number | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [feeType, setFeeType] = useState<"fixed" | "percentage" | "inherit">("inherit");
  const [feeValue, setFeeValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpen = () => {
    if (product) {
      setFeeType(product.admin_hub_fee_type ?? "inherit");
      setFeeValue(product.admin_hub_fee_value?.toString() ?? "");
    }
  };

  const costPrice = product?.cost_price ?? 50;
  const simulatedFee = calcHubFee({
    costPrice,
    productFeeType: feeType !== "inherit" ? feeType : null,
    productFeeValue: feeType !== "inherit" ? parseFloat(feeValue) || 0 : null,
    supplierFeeType,
    supplierFeeValue,
  });

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        admin_hub_fee_type: feeType !== "inherit" ? feeType : null,
        admin_hub_fee_value: feeType !== "inherit" ? (parseFloat(feeValue) || null) : null,
      };
      const { error } = await supabase.from("products").update(payload).eq("id", product.id);
      if (error) throw error;
      toast.success("Taxa do produto salva!");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
        else handleOpen();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Taxa HUB — {product?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-amber-300 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-700">
              <strong>Prioridade máxima:</strong> Esta taxa sobrepõe a taxa do fornecedor e o padrão global.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Taxa para este Produto</Label>
            <Select
              value={feeType}
              onValueChange={(v) => setFeeType(v as "fixed" | "percentage" | "inherit")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Herdar do Fornecedor / Padrão</SelectItem>
                <SelectItem value="fixed">Valor Fixo (R$) — específico deste produto</SelectItem>
                <SelectItem value="percentage">Percentagem sobre o Custo (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {feeType !== "inherit" && (
            <div className="space-y-1.5">
              <Label>{feeType === "fixed" ? "Valor em R$" : "Percentagem (%)"}</Label>
              <div className="relative">
                {feeType === "fixed" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                )}
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className={feeType === "fixed" ? "pl-9" : "pr-9"}
                  value={feeValue}
                  onChange={(e) => setFeeValue(e.target.value)}
                />
                {feeType === "percentage" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="rounded-xl border border-muted bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Info className="h-3 w-3" /> Simulação (custo R$ {costPrice.toFixed(2)})
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa da plataforma</span>
              <span className="font-semibold text-primary">R$ {simulatedFee.feeAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Custo total vendedor</span>
              <span className="font-bold">R$ {simulatedFee.totalCost.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Fonte: {simulatedFee.feeLabel}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Taxa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function HubFeesManager() {
  const queryClient = useQueryClient();
  const [editSupplier, setEditSupplier] = useState<SupplierRow | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<ProductFeeRow | null>(null);
  const [editProductSupplier, setEditProductSupplier] = useState<SupplierRow | null>(null);

  // Fetch all profiles that are hub suppliers (have at least one active hub_connection)
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["admin-hub-fee-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id, full_name, email, hub_fee_type, hub_fee_value,
          address_city, address_state
        `)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as SupplierRow[];
    },
  });

  // Fetch products for expanded supplier
  const { data: supplierProducts = [] } = useQuery({
    queryKey: ["admin-hub-fee-products", expandedSupplier],
    queryFn: async () => {
      if (!expandedSupplier) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, admin_hub_fee_type, admin_hub_fee_value, image_url")
        .eq("owner_id", expandedSupplier)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProductFeeRow[];
    },
    enabled: !!expandedSupplier,
  });

  const refreshSuppliers = () => queryClient.invalidateQueries({ queryKey: ["admin-hub-fee-suppliers"] });
  const refreshProducts = () => queryClient.invalidateQueries({ queryKey: ["admin-hub-fee-products", expandedSupplier] });

  return (
    <div className="space-y-4">
      {/* Global default banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Globe className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm text-foreground">Taxa Global Padrão</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplicada quando nenhuma taxa específica estiver configurada.
            Actualmente:{" "}
            <strong className="text-primary">
              {HUB_DEFAULT_FEE_TYPE === "fixed"
                ? `R$ ${HUB_DEFAULT_FEE_VALUE.toFixed(2)} (fixo)`
                : `${HUB_DEFAULT_FEE_VALUE}% sobre o custo`}
            </strong>
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Para alterar a taxa padrão, edite a constante <code>HUB_DEFAULT_FEE_VALUE</code> em <code>src/hooks/useHubFeeCalculator.ts</code>.
          </p>
        </div>
      </div>

      {/* Cascade explanation */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Lógica de Cascata (Prioridade)
        </p>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {[
            { label: "1º Taxa do Produto", color: "bg-amber-500/10 text-amber-700 border-amber-300" },
            { label: "→", color: "" },
            { label: "2º Taxa do Fornecedor", color: "bg-blue-500/10 text-blue-700 border-blue-300" },
            { label: "→", color: "" },
            { label: "3º Padrão Global", color: "bg-green-500/10 text-green-700 border-green-300" },
          ].map((item, i) =>
            item.label === "→" ? (
              <ChevronRight key={i} className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Badge key={i} variant="outline" className={cn("text-xs", item.color)}>
                {item.label}
              </Badge>
            )
          )}
        </div>
      </div>

      <Separator />

      {/* Suppliers list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">A carregar fornecedores...</p>
      ) : suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum perfil encontrado.</p>
      ) : (
        <div className="space-y-2">
          {suppliers.map((supplier) => (
            <Card
              key={supplier.id}
              className={cn(
                "overflow-hidden transition-all",
                expandedSupplier === supplier.id && "border-primary/40"
              )}
            >
              <div className="flex items-center justify-between p-4 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{supplier.full_name || "Sem nome"}</p>
                    <FeeBadge
                      feeType={supplier.hub_fee_type}
                      feeValue={supplier.hub_fee_value}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {supplier.email}
                    {(supplier.address_city || supplier.address_state) && (
                      <> · {[supplier.address_city, supplier.address_state].filter(Boolean).join(" / ")}</>
                    )}
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setEditSupplier(supplier)}
                  >
                    <Edit2 className="h-3 w-3" /> Taxa
                  </Button>
                  <Button
                    size="sm"
                    variant={expandedSupplier === supplier.id ? "secondary" : "ghost"}
                    className="h-8 gap-1 text-xs"
                    onClick={() =>
                      setExpandedSupplier((v) => (v === supplier.id ? null : supplier.id))
                    }
                  >
                    <Package className="h-3 w-3" />
                    Produtos
                  </Button>
                </div>
              </div>

              {/* Expanded: products list */}
              {expandedSupplier === supplier.id && (
                <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                  {supplierProducts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhum produto activo encontrado.
                    </p>
                  ) : (
                    supplierProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{product.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Custo: {product.cost_price ? `R$ ${product.cost_price.toFixed(2)}` : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <FeeBadge
                            feeType={product.admin_hub_fee_type}
                            feeValue={product.admin_hub_fee_value}
                            isDefault={!product.admin_hub_fee_type}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-[10px] px-2"
                            onClick={() => {
                              setEditProduct(product);
                              setEditProductSupplier(supplier);
                            }}
                          >
                            <Edit2 className="h-3 w-3" /> Editar
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <EditSupplierFeeDialog
        supplier={editSupplier}
        open={!!editSupplier}
        onClose={() => setEditSupplier(null)}
        onSaved={refreshSuppliers}
      />

      <EditProductFeeDialog
        product={editProduct}
        supplierFeeType={editProductSupplier?.hub_fee_type ?? null}
        supplierFeeValue={editProductSupplier?.hub_fee_value ?? null}
        open={!!editProduct}
        onClose={() => { setEditProduct(null); setEditProductSupplier(null); }}
        onSaved={refreshProducts}
      />
    </div>
  );
}
