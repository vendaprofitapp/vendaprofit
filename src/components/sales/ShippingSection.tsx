import { useState, useEffect } from "react";
import { Package, Truck, Car, FileText, AlertTriangle, MapPin, Search, Loader2, Settings, Download, FileCheck, MessageCircle, Copy } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export interface ShippingData {
  method: string; // "presencial" | "postagem" | "app" | "outros"
  company: string;
  cost: number;
  payer: string; // "seller" | "buyer"
  address: string;
  notes: string;
}

interface CustomerAddress {
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
}

export interface ShippingQuoteProduct {
  weight_grams: number;
  width_cm: number;
  height_cm: number;
  length_cm: number;
  quantity: number;
}

export interface ShippingConfig {
  origin_zip?: string | null;
  melhor_envio_token?: string | null;
  superfrete_token?: string | null;
}

interface ShippingOption {
  carrier: string;
  service: string;
  service_id?: number | null;
  price: number;
  delivery_days: number;
  source: string;
}

interface ShippingSectionProps {
  value: ShippingData;
  onChange: (data: ShippingData) => void;
  customerAddress?: CustomerAddress | null;
  shippingConfig?: ShippingConfig | null;
  quoteProducts?: ShippingQuoteProduct[];
  saleId?: string;
  customerName?: string;
  customerPhone?: string;
  shippingLabelUrl?: string | null;
  onLabelGenerated?: (labelUrl: string) => void;
  onTrackingGenerated?: (tracking: string, labelUrl: string) => void;
}

const methodOptions = [
  { value: "presencial", label: "Presencial", icon: Package, description: "Entrega em mãos" },
  { value: "postagem", label: "Postagem", icon: Truck, description: "Correios, Jadlog, etc" },
  { value: "app", label: "Aplicativos", icon: Car, description: "Uber, 99, etc" },
  { value: "outros", label: "Outros", icon: FileText, description: "Outra forma de envio" },
];

function formatCustomerAddress(addr: CustomerAddress): string {
  const parts: string[] = [];
  if (addr.address_street) {
    let line = addr.address_street;
    if (addr.address_number) line += `, ${addr.address_number}`;
    if (addr.address_complement) line += ` - ${addr.address_complement}`;
    parts.push(line);
  }
  if (addr.address_neighborhood) parts.push(addr.address_neighborhood);
  const cityState: string[] = [];
  if (addr.address_city) cityState.push(addr.address_city);
  if (addr.address_state) cityState.push(addr.address_state);
  if (cityState.length > 0) parts.push(cityState.join(" - "));
  if (addr.address_zip) parts.push(`CEP: ${addr.address_zip}`);
  return parts.join(", ");
}

function hasAddress(addr?: CustomerAddress | null): boolean {
  if (!addr) return false;
  return !!(addr.address_street || addr.address_city || addr.address_zip);
}

