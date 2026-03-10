/**
 * ReportHubFornecedor.tsx
 * Financial report for users acting as HUB SUPPLIERS.
 * Shows concluded B2B orders where the current user is the product owner (fornecedor).
 */
import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, Download, TrendingUp, DollarSign, Package, Users } from "lucide-react";
import { downloadXlsx } from "@/utils/xlsExport";
import { toast } from "sonner";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ReportHubFornecedor() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  // Fetch concluded orders where user is the SUPPLIER (hub_owner_id in items)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["report-hub-fornecedor", user?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch order items where I am the hub_owner (supplier)
      const { data: items, error: itemsError } = await supabase
        .from("hub_pending_order_items")
        .select(`
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          cost_price,
          hub_commission_pct,
          status,
          hub_owner_id,
          hub_pending_orders!inner (
            id,
            status,
            seller_id,
            created_at,
            finalized_at
          )
        `)
        .eq("hub_owner_id", user.id)
        .eq("hub_pending_orders.status", "CONCLUIDO")
        .gte("hub_pending_orders.finalized_at", `${dateFrom}T00:00:00`)
        .lte("hub_pending_orders.finalized_at", `${dateTo}T23:59:59`);

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return [];

      // Fetch seller profiles
      const sellerIds = [...new Set(
        items
          .map((i: any) => i.hub_pending_orders?.seller_id)
          .filter(Boolean)
      )];
      const profileMap = new Map<string, string>();
      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, store_name")
          .in("id", sellerIds);
        (profiles ?? []).forEach((p: any) =>
          profileMap.set(p.id, p.store_name || p.full_name || "—")
        );
      }

      // Fetch product costs
      const productIds = [...new Set(items.map((i: any) => i.product_id).filter(Boolean))];
      const costMap = new Map<string, number>();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, cost_price")
          .in("id", productIds);
        (products ?? []).forEach((p: any) => costMap.set(p.id, p.cost_price ?? 0));
      }

      return items.map((item: any) => {
        const order = item.hub_pending_orders;
        const sellerId = order?.seller_id ?? null;
        const costOriginal = costMap.get(item.product_id) ?? item.cost_price ?? 0;
        // Revenue received = unit_price (what seller paid per unit) * quantity
        const revenueReceived = item.unit_price * item.quantity;
        const totalCost = costOriginal * item.quantity;
        const netProfit = revenueReceived - totalCost;

        return {
          id: item.id,
          orderId: item.order_id,
          date: order?.finalized_at ?? order?.created_at ?? null,
          sellerName: sellerId ? (profileMap.get(sellerId) ?? "—") : "—",
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          revenueReceived,
          costOriginal: totalCost,
          netProfit,
        };
      });
    },
    enabled: !!user,
  });

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    for (const o of orders) {
      totalRevenue += o.revenueReceived;
      totalCost += o.costOriginal;
      totalProfit += o.netProfit;
    }
    return { totalRevenue, totalCost, totalProfit, count: orders.length };
  }, [orders]);

  // Unique sellers
  const uniqueSellers = useMemo(() => {
    return new Set(orders.map(o => o.sellerName)).size;
  }, [orders]);

  function handleExport() {
    if (orders.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const headers = ["Data", "Vendedor", "Produto", "Qtd", "Preço Unitário", "Receita B2B", "Custo Original", "Lucro Líquido"];
    const rows = orders.map(o => [
      o.date ? format(parseISO(o.date), "dd/MM/yyyy") : "—",
      o.sellerName,
      o.productName,
      o.quantity,
      o.unitPrice,
      o.revenueReceived,
      o.costOriginal,
      o.netProfit,
    ]);
    downloadXlsx([headers, ...rows], "HUB Fornecedor", `hub-fornecedor-${dateFrom}-a-${dateTo}.xlsx`);
    toast.success("Exportado!");
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Relatório HUB Fornecedor</h1>
              <p className="text-muted-foreground text-sm">Pedidos B2B concluídos onde você foi o fornecedor</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={orders.length === 0} variant="outline">
            <Download className="h-4 w-4 mr-2" /> Exportar XLS
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground">De</label>
                <input
                  type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Até</label>
                <input
                  type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-background"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Receita B2B Total</span>
              </div>
              <p className="text-xl font-bold text-primary">{fmt(summary.totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Custo Total dos Produtos</span>
              </div>
              <p className="text-xl font-bold text-destructive">{fmt(summary.totalCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-xs text-muted-foreground">Lucro Líquido B2B</span>
              </div>
              <p className={`text-xl font-bold ${summary.totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
                {fmt(summary.totalProfit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Vendedores Ativos</span>
              </div>
              <p className="text-xl font-bold">{uniqueSellers}</p>
              <p className="text-xs text-muted-foreground">{summary.count} itens concluídos</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Detalhamento por Item
              <span className="text-muted-foreground text-sm font-normal ml-2">
                ({orders.length} registro{orders.length !== 1 ? "s" : ""})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Nenhum pedido B2B concluído no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Vendedor (Comprador)</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Receita B2B</TableHead>
                      <TableHead className="text-right">Custo Original</TableHead>
                      <TableHead className="text-right">Lucro Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(o => {
                      const margin = o.revenueReceived > 0
                        ? (o.netProfit / o.revenueReceived) * 100
                        : 0;
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {o.date ? format(parseISO(o.date), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{o.sellerName}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{o.productName}</TableCell>
                          <TableCell className="text-center text-sm">{o.quantity}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-primary">
                            {fmt(o.revenueReceived)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-destructive">
                            {fmt(o.costOriginal)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <span className={`font-bold ${o.netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                              {fmt(o.netProfit)}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              {margin.toFixed(1)}% margem
                            </span>
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
