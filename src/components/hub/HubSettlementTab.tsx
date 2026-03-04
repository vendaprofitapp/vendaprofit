import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp,
  Send, HandshakeIcon, XCircle, TrendingUp, Banknote,
} from "lucide-react";
import { toast } from "sonner";

interface HubSettlement {
  id: string;
  connection_id: string;
  proposed_by: string;
  confirmed_by: string | null;
  status: "pending_confirmation" | "confirmed" | "disputed";
  seller_amount: number;
  owner_amount: number;
  splits_count: number;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  dispute_reason: string | null;
  proposed_at: string;
  confirmed_at: string | null;
}

interface HubSplit {
  id: string;
  owner_amount: number;
  seller_amount: number;
  created_at: string;
}

interface Connection {
  id: string;
  owner_id: string;
  seller_id: string | null;
  commission_pct: number;
  owner_profile?: { full_name: string } | null;
  seller_profile?: { full_name: string } | null;
}

interface Props {
  connection: Connection;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");

const STATUS_CONFIG = {
  pending_confirmation: {
    label: "Aguardando confirmação",
    badge: "secondary" as const,
    icon: Clock,
    color: "text-muted-foreground",
  },
  confirmed: {
    label: "Confirmado",
    badge: "default" as const,
    icon: CheckCircle2,
    color: "text-primary",
  },
  disputed: {
    label: "Contestado",
    badge: "destructive" as const,
    icon: XCircle,
    color: "text-destructive",
  },
};

export function HubSettlementTab({ connection }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isOwner = user?.id === connection.owner_id;
  const myName = isOwner
    ? connection.owner_profile?.full_name ?? "Você (Dono)"
    : connection.seller_profile?.full_name ?? "Você (Vendedora)";
  const partnerName = isOwner
    ? connection.seller_profile?.full_name ?? "Vendedora"
    : connection.owner_profile?.full_name ?? "Dono";

  const [showProposeDialog, setShowProposeDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [proposeNotes, setProposeNotes] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch settlements
  const { data: settlements = [], refetch } = useQuery({
    queryKey: ["hub-settlements", connection.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_settlements")
        .select("*")
        .eq("connection_id", connection.id)
        .order("proposed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HubSettlement[];
    },
    enabled: !!connection.id,
  });

  // Last confirmed settlement
  const lastConfirmed = settlements.find(s => s.status === "confirmed");
  const lastConfirmedAt = lastConfirmed ? new Date(lastConfirmed.confirmed_at ?? lastConfirmed.proposed_at) : null;

  // Pending (awaiting confirmation from partner)
  const pendingSettlement = settlements.find(s => s.status === "pending_confirmation");
  const iProposed = pendingSettlement?.proposed_by === user?.id;
  const partnerProposed = pendingSettlement && !iProposed;

  // Fetch splits after last confirmed settlement
  const { data: splits = [] } = useQuery({
    queryKey: ["hub-splits-pending-settlement", connection.id, lastConfirmedAt?.toISOString()],
    queryFn: async () => {
      let q = supabase
        .from("hub_sale_splits")
        .select("id, owner_amount, seller_amount, created_at")
        .eq("connection_id", connection.id)
        .order("created_at", { ascending: false });
      if (lastConfirmedAt) {
        q = q.gt("created_at", lastConfirmedAt.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as HubSplit[];
    },
    enabled: !!connection.id,
  });

  const totals = splits.reduce(
    (acc, s) => {
      acc.ownerAmount += s.owner_amount;
      acc.sellerAmount += s.seller_amount;
      return acc;
    },
    { ownerAmount: 0, sellerAmount: 0 }
  );

  const myPendingAmount = isOwner ? totals.ownerAmount : totals.sellerAmount;
  const partnerPendingAmount = isOwner ? totals.sellerAmount : totals.ownerAmount;

  const periodStart = splits.length > 0
    ? splits.reduce((min, s) => new Date(s.created_at) < new Date(min) ? s.created_at : min, splits[0].created_at)
    : null;
  const periodEnd = splits.length > 0
    ? splits.reduce((max, s) => new Date(s.created_at) > new Date(max) ? s.created_at : max, splits[0].created_at)
    : null;

  const handlePropose = async () => {
    if (!user || splits.length === 0) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("hub_settlements").insert({
        connection_id: connection.id,
        proposed_by: user.id,
        seller_amount: totals.sellerAmount,
        owner_amount: totals.ownerAmount,
        splits_count: splits.length,
        period_start: periodStart,
        period_end: periodEnd,
        notes: proposeNotes || null,
        status: "pending_confirmation",
      });
      if (error) throw error;
      toast.success("Proposta de acerto enviada! Aguardando confirmação do parceiro.");
      setProposeNotes("");
      setShowProposeDialog(false);
      refetch();
    } catch (e: any) {
      toast.error("Erro ao propor acerto: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("hub_settlements")
        .update({ status: "confirmed", confirmed_by: user.id, confirmed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Acerto confirmado! O painel será zerado para ambas as partes.");
      refetch();
    } catch (e: any) {
      toast.error("Erro ao confirmar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDispute = async () => {
    if (!user || !disputingId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("hub_settlements")
        .update({ status: "disputed", dispute_reason: disputeReason || null })
        .eq("id", disputingId);
      if (error) throw error;
      toast.success("Contestação registrada. Entre em contato com o parceiro para resolver.");
      setDisputeReason("");
      setShowDisputeDialog(false);
      setDisputingId(null);
      refetch();
    } catch (e: any) {
      toast.error("Erro ao contestar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmedSettlements = settlements.filter(s => s.status === "confirmed");

  return (
    <div className="space-y-4">
      {/* Last confirmed banner */}
      {lastConfirmed && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-foreground">
            Último acerto confirmado: <strong>{fmtDate(lastConfirmed.confirmed_at ?? lastConfirmed.proposed_at)}</strong>
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {confirmedSettlements.length} acerto(s)
          </Badge>
        </div>
      )}

      {/* Pending settlement proposed by partner — needs my action */}
      {partnerProposed && pendingSettlement && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <HandshakeIcon className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">
                {partnerName} propôs um acerto — sua confirmação é necessária
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Seu valor ({isOwner ? "Dono" : "Vendedora"})</p>
                <p className="font-bold text-primary">{fmtBRL(isOwner ? pendingSettlement.owner_amount : pendingSettlement.seller_amount)}</p>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Valor {partnerName}</p>
                <p className="font-bold">{fmtBRL(isOwner ? pendingSettlement.seller_amount : pendingSettlement.owner_amount)}</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {pendingSettlement.splits_count} venda(s)
              {pendingSettlement.period_start && pendingSettlement.period_end && (
                <> · {fmtDate(pendingSettlement.period_start)} – {fmtDate(pendingSettlement.period_end)}</>
              )}
            </div>

            {pendingSettlement.notes && (
              <p className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2">
                "{pendingSettlement.notes}"
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 gap-2"
                onClick={() => handleConfirm(pendingSettlement.id)}
                disabled={isSaving}
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Acerto
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { setDisputingId(pendingSettlement.id); setShowDisputeDialog(true); }}
                disabled={isSaving}
              >
                <XCircle className="h-4 w-4" />
                Contestar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My pending proposal — waiting for partner */}
      {iProposed && pendingSettlement && (
        <Card className="border-muted">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Proposta enviada em {fmtDate(pendingSettlement.proposed_at)} — aguardando {partnerName} confirmar
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No pending splits */}
      {splits.length === 0 && !pendingSettlement && (
        <div className="text-center py-8">
          <CheckCircle2 className="h-8 w-8 mx-auto text-primary/40 mb-2" />
          <p className="text-sm font-medium text-foreground">Tudo acertado!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Não há vendas pendentes de acerto desde o último registro confirmado.
          </p>
        </div>
      )}

      {/* Pending splits summary */}
      {splits.length > 0 && !pendingSettlement && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Meu total pendente</span>
                </div>
                <p className="text-lg font-bold text-primary">{fmtBRL(myPendingAmount)}</p>
                <p className="text-xs text-muted-foreground">{splits.length} venda(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total {partnerName}</span>
                </div>
                <p className="text-lg font-bold">{fmtBRL(partnerPendingAmount)}</p>
                {periodStart && periodEnd && (
                  <p className="text-xs text-muted-foreground">{fmtDate(periodStart)} – {fmtDate(periodEnd)}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <p className="font-semibold">Resumo pendente</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{myName} ({isOwner ? "Dono" : "Vendedora"})</span>
                <span className="font-bold text-primary">{fmtBRL(myPendingAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{partnerName} ({isOwner ? "Vendedora" : "Dono"})</span>
                <span className="font-medium">{fmtBRL(partnerPendingAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{splits.length} vendas no período</span>
                {periodStart && periodEnd && (
                  <span>{fmtDate(periodStart)} – {fmtDate(periodEnd)}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full gap-2"
            onClick={() => setShowProposeDialog(true)}
            disabled={!!pendingSettlement}
          >
            <Send className="h-4 w-4" />
            Propor Acerto para {partnerName}
          </Button>
        </>
      )}

      {/* History */}
      {confirmedSettlements.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={() => setShowHistory(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Histórico confirmado ({confirmedSettlements.length})</span>
            </div>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showHistory && (
            <div className="border-t divide-y">
              {confirmedSettlements.map(s => (
                <div key={s.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{fmtDate(s.confirmed_at ?? s.proposed_at)}</p>
                      <Badge variant="default" className="text-xs py-0">Confirmado</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.splits_count} venda(s)
                      {s.period_start && s.period_end && (
                        <> · {fmtDate(s.period_start)} – {fmtDate(s.period_end)}</>
                      )}
                    </p>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground italic">"{s.notes}"</p>
                    )}
                  </div>
                  <div className="text-right text-xs shrink-0 space-y-0.5">
                    <p className="font-bold text-primary">{fmtBRL(isOwner ? s.owner_amount : s.seller_amount)}</p>
                    <p className="text-muted-foreground">{partnerName}: {fmtBRL(isOwner ? s.seller_amount : s.owner_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disputed settlements notice */}
      {settlements.some(s => s.status === "disputed") && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Há {settlements.filter(s => s.status === "disputed").length} proposta(s) contestada(s).
            Entre em contato com {partnerName} para resolver e propor um novo acerto.
          </span>
        </div>
      )}

      {/* Propose Dialog */}
      <Dialog open={showProposeDialog} onOpenChange={setShowProposeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Propor Acerto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendas no período</span>
                <span className="font-medium">{splits.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Meu total ({isOwner ? "Dono" : "Vendedora"})</span>
                <span className="font-bold text-primary">{fmtBRL(myPendingAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{partnerName}</span>
                <span className="font-medium">{fmtBRL(partnerPendingAmount)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg border border-muted bg-muted/30 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {partnerName} receberá a proposta e precisará confirmar. O painel zera para ambos somente após a confirmação.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea
                placeholder="Ex: Transferência via PIX realizada..."
                value={proposeNotes}
                onChange={e => setProposeNotes(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProposeDialog(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handlePropose} disabled={isSaving} className="gap-2">
              <Send className="h-4 w-4" />
              {isSaving ? "Enviando..." : "Enviar Proposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Contestar Acerto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da contestação. {partnerName} será notificado e precisará propor um novo acerto.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo da contestação (opcional)</Label>
              <Textarea
                placeholder="Ex: Valores não batem com o meu controle..."
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisputeDialog(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDispute} disabled={isSaving} className="gap-2">
              <XCircle className="h-4 w-4" />
              {isSaving ? "Registrando..." : "Registrar Contestação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
