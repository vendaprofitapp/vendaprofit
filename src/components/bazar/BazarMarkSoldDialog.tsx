import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BazarMarkSoldDialogProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function BazarMarkSoldDialog({ item, open, onOpenChange, onSaved }: BazarMarkSoldDialogProps) {
  const { user } = useAuth();
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerZip, setBuyerZip] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!buyerName.trim()) { toast.error("Nome do comprador é obrigatório"); return; }
    if (!user) { toast.error("Usuário não autenticado"); return; }

    setSaving(true);
    try {
      // 1. Mark bazar item as sold
      const { error: updateError } = await supabase.from("bazar_items").update({
        status: "sold",
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim() || null,
        buyer_zip: buyerZip.trim() || null,
        sold_at: new Date().toISOString(),
      }).eq("id", item.id);

      if (updateError) throw updateError;

      // 2. Create a sale record with sale_source="bazar"
      // Cost = seller_price (what the seller receives), Commission = store_commission (store profit)
      const sellerPrice = Number(item.seller_price) || 0;
      const storeCommission = Number(item.store_commission) || 0;
      const finalPrice = Number(item.final_price) || (sellerPrice + storeCommission);

      const { data: saleResult, error: saleError } = await supabase.rpc("create_sale_transaction", {
        payload: {
          owner_id: user.id,
          sale: {
            customer_name: buyerName.trim(),
            customer_phone: buyerPhone.trim() || null,
            payment_method: "Dinheiro",
            subtotal: finalPrice,
            discount_type: null,
            discount_value: 0,
            discount_amount: 0,
            total: finalPrice,
            notes: `Venda Bazar VIP: ${item.title}`,
            status: "completed",
            sale_source: "bazar",
          },
          items: [
            {
              product_id: null,
              product_name: item.title,
              quantity: 1,
              unit_price: finalPrice,
              total: finalPrice,
              source: "bazar",
            },
          ],
          stock_updates: [],
          financial_splits: [
            // Cost recovery = seller_price (what goes to the seller, i.e. the "cost")
            {
              user_id: user.id,
              amount: -sellerPrice,
              type: "cost_recovery",
              description: `Custo Bazar VIP - repasse ao vendedor: ${item.seller_name || item.seller_phone}`,
            },
            // Profit share = store_commission (the store's profit)
            {
              user_id: user.id,
              amount: storeCommission,
              type: "profit_share",
              description: `Comissão Bazar VIP: ${item.title}`,
            },
          ],
        },
      });

      if (saleError) throw saleError;

      toast.success("Item vendido e venda registrada!");
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
