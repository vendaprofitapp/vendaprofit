import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Layers, Banknote, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { downloadXlsx } from "@/utils/xlsExport";
import { toast } from "sonner";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SOURCE_LABELS: Record<string, string> = {
  manual: "PDV",
  catalog: "Minha Loja",
  instagram: "Instagram",
  partner_point: "Ponto Parceiro",
  event: "Evento",
  b2b: "B2B",
  consignment: "Consignado",
  consortium: "Consórcio",
  bazar: "Bazar VIP",
  whatsapp: "WhatsApp",
};

function sourceLabel(s: string | null) {
  return SOURCE_LABELS[s ?? ""] || s || "—";
}

interface HubSplitRow {
  id: string;
  sale_id: string;
  connection_id: string;
  owner_id: string;
  seller_id: string;
  commission_pct: number;
  gross_profit: number;
  commission_amount: number;
  fee_amount: number;
  shipping_amount: number;
  owner_amount: number;
  seller_amount: number;
  created_at: string;
  product_id: string | null;
  product_name: string | null;
  sales: {
    created_at: string;
    sale_source: string | null;
    total: number;
    subtotal: number;
    shipping_cost: number | null;
    payment_method: string;
    customer_name: string | null;
  } | null;
  products: { name: string; cost_price: number | null } | null;
  owner_profile: { full_name: string | null } | null;
  seller_profile: { full_name: string | null } | null;
}

