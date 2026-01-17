import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, DollarSign, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths, setDate } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  participantId: string;
  participantName: string;
  installmentsCount: number;
  installmentValue: number;
  paymentDueDay: number;
  consortiumStartDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Payment {
  id: string;
  installment_number: number;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  due_date: string | null;
}

// Calcula a data de vencimento para cada parcela
function calculateDueDate(startDate: string, installmentNumber: number, dueDay: number): Date {
  const start = new Date(startDate);
  // A primeira parcela vence no mês seguinte ao início
  const dueDate = addMonths(start, installmentNumber);
  // Define o dia do vencimento
  const finalDate = setDate(dueDate, Math.min(dueDay, 28)); // Limita a 28 para evitar problemas em fevereiro
  return finalDate;
}

export function ConsortiumPaymentsDialog({
  participantId,
  participantName,
  installmentsCount,
  installmentValue,
  paymentDueDay,
  consortiumStartDate,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();

  // Buscar pagamentos existentes
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["consortium-payments", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_payments")
        .select("*")
        .eq("participant_id", participantId)
        .order("installment_number");
      if (error) throw error;
      return data as Payment[];
    },
    enabled: open,
  });

  // Criar parcelas que não existem
  const createMissingPaymentsMutation = useMutation({
    mutationFn: async () => {
      const existingNumbers = payments.map((p) => p.installment_number);
      const missingPayments = [];

      for (let i = 1; i <= installmentsCount; i++) {
        if (!existingNumbers.includes(i)) {
          const dueDate = calculateDueDate(consortiumStartDate, i, paymentDueDay);
          missingPayments.push({
            participant_id: participantId,
            installment_number: i,
            amount: installmentValue,
            is_paid: false,
            due_date: format(dueDate, "yyyy-MM-dd"),
          });
        }
      }

      if (missingPayments.length > 0) {
        const { error } = await supabase.from("consortium_payments").insert(missingPayments);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-payments", participantId] });
    },
  });

  // Criar parcelas faltantes quando abrir o dialog
  useEffect(() => {
    if (open && payments.length < installmentsCount && !isLoading) {
      createMissingPaymentsMutation.mutate();
    }
  }, [open, payments.length, installmentsCount, isLoading]);

  // Marcar como pago/não pago
  const togglePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, isPaid, paymentMethod }: { paymentId: string; isPaid: boolean; paymentMethod?: string }) => {
      const { error } = await supabase
        .from("consortium_payments")
        .update({
          is_paid: isPaid,
          paid_at: isPaid ? new Date().toISOString() : null,
          payment_method: isPaid ? paymentMethod || "dinheiro" : null,
        })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-payments", participantId] });
      queryClient.invalidateQueries({ queryKey: ["consortium-participants"] });
      toast.success("Pagamento atualizado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const paidCount = payments.filter((p) => p.is_paid).length;
  const totalPaid = payments.filter((p) => p.is_paid).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = payments.filter((p) => !p.is_paid).reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pagamentos de {participantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Parcelas Pagas</p>
              <p className="text-lg font-bold text-green-500">
                {paidCount}/{installmentsCount}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Pago</p>
              <p className="text-lg font-bold text-green-500">R$ {totalPaid.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Pendente</p>
              <p className="text-lg font-bold text-destructive">R$ {totalPending.toFixed(2)}</p>
            </div>
          </div>

          {/* Lista de parcelas */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || createMissingPaymentsMutation.isPending ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando parcelas...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma parcela encontrada
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => {
                  const dueDate = payment.due_date 
                    ? new Date(payment.due_date) 
                    : calculateDueDate(consortiumStartDate, payment.installment_number, paymentDueDay);
                  const isOverdue = !payment.is_paid && new Date() > dueDate;
                  
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.installment_number}ª parcela
                      </TableCell>
                      <TableCell>R$ {Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={isOverdue ? "text-destructive font-medium" : ""}>
                          {format(dueDate, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {payment.is_paid ? (
                          <Badge className="bg-green-500/10 text-green-500 gap-1">
                            <Check className="h-3 w-3" />
                            Pago
                          </Badge>
                        ) : isOverdue ? (
                          <Badge variant="destructive" className="gap-1">
                            <Calendar className="h-3 w-3" />
                            Atrasado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <X className="h-3 w-3" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.paid_at
                          ? format(new Date(payment.paid_at), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {payment.payment_method?.replace("_", " ") || "-"}
                      </TableCell>
                    <TableCell className="text-right">
                      {payment.is_paid ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            togglePaymentMutation.mutate({
                              paymentId: payment.id,
                              isPaid: false,
                            })
                          }
                          disabled={togglePaymentMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Desfazer
                        </Button>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <Select
                            onValueChange={(method) =>
                              togglePaymentMutation.mutate({
                                paymentId: payment.id,
                                isPaid: true,
                                paymentMethod: method,
                              })
                            }
                            disabled={togglePaymentMutation.isPending}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Pagar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao_credito">Crédito</SelectItem>
                              <SelectItem value="cartao_debito">Débito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
