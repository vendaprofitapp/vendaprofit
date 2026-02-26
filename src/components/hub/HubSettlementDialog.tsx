import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Share2, TrendingUp, Banknote, Store } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  connectionId: string | null;
  onClose: () => void;
}

interface Split {
  id: string;
  sale_id: string;
  gross_profit: number;
  commission_pct: number;
  commission_amount: number;
  fee_amount: number;
  shipping_amount: number;
  owner_amount: number;
  seller_amount: number;
  created_at: string;
  sales?: { customer_name: string; payment_method: string; total: number };
}

interface Connection {
  commission_pct: number;
  owner_id: string;
  seller_id: string | null;
  invited_email: string;
  profiles?: { full_name: string } | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function HubSettlementDialog({ open, connectionId, onClose }: Props) {
  const { user } = useAuth();
  const [splits, setSplits] = useState<Split[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [period, setPeriod] = useState<"7" | "30" | "all">("30");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !connectionId) return;
    loadData();
  }, [open, connectionId]);

  const loadData = async () => {
    setLoading(true);
    const [connRes, splitsRes] = await Promise.all([
      supabase
        .from("hub_connections")
        .select("commission_pct, owner_id, seller_id, invited_email, profiles:seller_id(full_name)")
        .eq("id", connectionId!)
        .maybeSingle(),
      supabase
        .from("hub_sale_splits")
        .select("*, sales(customer_name, payment_method, total)")
        .eq("connection_id", connectionId!)
        .order("created_at", { ascending: false }),
    ]);

    if (connRes.data) setConnection(connRes.data as any);
    setSplits((splitsRes.data ?? []) as any);
    setLoading(false);
  };

  const isOwner = user?.id === connection?.owner_id;

  const now = Date.now();
  const filtered = splits.filter((s) => {
    if (period === "all") return true;
    const days = period === "30" ? 30 : 7;
    return now - new Date(s.created_at).getTime() <= days * 86_400_000;
  });

  const totals = filtered.reduce(
    (acc, s) => {
      acc.gross += s.gross_profit;
      acc.commission += s.commission_amount;
      acc.fees += s.fee_amount + s.shipping_amount;
      acc.ownerTotal += s.owner_amount;
      acc.sellerTotal += s.seller_amount;
      return acc;
    },
    { gross: 0, commission: 0, fees: 0, ownerTotal: 0, sellerTotal: 0 }
  );

  const myTotal = isOwner ? totals.ownerTotal : totals.sellerTotal;
  const partnerTotal = isOwner ? totals.sellerTotal : totals.ownerTotal;
  const partnerName = isOwner
    ? (connection?.profiles?.full_name || connection?.invited_email || "Vendedor")
    : "Dono do Estoque";

  const sendWhatsApp = () => {
    toast.info("Copie o extrato do relatório para enviar.");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Acerto HUB — {partnerName}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {(["7", "30", "all"] as const).map((p) => (
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

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <p className="text-sm text-center text-muted-foreground py-8">Carregando...</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Lucro bruto gerado</span>
                    </div>
                    <p className="text-lg font-bold">{fmtBRL(totals.gross)}</p>
                    <p className="text-xs text-muted-foreground">{filtered.length} venda(s)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Meu total</span>
                    </div>
                    <p className="text-lg font-bold text-primary">{fmtBRL(myTotal)}</p>
                    <p className="text-xs text-muted-foreground">Parceiro: {fmtBRL(partnerTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Breakdown */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold">Composição do período</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lucro bruto total</span>
                      <span className="font-medium">{fmtBRL(totals.gross)}</span>
                    </div>
                    <div className="flex justify-between text-destructive/80">
                      <div className="flex items-center gap-1">
                        <Store className="h-3.5 w-3.5" />
                        <span>Comissão dono ({connection?.commission_pct ?? 0}%)</span>
                      </div>
                      <span>-{fmtBRL(totals.commission)}</span>
                    </div>
                    <div className="flex justify-between text-destructive/80">
                      <span>Taxas + Frete (absorvidos pelo vendedor)</span>
                      <span>-{fmtBRL(totals.fees)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-primary">
                      <span>Meu total ({isOwner ? "Dono" : "Vendedor"})</span>
                      <span>{fmtBRL(myTotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground text-xs">
                      <span>{partnerName}</span>
                      <span>{fmtBRL(partnerTotal)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sales list */}
              {filtered.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Vendas do período
                  </p>
                  {filtered.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {(s.sales as any)?.customer_name || "—"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-xs py-0">
                            {(s.sales as any)?.payment_method || "—"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs space-y-0.5 shrink-0">
                        <p className="font-medium">{fmtBRL(s.gross_profit)} lucro bruto</p>
                        <p className="text-muted-foreground">
                          {isOwner ? `Dono: ${fmtBRL(s.owner_amount)}` : `Seu saldo: ${fmtBRL(s.seller_amount)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filtered.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
                </div>
              )}
            </>
          )}
        </div>

        <Button variant="outline" className="gap-2" onClick={sendWhatsApp} disabled={filtered.length === 0}>
          <Share2 className="h-4 w-4" />
          Compartilhar Extrato
        </Button>
      </DialogContent>
    </Dialog>
  );
}
