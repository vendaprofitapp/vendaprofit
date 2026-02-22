import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  variant_color: string | null;
  selected_size: string | null;
}

interface EditCatalogOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    customer_name: string;
    customer_phone: string;
    saved_cart_items: OrderItem[];
    total: number;
  } | null;
  onSaved: () => void;
}

export function EditCatalogOrderDialog({ open, onOpenChange, order, onSaved }: EditCatalogOrderDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name);
      setCustomerPhone(order.customer_phone || "");
      setItems(order.saved_cart_items.map(i => ({ ...i })));
    }
  }, [order]);

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const updateItem = (idx: number, field: keyof OrderItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) {
      toast.error("O pedido precisa ter pelo menos 1 item");
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      // Update cart header
      const { error: cartError } = await supabase
        .from("saved_carts")
        .update({ customer_name: customerName, customer_phone: customerPhone, total })
        .eq("id", order.id);
      if (cartError) throw cartError;

      // Delete removed items
      const currentIds = items.map(i => i.id);
      const removedIds = order.saved_cart_items.filter(i => !currentIds.includes(i.id)).map(i => i.id);
      if (removedIds.length > 0) {
        const { error: delError } = await supabase.from("saved_cart_items").delete().in("id", removedIds);
        if (delError) throw delError;
      }

      // Upsert remaining items
      for (const item of items) {
        const { error: itemError } = await supabase
          .from("saved_cart_items")
          .update({ quantity: item.quantity, unit_price: item.unit_price })
          .eq("id", item.id);
        if (itemError) throw itemError;
      }

      toast.success("Pedido atualizado!");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome do Cliente</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Itens</Label>
            <div className="space-y-2 mt-2">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <div className="flex gap-1 text-xs text-muted-foreground">
                      {item.variant_color && <span>{item.variant_color}</span>}
                      {item.selected_size && <span>• {item.selected_size}</span>}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-8 text-center"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unit_price}
                    onChange={e => updateItem(idx, "unit_price", Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 h-8 text-right"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between font-semibold text-sm pt-2 border-t">
            <span>Novo Total</span>
            <span>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !customerName}>
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
