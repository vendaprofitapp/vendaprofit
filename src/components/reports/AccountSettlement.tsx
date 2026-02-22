import { useState, useMemo } from "react";
import { Users, Calendar, FileText, MessageSquare, DollarSign, ChevronDown, ChevronRight, Eye, Wallet, TrendingUp, ArrowDownLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadXlsx } from "@/utils/xlsExport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  format, subWeeks, subMonths 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FinancialSplit {
  id: string;
  sale_id: string;
  user_id: string;
  amount: number;
  type: 'cost_recovery' | 'profit_share' | 'group_commission';
  description: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  sale_id: string;
}

interface Sale {
  id: string;
  created_at: string;
  total: number;
  owner_id: string;
}

interface PartnerSettlement {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerPhone?: string;
  profitOwed: number;
  costOwed: number;
  commissionsOwed: number;
  totalOwed: number;
  items: {
    productName: string;
    quantity: number;
    saleDate: string;
    profitShare: number;
    costShare: number;
    commission: number;
  }[];
}

type ViewFilter = "overview" | "my_part" | "partner_part";

const periodOptions = [
  { value: "this_week", label: "Esta Semana" },
  { value: "last_week", label: "Semana Passada" },
  { value: "this_month", label: "Este Mês" },
  { value: "last_month", label: "Mês Passado" },
];

const viewFilterOptions = [
  { value: "overview", label: "Visão Geral", icon: Eye },
  { value: "my_part", label: "Minha Parte", icon: Wallet },
  { value: "partner_part", label: "Parte da Sociedade", icon: Users },
];

