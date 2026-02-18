import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { calculatePartnerPointSplit } from "@/utils/profitEngine";
import { FileText, Share2, TrendingUp, Banknote, Store } from "lucide-react";
import { toast } from "sonner";

interface Sale {
  id: string;
  customer_name: string;
  total_gross: number;
  payment_method: string;
  pass_status: string;
  created_at: string;
  items: any;
  payment_fee_applied?: number;
}

interface PartnerPoint {
  name: string;
  rack_commission_pct: number;
  pickup_commission_pct: number;
  payment_fee_pct: number;
  contact_phone: string | null;
  payment_receiver?: string;
}

interface Props {
  partner: PartnerPoint;
  sales: Sale[];
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PartnerSettlementTab({ partner, sales }: Props) {
  const [period, setPeriod] = useState<"all" | "30" | "7">("30");

  const now = Date.now();
  const filteredSales = sales.filter(s => {
    if (s.pass_status !== "completed") return false;
    if (period === "all") return true;
    const days = period === "30" ? 30 : 7;
    return now - new Date(s.created_at).getTime() <= days * 86_400_000;
  });

  // Resolve effective fee per sale: prefer payment_fee_applied if set, else partner.payment_fee_pct
  const getEffectiveFee = (sale: Sale) =>
    typeof sale.payment_fee_applied === "number" && sale.payment_fee_applied > 0
      ? sale.payment_fee_applied
      : partner.payment_fee_pct;

  const totals = filteredSales.reduce(
    (acc, sale) => {
      const result = calculatePartnerPointSplit({
        grossPrice: sale.total_gross,
        costPrice: 0,
        rackCommissionPct: partner.rack_commission_pct,
        paymentFeePct: getEffectiveFee(sale),
      });
      acc.gross += sale.total_gross;
      acc.fee += result.paymentFeeAmount;
      acc.partnerCommission += result.partnerCommission;
      acc.net += result.netRevenue - result.partnerCommission;
      return acc;
    },
    { gross: 0, fee: 0, partnerCommission: 0, net: 0 }
  );

  const generateWhatsApp = () => {
    if (!partner.contact_phone) {
      toast.error("Este parceiro não tem telefone cadastrado.");
      return;
    }
    const lines = [
      `*Extrato de Acerto — ${partner.name}*`,
      `Período: ${period === "all" ? "todos os tempos" : `últimos ${period} dias`}`,
      `Vendas concluídas: ${filteredSales.length}`,
      ``,
      `💰 Total bruto: ${fmtBRL(totals.gross)}`,
      `💳 Taxas de pagamento: -${fmtBRL(totals.fee)}`,
      `🏪 Comissão arara (${partner.rack_commission_pct}%): -${fmtBRL(totals.partnerCommission)}`,
      `✅ Líquido para mim: ${fmtBRL(totals.net)}`,
      ``,
      `*Detalhe por venda:*`,
      ...filteredSales.map(s => {
        const fee = getEffectiveFee(s);
        const feeLabel = fee > 0 ? ` | taxa ${fee}%` : "";
        return `• ${s.customer_name} — ${fmtBRL(s.total_gross)} (${s.payment_method}${feeLabel})`;
      }),
    ];
    const text = encodeURIComponent(lines.join("\n"));
    const phone = partner.contact_phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${text}`, "_blank");
  };

  const paymentReceiver = partner.payment_receiver ?? "partner";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["7", "30", "all"] as const).map(p => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? "default" : "outline"}
            onClick={() => setPeriod(p)}
          >
            {p === "7" ? "7 dias" : p === "30" ? "30 dias" : "Todos"}
          </Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total bruto</span>
            </div>
            <p className="text-lg font-bold">{fmtBRL(totals.gross)}</p>
            <p className="text-xs text-muted-foreground">{filteredSales.length} venda(s) concluída(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Líquido meu</span>
            </div>
            <p className="text-lg font-bold text-primary">{fmtBRL(totals.net)}</p>
            <p className="text-xs text-muted-foreground">Após taxas e comissão</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">Composição do período</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Faturamento bruto</span>
              <span className="font-medium">{fmtBRL(totals.gross)}</span>
            </div>
            <div className="flex justify-between text-destructive/80">
              <span>
                {paymentReceiver === "partner"
                  ? `Taxa maquininha parceiro (${partner.payment_fee_pct}%)`
                  : "Taxas por forma de pagamento"}
              </span>
              <span>-{fmtBRL(totals.fee)}</span>
            </div>
            <div className="flex justify-between text-destructive/80">
              <div className="flex items-center gap-1">
                <Store className="h-3.5 w-3.5" />
                <span>Comissão arara ({partner.rack_commission_pct}%)</span>
              </div>
              <span>-{fmtBRL(totals.partnerCommission)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-primary">
              <span>Líquido para mim</span>
              <span>{fmtBRL(totals.net)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-2" onClick={generateWhatsApp} disabled={filteredSales.length === 0}>
          <Share2 className="h-4 w-4" />
          Enviar via WhatsApp
        </Button>
      </div>

      {/* Sales detail */}
      {filteredSales.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendas do período</p>
          {filteredSales.map(sale => {
            const effectiveFee = getEffectiveFee(sale);
            const split = calculatePartnerPointSplit({
              grossPrice: sale.total_gross,
              costPrice: 0,
              rackCommissionPct: partner.rack_commission_pct,
              paymentFeePct: effectiveFee,
            });
            return (
              <div key={sale.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{sale.customer_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className="text-xs py-0">
                      {sale.payment_method}
                    </Badge>
                    {effectiveFee > 0 && (
                      <span className="text-xs text-muted-foreground">taxa {effectiveFee}%</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs space-y-0.5">
                  <p className="font-medium text-sm">{fmtBRL(sale.total_gross)}</p>
                  <p className="text-muted-foreground">comissão: {fmtBRL(split.partnerCommission)}</p>
                  <p className="text-primary">líquido: {fmtBRL(split.netRevenue - split.partnerCommission)}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma venda concluída no período.</p>
        </div>
      )}
    </div>
  );
}
