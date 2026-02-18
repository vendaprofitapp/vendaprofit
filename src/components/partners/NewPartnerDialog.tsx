import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NewPartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewPartnerDialog({ open, onOpenChange, onCreated }: NewPartnerDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
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
  });

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!user || !form.name.trim()) {
      toast.error("Preencha o nome do parceiro.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("partner_points").insert({
      owner_id: user.id,
      name: form.name.trim(),
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      address: form.address || null,
      rack_commission_pct: Number(form.rack_commission_pct) || 0,
      pickup_commission_pct: Number(form.pickup_commission_pct) || 0,
      payment_fee_pct: Number(form.payment_fee_pct) || 0,
      loss_risk_enabled: form.loss_risk_enabled,
      replenishment_cycle_days: Number(form.replenishment_cycle_days) || 30,
      min_stock_alert: Number(form.min_stock_alert) || 3,
      notes: form.notes || null,
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
      loss_risk_enabled: false, replenishment_cycle_days: "30", min_stock_alert: "3", notes: "",
    });
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
            <p className="text-sm font-medium text-foreground mb-3">Comissões e Taxas</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Comissão Arara (%)</Label>
                <Input type="number" min="0" max="100" step="0.5" value={form.rack_commission_pct} onChange={e => set("rack_commission_pct", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Comissão Retirada (%)</Label>
                <Input type="number" min="0" max="100" step="0.5" value={form.pickup_commission_pct} onChange={e => set("pickup_commission_pct", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa Maquininha (%)</Label>
                <Input type="number" min="0" max="20" step="0.1" value={form.payment_fee_pct} onChange={e => set("payment_fee_pct", e.target.value)} />
              </div>
            </div>
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
