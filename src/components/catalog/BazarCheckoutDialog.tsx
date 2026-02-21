import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Truck, CheckCircle, ArrowLeft } from "lucide-react";

interface ShippingOption {
  carrier: string;
  service: string;
  service_id: number | null;
  price: number;
  delivery_days: number;
  source: string;
}

interface BazarCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  ownerId: string;
  primaryColor?: string;
}

export function BazarCheckoutDialog({ open, onOpenChange, item, ownerId, primaryColor = "#8B5CF6" }: BazarCheckoutDialogProps) {
  const [step, setStep] = useState<"buyer" | "shipping" | "summary" | "done">("buyer");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerZip, setBuyerZip] = useState("");
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [confirming, setConfirming] = useState(false);

  const itemPrice = Number(item.final_price || item.seller_price);
  const total = itemPrice + (selectedShipping?.price || 0);

  const handleQuoteShipping = async () => {
    const cleanZip = buyerZip.replace(/\D/g, "");
    if (!buyerName.trim() || !buyerPhone.trim() || cleanZip.length !== 8) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }

    setLoadingShipping(true);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 15000);

    try {
      const { data, error } = await supabase.functions.invoke("quote-bazar-shipping", {
        body: {
          owner_id: ownerId,
          origin_zip: item.seller_zip,
          destination_zip: cleanZip,
          weight_grams: item.weight_grams,
          width_cm: item.width_cm,
          height_cm: item.height_cm,
          length_cm: item.length_cm,
        },
      });

      clearTimeout(timeoutId);

      if (abortController.signal.aborted) {
        toast.error("O cálculo de frete demorou demasiado. Tente novamente.");
        return;
      }

      if (error) throw error;

      const options = data?.options || [];
      if (options.length === 0) {
        toast.error("Não foi possível calcular o frete para este CEP");
        return;
      }

      setShippingOptions(options);
      setStep("shipping");
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError" || abortController.signal.aborted) {
        toast.error("O cálculo de frete demorou demasiado. Tente novamente.");
      } else {
        toast.error(err.message || "Erro ao calcular frete");
      }
    } finally {
      setLoadingShipping(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedShipping) return;
    setConfirming(true);

    try {
      const { data, error } = await supabase.functions.invoke("checkout-bazar", {
        body: {
          bazar_item_id: item.id,
          buyer_name: buyerName.trim(),
          buyer_phone: buyerPhone.trim(),
          buyer_zip: buyerZip.replace(/\D/g, ""),
          shipping_cost: selectedShipping.price,
          shipping_carrier: selectedShipping.carrier,
          shipping_service: selectedShipping.service,
          shipping_source: selectedShipping.source,
          shipping_service_id: selectedShipping.service_id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao finalizar");

      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar compra");
    } finally {
      setConfirming(false);
    }
  };

  const resetAndClose = () => {
    setStep("buyer");
    setBuyerName("");
    setBuyerPhone("");
    setBuyerZip("");
    setShippingOptions([]);
    setSelectedShipping(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== "buyer" && step !== "done" && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setStep(step === "summary" ? "shipping" : "buyer")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === "buyer" && "Seus dados"}
            {step === "shipping" && "Escolha o frete"}
            {step === "summary" && "Resumo da compra"}
            {step === "done" && "Compra confirmada!"}
          </DialogTitle>
        </DialogHeader>

        {/* Item preview */}
        {step !== "done" && (
          <div className="flex gap-3 p-3 rounded-lg bg-muted/30 border">
            {item.image_url && <img src={item.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{item.title}</p>
              <p className="text-sm font-bold" style={{ color: primaryColor }}>
                R$ {itemPrice.toFixed(2).replace(".", ",")}
              </p>
            </div>
          </div>
        )}

        {/* Step: buyer data */}
        {step === "buyer" && (
          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" />
            </div>
            <div>
              <Label>CEP de entrega</Label>
              <Input value={buyerZip} onChange={(e) => setBuyerZip(e.target.value)} placeholder="00000-000" inputMode="numeric" maxLength={9} />
            </div>
            <Button className="w-full" style={{ backgroundColor: primaryColor }} onClick={handleQuoteShipping} disabled={loadingShipping}>
              {loadingShipping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
              Calcular Frete
            </Button>
          </div>
        )}

        {/* Step: shipping options */}
        {step === "shipping" && (
          <div className="space-y-2">
            {shippingOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => { setSelectedShipping(opt); setStep("summary"); }}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-semibold">{opt.carrier} - {opt.service}</p>
                  <p className="text-xs text-muted-foreground">{opt.delivery_days} dias úteis • {opt.source}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: primaryColor }}>
                  R$ {opt.price.toFixed(2).replace(".", ",")}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step: summary */}
        {step === "summary" && selectedShipping && (
          <div className="space-y-3">
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span>Valor da peça:</span>
                <span>R$ {itemPrice.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Frete ({selectedShipping.carrier}):</span>
                <span>R$ {selectedShipping.price.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-bold">
                <span>Total:</span>
                <span style={{ color: primaryColor }}>R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">Separação de valores:</p>
              <div className="flex justify-between">
                <span>Valor do vendedor:</span>
                <span>R$ {Number(item.seller_price).toFixed(2).replace(".", ",")}</span>
              </div>
              {item.store_commission != null && Number(item.store_commission) > 0 && (
                <div className="flex justify-between">
                  <span>Comissão da loja:</span>
                  <span>R$ {Number(item.store_commission).toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Frete:</span>
                <span>R$ {selectedShipping.price.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            <Button className="w-full" style={{ backgroundColor: primaryColor }} onClick={handleConfirm} disabled={confirming}>
              {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmar Compra
            </Button>
          </div>
        )}

        {/* Step: done */}
        {step === "done" && (
          <div className="text-center space-y-4 py-4">
            <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `${primaryColor}20` }}>
              <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Compra confirmada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                A loja irá preparar o envio da sua peça. Você receberá atualizações pelo WhatsApp.
              </p>
            </div>
            <Button className="w-full" style={{ backgroundColor: primaryColor }} onClick={resetAndClose}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
