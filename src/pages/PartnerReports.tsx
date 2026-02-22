import { useState, useMemo, useCallback } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { Users, TrendingUp, DollarSign, Calendar, Filter, X, Share2, Building2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SaleWithItems {
  id: string;
  owner_id: string;
  total: number;
  subtotal: number;
  created_at: string;
  sale_items: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
}

interface FinancialSplit {
  id: string;
  sale_id: string;
  user_id: string;
  amount: number;
  type: "cost_recovery" | "profit_share" | "group_commission";
  description: string;
  created_at: string;
}

interface GroupWithConfig {
  id: string;
  name: string;
  commission_percent: number;
  cost_split_ratio: number;
  profit_share_seller: number;
  profit_share_partner: number;
  is_direct: boolean;
}

interface GroupMember {
  group_id: string;
  user_id: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

interface PaymentReminder {
  id: string;
  sale_id: string | null;
  is_paid: boolean;
  amount: number;
}

interface PartnerSummary {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  groupId: string;
  groupName: string;
  isDirect: boolean;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  sellerEarnings: number;
  partnerEarnings: number;
  deferredSellerEarnings: number;
  deferredPartnerEarnings: number;
  salesCount: number;
}


const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "year", label: "Este Ano" },
  { value: "all", label: "Todo Período" }
];

interface PartnerReportsProps {
  filterMode?: "all" | "partnerships" | "groups";
}

