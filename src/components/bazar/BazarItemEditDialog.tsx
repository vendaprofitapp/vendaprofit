import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BazarItemEditDialogProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function BazarItemEditDialog({ item, open, onOpenChange, onSaved }: BazarItemEditDialogProps) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [sellerPrice, setSellerPrice] = useState(item?.seller_price?.toString().replace(".", ",") || "");
  const [commission, setCommission] = useState(item?.store_commission?.toString().replace(".", ",") || "0");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    const price = parseFloat(sellerPrice.replace(",", "."));
    const comm = parseFloat((commission || "0").replace(",", "."));
    if (isNaN(price) || price <= 0) { toast.error("Preço inválido"); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from("bazar_items").update({
        title: title.trim(),
        description: description.trim() || null,
        seller_price: price,
        store_commission: isNaN(comm) ? 0 : comm,
        final_price: price + (isNaN(comm) ? 0 : comm),
      }).eq("id", item.id);

      if (error) throw error;
      toast.success("Item atualizado!");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Item do Bazar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço vendedor (R$)</Label>
              <Input value={sellerPrice} onChange={(e) => setSellerPrice(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label>Comissão (R$)</Label>
              <Input value={commission} onChange={(e) => setCommission(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          {(() => {
            const p = parseFloat(sellerPrice.replace(",", "."));
            const c = parseFloat((commission || "0").replace(",", "."));
            const final = (!isNaN(p) ? p : 0) + (!isNaN(c) ? c : 0);
            return (
              <div className="text-sm font-semibold text-right">
                Preço final: <span className="text-primary">R$ {final.toFixed(2).replace(".", ",")}</span>
              </div>
            );
          })()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
