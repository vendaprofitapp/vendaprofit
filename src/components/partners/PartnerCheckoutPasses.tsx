import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Copy, CreditCard, Home } from "lucide-react";

interface CartItem {
  partner_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface PartnerPoint {
  id: string;
  name: string;
  owner_id: string;
  payment_fee_pct: number;
}

interface PartnerCheckoutPassesProps {
  cartItems: CartItem[];
  partnerPoint: PartnerPoint;
  pixKey?: string;
  whatsappNumber?: string;
  onCheckoutComplete: () => void;
}

type PaymentMethod = "pix" | "card" | "try_home" | null;

const PASS_CONFIG = {
  pix:      { colorClass: "bg-green-600",  label: "🟢 Passe Verde — PIX" },
  card:     { colorClass: "bg-yellow-500", label: "🟡 Passe Amarelo — Cartão" },
  try_home: { colorClass: "bg-blue-600",   label: "🔵 Passe Azul — Provar em Casa 24h" },
};

export function PartnerCheckoutPasses({
  cartItems, partnerPoint, pixKey, whatsappNumber, onCheckoutComplete
}: PartnerCheckoutPassesProps) {
  const [step, setStep] = useState<"info" | "method" | "pass">("info");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [method, setMethod] = useState<PaymentMethod>(null);
  const [termAccepted, setTermAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passData, setPassData] = useState<{ code: string; method: PaymentMethod } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  const totalGross = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleConfirmInfo = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Preencha seu nome e WhatsApp.");
      return;
    }
    setStep("method");
  };

  const handleConfirmMethod = async () => {
    if (!method) { toast.error("Escolha uma forma de pagamento."); return; }
    if (method === "try_home" && !termAccepted) { toast.error("Aceite o termo de responsabilidade."); return; }

    setLoading(true);
    const passCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const passColorMap: Record<string, string> = { pix: "green", card: "yellow", try_home: "blue" };

    const { error } = await supabase.from("partner_point_sales").insert({
      partner_point_id: partnerPoint.id,
      owner_id: partnerPoint.owner_id,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      items: cartItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      total_gross: totalGross,
      payment_method: method,
      pass_color: passColorMap[method],
      pass_status: "pending",
      notes: `Passe ${passCode}`,
    });

    if (error) {
      setLoading(false);
      toast.error("Erro ao registrar venda. Tente novamente.");
      return;
    }

    // Notify seller via WhatsApp if configured
    if (whatsappNumber) {
      const wNum = whatsappNumber.replace(/\D/g, "");
      const methodLabels: Record<string, string> = { pix: "PIX", card: "Cartão", try_home: "Provar em Casa 24h" };
      const itemLines = cartItems.map(i => `• ${i.product_name} (${i.quantity}x) — ${fmtBRL(i.unit_price)}`).join("\n");
      const msg = encodeURIComponent(
        `🛍️ *Nova venda no ${partnerPoint.name}!*\n\n${itemLines}\n\n*Total: ${fmtBRL(totalGross)}*\nPagamento: ${methodLabels[method]}\nCliente: ${customerName} (${customerPhone})\nPasse: #${passCode}`
      );
      window.open(`https://wa.me/55${wNum}?text=${msg}`, "_blank");
    }

    setPassData({ code: passCode, method });
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

        <Button className="w-full" onClick={handleConfirmInfo}>Continuar →</Button>
      </div>
    );
  }

  if (step === "method") {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">Como você quer pagar?</p>

        <div className="grid gap-2">
          <Card
            className={`cursor-pointer transition-all border-2 ${method === "pix" ? "border-primary bg-primary/5" : "border-transparent"}`}
            onClick={() => setMethod("pix")}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold shrink-0">PIX</div>
              <div>
                <p className="font-medium text-sm">Pagar Agora — PIX</p>
                <p className="text-xs text-muted-foreground">Receba o QR Code / chave PIX</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all border-2 ${method === "card" ? "border-primary bg-primary/5" : "border-transparent"}`}
            onClick={() => setMethod("card")}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Pagar no Cartão</p>
                <p className="text-xs text-muted-foreground">A vendedora te envia o link de pagamento</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all border-2 ${method === "try_home" ? "border-primary bg-primary/5" : "border-transparent"}`}
            onClick={() => setMethod("try_home")}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Home className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-sm">Provar em Casa — 24h</p>
                <p className="text-xs text-muted-foreground">Leve, prove, pague em 24h</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {method === "try_home" && (
          <div className="border border-border rounded-lg p-3 bg-muted/40 space-y-2">
            <p className="text-sm font-medium text-foreground">Termo de Responsabilidade</p>
            <p className="text-xs text-muted-foreground">
              Declaro que sou responsável pela(s) peça(s) retirada(s) e me comprometo a pagar ou devolver em perfeito estado em até 24 horas. Em caso de dano ou extravio, serei responsável pelo valor integral do produto.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="term" checked={termAccepted} onChange={e => setTermAccepted(e.target.checked)} className="rounded" />
              <label htmlFor="term" className="text-xs font-medium text-foreground cursor-pointer">Li e aceito o termo acima</label>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("info")} className="flex-1">← Voltar</Button>
          <Button onClick={handleConfirmMethod} disabled={loading || !method} className="flex-1">
            {loading ? "Processando..." : "Confirmar →"}
          </Button>
        </div>
      </div>
    );
  }

  // Step: pass
  if (!passData) return null;
  const passConfig = PASS_CONFIG[passData.method!];

  return (
    <div className="space-y-4 text-center">
      <div className={`${passConfig.colorClass} rounded-2xl p-6 text-white`}>
        <p className="text-lg font-bold">{passConfig.label}</p>
        <p className="text-4xl font-mono font-black mt-2">#{passData.code}</p>
        <p className="text-sm mt-1 opacity-90">Mostre este código na recepção</p>
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
      </div>

      {passData.method === "pix" && pixKey && (
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

      {passData.method === "card" && (
        <p className="text-sm text-muted-foreground">A vendedora receberá uma notificação e te enviará o link de pagamento em breve.</p>
      )}

      {passData.method === "try_home" && (
        <p className="text-sm text-orange-600 font-medium">⏱️ Você tem 24 horas para pagar ou devolver as peças.</p>
      )}

      <Button className="w-full gap-2" onClick={onCheckoutComplete}>
        <CheckCircle2 className="h-4 w-4" />
        Concluído
      </Button>
    </div>
  );
}
