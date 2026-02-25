import { useState, useMemo } from "react";
import { PieChart, Users, TrendingUp, DollarSign, ArrowRightLeft, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "@/hooks/use-toast";

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "all", label: "Todo Período" },
];

// ─── types ───────────────────────────────────────────────────────────────────
interface Group {
  id: string;
  name: string;
  created_by: string;
  is_direct: boolean;
  profit_share_seller: number;
  profit_share_partner: number;
  cost_split_ratio: number;
}

interface GroupMember { group_id: string; user_id: string; }
interface Profile { id: string; full_name: string; email: string; }
interface FinancialSplit {
  id: string;
  sale_id: string;
  user_id: string;
  amount: number;
  type: string;
}
interface Sale {
  id: string;
  owner_id: string;
  total: number;
  sale_items: { product_id: string | null }[];
}

// ─── component ───────────────────────────────────────────────────────────────
export default function SocietyReport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("none");
  const [period, setPeriod] = useState("month");

  // ── date range ──────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "week":  return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
      case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
      default:      return { start: new Date(2020, 0, 1), end: now };
    }
  }, [period]);

  // ── queries ─────────────────────────────────────────────────────────────
  const { data: memberships = [] } = useQuery<GroupMember[]>({
    queryKey: ["society-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_members").select("group_id, user_id");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: allGroups = [] } = useQuery<Group[]>({
    queryKey: ["society-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, created_by, is_direct, profit_share_seller, profit_share_partner, cost_split_ratio");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["society-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ── my direct societies ─────────────────────────────────────────────────
  const myGroupIds = useMemo(
    () => memberships.filter(m => m.user_id === user?.id).map(m => m.group_id),
    [memberships, user]
  );

  const mySocieties = useMemo(
    () => allGroups.filter(g => g.is_direct && myGroupIds.includes(g.id)),
    [allGroups, myGroupIds]
  );

  // ── selected group & members ────────────────────────────────────────────
  const selectedGroup = useMemo(
    () => mySocieties.find(g => g.id === selectedGroupId) ?? null,
    [mySocieties, selectedGroupId]
  );

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach(p => m.set(p.id, p));
    return m;
  }, [profiles]);

  const groupMembers = useMemo(
    () => memberships.filter(m => m.group_id === selectedGroupId),
    [memberships, selectedGroupId]
  );

  // Determine Sócio A (group creator) and Sócio B (the other member)
  const socioA = useMemo(() => {
    if (!selectedGroup) return null;
    return profileMap.get(selectedGroup.created_by) ?? null;
  }, [selectedGroup, profileMap]);

  const socioB = useMemo(() => {
    if (!selectedGroup || !user) return null;
    const otherMember = groupMembers.find(m => m.user_id !== selectedGroup.created_by);
    return otherMember ? profileMap.get(otherMember.user_id) ?? null : null;
  }, [selectedGroup, groupMembers, profileMap, user]);

  // ── product partnerships for this group ─────────────────────────────────
  const { data: groupProductIds = [] } = useQuery<string[]>({
    queryKey: ["society-product-ids", selectedGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("product_id")
        .eq("group_id", selectedGroupId);
      if (error) throw error;
      return data.map(d => d.product_id);
    },
    enabled: !!selectedGroupId && selectedGroupId !== "none",
  });

  // ── sales for this society (sales containing group products) ────────────
  const { data: salesData = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["society-sales", selectedGroupId, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, owner_id, total, sale_items(product_id)")
        .eq("status", "completed")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!selectedGroupId && selectedGroupId !== "none",
  });

  // Filter only sales that contain at least one group product
  const groupProductSet = useMemo(() => new Set(groupProductIds), [groupProductIds]);

  const societySales = useMemo(() => {
    if (groupProductIds.length === 0) return salesData;
    return salesData.filter(sale =>
      sale.sale_items.some(item => item.product_id && groupProductSet.has(item.product_id))
    );
  }, [salesData, groupProductSet, groupProductIds]);

  // ── financial splits for society sales ──────────────────────────────────
  const societySaleIds = useMemo(() => societySales.map(s => s.id), [societySales]);

  const { data: splits = [], isLoading: splitsLoading } = useQuery<FinancialSplit[]>({
    queryKey: ["society-splits", societySaleIds],
    queryFn: async () => {
      if (societySaleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("financial_splits")
        .select("id, sale_id, user_id, amount, type")
        .in("sale_id", societySaleIds);
      if (error) throw error;
      return data;
    },
    enabled: societySaleIds.length > 0,
  });

  const splitsBySale = useMemo(() => {
    const map = new Map<string, FinancialSplit[]>();
    splits.forEach(s => {
      const arr = map.get(s.sale_id) ?? [];
      arr.push(s);
      map.set(s.sale_id, arr);
    });
    return map;
  }, [splits]);

  // ── calculations ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!selectedGroup || !socioA || !socioB) {
      return null;
    }

    // DB stores profit_share_seller/partner as decimals (e.g. 0.7 = 70%)
    // cost_split_ratio is also 0–1
    const sellerProfitPct = selectedGroup.profit_share_seller;
    const partnerProfitPct = selectedGroup.profit_share_partner;
    const costSplitRatio = selectedGroup.cost_split_ratio; // 0–1, % do custo que vai para o Sócio A (dono)

    // Separate sales by who made them
    const salesByA = societySales.filter(s => s.owner_id === socioA.id);
    const salesByB = societySales.filter(s => s.owner_id === socioB.id);

    const totalSalesA = salesByA.reduce((sum, s) => sum + s.total, 0);
    const totalSalesB = salesByB.reduce((sum, s) => sum + s.total, 0);
    const totalSalesAll = totalSalesA + totalSalesB;

    // Cost recovery from splits (type = 'cost_recovery')
    const totalCostRecovery = splits
      .filter(s => s.type === "cost_recovery")
      .reduce((sum, s) => sum + (s.amount ?? 0), 0);

    // Profit shares from splits
    const profitShareSplits = splits.filter(s => s.type === "profit_share");
    const totalProfitAll = profitShareSplits.reduce((sum, s) => sum + (s.amount ?? 0), 0);

    // Profit generated by sales of each partner (sum of profit_share splits for sales they made)
    const calcProfitBySeller = (sellerId: string) => {
      const sellerSaleIds = new Set(societySales.filter(s => s.owner_id === sellerId).map(s => s.id));
      return profitShareSplits
        .filter(s => sellerSaleIds.has(s.sale_id))
        .reduce((sum, s) => sum + (s.amount ?? 0), 0);
    };

    const profitGeneratedByA = calcProfitBySeller(socioA.id);
    const profitGeneratedByB = calcProfitBySeller(socioB.id);

    // Fatias de A e B do lucro gerado por A
    // Quem vendeu = sellerPct, o outro = partnerPct (sobre o lucro total dessa venda)
    const profitFromA_toA = profitGeneratedByA * sellerProfitPct;
    const profitFromA_toB = profitGeneratedByA * partnerProfitPct;
    const profitFromB_toB = profitGeneratedByB * sellerProfitPct;
    const profitFromB_toA = profitGeneratedByB * partnerProfitPct;

    // Totais de lucro por sócio
    const totalProfitA = profitFromA_toA + profitFromB_toA;
    const totalProfitB = profitFromA_toB + profitFromB_toB;

    // Reposição de custos
    const costRepA = totalCostRecovery * costSplitRatio;
    const costRepB = totalCostRecovery * (1 - costSplitRatio);

    // Total geral
    const totalGeralA = totalProfitA + costRepA;
    const totalGeralB = totalProfitB + costRepB;

    return {
      totalSalesAll,
      totalSalesA,
      totalSalesB,
      totalCostRecovery,
      totalProfitAll,
      profitGeneratedByA,
      profitGeneratedByB,
      profitFromA_toA,
      profitFromA_toB,
      profitFromB_toA,
      profitFromB_toB,
      totalProfitA,
      totalProfitB,
      costRepA,
      costRepB,
      totalGeralA,
      totalGeralB,
      sellerProfitPct,
      partnerProfitPct,
      costSplitRatio,
    };
  }, [selectedGroup, socioA, socioB, societySales, splits]);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["society-"] });
    toast({ title: "Relatório atualizado" });
  };

  const isLoading = salesLoading || splitsLoading;
  const hasData = !!selectedGroup && !!socioA && !!socioB && !!metrics;

  // ── labels ─────────────────────────────────────────────────────────────
  const nameA = socioA?.full_name ?? "Sócio A";
  const nameB = socioB?.full_name ?? "Sócio B";

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PieChart className="h-6 w-6 text-primary" />
              Acerto de Sociedade
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Transparência total na divisão de lucros entre sócios
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Selecione uma sociedade…" />
            </SelectTrigger>
            <SelectContent>
              {mySocieties.length === 0 && (
                <SelectItem value="none" disabled>Nenhuma sociedade encontrada</SelectItem>
              )}
              {mySocieties.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Empty state */}
        {selectedGroupId === "none" && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Selecione uma sociedade para ver o relatório</p>
          </div>
        )}

        {isLoading && selectedGroupId !== "none" && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* ── 4-card Dashboard ── */}
        {!isLoading && hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Card 1: O Bolo Inteiro ── */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Total em Sociedade
                </CardTitle>
                <p className="text-xs text-muted-foreground">Visão consolidada do período</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Total de Vendas" value={fmt(metrics.totalSalesAll)} bold />
                <Row label="Custos Totais (CMV)" value={fmt(metrics.totalCostRecovery)} color="text-destructive" />
                <Separator />
                <Row label="Lucro Total" value={fmt(metrics.totalProfitAll)} bold color="text-green-600 dark:text-green-400" />
              </CardContent>
            </Card>

            {/* ── Card 2: Sócio A ── */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Performance — {nameA}
                </CardTitle>
                <Badge variant="outline" className="w-fit text-xs">Sócio A · Dono do Grupo</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Total de Vendas" value={fmt(metrics.totalSalesA)} bold />
                <Row label="Lucro Gerado" value={fmt(metrics.profitGeneratedByA)} />
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Divisão do Lucro</p>
                <Row
                  label={`Fatia de ${nameA} (${pct(metrics.sellerProfitPct)})`}
                  value={fmt(metrics.profitFromA_toA)}
                  color="text-green-600 dark:text-green-400"
                />
                <Row
                  label={`Fatia de ${nameB} (${pct(metrics.partnerProfitPct)})`}
                  value={fmt(metrics.profitFromA_toB)}
                  color="text-blue-600 dark:text-blue-400"
                />
              </CardContent>
            </Card>

            {/* ── Card 3: Sócio B ── */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Performance — {nameB}
                </CardTitle>
                <Badge variant="outline" className="w-fit text-xs">Sócio B · Parceiro</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Total de Vendas" value={fmt(metrics.totalSalesB)} bold />
                <Row label="Lucro Gerado" value={fmt(metrics.profitGeneratedByB)} />
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Divisão do Lucro</p>
                <Row
                  label={`Fatia de ${nameB} (${pct(metrics.sellerProfitPct)})`}
                  value={fmt(metrics.profitFromB_toB)}
                  color="text-blue-600 dark:text-blue-400"
                />
                <Row
                  label={`Fatia de ${nameA} (${pct(metrics.partnerProfitPct)})`}
                  value={fmt(metrics.profitFromB_toA)}
                  color="text-green-600 dark:text-green-400"
                />
              </CardContent>
            </Card>

            {/* ── Card 4: Acerto de Contas ── */}
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                  Acerto de Contas
                </CardTitle>
                <p className="text-xs text-muted-foreground">Quanto pertence a cada sócio</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sócio A */}
                <div className="rounded-lg bg-background border border-border p-4 space-y-2">
                  <p className="text-sm font-semibold">{nameA}</p>
                  <Row label="Reposição de Custos" value={fmt(metrics.costRepA)} />
                  <Row label="Lucro Total" value={fmt(metrics.totalProfitA)} />
                  <Separator />
                  <div className="flex items-center justify-between rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2">
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">TOTAL GERAL</span>
                    <span className="text-lg font-bold text-green-700 dark:text-green-400">{fmt(metrics.totalGeralA)}</span>
                  </div>
                </div>

                {/* Sócio B */}
                <div className="rounded-lg bg-background border border-border p-4 space-y-2">
                  <p className="text-sm font-semibold">{nameB}</p>
                  <Row label="Reposição de Custos" value={fmt(metrics.costRepB)} />
                  <Row label="Lucro Total" value={fmt(metrics.totalProfitB)} />
                  <Separator />
                  <div className="flex items-center justify-between rounded-md bg-blue-500/10 border border-blue-500/30 px-3 py-2">
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-400">TOTAL GERAL</span>
                    <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{fmt(metrics.totalGeralB)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        {/* No data after load */}
        {!isLoading && selectedGroupId !== "none" && !hasData && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Sem dados para o período selecionado</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// ─── sub-component ───────────────────────────────────────────────────────────
function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm text-muted-foreground ${bold ? "font-semibold text-foreground" : ""}`}>{label}</span>
      <span className={`text-sm font-semibold ${color ?? ""} ${bold ? "text-base" : ""}`}>{value}</span>
    </div>
  );
}

function pct(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}
