import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Package, Users } from "lucide-react";
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

  // Separate own items (hub_owner_id === seller_id) from HUB items
  const ownApprovedItems = approvedItems.filter(i => i.hub_owner_id === order.seller_id);
  const hubApprovedItems = approvedItems.filter(i => i.hub_owner_id !== order.seller_id);

  const totalApproved = approvedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const handleFinalize = async () => {
    setLoading(true);
    try {
      // 1. Build stock updates for ALL approved items (own + HUB)
      const stockUpdates = approvedItems
        .filter(i => i.product_id)
        .map(i => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
        }));

      // 2. Build financial splits ONLY for HUB items (own items have no split)
      const financialSplits = hubApprovedItems.map(item => {
        const grossProfit = item.unit_price * item.quantity - item.cost_price * item.quantity;
        const commissionAmount = grossProfit * (item.hub_commission_pct / 100);
        const sellerShare = grossProfit - commissionAmount;
        return {
          user_id: user!.id,
          amount: sellerShare,
          type: "profit_share",
          description: `HUB: ${item.product_name} – parte do vendedor`,
        };
      });

      // 3. Create the sale via RPC
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
          source: item.hub_owner_id === order.seller_id ? "estoque_proprio" : "hub",
        })),
        stock_updates: stockUpdates,
        financial_splits: financialSplits,
        payment_reminders: null,
        shipping_expense: null,
      };

      const { data: result, error } = await supabase.rpc("create_sale_transaction", { payload: salePayload });
      if (error) throw error;
      const rpcResult = result as any;
      if (!rpcResult?.success) throw new Error(rpcResult?.error || "Erro ao criar venda");

      // 4. Insert hub_sale_splits for HUB items only
      if (hubApprovedItems.length > 0) {
        const hubSplits = hubApprovedItems.map(item => {
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
            product_id: item.product_id || null,
            product_name: item.product_name || null,
          };
        });
        await supabase.from("hub_sale_splits").insert(hubSplits);
      }

      // 5. Mark pending order as completed
      await supabase
        .from("hub_pending_orders")
        .update({
          status: "completed",
          sale_id: rpcResult.sale_id,
          finalized_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      // 6. Notify HUB owner(s) — only if there were HUB items
      if (hubApprovedItems.length > 0) {
        await supabase.from("hub_order_notifications").insert({
          recipient_id: order.owner_id,
          order_id: order.id,
          type: "order_finalized",
          message: `🎉 Venda finalizada! O pedido de ${order.customer_name || "cliente"} foi concluído. Splits de lucro gerados.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["hub-seller-pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["hub-pending-orders-count"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["hub-sale-splits"] });

      toast.success("Venda finalizada com sucesso!");
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
          {/* Own items */}
          {ownApprovedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seus itens</p>
              </div>
              <div className="space-y-1.5">
                {ownApprovedItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm bg-muted/40 border border-border rounded-lg px-3 py-2">
                    <span className="font-medium">
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
            </div>
          )}

          {/* HUB items */}
          {hubApprovedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Itens HUB aprovados</p>
              </div>
              <div className="space-y-1.5">
                {hubApprovedItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <span className="font-medium">
                      {item.product_name}
                      {item.variant_size && <span className="text-muted-foreground ml-1">({item.variant_size})</span>}
                      <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                    </span>
                    <span className="font-semibold text-primary">
                      {(item.unit_price * item.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected items */}
          {rejectedItems.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <p className="text-xs font-semibold text-destructive">Itens removidos (rejeitados)</p>
              </div>
              {rejectedItems.map(item => (
                <p key={item.id} className="text-xs text-muted-foreground line-through">{item.product_name}</p>
              ))}
            </div>
          )}

          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-semibold">Total a cobrar:</span>
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
