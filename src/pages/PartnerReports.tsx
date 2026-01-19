import { useState, useMemo } from "react";
import { Users, TrendingUp, DollarSign, Calendar, Filter, X, Share2, Wallet, Building2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";
interface FinancialSplit {
  id: string;
  sale_id: string;
  user_id: string;
  amount: number;
  type: 'cost_recovery' | 'profit_share' | 'group_commission';
  description: string;
  created_at: string;
}
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
interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number | null;
  owner_id: string;
  group_id: string | null;
}
interface ProductPartnership {
  id: string;
  product_id: string;
  group_id: string;
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
interface PartnerSummary {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  sellerEarnings: number;
  partnerEarnings: number;
  salesCount: number;
}
interface SplitSummary {
  ownSalesProfit: number;
  commissionsReceived: number;
  partnershipParticipation: number;
  total: number;
}
const periodOptions = [{
  value: "today",
  label: "Hoje"
}, {
  value: "week",
  label: "Esta Semana"
}, {
  value: "month",
  label: "Este Mês"
}, {
  value: "year",
  label: "Este Ano"
}, {
  value: "all",
  label: "Todo Período"
}];
export default function PartnerReports() {
  const {
    user
  } = useAuth();
  const [period, setPeriod] = useState("month");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("all");

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today":
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case "week":
        return {
          start: startOfWeek(now, {
            weekStartsOn: 0
          }),
          end: endOfWeek(now, {
            weekStartsOn: 0
          })
        };
      case "month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case "year":
        return {
          start: startOfYear(now),
          end: endOfYear(now)
        };
      default:
        return {
          start: new Date(2020, 0, 1),
          end: now
        };
    }
  }, [period]);

  // Fetch user's groups
  const {
    data: userGroupMemberships = []
  } = useQuery({
    queryKey: ["user-group-memberships"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("group_members").select("group_id, user_id");
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!user
  });

  // Fetch groups with full configuration
  const {
    data: groups = []
  } = useQuery({
    queryKey: ["groups-with-config"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("groups").select("id, name, commission_percent, cost_split_ratio, profit_share_seller, profit_share_partner, is_direct");
      if (error) throw error;
      return data as GroupWithConfig[];
    },
    enabled: !!user
  });

  // Fetch financial splits
  const {
    data: financialSplits = [],
    isLoading: splitsLoading
  } = useQuery({
    queryKey: ["financial-splits", user?.id, dateRange.start, dateRange.end],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("financial_splits").select("*").eq("user_id", user?.id).gte("created_at", dateRange.start.toISOString()).lte("created_at", dateRange.end.toISOString()).order("created_at", {
        ascending: false
      });
      if (error) throw error;
      return data as FinancialSplit[];
    },
    enabled: !!user
  });

  // Fetch all sales with items
  const {
    data: salesData = [],
    isLoading: salesLoading
  } = useQuery({
    queryKey: ["partner-sales", dateRange.start, dateRange.end],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("sales").select(`
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
        `).eq("status", "completed").gte("created_at", dateRange.start.toISOString()).lte("created_at", dateRange.end.toISOString()).order("created_at", {
        ascending: false
      });
      if (error) throw error;
      return data as SaleWithItems[];
    },
    enabled: !!user
  });

  // Fetch products (to get cost_price and owner info)
  const {
    data: products = []
  } = useQuery({
    queryKey: ["products-for-partner-report"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("products").select("id, name, price, cost_price, owner_id, group_id");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user
  });

  // Fetch product partnerships
  const {
    data: productPartnerships = []
  } = useQuery({
    queryKey: ["product-partnerships-report"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("product_partnerships").select("*");
      if (error) throw error;
      return data as ProductPartnership[];
    },
    enabled: !!user
  });

  // Note: partnership_rules table is deprecated, using groups table for configuration

  // Fetch profiles
  const {
    data: profiles = []
  } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("profiles").select("id, full_name, email, phone");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!user
  });

  // Get user's groups
  const userGroups = useMemo(() => {
    const userGroupIds = userGroupMemberships.filter(m => m.user_id === user?.id).map(m => m.group_id);
    return groups.filter(g => userGroupIds.includes(g.id));
  }, [userGroupMemberships, groups, user]);

  // Get partners in user's groups
  const partners = useMemo(() => {
    if (!user) return [];
    let relevantGroupIds = userGroups.map(g => g.id);
    if (selectedGroupId !== "all") {
      relevantGroupIds = [selectedGroupId];
    }
    const partnerIds = new Set<string>();
    userGroupMemberships.filter(m => relevantGroupIds.includes(m.group_id) && m.user_id !== user.id).forEach(m => partnerIds.add(m.user_id));
    return profiles.filter(p => partnerIds.has(p.id));
  }, [userGroupMemberships, userGroups, profiles, user, selectedGroupId]);

  // Calculate split summary by type from financial_splits table
  const splitSummary = useMemo<SplitSummary>(() => {
    const summary: SplitSummary = {
      ownSalesProfit: 0,
      commissionsReceived: 0,
      partnershipParticipation: 0,
      total: 0
    };
    for (const split of financialSplits) {
      switch (split.type) {
        case 'profit_share':
          // Check if it's from own sale or partnership
          if (split.description.includes('Lucro da venda')) {
            summary.ownSalesProfit += split.amount;
          } else {
            summary.partnershipParticipation += split.amount;
          }
          break;
        case 'group_commission':
          summary.commissionsReceived += split.amount;
          break;
        case 'cost_recovery':
          // Cost recovery is included in ownSalesProfit for simplicity
          summary.ownSalesProfit += split.amount;
          break;
      }
    }
    summary.total = summary.ownSalesProfit + summary.commissionsReceived + summary.partnershipParticipation;
    return summary;
  }, [financialSplits]);

  // Helper to get group config (aligned with profitEngine)
  const getGroupConfig = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    return {
      id: groupId,
      costSplitRatio: group?.cost_split_ratio ?? 0.5,
      profitShareSeller: group?.profit_share_seller ?? 0.7,
      profitSharePartner: group?.profit_share_partner ?? 0.3,
      commissionPercent: group?.commission_percent ?? 0.2,
      isDirect: group?.is_direct ?? false
    };
  };

  // Helper to get product's group from product_partnerships
  const getProductGroup = (productId: string): string | null => {
    const partnership = productPartnerships.find(pp => pp.product_id === productId);
    return partnership?.group_id || null;
  };

  // Calculate partner earnings using profitEngine logic
  // Cenário A: Parceria direta 1-1 (split de custo + lucro)
  // Cenário B: Grupo (dono recebe custo + comissão)
  const partnerSummaries = useMemo(() => {
    if (!user) return [];
    const productMap = new Map(products.map(p => [p.id, p]));
    const summaries = new Map<string, PartnerSummary>();
    let relevantGroupIds = userGroups.map(g => g.id);
    if (selectedGroupId !== "all") {
      relevantGroupIds = [selectedGroupId];
    }
    const userSales = salesData.filter(s => s.owner_id === user.id);
    for (const sale of userSales) {
      for (const item of sale.sale_items || []) {
        const product = productMap.get(item.product_id);
        if (!product) continue;
        if (product.owner_id === user.id) continue;
        const productGroupId = getProductGroup(product.id) || product.group_id;
        if (!productGroupId || !relevantGroupIds.includes(productGroupId)) continue;
        if (selectedPartnerId !== "all" && product.owner_id !== selectedPartnerId) continue;
        const partner = profiles.find(p => p.id === product.owner_id);
        if (!partner) continue;
        const config = getGroupConfig(productGroupId);
        const costPrice = product.cost_price || 0;
        const salePrice = item.unit_price;
        const quantity = item.quantity;
        const totalCost = costPrice * quantity;
        const totalSale = salePrice * quantity;
        const profit = Math.max(0, totalSale - totalCost);
        let sellerEarnings = 0;
        let partnerEarnings = 0;
        if (config.isDirect) {
          // Cenário A: Parceria direta 1-1
          // Vendedor: custo * costSplitRatio + lucro * profitShareSeller
          // Parceira: custo * (1-costSplitRatio) + lucro * profitSharePartner
          sellerEarnings = totalCost * config.costSplitRatio + profit * config.profitShareSeller;
          partnerEarnings = totalCost * (1 - config.costSplitRatio) + profit * config.profitSharePartner;
        } else {
          // Cenário B: Grupo
          // Dono recebe: custo + (lucro * comissão)
          // Vendedor recebe: lucro - (lucro * comissão)
          const ownerCommission = profit * config.commissionPercent;
          partnerEarnings = totalCost + ownerCommission;
          sellerEarnings = profit - ownerCommission;
        }
        if (!summaries.has(partner.id)) {
          summaries.set(partner.id, {
            partnerId: partner.id,
            partnerName: partner.full_name,
            partnerEmail: partner.email,
            totalSales: 0,
            totalCost: 0,
            totalProfit: 0,
            sellerEarnings: 0,
            partnerEarnings: 0,
            salesCount: 0
          });
        }
        const summary = summaries.get(partner.id)!;
        summary.totalSales += totalSale;
        summary.totalCost += totalCost;
        summary.totalProfit += profit;
        summary.sellerEarnings += sellerEarnings;
        summary.partnerEarnings += partnerEarnings;
        summary.salesCount += 1;
      }
    }
    return Array.from(summaries.values()).sort((a, b) => b.totalSales - a.totalSales);
  }, [salesData, products, profiles, user, userGroups, selectedGroupId, selectedPartnerId, productPartnerships, groups]);

  // Calculate earnings from products sold by partners using profitEngine logic
  const earningsFromPartners = useMemo(() => {
    if (!user) return [];
    const productMap = new Map(products.map(p => [p.id, p]));
    const summaries = new Map<string, PartnerSummary>();
    let relevantGroupIds = userGroups.map(g => g.id);
    if (selectedGroupId !== "all") {
      relevantGroupIds = [selectedGroupId];
    }
    const partnerSales = salesData.filter(s => s.owner_id !== user.id);
    for (const sale of partnerSales) {
      const seller = profiles.find(p => p.id === sale.owner_id);
      if (!seller) continue;
      if (selectedPartnerId !== "all" && sale.owner_id !== selectedPartnerId) continue;
      for (const item of sale.sale_items || []) {
        const product = productMap.get(item.product_id);
        if (!product) continue;
        if (product.owner_id !== user.id) continue;
        const productGroupId = getProductGroup(product.id) || product.group_id;
        if (!productGroupId || !relevantGroupIds.includes(productGroupId)) continue;
        const config = getGroupConfig(productGroupId);
        const costPrice = product.cost_price || 0;
        const salePrice = item.unit_price;
        const quantity = item.quantity;
        const totalCost = costPrice * quantity;
        const totalSale = salePrice * quantity;
        const profit = Math.max(0, totalSale - totalCost);
        let myEarnings = 0;
        let sellerEarnings = 0;
        if (config.isDirect) {
          // Cenário A: Parceria direta 1-1
          // Eu (dono): custo * (1-costSplitRatio) + lucro * profitSharePartner
          // Vendedor: custo * costSplitRatio + lucro * profitShareSeller
          myEarnings = totalCost * (1 - config.costSplitRatio) + profit * config.profitSharePartner;
          sellerEarnings = totalCost * config.costSplitRatio + profit * config.profitShareSeller;
        } else {
          // Cenário B: Grupo
          // Eu (dono): custo + (lucro * comissão)
          // Vendedor: lucro - (lucro * comissão)
          const ownerCommission = profit * config.commissionPercent;
          myEarnings = totalCost + ownerCommission;
          sellerEarnings = profit - ownerCommission;
        }
        if (!summaries.has(seller.id)) {
          summaries.set(seller.id, {
            partnerId: seller.id,
            partnerName: seller.full_name,
            partnerEmail: seller.email,
            totalSales: 0,
            totalCost: 0,
            totalProfit: 0,
            sellerEarnings: 0,
            partnerEarnings: 0,
            salesCount: 0
          });
        }
        const summary = summaries.get(seller.id)!;
        summary.totalSales += totalSale;
        summary.totalCost += totalCost;
        summary.totalProfit += profit;
        summary.partnerEarnings += myEarnings;
        summary.sellerEarnings += sellerEarnings;
        summary.salesCount += 1;
      }
    }
    return Array.from(summaries.values()).sort((a, b) => b.totalSales - a.totalSales);
  }, [salesData, products, profiles, user, userGroups, selectedGroupId, selectedPartnerId, groups, productPartnerships]);

  // Totals
  const totals = useMemo(() => {
    const mySellerEarnings = partnerSummaries.reduce((sum, s) => sum + s.sellerEarnings, 0);
    const iOwePartners = partnerSummaries.reduce((sum, s) => sum + s.partnerEarnings, 0);
    const myOwnerEarnings = earningsFromPartners.reduce((sum, s) => sum + s.partnerEarnings, 0);
    const partnersOweMe = myOwnerEarnings;
    return {
      mySellerEarnings,
      iOwePartners,
      myOwnerEarnings,
      partnersOweMe,
      netBalance: partnersOweMe - iOwePartners
    };
  }, [partnerSummaries, earningsFromPartners]);
  const clearFilters = () => {
    setPeriod("month");
    setSelectedGroupId("all");
    setSelectedPartnerId("all");
  };
  const activeFiltersCount = [period !== "month", selectedGroupId !== "all", selectedPartnerId !== "all"].filter(Boolean).length;
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

  // Generate WhatsApp settlement text
  const generateSettlementText = () => {
    const currentUser = profiles.find(p => p.id === user?.id);
    const periodLabel = periodOptions.find(p => p.value === period)?.label || period;
    let text = `📊 *ACERTO DE CONTAS - ${periodLabel.toUpperCase()}*\n`;
    text += `📅 ${format(dateRange.start, "dd/MM/yyyy")} a ${format(dateRange.end, "dd/MM/yyyy")}\n\n`;
    text += `👤 *${currentUser?.full_name || 'Você'}*\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📈 *RESUMO POR TIPO*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `💰 Lucro Vendas Próprias: ${formatCurrency(splitSummary.ownSalesProfit)}\n`;
    text += `🏢 Comissões Recebidas: ${formatCurrency(splitSummary.commissionsReceived)}\n`;
    text += `👥 Participação Parcerias: ${formatCurrency(splitSummary.partnershipParticipation)}\n`;
    text += `\n✨ *TOTAL GANHOS: ${formatCurrency(splitSummary.total)}*\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💸 *VALORES A ACERTAR*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (partnerSummaries.length > 0) {
      text += `📤 *Devo às Parceiras:*\n`;
      partnerSummaries.forEach(s => {
        text += `  • ${s.partnerName}: ${formatCurrency(s.partnerEarnings)}\n`;
      });
      text += `  *Subtotal: ${formatCurrency(totals.iOwePartners)}*\n\n`;
    }
    if (earningsFromPartners.length > 0) {
      text += `📥 *A Receber das Parceiras:*\n`;
      earningsFromPartners.forEach(s => {
        text += `  • ${s.partnerName}: ${formatCurrency(s.partnerEarnings)}\n`;
      });
      text += `  *Subtotal: ${formatCurrency(totals.partnersOweMe)}*\n\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    const balanceEmoji = totals.netBalance >= 0 ? '✅' : '🔴';
    const balanceLabel = totals.netBalance >= 0 ? 'A RECEBER' : 'A PAGAR';
    text += `${balanceEmoji} *SALDO FINAL (${balanceLabel}): ${formatCurrency(Math.abs(totals.netBalance))}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `_Gerado por VendaProfit_`;
    return text;
  };
  const handleExportSettlement = () => {
    const text = generateSettlementText();
    const encodedText = encodeURIComponent(text);

    // Open WhatsApp with the text
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');

    // Also copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Texto copiado!",
        description: "O acerto de contas foi copiado para a área de transferência e o WhatsApp foi aberto."
      });
    }).catch(() => {
      toast({
        title: "WhatsApp aberto",
        description: "Selecione a sócia para enviar o acerto de contas."
      });
    });
  };
  return <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatório de Parcerias</h1>
          <p className="text-muted-foreground">Acompanhe os ganhos e divisões com suas parcerias</p>
        </div>
        <Button onClick={handleExportSettlement} className="gap-2">
          <Share2 className="h-4 w-4" />
          Exportar Acerto de Contas
        </Button>
      </div>

      {/* Info Card */}
      <Card className="mb-6 bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Regra de Divisão de Lucros</p>
              <p className="text-muted-foreground">
                <strong>Quem vende:</strong> 50% do custo + 70% do lucro | 
                <strong> Parceira:</strong> 50% do custo + 30% do lucro
              </p>
            </div>
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
            {periodOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Parceria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Parcerias</SelectItem>
            {userGroups.map(group => <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Parceira" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Parceiras</SelectItem>
            {partners.map(partner => <SelectItem key={partner.id} value={partner.id}>
                {partner.full_name}
              </SelectItem>)}
          </SelectContent>
        </Select>

        {activeFiltersCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar ({activeFiltersCount})
          </Button>}
      </div>

      {/* Summary by Type Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-600" />
              Lucro de Vendas Próprias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(splitSummary.ownSalesProfit)}
            </p>
            <p className="text-xs text-muted-foreground">
              Vendas do seu estoque
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-600" />
              Comissões Recebidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(splitSummary.commissionsReceived)}
            </p>
            <p className="text-xs text-muted-foreground">
              Estoque cedido a grupos
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Participação em Parcerias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(splitSummary.partnershipParticipation)}
            </p>
            <p className="text-xs text-muted-foreground">
              Vendas em parceria com sócia
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Total de Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(splitSummary.total)}
            </p>
            <p className="text-xs text-muted-foreground">
              Soma de todas as fontes
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      {/* Balance Cards */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="h-5 w-5" />
        Acerto entre Parceiras
      </h2>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Meus Ganhos (Vendas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totals.mySellerEarnings)}
            </p>
            <p className="text-xs text-muted-foreground">
              Vendas de peças de parceiras
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Devo às Parceiras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(totals.iOwePartners)}
            </p>
            <p className="text-xs text-muted-foreground">
              Parte das parceiras nas minhas vendas
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
              Peças minhas vendidas por parceiras
            </p>
          </CardContent>
        </Card>

        <Card className={totals.netBalance >= 0 ? "border-green-500/50" : "border-destructive/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo
            </CardTitle>
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

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Sales of Partner Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Minhas Vendas (Peças de Parceiras)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Parceira</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Meu Ganho</TableHead>
                  <TableHead className="text-right">Devo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesLoading ? <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow> : partnerSummaries.length === 0 ? <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhuma venda de peças de parceiras no período
                    </TableCell>
                  </TableRow> : partnerSummaries.map(summary => <TableRow key={summary.partnerId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{summary.partnerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {summary.salesCount} {summary.salesCount === 1 ? "item" : "itens"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(summary.totalSales)}
                      </TableCell>
                      <TableCell className="text-right text-primary font-medium">
                        {formatCurrency(summary.sellerEarnings)}
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">
                        {formatCurrency(summary.partnerEarnings)}
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Partner Sales of My Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Vendas de Parceiras (Minhas Peças)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Parceira</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Meu Ganho</TableHead>
                  <TableHead className="text-right">Ganho Dela</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesLoading ? <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow> : earningsFromPartners.length === 0 ? <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhuma venda de suas peças por parceiras no período
                    </TableCell>
                  </TableRow> : earningsFromPartners.map(summary => <TableRow key={summary.partnerId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{summary.partnerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {summary.salesCount} {summary.salesCount === 1 ? "item" : "itens"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(summary.totalSales)}
                      </TableCell>
                      <TableCell className="text-right text-primary font-medium">
                        {formatCurrency(summary.partnerEarnings)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(summary.sellerEarnings)}
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Period Info */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Período: {format(dateRange.start, "dd/MM/yyyy", {
        locale: ptBR
      })} - {format(dateRange.end, "dd/MM/yyyy", {
        locale: ptBR
      })}
      </div>
    </MainLayout>;
}