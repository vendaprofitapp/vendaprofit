import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ShoppingBag, Package, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export interface HubOrderItem {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_size: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  hub_connection_id: string | null; // null = item próprio do vendedor
  hub_commission_pct: number;
  hub_owner_id: string; // = seller_id para itens próprios
  isOwnItem?: boolean; // flag para itens do estoque próprio
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  hubItems?: HubOrderItem[];       // itens de parceiros HUB (precisam aprovação)
  ownItems?: HubOrderItem[];       // itens próprios do vendedor (auto-aprovados)
  prefilledCustomerName?: string;
  prefilledCustomerPhone?: string;
  prefilledPaymentMethod?: string;
}

const PAYMENT_METHODS = ["Dinheiro", "Pix", "Cartão de Crédito", "Cartão de Débito", "Transferência"];

export function HubCreateOrderDialog({
  open,
  onClose,
  onCreated,
  hubItems = [],
  ownItems = [],
  prefilledCustomerName = "",
  prefilledCustomerPhone = "",
  prefilledPaymentMethod = "Dinheiro",
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState(prefilledCustomerName);
  const [customerPhone, setCustomerPhone] = useState(prefilledCustomerPhone);
  const [paymentMethod, setPaymentMethod] = useState(prefilledPaymentMethod);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const allItems = [...ownItems, ...hubItems];
  const total = allItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  // Group HUB items by owner (each owner gets their own pending order)
  const hubItemsByOwner = hubItems.reduce((acc, item) => {
    const key = item.hub_owner_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, HubOrderItem[]>);

  // For the primary order, we use the first HUB owner's connection_id
  // Own items are attached to the first HUB order (or a solo order if no HUB)
  const primaryOwnerId = hubItems.length > 0 ? hubItems[0].hub_owner_id : null;
  const primaryConnectionId = hubItems.length > 0 ? hubItems[0].hub_connection_id : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allItems.length === 0) { toast.error("Nenhum item no pedido."); return; }
    setLoading(true);
    try {
      // Create one pending order per HUB owner
      for (const [ownerId, ownerHubItems] of Object.entries(hubItemsByOwner)) {
        const connId = ownerHubItems[0].hub_connection_id!;

        // Calculate subtotal: HUB items + own items (only on first iteration)
        const isFirstOwner = ownerId === Object.keys(hubItemsByOwner)[0];
        const ownItemsForThisOrder = isFirstOwner ? ownItems : [];
        const orderItems = [...ownItemsForThisOrder, ...ownerHubItems];
        const orderTotal = orderItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

        const { data: order, error: orderErr } = await supabase
          .from("hub_pending_orders")
          .insert({
            connection_id: connId,
            seller_id: user!.id,
            owner_id: ownerId,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            payment_method: paymentMethod,
            subtotal: orderTotal,
            total: orderTotal,
            notes: notes || null,
            status: "pending_hub_approval",
          })
          .select()
          .single();
        if (orderErr) throw orderErr;

        // Insert all items for this order
        const itemsToInsert = orderItems.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product_name,
          variant_size: item.variant_size,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          hub_connection_id: item.hub_connection_id,
          hub_commission_pct: item.hub_commission_pct,
          hub_owner_id: item.hub_owner_id,
          // Own items are auto-approved; HUB items need owner approval
          status: item.isOwnItem ? "approved" : "pending",
        }));

        const { error: itemsErr } = await supabase
          .from("hub_pending_order_items")
          .insert(itemsToInsert);
        if (itemsErr) throw itemsErr;

        // Notify HUB owner (only about HUB items, not own items)
        await supabase.from("hub_order_notifications").insert({
          recipient_id: ownerId,
          order_id: order.id,
          type: "new_order",
          message: `🛒 Nova solicitação HUB! ${ownerHubItems.length} item(s) de ${customerName || "cliente"} aguardando sua aprovação.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["hub-seller-pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["hub-pending-orders-count"] });
      toast.success("Pedido HUB criado! O dono do produto foi notificado para aprovar.");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido HUB");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Criar Pedido HUB
          </DialogTitle>
          <DialogDescription>
            Este pedido aguardará aprovação do dono antes de ser finalizado. Itens próprios serão vendidos junto ao final.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Own items (auto-approved) */}
          {ownItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Package className="h-3.5 w-3.5 text-green-600" />
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Seus itens (aprovados automaticamente)</p>
              </div>
              <div className="space-y-1.5">
                {ownItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span>
                      {item.product_name}
                      {item.variant_size && <span className="text-muted-foreground ml-1">({item.variant_size})</span>}
                      <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                    </span>
                    <span className="font-semibold text-green-700">
                      {(item.unit_price * item.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HUB items (need approval) */}
          {hubItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="h-3.5 w-3.5 text-amber-600" />
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Itens HUB (aguardam aprovação)</p>
              </div>
              <div className="space-y-1.5">
                {hubItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span>
                      {item.product_name}
                      {item.variant_size && <span className="text-muted-foreground ml-1">({item.variant_size})</span>}
                      <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                    </span>
                    <span className="font-semibold text-amber-700">
                      {(item.unit_price * item.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center font-semibold text-sm pt-1 border-t">
            <span>Total</span>
            <span>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Nome do Cliente</Label>
              <Input
                placeholder="Nome completo"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea
              placeholder="Alguma informação adicional..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <p className="font-semibold mb-0.5">⏳ Fluxo de aprovação</p>
            <p>
              {ownItems.length > 0 && hubItems.length > 0
                ? "Seus itens já estão aprovados. Os itens HUB precisam de aprovação do dono antes da finalização."
                : "O dono do produto precisará aprovar cada item antes da finalização."}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || allItems.length === 0} className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              {loading ? "Criando..." : "Enviar para Aprovação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
