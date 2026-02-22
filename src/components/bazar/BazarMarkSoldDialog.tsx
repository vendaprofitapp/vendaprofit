import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BazarMarkSoldDialogProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function BazarMarkSoldDialog({ item, open, onOpenChange, onSaved }: BazarMarkSoldDialogProps) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerZip, setBuyerZip] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!buyerName.trim()) { toast.error("Nome do comprador é obrigatório"); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from("bazar_items").update({
        status: "sold",
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim() || null,
        buyer_zip: buyerZip.trim() || null,
        sold_at: new Date().toISOString(),
      }).eq("id", item.id);

      if (error) throw error;
      toast.success("Item marcado como vendido!");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao marcar como vendido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como Vendido</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong>{item?.title}</strong> — R$ {Number(item?.final_price || item?.seller_price).toFixed(2).replace(".", ",")}
        </p>
        <div className="space-y-4">
          <div>
            <Label>Nome do comprador *</Label>
            <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>WhatsApp do comprador</Label>
            <Input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label>CEP do comprador</Label>
            <Input value={buyerZip} onChange={(e) => setBuyerZip(e.target.value)} placeholder="00000-000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Confirmar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
