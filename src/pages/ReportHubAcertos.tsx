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

export default function ReportHubAcertos() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { data: splits = [], isLoading, error: queryError } = useQuery({
    queryKey: ["report-hub-acertos-v2", user?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!user?.id) return [];

      // STEP 1: Fetch splits directly with simple OR filter — no complex joins
      const { data: rawSplits, error: splitsError } = await supabase
        .from("hub_sale_splits")
        .select("*")
        .or(`owner_id.eq.${user.id},seller_id.eq.${user.id}`)
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: false });

      console.log("Dados puros dos splits:", rawSplits, splitsError);

      if (splitsError) throw splitsError;
      if (!rawSplits || rawSplits.length === 0) return [];

      // STEP 2: Fetch related sales separately
      const saleIds = [...new Set(rawSplits.map((r: any) => r.sale_id).filter(Boolean))];
      let salesMap = new Map<string, any>();
      if (saleIds.length > 0) {
        const { data: salesData, error: salesError } = await supabase
          .from("sales")
          .select("id, created_at, sale_source, total, subtotal, shipping_cost, payment_method, customer_name")
          .in("id", saleIds);
        console.log("Sales data:", salesData, salesError);
        (salesData ?? []).forEach((s: any) => salesMap.set(s.id, s));
      }

      // STEP 3: Fetch profiles separately
      const userIds = [...new Set(rawSplits.flatMap((r: any) => [r.owner_id, r.seller_id].filter(Boolean)))];
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        console.log("Profiles data:", profiles, profilesError);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p.full_name || "—"));
      }

      // STEP 4: Combine
      return rawSplits.map((r: any) => ({
        ...r,
        sale: salesMap.get(r.sale_id) ?? null,
        owner_name: profileMap.get(r.owner_id) ?? "—",
        seller_name: profileMap.get(r.seller_id) ?? "—",
      }));
    },
    enabled: !!user,
  });

  const summary = useMemo(() => {
    let totalGross = 0, totalCommission = 0, totalOwner = 0, totalSeller = 0;
    splits.forEach((r: any) => {
      totalGross += r.gross_profit ?? 0;
      totalCommission += r.commission_amount ?? 0;
      totalOwner += r.owner_amount ?? 0;
      totalSeller += r.seller_amount ?? 0;
    });
    return { totalGross, totalCommission, totalOwner, totalSeller, count: splits.length };
  }, [splits]);

  const toPayPartners = useMemo(() => {
    return splits.reduce((acc: number, r: any) => {
      if (r.seller_id === user?.id) return acc;
      return acc + (r.seller_amount ?? 0);
    }, 0);
  }, [splits, user?.id]);

  const myHubProfit = useMemo(() => {
    return splits.reduce((acc: number, r: any) => {
      if (r.seller_id === user?.id) return acc + (r.seller_amount ?? 0);
      return acc + (r.owner_amount ?? 0);
    }, 0);
  }, [splits, user?.id]);

  function handleExport() {
    if (splits.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const headers = ["Data", "Origem", "Produto", "Dono", "Vendedora", "Venda", "Lucro Bruto", "Comissão Dono (%)", "Comissão Dono (R$)", "Custos Op.", "Líq. Vendedora"];
    const rows = splits.map((r: any) => [
      r.sale ? format(parseISO(r.sale.created_at), "dd/MM/yyyy") : "—",
      sourceLabel(r.sale?.sale_source ?? null),
      r.product_name || "—",
      r.owner_name,
      r.seller_name,
      r.sale?.total ?? 0,
      r.gross_profit ?? 0,
      r.commission_pct ?? 0,
      r.commission_amount ?? 0,
      (r.fee_amount ?? 0) + (r.shipping_amount ?? 0),
      r.seller_amount ?? 0,
    ]);
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
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Até</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 border rounded text-sm bg-background" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error display */}
        {queryError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm font-mono">
            <strong>Erro na consulta:</strong> {(queryError as any)?.message || JSON.stringify(queryError)}
          </div>
        )}

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
            ) : queryError ? (
              <div className="py-12 text-center text-destructive text-sm">Erro ao carregar dados. Veja acima.</div>
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
                      <TableHead className="text-right">Lucro Bruto</TableHead>
                      <TableHead className="text-right">Comissão Dono</TableHead>
                      <TableHead className="text-right">Custos Op.</TableHead>
                      <TableHead className="text-right">Líq. Vendedora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {splits.map((r: any) => {
                      const isIAmOwner = r.owner_id === user?.id;
                      const saleDate = r.sale ? format(parseISO(r.sale.created_at), "dd/MM/yy") : "—";
                      const operationalCosts = (r.fee_amount ?? 0) + (r.shipping_amount ?? 0);
                      return (
                        <TableRow key={r.id} className={isIAmOwner ? "bg-primary/5" : ""}>
                          <TableCell>
                            <div className="font-medium text-sm">{saleDate}</div>
                            <Badge variant="secondary" className="text-xs mt-0.5">
                              {sourceLabel(r.sale?.sale_source ?? null)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate">{r.product_name || "—"}</TableCell>
                          <TableCell>
                            <span className={`text-sm ${isIAmOwner ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                              {r.owner_name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm ${!isIAmOwner ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                              {r.seller_name}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">{fmt(r.sale?.total ?? 0)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{fmt(r.gross_profit ?? 0)}</TableCell>
                          <TableCell className="text-right text-sm text-destructive">
                            {fmt(r.commission_amount ?? 0)}
                            <span className="text-xs text-muted-foreground ml-1">({r.commission_pct ?? 0}%)</span>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmt(operationalCosts)}</TableCell>
                          <TableCell className="text-right text-sm font-bold text-primary">{fmt(r.seller_amount ?? 0)}</TableCell>
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
