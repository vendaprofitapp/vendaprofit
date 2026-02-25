import { useState, useMemo } from "react";
import { PieChart, Users, TrendingUp, DollarSign, RefreshCw, CalendarIcon } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "all", label: "Todo Período" },
  { value: "custom", label: "Personalizado" },
];

// ─── types ───────────────────────────────────────────────────────────────────
interface Group {
  id: string;
  name: string;
  created_by: string;
  is_direct: boolean;
}
interface GroupMember { group_id: string; user_id: string; }
interface Profile { id: string; full_name: string | null; email: string; }
interface FinancialSplit {
  sale_id: string;
  user_id: string;
  amount: number;
  split_type: string | null;
}
interface SaleItem {
  quantity: number;
  products: { cost_price: number | null } | null;
}
interface Sale {
  id: string;
  owner_id: string;
  total: number;
  payment_method: string | null;
  sale_items: SaleItem[];
  financial_splits: FinancialSplit[];
}
interface PaymentFee {
  payment_method: string;
  fee_percent: number;
}
interface PartnershipRule {
  owner_cost_percent: number;
  seller_cost_percent: number;
  owner_profit_percent: number;
  seller_profit_percent: number;
}

// ─── component ───────────────────────────────────────────────────────────────
export default function SocietyReport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("none");
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customEnd, setCustomEnd] = useState<Date | undefined>(endOfMonth(new Date()));

  // ── date range ──────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today":  return { start: startOfDay(now), end: endOfDay(now) };
      case "week":   return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
      case "month":  return { start: startOfMonth(now), end: endOfMonth(now) };
      case "custom": return {
        start: customStart ? startOfDay(customStart) : new Date(2020, 0, 1),
        end:   customEnd   ? endOfDay(customEnd)     : now,
      };
      default: return { start: new Date(2020, 0, 1), end: now };
    }
  }, [period, customStart, customEnd]);

  // ── all group memberships ─────────────────────────────────────────────
  const { data: memberships = [] } = useQuery<GroupMember[]>({
    queryKey: ["society-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_members").select("group_id, user_id");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ── direct societies ──────────────────────────────────────────────────
  const { data: allGroups = [] } = useQuery<Group[]>({
    queryKey: ["society-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, created_by, is_direct")
        .eq("is_direct", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ── profiles ──────────────────────────────────────────────────────────
  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["society-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ── my direct societies ───────────────────────────────────────────────
  const myGroupIds = useMemo(
    () => memberships.filter(m => m.user_id === user?.id).map(m => m.group_id),
    [memberships, user]
  );
  const mySocieties = useMemo(
    () => allGroups.filter(g => myGroupIds.includes(g.id)),
    [allGroups, myGroupIds]
  );

  // ── selected group & members ──────────────────────────────────────────
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

  // Sócio A = creator, Sócio B = the other member
  const socioA = useMemo(() => {
    if (!selectedGroup) return null;
    return profileMap.get(selectedGroup.created_by) ?? null;
  }, [selectedGroup, profileMap]);

  const socioB = useMemo(() => {
    if (!selectedGroup) return null;
    const other = groupMembers.find(m => m.user_id !== selectedGroup.created_by);
    return other ? profileMap.get(other.user_id) ?? null : null;
  }, [selectedGroup, groupMembers, profileMap]);

  // ── sales in period for both partners ────────────────────────────────
  const partnerIds = useMemo(() => {
    if (!socioA || !socioB) return [];
    return [socioA.id, socioB.id];
  }, [socioA, socioB]);

  const { data: salesData = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["society-sales-v4", selectedGroupId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id, owner_id, total, payment_method,
          sale_items(quantity, products(cost_price)),
          financial_splits(sale_id, user_id, amount, type)
        `)
        .eq("status", "completed")
        .in("owner_id", partnerIds)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data as unknown as Sale[];
    },
    enabled: partnerIds.length === 2,
  });

  // ── payment fees table ────────────────────────────────────────────────
  const { data: paymentFees = [] } = useQuery<PaymentFee[]>({
    queryKey: ["society-payment-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_fees")
        .select("payment_method, fee_percent");
      if (error) throw error;
      return data as PaymentFee[];
    },
    enabled: !!user,
  });

  // ── partnership rules (fallback for cost ratio) ───────────────────────
  const { data: partnershipRules } = useQuery<PartnershipRule | null>({
    queryKey: ["society-rules", selectedGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partnership_rules")
        .select("owner_cost_percent, seller_cost_percent, owner_profit_percent, seller_profit_percent")
        .eq("group_id", selectedGroupId)
        .maybeSingle();
      if (error) throw error;
      return data as PartnershipRule | null;
    },
    enabled: selectedGroupId !== "none",
  });

  // ── HYBRID ENGINE ─────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!socioA || !socioB) return null;

    const id_A = socioA.id;
    const id_B = socioB.id;
    const currentRules = partnershipRules ?? null;

    const stats = {
      totalSales:  0,
      totalCosts:  0,
      totalProfit: 0,
      socioA: { salesGenerated: 0, profitGenerated: 0, fatiaParaA: 0, fatiaParaB: 0, costRecovery: 0, totalProfit: 0 },
      socioB: { salesGenerated: 0, profitGenerated: 0, fatiaParaA: 0, fatiaParaB: 0, costRecovery: 0, totalProfit: 0 },
    };

    // Deduplicate sales by id (safety net against fan-out)
    const uniqueSales = Array.from(new Map(salesData.map(s => [s.id, s])).values());

    uniqueSales.forEach(sale => {
      // 1. Receita Bruta
      const receita = sale.total || 0;
      stats.totalSales += receita;

      // 2. CMV Dinâmico
      let custo = 0;
      if (sale.sale_items) {
        sale.sale_items.forEach((item: any) => {
          const costPrice = item.products?.cost_price || 0;
          custo += item.quantity * costPrice;
        });
      }
      stats.totalCosts += custo;

      // 3. Taxa da Maquininha (Dinâmica baseada no método de pagamento + tabela payment_fees)
      const feeRule = paymentFees?.find((f: any) => f.payment_method === sale.payment_method);
      const feePercent = feeRule ? Number(feeRule.fee_percent) : 0;
      const taxas = receita * (feePercent / 100);

      // 4. Lucro Real da Venda (alinhado com Minha Performance)
      const lucroReal = receita - custo - taxas;
      stats.totalProfit += lucroReal;

      // 5. Inferir proporção histórica pelos profit_share splits
      const splits = (sale.financial_splits || []) as any[];
      let splitA = 0;
      let splitB = 0;
      splits.forEach((s: any) => {
        if (s.split_type === "profit_share" || s.type === "profit_share" || !s.split_type) {
          if (s.user_id === id_A) splitA += Number(s.amount);
          if (s.user_id === id_B) splitB += Number(s.amount);
        }
      });

      const totalSplit = splitA + splitB;
      let ratioA = (currentRules?.owner_profit_percent ?? 50) / 100;
      let ratioB = (currentRules?.seller_profit_percent ?? 50) / 100;
      if (totalSplit > 0) {
        ratioA = splitA / totalSplit;
        ratioB = splitB / totalSplit;
      }

      // 6. Rateio do Lucro Real
      const profitA = lucroReal * ratioA;
      const profitB = lucroReal * ratioB;

      // 7. Rateio da Reposição de Custo
      const costPercA = (currentRules?.owner_cost_percent ?? 50) / 100;
      const costPercB = (currentRules?.seller_cost_percent ?? 50) / 100;
      const costA = custo * costPercA;
      const costB = custo * costPercB;

      // Card 4 — Acerto de Contas
      stats.socioA.costRecovery += costA;
      stats.socioB.costRecovery += costB;
      stats.socioA.totalProfit  += profitA;
      stats.socioB.totalProfit  += profitB;

      // Cards 2 & 3 — Performance por dono da venda
      const isOwnerA = sale.owner_id === id_A;
      if (isOwnerA) {
        stats.socioA.salesGenerated  += receita;
        stats.socioA.profitGenerated += lucroReal;
        stats.socioA.fatiaParaA      += profitA;
        stats.socioA.fatiaParaB      += profitB;
      } else {
        stats.socioB.salesGenerated  += receita;
        stats.socioB.profitGenerated += lucroReal;
        stats.socioB.fatiaParaA      += profitA;
        stats.socioB.fatiaParaB      += profitB;
      }
    });

    return stats;
  }, [socioA, socioB, salesData, partnershipRules, paymentFees]);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["society-"] });
    toast({ title: "Relatório atualizado" });
  };

  const isLoading = salesLoading;
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
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
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

          {period === "custom" && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-44 justify-start text-left font-normal", !customStart && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStart ? format(customStart, "dd/MM/yyyy") : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-44 justify-start text-left font-normal", !customEnd && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEnd ? format(customEnd, "dd/MM/yyyy") : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        {/* Empty state */}
        {selectedGroupId === "none" && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Selecione uma sociedade para ver o relatório</p>
          </div>
        )}

        {/* Loading */}
        {selectedGroupId !== "none" && isLoading && (
          <div className="text-center py-16 text-muted-foreground animate-pulse">Carregando dados…</div>
        )}

        {/* No partners */}
        {selectedGroupId !== "none" && !isLoading && (!socioA || !socioB) && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Não foi possível identificar os dois sócios desta sociedade</p>
          </div>
        )}

        {/* Dashboard */}
        {selectedGroupId !== "none" && !isLoading && metrics && socioA && socioB && (
          <div className="grid gap-6">

            {/* ── Card 1: Visão Consolidada ─────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Visão Consolidada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Vendas</p>
                    <p className="text-2xl font-bold text-foreground">{fmt(metrics.totalSales)}</p>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Custos</p>
                    <p className="text-2xl font-bold text-destructive">{fmt(metrics.totalCosts)}</p>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Lucro Total</p>
                    <p className="text-2xl font-bold text-chart-2">{fmt(metrics.totalProfit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Cards 2 e 3: Performance dos Sócios ──────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Card 2: Sócio A */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Performance — {nameA}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Vendas Geradas</span>
                    <span className="font-semibold">{fmt(metrics.socioA.salesGenerated)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Lucro Gerado</span>
                    <span className="font-semibold text-chart-2">{fmt(metrics.socioA.profitGenerated)}</span>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rateio das vendas de {nameA}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fatia de {nameA}</span>
                    <span className="font-semibold">{fmt(metrics.socioA.fatiaParaA)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fatia de {nameB}</span>
                    <span className="font-semibold">{fmt(metrics.socioA.fatiaParaB)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Sócio B */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Performance — {nameB}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Vendas Geradas</span>
                    <span className="font-semibold">{fmt(metrics.socioB.salesGenerated)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Lucro Gerado</span>
                    <span className="font-semibold text-chart-2">{fmt(metrics.socioB.profitGenerated)}</span>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rateio das vendas de {nameB}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fatia de {nameB}</span>
                    <span className="font-semibold">{fmt(metrics.socioB.fatiaParaB)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fatia de {nameA}</span>
                    <span className="font-semibold">{fmt(metrics.socioB.fatiaParaA)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Card 4: Acerto de Contas ──────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Acerto de Contas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                  {/* Sócio A */}
                  <div className="space-y-3">
                    <p className="font-semibold text-foreground border-b border-border pb-2">{nameA}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Reposição de Custo</span>
                      <span className="font-medium">{fmt(metrics.socioA.costRecovery)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Lucro (Fatia Total)</span>
                      <span className="font-medium text-chart-2">{fmt(metrics.socioA.totalProfit)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Total a Receber</span>
                      <span className="text-lg font-bold text-primary">
                        {fmt(metrics.socioA.costRecovery + metrics.socioA.totalProfit)}
                      </span>
                    </div>
                  </div>

                  {/* Sócio B */}
                  <div className="space-y-3">
                    <p className="font-semibold text-foreground border-b border-border pb-2">{nameB}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Reposição de Custo</span>
                      <span className="font-medium">{fmt(metrics.socioB.costRecovery)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Lucro (Fatia Total)</span>
                      <span className="font-medium text-chart-2">{fmt(metrics.socioB.totalProfit)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Total a Receber</span>
                      <span className="text-lg font-bold text-primary">
                        {fmt(metrics.socioB.costRecovery + metrics.socioB.totalProfit)}
                      </span>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </MainLayout>
  );
}
