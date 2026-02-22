import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, MapPin, DollarSign, TrendingUp, CreditCard, Percent, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { downloadXlsx } from "@/utils/xlsExport";

interface PartnerPoint {
  id: string;
  name: string;
  rack_commission_pct: number;
  pickup_commission_pct: number;
}

interface SaleRow {
  id: string;
  created_at: string;
  partner_point_id: string;
  partner_point_name: string;
  customer_name: string;
  customer_phone: string;
  items: any[];
  total_gross: number;
  payment_method: string;
  payment_fee_applied: number;
  pass_status: string;
  converted_sale_id: string | null;
  rack_commission_pct: number;
  // computed
  total_cost: number;
  fee_amount: number;
  commission_amount: number;
  net_profit: number;
}

export default function PartnerPointReports() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [points, setPoints] = useState<PartnerPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selectedPoint, setSelectedPoint] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, dateFrom, dateTo]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    // Load partner points
    const { data: pointsData } = await supabase
      .from("partner_points")
      .select("id, name, rack_commission_pct, pickup_commission_pct")
      .eq("owner_id", user.id);

    const pointsMap = new Map<string, PartnerPoint>();
    (pointsData || []).forEach(p => pointsMap.set(p.id, p));
    setPoints(pointsData || []);

    // Load sales
    const { data: salesData } = await supabase
      .from("partner_point_sales")
      .select("*")
      .eq("owner_id", user.id)
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`)
      .order("created_at", { ascending: false });

    if (!salesData || salesData.length === 0) {
      setSales([]);
      setLoading(false);
      return;
    }

    // Get product costs
    const productIds = new Set<string>();
    salesData.forEach(s => {
      const items = s.items as any[];
      items?.forEach((item: any) => {
        if (item.product_id) productIds.add(item.product_id);
      });
    });

    const { data: productsData } = await supabase
      .from("products")
      .select("id, cost_price")
      .in("id", Array.from(productIds));

    const costMap = new Map<string, number>();
    (productsData || []).forEach(p => costMap.set(p.id, p.cost_price || 0));

    // Compute rows
    const rows: SaleRow[] = salesData.map(sale => {
      const point = pointsMap.get(sale.partner_point_id);
      const items = (sale.items as any[]) || [];
      
      // Total cost from products
      const total_cost = items.reduce((sum: number, item: any) => {
        const cost = costMap.get(item.product_id) || 0;
        return sum + cost * (item.quantity || 1);
      }, 0);

      const gross = sale.total_gross || 0;
      const feePercent = sale.payment_fee_applied || 0;
      const fee_amount = (gross * feePercent) / 100;
      const commissionPct = point?.rack_commission_pct || 0;
      const commission_amount = ((gross - fee_amount) * commissionPct) / 100;
      const net_profit = gross - total_cost - fee_amount - commission_amount;

      return {
        id: sale.id,
        created_at: sale.created_at,
        partner_point_id: sale.partner_point_id,
        partner_point_name: point?.name || "—",
        customer_name: sale.customer_name || "",
        customer_phone: sale.customer_phone || "",
        items,
        total_gross: gross,
        payment_method: sale.payment_method || "",
        payment_fee_applied: feePercent,
        pass_status: sale.pass_status || "",
        converted_sale_id: sale.converted_sale_id,
        rack_commission_pct: commissionPct,
        total_cost,
        fee_amount,
        commission_amount,
        net_profit,
      };
    });

    setSales(rows);
    setLoading(false);
  }

  // Filtered data
  const filtered = useMemo(() => {
    return sales.filter(s => {
      if (selectedPoint !== "all" && s.partner_point_id !== selectedPoint) return false;
      if (selectedPayment !== "all" && s.payment_method !== selectedPayment) return false;
      if (selectedStatus !== "all" && s.pass_status !== selectedStatus) return false;
      return true;
    });
  }, [sales, selectedPoint, selectedPayment, selectedStatus]);

  // Summary
  const summary = useMemo(() => {
    const totalGross = filtered.reduce((s, r) => s + r.total_gross, 0);
    const totalCost = filtered.reduce((s, r) => s + r.total_cost, 0);
    const totalFees = filtered.reduce((s, r) => s + r.fee_amount, 0);
    const totalCommission = filtered.reduce((s, r) => s + r.commission_amount, 0);
    const totalNet = filtered.reduce((s, r) => s + r.net_profit, 0);
    const grossProfit = totalGross - totalCost;
    return { totalGross, totalCost, grossProfit, totalFees, totalCommission, totalNet, count: filtered.length };
  }, [filtered]);

  // Summary by point
  const pointSummary = useMemo(() => {
    const map = new Map<string, { name: string; count: number; gross: number; cost: number; fees: number; commission: number; net: number }>();
    filtered.forEach(r => {
      const existing = map.get(r.partner_point_id) || { name: r.partner_point_name, count: 0, gross: 0, cost: 0, fees: 0, commission: 0, net: 0 };
      existing.count++;
      existing.gross += r.total_gross;
      existing.cost += r.total_cost;
      existing.fees += r.fee_amount;
      existing.commission += r.commission_amount;
      existing.net += r.net_profit;
      map.set(r.partner_point_id, existing);
    });
    return Array.from(map.values());
  }, [filtered]);

  // Payment methods list
  const paymentMethods = useMemo(() => {
    const set = new Set<string>();
    sales.forEach(s => { if (s.payment_method) set.add(s.payment_method); });
    return Array.from(set).sort();
  }, [sales]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function exportXls() {
    const header = ["Data", "Ponto Parceiro", "Cliente", "Telefone", "Produtos", "Qtd", "Custo Total", "Venda Bruta", "Taxa Pgto %", "Taxa Pgto R$", "Comissão %", "Comissão R$", "Lucro Líquido", "Forma Pgto", "Status"];
    const rows = filtered.map(r => [
      format(parseISO(r.created_at), "dd/MM/yyyy HH:mm"),
      r.partner_point_name,
      r.customer_name,
      r.customer_phone,
      r.items.map((i: any) => i.product_name).join(", "),
      r.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0),
      r.total_cost,
      r.total_gross,
      r.payment_fee_applied,
      r.fee_amount,
      r.rack_commission_pct,
      r.commission_amount,
      r.net_profit,
      r.payment_method,
      r.pass_status === "completed" ? "Concluído" : r.pass_status === "pending" ? "Pendente" : r.pass_status,
    ]);

    // Summary sheet data
    const summaryRows = [
      ["Resumo por Ponto Parceiro"],
      ["Ponto", "Vendas", "Faturamento", "Custo", "Taxas", "Comissão", "Lucro Líquido"],
      ...pointSummary.map(p => [p.name, p.count, p.gross, p.cost, p.fees, p.commission, p.net]),
      [],
      ["TOTAL", summary.count, summary.totalGross, summary.totalCost, summary.totalFees, summary.totalCommission, summary.totalNet],
    ];

    // Combine into single export
    const allData = [header, ...rows, [], [], ...summaryRows];
    downloadXlsx(allData, "Rel. Pontos Parceiros", `relatorio-pontos-parceiros-${dateFrom}-a-${dateTo}.xlsx`);
  }

  const statusLabel = (s: string) => {
    if (s === "completed") return <Badge variant="default" className="bg-green-600">Concluído</Badge>;
    if (s === "pending") return <Badge variant="secondary">Pendente</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Rel. Pontos Parceiros</h1>
            <p className="text-muted-foreground text-sm">Relatório financeiro completo de vendas em pontos parceiros</p>
          </div>
          <Button onClick={exportXls} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar XLS
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">De</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Até</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Ponto Parceiro</label>
                <Select value={selectedPoint} onValueChange={setSelectedPoint}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {points.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Forma Pgto</label>
                <Select value={selectedPayment} onValueChange={setSelectedPayment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="text-lg font-bold">{fmt(summary.totalGross)}</p>
              <p className="text-xs text-muted-foreground">{summary.count} vendas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <BarChart3 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Custo Total</p>
              <p className="text-lg font-bold text-red-500">{fmt(summary.totalCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Lucro Bruto</p>
              <p className="text-lg font-bold">{fmt(summary.grossProfit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <CreditCard className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Taxas Pgto</p>
              <p className="text-lg font-bold text-orange-500">{fmt(summary.totalFees)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Percent className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Comissões</p>
              <p className="text-lg font-bold text-orange-500">{fmt(summary.totalCommission)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-xs text-muted-foreground">Lucro Líquido</p>
              <p className={`text-lg font-bold ${summary.totalNet >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt(summary.totalNet)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Summary by Point */}
        {pointSummary.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Resumo por Ponto</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ponto</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Taxas</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Lucro Líq.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointSummary.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.count}</TableCell>
                      <TableCell className="text-right">{fmt(p.gross)}</TableCell>
                      <TableCell className="text-right text-red-500">{fmt(p.cost)}</TableCell>
                      <TableCell className="text-right text-orange-500">{fmt(p.fees)}</TableCell>
                      <TableCell className="text-right text-orange-500">{fmt(p.commission)}</TableCell>
                      <TableCell className={`text-right font-bold ${p.net >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt(p.net)}</TableCell>
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
            <CardTitle className="text-base">Detalhamento de Vendas ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma venda encontrada no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Ponto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produtos</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Venda</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead className="text-right">Lucro Líq.</TableHead>
                      <TableHead>Pgto</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs">{format(parseISO(row.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell className="text-xs">{row.partner_point_name}</TableCell>
                        <TableCell className="text-xs">{row.customer_name}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {row.items.map((i: any) => `${i.product_name} (${i.quantity || 1})`).join(", ")}
                        </TableCell>
                        <TableCell className="text-right text-xs text-red-500">{fmt(row.total_cost)}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmt(row.total_gross)}</TableCell>
                        <TableCell className="text-right text-xs text-orange-500">{fmt(row.fee_amount)}</TableCell>
                        <TableCell className="text-right text-xs text-orange-500">{fmt(row.commission_amount)}</TableCell>
                        <TableCell className={`text-right text-xs font-bold ${row.net_profit >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt(row.net_profit)}</TableCell>
                        <TableCell className="text-xs">{row.payment_method}</TableCell>
                        <TableCell>{statusLabel(row.pass_status)}</TableCell>
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
