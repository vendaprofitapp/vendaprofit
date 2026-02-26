import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, Package, AlertTriangle } from "lucide-react";
import type { HubPendingOrder } from "./HubPendingOrdersList";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  order: HubPendingOrder;
  onClose: () => void;
  onFinalized: () => void;
}

export function HubFinalizeOrderDialog({ open, order, onClose, onFinalized }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const approvedItems = (order.items ?? []).filter(i => i.status === "approved");
  const rejectedItems = (order.items ?? []).filter(i => i.status === "rejected");

  const totalApproved = approvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const handleFinalize = async () => {
    setLoading(true);
    try {
      // 1. Create the sale via RPC
      const salePayload = {
        owner_id: user!.id,
        sale: {
          owner_id: user!.id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          payment_method: order.payment_method,
          subtotal: totalApproved,
          discount_type: null,
          discount_value: 0,
          discount_amount: 0,
          total: totalApproved,
          notes: order.notes,
          status: "completed",
          sale_source: "manual",
        },
        items: approvedItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.unit_price * item.quantity,
          source: "hub",
        })),
        stock_updates: approvedItems
          .filter(i => i.product_id)
          .map(i => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            quantity: i.quantity,
          })),
        financial_splits: [],
        payment_reminders: null,
        shipping_expense: null,
      };

      const { data: result, error } = await supabase.rpc("create_sale_transaction", { payload: salePayload });
      if (error) throw error;
      const rpcResult = result as any;
      if (!rpcResult?.success) throw new Error(rpcResult?.error || "Erro ao criar venda");

      // 2. Insert hub_sale_splits for each approved item
      const hubSplits = approvedItems.map(item => {
        const grossProfit = item.unit_price * item.quantity - item.cost_price * item.quantity;
        const commissionAmount = grossProfit * (item.hub_commission_pct / 100);
        const sellerAmount = grossProfit - commissionAmount;
        return {
          sale_id: rpcResult.sale_id,
          connection_id: item.hub_connection_id,
          owner_id: item.hub_owner_id,
          seller_id: user!.id,
          commission_pct: item.hub_commission_pct,
          gross_profit: grossProfit,
          fee_amount: 0,
          shipping_amount: 0,
          commission_amount: commissionAmount,
          owner_amount: item.cost_price * item.quantity + commissionAmount,
          seller_amount: sellerAmount,
        };
      });
      if (hubSplits.length > 0) {
        await supabase.from("hub_sale_splits").insert(hubSplits);
      }

      // 3. Mark pending order as completed
      await supabase
        .from("hub_pending_orders")
        .update({
          status: "completed",
          sale_id: rpcResult.sale_id,
          finalized_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      // 4. Notify owner
      await supabase.from("hub_order_notifications").insert({
        recipient_id: order.owner_id,
        order_id: order.id,
        type: "order_finalized",
        message: `🎉 Venda finalizada! O pedido de ${order.customer_name || "cliente"} foi concluído. Splits gerados.`,
      });

      queryClient.invalidateQueries({ queryKey: ["hub-seller-pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["hub-sale-splits"] });

      toast.success("Venda finalizada com sucesso! Splits de lucro gerados.");
      onFinalized();
    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar venda");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Finalizar Venda HUB</DialogTitle>
          <DialogDescription>
            Revise o resumo antes de confirmar. Esta ação criará a venda definitiva e descontará o estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Approved items */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Itens aprovados</p>
            <div className="space-y-1.5">
              {approvedItems.map(item => (
                <div key={item.id} className="flex justify-between items-center text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span className="font-medium">
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

          {/* Rejected items (informational) */}
          {rejectedItems.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <p className="text-xs font-semibold text-destructive">Itens excluídos (rejeitados pelo dono)</p>
              </div>
              {rejectedItems.map(item => (
                <p key={item.id} className="text-xs text-muted-foreground line-through">{item.product_name}</p>
              ))}
            </div>
          )}

          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-semibold">Total a cobrar do cliente:</span>
            <span className="text-lg font-bold text-primary">
              {totalApproved.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="gap-2" onClick={handleFinalize} disabled={loading || approvedItems.length === 0}>
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Finalizando..." : "Confirmar Venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
