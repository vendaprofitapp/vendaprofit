import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Package, Clock, User, ShoppingBag } from "lucide-react";
import { HubOrderApprovalDialog } from "./HubOrderApprovalDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  pending_hub_approval: { label: "Aguardando sua aprovação", variant: "secondary" },
  partially_approved: { label: "Parcialmente aprovado", variant: "outline" },
  awaiting_logistics: { label: "Aguardando logística", variant: "default" },
  logistics_ready: { label: "Pronto p/ despachar", variant: "default" },
  completed: { label: "Concluído", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const itemStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Aguardando", color: "text-amber-600 bg-amber-50" },
  approved: { label: "Aprovado", color: "text-green-600 bg-green-50" },
  rejected: { label: "Rejeitado", color: "text-destructive bg-destructive/10" },
  removed: { label: "Removido", color: "text-muted-foreground bg-muted" },
};

export function HubOwnerRequestsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<HubPendingOrder | null>(null);
  const [approvalItem, setApprovalItem] = useState<HubPendingOrderItem | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["hub-owner-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_pending_orders")
        .select("*, items:hub_pending_order_items(*)")
        .eq("owner_id", user!.id)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HubPendingOrder[];
    },
    enabled: !!user,
  });

  const pendingOrders = orders.filter(o =>
    o.status === "pending_hub_approval" || o.status === "partially_approved"
  );
  const logisticsOrders = orders.filter(o =>
    o.status === "awaiting_logistics" || o.status === "logistics_ready"
  );

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>;

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-xl">
        <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">Nenhuma solicitação de HUB pendente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingOrders.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
            Aguardando sua aprovação ({pendingOrders.length})
          </h3>
          <div className="space-y-3">
            {pendingOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                isOwner
                onApproveItem={(item) => { setSelectedOrder(order); setApprovalItem(item); }}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["hub-owner-requests"] })}
              />
            ))}
          </div>
        </div>
      )}

      {logisticsOrders.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
            Em andamento – Logística ({logisticsOrders.length})
          </h3>
          <div className="space-y-3">
            {logisticsOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                isOwner
                onApproveItem={() => {}}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["hub-owner-requests"] })}
              />
            ))}
          </div>
        </div>
      )}

      {approvalItem && selectedOrder && (
        <HubOrderApprovalDialog
          open={!!approvalItem}
          order={selectedOrder}
          item={approvalItem}
          onClose={() => { setApprovalItem(null); setSelectedOrder(null); }}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ["hub-owner-requests"] });
            setApprovalItem(null);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}

function OrderCard({
  order,
  isOwner,
  onApproveItem,
  onRefresh,
}: {
  order: HubPendingOrder;
  isOwner: boolean;
  onApproveItem: (item: HubPendingOrderItem) => void;
  onRefresh: () => void;
}) {
  const statusInfo = statusConfig[order.status] ?? { label: order.status, variant: "outline" as const };
  const pendingItems = (order.items ?? []).filter(i => i.status === "pending");
  const hasLogistics = !!order.shipping_label_url || !!order.collection_instructions;

  return (
    <Card className="border border-border hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
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
          {(order.items ?? []).filter(i => i.status !== "removed").map(item => {
            const itemStatus = itemStatusConfig[item.status] ?? { label: item.status, color: "text-muted-foreground bg-muted" };
            const isPending = item.status === "pending";
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.product_name}
                    {item.variant_size && <span className="text-muted-foreground ml-1">({item.variant_size})</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity}x {item.unit_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  {item.estimated_dispatch_date && (
                    <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Despacho: {format(new Date(item.estimated_dispatch_date + "T12:00:00"), "dd/MM/yyyy")}
                    </p>
                  )}
                  {item.rejection_reason && (
                    <p className="text-xs text-destructive mt-0.5">Motivo: {item.rejection_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${itemStatus.color}`}>
                    {itemStatus.label}
                  </span>
                  {isOwner && isPending && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => onApproveItem(item)}
                    >
                      Responder
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Logistics info (for owner when logistics_ready) */}
        {order.status === "logistics_ready" && hasLogistics && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-blue-700">📦 Logística do Vendedor</p>
            {order.collection_instructions && (
              <p className="text-xs text-blue-600">{order.collection_instructions}</p>
            )}
            {order.shipping_label_url && (
              <a
                href={order.shipping_label_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline font-medium"
              >
                Abrir Etiqueta de Envio →
              </a>
            )}
          </div>
        )}

        {pendingItems.length > 0 && isOwner && (
          <p className="text-xs text-amber-600 font-medium">
            ⚠️ {pendingItems.length} item(s) aguardando sua resposta
          </p>
        )}
      </CardContent>
    </Card>
  );
}
