import { useOrders, CustomerOrder } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Trash2, Users, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels: Record<CustomerOrder["status"], string> = {
  pending: "Pendente",
  ordered: "Pedido Feito",
  arrived: "Chegou",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const statusColors: Record<CustomerOrder["status"], string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  ordered: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  arrived: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  delivered: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function OrdersList() {
  const {
    pendingOrders,
    ordersLoading,
    updateOrderStatus,
    deleteOrder,
    currentUserId,
  } = useOrders();

  if (ordersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Encomendas Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Encomendas Pendentes
          {pendingOrders.length > 0 && (
            <Badge variant="secondary">{pendingOrders.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma encomenda pendente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingOrders.map((order) => {
              const isPartnerOrder = order.user_id !== currentUserId;

              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    isPartnerOrder
                      ? "bg-accent/30 border-accent"
                      : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium truncate">
                          {order.product_name}
                        </h4>
                        {isPartnerOrder && (
                          <Badge
                            variant="outline"
                            className="shrink-0 bg-primary/10 text-primary border-primary/20"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            Pedido da Parceira
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-muted-foreground space-y-1">
                        <p>
                          <span className="font-medium">Cliente:</span>{" "}
                          {order.customer_name}
                        </p>
                        <p>
                          <span className="font-medium">Fornecedor:</span>{" "}
                          {order.supplier_name}
                        </p>
                        <p>
                          <span className="font-medium">Qtd:</span>{" "}
                          {order.quantity}
                        </p>
                        {order.notes && (
                          <p className="text-xs italic">📝 {order.notes}</p>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                        {isPartnerOrder &&
                          order.profiles?.full_name &&
                          ` • por ${order.profiles.full_name}`}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {/* Status select - only for own orders */}
                      {!isPartnerOrder && (
                        <Select
                          value={order.status}
                          onValueChange={(value) =>
                            updateOrderStatus.mutate({
                              orderId: order.id,
                              status: value as CustomerOrder["status"],
                            })
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={`${statusColors[value as CustomerOrder["status"]]} px-2 py-0.5`}
                                  >
                                    {label}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Status badge for partner orders (read-only) */}
                      {isPartnerOrder && (
                        <Badge
                          variant="outline"
                          className={statusColors[order.status]}
                        >
                          {statusLabels[order.status]}
                        </Badge>
                      )}

                      {/* Delete button - only for own orders */}
                      {!isPartnerOrder && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remover encomenda?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A encomenda de "
                                {order.product_name}" para {order.customer_name}{" "}
                                será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteOrder.mutate(order.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