export default function PartnerReports({ filterMode }: PartnerReportsProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useFormPersistence("partnerReports_period", "month");
  const [selectedGroupId, setSelectedGroupId] = useFormPersistence("partnerReports_groupId", "all");
  const [selectedPartnerId, setSelectedPartnerId] = useFormPersistence("partnerReports_partnerId", "all");
  const [activeTab, setActiveTab] = useFormPersistence("partnerReports_activeTab", filterMode || "all");

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["partner-sales"] }),
      queryClient.invalidateQueries({ queryKey: ["products-for-partner-report"] }),
      queryClient.invalidateQueries({ queryKey: ["product-partnerships-report"] }),
      queryClient.invalidateQueries({ queryKey: ["user-group-memberships"] }),
      queryClient.invalidateQueries({ queryKey: ["groups-with-config"] }),
      queryClient.invalidateQueries({ queryKey: ["profiles"] }),
    ]);

    toast({ title: "Relatório atualizado" });
  };

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "year":
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: new Date(2020, 0, 1), end: now };
    }
  }, [period]);

  // Fetch user's groups
  const { data: userGroupMemberships = [] } = useQuery({
    queryKey: ["user-group-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_members").select("group_id, user_id");
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!user
  });

  // Fetch groups with full configuration
  const { data: groups = [] } = useQuery({
    queryKey: ["groups-with-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, commission_percent, cost_split_ratio, profit_share_seller, profit_share_partner, is_direct");
      if (error) throw error;
      return data as GroupWithConfig[];
    },
    enabled: !!user
  });

  // Fetch all sales with items
  const { data: salesData = [], isLoading: salesLoading } = useQuery({
    queryKey: ["partner-sales", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          owner_id,
          total,
          subtotal,
          created_at,
          sale_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq("status", "completed")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SaleWithItems[];
    },
    enabled: !!user
  });

  // Fetch financial splits (source of truth for earnings/divisions)
  const { data: financialSplits = [] } = useQuery({
    queryKey: ["partner-financial-splits", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_splits")
        .select("id, sale_id, user_id, amount, type, description, created_at")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data as FinancialSplit[];
    },
    enabled: !!user,
  });

  // Fetch payment reminders to identify unpaid deferred sales
  const { data: paymentReminders = [] } = useQuery({
    queryKey: ["partner-payment-reminders", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_reminders")
        .select("id, sale_id, is_paid, amount")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data as PaymentReminder[];
    },
    enabled: !!user,
  });

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, phone");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!user
  });

  // Get user's groups separated by type
  const userGroups = useMemo(() => {
    const userGroupIds = userGroupMemberships.filter(m => m.user_id === user?.id).map(m => m.group_id);
    return groups.filter(g => userGroupIds.includes(g.id));
  }, [userGroupMemberships, groups, user]);

  const directPartnerships = useMemo(() => userGroups.filter(g => g.is_direct), [userGroups]);
  const regularGroups = useMemo(() => userGroups.filter(g => !g.is_direct), [userGroups]);

  // Get partners in user's groups
  const partners = useMemo(() => {
    if (!user) return [];
    const relevantGroups = activeTab === "partnerships" ? directPartnerships : regularGroups;
    let relevantGroupIds = relevantGroups.map(g => g.id);
    if (selectedGroupId !== "all") {
      relevantGroupIds = [selectedGroupId];
    }
    const partnerIds = new Set<string>();
    userGroupMemberships
      .filter(m => relevantGroupIds.includes(m.group_id) && m.user_id !== user.id)
      .forEach(m => partnerIds.add(m.user_id));
    return profiles.filter(p => partnerIds.has(p.id));
  }, [userGroupMemberships, directPartnerships, regularGroups, profiles, user, selectedGroupId, activeTab]);

  type ReportKind = "all" | "partnerships" | "groups";

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

   const splitsBySaleId = useMemo(() => {
    const map = new Map<string, FinancialSplit[]>();
    for (const s of financialSplits) {
      const arr = map.get(s.sale_id) ?? [];
      arr.push(s);
      map.set(s.sale_id, arr);
    }
    return map;
  }, [financialSplits]);

  // Map of sale_id -> whether the sale has an unpaid deferred payment
  const unpaidDeferredSaleIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of paymentReminders) {
      if (r.sale_id && !r.is_paid) {
        set.add(r.sale_id);
      }
    }
    return set;
  }, [paymentReminders]);

  const detectKindBySplits = useCallback((saleId: string): Exclude<ReportKind, "all"> | "own" => {
    const splits = splitsBySaleId.get(saleId) ?? [];
    const joined = splits.map((s) => s.description.toLowerCase()).join(" | ");

    if (joined.includes("parceria") || joined.includes("cessão") || joined.includes("cessao")) return "partnerships";
    if (joined.includes("comissão grupo") || joined.includes("comissao grupo")) return "groups";
    return "own";
  }, [splitsBySaleId]);

  const calculateSummaries = (kind: ReportKind) => {
    if (!user) return { mySales: [], partnerSales: [] };

    const mySalesMap = new Map<string, PartnerSummary>();
    const partnerSalesMap = new Map<string, PartnerSummary>();

    const relevantSales = salesData.filter((sale) => {
      const saleKind = detectKindBySplits(sale.id);
      if (kind === "all") return true;
      return saleKind === kind;
    });

    const newSummary = (id: string, name: string, email: string, groupId: string, groupName: string, isDirect: boolean): PartnerSummary => ({
      partnerId: id, partnerName: name, partnerEmail: email, groupId, groupName, isDirect,
      totalSales: 0, totalCost: 0, totalProfit: 0,
      sellerEarnings: 0, partnerEarnings: 0,
      deferredSellerEarnings: 0, deferredPartnerEarnings: 0,
      salesCount: 0,
    });

    for (const sale of relevantSales) {
      const splits = splitsBySaleId.get(sale.id) ?? [];
      const myTotalInSale = splits.filter((s) => s.user_id === user.id).reduce((sum, s) => sum + s.amount, 0);
      const otherSplits = splits.filter((s) => s.user_id !== user.id);

      const saleKind = detectKindBySplits(sale.id);
      const groupName = saleKind === "partnerships" ? "Sociedade 1-1" : saleKind === "groups" ? "Parceria" : "Estoque Próprio";
      const groupId = saleKind;
      const isDirect = saleKind === "partnerships";

      const isDeferred = unpaidDeferredSaleIds.has(sale.id);

      // Vendas que EU fiz (posso dever para outros)
      if (sale.owner_id === user.id) {
        if (otherSplits.length === 0) {
          const key = `__own__-${groupId}`;
          if (!mySalesMap.has(key)) {
            mySalesMap.set(key, newSummary("__own__", "(Sem parceiro)", "", groupId, groupName, isDirect));
          }
          const summary = mySalesMap.get(key)!;
          summary.totalSales += sale.total;
          if (isDeferred) {
            summary.deferredSellerEarnings += myTotalInSale;
          } else {
            summary.sellerEarnings += myTotalInSale;
          }
          summary.salesCount += 1;
        } else {
          const byRecipient = new Map<string, number>();
          for (const s of otherSplits) {
            byRecipient.set(s.user_id, (byRecipient.get(s.user_id) ?? 0) + s.amount);
          }

          for (const [partnerId, owed] of byRecipient.entries()) {
            const partner = profileMap.get(partnerId);
            const key = `${partnerId}-${groupId}`;
            if (!mySalesMap.has(key)) {
              mySalesMap.set(key, newSummary(partnerId, partner?.full_name ?? "Parceiro", partner?.email ?? "", groupId, groupName, isDirect));
            }
            const summary = mySalesMap.get(key)!;
            summary.totalSales += sale.total;
            if (isDeferred) {
              summary.deferredSellerEarnings += myTotalInSale;
              summary.deferredPartnerEarnings += owed;
            } else {
              summary.sellerEarnings += myTotalInSale;
              summary.partnerEarnings += owed;
            }
            summary.salesCount += 1;
          }
        }
      }

      // Vendas que OUTROS fizeram e EU recebo algo
      if (sale.owner_id !== user.id && myTotalInSale > 0) {
        const seller = profileMap.get(sale.owner_id);
        const sellerTotalInSale = splits.filter((s) => s.user_id === sale.owner_id).reduce((sum, s) => sum + s.amount, 0);

        const key = `${sale.owner_id}-${groupId}`;
        if (!partnerSalesMap.has(key)) {
          partnerSalesMap.set(key, newSummary(sale.owner_id, seller?.full_name ?? "Vendedor", seller?.email ?? "", groupId, groupName, isDirect));
        }
        const summary = partnerSalesMap.get(key)!;
        summary.totalSales += sale.total;
        if (isDeferred) {
          summary.deferredPartnerEarnings += myTotalInSale;
          summary.deferredSellerEarnings += sellerTotalInSale;
        } else {
          summary.partnerEarnings += myTotalInSale;
          summary.sellerEarnings += sellerTotalInSale;
        }
        summary.salesCount += 1;
      }
    }

    return {
      mySales: Array.from(mySalesMap.values()).sort((a, b) => b.totalSales - a.totalSales),
      partnerSales: Array.from(partnerSalesMap.values()).sort((a, b) => b.totalSales - a.totalSales),
    };
  };

  const allSummaries = useMemo(() => calculateSummaries("all"), [salesData, financialSplits, profiles, user, paymentReminders]);
  const partnershipSummaries = useMemo(() => calculateSummaries("partnerships"), [salesData, financialSplits, profiles, user, paymentReminders]);
  const groupSummaries = useMemo(() => calculateSummaries("groups"), [salesData, financialSplits, profiles, user, paymentReminders]);

  // Calculate totals for each type
  const calculateTotals = (mySales: PartnerSummary[], partnerSales: PartnerSummary[]) => {
    const mySellerEarnings = mySales.reduce((sum, s) => sum + s.sellerEarnings, 0);
    const iOwePartners = mySales.reduce((sum, s) => sum + s.partnerEarnings, 0);
    const myOwnerEarnings = partnerSales.reduce((sum, s) => sum + s.partnerEarnings, 0);
    const deferredIOwe = mySales.reduce((sum, s) => sum + s.deferredPartnerEarnings, 0);
    const deferredMyEarnings = mySales.reduce((sum, s) => sum + s.deferredSellerEarnings, 0);
    const deferredOwnerEarnings = partnerSales.reduce((sum, s) => sum + s.deferredPartnerEarnings, 0);
    return {
      mySellerEarnings,
      iOwePartners,
      myOwnerEarnings,
      partnersOweMe: myOwnerEarnings,
      netBalance: myOwnerEarnings - iOwePartners,
      deferredIOwe,
      deferredMyEarnings,
      deferredOwnerEarnings,
    };
  };

  const allTotals = useMemo(() => calculateTotals(allSummaries.mySales, allSummaries.partnerSales), [allSummaries]);
  const partnershipTotals = useMemo(() => calculateTotals(partnershipSummaries.mySales, partnershipSummaries.partnerSales), [partnershipSummaries]);
  const groupTotals = useMemo(() => calculateTotals(groupSummaries.mySales, groupSummaries.partnerSales), [groupSummaries]);

  const clearFilters = () => {
    setPeriod("month");
    setSelectedGroupId("all");
    setSelectedPartnerId("all");
  };

  const activeFiltersCount = [
    period !== "month",
    selectedGroupId !== "all",
    selectedPartnerId !== "all"
  ].filter(Boolean).length;

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Generate WhatsApp settlement text
  const generateSettlementText = () => {
    const currentUser = profiles.find(p => p.id === user?.id);
    const periodLabel = periodOptions.find(p => p.value === period)?.label || period;
    const isPartnership = activeTab === "partnerships";
    const summaries = isPartnership ? partnershipSummaries : groupSummaries;
    const totals = isPartnership ? partnershipTotals : groupTotals;
    const typeLabel = isPartnership ? "SOCIEDADES 1-1" : "PARCERIAS";

    let text = `📊 *ACERTO DE CONTAS - ${typeLabel}*\n`;
    text += `📅 ${periodLabel.toUpperCase()}: ${format(dateRange.start, "dd/MM/yyyy")} a ${format(dateRange.end, "dd/MM/yyyy")}\n\n`;
    text += `👤 *${currentUser?.full_name || 'Você'}*\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (summaries.mySales.length > 0) {
      text += `📤 *${isPartnership ? (partners.length === 1 ? `Devo a ${partners[0].full_name}` : 'Devo às Sócias') : (partners.length === 1 ? `Devo a ${partners[0].full_name}` : 'Devo às Parceiras')}:*\n`;
      summaries.mySales.forEach(s => {
        text += `  • ${s.partnerName}: ${formatCurrency(s.partnerEarnings)}\n`;
      });
      text += `  *Subtotal: ${formatCurrency(totals.iOwePartners)}*\n\n`;
    }

    if (summaries.partnerSales.length > 0) {
      text += `📥 *A Receber:*\n`;
      summaries.partnerSales.forEach(s => {
        text += `  • ${s.partnerName}: ${formatCurrency(s.partnerEarnings)}\n`;
      });
      text += `  *Subtotal: ${formatCurrency(totals.partnersOweMe)}*\n\n`;
    }

    // Deferred amounts
    if (hasDeferredAmounts(totals)) {
      text += `\n⏳ *VENDAS A PRAZO (PENDENTES):*\n`;
      if (totals.deferredIOwe > 0) {
        text += `  • Devo (pendente): ${formatCurrency(totals.deferredIOwe)}\n`;
      }
      if (totals.deferredOwnerEarnings > 0) {
        text += `  • A receber (pendente): ${formatCurrency(totals.deferredOwnerEarnings)}\n`;
      }
      text += `  _Não incluídos no saldo final_\n\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    const balanceEmoji = totals.netBalance >= 0 ? '✅' : '🔴';
    const balanceLabel = totals.netBalance >= 0 ? 'A RECEBER' : 'A PAGAR';
    text += `${balanceEmoji} *SALDO FINAL (${balanceLabel}): ${formatCurrency(Math.abs(totals.netBalance))}*\n`;
    text += `_(apenas vendas já recebidas)_\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `_Gerado por VendaProfit_`;
    return text;
  };

  const handleExportSettlement = () => {
    const text = generateSettlementText();
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Texto copiado!",
        description: "O acerto de contas foi copiado para a área de transferência e o WhatsApp foi aberto."
      });
    }).catch(() => {
      toast({
        title: "WhatsApp aberto",
        description: "Selecione a pessoa para enviar o acerto de contas."
      });
    });
  };

  const currentGroups = activeTab === "partnerships" ? directPartnerships : regularGroups;

  const hasDeferredAmounts = (totals: ReturnType<typeof calculateTotals>) => 
    totals.deferredIOwe > 0 || totals.deferredMyEarnings > 0 || totals.deferredOwnerEarnings > 0;

  const currentUserName = profiles.find(p => p.id === user?.id)?.full_name || "Você";

  const renderSummaryCards = (totals: ReturnType<typeof calculateTotals>, isPartnership: boolean) => (
    <div className="space-y-4 mb-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ganhos de {currentUserName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totals.mySellerEarnings)}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPartnership ? "Vendas de peças de sócias" : "Vendas de peças de parceiras"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isPartnership 
                ? (partners.length === 1 ? `Devo a ${partners[0].full_name}` : "Devo às Sócias")
                : (partners.length === 1 ? `Devo a ${partners[0].full_name}` : "Devo às Parceiras")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(totals.iOwePartners)}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPartnership 
                ? (partners.length === 1 ? `Parte de ${partners[0].full_name}` : "Parte das sócias")
                : (partners.length === 1 ? `Parte de ${partners[0].full_name}` : "Parte das parceiras")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Minhas Peças Vendidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totals.myOwnerEarnings)}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPartnership ? "Vendidas por sócias" : "Vendidas por parceiras"}
            </p>
          </CardContent>
        </Card>

        <Card className={totals.netBalance >= 0 ? "border-green-500/50" : "border-destructive/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totals.netBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(totals.netBalance)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totals.netBalance >= 0 ? "A receber" : "A pagar"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deferred (a prazo) section */}
      {hasDeferredAmounts(totals) && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Calendar className="h-4 w-4" />
              Vendas a Prazo (Pagamento Pendente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Estes valores são de vendas a prazo ainda não recebidas. Não estão incluídos nos totais acima até que o pagamento seja confirmado.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {totals.deferredMyEarnings > 0 && (
                <div className="flex items-center justify-between p-2 rounded-md bg-background/80">
                  <span className="text-sm text-muted-foreground">Ganhos pendentes de {currentUserName}</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(totals.deferredMyEarnings)}</span>
                </div>
              )}
              {totals.deferredIOwe > 0 && (
                <div className="flex items-center justify-between p-2 rounded-md bg-background/80">
                  <span className="text-sm text-muted-foreground">{isPartnership ? (partners.length === 1 ? `Devo a ${partners[0].full_name} (pendente)` : "Devo às sócias (pendente)") : (partners.length === 1 ? `Devo a ${partners[0].full_name} (pendente)` : "Devo às parceiras (pendente)")}</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(totals.deferredIOwe)}</span>
                </div>
              )}
              {totals.deferredOwnerEarnings > 0 && (
                <div className="flex items-center justify-between p-2 rounded-md bg-background/80">
                  <span className="text-sm text-muted-foreground">A receber (pendente)</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(totals.deferredOwnerEarnings)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderTables = (summaries: ReturnType<typeof calculateSummaries>, isPartnership: boolean) => (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* My Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {isPartnership ? "Minhas Vendas (Peças de Sócias)" : "Minhas Vendas (Peças de Parceiras)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{isPartnership ? "Sócia" : "Parceira"}</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">{currentUserName}</TableHead>
                <TableHead className="text-right">{isPartnership && partners.length === 1 ? `Pagar a ${partners[0].full_name}` : "Devo"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : summaries.mySales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {isPartnership
                      ? "Nenhuma venda de sociedades no período (vendas de estoque próprio não entram aqui)."
                      : "Nenhuma venda de parcerias no período (vendas de estoque próprio não entram aqui)."}
                  </TableCell>
                </TableRow>
              ) : (
                summaries.mySales.map((summary, idx) => (
                  <TableRow key={`${summary.partnerId}-${summary.groupId}-${idx}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{summary.partnerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {summary.groupName} • {summary.salesCount} {summary.salesCount === 1 ? "item" : "itens"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.totalSales)}</TableCell>
                    <TableCell className="text-right text-primary font-medium">
                      {formatCurrency(summary.sellerEarnings)}
                      {summary.deferredSellerEarnings > 0 && (
                        <p className="text-xs text-amber-600 font-normal">+ {formatCurrency(summary.deferredSellerEarnings)} a prazo</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {formatCurrency(summary.partnerEarnings)}
                      {summary.deferredPartnerEarnings > 0 && (
                        <p className="text-xs text-amber-600 font-normal">+ {formatCurrency(summary.deferredPartnerEarnings)} a prazo</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Partner Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            {isPartnership ? "Vendas de Sócias (Minhas Peças)" : "Vendas de Parceiras (Minhas Peças)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{isPartnership ? "Sócia" : "Vendedora"}</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">{currentUserName}</TableHead>
                <TableHead className="text-right">{isPartnership && partners.length === 1 ? `Ganho de ${partners[0].full_name}` : (summaries.partnerSales.length === 1 ? `Ganho de ${summaries.partnerSales[0].partnerName}` : (isPartnership ? "Ganho da Sócia" : "Ganho da Parceira"))}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : summaries.partnerSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {isPartnership
                      ? "Nenhuma venda de sócias com suas peças no período."
                      : "Nenhuma venda de parceiras com suas peças no período."}
                  </TableCell>
                </TableRow>
              ) : (
                summaries.partnerSales.map((summary, idx) => (
                  <TableRow key={`${summary.partnerId}-${summary.groupId}-${idx}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{summary.partnerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {summary.groupName} • {summary.salesCount} {summary.salesCount === 1 ? "item" : "itens"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.totalSales)}</TableCell>
                    <TableCell className="text-right text-primary font-medium">
                      {formatCurrency(summary.partnerEarnings)}
                      {summary.deferredPartnerEarnings > 0 && (
                        <p className="text-xs text-amber-600 font-normal">+ {formatCurrency(summary.deferredPartnerEarnings)} a prazo</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(summary.sellerEarnings)}
                      {summary.deferredSellerEarnings > 0 && (
                        <p className="text-xs text-amber-600 font-normal">+ {formatCurrency(summary.deferredSellerEarnings)} a prazo</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {filterMode === "partnerships" ? "Relatório de Sociedades" : filterMode === "groups" ? "Relatório de Parcerias" : "Relatório de Sociedades e Parcerias"}
          </h1>
          <p className="text-muted-foreground">
            {filterMode === "partnerships" ? "Acompanhe os ganhos e divisões com sociedades 1-1" : filterMode === "groups" ? "Acompanhe os ganhos e divisões com parcerias" : "Acompanhe os ganhos e divisões com sociedades 1-1 e parcerias"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={handleExportSettlement} className="gap-2">
            <Share2 className="h-4 w-4" />
            Exportar Acerto de Contas
          </Button>
        </div>
      </div>

      {/* Tabs for Partnerships vs Groups */}
      <Tabs value={filterMode || activeTab} onValueChange={(v) => { if (!filterMode) { setActiveTab(v as typeof activeTab); setSelectedGroupId("all"); setSelectedPartnerId("all"); } }} className="mb-6">
        {!filterMode && (
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="all" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Todas
            </TabsTrigger>
            <TabsTrigger value="partnerships" className="gap-2">
              <Users className="h-4 w-4" />
              Sociedades 1-1 ({directPartnerships.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Building2 className="h-4 w-4" />
              Parcerias ({regularGroups.length})
            </TabsTrigger>
          </TabsList>
        )}

        {/* Info Card */}
        <Card className="my-6 bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              {activeTab === "partnerships" ? (
                <>
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Regra de Sociedade 1-1</p>
                    <p className="text-muted-foreground">
                      <strong>Quem vende:</strong> 50% do custo + 70% do lucro | 
                      <strong> Sócia:</strong> 50% do custo + 30% do lucro
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      As regras podem variar por sociedade. Verifique as configurações de cada sociedade.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Building2 className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Regra de Parceria</p>
                    <p className="text-muted-foreground">
                      <strong>Dono da peça:</strong> Custo + Comissão (ex: 20% do lucro) | 
                      <strong> Vendedor:</strong> Lucro restante (ex: 80%)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      A comissão pode variar por parceria. Verifique as configurações de cada parceria.
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={activeTab === "partnerships" ? "Parceria" : "Grupo"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{activeTab === "partnerships" ? "Todas as Sociedades" : "Todas as Parcerias"}</SelectItem>
              {currentGroups.map(group => (
                <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={activeTab === "partnerships" ? "Sócia" : "Parceira"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{activeTab === "partnerships" ? "Todas as Sócias" : "Todas as Parceiras"}</SelectItem>
              {partners.map(partner => (
                <SelectItem key={partner.id} value={partner.id}>{partner.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar ({activeFiltersCount})
            </Button>
          )}
        </div>

        <TabsContent value="all">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Todas as Vendas (com divisões)
          </h2>
          {renderSummaryCards(allTotals, false)}
          <Separator className="my-6" />
          {renderTables(allSummaries, false)}
        </TabsContent>

        <TabsContent value="partnerships">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Acerto entre Sócias (1-1)
          </h2>
          {renderSummaryCards(partnershipTotals, true)}
          <Separator className="my-6" />
          {renderTables(partnershipSummaries, true)}
        </TabsContent>

        <TabsContent value="groups">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Acerto entre Parceiras
          </h2>
          {renderSummaryCards(groupTotals, false)}
          <Separator className="my-6" />
          {renderTables(groupSummaries, false)}
        </TabsContent>
      </Tabs>

      {/* Period Info */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Período: {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
      </div>
    </MainLayout>
  );
}
