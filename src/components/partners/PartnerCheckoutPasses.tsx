import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Copy, Home, Store } from "lucide-react";

interface CartItem {
  partner_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface AllowedMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
  min_amount?: number;
}

interface PartnerPoint {
  id: string;
  name: string;
  owner_id: string;
  payment_fee_pct: number;
  payment_receiver?: string;
  allowed_payment_methods?: AllowedMethod[];
}

interface PartnerCheckoutPassesProps {
  cartItems: CartItem[];
  partnerPoint: PartnerPoint;
  pixKey?: string;
  whatsappNumber?: string;
  initialName?: string;
  initialPhone?: string;
  onCustomerCaptured?: (name: string, phone: string) => void;
  onCheckoutComplete: () => void;
}

const PASS_CONFIG: Record<string, { colorClass: string; label: string }> = {
  pix:            { colorClass: "bg-green-600",  label: "🟢 Passe Verde — PIX" },
  card:           { colorClass: "bg-yellow-500", label: "🟡 Passe Amarelo — Cartão" },
  try_home:       { colorClass: "bg-blue-600",   label: "🔵 Passe Azul — Provar em Casa 24h" },
  pay_at_partner: { colorClass: "bg-gray-700",   label: "⚫ Passe — Pagar no Local" },
};

export function PartnerCheckoutPasses({
  cartItems, partnerPoint, pixKey, whatsappNumber, initialName, initialPhone, onCustomerCaptured, onCheckoutComplete
}: PartnerCheckoutPassesProps) {
  const paymentReceiver = partnerPoint.payment_receiver ?? "partner";
  const allowedMethods = partnerPoint.allowed_payment_methods ?? [];

  const hasPrefilledData = !!(initialName && initialPhone);

  // If data is prefilled: seller → "method", partner → "info" (will be skipped via useEffect)
  const initialStep = hasPrefilledData && paymentReceiver !== "partner" ? "method" : "info";

  const [step, setStep] = useState<"info" | "method" | "pass">(initialStep);
  const [customerName, setCustomerName] = useState(initialName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialPhone ?? "");
  // For seller mode: id of selected AllowedMethod; for partner mode: "pay_at_partner"
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [termAccepted, setTermAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passData, setPassData] = useState<{ code: string; passKey: string; methodName: string; isDeferred: boolean } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  // If data is prefilled and mode is partner, skip info step and confirm sale immediately
  useEffect(() => {
    if (hasPrefilledData && paymentReceiver === "partner") {
      handleConfirmSale("pay_at_partner", 0, null, false, initialName!, initialPhone!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalGross = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleConfirmInfo = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Preencha seu nome e WhatsApp.");
      return;
    }
    // Notify parent to save the lead if not already captured
    onCustomerCaptured?.(customerName.trim(), customerPhone.trim());
    if (paymentReceiver === "partner") {
      // Skip method selection for partner-pays mode
      setSelectedMethodId("pay_at_partner");
      handleConfirmSale("pay_at_partner", 0, null, false);
      return;
    }
    setStep("method");
  };

  const handleConfirmMethod = () => {
    if (!selectedMethodId) { toast.error("Escolha uma forma de pagamento."); return; }
    const method = allowedMethods.find(m => m.id === selectedMethodId);
    const minAmount = method?.min_amount ?? 0;
    if (minAmount > 0 && totalGross < minAmount) {
      toast.error(`Valor mínimo para esta forma é ${fmtBRL(minAmount)}.`);
      return;
    }
    const isDeferred = method?.is_deferred ?? false;
    if (isDeferred && !termAccepted) { toast.error("Aceite o termo de responsabilidade."); return; }
    handleConfirmSale(selectedMethodId, method?.fee_percent ?? 0, selectedMethodId, isDeferred);
  };

  const handleConfirmSale = async (
    paymentMethodKey: string,
    feeApplied: number,
    customMethodId: string | null,
    isDeferred: boolean,
    overrideName?: string,
    overridePhone?: string,
  ) => {
    setLoading(true);
    const passCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const finalName = (overrideName ?? customerName).trim();
    const finalPhone = (overridePhone ?? customerPhone).trim();

    if (!finalName || !finalPhone) {
      setLoading(false);
      toast.error("Dados do cliente incompletos.");
      return;
    }

    // Determine pass color
    let passColor = "gray";
    let passKey = "pay_at_partner";
    const method = allowedMethods.find(m => m.id === paymentMethodKey);
    if (paymentReceiver === "partner") {
      passColor = "gray";
      passKey = "pay_at_partner";
    } else if (method) {
      if (method.is_deferred) { passColor = "blue"; passKey = "try_home"; }
      else if (method.fee_percent === 0) { passColor = "green"; passKey = "pix"; }
      else { passColor = "yellow"; passKey = "card"; }
    }

    const { error } = await supabase.from("partner_point_sales").insert({
      partner_point_id: partnerPoint.id,
      owner_id: partnerPoint.owner_id,
      customer_name: finalName,
      customer_phone: finalPhone,
      items: cartItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      total_gross: totalGross,
      payment_method: method?.name ?? paymentMethodKey,
      pass_color: passColor,
      pass_status: paymentReceiver === "partner" ? "validated" : "pending",
      notes: `Passe ${passCode}`,
      payment_fee_applied: feeApplied,
      custom_payment_method_id: customMethodId,
    });

    if (error) {
      setLoading(false);
      console.error("partner_point_sales insert error:", error);
      toast.error("Erro ao registrar venda. Tente novamente.");
      return;
    }

    // WhatsApp notification
    if (whatsappNumber) {
      const wNum = whatsappNumber.replace(/\D/g, "");
      const methodLabel = method?.name ?? (paymentReceiver === "partner" ? "Pagar no local" : paymentMethodKey);
      const itemLines = cartItems.map(i => `• ${i.product_name} (${i.quantity}x) — ${fmtBRL(i.unit_price)}`).join("\n");
      const msg = encodeURIComponent(
        `🛍️ *Nova venda no ${partnerPoint.name}!*\n\n${itemLines}\n\n*Total: ${fmtBRL(totalGross)}*\nPagamento: ${methodLabel}\nCliente: ${finalName} (${finalPhone})\nPasse: #${passCode}`
      );
      window.open(`https://wa.me/55${wNum}?text=${msg}`, "_blank");
    }

    setPassData({ code: passCode, passKey, methodName: method?.name ?? "Pagar no local", isDeferred });
    setStep("pass");
    setLoading(false);
  };

  const copyPixKey = () => {
    if (pixKey) {
      navigator.clipboard.writeText(pixKey);
      setPixCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  // Step: info
  if (step === "info") {
    return (
      <div className="space-y-4">
        <div className="border rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium">Resumo da sacola</p>
          {cartItems.map(item => (
            <div key={item.partner_item_id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.product_name} × {item.quantity}</span>
              <span>{fmtBRL(item.unit_price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span>{fmtBRL(totalGross)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Seu nome *</Label>
            <Input placeholder="Ex: Maria Silva" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Seu WhatsApp *</Label>
            <Input placeholder="(11) 99999-9999" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
          </div>
        </div>

        {paymentReceiver === "partner" && (
          <div className="flex items-center gap-2 bg-muted/40 border rounded-lg p-3">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              O pagamento será feito diretamente na recepção do <strong>{partnerPoint.name}</strong>.
            </p>
          </div>
        )}

        <Button className="w-full" disabled={loading} onClick={handleConfirmInfo}>
          {loading ? "Processando..." : "Continuar →"}
        </Button>
      </div>
    );
  }

  // Step: method (seller mode only)
  if (step === "method") {
    const selectedMethod = allowedMethods.find(m => m.id === selectedMethodId);
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">Como você quer pagar?</p>

        <div className="grid gap-2">
          {allowedMethods.map(method => {
            const isSelected = selectedMethodId === method.id;
            const minAmount = method.min_amount ?? 0;
            const isDisabled = minAmount > 0 && totalGross < minAmount;
            let colorBg = "bg-yellow-500";
            let emoji = "💳";
            if (method.is_deferred) { colorBg = "bg-blue-600"; emoji = "🏠"; }
            else if (method.fee_percent === 0) { colorBg = "bg-green-600"; emoji = "⚡"; }

            return (
              <Card
                key={method.id}
                className={`transition-all border-2 ${
                  isDisabled
                    ? "opacity-50 cursor-not-allowed border-transparent"
                    : isSelected
                      ? "border-primary bg-primary/5 cursor-pointer"
                      : "border-transparent cursor-pointer"
                }`}
                onClick={() => { if (!isDisabled) setSelectedMethodId(method.id); }}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${colorBg} flex items-center justify-center text-white text-sm shrink-0`}>
                    {emoji}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{method.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {method.is_deferred ? "Leve agora, pague depois" : method.fee_percent > 0 ? `Taxa: ${method.fee_percent}%` : "Sem taxa"}
                      {minAmount > 0 && <span className="ml-1">• Mínimo: {fmtBRL(minAmount)}</span>}
                    </p>
                    {isDisabled && (
                      <p className="text-xs text-destructive mt-0.5">
                        ⚠️ Seu pedido ({fmtBRL(totalGross)}) não atinge o valor mínimo
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedMethod?.is_deferred && (
          <div className="border border-border rounded-lg p-3 bg-muted/40 space-y-2">
            <p className="text-sm font-medium text-foreground">Termo de Responsabilidade</p>
            <p className="text-xs text-muted-foreground">
              Declaro que sou responsável pela(s) peça(s) retirada(s) e me comprometo a pagar ou devolver em perfeito estado no prazo combinado. Em caso de dano ou extravio, serei responsável pelo valor integral do produto.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="term" checked={termAccepted} onChange={e => setTermAccepted(e.target.checked)} className="rounded" />
              <label htmlFor="term" className="text-xs font-medium text-foreground cursor-pointer">Li e aceito o termo acima</label>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("info")} className="flex-1">← Voltar</Button>
          <Button onClick={handleConfirmMethod} disabled={loading || !selectedMethodId} className="flex-1">
            {loading ? "Processando..." : "Confirmar →"}
          </Button>
        </div>
      </div>
    );
  }

  // Step: pass
  if (!passData) return null;
  const passConfig = PASS_CONFIG[passData.passKey] ?? PASS_CONFIG["pay_at_partner"];

  return (
    <div className="space-y-4 text-center">
      <div className={`${passConfig.colorClass} rounded-2xl p-6 text-white`}>
        <p className="text-lg font-bold">{passConfig.label}</p>
        <p className="text-4xl font-mono font-black mt-2">#{passData.code}</p>
        <p className="text-sm mt-1 opacity-90">
          {paymentReceiver === "partner" ? "Mostre este código na recepção para retirar as peças" : "Mostre este código para confirmar seu pedido"}
        </p>
      </div>

      <div className="border rounded-lg p-3 text-left space-y-1">
        <p className="text-xs font-medium text-muted-foreground">RESUMO</p>
        {cartItems.map(i => (
          <div key={i.partner_item_id} className="flex justify-between text-sm">
            <span>{i.product_name} × {i.quantity}</span>
            <span>{fmtBRL(i.unit_price * i.quantity)}</span>
          </div>
        ))}
        <div className="border-t pt-1 flex justify-between font-bold text-sm">
          <span>Total</span>
          <span>{fmtBRL(totalGross)}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">Pagamento: {passData.methodName}</p>
      </div>

      {passData.passKey === "pix" && pixKey && (
        <div className="border rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium">Chave PIX</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted p-2 rounded break-all">{pixKey}</code>
            <Button variant="outline" size="sm" onClick={copyPixKey}>
              {pixCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Após pagar, envie o comprovante para a vendedora pelo WhatsApp.</p>
        </div>
      )}

      {passData.passKey === "card" && (
        <p className="text-sm text-muted-foreground">A vendedora receberá uma notificação e te enviará o link de pagamento em breve.</p>
      )}

      {passData.isDeferred && (
        <p className="text-sm text-orange-600 font-medium">⏱️ Você tem um prazo para pagar ou devolver as peças. Aguarde contato da vendedora.</p>
      )}

      {paymentReceiver === "partner" && (
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <Home className="h-4 w-4" />
          Dirija-se à recepção com este passe para retirar suas peças.
        </p>
      )}

      <Button className="w-full gap-2" onClick={onCheckoutComplete}>
        <CheckCircle2 className="h-4 w-4" />
        Concluído
      </Button>
    </div>
  );
}
