import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle, XCircle, Calendar } from "lucide-react";
import type { HubPendingOrder, HubPendingOrderItem } from "./HubOwnerRequestsList";

interface Props {
  open: boolean;
  order: HubPendingOrder;
  item: HubPendingOrderItem;
  onClose: () => void;
  onRefresh: () => void;
}

export function HubOrderApprovalDialog({ open, order, item, onClose, onRefresh }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"decide" | "approve" | "reject">("decide");
  const [dispatchDate, setDispatchDate] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    if (!dispatchDate) { toast.error("Informe a data prevista de postagem."); return; }
    setLoading(true);
    try {
      // Update the item status
      const { error: itemErr } = await supabase
        .from("hub_pending_order_items")
        .update({
          status: "approved",
          estimated_dispatch_date: dispatchDate,
          owner_responded_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (itemErr) throw itemErr;

      // Recalculate order status
      await recalcOrderStatus(order.id);

      // Notify seller
      await supabase.from("hub_order_notifications").insert({
        recipient_id: order.seller_id,
        order_id: order.id,
        type: "item_approved",
        message: `✅ "${item.product_name}" foi aprovado! Despacho previsto para ${dispatchDate}.`,
      });

      toast.success("Item aprovado com sucesso!");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar item");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const { error: itemErr } = await supabase
        .from("hub_pending_order_items")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason || "Sem estoque disponível",
          owner_responded_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (itemErr) throw itemErr;

      await recalcOrderStatus(order.id);

      // Notify seller
      await supabase.from("hub_order_notifications").insert({
        recipient_id: order.seller_id,
        order_id: order.id,
        type: "item_rejected",
        message: `❌ "${item.product_name}" foi rejeitado. ${rejectionReason ? `Motivo: ${rejectionReason}` : ""}`,
      });

      toast.success("Item rejeitado.");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao rejeitar item");
    } finally {
      setLoading(false);
    }
  };

  const recalcOrderStatus = async (orderId: string) => {
    const { data: items } = await supabase
      .from("hub_pending_order_items")
      .select("status")
      .eq("order_id", orderId);

    if (!items) return;
    const activeItems = items.filter(i => i.status !== "removed");
    const allApproved = activeItems.every(i => i.status === "approved");
    const anyPending = activeItems.some(i => i.status === "pending");
    const allRejected = activeItems.every(i => i.status === "rejected");
    const hasApproved = activeItems.some(i => i.status === "approved");

    let newStatus = "partially_approved";
    if (allApproved) newStatus = "awaiting_logistics";
    else if (anyPending) newStatus = "pending_hub_approval";
    else if (allRejected) newStatus = "cancelled";
    else if (hasApproved && !anyPending) newStatus = "awaiting_logistics";

    await supabase
      .from("hub_pending_orders")
      .update({ status: newStatus })
      .eq("id", orderId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Responder Solicitação HUB</DialogTitle>
          <DialogDescription>
            <span className="font-semibold">{item.product_name}</span>
            {item.variant_size && ` – Tamanho: ${item.variant_size}`}
            <br />
            {item.quantity}x {item.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </DialogDescription>
        </DialogHeader>

        {mode === "decide" && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              O vendedor solicitou este produto. Você tem estoque disponível?
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => setMode("approve")}
              >
                <CheckCircle className="h-4 w-4" />
                Tenho Estoque
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={() => setMode("reject")}
              >
                <XCircle className="h-4 w-4" />
                Não Tenho
              </Button>
            </div>
          </div>
        )}

        {mode === "approve" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Data Prevista de Postagem/Liberação
              </Label>
              <Input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
              />
              <p className="text-xs text-muted-foreground">
                O vendedor será notificado com esta data para organizar a logística.
              </p>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("decide")}>Voltar</Button>
              <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={loading}>
                <CheckCircle className="h-4 w-4" />
                {loading ? "Aprovando..." : "Confirmar Aprovação"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "reject" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Motivo da rejeição (opcional)</Label>
              <Textarea
                placeholder="Ex: sem estoque disponível, produto descontinuado..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("decide")}>Voltar</Button>
              <Button variant="destructive" className="gap-2" onClick={handleReject} disabled={loading}>
                <XCircle className="h-4 w-4" />
                {loading ? "Rejeitando..." : "Confirmar Rejeição"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
