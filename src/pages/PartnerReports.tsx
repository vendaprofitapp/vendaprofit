import { useState, useMemo } from "react";
import { Users, TrendingUp, DollarSign, Calendar, Filter, X, Share2, Wallet, Building2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
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
  groupId: string;
  groupName: string;
  isDirect: boolean;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  sellerEarnings: number;
  partnerEarnings: number;
  salesCount: number;
}

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "year", label: "Este Ano" },
  { value: "all", label: "Todo Período" }
];

export default function PartnerReports() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("month");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("partnerships");

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

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-partner-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, owner_id, group_id");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user
  });

  // Fetch product partnerships
  const { data: productPartnerships = [] } = useQuery({
    queryKey: ["product-partnerships-report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_partnerships").select("*");
      if (error) throw error;
      return data as ProductPartnership[];
    },
    enabled: !!user
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

  // Helper to get group config
  const getGroupConfig = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    return {
      id: groupId,
      name: group?.name ?? "Grupo",
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

  // Calculate partner summaries - separated by type
  const calculateSummaries = (isDirect: boolean) => {
    if (!user) return { mySales: [], partnerSales: [] };
    const productMap = new Map(products.map(p => [p.id, p]));
    const mySalesMap = new Map<string, PartnerSummary>();
    const partnerSalesMap = new Map<string, PartnerSummary>();
    
    const relevantGroups = isDirect ? directPartnerships : regularGroups;
    let relevantGroupIds = relevantGroups.map(g => g.id);
    if (selectedGroupId !== "all") {
      relevantGroupIds = [selectedGroupId];
    }

    // My sales of partner products
    const userSales = salesData.filter(s => s.owner_id === user.id);
    for (const sale of userSales) {
      for (const item of sale.sale_items || []) {
        const product = productMap.get(item.product_id);
        if (!product) continue;
        if (product.owner_id === user.id) continue;

        const productGroupId = getProductGroup(product.id) || product.group_id;
        if (!productGroupId || !relevantGroupIds.includes(productGroupId)) continue;

        const groupConfig = getGroupConfig(productGroupId);
        if (groupConfig.isDirect !== isDirect) continue;

        if (selectedPartnerId !== "all" && product.owner_id !== selectedPartnerId) continue;

        const partner = profiles.find(p => p.id === product.owner_id);
        if (!partner) continue;

        const costPrice = product.cost_price || 0;
        const salePrice = item.unit_price;
        const quantity = item.quantity;
        const totalCost = costPrice * quantity;
        const totalSale = salePrice * quantity;
        const profit = Math.max(0, totalSale - totalCost);

        let sellerEarnings = 0;
        let partnerEarnings = 0;

        if (isDirect) {
          // Parceria 1-1: custo + lucro divididos
          sellerEarnings = totalCost * groupConfig.costSplitRatio + profit * groupConfig.profitShareSeller;
          partnerEarnings = totalCost * (1 - groupConfig.costSplitRatio) + profit * groupConfig.profitSharePartner;
        } else {
          // Grupo: dono recebe custo + comissão
          const ownerCommission = profit * groupConfig.commissionPercent;
          partnerEarnings = totalCost + ownerCommission;
          sellerEarnings = profit - ownerCommission;
        }

        const key = `${partner.id}-${productGroupId}`;
        if (!mySalesMap.has(key)) {
          mySalesMap.set(key, {
            partnerId: partner.id,
            partnerName: partner.full_name,
            partnerEmail: partner.email,
            groupId: productGroupId,
            groupName: groupConfig.name,
            isDirect,
            totalSales: 0,
            totalCost: 0,
            totalProfit: 0,
            sellerEarnings: 0,
            partnerEarnings: 0,
            salesCount: 0
          });
        }
        const summary = mySalesMap.get(key)!;
        summary.totalSales += totalSale;
        summary.totalCost += totalCost;
        summary.totalProfit += profit;
        summary.sellerEarnings += sellerEarnings;
        summary.partnerEarnings += partnerEarnings;
        summary.salesCount += 1;
      }
    }

    // Partner sales of my products
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

        const groupConfig = getGroupConfig(productGroupId);
        if (groupConfig.isDirect !== isDirect) continue;

        const costPrice = product.cost_price || 0;
        const salePrice = item.unit_price;
        const quantity = item.quantity;
        const totalCost = costPrice * quantity;
        const totalSale = salePrice * quantity;
        const profit = Math.max(0, totalSale - totalCost);

        let myEarnings = 0;
        let sellerEarnings = 0;

        if (isDirect) {
          // Parceria 1-1
          myEarnings = totalCost * (1 - groupConfig.costSplitRatio) + profit * groupConfig.profitSharePartner;
          sellerEarnings = totalCost * groupConfig.costSplitRatio + profit * groupConfig.profitShareSeller;
        } else {
          // Grupo
          const ownerCommission = profit * groupConfig.commissionPercent;
          myEarnings = totalCost + ownerCommission;
          sellerEarnings = profit - ownerCommission;
        }

        const key = `${seller.id}-${productGroupId}`;
        if (!partnerSalesMap.has(key)) {
          partnerSalesMap.set(key, {
            partnerId: seller.id,
            partnerName: seller.full_name,
            partnerEmail: seller.email,
            groupId: productGroupId,
            groupName: groupConfig.name,
            isDirect,
            totalSales: 0,
            totalCost: 0,
            totalProfit: 0,
            sellerEarnings: 0,
            partnerEarnings: 0,
            salesCount: 0
          });
        }
        const summary = partnerSalesMap.get(key)!;
        summary.totalSales += totalSale;
        summary.totalCost += totalCost;
        summary.totalProfit += profit;
        summary.partnerEarnings += myEarnings;
        summary.sellerEarnings += sellerEarnings;
        summary.salesCount += 1;
      }
    }

    return {
      mySales: Array.from(mySalesMap.values()).sort((a, b) => b.totalSales - a.totalSales),
      partnerSales: Array.from(partnerSalesMap.values()).sort((a, b) => b.totalSales - a.totalSales)
    };
  };

  const partnershipSummaries = useMemo(() => calculateSummaries(true), [
    salesData, products, profiles, user, directPartnerships, selectedGroupId, selectedPartnerId, productPartnerships, groups
  ]);

  const groupSummaries = useMemo(() => calculateSummaries(false), [
    salesData, products, profiles, user, regularGroups, selectedGroupId, selectedPartnerId, productPartnerships, groups
  ]);

  // Calculate totals for each type
  const calculateTotals = (mySales: PartnerSummary[], partnerSales: PartnerSummary[]) => {
    const mySellerEarnings = mySales.reduce((sum, s) => sum + s.sellerEarnings, 0);
    const iOwePartners = mySales.reduce((sum, s) => sum + s.partnerEarnings, 0);
    const myOwnerEarnings = partnerSales.reduce((sum, s) => sum + s.partnerEarnings, 0);
    return {
      mySellerEarnings,
      iOwePartners,
      myOwnerEarnings,
      partnersOweMe: myOwnerEarnings,
      netBalance: myOwnerEarnings - iOwePartners
    };
  };

  const partnershipTotals = useMemo(
    () => calculateTotals(partnershipSummaries.mySales, partnershipSummaries.partnerSales),
    [partnershipSummaries]
  );

  const groupTotals = useMemo(
    () => calculateTotals(groupSummaries.mySales, groupSummaries.partnerSales),
    [groupSummaries]
  );

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
    const typeLabel = isPartnership ? "PARCERIAS 1-1" : "GRUPOS";

    let text = `📊 *ACERTO DE CONTAS - ${typeLabel}*\n`;
    text += `📅 ${periodLabel.toUpperCase()}: ${format(dateRange.start, "dd/MM/yyyy")} a ${format(dateRange.end, "dd/MM/yyyy")}\n\n`;
    text += `👤 *${currentUser?.full_name || 'Você'}*\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (summaries.mySales.length > 0) {
      text += `📤 *${isPartnership ? 'Devo às Parceiras' : 'Devo aos Donos'}:*\n`;
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

  const renderSummaryCards = (totals: ReturnType<typeof calculateTotals>, isPartnership: boolean) => (
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
            {isPartnership ? "Vendas de peças de parceiras" : "Vendas de peças de membros"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {isPartnership ? "Devo às Parceiras" : "Devo aos Donos"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-destructive">
            {formatCurrency(totals.iOwePartners)}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPartnership ? "Parte das parceiras" : "Custo + comissão dos donos"}
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
            {isPartnership ? "Vendidas por parceiras" : "Vendidas por membros"}
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
  );

  const renderTables = (summaries: ReturnType<typeof calculateSummaries>, isPartnership: boolean) => (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* My Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {isPartnership ? "Minhas Vendas (Peças de Parceiras)" : "Minhas Vendas (Peças de Membros)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{isPartnership ? "Parceira" : "Dono"}</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Meu Ganho</TableHead>
                <TableHead className="text-right">Devo</TableHead>
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
                    Nenhuma venda no período
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
                    </TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {formatCurrency(summary.partnerEarnings)}
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
            {isPartnership ? "Vendas de Parceiras (Minhas Peças)" : "Vendas de Membros (Minhas Peças)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{isPartnership ? "Parceira" : "Vendedor"}</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Meu Ganho</TableHead>
                <TableHead className="text-right">{isPartnership ? "Ganho Dela" : "Ganho Dele"}</TableHead>
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
                    Nenhuma venda no período
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
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(summary.sellerEarnings)}
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
          <h1 className="text-2xl font-bold text-foreground">Relatório de Parcerias e Grupos</h1>
          <p className="text-muted-foreground">Acompanhe os ganhos e divisões com parcerias 1-1 e grupos</p>
        </div>
        <Button onClick={handleExportSettlement} className="gap-2">
          <Share2 className="h-4 w-4" />
          Exportar Acerto de Contas
        </Button>
      </div>

      {/* Tabs for Partnerships vs Groups */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedGroupId("all"); setSelectedPartnerId("all"); }} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="partnerships" className="gap-2">
            <Users className="h-4 w-4" />
            Parcerias 1-1 ({directPartnerships.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <Building2 className="h-4 w-4" />
            Grupos ({regularGroups.length})
          </TabsTrigger>
        </TabsList>

        {/* Info Card */}
        <Card className="my-6 bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              {activeTab === "partnerships" ? (
                <>
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Regra de Parceria 1-1</p>
                    <p className="text-muted-foreground">
                      <strong>Quem vende:</strong> 50% do custo + 70% do lucro | 
                      <strong> Parceira:</strong> 50% do custo + 30% do lucro
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      As regras podem variar por parceria. Verifique as configurações de cada parceria.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Building2 className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Regra de Grupo</p>
                    <p className="text-muted-foreground">
                      <strong>Dono da peça:</strong> Custo + Comissão (ex: 20% do lucro) | 
                      <strong> Vendedor:</strong> Lucro restante (ex: 80%)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      A comissão pode variar por grupo. Verifique as configurações de cada grupo.
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
              <SelectItem value="all">{activeTab === "partnerships" ? "Todas as Parcerias" : "Todos os Grupos"}</SelectItem>
              {currentGroups.map(group => (
                <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={activeTab === "partnerships" ? "Parceira" : "Membro"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{activeTab === "partnerships" ? "Todas as Parceiras" : "Todos os Membros"}</SelectItem>
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

        <TabsContent value="partnerships">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Acerto entre Parceiras (1-1)
          </h2>
          {renderSummaryCards(partnershipTotals, true)}
          <Separator className="my-6" />
          {renderTables(partnershipSummaries, true)}
        </TabsContent>

        <TabsContent value="groups">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Acerto entre Membros do Grupo
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
