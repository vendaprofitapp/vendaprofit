import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
import type { HubPendingOrder } from "./HubPendingOrdersList";

interface Props {
  open: boolean;
  order: HubPendingOrder;
  onClose: () => void;
  onRefresh: () => void;
}

export function HubOrderLogisticsDialog({ open, order, onClose, onRefresh }: Props) {
  const [instructions, setInstructions] = useState(order.collection_instructions || "");
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructions && !labelFile) {
      toast.error("Preencha as instruções de coleta ou faça upload da etiqueta.");
      return;
    }
    setLoading(true);
    try {
      let labelUrl = order.shipping_label_url;

      if (labelFile) {
        const ext = labelFile.name.split(".").pop();
        const path = `${order.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("hub-shipping-labels")
          .upload(path, labelFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage
          .from("hub-shipping-labels")
          .getPublicUrl(path);
        labelUrl = publicUrl;
      }

      const { error } = await supabase
        .from("hub_pending_orders")
        .update({
          shipping_label_url: labelUrl,
          collection_instructions: instructions || null,
          logistics_set_at: new Date().toISOString(),
          status: "logistics_ready",
        })
        .eq("id", order.id);
      if (error) throw error;

      // Notify the owner
      await supabase.from("hub_order_notifications").insert({
        recipient_id: order.owner_id,
        order_id: order.id,
        type: "logistics_ready",
        message: `📦 O vendedor adicionou a logística do pedido de ${order.customer_name || "cliente"}. Prepare-se para despachar!`,
      });

      toast.success("Logística salva! O dono do produto foi notificado.");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar logística");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Logística do Pedido</DialogTitle>
          <DialogDescription>
            Informe como a peça será coletada do dono. O custo do frete é inteiramente seu.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Instruções de Coleta
            </Label>
            <Textarea
              placeholder="Ex: Motoboy agendado para 20/03 às 14h. Código: XYZ. Embalagem a cargo do dono."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Upload className="h-4 w-4" />
              Etiqueta de Envio (PDF ou Imagem)
            </Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => document.getElementById("label-upload-input")?.click()}
            >
              {labelFile ? (
                <p className="text-sm font-medium text-primary">{labelFile.name}</p>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Clique para selecionar PDF ou imagem</p>
                </>
              )}
            </div>
            <input
              id="label-upload-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => setLabelFile(e.target.files?.[0] ?? null)}
            />
            {order.shipping_label_url && !labelFile && (
              <a href={order.shipping_label_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                Ver etiqueta atual →
              </a>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar e Notificar Dono"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