export function ShippingSection({ value, onChange, customerAddress, shippingConfig, quoteProducts, saleId, customerName, customerPhone, shippingLabelUrl, onLabelGenerated, onTrackingGenerated }: ShippingSectionProps) {
  const [addressOpen, setAddressOpen] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quoteOptions, setQuoteOptions] = useState<ShippingOption[]>([]);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState<number | null>(null);
  const [manualWeight, setManualWeight] = useState<number>(0);
  const [manualWidth, setManualWidth] = useState<number>(0);
  const [manualHeight, setManualHeight] = useState<number>(0);
  const [manualLength, setManualLength] = useState<number>(0);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [generatedTracking, setGeneratedTracking] = useState<string | null>(null);
  const [generatedLabelUrl, setGeneratedLabelUrl] = useState<string | null>(null);

  // Auto-fill address when customer has one
  useEffect(() => {
    if (hasAddress(customerAddress) && (value.method === "postagem" || value.method === "app") && !value.address) {
      onChange({ ...value, address: formatCustomerAddress(customerAddress!) });
    }
  }, [customerAddress, value.method]);

  // Reset quote when method changes
  useEffect(() => {
    setQuoteOptions([]);
    setQuoteError(null);
    setSelectedQuoteIndex(null);
  }, [value.method]);

  const showDetails = value.method === "postagem" || value.method === "app";
  const showOtherDetails = value.method === "outros";

  const hasTokens = !!(shippingConfig?.melhor_envio_token || shippingConfig?.superfrete_token);
  const hasOriginZip = !!shippingConfig?.origin_zip;
  const destinationZip = customerAddress?.address_zip?.replace(/\D/g, "");
  const hasManualDimensions = manualWeight > 0 && manualWidth > 0 && manualHeight > 0 && manualLength > 0;
  const hasProductDimensions = quoteProducts && quoteProducts.length > 0;
  const canQuote = value.method === "postagem" && hasTokens && hasOriginZip && !!destinationZip && (hasProductDimensions || hasManualDimensions);

  const handleQuote = async () => {
    if (!canQuote) return;
    setQuoting(true);
    setQuoteError(null);
    setQuoteOptions([]);
    setSelectedQuoteIndex(null);

    try {
      const productsToQuote = hasProductDimensions ? quoteProducts : [{
        weight_grams: manualWeight,
        width_cm: manualWidth,
        height_cm: manualHeight,
        length_cm: manualLength,
        quantity: 1,
      }];

      const { data, error } = await supabase.functions.invoke("quote-shipping", {
        body: {
          origin_zip: shippingConfig!.origin_zip!.replace(/\D/g, ""),
          destination_zip: destinationZip,
          products: productsToQuote,
          melhor_envio_token: shippingConfig!.melhor_envio_token || null,
          superfrete_token: shippingConfig!.superfrete_token || null,
        },
      });

      if (error) throw error;

      if (data?.options && data.options.length > 0) {
        setQuoteOptions(data.options);
      } else {
        setQuoteError(data?.error || "Não foi possível obter cotações. Insira o valor manualmente.");
      }
    } catch (err: any) {
      console.error("Quote error:", err);
      setQuoteError("Erro ao cotar frete. Tente novamente ou insira o valor manualmente.");
    } finally {
      setQuoting(false);
    }
  };

  const selectQuoteOption = (index: number) => {
    const option = quoteOptions[index];
    setSelectedQuoteIndex(index);
    onChange({
      ...value,
      company: `${option.carrier} - ${option.service}`,
      cost: option.price,
    });
  };

  const handlePurchaseShipping = async () => {
    if (!value.company || !value.cost || selectedQuoteIndex === null) return;

    setPurchasing(true);
    setPurchaseError(null);

    try {
      const selectedOption = quoteOptions[selectedQuoteIndex];
      const body: any = {
        shipping_company: value.company,
        shipping_source: selectedOption?.source || "",
        shipping_service_id: selectedOption?.service_id || null,
        destination_zip: customerAddress?.address_zip?.replace(/\D/g, ""),
        origin_zip: shippingConfig?.origin_zip?.replace(/\D/g, ""),
        weight_grams: quoteProducts?.[0]?.weight_grams || manualWeight,
        width_cm: quoteProducts?.[0]?.width_cm || manualWidth,
        height_cm: quoteProducts?.[0]?.height_cm || manualHeight,
        length_cm: quoteProducts?.[0]?.length_cm || manualLength,
        customer_name: customerName,
        customer_phone: customerPhone,
        shipping_address: value.address,
        destination_city: customerAddress?.address_city || "",
        destination_state: customerAddress?.address_state || "",
        destination_street: customerAddress?.address_street || "",
        destination_number: customerAddress?.address_number || "",
        destination_complement: customerAddress?.address_complement || "",
        destination_neighborhood: customerAddress?.address_neighborhood || "",
      };

      if (saleId) {
        body.sale_id = saleId;
      }

      const { data, error } = await supabase.functions.invoke(
        "purchase-shipping",
        { body }
      );

      if (error) throw error;

      if (data?.label_url) {
        setGeneratedLabelUrl(data.label_url);
        onLabelGenerated?.(data.label_url);
      }
      if (data?.tracking) {
        setGeneratedTracking(data.tracking);
        onTrackingGenerated?.(data.tracking, data.label_url || "");
      }
    } catch (err: any) {
      console.error("Purchase error:", err);
      setPurchaseError(
        "Erro ao gerar etiqueta. Verifique se há saldo na sua conta."
      );
    } finally {
      setPurchasing(false);
    }
  };

  const currentLabelUrl = shippingLabelUrl || generatedLabelUrl;

  const handleSendWhatsApp = () => {
    if (!generatedTracking || !customerPhone) return;
    const phone = customerPhone.replace(/\D/g, "");
    const phoneFormatted = phone.startsWith("55") ? phone : `55${phone}`;
    const name = customerName || "Cliente";
    const message = encodeURIComponent(
      `Olá ${name}! Seu pedido foi enviado! 📦\n\nCódigo de rastreio: ${generatedTracking}\nAcompanhe em: https://www.linkcorreios.com.br/?id=${generatedTracking}\n\nQualquer dúvida, estou à disposição!`
    );
    window.open(`https://wa.me/${phoneFormatted}?text=${message}`, "_blank");
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Truck className="h-4 w-4" />
        Forma de Envio
      </Label>

      {/* Method Selection */}
      <div className="grid grid-cols-2 gap-2">
        {methodOptions.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value.method === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...value, method: opt.value, company: "", cost: 0, payer: "seller", address: hasAddress(customerAddress) && (opt.value === "postagem" || opt.value === "app") ? formatCustomerAddress(customerAddress!) : "", notes: "" })}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>{opt.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Postagem / App details */}
      {showDetails && (
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          {/* Address */}
          <div>
            <Label className="flex items-center gap-1 text-sm">
              <MapPin className="h-3 w-3" />
              Endereço de Entrega
            </Label>
            {hasAddress(customerAddress) && (
              <Badge variant="outline" className="text-xs mb-1 mt-1">
                Endereço do cliente preenchido automaticamente
              </Badge>
            )}
            <Textarea
              placeholder="Endereço completo de entrega..."
              value={value.address}
              onChange={(e) => onChange({ ...value, address: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Shipping Quote Section - only for "postagem" */}
          {value.method === "postagem" && (
            <div className="space-y-2">
              {!hasTokens && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Settings className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Configure seus tokens de frete em{" "}
                      <a href="/settings" className="text-primary underline">
                        Configurações
                      </a>{" "}
                      para usar a cotação automática.
                    </span>
                  </p>
                </div>
              )}

              {hasTokens && !hasOriginZip && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Settings className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Configure seu CEP de origem em{" "}
                      <a href="/settings" className="text-primary underline">
                        Configurações
                      </a>{" "}
                      para cotar frete.
                    </span>
                  </p>
                </div>
              )}

              {hasTokens && hasOriginZip && !destinationZip && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    O cliente precisa ter CEP cadastrado para cotação automática.
                  </p>
                </div>
              )}

              {hasTokens && hasOriginZip && destinationZip && !hasProductDimensions && (
                <div className="space-y-2 p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    Os produtos não têm peso/dimensões cadastrados. Informe manualmente para cotar:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Peso (g)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 500"
                        value={manualWeight || ""}
                        onChange={(e) => setManualWeight(Number(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Largura (cm)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 20"
                        value={manualWidth || ""}
                        onChange={(e) => setManualWidth(Number(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Altura (cm)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 10"
                        value={manualHeight || ""}
                        onChange={(e) => setManualHeight(Number(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Comprimento (cm)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 30"
                        value={manualLength || ""}
                        onChange={(e) => setManualLength(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {canQuote && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleQuote}
                  disabled={quoting}
                  className="w-full"
                >
                  {quoting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {quoting ? "Cotando..." : "Cotar Frete"}
                </Button>
              )}

              {quoteError && (
                <p className="text-xs text-destructive">{quoteError}</p>
              )}

              {/* Quote Results */}
              {quoteOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Selecione uma opção:</Label>
                  {quoteOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectQuoteOption(idx)}
                      className={`w-full p-2.5 rounded-lg border text-left transition-all text-sm ${
                        selectedQuoteIndex === idx
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium truncate block">
                            {opt.carrier} - {opt.service}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {opt.delivery_days > 0 ? `${opt.delivery_days} dias úteis` : "Prazo a consultar"} • via {opt.source}
                          </span>
                        </div>
                        <span className="font-semibold text-primary ml-2 whitespace-nowrap">
                          R$ {opt.price.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </button>
               ))}
                </div>
              )}

              {/* Purchase Label Section */}
              {quoteOptions.length > 0 && selectedQuoteIndex !== null && value.company && value.cost > 0 && (
                 <div className="space-y-2 p-3 bg-muted rounded-lg border border-primary/20">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-medium">Gerar Etiqueta</p>
                       <p className="text-xs text-muted-foreground">
                         Comprar frete e gerar etiqueta automática
                       </p>
                     </div>
                     {currentLabelUrl && (
                       <FileCheck className="h-5 w-5 text-primary" />
                     )}
                   </div>

                   {!currentLabelUrl && (
                     <Button
                       type="button"
                       size="sm"
                       onClick={handlePurchaseShipping}
                       disabled={purchasing}
                       className="w-full gap-2"
                     >
                       {purchasing ? (
                         <Loader2 className="h-4 w-4 animate-spin" />
                       ) : (
                         <FileCheck className="h-4 w-4" />
                       )}
                       {purchasing ? "Gerando..." : "Gerar Etiqueta"}
                     </Button>
                   )}

                   {purchaseError && (
                     <p className="text-xs text-destructive">{purchaseError}</p>
                   )}

                   {/* Tracking number display */}
                   {generatedTracking && (
                     <div className="p-2 bg-background rounded border">
                       <p className="text-xs text-muted-foreground">Código de rastreio:</p>
                       <div className="flex items-center gap-2">
                         <p className="text-sm font-mono font-semibold flex-1">{generatedTracking}</p>
                         <Button
                           type="button"
                           variant="ghost"
                           size="sm"
                           className="h-7 w-7 p-0"
                           onClick={() => {
                             navigator.clipboard.writeText(generatedTracking);
                           }}
                         >
                           <Copy className="h-3.5 w-3.5" />
                         </Button>
                       </div>
                     </div>
                   )}

                   {currentLabelUrl && (
                     <a
                       href={currentLabelUrl}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="w-full block"
                     >
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         className="w-full gap-2"
                       >
                         <Download className="h-4 w-4" />
                         Baixar Etiqueta
                       </Button>
                     </a>
                   )}

                   {/* WhatsApp button */}
                   {generatedTracking && customerPhone && (
                     <Button
                       type="button"
                       variant="outline"
                       size="sm"
                       onClick={handleSendWhatsApp}
                       className="w-full gap-2"
                     >
                       <MessageCircle className="h-4 w-4" />
                       Enviar Rastreio via WhatsApp
                     </Button>
                   )}
                 </div>
              )}
            </div>
          )}

              {/* Company */}
          <div>
            <Label className="text-sm">
              {value.method === "app" ? "Aplicativo" : "Empresa de Postagem"}
            </Label>
            <Input
              placeholder={value.method === "app" ? "Uber, 99, InDriver..." : "Correios, Jadlog, Azul Cargo..."}
              value={value.company}
              onChange={(e) => { onChange({ ...value, company: e.target.value }); setSelectedQuoteIndex(null); }}
            />
          </div>

          {/* Cost */}
          <div>
            <Label className="text-sm">Valor do Frete (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={value.cost || ""}
              onChange={(e) => { onChange({ ...value, cost: Number(e.target.value) || 0 }); setSelectedQuoteIndex(null); }}
            />
          </div>

          {/* Payer */}
          <div>
            <Label className="text-sm">Quem paga o frete?</Label>
            <RadioGroup
              value={value.payer}
              onValueChange={(v) => onChange({ ...value, payer: v })}
              className="flex gap-4 mt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="seller" id="payer-seller" />
                <Label htmlFor="payer-seller" className="text-sm font-normal cursor-pointer">Vendedora</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="buyer" id="payer-buyer" />
                <Label htmlFor="payer-buyer" className="text-sm font-normal cursor-pointer">Compradora</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-1">
              {value.payer === "buyer"
                ? "O frete será somado ao total da venda e registrado como despesa."
                : "O frete será registrado apenas como despesa (não altera o total da venda)."}
            </p>
          </div>

          {/* App quick links */}
          {value.method === "app" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Solicitar via app:</Label>
              <div className="flex gap-2">
                <a
                  href="https://m.uber.com/ul/?action=setPickup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button type="button" variant="outline" size="sm" className="w-full gap-2">
                    <Car className="h-4 w-4" />
                    Uber Flash
                  </Button>
                </a>
                <a
                  href="https://deep.99app.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button type="button" variant="outline" size="sm" className="w-full gap-2">
                    <Car className="h-4 w-4" />
                    99 Entrega
                  </Button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Solicite a corrida no app e insira o valor abaixo.
              </p>
            </div>
          )}

          {/* App disclaimer */}
          {value.method === "app" && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong>Responsabilidade do Cliente:</strong> A partir do momento em que a encomenda é entregue ao prestador de serviço, a responsabilidade é do cliente.
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Outros details */}
      {showOtherDetails && (
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div>
            <Label className="text-sm">Descrição do envio</Label>
            <Textarea
              placeholder="Descreva a forma de envio..."
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label className="text-sm">Valor do Frete (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={value.cost || ""}
              onChange={(e) => onChange({ ...value, cost: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label className="text-sm">Quem paga?</Label>
            <RadioGroup
              value={value.payer}
              onValueChange={(v) => onChange({ ...value, payer: v })}
              className="flex gap-4 mt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="seller" id="payer-seller-o" />
                <Label htmlFor="payer-seller-o" className="text-sm font-normal cursor-pointer">Vendedora</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="buyer" id="payer-buyer-o" />
                <Label htmlFor="payer-buyer-o" className="text-sm font-normal cursor-pointer">Compradora</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-1">
              {value.payer === "buyer"
                ? "O frete será somado ao total da venda e registrado como despesa."
                : "O frete será registrado apenas como despesa (não altera o total da venda)."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
