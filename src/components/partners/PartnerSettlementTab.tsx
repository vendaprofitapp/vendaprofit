import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { calculatePartnerPointSplit } from "@/utils/profitEngine";
import {
  FileText, Share2, TrendingUp, Banknote, Store,
  CheckCircle2, ChevronDown, ChevronUp, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  id: string;
  name: string;
  rack_commission_pct: number;
  pickup_commission_pct: number;
  payment_fee_pct: number;
  contact_phone: string | null;
  payment_receiver?: string;
}

interface Settlement {
  id: string;
  settled_at: string;
  amount: number;
  sales_count: number;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
}

interface Props {
  partner: PartnerPoint;
  sales: Sale[];
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");

export function PartnerSettlementTab({ partner, sales }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog, ] = useState(false);
  const [settlementNotes, setSettlementNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch settlements for this partner
  const { data: settlements = [], refetch: refetchSettlements } = useQuery({
    queryKey: ["partner-settlements", partner.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_point_settlements")
        .select("*")
        .eq("partner_point_id", partner.id)
        .order("settled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Settlement[];
    },
    enabled: !!partner.id,
  });

  // Last settlement date — used to filter sales
  const lastSettledAt = settlements.length > 0 ? new Date(settlements[0].settled_at) : null;

  // Filter: only completed sales after last settlement
  const pendingSales = sales.filter(s => {
    if (s.pass_status !== "completed") return false;
    if (!lastSettledAt) return true;
    return new Date(s.created_at) > lastSettledAt;
  });

  const getEffectiveFee = (sale: Sale) =>
    typeof sale.payment_fee_applied === "number" && sale.payment_fee_applied > 0
      ? sale.payment_fee_applied
      : partner.payment_fee_pct;

  const totals = pendingSales.reduce(
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

  const paymentReceiver = partner.payment_receiver ?? "partner";

  const handleRegisterSettlement = async () => {
    if (!user || pendingSales.length === 0) return;
    setIsSaving(true);
    try {
      const periodStart = pendingSales.reduce((min, s) =>
        new Date(s.created_at) < new Date(min) ? s.created_at : min,
        pendingSales[0].created_at
      );
      const periodEnd = pendingSales.reduce((max, s) =>
        new Date(s.created_at) > new Date(max) ? s.created_at : max,
        pendingSales[0].created_at
      );

      const { error } = await supabase.from("partner_point_settlements").insert({
        owner_id: user.id,
        partner_point_id: partner.id,
        amount: totals.net,
        sales_count: pendingSales.length,
        period_start: periodStart,
        period_end: periodEnd,
        notes: settlementNotes || null,
      });

      if (error) throw error;

      toast.success("Acerto registrado com sucesso!");
      setSettlementNotes("");
      setShowConfirmDialog(false);
      refetchSettlements();
    } catch (e: any) {
      toast.error("Erro ao registrar acerto: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const generateWhatsApp = () => {
    if (!partner.contact_phone) {
      toast.error("Este parceiro não tem telefone cadastrado.");
      return;
    }
    const lines = [
      `*Extrato de Acerto — ${partner.name}*`,
      lastSettledAt
        ? `Período: ${fmtDate(lastSettledAt.toISOString())} até hoje`
        : `Período: todas as vendas pendentes`,
      `Vendas concluídas: ${pendingSales.length}`,
      ``,
      `💰 Total bruto: ${fmtBRL(totals.gross)}`,
      `💳 Taxas de pagamento: -${fmtBRL(totals.fee)}`,
      `🏪 Comissão arara (${partner.rack_commission_pct}%): -${fmtBRL(totals.partnerCommission)}`,
      `✅ Líquido para mim: ${fmtBRL(totals.net)}`,
      ``,
      `*Detalhe por venda:*`,
      ...pendingSales.map(s => {
        const fee = getEffectiveFee(s);
        const feeLabel = fee > 0 ? ` | taxa ${fee}%` : "";
        return `• ${s.customer_name} — ${fmtBRL(s.total_gross)} (${s.payment_method}${feeLabel})`;
      }),
    ];
    const text = encodeURIComponent(lines.join("\n"));
    const phone = partner.contact_phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-4">
      {/* Last settlement banner */}
      {lastSettledAt && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-foreground">
            Último acerto: <strong>{fmtDate(lastSettledAt.toISOString())}</strong>
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {settlements.length} acerto(s) registrado(s)
          </Badge>
        </div>
      )}

      {/* No pending sales */}
      {pendingSales.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle2 className="h-8 w-8 mx-auto text-primary/40 mb-2" />
          <p className="text-sm font-medium text-foreground">Tudo acertado!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Não há vendas pendentes de acerto desde o último registro.
          </p>
        </div>
      )}

      {pendingSales.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total bruto</span>
                </div>
                <p className="text-lg font-bold">{fmtBRL(totals.gross)}</p>
                <p className="text-xs text-muted-foreground">{pendingSales.length} venda(s) a acertar</p>
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

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={generateWhatsApp}
            >
              <Share2 className="h-4 w-4" />
              Enviar via WhatsApp
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => setShowConfirmDialog(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Registrar Acerto
            </Button>
          </div>

          {/* Sales detail */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendas pendentes de acerto</p>
            {pendingSales.map(sale => {
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
        </>
      )}

      {/* Settlement history */}
      {settlements.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={() => setShowHistory(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Histórico de acertos ({settlements.length})</span>
            </div>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showHistory && (
            <div className="border-t divide-y">
              {settlements.map(s => (
                <div key={s.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{fmtDate(s.settled_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.sales_count} venda(s)
                      {s.period_start && s.period_end && (
                        <> · {fmtDate(s.period_start)} – {fmtDate(s.period_end)}</>
                      )}
                    </p>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground italic">{s.notes}</p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-primary shrink-0">{fmtBRL(s.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm settlement dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Registrar Acerto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendas no período</span>
                <span className="font-medium">{pendingSales.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total bruto</span>
                <span className="font-medium">{fmtBRL(totals.gross)}</span>
              </div>
              <div className="flex justify-between font-bold text-primary">
                <span>Líquido recebido</span>
                <span>{fmtBRL(totals.net)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg border border-muted bg-muted/60 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Após registrar, o painel será zerado e mostrará apenas as próximas vendas. As vendas permanecem nos relatórios.</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea
                placeholder="Ex: Pago via PIX, cheque nº 1234..."
                value={settlementNotes}
                onChange={e => setSettlementNotes(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleRegisterSettlement} disabled={isSaving} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {isSaving ? "Registrando..." : "Confirmar Acerto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
