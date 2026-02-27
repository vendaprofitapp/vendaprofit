import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Layers, Banknote, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
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

type OperationType = "all" | "owner" | "seller";

export default function ReportHubAcertos() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [operationType, setOperationType] = useState<OperationType>("all");
  const [selectedPartner, setSelectedPartner] = useState<string>("all");

  const { data: splits = [], isLoading, error: queryError } = useQuery({
    queryKey: ["report-hub-acertos-v3", user?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!user?.id) return [];

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

      const saleIds = [...new Set(rawSplits.map((r: any) => r.sale_id).filter(Boolean))];
      let salesMap = new Map<string, any>();
      if (saleIds.length > 0) {
        const { data: salesData } = await supabase
          .from("sales")
          .select("id, created_at, sale_source, total, subtotal, shipping_cost, payment_method, customer_name")
          .in("id", saleIds);
        (salesData ?? []).forEach((s: any) => salesMap.set(s.id, s));
      }

      const userIds = [...new Set(rawSplits.flatMap((r: any) => [r.owner_id, r.seller_id].filter(Boolean)))];
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, store_name")
          .in("id", userIds);
        (profiles ?? []).forEach((p: any) =>
          profileMap.set(p.id, p.full_name || p.store_name || "—")
        );
      }

      return rawSplits.map((r: any) => ({
        ...r,
        sale: salesMap.get(r.sale_id) ?? null,
        owner_name: profileMap.get(r.owner_id) ?? "—",
        seller_name: profileMap.get(r.seller_id) ?? "—",
      }));
    },
    enabled: !!user,
  });

  // Derived partner list based on operation type
  const partnerOptions = useMemo(() => {
    const map = new Map<string, string>();
    splits.forEach((r: any) => {
      if (operationType === "owner" || operationType === "all") {
        // When I'm the owner, partners are sellers
        if (r.owner_id === user?.id && r.seller_id) {
          map.set(r.seller_id, r.seller_name);
        }
      }
      if (operationType === "seller" || operationType === "all") {
        // When I'm the seller, partners are owners
        if (r.seller_id === user?.id && r.owner_id) {
          map.set(r.owner_id, r.owner_name);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [splits, operationType, user?.id]);

  // Reset partner when operation type changes
  const handleOperationChange = (val: OperationType) => {
    setOperationType(val);
    setSelectedPartner("all");
  };

  // Filtered splits (frontend filtering for speed)
  const filteredSplits = useMemo(() => {
    return splits.filter((r: any) => {
      // Operation filter
      if (operationType === "owner" && r.owner_id !== user?.id) return false;
      if (operationType === "seller" && r.seller_id !== user?.id) return false;

      // Partner filter
      if (selectedPartner !== "all") {
        const isPartnerOwner = r.owner_id === selectedPartner;
        const isPartnerSeller = r.seller_id === selectedPartner;
        if (!isPartnerOwner && !isPartnerSeller) return false;
      }

      return true;
    });
  }, [splits, operationType, selectedPartner, user?.id]);

  // Summary calculations on filtered splits
  const summary = useMemo(() => {
    let ownerProfit = 0;    // My profit as owner (commission_amount)
    let ownerReceivable = 0; // What sellers owe me (owner_amount: cost + commission)
    let sellerProfit = 0;   // My profit as seller (seller_amount)
    let sellerPayable = 0;  // What I owe to owners (owner_amount)

    filteredSplits.forEach((r: any) => {
      const amIOwner = r.owner_id === user?.id;
      const amISeller = r.seller_id === user?.id;

      if (amIOwner) {
        ownerProfit += r.commission_amount ?? 0;
        ownerReceivable += r.owner_amount ?? 0;
      }
      if (amISeller) {
        sellerProfit += r.seller_amount ?? 0;
        sellerPayable += r.owner_amount ?? 0;
      }
    });

    return { ownerProfit, ownerReceivable, sellerProfit, sellerPayable, count: filteredSplits.length };
  }, [filteredSplits, user?.id]);

  // Dynamic partner name for cards
  const partnerName = useMemo(() => {
    if (selectedPartner === "all") return null;
    return partnerOptions.find(p => p.id === selectedPartner)?.name ?? null;
  }, [selectedPartner, partnerOptions]);

  function handleExport() {
    if (filteredSplits.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const headers = ["Data", "Origem", "Produto", "Dono", "Vendedora", "Venda", "Lucro Bruto", "Comissão Dono (%)", "Comissão Dono (R$)", "Custos Op.", "Líq. Vendedora"];
    const rows = filteredSplits.map((r: any) => [
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

  const showOwnerCards = operationType === "all" || operationType === "owner";
  const showSellerCards = operationType === "all" || operationType === "seller";

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
          <Button onClick={handleExport} disabled={filteredSplits.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar XLS
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Date filters */}
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

              {/* Operation type */}
              <div className="min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Tipo de Operação</label>
                <Select value={operationType} onValueChange={(v) => handleOperationChange(v as OperationType)}>
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Visão Geral</SelectItem>
                    <SelectItem value="owner">Cedendo meu Estoque</SelectItem>
                    <SelectItem value="seller">Vendendo outro Estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Partner filter */}
              <div className="min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">
                  {operationType === "owner" ? "Vendedora" : operationType === "seller" ? "Dono da Peça" : "Parceiro"}
                </label>
                <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Parceiros</SelectItem>
                    {partnerOptions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          {/* Card 1: My profit as owner */}
          {showOwnerCards && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Meu Lucro Cedendo Estoque</span>
                </div>
                <p className="text-xl font-bold text-primary">{fmt(summary.ownerProfit)}</p>
                <p className="text-xs text-muted-foreground">comissão como Dono</p>
              </CardContent>
            </Card>
          )}

          {/* Card 2: What sellers owe me */}
          {showOwnerCards && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownToLine className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground truncate">
                    {partnerName && operationType === "owner"
                      ? `A Receber de ${partnerName}`
                      : "Valor a Receber (Cedendo Estoque)"}
                  </span>
                </div>
                <p className="text-xl font-bold" style={{ color: 'hsl(var(--chart-2))' }}>{fmt(summary.ownerReceivable)}</p>
                <p className="text-xs text-muted-foreground">custo + comissão</p>
              </CardContent>
            </Card>
          )}

          {/* Card 3: My profit as seller */}
          {showSellerCards && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Meu Lucro Vendendo Outro Estoque</span>
                </div>
                <p className="text-xl font-bold text-primary">{fmt(summary.sellerProfit)}</p>
                <p className="text-xs text-muted-foreground">líquido como Vendedora</p>
              </CardContent>
            </Card>
          )}

          {/* Card 4: What I owe to owners */}
          {showSellerCards && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpFromLine className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground truncate">
                    {partnerName && operationType === "seller"
                      ? `Valor Devido a ${partnerName}`
                      : "Valor Devido (Vendendo Outro Estoque)"}
                  </span>
                </div>
                <p className="text-xl font-bold text-destructive">{fmt(summary.sellerPayable)}</p>
                <p className="text-xs text-muted-foreground">a repassar ao Dono</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Detalhamento por Venda
              <span className="text-muted-foreground text-sm font-normal ml-2">({filteredSplits.length} registro{filteredSplits.length !== 1 ? "s" : ""})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : queryError ? (
              <div className="py-12 text-center text-destructive text-sm">Erro ao carregar dados. Veja acima.</div>
            ) : filteredSplits.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma venda HUB no período com os filtros aplicados.</div>
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
                    {filteredSplits.map((r: any) => {
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
