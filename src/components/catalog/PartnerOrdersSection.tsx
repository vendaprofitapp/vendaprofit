import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, ChevronUp, MapPin, Phone, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";

type PeriodFilter = "today" | "7days" | "30days";

function getPeriodDate(period: PeriodFilter) {
  if (period === "today") return startOfDay(new Date()).toISOString();
  if (period === "7days") return subDays(new Date(), 7).toISOString();
  return subDays(new Date(), 30).toISOString();
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function openWhatsApp(phone: string, message?: string) {
  const cleaned = phone.replace(/\D/g, "");
  const url = `https://wa.me/55${cleaned}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  window.open(url, "_blank");
}

const PASS_EMOJI: Record<string, string> = {
  green: "🟢", yellow: "🟡", blue: "🔵", purple: "🟣", gray: "⚫",
};

interface Props {
  period: PeriodFilter;
}

export function PartnerOrdersSection({ period }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const sinceDate = getPeriodDate(period);

  const { data: partnerSales = [], isLoading } = useQuery({
    queryKey: ["partner-point-orders", user?.id, sinceDate],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("partner_point_sales")
        .select("*, partner_points(name)")
        .eq("owner_id", user.id)
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const markContacted = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from("partner_point_sales")
        .update({ seller_contacted_at: new Date().toISOString() } as any)
        .eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como contatado!");
      queryClient.invalidateQueries({ queryKey: ["partner-point-orders"] });
    },
  });

  const toggleOrder = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pendingSales = partnerSales.filter((s: any) => s.pass_status === "pending");
  const otherSales = partnerSales.filter((s: any) => s.pass_status !== "pending");

  const buildWhatsAppMessage = (sale: any) => {
    const items = Array.isArray(sale.items) ? sale.items : [];
    const itemLines = items.map((i: any) => `• ${i.product_name} (${i.quantity}x) — ${formatBRL(i.unit_price * i.quantity)}`).join("\n");
    const partnerName = sale.partner_points?.name || "Ponto Parceiro";

    const passColor = sale.pass_color;
    let paymentInstruction = "";
    if (passColor === "green") {
      paymentInstruction = `\n\n💰 *Pagamento via PIX*\nValor: ${formatBRL(sale.total_gross)}\n\nApós pagar, me envie o comprovante! 🙏`;
    } else if (passColor === "yellow") {
      paymentInstruction = `\n\n💳 Vou enviar o link de pagamento para você em instantes!`;
    } else if (passColor === "blue") {
      paymentInstruction = `\n\n🏠 Você tem 24h para provar e decidir. Qualquer dúvida é só me chamar!`;
    }

    return `Olá ${sale.customer_name}! 🛍️\n\nRecebi seu pedido no *${partnerName}*!\n\n${itemLines}\n\n*Total: ${formatBRL(sale.total_gross)}*\nPagamento: ${sale.payment_method}${paymentInstruction}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (partnerSales.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum pedido de ponto parceiro</p>
          <p className="text-sm">Vendas feitas nos pontos parceiros aparecerão aqui</p>
        </CardContent>
      </Card>
    );
  }

  const renderSaleCard = (sale: any) => {
    const isExpanded = expandedOrders.has(sale.id);
    const items = Array.isArray(sale.items) ? sale.items : [];
    const partnerName = sale.partner_points?.name || "Ponto Parceiro";
    const passEmoji = PASS_EMOJI[sale.pass_color] ?? "⚪";
    const isContacted = !!(sale as any).seller_contacted_at;
    const needsAction = sale.pass_status === "pending" && (sale.pass_color === "green" || sale.pass_color === "yellow");

    return (
      <Card key={sale.id} className={`overflow-hidden ${needsAction && !isContacted ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
        <button
          onClick={() => toggleOrder(sale.id)}
          className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs gap-1 font-normal">
                  <MapPin className="h-3 w-3" />
                  {partnerName}
                </Badge>
                <Badge
                  variant={sale.pass_status === "pending" ? "default" : "secondary"}
                  className={sale.pass_status === "pending" ? "bg-amber-500/90 text-white" : ""}
                >
                  {passEmoji} {sale.pass_status === "pending" ? "Pendente" : sale.pass_status === "completed" ? "Concluído" : sale.pass_status}
                </Badge>
                {isContacted && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-300 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Contatado
                  </Badge>
                )}
              </div>
              <p className="font-medium mt-1 truncate">{sale.customer_name}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                <span>{format(new Date(sale.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                <span className="font-semibold text-foreground">{formatBRL(sale.total_gross)}</span>
                <span className="flex items-center gap-1">
                  {passEmoji} {sale.payment_method}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {sale.pass_status === "pending" && sale.customer_phone && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-green-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWhatsApp(sale.customer_phone, buildWhatsAppMessage(sale));
                  }}
                  title="Enviar WhatsApp"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </button>
        {isExpanded && (
          <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Itens do Pedido</p>
            {items.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.product_name}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-medium">{formatBRL(item.unit_price)}</p>
                  <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-semibold text-sm">
              <span>Total</span>
              <span>{formatBRL(sale.total_gross)}</span>
            </div>

            <div className="border-t pt-2 mt-2 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pagamento:</span>
                <span className="font-medium">{passEmoji} {sale.payment_method}</span>
              </div>
              {typeof sale.payment_fee_applied === "number" && sale.payment_fee_applied > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxa:</span>
                  <span>{sale.payment_fee_applied}%</span>
                </div>
              )}
              {sale.customer_phone && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">WhatsApp:</span>
                  <span>{sale.customer_phone}</span>
                </div>
              )}
            </div>

            {sale.pass_status === "pending" && !isContacted && (
              <div className="flex flex-wrap gap-2 pt-3 border-t mt-3">
                {sale.customer_phone && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      openWhatsApp(sale.customer_phone, buildWhatsAppMessage(sale));
                      markContacted.mutate(sale.id);
                    }}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {sale.pass_color === "green" ? "Enviar PIX" : sale.pass_color === "yellow" ? "Enviar Link" : "Contatar Cliente"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    markContacted.mutate(sale.id);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marcar Contatado
                </Button>
              </div>
            )}

            {isContacted && (sale as any).seller_contacted_at && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 pt-2 border-t mt-2">
                <Clock className="h-3 w-3" />
                Contatado em {format(new Date((sale as any).seller_contacted_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      {pendingSales.length > 0 && (
        <>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
            {pendingSales.length} pendente{pendingSales.length > 1 ? "s" : ""} — ação necessária
          </p>
          {pendingSales.map(renderSaleCard)}
        </>
      )}
      {otherSales.length > 0 && (
        <>
          {pendingSales.length > 0 && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">
              Histórico
            </p>
          )}
          {otherSales.map(renderSaleCard)}
        </>
      )}
    </div>
  );
}