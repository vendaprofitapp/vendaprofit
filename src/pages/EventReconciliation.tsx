import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Clock, Package, Trash2, ShoppingCart } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DraftItem {
  label: string;
  price: number;
  quantity: number;
}

interface Draft {
  id: string;
  items: DraftItem[];
  estimated_total: number;
  photo_urls: string[] | null;
  notes: string | null;
  created_at: string;
  status: string;
}

export default function EventReconciliation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [draftToDiscard, setDraftToDiscard] = useState<string | null>(null);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["event-drafts-pending", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sale_drafts")
        .select("*")
        .eq("owner_id", user?.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        items: Array.isArray(d.items) ? d.items : [],
      })) as Draft[];
    },
    enabled: !!user?.id,
  });

  const discardMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_sale_drafts")
        .update({ status: "discarded" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-drafts-pending"] });
      queryClient.invalidateQueries({ queryKey: ["event-drafts-pending-count"] });
      toast({ title: "Rascunho descartado" });
      setDraftToDiscard(null);
      setSelectedDraft(null);
    },
  });

  const handleOfficialize = (draft: Draft) => {
    // Build notes from draft data
    const itemsSummary = draft.items
      .map((i) => `${i.label} (${i.quantity}x - R$${i.price.toFixed(2)})`)
      .join(", ");
    const prefillNotes = [
      draft.notes ? `Obs evento: ${draft.notes}` : "",
      itemsSummary ? `Itens rápidos: ${itemsSummary}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    navigate(`/sales?from_draft=${draft.id}&draft_notes=${encodeURIComponent(prefillNotes)}`);
  };

  return (
    <MainLayout>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conciliação de Rascunhos</h1>
          <p className="text-sm text-muted-foreground">Transforme rascunhos de evento em vendas oficiais</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>Nenhum rascunho pendente</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((draft) => (
            <Card
              key={draft.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedDraft(draft)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {draft.photo_urls && draft.photo_urls.length > 0 ? (
                    <img
                      src={draft.photo_urls[0]}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(draft.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{draft.items.length} {draft.items.length === 1 ? "item" : "itens"}</span>
                    </div>
                    <p className="text-base font-semibold text-foreground">
                      R$ {draft.estimated_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedDraft} onOpenChange={(open) => !open && setSelectedDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhe do Rascunho</DialogTitle>
          </DialogHeader>

          {selectedDraft && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Photo gallery */}
              {selectedDraft.photo_urls && selectedDraft.photo_urls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedDraft.photo_urls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className="h-32 w-32 shrink-0 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}

              {/* Items */}
              <div>
                <h4 className="text-sm font-medium mb-2">Itens Rápidos</h4>
                <div className="space-y-1">
                  {selectedDraft.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>
                        {item.label}{" "}
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {item.quantity}x
                        </Badge>
                      </span>
                      <span className="text-muted-foreground">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t flex justify-between font-medium">
                  <span>Total Estimado</span>
                  <span>R$ {selectedDraft.estimated_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedDraft.notes && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Observações (voz)</h4>
                  <p className="text-sm text-muted-foreground bg-muted rounded-md p-3">
                    {selectedDraft.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => selectedDraft && setDraftToDiscard(selectedDraft.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Descartar
            </Button>
            <Button onClick={() => selectedDraft && handleOfficialize(selectedDraft)}>
              <ShoppingCart className="h-4 w-4 mr-1" /> Oficializar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <AlertDialog open={!!draftToDiscard} onOpenChange={(open) => !open && setDraftToDiscard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O rascunho será removido da lista de pendências.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => draftToDiscard && discardMutation.mutate(draftToDiscard)}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