export default function ReportHubAcertos() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { data: rawSplits = [], isLoading } = useQuery({
    queryKey: ["report-hub-acertos", user?.id, dateFrom, dateTo],
    queryFn: async () => {
      // Query hub_sale_splits where user is owner OR seller, joined with sales, products, profiles
      const { data, error } = await supabase
        .from("hub_sale_splits")
        .select(`
          id, sale_id, connection_id, owner_id, seller_id,
          commission_pct, gross_profit, commission_amount, fee_amount,
          shipping_amount, owner_amount, seller_amount, created_at,
          product_id, product_name,
          sales!inner(created_at, sale_source, total, subtotal, shipping_cost, payment_method, customer_name),
          products(name, cost_price)
        `)
        .gte("sales.created_at", `${dateFrom}T00:00:00`)
        .lte("sales.created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // Fetch profiles for all owner/seller ids
      const userIds = [...new Set(data.flatMap((r: any) => [r.owner_id, r.seller_id].filter(Boolean)))];
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p.full_name || "—"));
      }

      return (data as any[]).map(r => ({
        ...r,
        owner_profile: { full_name: profileMap.get(r.owner_id) ?? "—" },
        seller_profile: { full_name: profileMap.get(r.seller_id) ?? "—" },
      })) as HubSplitRow[];
    },
    enabled: !!user,
  });

  // Filter to only show splits where current user is owner or seller
  const splits = useMemo(
    () => rawSplits.filter(r => r.owner_id === user?.id || r.seller_id === user?.id),
    [rawSplits, user?.id]
  );

  const summary = useMemo(() => {
    let totalGross = 0, totalCommission = 0, totalFees = 0, totalOwner = 0, totalSeller = 0;
    splits.forEach(r => {
      totalGross += r.gross_profit;
      totalCommission += r.commission_amount;
      totalFees += r.fee_amount + r.shipping_amount;
      totalOwner += r.owner_amount;
      totalSeller += r.seller_amount;
    });
    const isOwner = splits.length > 0 && splits[0].owner_id === user?.id;
    return { totalGross, totalCommission, totalFees, totalOwner, totalSeller, count: splits.length };
  }, [splits, user?.id]);

  // Total a pagar a parceiros (what logged user owes or is owed)
  const toPayPartners = useMemo(() => {
    return splits.reduce((acc, r) => {
      if (r.seller_id === user?.id) return acc; // seller: nothing to pay out
      return acc + r.seller_amount; // owner: owes seller_amount to seller
    }, 0);
  }, [splits, user?.id]);

  const myHubProfit = useMemo(() => {
    return splits.reduce((acc, r) => {
      if (r.seller_id === user?.id) return acc + r.seller_amount;
      return acc + r.owner_amount;
    }, 0);
  }, [splits, user?.id]);

  function handleExport() {
    if (splits.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const headers = [
      "Data", "Origem", "Produto", "Dono", "Vendedora",
      "Preço de Venda", "Custo", "Lucro Bruto",
      "Comissão Dono (%)", "Comissão Dono (R$)",
      "Taxas + Frete", "Lucro Líq. Vendedora"
    ];
    const rows = splits.map(r => {
      const sale = r.sales;
      const costPrice = r.gross_profit + (r.products?.cost_price ?? 0);
      return [
        sale ? format(parseISO(sale.created_at), "dd/MM/yyyy") : "—",
        sourceLabel(sale?.sale_source ?? null),
        r.products?.name || r.product_name || "—",
        r.owner_profile?.full_name || "—",
        r.seller_profile?.full_name || "—",
        sale?.total ?? 0,
        r.products?.cost_price ?? 0,
        r.gross_profit,
        r.commission_pct,
        r.commission_amount,
        r.fee_amount + r.shipping_amount,
        r.seller_amount,
      ];
    });
    downloadXlsx([headers, ...rows], "Acertos HUB", `acertos-hub-${dateFrom}-a-${dateTo}.xlsx`);
    toast.success("Exportado!");
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Acertos HUB</h1>
              <p className="text-muted-foreground text-sm">Relatório financeiro das parcerias HUB de Vendas</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={splits.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar XLS
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground">De</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Até</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
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
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Lucro Bruto Total</span>
              </div>
              <p className="text-xl font-bold">{fmt(summary.totalGross)}</p>
              <p className="text-xs text-muted-foreground">{summary.count} split(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">A Pagar Parceiros</span>
              </div>
              <p className="text-xl font-bold text-destructive">{fmt(toPayPartners)}</p>
              <p className="text-xs text-muted-foreground">quando você é o Dono</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Meu Total HUB</span>
              </div>
              <p className="text-xl font-bold text-primary">{fmt(myHubProfit)}</p>
              <p className="text-xs text-muted-foreground">como Dono ou Vendedora</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Comissões do Dono</span>
              </div>
              <p className="text-xl font-bold">{fmt(summary.totalCommission)}</p>
              <p className="text-xs text-muted-foreground">sobre o lucro bruto</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalhamento por Venda</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : splits.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma venda HUB no período.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data / Origem</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Dono</TableHead>
                      <TableHead>Vendedora</TableHead>
                      <TableHead className="text-right">Venda</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Lucro Bruto</TableHead>
                      <TableHead className="text-right">Comissão Dono</TableHead>
                      <TableHead className="text-right">Custos Op.</TableHead>
                      <TableHead className="text-right">Líq. Vendedora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {splits.map(r => {
                      const sale = r.sales;
                      const isIAmOwner = r.owner_id === user?.id;
                      const saleDate = sale ? format(parseISO(sale.created_at), "dd/MM/yy") : "—";
                      const costPrice = r.products?.cost_price ?? 0;
                      const salePrice = sale?.total ?? 0;
                      const operationalCosts = r.fee_amount + r.shipping_amount;

                      return (
                        <TableRow key={r.id} className={isIAmOwner ? "bg-primary/5" : ""}>
                          <TableCell>
                            <div className="font-medium text-sm">{saleDate}</div>
                            <Badge variant="secondary" className="text-xs mt-0.5">
                              {sourceLabel(sale?.sale_source ?? null)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate">
                            {r.products?.name || r.product_name || "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm ${isIAmOwner ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                              {r.owner_profile?.full_name || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm ${!isIAmOwner ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                              {r.seller_profile?.full_name || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmt(salePrice)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmt(costPrice)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{fmt(r.gross_profit)}</TableCell>
                          <TableCell className="text-right text-sm text-destructive">
                            {fmt(r.commission_amount)}
                            <span className="text-xs text-muted-foreground ml-1">({r.commission_pct}%)</span>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmt(operationalCosts)}</TableCell>
                          <TableCell className="text-right text-sm font-bold text-primary">
                            {fmt(r.seller_amount)}
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
