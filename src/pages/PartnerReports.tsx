import { useState, useMemo, useCallback } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { Users, TrendingUp, DollarSign, Calendar, Filter, X, Share2, Building2, ChevronDown, ChevronUp, ShoppingBag, Receipt } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  customer_name: string | null;
  payment_method: string;
  sale_source: string;
  event_name: string | null;
  shipping_cost: number | null;
  shipping_payer: string | null;
  discount_amount: number | null;
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
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());

  const toggleSaleExpanded = (saleId: string) => {
    setExpandedSales(prev => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

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
          customer_name,
          payment_method,
          sale_source,
          event_name,
          shipping_cost,
          shipping_payer,
          discount_amount,
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

  // Fetch financial splits filtered by sale_id (not by split created_at)
  // This avoids issues where retroactively recalculated splits have a newer created_at
  // than the sales they belong to, which would cause them to be excluded from period filters.
  const saleIdsInPeriod = useMemo(() => salesData.map(s => s.id), [salesData]);

  const { data: financialSplits = [] } = useQuery({
    queryKey: ["partner-financial-splits", saleIdsInPeriod],
    queryFn: async () => {
      if (saleIdsInPeriod.length === 0) return [];
      const results: FinancialSplit[] = [];
      for (let i = 0; i < saleIdsInPeriod.length; i += 500) {
        const chunk = saleIdsInPeriod.slice(i, i + 500);
        const { data, error } = await supabase
          .from("financial_splits")
          .select("id, sale_id, user_id, amount, type, description, created_at")
          .in("sale_id", chunk);
        if (error) throw error;
        if (data) results.push(...(data as FinancialSplit[]));
      }
      return results;
    },
    enabled: !!user && saleIdsInPeriod.length > 0,
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

  // Collect all unique product IDs from sales data to fetch costs
  const allSaleProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sale of salesData) {
      for (const item of sale.sale_items) {
        if (item.product_id) ids.add(item.product_id);
      }
    }
    return Array.from(ids);
  }, [salesData]);

  // Fetch product costs for ALL products appearing in sales (bypasses owner-based queries)
  const { data: allProductCosts = [] } = useQuery({
    queryKey: ["products-cost-for-partner-report", allSaleProductIds],
    queryFn: async () => {
      if (allSaleProductIds.length === 0) return [];
      const results: { id: string; cost_price: number | null }[] = [];
      for (let i = 0; i < allSaleProductIds.length; i += 500) {
        const chunk = allSaleProductIds.slice(i, i + 500);
        const { data, error } = await supabase
          .from("products")
          .select("id, cost_price")
          .in("id", chunk);
        if (error) throw error;
        if (data) results.push(...(data as { id: string; cost_price: number | null }[]));
      }
      return results;
    },
    enabled: allSaleProductIds.length > 0
  });

  // Fetch partner product IDs via product_partnerships (still needed for sale filtering)
  const partnerProductIdsForReport = useMemo(() => {
    const userGroupIds = userGroupMemberships.filter(m => m.user_id === user?.id).map(m => m.group_id);
    return userGroupIds;
  }, [userGroupMemberships, user]);

  const { data: partnerProductIds = [] } = useQuery({
    queryKey: ["partner-product-ids-partner-report", partnerProductIdsForReport],
    queryFn: async () => {
      if (partnerProductIdsForReport.length === 0) return [];
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("product_id")
        .in("group_id", partnerProductIdsForReport)
        .limit(5000);
      if (error) throw error;
      return (data || []).map(d => d.product_id) as string[];
    },
    enabled: !!user && partnerProductIdsForReport.length > 0
  });

  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProductCosts) {
      map.set(p.id, p.cost_price ?? 0);
    }
    return map;
  }, [allProductCosts]);

  // Fetch custom payment methods for fee calculation
  const { data: customPaymentMethods = [] } = useQuery({
    queryKey: ["custom-payment-methods-partner-report", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("id, name, fee_percent, is_active")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data as { id: string; name: string; fee_percent: number; is_active: boolean }[];
    },
    enabled: !!user
  });

  const feesMap = useMemo(() => {
    const map = new Map<string, number>();
    customPaymentMethods.forEach(m => map.set(m.name, m.fee_percent));
    return map;
  }, [customPaymentMethods]);

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

  // Partnership detailed data for 4-card layout
  const partnershipDetailedData = useMemo(() => {
    if (!user || directPartnerships.length === 0) return [];

    const filteredPartnerships = selectedGroupId !== "all"
      ? directPartnerships.filter(g => g.id === selectedGroupId)
      : directPartnerships;

    return filteredPartnerships.map(group => {
      const groupMemberIds = userGroupMemberships
        .filter(m => m.group_id === group.id)
        .map(m => m.user_id);

      const partnerBId = groupMemberIds.find(id => id !== user.id);
      if (!partnerBId) return null;

      const partnerAName = currentUserName;
      const partnerBName = profileMap.get(partnerBId)?.full_name ?? "Sócia";

      // Find partnership sales for this group
      const partnershipSales = salesData.filter(sale => {
        if (detectKindBySplits(sale.id) !== "partnerships") return false;
        if (!groupMemberIds.includes(sale.owner_id)) return false;
        const splits = splitsBySaleId.get(sale.id) ?? [];
        const splitUserIds = new Set(splits.map(s => s.user_id));
        return groupMemberIds.some(id => id !== sale.owner_id && splitUserIds.has(id));
      });

      const computeSellerData = (sellerId: string) => {
        const sellerSales = partnershipSales.filter(s => s.owner_id === sellerId);
        let totalVendas = 0; // subtotal (receita bruta antes de descontos)
        let totalCustos = 0;
        let totalDescontos = 0;
        let totalTaxas = 0;
        let sellerProfitShare = 0;
        let partnerProfitShare = 0;

        for (const sale of sellerSales) {
          // Receita bruta = subtotal (antes de descontos)
          totalVendas += sale.subtotal || sale.total;
          // Descontos
          totalDescontos += Number(sale.discount_amount) || 0;
          // Taxas reais do método de pagamento
          const feePercent = feesMap.get(sale.payment_method) ?? 0;
          totalTaxas += sale.total * (feePercent / 100);
          // Custos dos produtos
          for (const item of sale.sale_items) {
            const costPrice = productCostMap.get(item.product_id) ?? 0;
            totalCustos += costPrice * item.quantity;
          }
          const splits = splitsBySaleId.get(sale.id) ?? [];
          for (const split of splits) {
            if (split.type === 'profit_share') {
              if (split.user_id === sellerId) {
                sellerProfitShare += split.amount;
              } else {
                partnerProfitShare += split.amount;
              }
            }
          }
        }

        const lucroTotal = sellerProfitShare + partnerProfitShare;

        return { totalVendas, totalCustos, totalTaxas, totalDescontos, lucroTotal, sellerProfitShare, partnerProfitShare, salesCount: sellerSales.length };
      };

      const dataA = computeSellerData(user.id);
      const dataB = computeSellerData(partnerBId);

      const lucroTotalA = dataA.sellerProfitShare + dataB.partnerProfitShare;
      const lucroTotalB = dataA.partnerProfitShare + dataB.sellerProfitShare;

      const totalCustos = dataA.totalCustos + dataB.totalCustos;
      const custosA = totalCustos * group.cost_split_ratio;
      const custosB = totalCustos * (1 - group.cost_split_ratio);

      return {
        group,
        partnerAId: user.id,
        partnerBId,
        partnerAName,
        partnerBName,
        dataA,
        dataB,
        consolidated: {
          totalVendas: dataA.totalVendas + dataB.totalVendas,
          totalCustos,
          totalTaxas: dataA.totalTaxas + dataB.totalTaxas,
          totalDescontos: dataA.totalDescontos + dataB.totalDescontos,
          lucroTotal: dataA.lucroTotal + dataB.lucroTotal,
        },
        acerto: {
          lucroTotalA,
          lucroTotalB,
          custosA,
          custosB,
          totalA: lucroTotalA + custosA,
          totalB: lucroTotalB + custosB,
          costSplitRatio: group.cost_split_ratio,
        },
        profitShareSeller: group.profit_share_seller,
        profitSharePartner: group.profit_share_partner,
      };
    }).filter(Boolean);
  }, [user, directPartnerships, salesData, splitsBySaleId, productCostMap, feesMap, userGroupMemberships, profileMap, currentUserName, detectKindBySplits, selectedGroupId]);

  const renderPartnershipCards = () => {
    if (partnershipDetailedData.length === 0) {
      return (
        <Card className="mb-6">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma sociedade encontrada ou sem vendas no período.
          </CardContent>
        </Card>
      );
    }

    return partnershipDetailedData.map((data: any) => {
      const sellerPct = Math.round(data.profitShareSeller * 100);
      const partnerPct = Math.round(data.profitSharePartner * 100);
      const costPctA = Math.round(data.acerto.costSplitRatio * 100);
      const costPctB = 100 - costPctA;

      return (
        <div key={data.group.id} className="space-y-4 mb-6">
          {partnershipDetailedData.length > 1 && (
            <h3 className="text-lg font-semibold text-foreground">{data.group.name}</h3>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Totais */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase text-primary">
                  Totais de Vendas em Sociedade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de Vendas</span>
                  <span className="font-semibold">{formatCurrency(data.consolidated.totalVendas)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custos Totais</span>
                  <span className="font-medium text-destructive">{formatCurrency(data.consolidated.totalCustos)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxas Totais</span>
                  <span className="font-medium text-destructive">{formatCurrency(data.consolidated.totalTaxas)}</span>
                </div>
                {data.consolidated.totalDescontos > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Descontos</span>
                    <span className="font-medium text-destructive">{formatCurrency(data.consolidated.totalDescontos)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Lucro Total</span>
                  <span className="font-bold text-primary">{formatCurrency(data.consolidated.lucroTotal)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Vendas Sócia A */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase">
                  Vendas {data.partnerAName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de Vendas</span>
                  <span className="font-semibold">{formatCurrency(data.dataA.totalVendas)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custos Produtos</span>
                  <span className="font-medium">{formatCurrency(data.dataA.totalCustos)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxas Totais</span>
                  <span className="font-medium">{formatCurrency(data.dataA.totalTaxas)}</span>
                </div>
                {data.dataA.totalDescontos > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Descontos</span>
                    <span className="font-medium">{formatCurrency(data.dataA.totalDescontos)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Lucro Total</span>
                  <span className="font-bold">{formatCurrency(data.dataA.lucroTotal)}</span>
                </div>
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-muted-foreground">Lucro {data.partnerAName} ({sellerPct}%)</span>
                  <span className="font-semibold text-primary">{formatCurrency(data.dataA.sellerProfitShare)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lucro {data.partnerBName} ({partnerPct}%)</span>
                  <span className="font-medium">{formatCurrency(data.dataA.partnerProfitShare)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Vendas Sócia B */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase">
                  Vendas {data.partnerBName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de Vendas</span>
                  <span className="font-semibold">{formatCurrency(data.dataB.totalVendas)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custos Produtos</span>
                  <span className="font-medium">{formatCurrency(data.dataB.totalCustos)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxas Totais</span>
                  <span className="font-medium">{formatCurrency(data.dataB.totalTaxas)}</span>
                </div>
                {data.dataB.totalDescontos > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Descontos</span>
                    <span className="font-medium">{formatCurrency(data.dataB.totalDescontos)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Lucro Total</span>
                  <span className="font-bold">{formatCurrency(data.dataB.lucroTotal)}</span>
                </div>
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-muted-foreground">Lucro {data.partnerBName} ({sellerPct}%)</span>
                  <span className="font-semibold text-primary">{formatCurrency(data.dataB.sellerProfitShare)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lucro {data.partnerAName} ({partnerPct}%)</span>
                  <span className="font-medium">{formatCurrency(data.dataB.partnerProfitShare)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Acerto de Contas */}
            <Card className="border-green-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase text-green-700 dark:text-green-400">
                  Acerto de Contas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lucro Total {data.partnerAName}</span>
                  <span className="font-medium">{formatCurrency(data.acerto.lucroTotalA)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lucro Total {data.partnerBName}</span>
                  <span className="font-medium">{formatCurrency(data.acerto.lucroTotalB)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custos {costPctA}% {data.partnerAName}</span>
                  <span className="font-medium">{formatCurrency(data.acerto.custosA)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custos {costPctB}% {data.partnerBName}</span>
                  <span className="font-medium">{formatCurrency(data.acerto.custosB)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-primary">{data.partnerAName}</span>
                  <span className="text-primary">{formatCurrency(data.acerto.totalA)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>{data.partnerBName}</span>
                  <span>{formatCurrency(data.acerto.totalB)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    });
  };

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

  const saleSourceLabel = (source: string, eventName?: string | null) => {
    const map: Record<string, string> = {
      manual: "Venda Direta",
      catalog: "Minha Loja",
      partner_point: "Ponto Parceiro",
      b2b: "B2B",
      event: eventName ? `Evento: ${eventName}` : "Evento",
      instagram: "Instagram",
      consignment: "Consignação",
      consortium: "Consórcio",
      bazar: "Bazar VIP",
    };
    return map[source] || source;
  };

  const splitTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      cost_recovery: "Recuperação de Custo",
      profit_share: "Participação no Lucro",
      group_commission: "Comissão",
      payment_fee: "Taxa de Pagamento",
    };
    return map[type] || type;
  };

  const splitTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    if (type === "profit_share") return "default";
    if (type === "cost_recovery") return "secondary";
    if (type === "group_commission") return "outline";
    return "destructive";
  };

  const renderSaleCard = (sale: SaleWithItems) => {
    const splits = splitsBySaleId.get(sale.id) ?? [];
    const sellerProfile = profileMap.get(sale.owner_id);
    const sellerName = sellerProfile?.full_name ?? "Vendedora";
    const isExpanded = expandedSales.has(sale.id);
    const isDeferred = unpaidDeferredSaleIds.has(sale.id);

    // Group splits by user
    const splitsByUser = new Map<string, FinancialSplit[]>();
    for (const s of splits) {
      const arr = splitsByUser.get(s.user_id) ?? [];
      arr.push(s);
      splitsByUser.set(s.user_id, arr);
    }

    return (
      <Collapsible key={sale.id} open={isExpanded} onOpenChange={() => toggleSaleExpanded(sale.id)}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <ShoppingBag className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm")}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {saleSourceLabel(sale.sale_source, sale.event_name)}
                  </Badge>
                  {isDeferred && (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
                      A prazo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {sale.customer_name ? `Cliente: ${sale.customer_name} • ` : ""}
                  {sale.payment_method}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-semibold text-sm">{formatCurrency(sale.total)}</span>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 rounded-b-lg p-4 space-y-4 bg-muted/20">
            {/* Items */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Itens da Venda</h4>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs text-right">Qtd</TableHead>
                    <TableHead className="text-xs text-right">Unitário</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.sale_items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-transparent">
                      <TableCell className="text-sm py-1.5">{item.product_name}</TableCell>
                      <TableCell className="text-sm text-right py-1.5">{item.quantity}</TableCell>
                      <TableCell className="text-sm text-right py-1.5">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-sm text-right py-1.5">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(sale.discount_amount && sale.discount_amount > 0) ? (
                <p className="text-xs text-muted-foreground mt-1">Desconto: -{formatCurrency(sale.discount_amount)}</p>
              ) : null}
              {(sale.shipping_cost && sale.shipping_cost > 0) ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Frete: {formatCurrency(sale.shipping_cost)} ({sale.shipping_payer === "seller" ? "pago pela vendedora" : "pago pelo comprador"})
                </p>
              ) : null}
            </div>

            {/* Financial Splits */}
            {splits.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Divisão de Lucros</h4>
                <div className="space-y-2">
                  {Array.from(splitsByUser.entries()).map(([userId, userSplits]) => {
                    const profile = profileMap.get(userId);
                    const personName = userId === user!.id ? `${currentUserName} (Você)` : (profile?.full_name ?? "Parceiro");
                    const personTotal = userSplits.reduce((sum, s) => sum + s.amount, 0);
                    const isCurrentUser = userId === user!.id;

                    return (
                      <div key={userId} className={`p-3 rounded-md border ${isCurrentUser ? "bg-primary/5 border-primary/20" : "bg-card"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{personName}</span>
                          <span className={`text-sm font-bold ${isCurrentUser ? "text-primary" : "text-foreground"}`}>
                            {formatCurrency(personTotal)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {userSplits.map((split) => (
                            <Badge key={split.id} variant={splitTypeBadgeVariant(split.type)} className="text-xs font-normal gap-1">
                              {splitTypeLabel(split.type)}: {formatCurrency(split.amount)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderDetailedSales = (kind: ReportKind) => {
    if (!user) return null;

    const relevantSales = salesData.filter((sale) => {
      const saleKind = detectKindBySplits(sale.id);
      if (kind === "all") return saleKind !== "own";
      return saleKind === kind;
    });

    if (relevantSales.length === 0) {
      return (
        <Card className="mt-6">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma venda com divisão de lucros no período selecionado.
          </CardContent>
        </Card>
      );
    }

    // Group sales by seller (owner_id)
    const salesByOwner = new Map<string, SaleWithItems[]>();
    for (const sale of relevantSales) {
      const arr = salesByOwner.get(sale.owner_id) ?? [];
      arr.push(sale);
      salesByOwner.set(sale.owner_id, arr);
    }

    // Sort owners: current user first, then alphabetically
    const ownerIds = Array.from(salesByOwner.keys()).sort((a, b) => {
      if (a === user.id) return -1;
      if (b === user.id) return 1;
      const nameA = profileMap.get(a)?.full_name ?? "";
      const nameB = profileMap.get(b)?.full_name ?? "";
      return nameA.localeCompare(nameB);
    });

    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Receipt className="h-5 w-5 text-primary" />
          Detalhamento de Vendas ({relevantSales.length})
        </h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {ownerIds.map((ownerId) => {
            const ownerSales = salesByOwner.get(ownerId) ?? [];
            const ownerProfile = profileMap.get(ownerId);
            const ownerName = ownerId === user.id ? `${currentUserName} (Você)` : (ownerProfile?.full_name ?? "Vendedora");
            const ownerTotal = ownerSales.reduce((sum, s) => sum + s.total, 0);

            return (
              <Card key={ownerId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      Vendas de {ownerName}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {ownerSales.length} {ownerSales.length === 1 ? "venda" : "vendas"} • {formatCurrency(ownerTotal)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-3 sm:p-6 pt-0 sm:pt-0">
                  {ownerSales.map((sale) => renderSaleCard(sale))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

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
          {renderDetailedSales("all")}
        </TabsContent>

        <TabsContent value="partnerships">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Acerto entre Sócias (1-1)
          </h2>
          {renderPartnershipCards()}
          <Separator className="my-6" />
          {renderTables(partnershipSummaries, true)}
          {renderDetailedSales("partnerships")}
        </TabsContent>

        <TabsContent value="groups">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Acerto entre Parceiras
          </h2>
          {renderSummaryCards(groupTotals, false)}
          <Separator className="my-6" />
          {renderTables(groupSummaries, false)}
          {renderDetailedSales("groups")}
        </TabsContent>
      </Tabs>

      {/* Period Info */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Período: {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
      </div>
    </MainLayout>
  );
}
