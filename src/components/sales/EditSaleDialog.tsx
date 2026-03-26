import { useState, useEffect } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { Trash2, Edit2, AlertTriangle, Package, ArrowLeft, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sale {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  total: number;
  status: string;
  notes: string | null;
  sale_source?: string | null;
  event_name?: string | null;
  created_at: string;
  shipping_method?: string | null;
  shipping_company?: string | null;
  shipping_cost?: number | null;
  shipping_payer?: string | null;
  shipping_address?: string | null;
  shipping_notes?: string | null;
  shipping_tracking?: string | null;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface CustomPaymentMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
  is_active: boolean;
}

interface EditSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  saleItems: SaleItem[];
  customPaymentMethods: CustomPaymentMethod[];
  userId: string;
}

const SALE_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  event: "Evento",
  consortium: "Consórcio",
  bazar: "Bazar VIP",
  partner_point: "Ponto Parceiro",
  catalog: "Catálogo",
  consignment: "Consignação",
  instagram: "Instagram",
  b2b: "B2B",
  estoque_proprio: "Estoque Próprio",
};

export function EditSaleDialog({
  open,
  onOpenChange,
  sale,
  saleItems,
  customPaymentMethods,
  userId,
}: EditSaleDialogProps) {
  const queryClient = useQueryClient();

  const persistKey = sale?.id ? `edit_sale_${sale.id}` : `edit_sale_noop`;

  // Edit form state with persistence
  const [formDraft, setFormDraft, clearFormDraft] = useFormPersistence(persistKey, {
    customerName: "",
    customerPhone: "",
    paymentMethod: "",
    discountType: "fixed",
    discountValue: 0,
    notes: "",
    status: "completed",
    saleSource: "manual",
    eventName: "",
    shippingMethod: "presencial",
    shippingCompany: "",
    shippingCost: 0,
    shippingPayer: "seller",
    shippingAddress: "",
    shippingNotes: "",
    shippingTracking: "",
  });

  const customerName = formDraft.customerName;
  const customerPhone = formDraft.customerPhone;
  const paymentMethod = formDraft.paymentMethod;
  const discountType = formDraft.discountType;
  const discountValue = formDraft.discountValue;
  const notes = formDraft.notes;
  const status = formDraft.status;
  const saleSource = formDraft.saleSource;
  const eventName = formDraft.eventName;
  const shippingMethod = formDraft.shippingMethod;
  const shippingCompany = formDraft.shippingCompany;
  const shippingCost = formDraft.shippingCost;
  const shippingPayer = formDraft.shippingPayer;
  const shippingAddress = formDraft.shippingAddress;
  const shippingNotes = formDraft.shippingNotes;
  const shippingTracking = formDraft.shippingTracking;

  const setField = <K extends keyof typeof formDraft>(field: K, value: (typeof formDraft)[K]) =>
    setFormDraft((prev) => ({ ...prev, [field]: value }));

  const setCustomerName = (v: string) => setField("customerName", v);
  const setCustomerPhone = (v: string) => setField("customerPhone", v);
  const setPaymentMethod = (v: string) => setField("paymentMethod", v);
  const setDiscountType = (v: string) => setField("discountType", v);
  const setDiscountValue = (v: number) => setField("discountValue", v);
  const setNotes = (v: string) => setField("notes", v);
  const setStatus = (v: string) => setField("status", v);
  const setSaleSource = (v: string) => setField("saleSource", v);
  const setEventName = (v: string) => setField("eventName", v);
  const setShippingMethod = (v: string) => setField("shippingMethod", v);
  const setShippingCompany = (v: string) => setField("shippingCompany", v);
  const setShippingCost = (v: number) => setField("shippingCost", v);
  const setShippingPayer = (v: string) => setField("shippingPayer", v);
  const setShippingAddress = (v: string) => setField("shippingAddress", v);
  const setShippingNotes = (v: string) => setField("shippingNotes", v);
  const setShippingTracking = (v: string) => setField("shippingTracking", v);
  
  // Delete state (not persisted — transient UI)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItemsToDelete, setSelectedItemsToDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"all" | "partial">("all");

  // Initialize form with sale data
  useEffect(() => {
    if (sale) {
      setFormDraft({
        customerName: sale.customer_name || "",
        customerPhone: sale.customer_phone || "",
        paymentMethod: sale.payment_method,
        discountType: sale.discount_type || "fixed",
        discountValue: sale.discount_value || 0,
        notes: sale.notes || "",
        status: sale.status,
        saleSource: sale.sale_source || "manual",
        eventName: sale.event_name || "",
        shippingMethod: sale.shipping_method || "presencial",
        shippingCompany: sale.shipping_company || "",
        shippingCost: sale.shipping_cost || 0,
        shippingPayer: sale.shipping_payer || "seller",
        shippingAddress: sale.shipping_address || "",
        shippingNotes: sale.shipping_notes || "",
        shippingTracking: sale.shipping_tracking || "",
      });
      setSelectedItemsToDelete([]);
      setDeleteMode("all");
    }
  }, [sale]);

  const handleSave = async () => {
    if (!sale) return;
    setIsSaving(true);

    try {
      const subtotal = saleItems.reduce((sum, item) => sum + Number(item.total), 0);
      const discountAmount = discountType === "percentage" 
        ? (subtotal * discountValue) / 100 
        : discountValue;
      const shippingForBuyer = shippingPayer === "buyer" && shippingMethod !== "presencial" ? shippingCost : 0;
      const total = Math.max(0, subtotal - discountAmount + shippingForBuyer);

      const { error } = await supabase
        .from("sales")
        .update({
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method: paymentMethod,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: discountAmount,
          total,
          notes: notes || null,
          status,
          sale_source: saleSource,
          event_name: saleSource === "event" ? (eventName || null) : null,
          shipping_method: shippingMethod || null,
          shipping_company: shippingMethod !== "presencial" ? (shippingCompany || null) : null,
          shipping_cost: shippingMethod !== "presencial" ? shippingCost : 0,
          shipping_payer: shippingMethod !== "presencial" ? shippingPayer : null,
          shipping_address: shippingMethod !== "presencial" ? (shippingAddress || null) : null,
          shipping_notes: shippingMethod !== "presencial" ? (shippingNotes || null) : null,
          shipping_tracking: shippingMethod !== "presencial" ? (shippingTracking || null) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sale.id);

      if (error) throw error;

      // Update payment reminders if exists
      await supabase
        .from("payment_reminders")
        .update({
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          amount: total,
          payment_method_name: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .eq("sale_id", sale.id);

      toast({ title: "Venda atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["financial-splits"] });
      queryClient.invalidateQueries({ queryKey: ["payment-reminders"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Erro ao atualizar venda", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const returnItemToStock = async (item: SaleItem) => {
    const { data: product } = await supabase
      .from("products")
      .select("id, stock_quantity, owner_id")
      .eq("id", item.product_id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (product) {
      const variantMatch = item.product_name.match(/\(([^)]+)\)/);
      
      if (variantMatch) {
        const variantInfo = variantMatch[1];
        const parts = variantInfo.split(' - ');
        
        const { data: variants } = await supabase
          .from("product_variants")
          .select("id, stock_quantity, size")
          .eq("product_id", item.product_id);

        if (variants) {
          const matchingVariant = variants.find(v => {
            return parts.some(p => v.size === p);
          });

          if (matchingVariant) {
            await supabase
              .from("product_variants")
              .update({ stock_quantity: matchingVariant.stock_quantity + item.quantity })
              .eq("id", matchingVariant.id);
          }
        }
      }

      await supabase
        .from("products")
        .update({ stock_quantity: product.stock_quantity + item.quantity })
        .eq("id", item.product_id);
    }
  };

  const handleDelete = async () => {
    if (!sale) return;
    setIsDeleting(true);

    try {
      const itemsToDelete = deleteMode === "all" 
        ? saleItems 
        : saleItems.filter(item => selectedItemsToDelete.includes(item.id));

      if (itemsToDelete.length === 0) {
        toast({ title: "Selecione pelo menos um item para excluir", variant: "destructive" });
        setIsDeleting(false);
        return;
      }

      for (const item of itemsToDelete) {
        const isPartnerStock = item.product_name.includes("[Parceiro:");
        if (!isPartnerStock) {
          await returnItemToStock(item);
        }
      }

      await supabase
        .from("financial_splits")
        .delete()
        .eq("sale_id", sale.id);

      if (deleteMode === "all" || itemsToDelete.length === saleItems.length) {
        await supabase.from("payment_reminders").delete().eq("sale_id", sale.id);
        await supabase.from("sale_items").delete().eq("sale_id", sale.id);
        await supabase.from("sales").delete().eq("id", sale.id);
        toast({ title: "Venda excluída e estoque restaurado!" });
      } else {
        for (const item of itemsToDelete) {
          await supabase.from("sale_items").delete().eq("id", item.id);
        }

        const remainingItems = saleItems.filter(item => !selectedItemsToDelete.includes(item.id));
        const newSubtotal = remainingItems.reduce((sum, item) => sum + Number(item.total), 0);
        const discountAmt = discountType === "percentage"
          ? (newSubtotal * discountValue) / 100
          : Math.min(discountValue, newSubtotal);
        const newTotal = Math.max(0, newSubtotal - discountAmt);

        await supabase
          .from("sales")
          .update({ subtotal: newSubtotal, discount_amount: discountAmt, total: newTotal, updated_at: new Date().toISOString() })
          .eq("id", sale.id);

        await supabase.from("payment_reminders").update({ amount: newTotal }).eq("sale_id", sale.id);

        toast({ title: "Itens excluídos e estoque restaurado!", description: `${itemsToDelete.length} item(s) removido(s) da venda.` });
      }

      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["own-products-for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["product-variants"] });
      queryClient.invalidateQueries({ queryKey: ["financial-splits"] });
      queryClient.invalidateQueries({ queryKey: ["payment-reminders"] });
      
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemsToDelete(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const selectAllItems = () => {
    if (selectedItemsToDelete.length === saleItems.length) {
      setSelectedItemsToDelete([]);
    } else {
      setSelectedItemsToDelete(saleItems.map(item => item.id));
    }
  };

  if (!sale) return null;

  const subtotal = saleItems.reduce((sum, item) => sum + Number(item.total), 0);
  const calculatedDiscount = discountType === "percentage" 
    ? (subtotal * discountValue) / 100 
    : discountValue;
  const shippingForBuyer = shippingPayer === "buyer" && shippingMethod !== "presencial" ? shippingCost : 0;
  const total = Math.max(0, subtotal - calculatedDiscount + shippingForBuyer);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Venda
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Sale Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">ID da Venda</p>
                <p className="font-mono font-medium">{sale.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium">
                  {new Date(sale.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            {/* Sale Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Origem da Venda</Label>
                <Select value={saleSource} onValueChange={(v) => { setSaleSource(v); if (v !== "event") setEventName(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SALE_SOURCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {saleSource === "event" && (
                <div>
                  <Label>Nome do Evento</Label>
                  <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Ex: Feira de Inverno" />
                </div>
              )}
            </div>

            {/* Items (read-only display) */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4" />
                Itens da Venda
              </Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {saleItems.map((item) => (
                  <div key={item.id} className="p-3 flex justify-between items-center border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity}x R$ {Number(item.unit_price).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <p className="font-semibold">
                      R$ {Number(item.total).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome do Cliente</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>

            {/* Payment & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {customPaymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
                    ))}
                    {!customPaymentMethods.find(m => m.name === paymentMethod) && (
                      <SelectItem value={paymentMethod}>{paymentMethod}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Desconto</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="consortium_credit">Crédito de Consórcio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{discountType === "consortium_credit" ? "Crédito Utilizado" : "Valor do Desconto"}</Label>
                <Input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
              </div>
            </div>

            {/* Shipping */}
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
              <p className="text-sm font-medium flex items-center gap-1">
                <Truck className="h-4 w-4" />
                Frete / Envio
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Método</Label>
                  <Select value={shippingMethod} onValueChange={setShippingMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="postagem">Postagem</SelectItem>
                      <SelectItem value="app">Aplicativo</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {shippingMethod !== "presencial" && (
                  <div>
                    <Label>Transportadora</Label>
                    <Input value={shippingCompany} onChange={(e) => setShippingCompany(e.target.value)} placeholder="Ex: Correios, Jadlog..." />
                  </div>
                )}
              </div>

              {shippingMethod !== "presencial" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Custo do Frete (R$)</Label>
                    <Input type="number" min="0" step="0.01" value={shippingCost || ""} onChange={(e) => setShippingCost(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Quem Paga</Label>
                    <Select value={shippingPayer} onValueChange={setShippingPayer}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seller">Vendedora</SelectItem>
                        <SelectItem value="buyer">Compradora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Endereço de Envio</Label>
                    <Input value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Endereço completo" />
                  </div>
                  <div>
                    <Label>Código de Rastreio</Label>
                    <Input value={shippingTracking} onChange={(e) => setShippingTracking(e.target.value)} placeholder="Ex: BR123456789" />
                  </div>
                  <div>
                    <Label>Obs. do Frete</Label>
                    <Input value={shippingNotes} onChange={(e) => setShippingNotes(e.target.value)} placeholder="Observações..." />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações sobre a venda..." />
            </div>

            {/* Totals */}
            <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              {calculatedDiscount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Desconto {discountType === "consortium_credit" ? "(Crédito Consórcio)" : ""}</span>
                  <span>- R$ {calculatedDiscount.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              {shippingForBuyer > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Frete (compradora)</span>
                  <span>+ R$ {shippingForBuyer.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span>R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} className="sm:mr-auto">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Venda
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar Alterações"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation - inline Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Venda
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Esta ação irá devolver os produtos ao estoque e atualizar os relatórios financeiros.
              Escolha o que deseja excluir:
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button variant={deleteMode === "all" ? "default" : "outline"} size="sm" onClick={() => { setDeleteMode("all"); setSelectedItemsToDelete([]); }}>
                Excluir Tudo
              </Button>
              <Button variant={deleteMode === "partial" ? "default" : "outline"} size="sm" onClick={() => setDeleteMode("partial")}>
                Escolher Itens
              </Button>
            </div>

            {deleteMode === "partial" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Selecione os itens a excluir:</Label>
                  <Button variant="ghost" size="sm" onClick={selectAllItems}>
                    {selectedItemsToDelete.length === saleItems.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {saleItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex items-center gap-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleItemSelection(item.id)}
                    >
                      <Checkbox
                        checked={selectedItemsToDelete.includes(item.id)}
                        onCheckedChange={() => toggleItemSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity}x R$ {Number(item.unit_price).toFixed(2).replace(".", ",")}</p>
                      </div>
                      <Badge variant="secondary">R$ {Number(item.total).toFixed(2).replace(".", ",")}</Badge>
                    </div>
                  ))}
                </div>

                {selectedItemsToDelete.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedItemsToDelete.length} item(s) selecionado(s)
                    {selectedItemsToDelete.length === saleItems.length && " - A venda inteira será excluída"}
                  </p>
                )}
              </div>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <strong>Atenção:</strong> Os produtos serão devolvidos ao estoque 
                (exceto itens de parceiros). Os registros financeiros serão atualizados.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || (deleteMode === "partial" && selectedItemsToDelete.length === 0)}
            >
              {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
