import { useState, useEffect } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { addMonths, format } from "date-fns";

const CATEGORY_OPTIONS: Record<string, string[]> = {
  fixed: ["Aluguel", "Internet/Telefone", "Assinaturas", "Contador"],
  variable: ["Frete", "Embalagens", "Impressões", "Sacolas/Caixas"],
  event: ["Gasolina", "Alimentação", "Stand/Espaço", "Material Divulgação", "Insumos (arara, cabides)"],
  other: [],
};

const TYPE_LABELS: Record<string, string> = {
  fixed: "Custo Fixo",
  variable: "Custo Variável",
  event: "Evento/Ação de Venda",
  other: "Outros",
};

interface Installment {
  number: number;
  amount: string;
  dueDate: string;
}

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingExpense?: any;
}

export function ExpenseFormDialog({ open, onOpenChange, editingExpense }: ExpenseFormDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [categoryType, setCategoryType] = useState("variable");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState("10");
  const [splitMode, setSplitMode] = useState("none");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [customSplitPercent, setCustomSplitPercent] = useState([50]);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("2");
  const [installments, setInstallments] = useState<Installment[]>([]);

  // Fetch user's active partnerships/groups
  const { data: groups = [] } = useQuery({
    queryKey: ["user-groups-expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, groups(id, name, cost_split_ratio)")
        .eq("user_id", user?.id!);
      if (error) throw error;
      return (data || []).map((gm: any) => gm.groups).filter(Boolean);
    },
    enabled: !!user,
  });

  // Fetch group members for selected group
  const { data: groupMembers = [] } = useQuery({
    queryKey: ["group-members-expense", selectedGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, profiles(id, full_name)")
        .eq("group_id", selectedGroupId);
      if (error) throw error;
      return (data || []).map((gm: any) => ({
        userId: gm.user_id,
        name: gm.profiles?.full_name || "Parceiro",
      }));
    },
    enabled: !!selectedGroupId,
  });

  // Generate installments when count or amount changes
  useEffect(() => {
    if (!isInstallment) return;
    const count = parseInt(installmentCount) || 2;
    const total = parseFloat(amount) || 0;
    const perInstallment = total > 0 ? (total / count).toFixed(2) : "0";
    const baseDate = new Date(expenseDate + "T12:00:00");

    const newInstallments: Installment[] = [];
    for (let i = 0; i < count; i++) {
      const dueDate = addMonths(baseDate, i);
      newInstallments.push({
        number: i + 1,
        amount: perInstallment,
        dueDate: format(dueDate, "yyyy-MM-dd"),
      });
    }
    setInstallments(newInstallments);
  }, [installmentCount, amount, expenseDate, isInstallment]);

  useEffect(() => {
    if (editingExpense) {
      setCategoryType(editingExpense.category_type);
      setCategory(editingExpense.category);
      setAmount(String(editingExpense.amount));
      setDescription(editingExpense.description || "");
      setExpenseDate(editingExpense.expense_date);
      setIsRecurring(editingExpense.is_recurring);
      setRecurringDay(String(editingExpense.recurring_day || 10));
      setSplitMode(editingExpense.split_mode);
      setSelectedGroupId(editingExpense.group_id || "");
      setCustomSplitPercent([editingExpense.custom_split_percent || 50]);
      setIsInstallment(editingExpense.is_installment || false);
      setInstallmentCount(String(editingExpense.installment_count || 2));
    } else {
      resetForm();
    }
  }, [editingExpense, open]);

  const resetForm = () => {
    setCategoryType("variable");
    setCategory("");
    setCustomCategory("");
    setAmount("");
    setDescription("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setIsRecurring(false);
    setRecurringDay("10");
    setSplitMode("none");
    setSelectedGroupId("");
    setCustomSplitPercent([50]);
    setIsInstallment(false);
    setInstallmentCount("2");
    setInstallments([]);
  };

  const updateInstallmentAmount = (index: number, value: string) => {
    setInstallments(prev => prev.map((inst, i) => i === index ? { ...inst, amount: value } : inst));
  };

  const updateInstallmentDate = (index: number, value: string) => {
    setInstallments(prev => prev.map((inst, i) => i === index ? { ...inst, dueDate: value } : inst));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalCategory = category === "__custom" ? customCategory : category;
      const expenseData: any = {
        owner_id: user!.id,
        amount: parseFloat(amount),
        category: finalCategory,
        category_type: categoryType,
        description: description || null,
        expense_date: expenseDate,
        is_recurring: isRecurring,
        recurring_day: isRecurring ? parseInt(recurringDay) : null,
        group_id: splitMode !== "none" && selectedGroupId ? selectedGroupId : null,
        split_mode: splitMode,
        custom_split_percent: splitMode === "custom" ? customSplitPercent[0] : null,
        is_installment: isInstallment,
        installment_count: isInstallment ? parseInt(installmentCount) : null,
      };

      let expenseId: string;

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update(expenseData)
          .eq("id", editingExpense.id);
        if (error) throw error;
        expenseId = editingExpense.id;

        // Delete old splits and installments to recreate
        await supabase.from("expense_splits").delete().eq("expense_id", expenseId);
        await supabase.from("expense_installments").delete().eq("expense_id", expenseId);
      } else {
        const { data, error } = await supabase
          .from("expenses")
          .insert(expenseData)
          .select("id")
          .single();
        if (error) throw error;
        expenseId = data.id;
      }

      // Create installments if enabled
      if (isInstallment && installments.length > 0) {
        const installmentRows = installments.map(inst => ({
          expense_id: expenseId,
          installment_number: inst.number,
          amount: parseFloat(inst.amount) || 0,
          due_date: inst.dueDate,
          is_paid: false,
        }));
        const { error: instError } = await supabase.from("expense_installments").insert(installmentRows);
        if (instError) throw instError;
      }

      // Create splits if partnership mode
      if (splitMode !== "none" && selectedGroupId && groupMembers.length > 0) {
        const totalAmount = parseFloat(amount);
        const selectedGroup = groups.find((g: any) => g.id === selectedGroupId);
        
        let myPercent: number;
        if (splitMode === "partnership_rules" && selectedGroup) {
          myPercent = selectedGroup.cost_split_ratio * 100;
        } else {
          myPercent = customSplitPercent[0];
        }

        const partnerPercent = 100 - myPercent;
        const myAmount = totalAmount * (myPercent / 100);
        const partners = groupMembers.filter((m: any) => m.userId !== user!.id);
        const perPartnerAmount = partners.length > 0 
          ? (totalAmount * (partnerPercent / 100)) / partners.length 
          : 0;

        const splits = [
          { expense_id: expenseId, user_id: user!.id, amount: myAmount, is_paid: true },
          ...partners.map((p: any) => ({
            expense_id: expenseId,
            user_id: p.userId,
            amount: perPartnerAmount,
            is_paid: false,
          })),
        ];

        const { error: splitError } = await supabase.from("expense_splits").insert(splits);
        if (splitError) throw splitError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-splits"] });
      queryClient.invalidateQueries({ queryKey: ["expense-installments"] });
      toast({ title: editingExpense ? "Despesa atualizada!" : "Despesa cadastrada!" });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Informe o valor", variant: "destructive" });
      return;
    }
    const finalCat = category === "__custom" ? customCategory : category;
    if (!finalCat) {
      toast({ title: "Informe a categoria", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const selectedGroup = groups.find((g: any) => g.id === selectedGroupId);
  const costSplitLabel = selectedGroup
    ? `${(selectedGroup.cost_split_ratio * 100).toFixed(0)}% / ${(100 - selectedGroup.cost_split_ratio * 100).toFixed(0)}%`
    : "50% / 50%";

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const installmentsTotal = installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingExpense ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={categoryType} onValueChange={(v) => { setCategoryType(v); setCategory(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS[categoryType]?.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                <SelectItem value="__custom">Outra (digitar)</SelectItem>
              </SelectContent>
            </Select>
            {category === "__custom" && (
              <Input
                placeholder="Nome da categoria..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Valor Total (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              placeholder="Ex: Feira Fitness em SP..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Installment toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label>Pagamento parcelado</Label>
              <p className="text-xs text-muted-foreground">Dividir em parcelas mensais</p>
            </div>
            <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
          </div>

          {/* Installment details */}
          {isInstallment && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-2">
                <Label>Número de parcelas</Label>
                <Input
                  type="number"
                  min={2}
                  max={24}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(e.target.value)}
                />
              </div>

              {installments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Parcelas</Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {installments.map((inst, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="w-8 text-muted-foreground shrink-0">{inst.number}x</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={inst.amount}
                          onChange={(e) => updateInstallmentAmount(idx, e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Input
                          type="date"
                          value={inst.dueDate}
                          onChange={(e) => updateInstallmentDate(idx, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="text-muted-foreground">Soma das parcelas:</span>
                    <span className={installmentsTotal !== parseFloat(amount || "0") ? "text-destructive font-bold" : "font-medium"}>
                      {formatCurrency(installmentsTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recurring */}
          {categoryType === "fixed" && !isInstallment && (
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label>Custo recorrente mensal</Label>
                <p className="text-xs text-muted-foreground">Repete todo mês</p>
              </div>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>
          )}
          {isRecurring && !isInstallment && (
            <div className="space-y-2">
              <Label>Dia do vencimento</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={recurringDay}
                onChange={(e) => setRecurringDay(e.target.value)}
              />
            </div>
          )}

          {/* Partnership Split */}
          {groups.length > 0 && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <Label className="font-semibold">Dividir com Parceria</Label>
              </div>

              <RadioGroup value={splitMode} onValueChange={setSplitMode} className="space-y-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="none" id="split-none" />
                  <Label htmlFor="split-none" className="text-sm">Sem divisão (100% minha)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="partnership_rules" id="split-rules" />
                  <Label htmlFor="split-rules" className="text-sm">Regras da parceria ({costSplitLabel})</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="custom" id="split-custom" />
                  <Label htmlFor="split-custom" className="text-sm">Divisão personalizada</Label>
                </div>
              </RadioGroup>

              {splitMode !== "none" && (
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a parceria..." /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {splitMode === "custom" && (
                <div className="space-y-2">
                  <Label className="text-sm">Eu pago: {customSplitPercent[0]}% | Parceiro(s): {100 - customSplitPercent[0]}%</Label>
                  <Slider
                    value={customSplitPercent}
                    onValueChange={setCustomSplitPercent}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : editingExpense ? "Atualizar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
