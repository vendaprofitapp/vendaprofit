/**
 * ReportHubVendedor.tsx
 * Financial report for users acting as HUB SELLERS (reselling supplier products).
 * Shows concluded B2B orders with full cost breakdown:
 *   Revenue (B2C sale price) − Cost B2B (supplier cost + platform fee) − Shipping = Net Profit
 */
import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShoppingBasket, Download, TrendingUp, Package, Truck, DollarSign } from "lucide-react";
import { downloadXlsx } from "@/utils/xlsExport";
import { toast } from "sonner";
import { calcHubFee } from "@/hooks/useHubFeeCalculator";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ReportHubVendedor() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [supplierFilter, setSupplierFilter] = useState("all");

  // Fetch concluded orders where I am the SELLER
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["report-hub-vendedor", user?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!user?.id) return [];

      // Orders where I'm the seller
      const { data: ordersData, error: ordersError } = await supabase
        .from("hub_pending_orders")
        .select(`
          id,
          seller_id,
          owner_id,
          status,
          created_at,
          finalized_at,
          subtotal,
          hub_pending_order_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            cost_price,
            hub_commission_pct,
            hub_owner_id,
            status
          )
        `)
        .eq("seller_id", user.id)
        .eq("status", "CONCLUIDO")
        .gte("finalized_at", `${dateFrom}T00:00:00`)
        .lte("finalized_at", `${dateTo}T23:59:59`);

      if (ordersError) throw ordersError;
      if (!ordersData || ordersData.length === 0) return [];

      // Collect supplier (owner) IDs
      const supplierIds = [...new Set(ordersData.map((o: any) => o.owner_id).filter(Boolean))];
      const profileMap = new Map<string, { name: string; feeType: string | null; feeValue: number | null }>();
      if (supplierIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, store_name, hub_fee_type, hub_fee_value")
          .in("id", supplierIds);
        (profiles ?? []).forEach((p: any) =>
          profileMap.set(p.id, {
            name: p.store_name || p.full_name || "—",
            feeType: p.hub_fee_type ?? null,
            feeValue: p.hub_fee_value ?? null,
          })
        );
      }

      // Collect product IDs to get admin_hub_fee overrides
      const productIds = [...new Set(
        ordersData.flatMap((o: any) =>
          (o.hub_pending_order_items ?? []).map((i: any) => i.product_id).filter(Boolean)
        )
      )];
      const productFeeMap = new Map<string, { feeType: string | null; feeValue: number | null }>();
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, admin_hub_fee_type, admin_hub_fee_value")
          .in("id", productIds);
        (prods ?? []).forEach((p: any) =>
          productFeeMap.set(p.id, {
            feeType: p.admin_hub_fee_type ?? null,
            feeValue: p.admin_hub_fee_value ?? null,
          })
        );
      }

      // Build rows — one row per order item
      const result: any[] = [];
      for (const order of ordersData as any[]) {
        const supplier = profileMap.get(order.owner_id) ?? { name: "—", feeType: null, feeValue: null };
        const items = order.hub_pending_order_items ?? [];
        for (const item of items) {
          const costB2B = item.cost_price ?? 0; // what seller pays to supplier
          const qty = item.quantity ?? 1;
          const prodFee = productFeeMap.get(item.product_id) ?? { feeType: null, feeValue: null };

          // Platform fee via cascade
          const { feeAmount } = calcHubFee({
            costPrice: costB2B,
            productFeeType: prodFee.feeType as any,
            productFeeValue: prodFee.feeValue,
            supplierFeeType: supplier.feeType as any,
            supplierFeeValue: supplier.feeValue,
          });

          const totalCostB2B = (costB2B + feeAmount) * qty;
          const b2cRevenue = item.unit_price * qty; // what seller received from end customer
          const netProfit = b2cRevenue - totalCostB2B;

          result.push({
            id: item.id,
            orderId: order.id,
            date: order.finalized_at ?? order.created_at,
            supplierName: supplier.name,
            supplierId: order.owner_id,
            productName: item.product_name,
            quantity: qty,
            b2cRevenue,
            costB2BUnit: costB2B,
            platformFeeUnit: feeAmount,
            totalCostB2B,
            netProfit,
          });
        }
      }

      return result;
    },
    enabled: !!user,
  });

  // Unique suppliers for filter
  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => map.set(r.supplierId, r.supplierName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (supplierFilter === "all") return rows;
    return rows.filter(r => r.supplierId === supplierFilter);
  }, [rows, supplierFilter]);

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalCostB2B = 0;
    let totalProfit = 0;
    for (const r of filteredRows) {
      totalRevenue += r.b2cRevenue;
      totalCostB2B += r.totalCostB2B;
      totalProfit += r.netProfit;
    }
    return { totalRevenue, totalCostB2B, totalProfit, count: filteredRows.length };
  }, [filteredRows]);

  function handleExport() {
    if (filteredRows.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const headers = [
      "Data", "Fornecedor", "Produto", "Qtd",
      "Receita B2C", "Custo B2B (Fornecedor)", "Taxa Plataforma", "Custo Total B2B", "Lucro Líquido",
    ];
    const rows2 = filteredRows.map(r => [
      r.date ? format(parseISO(r.date), "dd/MM/yyyy") : "—",
      r.supplierName,
      r.productName,
      r.quantity,
      r.b2cRevenue,
      r.costB2BUnit * r.quantity,
      r.platformFeeUnit * r.quantity,
      r.totalCostB2B,
      r.netProfit,
    ]);
    downloadXlsx([headers, ...rows2], "HUB Vendedor", `hub-vendedor-${dateFrom}-a-${dateTo}.xlsx`);
    toast.success("Exportado!");
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBasket className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Relatório HUB Vendedor</h1>
              <p className="text-muted-foreground text-sm">Lucro real das vendas de produtos de fornecedores</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={filteredRows.length === 0} variant="outline">
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
              <div className="min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Fornecedor</label>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Fornecedores</SelectItem>
                    {supplierOptions.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Receita B2C Total</span>
              </div>
              <p className="text-xl font-bold text-primary">{fmt(summary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">valor cobrado ao cliente final</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Custo B2B Total</span>
              </div>
              <p className="text-xl font-bold text-destructive">{fmt(summary.totalCostB2B)}</p>
              <p className="text-xs text-muted-foreground">fornecedor + taxa plataforma</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-xs text-muted-foreground">Lucro Líquido Real</span>
              </div>
              <p className={`text-xl font-bold ${summary.totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
                {fmt(summary.totalProfit)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.count} item{summary.count !== 1 ? "s" : ""} •{" "}
                {summary.totalRevenue > 0
                  ? ((summary.totalProfit / summary.totalRevenue) * 100).toFixed(1)
                  : "0"}% margem
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cost breakdown info */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Fórmula do Lucro:</strong> Receita B2C (preço de venda ao cliente) − Custo B2B (valor pago ao fornecedor + Taxa VENDA PROFIT) = Lucro Líquido
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Detalhamento por Item
              <span className="text-muted-foreground text-sm font-normal ml-2">
                ({filteredRows.length} registro{filteredRows.length !== 1 ? "s" : ""})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filteredRows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Nenhum pedido HUB concluído no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Receita B2C</TableHead>
                      <TableHead className="text-right">Custo Fornecedor</TableHead>
                      <TableHead className="text-right">Taxa Plataforma</TableHead>
                      <TableHead className="text-right">Custo B2B Total</TableHead>
                      <TableHead className="text-right">Lucro Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map(r => {
                      const margin = r.b2cRevenue > 0 ? (r.netProfit / r.b2cRevenue) * 100 : 0;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {r.date ? format(parseISO(r.date), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{r.supplierName}</TableCell>
                          <TableCell className="text-sm max-w-[180px] truncate">{r.productName}</TableCell>
                          <TableCell className="text-center text-sm">{r.quantity}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-primary">
                            {fmt(r.b2cRevenue)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-destructive">
                            {fmt(r.costB2BUnit * r.quantity)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-orange-600">
                            {fmt(r.platformFeeUnit * r.quantity)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-destructive">
                            {fmt(r.totalCostB2B)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <span className={`font-bold ${r.netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                              {fmt(r.netProfit)}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              {margin.toFixed(1)}%
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
