import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Calendar, DollarSign, Gift, Eye, Trash2, UserPlus, Trophy, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConsortiumDetails } from "@/components/consortium/ConsortiumDetails";

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
  created_at: string;
}

export default function Consortiums() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedConsortium, setSelectedConsortium] = useState<Consortium | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    total_value: "",
    installment_value: "",
    installments_count: "12",
    description: "",
  });

  const { data: consortiums = [], isLoading } = useQuery({
    queryKey: ["consortiums"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortiums")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Consortium[];
    },
    enabled: !!user,
  });

  const { data: participantCounts = {} } = useQuery({
    queryKey: ["consortium-participant-counts"],
    queryFn: async () => {
      const counts: Record<string, { total: number; drawn: number }> = {};
      for (const c of consortiums) {
        const { data } = await supabase
          .from("consortium_participants")
          .select("id, is_drawn")
          .eq("consortium_id", c.id);
        counts[c.id] = {
          total: data?.length || 0,
          drawn: data?.filter(p => p.is_drawn).length || 0,
        };
      }
      return counts;
    },
    enabled: consortiums.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("consortiums").insert({
        owner_id: user.id,
        name: formData.name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        total_value: parseFloat(formData.total_value) || 0,
        installment_value: parseFloat(formData.installment_value) || 0,
        installments_count: parseInt(formData.installments_count) || 12,
        description: formData.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortiums"] });
      setIsCreateOpen(false);
      setFormData({
        name: "",
        start_date: "",
        end_date: "",
        total_value: "",
        installment_value: "",
        installments_count: "12",
        description: "",
      });
      toast.success("Consórcio criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar consórcio: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consortiums").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortiums"] });
      toast.success("Consórcio excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const activeConsortiums = consortiums.filter(c => c.is_active);
  const totalParticipants = Object.values(participantCounts).reduce((sum, c) => sum + c.total, 0);
  const totalDrawn = Object.values(participantCounts).reduce((sum, c) => sum + c.drawn, 0);

  if (selectedConsortium) {
    return (
      <ConsortiumDetails
        consortium={selectedConsortium}
        onBack={() => setSelectedConsortium(null)}
      />
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Consórcios</h1>
            <p className="text-muted-foreground">Gerencie seus grupos de consórcio</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Consórcio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Consórcio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do Grupo</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Consórcio Janeiro 2025"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor Total (R$)</Label>
                    <Input
                      type="number"
                      value={formData.total_value}
                      onChange={(e) => setFormData({ ...formData, total_value: e.target.value })}
                      placeholder="500,00"
                    />
                  </div>
                  <div>
                    <Label>Valor Parcela (R$)</Label>
                    <Input
                      type="number"
                      value={formData.installment_value}
                      onChange={(e) => setFormData({ ...formData, installment_value: e.target.value })}
                      placeholder="50,00"
                    />
                  </div>
                </div>
                <div>
                  <Label>Quantidade de Parcelas</Label>
                  <Input
                    type="number"
                    value={formData.installments_count}
                    onChange={(e) => setFormData({ ...formData, installments_count: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalhes sobre o consórcio..."
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !formData.name || !formData.start_date || !formData.end_date}
                  className="w-full"
                >
                  {createMutation.isPending ? "Criando..." : "Criar Consórcio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Consórcios</p>
                  <p className="text-2xl font-bold">{consortiums.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Calendar className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-2xl font-bold">{activeConsortiums.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Participantes</p>
                  <p className="text-2xl font-bold">{totalParticipants}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sorteados</p>
                  <p className="text-2xl font-bold">{totalDrawn}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Consórcios */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Grupos de Consórcio</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : consortiums.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum consórcio criado ainda.</p>
                <p className="text-sm">Crie seu primeiro consórcio clicando no botão acima.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consortiums.map((consortium) => {
                      const counts = participantCounts[consortium.id] || { total: 0, drawn: 0 };
                      return (
                        <TableRow key={consortium.id}>
                          <TableCell className="font-medium">{consortium.name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{format(new Date(consortium.start_date), "dd/MM/yyyy", { locale: ptBR })}</div>
                              <div className="text-muted-foreground">
                                até {format(new Date(consortium.end_date), "dd/MM/yyyy", { locale: ptBR })}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">R$ {Number(consortium.total_value).toFixed(2)}</div>
                              <div className="text-muted-foreground">
                                {consortium.installments_count}x R$ {Number(consortium.installment_value).toFixed(2)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{consortium.installments_count}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{counts.total}</span>
                              {counts.drawn > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {counts.drawn} sorteados
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={consortium.is_active ? "default" : "secondary"}>
                              {consortium.is_active ? "Ativo" : "Finalizado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedConsortium(consortium)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Excluir este consórcio?")) {
                                    deleteMutation.mutate(consortium.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
