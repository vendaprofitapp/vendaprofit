import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Clock, RotateCcw, ShoppingBag, MessageCircle, ShoppingCart } from "lucide-react";

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
  payment_fee_applied?: number;
}

interface Props {
  sales: Sale[];
  onUpdated: () => void;
  paymentReceiver?: string | null;
  partnerPointId?: string;
  partnerName?: string;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Map pass_color to emoji indicator
const PASS_COLOR_EMOJI: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  blue: "🔵",
  purple: "🟣",
  gray: "⚫",
};

export function PartnerSalesQueue({ sales, onUpdated, paymentReceiver, partnerPointId, partnerName }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const pending = sales.filter(s => s.pass_status === "pending");
  const isSellerPayment = paymentReceiver === "seller";

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
        const isLoading = loading === sale.id;
        const createdAt = new Date(sale.created_at);
        const hoursElapsed = (Date.now() - createdAt.getTime()) / 3_600_000;
        const isOverdue24h = sale.pass_color === "blue" && hoursElapsed >= 24;
        const passEmoji = PASS_COLOR_EMOJI[sale.pass_color] ?? "⚪";
        const feeApplied = sale.payment_fee_applied;

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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className="text-xs py-0">
                      {passEmoji} {sale.payment_method}
                    </Badge>
                    {typeof feeApplied === "number" && feeApplied > 0 && (
                      <span className="text-xs text-muted-foreground">taxa {feeApplied}%</span>
                    )}
                    {isOverdue24h && (
                      <Badge variant="destructive" className="text-xs py-0">
                        Prazo expirado
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
                      <span>{item.product_name} × {item.quantity}</span>
                      <span>{fmtBRL(item.unit_price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions based on payment_receiver and pass_color */}
              <div className="flex gap-2 flex-wrap pt-1 border-t">
                {isSellerPayment ? (
                  /* Vendedora: cliente paga direto → Converter em Venda + WhatsApp */
                  <>
                    <Button
                      size="sm"
                      className="gap-1.5 flex-1"
                      disabled={isLoading}
                      onClick={() => {
                        const keysToClean = [
                          "sales_cart", "sales_customerName", "sales_customerPhone", "sales_instagram",
                          "sales_paymentMethodId", "sales_discountType", "sales_discountValue",
                          "sales_notes", "sales_dueDate", "sales_installments", "sales_installmentDetails",
                          "sales_shippingData",
                        ];
                        keysToClean.forEach(k => sessionStorage.removeItem(k));
                        navigate("/sales", {
                          state: {
                            fromPartnerPointOrder: true,
                            partnerPointSaleId: sale.id,
                            customer_name: sale.customer_name,
                            customer_phone: sale.customer_phone,
                            payment_method: sale.payment_method,
                            items: Array.isArray(sale.items) ? sale.items : [],
                            total: sale.total_gross,
                            partner_name: partnerName ?? "",
                            rack_commission_pct: 0,
                          },
                        });
                      }}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Converter em Venda
                    </Button>
                    {sale.customer_phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 px-3"
                        disabled={isLoading}
                        asChild
                      >
                        <a
                          href={`https://wa.me/55${sale.customer_phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </>
                ) : (
                  /* Ponto Parceiro: parceiro recebe e repassa → lógica original */
                  <>
                    {sale.pass_color === "green" && (
                      <Button size="sm" className="gap-1.5 flex-1" disabled={isLoading} onClick={() => validate(sale, "completed")}>
                        <CheckCircle2 className="h-4 w-4" />
                        {isLoading ? "Salvando..." : "Confirmar Recebimento"}
                      </Button>
                    )}
                    {sale.pass_color === "yellow" && (
                      <Button size="sm" className="gap-1.5 flex-1" disabled={isLoading} onClick={() => validate(sale, "validated")}>
                        <CheckCircle2 className="h-4 w-4" />
                        {isLoading ? "Salvando..." : "Confirmar Recebimento no Ponto Parceiro"}
                      </Button>
                    )}
                    {sale.pass_color === "blue" && (
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
                    {sale.pass_color === "purple" && (
                      <Button size="sm" className="gap-1.5 flex-1" disabled={isLoading} onClick={() => validate(sale, "completed")}>
                        <ShoppingBag className="h-4 w-4" />
                        {isLoading ? "Salvando..." : "Confirmar Encomenda"}
                      </Button>
                    )}
                    {sale.pass_color === "gray" && (
                      <Button size="sm" className="gap-1.5 flex-1" disabled={isLoading} onClick={() => validate(sale, "completed")}>
                        <CheckCircle2 className="h-4 w-4" />
                        {isLoading ? "Salvando..." : "Confirmar Pagamento Local"}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
