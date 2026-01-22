import { useState } from "react";
import { useOrders, CustomerOrder } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ShoppingCart,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface GroupedProduct {
  productName: string;
  totalQuantity: number;
  details: Array<{
    customerName: string;
    quantity: number;
    notes: string | null;
    isPartner: boolean;
    partnerName?: string;
  }>;
}

export function ShoppingList() {
  const { ordersBySupplier, ordersLoading, currentUserId } = useOrders();
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(
    new Set()
  );
  const [copiedSupplier, setCopiedSupplier] = useState<string | null>(null);

  const toggleSupplier = (supplier: string) => {
    setExpandedSuppliers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(supplier)) {
        newSet.delete(supplier);
      } else {
        newSet.add(supplier);
      }
      return newSet;
    });
  };

  const groupOrdersByProduct = (
    orders: CustomerOrder[]
  ): Record<string, GroupedProduct> => {
    const grouped: Record<string, GroupedProduct> = {};

    orders.forEach((order) => {
      const key = order.product_name.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          productName: order.product_name,
          totalQuantity: 0,
          details: [],
        };
      }

      grouped[key].totalQuantity += order.quantity;
      grouped[key].details.push({
        customerName: order.customer_name,
        quantity: order.quantity,
        notes: order.notes,
        isPartner: order.user_id !== currentUserId,
        partnerName: order.profiles?.full_name,
      });
    });

    return grouped;
  };

  const generateWhatsAppMessage = (
    supplierName: string,
    orders: CustomerOrder[]
  ) => {
    const grouped = groupOrdersByProduct(orders);
    const totalPieces = orders.reduce((sum, o) => sum + o.quantity, 0);

    let message = `🛒 *PEDIDO - ${supplierName}*\n`;
    message += `📦 Total: ${totalPieces} peça(s)\n\n`;

    Object.values(grouped).forEach((product) => {
      message += `▫️ ${product.productName} - *${product.totalQuantity}x*\n`;
      product.details.forEach((detail) => {
        const partnerTag = detail.isPartner ? " (Parceira)" : "";
        const notesTag = detail.notes ? ` [${detail.notes}]` : "";
        message += `   └ ${detail.quantity}x p/ ${detail.customerName}${partnerTag}${notesTag}\n`;
      });
      message += "\n";
    });

    message += "---\n";
    message += "_Enviado via Venda PROFIT_";

    return message;
  };

  const copyToClipboard = async (supplierName: string) => {
    const orders = ordersBySupplier[supplierName];
    const message = generateWhatsAppMessage(supplierName, orders);

    try {
      await navigator.clipboard.writeText(message);
      setCopiedSupplier(supplierName);
      toast.success("Pedido copiado para a área de transferência!");
      setTimeout(() => setCopiedSupplier(null), 2000);
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  if (ordersLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const suppliers = Object.keys(ordersBySupplier);

  if (suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Lista de compras vazia
          </h3>
          <p className="text-muted-foreground max-w-sm">
            Quando você tiver encomendas pendentes, elas aparecerão aqui
            agrupadas por fornecedor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {suppliers.length} fornecedor(es) com pedidos pendentes
        </h3>
      </div>

      {suppliers.map((supplierName) => {
        const orders = ordersBySupplier[supplierName];
        const grouped = groupOrdersByProduct(orders);
        const totalPieces = orders.reduce((sum, o) => sum + o.quantity, 0);
        const isExpanded = expandedSuppliers.has(supplierName);

        return (
          <Card key={supplierName}>
            <Collapsible
              open={isExpanded}
              onOpenChange={() => toggleSupplier(supplierName)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 p-0 h-auto hover:bg-transparent"
                    >
                      <CardTitle className="text-lg">{supplierName}</CardTitle>
                      <Badge variant="secondary">{totalPieces} peça(s)</Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(supplierName)}
                    className="shrink-0"
                  >
                    {copiedSupplier === supplierName ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Pedido
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {Object.values(grouped).map((product) => (
                    <div
                      key={product.productName}
                      className="p-3 rounded-lg bg-muted/50 border"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium">{product.productName}</span>
                        <Badge variant="outline">
                          Total: {product.totalQuantity}
                        </Badge>
                      </div>

                      <div className="pl-6 space-y-1">
                        {product.details.map((detail, idx) => (
                          <div
                            key={idx}
                            className="text-sm flex items-center gap-2"
                          >
                            <span className="text-muted-foreground">
                              {detail.quantity}x
                            </span>
                            <span>p/ {detail.customerName}</span>
                            {detail.isPartner && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-primary/10 text-primary border-primary/20"
                              >
                                Parceira
                              </Badge>
                            )}
                            {detail.notes && (
                              <span className="text-xs text-muted-foreground italic">
                                [{detail.notes}]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
