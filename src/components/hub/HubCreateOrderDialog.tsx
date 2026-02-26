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
import { ShoppingBag, Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface HubItem {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_size: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  hub_connection_id: string;
  hub_commission_pct: number;
  hub_owner_id: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-filled items when coming from PDV with HUB cart items */
  prefilledItems?: HubItem[];
  prefilledCustomerName?: string;
  prefilledCustomerPhone?: string;
  prefilledPaymentMethod?: string;
  prefilledTotal?: number;
  connectionId?: string;
}

const PAYMENT_METHODS = ["Dinheiro", "Pix", "Cartão de Crédito", "Cartão de Débito", "Transferência"];

export function HubCreateOrderDialog({
  open,
  onClose,
  onCreated,
  prefilledItems = [],
  prefilledCustomerName = "",
  prefilledCustomerPhone = "",
  prefilledPaymentMethod = "Dinheiro",
  prefilledTotal,
  connectionId,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState(prefilledCustomerName);
  const [customerPhone, setCustomerPhone] = useState(prefilledCustomerPhone);
  const [paymentMethod, setPaymentMethod] = useState(prefilledPaymentMethod);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch connection info for single-connection mode
  const { data: connection } = useQuery({
    queryKey: ["hub-connection-for-order", connectionId],
    queryFn: async () => {
      if (!connectionId) return null;
      const { data } = await supabase
        .from("hub_connections")
        .select("id, owner_id, commission_pct")
        .eq("id", connectionId)
        .single();
      return data;
    },
    enabled: !!connectionId,
  });

  const items = prefilledItems;
  const total = prefilledTotal ?? items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  // Group items by connection (owner)
  const itemsByOwner = items.reduce((acc, item) => {
    const key = item.hub_owner_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, HubItem[]>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error("Nenhum item HUB no pedido."); return; }
    setLoading(true);
    try {
      // Create one pending order per owner (since each owner must approve separately)
      for (const [ownerId, ownerItems] of Object.entries(itemsByOwner)) {
        const ownerTotal = ownerItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const connId = ownerItems[0].hub_connection_id;

        const { data: order, error: orderErr } = await supabase
          .from("hub_pending_orders")
          .insert({
            connection_id: connId,
            seller_id: user!.id,
            owner_id: ownerId,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            payment_method: paymentMethod,
            subtotal: ownerTotal,
            total: ownerTotal,
            notes: notes || null,
            status: "pending_hub_approval",
          })
          .select()
          .single();
        if (orderErr) throw orderErr;

        // Insert items
        const { error: itemsErr } = await supabase
          .from("hub_pending_order_items")
          .insert(ownerItems.map(item => ({
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
            status: "pending",
          })));
        if (itemsErr) throw itemsErr;

        // Notify owner
        await supabase.from("hub_order_notifications").insert({
          recipient_id: ownerId,
          order_id: order.id,
          type: "new_order",
          message: `🛒 Nova solicitação HUB de ${customerName || "vendedor"}! ${ownerItems.length} item(s) aguardando sua aprovação.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["hub-seller-pending-orders"] });
      toast.success(`Pedido HUB criado! O dono do produto foi notificado para aprovar.`);
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
            Este pedido será enviado para aprovação do dono do produto antes de ser finalizado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Items summary */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Itens do Pedido</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm bg-muted/40 rounded-lg px-3 py-2">
                  <span>
                    {item.product_name}
                    {item.variant_size && <span className="text-muted-foreground ml-1">({item.variant_size})</span>}
                    <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                  </span>
                  <span className="font-semibold">
                    {(item.unit_price * item.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center font-semibold text-sm mt-2 pt-2 border-t">
              <span>Total</span>
              <span>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
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
            <p>O dono do produto receberá uma notificação e precisará <strong>aprovar</strong> cada item antes de você poder finalizar a venda.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || items.length === 0} className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              {loading ? "Criando..." : "Enviar para Aprovação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
