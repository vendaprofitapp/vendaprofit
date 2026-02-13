import { useState } from "react";
import { Plus, Pencil, Trash2, Users, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExpenseFormDialog } from "./ExpenseFormDialog";

const TYPE_LABELS: Record<string, string> = {
  fixed: "Fixo",
  variable: "Variável",
  event: "Evento",
  other: "Outro",
};

const TYPE_COLORS: Record<string, string> = {
  fixed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  variable: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  event: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

interface ExpensesListProps {
  dateRange: { start: Date; end: Date };
}

export function ExpensesList({ dateRange }: ExpensesListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", user?.id, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, groups(name)")
        .eq("owner_id", user?.id!)
        .gte("expense_date", dateRange.start.toISOString().split("T")[0])
        .lte("expense_date", dateRange.end.toISOString().split("T")[0])
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch user's splits to know their actual portion
  const { data: mySplits = [] } = useQuery({
    queryKey: ["expense-splits-mine", user?.id, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_splits")
        .select("expense_id, amount")
        .eq("user_id", user?.id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-splits"] });
      toast({ title: "Despesa excluída!" });
      setDeleteId(null);
    },
  });

  const filtered = filterType === "all" ? expenses : expenses.filter((e: any) => e.category_type === filterType);

  const totals = filtered.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category_type] = (acc[e.category_type] || 0) + e.amount;
    acc.total = (acc.total || 0) + e.amount;
    return acc;
  }, { total: 0 });

  // Map of my portion per expense
  const mySplitMap = new Map<string, number>();
  mySplits.forEach((s: any) => mySplitMap.set(s.expense_id, s.amount));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="fixed">Custos Fixos</SelectItem>
              <SelectItem value="variable">Custos Variáveis</SelectItem>
              <SelectItem value="event">Eventos</SelectItem>
              <SelectItem value="other">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditingExpense(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Despesa
        </Button>
      </div>

      {/* Category Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <Card key={key} className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{formatCurrency(totals[key] || 0)}</p>
          </Card>
        ))}
      </div>

      {/* Expenses Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma despesa cadastrada neste período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Minha Parte</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((expense: any) => {
                    const myPart = expense.split_mode !== "none" && mySplitMap.has(expense.id)
                      ? mySplitMap.get(expense.id)!
                      : expense.amount;

                    return (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(expense.expense_date + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{expense.category}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className={TYPE_COLORS[expense.category_type]}>
                              {TYPE_LABELS[expense.category_type]}
                            </Badge>
                            {expense.split_mode !== "none" && (
                              <Users className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {expense.description || "-"}
                          {expense.groups?.name && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({expense.groups.name})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCurrency(myPart)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setEditingExpense(expense); setFormOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteId(expense.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

      {/* Total */}
      <div className="text-right">
        <span className="text-muted-foreground">Total no período: </span>
        <span className="text-xl font-bold">{formatCurrency(totals.total || 0)}</span>
      </div>

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingExpense={editingExpense}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os splits com parceiros também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
