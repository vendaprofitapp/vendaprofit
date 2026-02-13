import { useState, useEffect } from "react";
import { Package, Truck, Car, FileText, AlertTriangle, MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

interface ShippingSectionProps {
  value: ShippingData;
  onChange: (data: ShippingData) => void;
  customerAddress?: CustomerAddress | null;
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

export function ShippingSection({ value, onChange, customerAddress }: ShippingSectionProps) {
  const [addressOpen, setAddressOpen] = useState(false);

  // Auto-fill address when customer has one
  useEffect(() => {
    if (hasAddress(customerAddress) && (value.method === "postagem" || value.method === "app") && !value.address) {
      onChange({ ...value, address: formatCustomerAddress(customerAddress!) });
    }
  }, [customerAddress, value.method]);

  const showDetails = value.method === "postagem" || value.method === "app";
  const showOtherDetails = value.method === "outros";

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

          {/* Company */}
          <div>
            <Label className="text-sm">
              {value.method === "app" ? "Aplicativo" : "Empresa de Postagem"}
            </Label>
            <Input
              placeholder={value.method === "app" ? "Uber, 99, InDriver..." : "Correios, Jadlog, Azul Cargo..."}
              value={value.company}
              onChange={(e) => onChange({ ...value, company: e.target.value })}
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
              onChange={(e) => onChange({ ...value, cost: Number(e.target.value) || 0 })}
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
