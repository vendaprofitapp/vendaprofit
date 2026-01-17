import { useState, useMemo } from "react";
import { Users, Calendar, FileText, MessageSquare, DollarSign, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  format, subWeeks, subMonths 
} from "date-fns";
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

const periodOptions = [
  { value: "this_week", label: "Esta Semana" },
  { value: "last_week", label: "Semana Passada" },
  { value: "this_month", label: "Este Mês" },
  { value: "last_month", label: "Mês Passado" },
];

export function AccountSettlement() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("this_month");
  const [selectedPartner, setSelectedPartner] = useState<PartnerSettlement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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

  // Create sales map
  const salesMap = useMemo(() => {
    const map = new Map<string, Sale & { sale_items: SaleItem[] }>();
    salesData.forEach(s => map.set(s.id, s));
    return map;
  }, [salesData]);

  // Calculate settlements
  const settlements = useMemo<PartnerSettlement[]>(() => {
    const settlementMap = new Map<string, PartnerSettlement>();

    // Get splits where other users receive money from my sales
    for (const split of allSplits) {
      // Skip if this is my own split (money I receive)
      if (split.user_id === user?.id) continue;

      const sale = salesMap.get(split.sale_id);
      // Only consider splits from MY sales (where I am the seller)
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

      // Categorize the split
      if (split.type === 'profit_share') {
        settlement.profitOwed += split.amount;
      } else if (split.type === 'cost_recovery') {
        settlement.costOwed += split.amount;
      } else if (split.type === 'group_commission') {
        settlement.commissionsOwed += split.amount;
      }

      // Extract product info from description and sale items
      const saleItems = sale.sale_items || [];
      const productName = saleItems.length > 0 
        ? saleItems.map(i => `${i.product_name} (${i.quantity}x)`).join(", ")
        : split.description.replace(/^(Recuperação de custo|Lucro da venda|Comissão de grupo)( \(dono\))? - /, "");

      // Add item detail
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
    
    // Group items by date
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
    
    // Copy to clipboard
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

  return (
    <div className="space-y-6">
      {/* Header with Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Acerto de Contas</h2>
          <p className="text-sm text-muted-foreground">
            Valores a pagar para sócios e parceiros
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
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

      {/* Summary Card */}
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-orange-600" />
            Total a Pagar no Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">
            {formatCurrency(totalOwedToPartners)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {settlements.length} {settlements.length === 1 ? "parceiro" : "parceiros"} com valores pendentes
          </p>
        </CardContent>
      </Card>

      {/* Settlements List */}
      {splitsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : settlements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum acerto pendente</h3>
            <p className="text-muted-foreground text-center">
              Não há valores a pagar para parceiros no período selecionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {settlements.map((settlement) => (
            <Card key={settlement.partnerId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{settlement.partnerName}</h4>
                      <p className="text-sm text-muted-foreground">{settlement.partnerEmail}</p>
                      
                      {/* Breakdown Badges */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {settlement.profitOwed > 0 && (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/30">
                            Lucros: {formatCurrency(settlement.profitOwed)}
                          </Badge>
                        )}
                        {settlement.costOwed > 0 && (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 border-blue-500/30">
                            Custos: {formatCurrency(settlement.costOwed)}
                          </Badge>
                        )}
                        {settlement.commissionsOwed > 0 && (
                          <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 border-purple-500/30">
                            Comissões: {formatCurrency(settlement.commissionsOwed)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-orange-600">
                      {formatCurrency(settlement.totalOwed)}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(settlement)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Detalhes
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSendWhatsApp(settlement)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        WhatsApp
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Period Info */}
      <div className="text-center text-sm text-muted-foreground">
        Período: {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} até {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Acerto com {selectedPartner?.partnerName}
            </DialogTitle>
            <DialogDescription>
              Detalhamento por peça vendida
            </DialogDescription>
          </DialogHeader>
          
          {selectedPartner && (
            <>
              {/* Summary */}
              <div className="flex flex-wrap gap-3 py-2">
                <Badge variant="outline" className="text-base py-1.5 px-3">
                  Total: <span className="font-bold text-orange-600 ml-1">{formatCurrency(selectedPartner.totalOwed)}</span>
                </Badge>
                {selectedPartner.profitOwed > 0 && (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/30">
                    Lucros: {formatCurrency(selectedPartner.profitOwed)}
                  </Badge>
                )}
                {selectedPartner.costOwed > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 border-blue-500/30">
                    Custos: {formatCurrency(selectedPartner.costOwed)}
                  </Badge>
                )}
                {selectedPartner.commissionsOwed > 0 && (
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 border-purple-500/30">
                    Comissões: {formatCurrency(selectedPartner.commissionsOwed)}
                  </Badge>
                )}
              </div>
              
              <Separator />
              
              {/* Items Table */}
              <ScrollArea className="flex-1 max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPartner.items.map((item, idx) => {
                      const itemTotal = item.profitShare + item.costShare + item.commission;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap">{item.saleDate}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{item.productName}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {item.profitShare > 0 ? formatCurrency(item.profitShare) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            {item.costShare > 0 ? formatCurrency(item.costShare) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-purple-600">
                            {item.commission > 0 ? formatCurrency(item.commission) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(itemTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Fechar
            </Button>
            {selectedPartner && (
              <Button onClick={() => handleSendWhatsApp(selectedPartner)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar pelo WhatsApp
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
