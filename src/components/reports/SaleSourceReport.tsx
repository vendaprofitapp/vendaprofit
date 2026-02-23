import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, DollarSign, TrendingUp, CreditCard, Percent, BarChart3, ShoppingCart, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { downloadXlsx } from "@/utils/xlsExport";
import { toast } from "sonner";
import { useDeferredRevenueInPeriod } from "@/hooks/useDeferredPaidAmounts";

interface SaleSourceReportProps {
  title: string;
  subtitle: string;
  /** sale_source value to filter by, or "event" for event-based filtering */
  saleSource: string;
  icon?: React.ReactNode;
}

interface SaleWithItems {
  id: string;
  customer_name: string | null;
  payment_method: string;
  subtotal: number;
  discount_amount: number | null;
  total: number;
  status: string;
  created_at: string;
  sale_source: string | null;
  event_name: string | null;
  shipping_cost: number | null;
  shipping_payer: string | null;
  sale_items: {
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
}

export default function SaleSourceReport({ title, subtitle, saleSource, icon }: SaleSourceReportProps) {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [paymentFilter, setPaymentFilter] = useState("all");

  // 1. Fetch COMPLETED sales by created_at filtered by source
  const { data: completedSalesData = [], isLoading } = useQuery({
    queryKey: ["report-by-source-completed", saleSource, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          id, customer_name, payment_method, subtotal, discount_amount, total, status, created_at, sale_source, event_name, shipping_cost, shipping_payer,
          sale_items (id, product_id, product_name, quantity, unit_price, total)
        `)
        .eq("status", "completed")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: false });

      if (saleSource === "event") {
        query = query.not("event_name", "is", null);
      } else {
        query = query.eq("sale_source", saleSource);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SaleWithItems[];
    },
    enabled: !!user,
  });

  // 2. Fetch deferred revenue recognized in this period (by paid_at)
  const periodDateRange = useMemo(() => ({
    start: new Date(`${dateFrom}T00:00:00`),
    end: new Date(`${dateTo}T23:59:59`),
  }), [dateFrom, dateTo]);

  const { deferredSaleIds, deferredSalesMap } = useDeferredRevenueInPeriod(user?.id, periodDateRange);

  // 3. Fetch the pending sales that had installments paid in this period, filtered by source
  const { data: deferredSalesRaw = [] } = useQuery({
    queryKey: ["report-by-source-deferred", saleSource, deferredSaleIds],
    queryFn: async () => {
      if (deferredSaleIds.length === 0) return [];
      const results: SaleWithItems[] = [];
      for (let i = 0; i < deferredSaleIds.length; i += 500) {
        const chunk = deferredSaleIds.slice(i, i + 500);
        let query = supabase
          .from("sales")
          .select(`id, customer_name, payment_method, subtotal, discount_amount, total, status, created_at, sale_source, event_name, shipping_cost, shipping_payer,
            sale_items (id, product_id, product_name, quantity, unit_price, total)`)
          .in("id", chunk)
          .eq("status", "pending");

        if (saleSource === "event") {
          query = query.not("event_name", "is", null);
        } else {
          query = query.eq("sale_source", saleSource);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) results.push(...(data as SaleWithItems[]));
      }
      return results;
    },
    enabled: deferredSaleIds.length > 0,
  });

  // 4. Build adjusted sales data
  const adjustedSalesData = useMemo(() => {
    const adjusted: SaleWithItems[] = [...completedSalesData];

    for (const sale of deferredSalesRaw) {
      const info = deferredSalesMap.get(sale.id);
      if (!info || info.revenueInPeriod <= 0) continue;
      const revenueRatio = sale.total > 0 ? info.revenueInPeriod / sale.total : 0;
      adjusted.push({
        ...sale,
        total: info.revenueInPeriod,
        subtotal: sale.subtotal * revenueRatio,
        discount_amount: (sale.discount_amount || 0) * revenueRatio,
        shipping_cost: (sale.shipping_cost || 0) * revenueRatio,
        _costRatio: info.costRatioInPeriod,
        sale_items: sale.sale_items.map(item => ({
          ...item,
          total: item.total * revenueRatio,
        })),
      } as any);
    }

    return adjusted;
  }, [completedSalesData, deferredSalesRaw, deferredSalesMap]);

  const salesData = adjustedSalesData;

  // Get product costs
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    salesData.forEach(s => s.sale_items.forEach(i => { if (i.product_id) ids.add(i.product_id); }));
    return Array.from(ids);
  }, [salesData]);

  const { data: products = [] } = useQuery({
    queryKey: ["report-products-cost", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, cost_price")
        .in("id", productIds);
      if (error) throw error;
      return data;
    },
    enabled: productIds.length > 0,
  });

  const costMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => map.set(p.id, p.cost_price || 0));
    return map;
  }, [products]);

  // Fetch custom payment methods for fee info
  const { data: customPaymentMethods = [] } = useQuery({
    queryKey: ["custom-pm-report", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("name, fee_percent")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const feeMap = useMemo(() => {
    const map = new Map<string, number>();
    customPaymentMethods.forEach(m => map.set(m.name, m.fee_percent));
    return map;
  }, [customPaymentMethods]);

  // Fetch financial splits
  const saleIds = useMemo(() => salesData.map(s => s.id), [salesData]);

  const { data: splitsData = [] } = useQuery({
    queryKey: ["report-splits", saleIds],
    queryFn: async () => {
      if (saleIds.length === 0) return [];
      // Fetch in chunks
      const results: any[] = [];
      for (let i = 0; i < saleIds.length; i += 500) {
        const chunk = saleIds.slice(i, i + 500);
        const { data, error } = await supabase
          .from("financial_splits")
          .select("sale_id, user_id, amount, type")
          .in("sale_id", chunk);
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: saleIds.length > 0,
  });

  // Splits by sale
  const splitsBySale = useMemo(() => {
    const map = new Map<string, { feeAmount: number; partnerCommission: number; myProfit: number; costRecovery: number; hasSplits: boolean }>();
    for (const split of splitsData) {
      const existing = map.get(split.sale_id) || { feeAmount: 0, partnerCommission: 0, myProfit: 0, costRecovery: 0, hasSplits: false };
      existing.hasSplits = true;
      if (split.user_id === user?.id) {
        if (split.type === "payment_fee") existing.feeAmount += Math.abs(split.amount);
        else if (split.type === "group_commission") existing.partnerCommission += Math.abs(split.amount);
        else if (split.type === "cost_recovery") existing.costRecovery += Math.abs(split.amount);
        existing.myProfit += split.amount;
      } else {
        if (split.type === "group_commission") existing.partnerCommission += Math.abs(split.amount);
        else existing.partnerCommission += split.amount;
      }
      map.set(split.sale_id, existing);
    }
    return map;
  }, [splitsData, user?.id]);

  // Filter by payment
  const paymentMethods = useMemo(() => {
    const set = new Set<string>();
    salesData.forEach(s => { if (s.payment_method) set.add(s.payment_method); });
    return Array.from(set).sort();
  }, [salesData]);

  const filtered = useMemo(() => {
    return adjustedSalesData.filter(s => {
      if (paymentFilter !== "all" && s.payment_method !== paymentFilter) return false;
      return true;
    });
  }, [salesData, paymentFilter]);

  // Detailed rows
  const detailedRows = useMemo(() => {
    return filtered.flatMap(sale => {
      const discount = Number(sale.discount_amount) || 0;
      const subtotal = Number(sale.subtotal) || 0;
      const saleInfo = splitsBySale.get(sale.id);
      const shippingCost = Number(sale.shipping_cost) || 0;
      const shippingPayer = sale.shipping_payer || null;
      const isSellerShipping = shippingPayer === 'seller' && shippingCost > 0;

      return sale.sale_items.map((item, idx) => {
        const costRatio = (sale as any)._costRatio ?? 1;
        // For bazar/external items (no product_id), use cost_recovery from splits
        const hasCostFromSplits = !item.product_id && saleInfo?.hasSplits && saleInfo.costRecovery > 0;
        const costPrice = hasCostFromSplits ? 0 : (costMap.get(item.product_id) || 0);
        const totalCost = hasCostFromSplits
          ? saleInfo.costRecovery * (Number(item.total) / (Number(sale.subtotal) || 1))
          : costPrice * item.quantity * costRatio;
        const itemTotal = Number(item.total);
        const proportion = subtotal > 0 ? itemTotal / subtotal : 1 / sale.sale_items.length;
        const itemDiscount = discount * proportion;
        const afterDiscount = itemTotal - itemDiscount;
        const grossProfit = afterDiscount - totalCost;

        // Distribute shipping proportionally across items (only first item gets it to avoid duplication, or proportionally)
        const itemShipping = shippingCost * proportion;
        const itemSellerShipping = isSellerShipping ? itemShipping : 0;

        let feeAmount: number;
        let partnerCommission: number;

        if (saleInfo?.hasSplits) {
          feeAmount = saleInfo.feeAmount * proportion;
          partnerCommission = saleInfo.partnerCommission * proportion;
        } else {
          const feePercent = feeMap.get(sale.payment_method) || 0;
          feeAmount = (afterDiscount * feePercent) / 100;
          partnerCommission = 0;
        }

        const netProfit = grossProfit - feeAmount - partnerCommission - itemSellerShipping;

        return {
          saleId: sale.id,
          date: sale.created_at,
          customer: sale.customer_name || "—",
          eventName: sale.event_name,
          productName: item.product_name,
          quantity: item.quantity,
          totalCost,
          totalSale: itemTotal,
          itemDiscount,
          afterDiscount,
          grossProfit,
          feeAmount,
          partnerCommission,
          shippingCost: itemShipping,
          shippingPayer,
          sellerShipping: itemSellerShipping,
          netProfit,
          paymentMethod: sale.payment_method,
        };
      });
    });
  }, [filtered, costMap, feeMap, splitsBySale]);

  // Summary
  const summary = useMemo(() => {
    const revenue = filtered.reduce((s, r) => s + r.total, 0);
    const totalDiscount = filtered.reduce((s, r) => s + (Number(r.discount_amount) || 0), 0);
    const totalCost = detailedRows.reduce((s, d) => s + d.totalCost, 0);
    const totalFees = detailedRows.reduce((s, d) => s + d.feeAmount, 0);
    const totalCommission = detailedRows.reduce((s, d) => s + d.partnerCommission, 0);
    const totalShipping = detailedRows.reduce((s, d) => s + d.shippingCost, 0);
    const totalSellerShipping = detailedRows.reduce((s, d) => s + d.sellerShipping, 0);
    const totalNet = detailedRows.reduce((s, d) => s + d.netProfit, 0);
    const grossProfit = revenue - totalCost;
    return { revenue, totalDiscount, totalCost, grossProfit, totalFees, totalCommission, totalShipping, totalSellerShipping, totalNet, count: filtered.length, items: detailedRows.reduce((s, d) => s + d.quantity, 0) };
  }, [filtered, detailedRows]);

  // Event summary (only for event source)
  const eventSummary = useMemo(() => {
    if (saleSource !== "event") return [];
    const map = new Map<string, { name: string; count: number; revenue: number; net: number }>();
    filtered.forEach(sale => {
      const name = sale.event_name || "Sem nome";
      const existing = map.get(name) || { name, count: 0, revenue: 0, net: 0 };
      existing.count++;
      existing.revenue += sale.total;
      map.set(name, existing);
    });
    // Add net from detailed rows
    detailedRows.forEach(row => {
      const name = row.eventName || "Sem nome";
      const existing = map.get(name);
      if (existing) existing.net += row.netProfit;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [saleSource, filtered, detailedRows]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function handleExport() {
    if (detailedRows.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const isEvent = saleSource === "event";
    const headers = [
      "Data", ...(isEvent ? ["Evento"] : []), "Cliente", "Produto", "Qtd", "Custo", "Venda", "Desconto",
      "Após Desconto", "Lucro Bruto", "Taxa Pgto", "Frete", "Pagador Frete", "Comissão", "Lucro Líquido", "Forma Pgto"
    ];
    const rows = detailedRows.map(d => [
      format(parseISO(d.date), "dd/MM/yyyy HH:mm"),
      ...(isEvent ? [d.eventName || "—"] : []),
      d.customer, d.productName, d.quantity, d.totalCost, d.totalSale, d.itemDiscount,
      d.afterDiscount, d.grossProfit, d.feeAmount, d.shippingCost, d.shippingPayer || "—", d.partnerCommission, d.netProfit, d.paymentMethod,
    ]);
    rows.push([
      "TOTAIS", ...(isEvent ? [""] : []), "", "", summary.items, summary.totalCost, summary.revenue + summary.totalDiscount,
      summary.totalDiscount, summary.revenue, summary.grossProfit, summary.totalFees, summary.totalShipping, "", summary.totalCommission, summary.totalNet, ""
    ]);
    downloadXlsx([headers, ...rows], title, `relatorio-${saleSource}-${dateFrom}-a-${dateTo}.xlsx`);
    toast.success("Relatório exportado!");
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {icon && <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>}
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-muted-foreground text-sm">{subtitle}</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={detailedRows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar XLS
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">De</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Até</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Forma Pgto</label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card><CardContent className="pt-4 pb-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Faturamento</p>
            <p className="text-lg font-bold">{fmt(summary.revenue)}</p>
            <p className="text-xs text-muted-foreground">{summary.count} vendas • {summary.items} itens</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Custo Total</p>
            <p className="text-lg font-bold text-destructive">{fmt(summary.totalCost)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Lucro Bruto</p>
            <p className="text-lg font-bold">{fmt(summary.grossProfit)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 text-center">
            <CreditCard className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Taxas Pgto</p>
            <p className="text-lg font-bold text-destructive/70">{fmt(summary.totalFees)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 text-center">
            <Truck className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Frete Total</p>
            <p className="text-lg font-bold text-destructive/70">{fmt(summary.totalShipping)}</p>
            {summary.totalSellerShipping > 0 && (
              <p className="text-xs text-muted-foreground">Vendedora: {fmt(summary.totalSellerShipping)}</p>
            )}
          </CardContent></Card>
          {summary.totalCommission > 0 && (
            <Card><CardContent className="pt-4 pb-4 text-center">
              <Percent className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Comissões</p>
              <p className="text-lg font-bold text-destructive/70">{fmt(summary.totalCommission)}</p>
            </CardContent></Card>
          )}
          <Card className="border-2 border-primary/30"><CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Lucro Líquido</p>
            <p className={`text-lg font-bold ${summary.totalNet >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(summary.totalNet)}</p>
          </CardContent></Card>
        </div>

        {/* Event Summary */}
        {saleSource === "event" && eventSummary.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo por Evento</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Lucro Líq.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventSummary.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-right">{e.count}</TableCell>
                      <TableCell className="text-right">{fmt(e.revenue)}</TableCell>
                      <TableCell className={`text-right font-bold ${e.net >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(e.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalhamento ({detailedRows.length} itens)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : detailedRows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma venda encontrada no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      {saleSource === "event" && <TableHead>Evento</TableHead>}
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Venda</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                      <TableHead className="text-right">Frete</TableHead>
                      {summary.totalCommission > 0 && <TableHead className="text-right">Comissão</TableHead>}
                      <TableHead className="text-right">Lucro Líq.</TableHead>
                      <TableHead>Pgto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailedRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap text-xs">{format(parseISO(row.date), "dd/MM/yy HH:mm")}</TableCell>
                        {saleSource === "event" && <TableCell className="text-xs">{row.eventName || "—"}</TableCell>}
                        <TableCell className="text-sm">{row.customer}</TableCell>
                        <TableCell className="text-sm">{row.productName}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right text-destructive text-xs">{fmt(row.totalCost)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(row.afterDiscount)}</TableCell>
                        <TableCell className="text-right text-destructive/70 text-xs">{fmt(row.feeAmount)}</TableCell>
                        <TableCell className="text-right text-xs">
                          {row.shippingCost > 0 ? (
                            <span className={row.shippingPayer === 'seller' ? 'text-destructive' : 'text-muted-foreground'}>
                              {fmt(row.shippingCost)}
                              <span className="block text-[10px]">{row.shippingPayer === 'seller' ? 'vendedora' : 'compradora'}</span>
                            </span>
                          ) : '—'}
                        </TableCell>
                        {summary.totalCommission > 0 && <TableCell className="text-right text-destructive/70 text-xs">{fmt(row.partnerCommission)}</TableCell>}
                        <TableCell className={`text-right font-bold text-xs ${row.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(row.netProfit)}</TableCell>
                        <TableCell className="text-xs">{row.paymentMethod}</TableCell>
                      </TableRow>
                    ))}
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
