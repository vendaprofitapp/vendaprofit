import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, UserPlus, Trophy, Package, Calendar, DollarSign, 
  MessageCircle, Shuffle, Settings, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConsortiumItemsDialog } from "./ConsortiumItemsDialog";
import { ConsortiumPaymentsDialog } from "./ConsortiumPaymentsDialog";
import { ConsortiumSettingsTab } from "./ConsortiumSettingsTab";
import { ParticipantWithdrawalDialog } from "./ParticipantWithdrawalDialog";
import { ParticipantCard } from "./ParticipantCard";

interface Consortium {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_value: number;
  installment_value: number;
  installments_count: number;
  description: string | null;
  is_active: boolean;
}

interface Participant {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  payment_method: string;
  payment_due_day: number | null;
  is_drawn: boolean;
  drawn_at: string | null;
  notes: string | null;
  status: "active" | "withdrawn" | "replaced";
  current_balance: number;
  first_shipping_used: boolean;
}

interface Winner {
  id: string;
  participant_id: string;
  participant_name: string;
  items_total: number;
}

interface Drawing {
  id: string;
  drawing_date: string;
  notes: string | null;
  winners: Winner[];
}

interface ConsortiumSettings {
  grace_period_days: number;
}

interface PaymentStatus {
  participantId: string;
  isOverdue: boolean;
  overdueCount: number;
  paidCount: number;
  totalCount: number;
}

interface Props {
  consortium: Consortium;
  onBack: () => void;
}

