import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Share2, TrendingUp, Banknote, Store, ChevronDown, ChevronUp } from "lucide-react";
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
  sales?: {
    customer_name: string | null;
    payment_method: string | null;
    total: number;
    subtotal: number;
    created_at?: string | null;
    sale_items?: { cost_price: number | null; quantity: number }[];
  };
}

interface Connection {
  commission_pct: number;
  owner_id: string;
  seller_id: string | null;
  invited_email: string;
  owner_profile?: { full_name: string } | null;
  seller_profile?: { full_name: string } | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function SaleDetailRow({ split, isOwner, ownerName, sellerName }: {
  split: Split;
  isOwner: boolean;
  ownerName: string;
  sellerName: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const saleTotal = split.sales?.total ?? 0;
  // gross_profit = effectiveRevenue - cost. cost = owner_amount - commission_amount
  const grossProfit = split.gross_profit;
  const commission = split.commission_amount;
  // costPrice = owner_amount - commission_amount (owner gets cost + commission)
  const costPrice = split.owner_amount - split.commission_amount;
  const feesAndShipping = split.fee_amount + split.shipping_amount;
  // sellerGross = grossProfit - commission (before fees/shipping)
  const sellerGross = grossProfit - commission;
  const sellerNet = split.seller_amount;

  return (
    <div className="border rounded-lg text-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {split.sales?.customer_name || "—"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs py-0">
              {split.sales?.payment_method || "—"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(split.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <div className="text-right text-xs">
            <p className="font-medium">{fmtBRL(saleTotal)}</p>
            <p className="text-muted-foreground">
              {isOwner ? `Dono: ${fmtBRL(split.owner_amount)}` : `Seu líquido: ${fmtBRL(sellerNet)}`}
            </p>
          </div>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 border-t bg-muted/20">
          <div className="pt-2 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receita Efetiva (c/ desconto)</span>
              <span className="font-medium">{fmtBRL(grossProfit + costPrice)}</span>
            </div>
            <div className="flex justify-between text-destructive/80">
              <span>(-) Custo do Produto</span>
              <span>-{fmtBRL(costPrice)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Lucro Bruto Total</span>
              <span>{fmtBRL(grossProfit)}</span>
            </div>
            <div className="flex justify-between text-destructive/80">
              <span>(-) Comissão {ownerName} ({split.commission_pct}%)</span>
              <span>-{fmtBRL(commission)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Lucro Bruto {sellerName} (após comissão)</span>
              <span>{fmtBRL(sellerGross)}</span>
            </div>
            {feesAndShipping > 0 && (
              <div className="flex justify-between text-destructive/80">
                <span>(-) Taxas + Frete (vendedora)</span>
                <span>-{fmtBRL(feesAndShipping)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-primary">
              <span>Lucro Líquido {sellerName}</span>
              <span>{fmtBRL(sellerNet)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Total {ownerName} (Dono)</span>
              <span>{fmtBRL(split.owner_amount)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
        .select("commission_pct, owner_id, seller_id, invited_email")
        .eq("id", connectionId!)
        .maybeSingle(),
      supabase
        .from("hub_sale_splits")
        .select("*, sales(customer_name, payment_method, total, subtotal, created_at)")
        .eq("connection_id", connectionId!)
        .order("created_at", { ascending: false }),
    ]);

    if (connRes.data) {
      const conn = connRes.data as any;
      // Fetch profiles for owner and seller
      const ids = [conn.owner_id, conn.seller_id].filter(Boolean);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      setConnection({
        ...conn,
        owner_profile: pm.get(conn.owner_id) ?? null,
        seller_profile: conn.seller_id ? (pm.get(conn.seller_id) ?? null) : null,
      });
    }
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

  const ownerName = connection?.owner_profile?.full_name || "Dono";
  const sellerName = connection?.seller_profile?.full_name || connection?.invited_email || "Vendedora";

  const partnerDisplayName = isOwner ? sellerName : ownerName;

  const sendWhatsApp = () => {
    toast.info("Copie o extrato do relatório para enviar.");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Acerto HUB — {partnerDisplayName}</DialogTitle>
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

              {/* Period breakdown */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold">Resumo do período</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lucro bruto total</span>
                      <span className="font-medium">{fmtBRL(totals.gross)}</span>
                    </div>
                    <div className="flex justify-between text-destructive/80">
                      <div className="flex items-center gap-1">
                        <Store className="h-3.5 w-3.5" />
                        <span>Comissão {ownerName} ({connection?.commission_pct ?? 0}%)</span>
                      </div>
                      <span>-{fmtBRL(totals.commission)}</span>
                    </div>
                    <div className="flex justify-between text-destructive/80">
                      <span>Taxas + Frete (vendedora)</span>
                      <span>-{fmtBRL(totals.fees)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-primary">
                      <span>Líquido {isOwner ? ownerName : sellerName} ({isOwner ? "Dono" : "Vendedora"})</span>
                      <span>{fmtBRL(myTotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground text-xs">
                      <span>{partnerDisplayName}</span>
                      <span>{fmtBRL(partnerTotal)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Per-sale breakdown */}
              {filtered.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Vendas do período (clique para detalhes)
                  </p>
                  {filtered.map((s) => (
                    <SaleDetailRow
                      key={s.id}
                      split={s}
                      isOwner={isOwner}
                      ownerName={ownerName}
                      sellerName={sellerName}
                    />
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
