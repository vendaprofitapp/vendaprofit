import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Store, User } from "lucide-react";

interface NewPartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface CustomPaymentMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
}

export function NewPartnerDialog({ open, onOpenChange, onCreated }: NewPartnerDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customMethods, setCustomMethods] = useState<CustomPaymentMethod[]>([]);
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([]);
  const [methodMinAmounts, setMethodMinAmounts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    contact_name: "",
    contact_phone: "",
    address: "",
    rack_commission_pct: "10",
    pickup_commission_pct: "5",
    payment_fee_pct: "2",
    loss_risk_enabled: false,
    replenishment_cycle_days: "30",
    min_stock_alert: "3",
    notes: "",
    payment_receiver: "partner" as "partner" | "seller",
  });

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("custom_payment_methods")
      .select("id, name, fee_percent, is_deferred")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setCustomMethods((data ?? []) as CustomPaymentMethod[]));
  }, [open, user]);

  const toggleMethod = (id: string) => {
    setSelectedMethodIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!user || !form.name.trim()) {
      toast.error("Preencha o nome do parceiro.");
      return;
    }
    if (form.payment_receiver === "seller" && selectedMethodIds.length === 0) {
      toast.error("Selecione ao menos uma forma de pagamento para a vendedora.");
      return;
    }

    setLoading(true);

    // Build snapshot of allowed payment methods
    const allowedMethods = form.payment_receiver === "seller"
      ? customMethods
          .filter(m => selectedMethodIds.includes(m.id))
          .map(m => ({
            id: m.id,
            name: m.name,
            fee_percent: m.fee_percent,
            is_deferred: m.is_deferred,
            min_amount: parseFloat((methodMinAmounts[m.id] ?? "").replace(",", ".")) || 0,
          }))
      : [];

    const { error } = await supabase.from("partner_points").insert({
      owner_id: user.id,
      name: form.name.trim(),
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      address: form.address || null,
      rack_commission_pct: Number(form.rack_commission_pct) || 0,
      pickup_commission_pct: Number(form.pickup_commission_pct) || 0,
      payment_fee_pct: form.payment_receiver === "partner" ? (Number(form.payment_fee_pct) || 0) : 0,
      loss_risk_enabled: form.loss_risk_enabled,
      replenishment_cycle_days: Number(form.replenishment_cycle_days) || 30,
      min_stock_alert: Number(form.min_stock_alert) || 3,
      notes: form.notes || null,
      payment_receiver: form.payment_receiver,
      allowed_payment_methods: allowedMethods,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao cadastrar parceiro.");
      return;
    }
    toast.success("Parceiro cadastrado com sucesso!");
    onCreated();
    onOpenChange(false);
    setForm({
      name: "", contact_name: "", contact_phone: "", address: "",
      rack_commission_pct: "10", pickup_commission_pct: "5", payment_fee_pct: "2",
      loss_risk_enabled: false, replenishment_cycle_days: "30", min_stock_alert: "3",
      notes: "", payment_receiver: "partner",
    });
    setSelectedMethodIds([]);
    setMethodMinAmounts({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Ponto Parceiro</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nome do local *</Label>
            <Input placeholder="Ex: Academia Inova" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome do contato</Label>
              <Input placeholder="Ex: João" value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Telefone do contato</Label>
              <Input placeholder="(11) 99999-9999" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Endereço</Label>
            <Input placeholder="Rua, número, bairro" value={form.address} onChange={e => set("address", e.target.value)} />
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-foreground mb-3">Comissões</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Comissão Arara (%)</Label>
                <Input type="number" min="0" max="100" step="0.5" value={form.rack_commission_pct} onChange={e => set("rack_commission_pct", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Comissão Retirada (%)</Label>
                <Input type="number" min="0" max="100" step="0.5" value={form.pickup_commission_pct} onChange={e => set("pickup_commission_pct", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Payment receiver section */}
          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-medium text-foreground">Como o cliente paga?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set("payment_receiver", "partner")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                  form.payment_receiver === "partner"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <Store className={`h-5 w-5 ${form.payment_receiver === "partner" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-xs font-semibold">Ponto Parceiro</p>
                  <p className="text-xs text-muted-foreground">Parceiro recebe e repassa depois</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => set("payment_receiver", "seller")}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                  form.payment_receiver === "seller"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <User className={`h-5 w-5 ${form.payment_receiver === "seller" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-xs font-semibold">Vendedora</p>
                  <p className="text-xs text-muted-foreground">Cliente paga direto para mim</p>
                </div>
              </button>
            </div>

            {/* Seller: pick payment methods */}
            {form.payment_receiver === "seller" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Formas de pagamento disponíveis neste ponto:</p>
                {customMethods.length === 0 ? (
                  <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
                    Você ainda não tem formas de pagamento personalizadas cadastradas. Vá em Configurações → Formas de Pagamento para criar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customMethods.map(method => {
                      const isSelected = selectedMethodIds.includes(method.id);
                      return (
                        <div key={method.id} className={`rounded-lg border transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}>
                          <label className="flex items-center gap-3 p-2.5 cursor-pointer">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleMethod(method.id)}
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <span className="text-sm font-medium">{method.name}</span>
                              <div className="flex items-center gap-2">
                                {method.is_deferred && (
                                  <Badge variant="outline" className="text-xs py-0">A prazo</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {method.fee_percent > 0 ? `${method.fee_percent}%` : "sem taxa"}
                                </span>
                              </div>
                            </div>
                          </label>
                          {isSelected && (
                            <div className="px-2.5 pb-2.5 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground shrink-0">Valor mínimo (opcional):</span>
                              <div className="flex items-center border rounded-md overflow-hidden bg-background flex-1 max-w-[140px]">
                                <span className="text-xs text-muted-foreground px-2 bg-muted border-r h-full flex items-center py-1.5">R$</span>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0,00"
                                  className="border-0 text-xs h-auto py-1.5 focus-visible:ring-0"
                                  value={methodMinAmounts[method.id] ?? ""}
                                  onChange={e => setMethodMinAmounts(prev => ({ ...prev, [method.id]: e.target.value }))}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Partner: keep generic fee field */}
            {form.payment_receiver === "partner" && (
              <div className="space-y-1">
                <Label className="text-xs">Taxa Maquininha do Parceiro (%)</Label>
                <Input
                  type="number" min="0" max="20" step="0.1"
                  value={form.payment_fee_pct}
                  onChange={e => set("payment_fee_pct", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Usada para calcular o acerto com o parceiro.</p>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-foreground mb-3">Estoque e Reposição</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ciclo de reposição (dias)</Label>
                <Input type="number" min="1" value={form.replenishment_cycle_days} onChange={e => set("replenishment_cycle_days", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alerta mínimo (peças)</Label>
                <Input type="number" min="0" value={form.min_stock_alert} onChange={e => set("min_stock_alert", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Risco de Perda Ativo</p>
              <p className="text-xs text-muted-foreground">Parceiro arca com o custo de peças perdidas/furtadas</p>
            </div>
            <Switch checked={form.loss_risk_enabled} onCheckedChange={v => set("loss_risk_enabled", v)} />
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Anotações internas sobre este parceiro..." value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Cadastrar Parceiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
