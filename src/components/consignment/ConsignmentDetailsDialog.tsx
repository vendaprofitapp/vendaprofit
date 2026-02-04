import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConsignment } from "@/hooks/useConsignment";
import { 
  Package, MessageCircle, Copy, Check, CheckCircle, XCircle, 
  Clock, Send, Heart, RotateCcw, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConsignmentDetailsDialogProps {
  consignment: {
    id: string;
    status: string;
    access_token: string;
    customers: { name: string; phone: string | null } | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

interface ConsignmentItem {
  id: string;
  status: string;
  original_price: number;
  products: {
    id: string;
    name: string;
    image_url: string | null;
    size: string | null;
    color: string | null;
  };
  product_variants?: {
    size: string;
  } | null;
}

const itemStatusConfig: Record<string, { label: string; color: string; icon: typeof Package }> = {
  pending: { label: "Pendente", color: "bg-gray-500", icon: Clock },
  active: { label: "Na Malinha", color: "bg-blue-500", icon: Package },
  kept: { label: "Vai Ficar", color: "bg-green-500", icon: Heart },
  returned: { label: "Devolvido", color: "bg-orange-500", icon: RotateCcw },
};

export function ConsignmentDetailsDialog({ 
  consignment, 
  open, 
  onOpenChange,
  onUpdate 
}: ConsignmentDetailsDialogProps) {
  const { 
    approveConsignment, 
    completeConsignment, 
    cancelConsignment,
    updateItemStatus,
    removeItem,
    loading 
  } = useConsignment();
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: details, refetch } = useQuery({
    queryKey: ["consignment-details", consignment.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consignments")
        .select(`
          *,
          customers (*),
          consignment_items (
            id,
            status,
            original_price,
            variant_id,
            products (id, name, image_url, size, color),
            product_variants (size)
          )
        `)
        .eq("id", consignment.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const items = (details?.consignment_items || []) as ConsignmentItem[];
  
  const keptItems = items.filter(i => i.status === "kept");
  const returnedItems = items.filter(i => i.status === "returned");
  const pendingItems = items.filter(i => i.status === "pending" || i.status === "active");
  
  const keptTotal = keptItems.reduce((sum, i) => sum + i.original_price, 0);
  const totalValue = items.reduce((sum, i) => sum + i.original_price, 0);

  const getPublicUrl = () => {
    return `${window.location.origin}/bag/${consignment.access_token}`;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(getPublicUrl());
    setLinkCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const sendWhatsApp = () => {
    if (!consignment.customers?.phone) {
      toast.error("Cliente não tem telefone cadastrado");
      return;
    }

    const url = getPublicUrl();
    const message = `Olá ${consignment.customers.name}! 🛍️\n\nAcesse sua malinha:\n${url}\n\nQualquer dúvida, é só me chamar! 💕`;
    
    const phone = consignment.customers.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleApprove = async () => {
    const success = await approveConsignment(consignment.id);
    if (success) {
      refetch();
      onUpdate();
    }
  };

  const handleComplete = async () => {
    const success = await completeConsignment(consignment.id);
    if (success) {
      refetch();
      onUpdate();
    }
  };

  const handleCancel = async () => {
    const success = await cancelConsignment(consignment.id);
    if (success) {
      refetch();
      onUpdate();
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const success = await removeItem(itemId);
    if (success) {
      refetch();
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              Malinha - {consignment.customers?.name || "Cliente"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-xs text-muted-foreground">Itens</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{keptItems.length}</p>
              <p className="text-xs text-muted-foreground">Vai Ficar</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">{formatPrice(keptTotal)}</p>
              <p className="text-xs text-muted-foreground">Total a Receber</p>
            </Card>
          </div>

          {/* Link and WhatsApp */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm truncate">
              {getPublicUrl()}
            </div>
            <Button variant="outline" size="icon" onClick={copyLink}>
              {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={sendWhatsApp}>
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>

          <Separator className="mb-4" />

          {/* Items list */}
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {items.map(item => {
                const status = itemStatusConfig[item.status] || itemStatusConfig.pending;
                const StatusIcon = status.icon;
                const size = item.product_variants?.size || item.products?.size;
                // Color now comes from product (color_label)
                const color = item.products?.color;

                return (
                  <div 
                    key={item.id} 
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="w-14 h-14 bg-muted rounded overflow-hidden flex-shrink-0">
                      {item.products?.image_url ? (
                        <img 
                          src={item.products.image_url} 
                          alt={item.products.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.products?.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {size && <Badge variant="outline" className="text-xs">{size}</Badge>}
                        {color && <Badge variant="outline" className="text-xs">{color}</Badge>}
                        <span className="text-sm font-medium">
                          {formatPrice(item.original_price)}
                        </span>
                      </div>
                    </div>

                    <Badge className={`${status.color} text-white gap-1`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>

                    {consignment.status === "draft" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {consignment.status === "draft" && (
              <>
                <Button onClick={handleApprove} disabled={loading} className="gap-2">
                  <Send className="h-4 w-4" />
                  Enviar para Aprovação
                </Button>
                <Button variant="destructive" onClick={handleCancel} disabled={loading}>
                  Cancelar
                </Button>
              </>
            )}

            {consignment.status === "awaiting_approval" && (
              <>
                <Button onClick={handleApprove} disabled={loading} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Aprovar Manualmente
                </Button>
                <Button variant="destructive" onClick={handleCancel} disabled={loading}>
                  Cancelar
                </Button>
              </>
            )}

            {consignment.status === "finalized_by_client" && (
              <Button onClick={handleComplete} disabled={loading} className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Concluir Venda
              </Button>
            )}

            {(consignment.status === "active" || consignment.status === "finalized_by_client") && (
              <Button variant="destructive" onClick={handleCancel} disabled={loading}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
