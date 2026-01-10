import { useState } from "react";
import { Bell, Loader2, Check, X, Calendar, Phone, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isPast, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentReminder {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_instagram: string | null;
  amount: number;
  due_date: string;
  payment_method_name: string;
  is_paid: boolean;
  notification_sent: boolean;
  notes: string | null;
  created_at: string;
}

interface PaymentRemindersSectionProps {
  userId: string;
}

export function PaymentRemindersSection({ userId }: PaymentRemindersSectionProps) {
  const queryClient = useQueryClient();

  // Fetch payment reminders
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["payment-reminders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_reminders")
        .select("*")
        .eq("owner_id", userId)
        .eq("is_paid", false)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as PaymentReminder[];
    },
    enabled: !!userId,
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payment_reminders")
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-reminders", userId] });
      toast({ title: "Pagamento marcado como recebido!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const getDueDateBadge = (dueDate: string) => {
    const date = new Date(dueDate + "T00:00:00");
    const daysUntil = differenceInDays(date, new Date());
    
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="destructive">Vencido há {Math.abs(daysUntil)} dias</Badge>;
    }
    if (isToday(date)) {
      return <Badge variant="destructive">Vence hoje</Badge>;
    }
    if (isTomorrow(date)) {
      return <Badge variant="secondary">Vence amanhã</Badge>;
    }
    if (daysUntil <= 3) {
      return <Badge variant="secondary">Vence em {daysUntil} dias</Badge>;
    }
    return <Badge variant="outline">Vence em {daysUntil} dias</Badge>;
  };

  const generateWhatsAppMessage = (reminder: PaymentReminder) => {
    const formattedDate = format(new Date(reminder.due_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
    const formattedAmount = reminder.amount.toFixed(2).replace(".", ",");
    
    const message = `Olá${reminder.customer_name ? ` ${reminder.customer_name}` : ""}! 👋

Gostaria de lembrar sobre o pagamento pendente:

💰 *Valor:* R$ ${formattedAmount}
📅 *Vencimento:* ${formattedDate}
💳 *Forma:* ${reminder.payment_method_name}
${reminder.notes ? `📝 *Obs:* ${reminder.notes}` : ""}

Por favor, entre em contato para confirmar o pagamento. Agradeço! 🙏`;

    return encodeURIComponent(message);
  };

  const openWhatsApp = (reminder: PaymentReminder) => {
    if (!reminder.customer_phone) {
      toast({ title: "Cliente sem telefone cadastrado", variant: "destructive" });
      return;
    }
    
    const phone = reminder.customer_phone.replace(/\D/g, "");
    const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;
    const message = generateWhatsAppMessage(reminder);
    
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, "_blank");
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

  if (reminders.length === 0) {
    return null; // Don't show section if no pending reminders
  }

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
          <Bell className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">
            Pagamentos Pendentes ({reminders.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            Lembretes de cobranças a prazo
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-background"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {reminder.customer_name || "Cliente não informado"}
                </span>
                {getDueDateBadge(reminder.due_date)}
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  R$ {reminder.amount.toFixed(2).replace(".", ",")}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(reminder.due_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                <span>{reminder.payment_method_name}</span>
              </div>
              {reminder.customer_phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {reminder.customer_phone}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWhatsApp(reminder)}
                disabled={!reminder.customer_phone}
                title={reminder.customer_phone ? "Enviar lembrete via WhatsApp" : "Telefone não cadastrado"}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Cobrar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => markAsPaidMutation.mutate(reminder.id)}
                disabled={markAsPaidMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Pago
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
