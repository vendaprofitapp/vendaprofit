import { useState, useEffect } from "react";
import { CreditCard, Loader2, Plus, Trash2, Edit2, Calendar, Check, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

interface CustomPaymentMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
  is_active: boolean;
}

interface CustomPaymentMethodsSectionProps {
  userId: string;
}

export function CustomPaymentMethodsSection({ userId }: CustomPaymentMethodsSectionProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<CustomPaymentMethod | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [feePercent, setFeePercent] = useState("0");
  const [isDeferred, setIsDeferred] = useState(false);

  // Fetch custom payment methods
  const { data: paymentMethods = [], isLoading } = useQuery({
    queryKey: ["custom-payment-methods", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("*")
        .eq("owner_id", userId)
        .order("name");
      if (error) throw error;
      return data as CustomPaymentMethod[];
    },
    enabled: !!userId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const feeValue = parseFloat(feePercent.replace(",", ".")) || 0;
      
      if (editingMethod) {
        const { error } = await supabase
          .from("custom_payment_methods")
          .update({
            name: name.trim(),
            fee_percent: feeValue,
            is_deferred: isDeferred,
          })
          .eq("id", editingMethod.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("custom_payment_methods")
          .insert({
            owner_id: userId,
            name: name.trim(),
            fee_percent: feeValue,
            is_deferred: isDeferred,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-payment-methods", userId] });
      toast({ title: editingMethod ? "Forma de pagamento atualizada!" : "Forma de pagamento criada!" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("custom_payment_methods")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-payment-methods", userId] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custom_payment_methods")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-payment-methods", userId] });
      toast({ title: "Forma de pagamento excluída!" });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingMethod(null);
    setName("");
    setFeePercent("0");
    setIsDeferred(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (method: CustomPaymentMethod) => {
    setEditingMethod(method);
    setName(method.name);
    setFeePercent(String(method.fee_percent));
    setIsDeferred(method.is_deferred);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingMethod(null);
    setName("");
    setFeePercent("0");
    setIsDeferred(false);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">
              Formas de Pagamento Personalizadas
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure suas formas de pagamento e taxas
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma forma de pagamento cadastrada</p>
          <p className="text-sm">Clique em "Nova" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                method.is_active ? "bg-background" : "bg-muted/50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Switch
                  checked={method.is_active}
                  onCheckedChange={(checked) =>
                    toggleActiveMutation.mutate({ id: method.id, isActive: checked })
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{method.name}</span>
                    {method.is_deferred && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <Calendar className="h-3 w-3 mr-1" />
                        A prazo
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Taxa: {method.fee_percent}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(method)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteConfirmId(method.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="method-name">Nome *</Label>
              <Input
                id="method-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: PIX, Cartão Crédito 3x, Fiado..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fee-percent">Taxa (%)</Label>
              <div className="relative">
                <Input
                  id="fee-percent"
                  type="text"
                  inputMode="decimal"
                  value={feePercent}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".");
                    setFeePercent(sanitized);
                  }}
                  className="pr-8"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Taxa que será descontada automaticamente nas vendas
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/30">
              <div>
                <p className="font-medium">Pagamento a Prazo</p>
                <p className="text-sm text-muted-foreground">
                  Solicitar data de vencimento ao finalizar venda
                </p>
              </div>
              <Switch
                checked={isDeferred}
                onCheckedChange={setIsDeferred}
              />
            </div>

            {isDeferred && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm text-primary flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Ao usar esta forma de pagamento, você poderá definir a data de vencimento 
                    e receberá lembretes com o WhatsApp do cliente para cobrança.
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMethod ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir forma de pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A forma de pagamento será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