export function ConsortiumDetails({ consortium, onBack }: Props) {
  const queryClient = useQueryClient();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<{ winnerId: string; participantId: string; participantName: string; balance: number } | null>(null);
  const [selectedPaymentParticipant, setSelectedPaymentParticipant] = useState<{ id: string; name: string; paymentDueDay: number } | null>(null);
  const [selectedWithdrawParticipant, setSelectedWithdrawParticipant] = useState<{ id: string; name: string } | null>(null);
  const [participantForm, setParticipantForm] = useState({
    customer_name: "",
    customer_phone: "",
    payment_method: "dinheiro",
    payment_due_day: "10",
    notes: "",
  });
  const [drawingForm, setDrawingForm] = useState({
    drawing_date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    winner_count: "1",
  });

  // Buscar configurações
  const { data: settings } = useQuery({
    queryKey: ["consortium-settings", consortium.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_settings")
        .select("*")
        .eq("consortium_id", consortium.id)
        .maybeSingle();
      if (error) throw error;
      return (data || { grace_period_days: 5 }) as ConsortiumSettings;
    },
  });

  // Buscar participantes
  const { data: participants = [] } = useQuery({
    queryKey: ["consortium-participants", consortium.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_participants")
        .select("*")
        .eq("consortium_id", consortium.id)
        .order("customer_name");
      if (error) throw error;
      return data as Participant[];
    },
  });

  // Buscar status de pagamento de cada participante
  const { data: paymentStatuses = [] } = useQuery({
    queryKey: ["consortium-payment-statuses", consortium.id],
    queryFn: async () => {
      const statuses: PaymentStatus[] = [];
      const graceDays = settings?.grace_period_days || 5;
      const today = new Date();
      
      for (const p of participants) {
        const { data: payments } = await supabase
          .from("consortium_payments")
          .select("is_paid, due_date")
          .eq("participant_id", p.id);

        if (payments) {
          const overduePayments = payments.filter(
            (pay) => !pay.is_paid && pay.due_date && isBefore(addDays(new Date(pay.due_date), graceDays), today)
          );
          
          statuses.push({
            participantId: p.id,
            isOverdue: overduePayments.length > 0,
            overdueCount: overduePayments.length,
            paidCount: payments.filter((pay) => pay.is_paid).length,
            totalCount: payments.length,
          });
        }
      }
      return statuses;
    },
    enabled: participants.length > 0,
  });

  // Buscar clientes cadastrados para autocomplete
  const { data: existingCustomers = [] } = useQuery({
    queryKey: ["customers-for-consortium"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("name, phone")
        .order("name");
      if (error) throw error;
      return data.map((c) => ({ name: c.name, phone: c.phone }));
    },
  });

  // Buscar sorteios
  const { data: drawings = [] } = useQuery({
    queryKey: ["consortium-drawings", consortium.id],
    queryFn: async () => {
      const { data: drawingsData, error } = await supabase
        .from("consortium_drawings")
        .select("*")
        .eq("consortium_id", consortium.id)
        .order("drawing_date", { ascending: false });
      if (error) throw error;

      const drawingsWithWinners: Drawing[] = [];
      for (const d of drawingsData) {
        const { data: winners } = await supabase
          .from("consortium_winners")
          .select("id, participant_id")
          .eq("drawing_id", d.id);

        const winnersWithNames: Winner[] = await Promise.all(
          (winners || []).map(async (w) => {
            const participant = participants.find((p) => p.id === w.participant_id);
            const { data: items } = await supabase
              .from("consortium_items")
              .select("total")
              .eq("winner_id", w.id);
            const itemsTotal = (items || []).reduce((sum, i) => sum + Number(i.total), 0);
            return {
              id: w.id,
              participant_id: w.participant_id,
              participant_name: participant?.customer_name || "Desconhecido",
              items_total: itemsTotal,
            };
          })
        );

        drawingsWithWinners.push({
          ...d,
          winners: winnersWithNames,
        });
      }
      return drawingsWithWinners;
    },
    enabled: participants.length > 0,
  });

  // Adicionar participante
  const addParticipantMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("consortium_participants").insert({
        consortium_id: consortium.id,
        customer_name: participantForm.customer_name,
        customer_phone: participantForm.customer_phone || null,
        payment_method: participantForm.payment_method,
        payment_due_day: parseInt(participantForm.payment_due_day) || 10,
        notes: participantForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-participants", consortium.id] });
      queryClient.invalidateQueries({ queryKey: ["consortium-participant-counts"] });
      setIsAddParticipantOpen(false);
      setParticipantForm({ customer_name: "", customer_phone: "", payment_method: "dinheiro", payment_due_day: "10", notes: "" });
      toast.success("Participante adicionado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Realizar sorteio com verificação de inadimplência
  const drawingMutation = useMutation({
    mutationFn: async () => {
      // Filtrar participantes elegíveis (ativos, não sorteados e adimplentes)
      const eligibleParticipants = participants.filter((p) => {
        if (p.is_drawn || p.status !== "active") return false;
        
        const paymentStatus = paymentStatuses.find((ps) => ps.participantId === p.id);
        return !paymentStatus?.isOverdue;
      });

      const winnerCount = Math.min(parseInt(drawingForm.winner_count) || 1, eligibleParticipants.length);

      if (winnerCount === 0) {
        throw new Error("Não há participantes elegíveis. Todos estão em atraso ou já foram sorteados. O sorteio acumulou!");
      }

      // Selecionar vencedores aleatoriamente
      const shuffled = [...eligibleParticipants].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, winnerCount);

      // Criar sorteio
      const { data: drawing, error: drawingError } = await supabase
        .from("consortium_drawings")
        .insert({
          consortium_id: consortium.id,
          drawing_date: drawingForm.drawing_date,
          notes: drawingForm.notes || null,
        })
        .select()
        .single();
      if (drawingError) throw drawingError;

      // Adicionar vencedores
      for (const winner of winners) {
        await supabase.from("consortium_winners").insert({
          drawing_id: drawing.id,
          participant_id: winner.id,
        });

        await supabase
          .from("consortium_participants")
          .update({ is_drawn: true, drawn_at: new Date().toISOString(), current_balance: consortium.total_value })
          .eq("id", winner.id);
      }

      return winners;
    },
    onSuccess: (winners) => {
      queryClient.invalidateQueries({ queryKey: ["consortium-participants", consortium.id] });
      queryClient.invalidateQueries({ queryKey: ["consortium-drawings", consortium.id] });
      queryClient.invalidateQueries({ queryKey: ["consortium-participant-counts"] });
      setIsDrawingOpen(false);
      setDrawingForm({ drawing_date: format(new Date(), "yyyy-MM-dd"), notes: "", winner_count: "1" });
      toast.success(`Sorteio realizado! ${winners.length} vencedor(es): ${winners.map((w) => w.customer_name).join(", ")}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Remover participante
  const removeParticipantMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consortium_participants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-participants", consortium.id] });
      queryClient.invalidateQueries({ queryKey: ["consortium-participant-counts"] });
      toast.success("Participante removido!");
    },
  });

  const openWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(`Olá ${name}! Aqui é do consórcio ${consortium.name}.`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  };

  const chargeOverdueWhatsApp = (phone: string, name: string, overdueCount: number) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá ${name}! 😊\n\nPassando para lembrar que você tem ${overdueCount} parcela(s) em atraso no consórcio ${consortium.name}.\n\nPodemos acertar? 💕`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  };

  const getWinnerForParticipant = (participantId: string) => {
    return drawings.flatMap((d) => d.winners).find((w) => w.participant_id === participantId);
  };

  const getPaymentStatus = (participantId: string) => {
    return paymentStatuses.find((ps) => ps.participantId === participantId);
  };

  // Contar elegíveis para sorteio (apenas ativos, não sorteados e adimplentes)
  const eligibleCount = participants.filter((p) => {
    if (p.is_drawn || p.status !== "active") return false;
    const paymentStatus = getPaymentStatus(p.id);
    return !paymentStatus?.isOverdue;
  }).length;

  const drawnCount = participants.filter((p) => p.is_drawn).length;
  const activeCount = participants.filter((p) => p.status === "active").length;
  const overdueCount = paymentStatuses.filter((ps) => ps.isOverdue).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{consortium.name}</h1>
            <p className="text-muted-foreground">
              {format(new Date(consortium.start_date), "dd/MM/yyyy", { locale: ptBR })} até{" "}
              {format(new Date(consortium.end_date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <Badge variant={consortium.is_active ? "default" : "secondary"}>
            {consortium.is_active ? "Ativo" : "Finalizado"}
          </Badge>
        </div>

        {/* Stats - Mobile optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4 text-center">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 mx-auto text-primary mb-1" />
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-lg sm:text-xl font-bold">R$ {Number(consortium.total_value).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4 text-center">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 mx-auto text-blue-500 mb-1" />
              <p className="text-xs text-muted-foreground">Parcelas</p>
              <p className="text-lg sm:text-xl font-bold">
                {consortium.installments_count}x R$ {Number(consortium.installment_value).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4 text-center">
              <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 mx-auto text-green-500 mb-1" />
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-lg sm:text-xl font-bold">{activeCount}/{participants.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-4 text-center">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 mx-auto text-yellow-500 mb-1" />
              <p className="text-xs text-muted-foreground">Sorteados</p>
              <p className="text-lg sm:text-xl font-bold">{drawnCount}/{activeCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerta de inadimplentes */}
        {overdueCount > 0 && (
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {overdueCount} participante(s) em atraso
                </p>
                <p className="text-sm text-muted-foreground">
                  Eles não poderão participar do próximo sorteio
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="participants" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
            <TabsTrigger value="participants">Participantes</TabsTrigger>
            <TabsTrigger value="drawings">Sorteios</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participants" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-lg font-semibold">Participantes ({participants.length})</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <Dialog open={isDrawingOpen} onOpenChange={setIsDrawingOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 flex-1 sm:flex-none" disabled={eligibleCount === 0}>
                      <Shuffle className="h-4 w-4" />
                      Sortear
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Realizar Sorteio</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {eligibleCount} participante(s) elegível(is) para sorteio
                        {overdueCount > 0 && (
                          <span className="text-destructive">
                            {" "}({overdueCount} em atraso - excluídos)
                          </span>
                        )}
                      </p>
                      <div>
                        <Label>Data do Sorteio</Label>
                        <Input
                          type="date"
                          value={drawingForm.drawing_date}
                          onChange={(e) => setDrawingForm({ ...drawingForm, drawing_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Quantidade de Sorteados</Label>
                        <Select
                          value={drawingForm.winner_count}
                          onValueChange={(v) => setDrawingForm({ ...drawingForm, winner_count: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 pessoa</SelectItem>
                            <SelectItem value="2">2 pessoas</SelectItem>
                            <SelectItem value="3">3 pessoas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          value={drawingForm.notes}
                          onChange={(e) => setDrawingForm({ ...drawingForm, notes: e.target.value })}
                          placeholder="Observações do sorteio..."
                        />
                      </div>
                      <Button
                        onClick={() => drawingMutation.mutate()}
                        disabled={drawingMutation.isPending || eligibleCount === 0}
                        className="w-full gap-2"
                      >
                        <Trophy className="h-4 w-4" />
                        {drawingMutation.isPending ? "Sorteando..." : "Sortear Agora"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 flex-1 sm:flex-none">
                      <UserPlus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Participante</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nome do Cliente</Label>
                        <Input
                          value={participantForm.customer_name}
                          onChange={(e) => setParticipantForm({ ...participantForm, customer_name: e.target.value })}
                          placeholder="Nome completo"
                          list="customers-list"
                        />
                        <datalist id="customers-list">
                          {existingCustomers.map((c, i) => (
                            <option key={i} value={c.name} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        <Input
                          value={participantForm.customer_phone}
                          onChange={(e) => setParticipantForm({ ...participantForm, customer_phone: e.target.value })}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div>
                        <Label>Forma de Pagamento</Label>
                        <Select
                          value={participantForm.payment_method}
                          onValueChange={(v) => setParticipantForm({ ...participantForm, payment_method: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                            <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                            <SelectItem value="boleto">Boleto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Dia de Vencimento (1-31)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={participantForm.payment_due_day}
                          onChange={(e) => setParticipantForm({ ...participantForm, payment_due_day: e.target.value })}
                          placeholder="10"
                        />
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea
                          value={participantForm.notes}
                          onChange={(e) => setParticipantForm({ ...participantForm, notes: e.target.value })}
                          placeholder="Observações..."
                        />
                      </div>
                      <Button
                        onClick={() => addParticipantMutation.mutate()}
                        disabled={addParticipantMutation.isPending || !participantForm.customer_name}
                        className="w-full"
                      >
                        {addParticipantMutation.isPending ? "Adicionando..." : "Adicionar"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Lista de participantes - Mobile Cards */}
            <div className="block sm:hidden space-y-3">
              {participants.length === 0 ? (
                <Card className="bg-muted/50">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Nenhum participante adicionado ainda
                  </CardContent>
                </Card>
              ) : (
                participants.map((p) => {
                  const winner = getWinnerForParticipant(p.id);
                  const paymentStatus = getPaymentStatus(p.id);
                  
                  return (
                    <ParticipantCard
                      key={p.id}
                      participant={p}
                      winner={winner || null}
                      consortiumValue={consortium.total_value}
                      paymentStatus={paymentStatus}
                      onViewPayments={() => setSelectedPaymentParticipant({ 
                        id: p.id, 
                        name: p.customer_name, 
                        paymentDueDay: p.payment_due_day || 10 
                      })}
                      onViewItems={() => winner && setSelectedWinner({ 
                        winnerId: winner.id, 
                        participantId: p.id,
                        participantName: p.customer_name,
                        balance: p.current_balance
                      })}
                      onWhatsApp={() => p.customer_phone && openWhatsApp(p.customer_phone, p.customer_name)}
                      onWithdraw={() => setSelectedWithdrawParticipant({ id: p.id, name: p.customer_name })}
                      onRemove={() => {
                        if (confirm("Remover participante?")) {
                          removeParticipantMutation.mutate(p.id);
                        }
                      }}
                      onChargeOverdue={() => paymentStatus && p.customer_phone && 
                        chargeOverdueWhatsApp(p.customer_phone, p.customer_name, paymentStatus.overdueCount)
                      }
                    />
                  );
                })
              )}
            </div>

            {/* Lista de participantes - Desktop Table */}
            <Card className="bg-card border-border hidden sm:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum participante adicionado ainda
                        </TableCell>
                      </TableRow>
                    ) : (
                      participants.map((p) => {
                        const winner = getWinnerForParticipant(p.id);
                        const paymentStatus = getPaymentStatus(p.id);
                        
                        return (
                          <TableRow key={p.id} className={p.status === "withdrawn" ? "opacity-60" : ""}>
                            <TableCell className="font-medium">{p.customer_name}</TableCell>
                            <TableCell>{p.customer_phone || "-"}</TableCell>
                            <TableCell className="capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                            <TableCell>
                              {p.status === "withdrawn" ? (
                                <Badge variant="destructive">Desistente</Badge>
                              ) : p.is_drawn ? (
                                <Badge className="bg-yellow-500/10 text-yellow-500 gap-1">
                                  <Trophy className="h-3 w-3" />
                                  Sorteado
                                </Badge>
                              ) : paymentStatus?.isOverdue ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Em Atraso
                                </Badge>
                              ) : (
                                <Badge className="bg-green-500/10 text-green-500">Adimplente</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {paymentStatus ? `${paymentStatus.paidCount}/${paymentStatus.totalCount}` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedPaymentParticipant({ 
                                    id: p.id, 
                                    name: p.customer_name, 
                                    paymentDueDay: p.payment_due_day || 10 
                                  })}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                                {winner && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedWinner({ 
                                      winnerId: winner.id, 
                                      participantId: p.id,
                                      participantName: p.customer_name,
                                      balance: p.current_balance
                                    })}
                                  >
                                    <Package className="h-4 w-4" />
                                  </Button>
                                )}
                                {p.customer_phone && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openWhatsApp(p.customer_phone!, p.customer_name)}
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drawings" className="space-y-4">
            <h2 className="text-lg font-semibold">Histórico de Sorteios ({drawings.length})</h2>
            
            {/* Mobile Cards */}
            <div className="block sm:hidden space-y-3">
              {drawings.length === 0 ? (
                <Card className="bg-muted/50">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Nenhum sorteio realizado ainda
                  </CardContent>
                </Card>
              ) : (
                drawings.map((d) => (
                  <Card key={d.id} className="bg-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {format(new Date(d.drawing_date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          {d.notes && <p className="text-sm text-muted-foreground">{d.notes}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.winners.map((w) => (
                          <Badge key={w.id} className="gap-1">
                            <Trophy className="h-3 w-3" />
                            {w.participant_name}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {d.winners.map((w) => (
                          <Button
                            key={w.id}
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              const participant = participants.find((p) => p.id === w.participant_id);
                              setSelectedWinner({ 
                                winnerId: w.id, 
                                participantId: w.participant_id,
                                participantName: w.participant_name,
                                balance: participant?.current_balance || 0
                              });
                            }}
                          >
                            <Package className="h-4 w-4" />
                            Peças
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <Card className="bg-card border-border hidden sm:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Vencedor(es)</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drawings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhum sorteio realizado ainda
                        </TableCell>
                      </TableRow>
                    ) : (
                      drawings.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{format(new Date(d.drawing_date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {d.winners.map((w) => (
                                <Badge key={w.id} className="gap-1">
                                  <Trophy className="h-3 w-3" />
                                  {w.participant_name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{d.notes || "-"}</TableCell>
                          <TableCell className="text-right">
                            {d.winners.map((w) => (
                              <Button
                                key={w.id}
                                variant="outline"
                                size="sm"
                                className="gap-1 ml-1"
                                onClick={() => {
                                  const participant = participants.find((p) => p.id === w.participant_id);
                                  setSelectedWinner({ 
                                    winnerId: w.id, 
                                    participantId: w.participant_id,
                                    participantName: w.participant_name,
                                    balance: participant?.current_balance || 0
                                  });
                                }}
                              >
                                <Package className="h-4 w-4" />
                                Peças
                              </Button>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <ConsortiumSettingsTab consortiumId={consortium.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de itens do vencedor */}
      {selectedWinner && (
        <ConsortiumItemsDialog
          winnerId={selectedWinner.winnerId}
          participantId={selectedWinner.participantId}
          participantName={selectedWinner.participantName}
          consortiumId={consortium.id}
          consortiumValue={consortium.total_value}
          participantBalance={selectedWinner.balance}
          open={!!selectedWinner}
          onOpenChange={(open) => !open && setSelectedWinner(null)}
        />
      )}

      {/* Dialog de pagamentos */}
      {selectedPaymentParticipant && (
        <ConsortiumPaymentsDialog
          participantId={selectedPaymentParticipant.id}
          participantName={selectedPaymentParticipant.name}
          installmentsCount={consortium.installments_count}
          installmentValue={consortium.installment_value}
          paymentDueDay={selectedPaymentParticipant.paymentDueDay}
          consortiumStartDate={consortium.start_date}
          open={!!selectedPaymentParticipant}
          onOpenChange={(open) => !open && setSelectedPaymentParticipant(null)}
        />
      )}

      {/* Dialog de desistência */}
      {selectedWithdrawParticipant && (
        <ParticipantWithdrawalDialog
          participantId={selectedWithdrawParticipant.id}
          participantName={selectedWithdrawParticipant.name}
          consortiumId={consortium.id}
          open={!!selectedWithdrawParticipant}
          onOpenChange={(open) => !open && setSelectedWithdrawParticipant(null)}
        />
      )}
    </MainLayout>
  );
}
