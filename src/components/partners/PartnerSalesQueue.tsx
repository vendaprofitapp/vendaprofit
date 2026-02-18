import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Clock, RotateCcw, ShoppingBag } from "lucide-react";

interface Sale {
  id: string;
  customer_name: string;
  customer_phone: string;
  total_gross: number;
  payment_method: string;
  pass_color: string;
  pass_status: string;
  created_at: string;
  items: any;
  notes: string | null;
}

interface Props {
  sales: Sale[];
  onUpdated: () => void;
}

const PASS_LABELS: Record<string, { label: string; emoji: string }> = {
  pix:            { label: "PIX",          emoji: "🟢" },
  card:           { label: "Cartão",       emoji: "🟡" },
  try_home:       { label: "Casa 24h",     emoji: "🔵" },
  infinite_shelf: { label: "Encomenda",    emoji: "🟣" },
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function PartnerSalesQueue({ sales, onUpdated }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const pending = sales.filter(s => s.pass_status === "pending");

  const validate = async (sale: Sale, newStatus: "validated" | "completed" | "returned") => {
    setLoading(sale.id);
    const { error } = await supabase
      .from("partner_point_sales")
      .update({ pass_status: newStatus })
      .eq("id", sale.id);
    if (error) toast.error("Erro ao atualizar status");
    else {
      toast.success(newStatus === "validated" ? "Venda validada!" : newStatus === "completed" ? "Venda concluída!" : "Devolução registrada!");
      onUpdated();
    }
    setLoading(null);
  };

  if (pending.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma venda aguardando validação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {pending.length} venda(s) aguardando validação
      </p>
      {pending.map(sale => {
        const pass = PASS_LABELS[sale.payment_method] ?? { label: sale.payment_method, emoji: "⚪" };
        const isLoading = loading === sale.id;
        const createdAt = new Date(sale.created_at);
        const hoursElapsed = (Date.now() - createdAt.getTime()) / 3_600_000;
        const isOverdue24h = sale.payment_method === "try_home" && hoursElapsed >= 24;

        return (
          <Card key={sale.id} className={isOverdue24h ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{sale.customer_name}</span>
                    <span className="text-xs text-muted-foreground">{sale.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs py-0">
                      {pass.emoji} {pass.label}
                    </Badge>
                    {isOverdue24h && (
                      <Badge variant="destructive" className="text-xs py-0">
                        Prazo 24h expirado
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtDate(sale.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-bold shrink-0">{fmtBRL(sale.total_gross)}</p>
              </div>

              {/* Items list */}
              {Array.isArray(sale.items) && sale.items.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                  {sale.items.map((item: any, idx: number) => (
                    <li key={idx} className="flex justify-between">
                      <span>{item.product_name} {item.selected_size ? `(${item.selected_size})` : ""} × {item.quantity}</span>
                      <span>{fmtBRL(item.unit_price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap pt-1 border-t">
                {sale.payment_method === "pix" && (
                  <Button size="sm" className="gap-1.5 flex-1" disabled={isLoading} onClick={() => validate(sale, "completed")}>
                    <CheckCircle2 className="h-4 w-4" />
                    {isLoading ? "Salvando..." : "Confirmar Recebimento PIX"}
                  </Button>
                )}
                {sale.payment_method === "card" && (
                  <Button size="sm" className="gap-1.5 flex-1" disabled={isLoading} onClick={() => validate(sale, "validated")}>
                    <CheckCircle2 className="h-4 w-4" />
                    {isLoading ? "Salvando..." : "Validar Pagamento"}
                  </Button>
                )}
                {sale.payment_method === "try_home" && (
                  <>
                    <Button size="sm" className="gap-1.5 flex-1" disabled={isLoading} onClick={() => validate(sale, "completed")}>
                      <CheckCircle2 className="h-4 w-4" />
                      {isLoading ? "Salvando..." : "Confirmar Compra"}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={isLoading} onClick={() => validate(sale, "returned")}>
                      <RotateCcw className="h-4 w-4" />
                      Devolvido
                    </Button>
                  </>
                )}
                {sale.payment_method === "infinite_shelf" && (
                  <Button size="sm" className="gap-1.5 flex-1" disabled={isLoading} onClick={() => validate(sale, "completed")}>
                    <ShoppingBag className="h-4 w-4" />
                    {isLoading ? "Salvando..." : "Confirmar Encomenda"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