export function AccountSettlement() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("this_month");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("overview");
  const [selectedPartner, setSelectedPartner] = useState<PartnerSettlement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "this_week":
        return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
      case "last_week":
        const lastWeek = subWeeks(now, 1);
        return { start: startOfWeek(lastWeek, { weekStartsOn: 0 }), end: endOfWeek(lastWeek, { weekStartsOn: 0 }) };
      case "this_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [period]);

  // Fetch all financial splits in date range
  const { data: allSplits = [], isLoading: splitsLoading } = useQuery({
    queryKey: ["settlement-splits", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_splits")
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data as FinancialSplit[];
    },
    enabled: !!user,
  });

  // Fetch all profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-settlement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!user,
  });

  // Fetch sales with items in date range
  const { data: salesData = [] } = useQuery({
    queryKey: ["settlement-sales", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          created_at,
          total,
          owner_id,
          sale_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total,
            sale_id
          )
        `)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .eq("status", "completed");
      if (error) throw error;
      return data as (Sale & { sale_items: SaleItem[] })[];
    },
    enabled: !!user,
  });

  // Create profile map
  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach(p => map.set(p.id, p));
    return map;
  }, [profiles]);

  const currentUserName = profiles.find(p => p.id === user?.id)?.full_name || "Você";

  // Create sales map
  const salesMap = useMemo(() => {
    const map = new Map<string, Sale & { sale_items: SaleItem[] }>();
    salesData.forEach(s => map.set(s.id, s));
    return map;
  }, [salesData]);

  // Calculate my earnings (what I receive)
  const myEarnings = useMemo(() => {
    let profit = 0;
    let costRecovery = 0;
    let commissions = 0;

    for (const split of allSplits) {
      if (split.user_id === user?.id) {
        if (split.type === 'profit_share') profit += split.amount;
        else if (split.type === 'cost_recovery') costRecovery += split.amount;
        else if (split.type === 'group_commission') commissions += split.amount;
      }
    }

    return { profit, costRecovery, commissions, total: profit + costRecovery + commissions };
  }, [allSplits, user?.id]);

  // Calculate settlements (what I owe to others)
  const settlements = useMemo<PartnerSettlement[]>(() => {
    const settlementMap = new Map<string, PartnerSettlement>();

    for (const split of allSplits) {
      if (split.user_id === user?.id) continue;

      const sale = salesMap.get(split.sale_id);
      if (!sale || sale.owner_id !== user?.id) continue;

      const partnerId = split.user_id;
      const profile = profileMap.get(partnerId);
      
      if (!profile) continue;

      let settlement = settlementMap.get(partnerId);
      if (!settlement) {
        settlement = {
          partnerId,
          partnerName: profile.full_name,
          partnerEmail: profile.email,
          partnerPhone: profile.phone,
          profitOwed: 0,
          costOwed: 0,
          commissionsOwed: 0,
          totalOwed: 0,
          items: [],
        };
        settlementMap.set(partnerId, settlement);
      }

      if (split.type === 'profit_share') {
        settlement.profitOwed += split.amount;
      } else if (split.type === 'cost_recovery') {
        settlement.costOwed += split.amount;
      } else if (split.type === 'group_commission') {
        settlement.commissionsOwed += split.amount;
      }

      const saleItems = sale.sale_items || [];
      const productName = saleItems.length > 0 
        ? saleItems.map(i => `${i.product_name} (${i.quantity}x)`).join(", ")
        : split.description.replace(/^(Recuperação de custo|Lucro da venda|Comissão de grupo)( \(dono\))? - /, "");

      settlement.items.push({
        productName: productName,
        quantity: saleItems.reduce((sum, i) => sum + i.quantity, 0) || 1,
        saleDate: format(new Date(split.created_at), "dd/MM/yyyy", { locale: ptBR }),
        profitShare: split.type === 'profit_share' ? split.amount : 0,
        costShare: split.type === 'cost_recovery' ? split.amount : 0,
        commission: split.type === 'group_commission' ? split.amount : 0,
      });

      settlement.totalOwed = settlement.profitOwed + settlement.costOwed + settlement.commissionsOwed;
    }

    return Array.from(settlementMap.values()).filter(s => s.totalOwed > 0);
  }, [allSplits, salesMap, profileMap, user?.id]);

  const totalOwedToPartners = settlements.reduce((sum, s) => sum + s.totalOwed, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const togglePartnerExpand = (partnerId: string) => {
    setExpandedPartners(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
      }
      return next;
    });
  };

  const generateSettlementText = (settlement: PartnerSettlement) => {
    const periodLabel = periodOptions.find(p => p.value === period)?.label || period;
    
    let text = `📊 *ACERTO DE CONTAS*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `📅 Período: ${periodLabel}\n`;
    text += `📆 ${format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} até ${format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}\n\n`;
    
    text += `👤 Para: *${settlement.partnerName}*\n\n`;
    
    text += `💰 *RESUMO*\n`;
    if (settlement.profitOwed > 0) {
      text += `   • Lucros: ${formatCurrency(settlement.profitOwed)}\n`;
    }
    if (settlement.costOwed > 0) {
      text += `   • Custos: ${formatCurrency(settlement.costOwed)}\n`;
    }
    if (settlement.commissionsOwed > 0) {
      text += `   • Comissões: ${formatCurrency(settlement.commissionsOwed)}\n`;
    }
    text += `\n   *TOTAL A PAGAR: ${formatCurrency(settlement.totalOwed)}*\n\n`;
    
    text += `📦 *DETALHAMENTO POR PEÇA*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    
    const itemsByDate = new Map<string, typeof settlement.items>();
    settlement.items.forEach(item => {
      const existing = itemsByDate.get(item.saleDate) || [];
      existing.push(item);
      itemsByDate.set(item.saleDate, existing);
    });

    itemsByDate.forEach((items, date) => {
      text += `\n📅 ${date}:\n`;
      items.forEach(item => {
        const itemTotal = item.profitShare + item.costShare + item.commission;
        text += `   • ${item.productName}\n`;
        text += `     → ${formatCurrency(itemTotal)}\n`;
      });
    });

    text += `\n━━━━━━━━━━━━━━━━━━\n`;
    text += `✅ Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
    
    return text;
  };

  const handleSendWhatsApp = (settlement: PartnerSettlement) => {
    const text = generateSettlementText(settlement);
    const phone = settlement.partnerPhone?.replace(/\D/g, "") || "";
    const whatsappUrl = `https://wa.me/${phone ? `55${phone}` : ""}?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Comprovante copiado!",
      description: "O texto também foi copiado para a área de transferência.",
    });
  };

  const handleViewDetails = (settlement: PartnerSettlement) => {
    setSelectedPartner(settlement);
    setIsDetailOpen(true);
  };

  const handleExportXlsx = () => {
    if (allSplits.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const periodLabel = periodOptions.find(p => p.value === period)?.label || period;

    const headers = [
      "Data da Venda",
      "ID da Venda",
      "Parceiro",
      "E-mail Parceiro",
      "Produto(s)",
      "Valor da Venda",
      "Tipo de Split",
      "Descrição",
      "Valor do Split",
      "Destinatário",
      "Período",
    ];

    const typeLabels: Record<string, string> = {
      profit_share: "Lucro",
      cost_recovery: "Recuperação de Custo",
      group_commission: "Comissão de Grupo",
    };

    const rows: any[][] = [];

    // Group by partner for totals
    const partnerTotals = new Map<string, number>();

    for (const split of allSplits) {
      const sale = salesMap.get(split.sale_id);
      const profile = profileMap.get(split.user_id);
      const productNames = sale?.sale_items
        ? sale.sale_items.map(i => `${i.product_name} (${i.quantity}x)`).join(", ")
        : "";

      const partnerName = profile?.full_name || split.user_id.slice(0, 8);
      partnerTotals.set(partnerName, (partnerTotals.get(partnerName) || 0) + split.amount);

      rows.push([
        sale ? format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
        split.sale_id.slice(0, 8),
        partnerName,
        profile?.email || "",
        productNames,
        sale?.total || 0,
        typeLabels[split.type] || split.type,
        split.description || "",
        split.amount,
        split.user_id === user?.id ? "Eu" : partnerName,
        periodLabel,
      ]);
    }

    // Add partner totals
    rows.push([]);
    rows.push(["TOTAIS POR PARCEIRO", "", "", "", "", "", "", "", "", "", ""]);
    partnerTotals.forEach((total, name) => {
      rows.push(["", "", name, "", "", "", "", "", total, "", ""]);
    });

    // Grand total
    const grandTotal = allSplits.reduce((s, sp) => s + sp.amount, 0);
    rows.push(["TOTAL GERAL", "", "", "", "", "", "", "", grandTotal, "", ""]);

    downloadXlsx(
      [headers, ...rows],
      "Acerto de Contas",
      `acerto-contas-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );

    toast({ title: "Relatório exportado com sucesso!" });
  };

  return (
    <div className="space-y-4">
      {/* Mobile-First Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Acerto de Contas</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportXlsx}>
              <Download className="h-4 w-4 mr-1.5" />
              Exportar XLS
            </Button>
            <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] sm:w-[160px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick View Filter - Mobile Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {viewFilterOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setViewFilter(option.value as ViewFilter)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition-all",
                  viewFilter === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden xs:inline sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Cards - Semantic Colors */}
      {viewFilter === "overview" && (
        <div className="grid grid-cols-2 gap-3">
          {/* My Earnings - Green (Money Coming In) */}
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">Ganhos de {currentUserName}</span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-emerald-600">
                {formatCurrency(myEarnings.total)}
              </p>
            </CardContent>
          </Card>

          {/* Owed to Partners - Red (Money Going Out) */}
          <Card className="border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-rose-600/10">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="h-4 w-4 text-rose-600" />
                <span className="text-xs font-medium text-rose-700">
                  {settlements.length === 1 ? `A Pagar para ${settlements[0].partnerName}` : "A Pagar"}
                </span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-rose-600">
                {formatCurrency(totalOwedToPartners)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {viewFilter === "my_part" && (
        <div className="space-y-3">
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-5 w-5 text-emerald-600" />
                <span className="font-medium text-emerald-700">Ganhos de {currentUserName} no Período</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 mb-4">
                {formatCurrency(myEarnings.total)}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-700">Lucros de vendas</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(myEarnings.profit)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Recuperação de custo</span>
                  <span className="font-medium text-muted-foreground">{formatCurrency(myEarnings.costRecovery)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-700">Comissões recebidas</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(myEarnings.commissions)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {viewFilter === "partner_part" && (
        <Card className="border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-rose-600/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-rose-600" />
              <span className="font-medium text-rose-700">
                {settlements.length === 1 ? `Total a Pagar para ${settlements[0].partnerName}` : "Total a Pagar aos Sócios/Parceiros"}
              </span>
            </div>
            <p className="text-2xl font-bold text-rose-600">
              {formatCurrency(totalOwedToPartners)}
            </p>
            <p className="text-sm text-rose-700/70 mt-1">
              {settlements.length} {settlements.length === 1 ? "parceiro" : "parceiros"} com valores pendentes
            </p>
          </CardContent>
        </Card>
      )}

      {/* Settlements List - Collapsible for Mobile */}
      {(viewFilter === "overview" || viewFilter === "partner_part") && (
        <>
          {splitsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : settlements.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Users className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-base font-medium mb-1">Nenhum acerto pendente</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Não há valores a pagar no período.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {settlements.map((settlement) => (
                <Collapsible
                  key={settlement.partnerId}
                  open={expandedPartners.has(settlement.partnerId)}
                  onOpenChange={() => togglePartnerExpand(settlement.partnerId)}
                >
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-9 w-9 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                              <Users className="h-4 w-4 text-rose-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{settlement.partnerName}</p>
                              <p className="text-xs text-muted-foreground truncate">{settlement.partnerEmail}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-base font-bold text-rose-600">
                              {formatCurrency(settlement.totalOwed)}
                            </span>
                            {expandedPartners.has(settlement.partnerId) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3">
                        <Separator />
                        
                        {/* Breakdown with Semantic Colors */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {settlement.profitOwed > 0 && (
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                              <p className="text-xs text-emerald-700 mb-0.5">Lucros</p>
                              <p className="text-sm font-semibold text-emerald-600">
                                {formatCurrency(settlement.profitOwed)}
                              </p>
                            </div>
                          )}
                          {settlement.costOwed > 0 && (
                            <div className="p-2 rounded-lg bg-muted">
                              <p className="text-xs text-muted-foreground mb-0.5">Custos</p>
                              <p className="text-sm font-semibold text-foreground">
                                {formatCurrency(settlement.costOwed)}
                              </p>
                            </div>
                          )}
                          {settlement.commissionsOwed > 0 && (
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                              <p className="text-xs text-emerald-700 mb-0.5">Comissões</p>
                              <p className="text-sm font-semibold text-emerald-600">
                                {formatCurrency(settlement.commissionsOwed)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Recent Items Preview */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Últimas transações:</p>
                          {settlement.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 bg-muted/50 rounded">
                              <span className="truncate flex-1 mr-2">{item.productName}</span>
                              <span className="text-muted-foreground shrink-0">{item.saleDate}</span>
                            </div>
                          ))}
                          {settlement.items.length > 3 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{settlement.items.length - 3} itens
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-9"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(settlement);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1.5" />
                            Detalhes
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendWhatsApp(settlement);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-1.5" />
                            WhatsApp
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </>
      )}

      {/* Period Info - Compact for Mobile */}
      <p className="text-center text-xs text-muted-foreground py-2">
        {format(dateRange.start, "dd/MM", { locale: ptBR })} - {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
      </p>

      {/* Detail Dialog - Mobile Optimized */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Acerto: {selectedPartner?.partnerName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Detalhamento por peça vendida
            </DialogDescription>
          </DialogHeader>
          
          {selectedPartner && (
            <>
              {/* Summary with Semantic Colors */}
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-rose-500/10 text-rose-700 border-rose-500/30 hover:bg-rose-500/20">
                    Total: {formatCurrency(selectedPartner.totalOwed)}
                  </Badge>
                  {selectedPartner.profitOwed > 0 && (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-500/30">
                      Lucros: {formatCurrency(selectedPartner.profitOwed)}
                    </Badge>
                  )}
                  {selectedPartner.costOwed > 0 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Custos: {formatCurrency(selectedPartner.costOwed)}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              <ScrollArea className="flex-1 max-h-[50vh]">
                <div className="p-4 space-y-2">
                  {selectedPartner.items.map((item, idx) => {
                    const itemTotal = item.profitShare + item.costShare + item.commission;
                    return (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium flex-1">{item.productName}</p>
                          <span className="text-xs text-muted-foreground shrink-0">{item.saleDate}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.profitShare > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                              Lucro: {formatCurrency(item.profitShare)}
                            </span>
                          )}
                          {item.costShare > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Custo: {formatCurrency(item.costShare)}
                            </span>
                          )}
                          {item.commission > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                              Comissão: {formatCurrency(item.commission)}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-rose-600">
                            {formatCurrency(itemTotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <Separator />
              
              <DialogFooter className="p-4 pt-3 flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsDetailOpen(false)}
                >
                  Fechar
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleSendWhatsApp(selectedPartner)}
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  WhatsApp
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
