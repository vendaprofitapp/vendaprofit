import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, User, Upload, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { HubOrderApprovalDialog } from "./HubOrderApprovalDialog";
import { HubOrderLogisticsDialog } from "./HubOrderLogisticsDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NewSaleDialog, { HubOrderData } from "@/components/sales/NewSaleDialog";

export interface HubPendingOrder {
  id: string;
  connection_id: string;
  seller_id: string;
  owner_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string;
  subtotal: number;
  total: number;
  notes: string | null;
  status: string;
  shipping_label_url: string | null;
  collection_instructions: string | null;
  logistics_set_at: string | null;
  sale_id: string | null;
  finalized_at: string | null;
  created_at: string;
  items?: HubPendingOrderItem[];
}

export interface HubPendingOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_size: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  hub_connection_id: string | null;
  hub_commission_pct: number;
  hub_owner_id: string;
  status: string;
  estimated_dispatch_date: string | null;
  rejection_reason: string | null;
  owner_responded_at: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_hub_approval: { label: "Aguardando aprovação do HUB", variant: "secondary" },
  partially_approved: { label: "Parcialmente aprovado", variant: "outline" },
  awaiting_logistics: { label: "Aprovado – Adicione logística", variant: "default" },
  logistics_ready: { label: "Logística pronta", variant: "default" },
  completed: { label: "Concluído", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const itemStatusConfig: Record<string, { label: string; colorClass: string }> = {
  pending: { label: "Aguardando", colorClass: "text-amber-700 bg-amber-50 border-amber-200" },
  approved: { label: "Aprovado", colorClass: "text-green-700 bg-green-50 border-green-200" },
  rejected: { label: "Rejeitado", colorClass: "text-destructive bg-destructive/10 border-destructive/20" },
  removed: { label: "Removido", colorClass: "text-muted-foreground bg-muted border-border" },
};

interface Props {
  asSeller?: boolean;
}

export function HubPendingOrdersList({ asSeller = true }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [approvalItem, setApprovalItem] = useState<{ order: HubPendingOrder; item: HubPendingOrderItem } | null>(null);
  const [logisticsOrder, setLogisticsOrder] = useState<HubPendingOrder | null>(null);
  const [hubSaleOrder, setHubSaleOrder] = useState<HubOrderData | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  const queryKey = asSeller ? ["hub-seller-pending-orders", user?.id] : ["hub-owner-requests", user?.id];

  const { data: orders = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const query = supabase
        .from("hub_pending_orders")
        .select("*, items:hub_pending_order_items(*)")
        .neq("status", "completed");

      const { data, error } = await (asSeller
        ? query.eq("seller_id", user!.id)
        : query.eq("owner_id", user!.id)
      ).order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as HubPendingOrder[];
    },
    enabled: !!user,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const handleRemoveItem = async (order: HubPendingOrder, itemId: string) => {
    setRemovingItemId(itemId);
    try {
      // Mark item as removed
      const { error } = await supabase
        .from("hub_pending_order_items")
        .update({ status: "removed" })
        .eq("id", itemId);
      if (error) throw error;

      // Recalculate order total and check if any active items remain
      const remainingItems = (order.items ?? []).filter(
        i => i.id !== itemId && i.status !== "removed"
      );
      const newTotal = remainingItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

      if (remainingItems.length === 0) {
        // No items left — cancel the order
        await supabase
          .from("hub_pending_orders")
          .update({ status: "cancelled" })
          .eq("id", order.id);
        toast.success("Todos os itens removidos. Pedido cancelado.");
      } else {
        // Recalculate status: check if any HUB items still pending
        const hubPending = remainingItems.filter(i => i.hub_owner_id !== order.seller_id && i.status === "pending");
        const hubApproved = remainingItems.filter(i => i.hub_owner_id !== order.seller_id && i.status === "approved");
        const allDecided = hubPending.length === 0;

        let newStatus = order.status;
        if (allDecided && hubApproved.length > 0) newStatus = "awaiting_logistics";
        else if (allDecided && hubApproved.length === 0) newStatus = "awaiting_logistics"; // only own items remain

        await supabase
          .from("hub_pending_orders")
          .update({ total: newTotal, subtotal: newTotal, status: newStatus })
          .eq("id", order.id);
        toast.success("Item removido. Total recalculado.");
      }
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover item");
    } finally {
      setRemovingItemId(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>;

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-xl">
        <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">
          {asSeller ? "Nenhum pedido HUB pendente." : "Nenhuma solicitação de HUB pendente."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const statusInfo = statusConfig[order.status] ?? { label: order.status, variant: "outline" as const };
        const activeItems = (order.items ?? []).filter(i => i.status !== "removed");
        const pendingItems = activeItems.filter(i => i.status === "pending");
        const approvedItems = activeItems.filter(i => i.status === "approved");
        const rejectedItems = activeItems.filter(i => i.status === "rejected");
        const hasRejected = rejectedItems.length > 0;
        const hasLogistics = !!order.shipping_label_url || !!order.collection_instructions;
        // Can finalize: logistics set + at least one approved item + no pending hub items
        const hubPendingItems = pendingItems.filter(i => i.hub_owner_id !== order.seller_id);
        const canFinalize = asSeller && hasLogistics && approvedItems.length > 0 && hubPendingItems.length === 0;

        return (
          <Card key={order.id} className="border border-border hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-sm">
                      {order.customer_name || "Cliente não identificado"}
                    </span>
                    <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">
                    {order.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-xs text-muted-foreground">{order.payment_method}</p>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {activeItems.map(item => {
                  const iCfg = itemStatusConfig[item.status] ?? itemStatusConfig.pending;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${item.status === "rejected" ? "opacity-60" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${item.status === "rejected" ? "line-through text-muted-foreground" : ""}`}>
                          {item.product_name}
                          {item.variant_size && <span className="text-muted-foreground ml-1 no-underline">({item.variant_size})</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x {item.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                        {item.estimated_dispatch_date && item.status === "approved" && (
                          <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Despacho previsto: {format(new Date(item.estimated_dispatch_date + "T12:00:00"), "dd/MM/yyyy")}
                          </p>
                        )}
                        {item.rejection_reason && (
                          <p className="text-xs text-destructive mt-0.5">❌ {item.rejection_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${iCfg.colorClass}`}>
                          {iCfg.label}
                        </span>
                        {/* Owner: respond to pending HUB items (not own items) */}
                        {!asSeller && item.status === "pending" && item.hub_owner_id === order.owner_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setApprovalItem({ order, item })}
                          >
                            Responder
                          </Button>
                        )}
                        {/* Seller: remove rejected items */}
                        {asSeller && item.status === "rejected" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs gap-1"
                            disabled={removingItemId === item.id}
                            onClick={() => handleRemoveItem(order, item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                            {removingItemId === item.id ? "..." : "Remover"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Seller actions */}
              {asSeller && (
                <div className="space-y-2">
                  {/* Rejected items notice */}
                  {hasRejected && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2">
                      <p className="text-xs text-destructive font-medium">
                        ⚠️ {rejectedItems.length} item(s) rejeitado(s) pelo dono do produto.
                        {approvedItems.length > 0
                          ? " Você pode prosseguir apenas com os itens aprovados."
                          : " Todos os itens foram rejeitados."}
                      </p>
                    </div>
                  )}

                  {/* Logistics (when all decisions are made) */}
                  {(order.status === "awaiting_logistics" || order.status === "logistics_ready") && approvedItems.length > 0 && (
                    <div>
                      {hasLogistics ? (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-semibold text-primary">📦 Logística definida</p>
                          {order.collection_instructions && (
                            <p className="text-xs text-muted-foreground">{order.collection_instructions}</p>
                          )}
                          {order.shipping_label_url && (
                            <a href={order.shipping_label_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline font-medium">
                              Ver Etiqueta de Envio →
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs mt-2"
                            onClick={() => setLogisticsOrder(order)}
                          >
                            Editar logística
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full gap-2 text-sm"
                          onClick={() => setLogisticsOrder(order)}
                        >
                          <Upload className="h-4 w-4" />
                          Adicionar Etiqueta / Instrução de Coleta
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Convert to sale button */}
                  {canFinalize && (
                    <Button
                      className="w-full gap-2"
                      onClick={() => setHubSaleOrder({
                        pendingOrderId: order.id,
                        ownerUserId: order.owner_id,
                        customerName: order.customer_name,
                        customerPhone: order.customer_phone,
                        paymentMethod: order.payment_method,
                        items: (order.items ?? []).filter(i => i.status === "approved"),
                      })}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Converter em Venda
                    </Button>
                  )}
                </div>
              )}

              {/* Pending count for owner */}
              {!asSeller && pendingItems.length > 0 && (
                <p className="text-xs text-amber-600 font-medium">
                  ⚠️ {pendingItems.length} item(s) aguardando sua resposta
                </p>
              )}

              {/* Logistics visible to owner */}
              {!asSeller && order.status === "logistics_ready" && hasLogistics && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-700">📦 Logística do Vendedor – Pronto para despachar!</p>
                  {order.collection_instructions && (
                    <p className="text-xs text-blue-600">{order.collection_instructions}</p>
                  )}
                  {order.shipping_label_url && (
                    <a href={order.shipping_label_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline font-medium">
                      Abrir Etiqueta de Envio →
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {approvalItem && (
        <HubOrderApprovalDialog
          open={!!approvalItem}
          order={approvalItem.order}
          item={approvalItem.item}
          onClose={() => setApprovalItem(null)}
          onRefresh={() => { refresh(); setApprovalItem(null); }}
        />
      )}

      {logisticsOrder && (
        <HubOrderLogisticsDialog
          open={!!logisticsOrder}
          order={logisticsOrder}
          onClose={() => setLogisticsOrder(null)}
          onRefresh={() => { refresh(); setLogisticsOrder(null); }}
        />
      )}

      {hubSaleOrder && (
        <NewSaleDialog
          open={!!hubSaleOrder}
          onOpenChange={(open) => { if (!open) setHubSaleOrder(null); }}
          hubOrderData={hubSaleOrder}
          onHubOrderProcessed={() => { refresh(); setHubSaleOrder(null); }}
        />
      )}
    </div>
  );
}
