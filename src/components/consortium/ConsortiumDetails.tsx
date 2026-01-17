import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, UserPlus, Trophy, Package, Phone, Calendar, DollarSign, Check, X, MessageCircle, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConsortiumItemsDialog } from "./ConsortiumItemsDialog";
import { ConsortiumPaymentsDialog } from "./ConsortiumPaymentsDialog";

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
  is_drawn: boolean;
  drawn_at: string | null;
  notes: string | null;
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

interface Props {
  consortium: Consortium;
  onBack: () => void;
}

export function ConsortiumDetails({ consortium, onBack }: Props) {
  const queryClient = useQueryClient();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<{ winnerId: string; participantName: string } | null>(null);
  const [selectedPaymentParticipant, setSelectedPaymentParticipant] = useState<{ id: string; name: string } | null>(null);
  const [participantForm, setParticipantForm] = useState({
    customer_name: "",
    customer_phone: "",
    payment_method: "dinheiro",
    notes: "",
  });
  const [drawingForm, setDrawingForm] = useState({
    drawing_date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    winner_count: "1",
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

      // Buscar vencedores de cada sorteio
      const drawingsWithWinners: Drawing[] = [];
      for (const d of drawingsData) {
        const { data: winners } = await supabase
          .from("consortium_winners")
          .select("id, participant_id")
          .eq("drawing_id", d.id);

        const winnersWithNames: Winner[] = await Promise.all(
          (winners || []).map(async (w) => {
            const participant = participants.find((p) => p.id === w.participant_id);
            // Buscar total de itens do vencedor
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
        notes: participantForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-participants", consortium.id] });
      queryClient.invalidateQueries({ queryKey: ["consortium-participant-counts"] });
      setIsAddParticipantOpen(false);
      setParticipantForm({ customer_name: "", customer_phone: "", payment_method: "dinheiro", notes: "" });
      toast.success("Participante adicionado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Realizar sorteio
  const drawingMutation = useMutation({
    mutationFn: async () => {
      const eligibleParticipants = participants.filter((p) => !p.is_drawn);
      const winnerCount = Math.min(parseInt(drawingForm.winner_count) || 1, eligibleParticipants.length);

      if (winnerCount === 0) {
        throw new Error("Não há participantes elegíveis para sorteio");
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

        // Marcar como sorteado
        await supabase
          .from("consortium_participants")
          .update({ is_drawn: true, drawn_at: new Date().toISOString() })
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
      toast.error("Erro: " + error.message);
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

  const eligibleCount = participants.filter((p) => !p.is_drawn).length;
  const drawnCount = participants.filter((p) => p.is_drawn).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{consortium.name}</h1>
            <p className="text-muted-foreground">
              {format(new Date(consortium.start_date), "dd/MM/yyyy", { locale: ptBR })} até{" "}
              {format(new Date(consortium.end_date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <Badge variant={consortium.is_active ? "default" : "secondary"} className="ml-auto">
            {consortium.is_active ? "Ativo" : "Finalizado"}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-xl font-bold">R$ {Number(consortium.total_value).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Calendar className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm text-muted-foreground">Parcelas</p>
              <p className="text-xl font-bold">
                {consortium.installments_count}x R$ {Number(consortium.installment_value).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <UserPlus className="h-6 w-6 mx-auto text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">Participantes</p>
              <p className="text-xl font-bold">{participants.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Trophy className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-sm text-muted-foreground">Sorteados</p>
              <p className="text-xl font-bold">
                {drawnCount}/{participants.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="participants" className="space-y-4">
          <TabsList>
            <TabsTrigger value="participants">Participantes</TabsTrigger>
            <TabsTrigger value="drawings">Sorteios</TabsTrigger>
          </TabsList>

          <TabsContent value="participants" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Participantes ({participants.length})</h2>
              <div className="flex gap-2">
                <Dialog open={isDrawingOpen} onOpenChange={setIsDrawingOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2" disabled={eligibleCount === 0}>
                      <Shuffle className="h-4 w-4" />
                      Realizar Sorteio
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Realizar Sorteio</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {eligibleCount} participante(s) elegível(is) para sorteio
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
                    <Button className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Adicionar Participante
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

            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Saldo Restante</TableHead>
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
                        // Encontrar o winner correspondente se foi sorteado
                        const winner = drawings.flatMap(d => d.winners).find(w => w.participant_id === p.id);
                        const remaining = winner ? Number(consortium.total_value) - winner.items_total : null;
                        
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.customer_name}</TableCell>
                            <TableCell>{p.customer_phone || "-"}</TableCell>
                            <TableCell className="capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                            <TableCell>
                              {p.is_drawn ? (
                                <Badge className="bg-yellow-500/10 text-yellow-500 gap-1">
                                  <Trophy className="h-3 w-3" />
                                  Sorteado
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Aguardando</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {winner ? (
                                <span className={remaining === 0 ? "text-green-500 font-medium" : remaining && remaining < 0 ? "text-destructive font-medium" : "font-medium"}>
                                  R$ {remaining?.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => setSelectedPaymentParticipant({ id: p.id, name: p.customer_name })}
                                >
                                  <DollarSign className="h-4 w-4" />
                                  Parcelas
                                </Button>
                                {winner && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => setSelectedWinner({ winnerId: winner.id, participantName: p.customer_name })}
                                  >
                                    <Package className="h-4 w-4" />
                                    Peças
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
                                {!p.is_drawn && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm("Remover participante?")) {
                                        removeParticipantMutation.mutate(p.id);
                                      }
                                    }}
                                  >
                                    <X className="h-4 w-4" />
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
            <Card className="bg-card border-border">
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
                                onClick={() => setSelectedWinner({ winnerId: w.id, participantName: w.participant_name })}
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
        </Tabs>
      </div>

      {/* Dialog de itens do vencedor */}
      {selectedWinner && (
        <ConsortiumItemsDialog
          winnerId={selectedWinner.winnerId}
          participantName={selectedWinner.participantName}
          consortiumValue={consortium.total_value}
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
          open={!!selectedPaymentParticipant}
          onOpenChange={(open) => !open && setSelectedPaymentParticipant(null)}
        />
      )}
    </MainLayout>
  );
}
