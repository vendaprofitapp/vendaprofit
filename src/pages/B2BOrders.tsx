import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, ExternalLink, CheckCircle, Truck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface B2BOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  source: string | null;
  b2b_status: string | null;
  sale_id: string;
  sale: {
    id: string;
    customer_name: string | null;
    customer_phone: string | null;
    created_at: string;
    status: string;
  };
  product: {
    id: string;
    b2b_product_url: string | null;
    supplier_id: string | null;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
  ordered: { label: "Comprado", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Truck },
  received: { label: "Recebido", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle },
};

export default function B2BOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: b2bItems = [], isLoading } = useQuery({
    queryKey: ["b2b-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          id, product_id, product_name, quantity, unit_price, total, source, b2b_status, sale_id,
          sale:sales!inner(id, customer_name, customer_phone, created_at, status, owner_id),
          product:products(id, b2b_product_url, supplier_id)
        `)
        .eq("source", "b2b")
        .eq("sales.owner_id", user?.id)
        .order("created_at", { foreignTable: "sales", ascending: false });

      if (error) throw error;
      return (data || []) as unknown as B2BOrderItem[];
    },
    enabled: !!user,
  });

  const updateStatus = async (itemId: string, newStatus: string) => {
    const { error } = await supabase
      .from("sale_items")
      .update({ b2b_status: newStatus } as any)
      .eq("id", itemId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(`Status atualizado para "${statusConfig[newStatus]?.label || newStatus}"`);
    queryClient.invalidateQueries({ queryKey: ["b2b-orders"] });
  };

  const filteredItems = statusFilter === "all"
    ? b2bItems
    : b2bItems.filter(item => item.b2b_status === statusFilter);

  const counts = {
    all: b2bItems.length,
    pending: b2bItems.filter(i => i.b2b_status === "pending").length,
    ordered: b2bItems.filter(i => i.b2b_status === "ordered").length,
    received: b2bItems.filter(i => i.b2b_status === "received").length,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pedidos B2B</h1>
          <p className="text-muted-foreground">
            Gerencie pedidos de produtos sob encomenda (dropshipping)
          </p>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: "all", label: "Todos", count: counts.all, color: "text-foreground" },
            { key: "pending", label: "Pendentes", count: counts.pending, color: "text-yellow-600" },
            { key: "ordered", label: "Comprados", count: counts.ordered, color: "text-blue-600" },
            { key: "received", label: "Recebidos", count: counts.received, color: "text-green-600" },
          ].map(({ key, label, count, color }) => (
            <Card
              key={key}
              className={`cursor-pointer transition-all ${statusFilter === key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens B2B ({filteredItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum pedido B2B encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const config = statusConfig[item.b2b_status || "pending"] || statusConfig.pending;
                      const StatusIcon = config.icon;
                      const b2bUrl = item.product?.b2b_product_url;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {item.product_name}
                          </TableCell>
                          <TableCell>{item.sale?.customer_name || "—"}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>R$ {item.total.toFixed(2)}</TableCell>
                          <TableCell>
                            {item.sale?.created_at
                              ? new Date(item.sale.created_at).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {b2bUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(b2bUrl, "_blank")}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Comprar
                                </Button>
                              )}
                              {item.b2b_status === "pending" && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => updateStatus(item.id, "ordered")}
                                >
                                  <Truck className="h-3 w-3 mr-1" />
                                  Comprado
                                </Button>
                              )}
                              {item.b2b_status === "ordered" && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => updateStatus(item.id, "received")}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Recebido
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
