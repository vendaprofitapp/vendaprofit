import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { EditSaleDialog } from "@/components/sales/EditSaleDialog";
import {
  Clock, DollarSign, AlertTriangle, CheckCircle2, Send, Edit2,
  User, CalendarDays, Download, TrendingUp,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isPast, isToday } from "date-fns";
import { downloadXlsx } from "@/utils/xlsExport";
import { toast } from "sonner";

export default function ReportDeferredSales() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [editSale, setEditSale] = useState<any>(null);
  const [editSaleItems, setEditSaleItems] = useState<any[]>([]);

  // Fetch deferred payment method names
  const { data: deferredMethods = [] } = useQuery({
    queryKey: ["deferred-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("name")
        .eq("owner_id", user!.id)
        .eq("is_deferred", true);
      if (error) throw error;
      return data.map((m) => m.name);
    },
    enabled: !!user,
  });

  // Fetch payment reminders with sale info
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["deferred-report-reminders", user?.id, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("payment_reminders")
        .select("*")
        .eq("owner_id", user!.id)
        .order("due_date", { ascending: true });

      if (dateFrom) query = query.gte("due_date", dateFrom);
      if (dateTo) query = query.lte("due_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch sales for reminders that have sale_id
  const saleIds = useMemo(() => {
    const ids = new Set<string>();
    reminders.forEach((r) => { if (r.sale_id) ids.add(r.sale_id); });
    return Array.from(ids);
  }, [reminders]);

  const { data: salesData = [] } = useQuery({
    queryKey: ["deferred-report-sales", saleIds],
    queryFn: async () => {
      if (saleIds.length === 0) return [];
      const results: any[] = [];
      for (let i = 0; i < saleIds.length; i += 500) {
        const chunk = saleIds.slice(i, i + 500);
        const { data, error } = await supabase
          .from("sales")
          .select("id, customer_name, customer_phone, payment_method, subtotal, discount_type, discount_value, discount_amount, total, status, notes, created_at, shipping_cost, shipping_payer, sale_items(id, product_id, product_name, quantity, unit_price, total)")
          .in("id", chunk);
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: saleIds.length > 0,
  });

  const salesMap = useMemo(() => {
    const map = new Map<string, any>();
    salesData.forEach((s) => map.set(s.id, s));
    return map;
  }, [salesData]);

  // Custom payment methods for edit dialog
  const { data: customPaymentMethods = [] } = useQuery({
    queryKey: ["custom-pm-deferred", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("id, name, fee_percent, is_deferred, is_active")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Enrich reminders
  const enrichedReminders = useMemo(() => {
    return reminders.map((r) => {
      const sale = r.sale_id ? salesMap.get(r.sale_id) : null;
      const dueDate = parseISO(r.due_date);
      const overdue = !r.is_paid && isPast(dueDate) && !isToday(dueDate);
      const dueToday = !r.is_paid && isToday(dueDate);
      return { ...r, sale, overdue, dueToday };
    });
  }, [reminders, salesMap]);

  // Filter
  const filtered = useMemo(() => {
    return enrichedReminders.filter((r) => {
      if (statusFilter === "pending") return !r.is_paid && !r.overdue;
      if (statusFilter === "paid") return r.is_paid;
      if (statusFilter === "overdue") return r.overdue;
      return true;
    });
  }, [enrichedReminders, statusFilter]);

  // Group by customer
  const byCustomer = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((r) => {
      const key = r.customer_name || r.customer_phone || "Sem identificação";
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const aTotal = a[1].reduce((s, r) => s + (r.is_paid ? 0 : r.amount), 0);
      const bTotal = b[1].reduce((s, r) => s + (r.is_paid ? 0 : r.amount), 0);
      return bTotal - aTotal;
    });
  }, [filtered]);

  // Summary
  const summary = useMemo(() => {
    const total = enrichedReminders.reduce((s, r) => s + r.amount, 0);
    const paid = enrichedReminders.filter((r) => r.is_paid).reduce((s, r) => s + r.amount, 0);
    const pending = enrichedReminders.filter((r) => !r.is_paid && !r.overdue).reduce((s, r) => s + r.amount, 0);
    const overdue = enrichedReminders.filter((r) => r.overdue).reduce((s, r) => s + r.amount, 0);
    const overdueCount = enrichedReminders.filter((r) => r.overdue).length;
    return { total, paid, pending, overdue, overdueCount, count: enrichedReminders.length };
  }, [enrichedReminders]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleMarkPaid = async (reminderId: string) => {
    const { error } = await supabase
      .from("payment_reminders")
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq("id", reminderId);
    if (error) {
      toast.error("Erro ao marcar como paga");
      return;
    }

    // Check if all reminders for this sale are paid → update sale status
    const reminder = reminders.find((r) => r.id === reminderId);
    if (reminder?.sale_id) {
      const { data: remaining } = await supabase
        .from("payment_reminders")
        .select("id")
        .eq("sale_id", reminder.sale_id)
        .eq("is_paid", false)
        .neq("id", reminderId);
      if (!remaining || remaining.length === 0) {
        await supabase.from("sales").update({ status: "completed" }).eq("id", reminder.sale_id);
      }
    }

    toast.success("Parcela marcada como paga!");
    queryClient.invalidateQueries({ queryKey: ["deferred-report-reminders"] });
    queryClient.invalidateQueries({ queryKey: ["deferred-report-sales"] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
    queryClient.invalidateQueries({ queryKey: ["payment-reminders"] });
  };

  const handleMarkUnpaid = async (reminderId: string) => {
    const { error } = await supabase
      .from("payment_reminders")
      .update({ is_paid: false, paid_at: null })
      .eq("id", reminderId);
    if (error) {
      toast.error("Erro ao desfazer");
      return;
    }

    const reminder = reminders.find((r) => r.id === reminderId);
    if (reminder?.sale_id) {
      await supabase.from("sales").update({ status: "pending" }).eq("id", reminder.sale_id);
    }

    toast.success("Parcela marcada como pendente");
    queryClient.invalidateQueries({ queryKey: ["deferred-report-reminders"] });
    queryClient.invalidateQueries({ queryKey: ["deferred-report-sales"] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
    queryClient.invalidateQueries({ queryKey: ["payment-reminders"] });
  };

  const handleSendReminder = (reminder: any) => {
    const phone = reminder.customer_phone?.replace(/\D/g, "") || "";
    if (!phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    const msg = `Olá ${reminder.customer_name || ""}! 😊\n\nLembrete de pagamento:\n💰 Valor: ${fmt(reminder.amount)}\n📅 Vencimento: ${format(parseISO(reminder.due_date), "dd/MM/yyyy")}\n💳 Forma: ${reminder.payment_method_name}\n\nQualquer dúvida, estou à disposição! 🙏`;
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleEditSale = (saleId: string) => {
    const sale = salesMap.get(saleId);
    if (!sale) {
      toast.error("Venda não encontrada");
      return;
    }
    setEditSale(sale);
    setEditSaleItems(sale.sale_items || []);
  };

  const handleExport = () => {
    if (filtered.length === 0) { toast.error("Nenhum dado"); return; }
    const headers = ["Cliente", "Telefone", "Valor", "Vencimento", "Status", "Forma Pgto", "Pago em", "Venda ID"];
    const rows = filtered.map((r) => [
      r.customer_name || "—",
      r.customer_phone || "—",
      r.amount,
      format(parseISO(r.due_date), "dd/MM/yyyy"),
      r.is_paid ? "Pago" : r.overdue ? "Vencido" : "Pendente",
      r.payment_method_name,
      r.paid_at ? format(parseISO(r.paid_at), "dd/MM/yyyy") : "—",
      r.sale_id?.slice(0, 8) || "—",
    ]);
    downloadXlsx([headers, ...rows], "Vendas a Prazo", "vendas-a-prazo.xlsx");
    toast.success("Exportado!");
  };

  const ReminderStatusBadge = ({ r }: { r: any }) => {
    if (r.is_paid) return <Badge className="bg-green-600 hover:bg-green-700">Pago</Badge>;
    if (r.overdue) return <Badge variant="destructive">Vencido</Badge>;
    if (r.dueToday) return <Badge className="bg-amber-500 hover:bg-amber-600">Vence Hoje</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const ReminderRow = ({ r }: { r: any }) => (
    <TableRow key={r.id} className={r.overdue ? "bg-destructive/5" : r.dueToday ? "bg-amber-500/5" : ""}>
      <TableCell>
        <div>
          <p className="font-medium">{r.customer_name || "—"}</p>
          <p className="text-xs text-muted-foreground">{r.customer_phone || ""}</p>
        </div>
      </TableCell>
      <TableCell className="font-mono font-semibold">{fmt(r.amount)}</TableCell>
      <TableCell>{format(parseISO(r.due_date), "dd/MM/yyyy")}</TableCell>
      <TableCell><ReminderStatusBadge r={r} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{r.payment_method_name}</TableCell>
      <TableCell>
        {r.sale?.sale_items?.map((item: any) => (
          <p key={item.id} className="text-xs">{item.quantity}x {item.product_name}</p>
        )) || <span className="text-xs text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {!r.is_paid ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleMarkPaid(r.id)}>
              <CheckCircle2 className="h-3 w-3" /> Pago
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleMarkUnpaid(r.id)}>
              Desfazer
            </Button>
          )}
          {!r.is_paid && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleSendReminder(r)}>
              <Send className="h-3 w-3" /> Cobrar
            </Button>
          )}
          {r.sale_id && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleEditSale(r.sale_id)}>
              <Edit2 className="h-3 w-3" /> Editar
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Vendas a Prazo</h1>
              <p className="text-muted-foreground text-sm">Controle detalhado de parcelas e cobranças</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar XLS
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vencimento De</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vencimento Até</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="col-span-2 flex items-end gap-2 flex-wrap">
                {(["all", "pending", "overdue", "paid"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : s === "overdue" ? "Vencidos" : "Pagos"}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Total a Prazo</p>
              <p className="text-lg font-bold">{fmt(summary.total)}</p>
              <p className="text-xs text-muted-foreground">{summary.count} parcelas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-lg font-bold text-green-600">{fmt(summary.paid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-amber-500 mb-1" />
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-lg font-bold text-amber-500">{fmt(summary.pending)}</p>
            </CardContent>
          </Card>
          <Card className={summary.overdueCount > 0 ? "border-destructive/50" : ""}>
            <CardContent className="pt-4 pb-4 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto text-destructive mb-1" />
              <p className="text-xs text-muted-foreground">Vencido</p>
              <p className="text-lg font-bold text-destructive">{fmt(summary.overdue)}</p>
              {summary.overdueCount > 0 && (
                <p className="text-xs text-destructive">{summary.overdueCount} parcela(s)</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="by-due-date">
          <TabsList>
            <TabsTrigger value="by-due-date" className="gap-1">
              <CalendarDays className="h-4 w-4" /> Por Vencimento
            </TabsTrigger>
            <TabsTrigger value="by-customer" className="gap-1">
              <User className="h-4 w-4" /> Por Cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="by-due-date" className="mt-4">
            <Card>
              <CardContent className="pt-4 pb-2">
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma parcela encontrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Forma Pgto</TableHead>
                          <TableHead>Produtos</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r) => (
                          <ReminderRow key={r.id} r={r} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-customer" className="mt-4 space-y-4">
            {byCustomer.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma parcela encontrada
                </CardContent>
              </Card>
            ) : (
              byCustomer.map(([customer, items]) => {
                const totalPending = items.filter((r) => !r.is_paid).reduce((s, r) => s + r.amount, 0);
                const totalPaid = items.filter((r) => r.is_paid).reduce((s, r) => s + r.amount, 0);
                const hasOverdue = items.some((r) => r.overdue);
                return (
                  <Card key={customer} className={hasOverdue ? "border-destructive/30" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {customer}
                          {hasOverdue && <Badge variant="destructive" className="text-xs">Vencido</Badge>}
                        </CardTitle>
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">Pendente: <span className="font-bold text-foreground">{fmt(totalPending)}</span></p>
                          {totalPaid > 0 && <p className="text-xs text-green-600">Pago: {fmt(totalPaid)}</p>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Valor</TableHead>
                              <TableHead>Vencimento</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Forma Pgto</TableHead>
                              <TableHead>Produtos</TableHead>
                              <TableHead>Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((r) => (
                              <TableRow key={r.id} className={r.overdue ? "bg-destructive/5" : r.dueToday ? "bg-amber-500/5" : ""}>
                                <TableCell className="font-mono font-semibold">{fmt(r.amount)}</TableCell>
                                <TableCell>{format(parseISO(r.due_date), "dd/MM/yyyy")}</TableCell>
                                <TableCell><ReminderStatusBadge r={r} /></TableCell>
                                <TableCell className="text-xs text-muted-foreground">{r.payment_method_name}</TableCell>
                                <TableCell>
                                  {r.sale?.sale_items?.map((item: any) => (
                                    <p key={item.id} className="text-xs">{item.quantity}x {item.product_name}</p>
                                  )) || <span className="text-xs text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {!r.is_paid ? (
                                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleMarkPaid(r.id)}>
                                        <CheckCircle2 className="h-3 w-3" /> Pago
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleMarkUnpaid(r.id)}>
                                        Desfazer
                                      </Button>
                                    )}
                                    {!r.is_paid && (
                                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleSendReminder(r)}>
                                        <Send className="h-3 w-3" /> Cobrar
                                      </Button>
                                    )}
                                    {r.sale_id && (
                                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleEditSale(r.sale_id)}>
                                        <Edit2 className="h-3 w-3" /> Editar
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Sale Dialog */}
      <EditSaleDialog
        open={!!editSale}
        onOpenChange={(open) => { if (!open) { setEditSale(null); setEditSaleItems([]); } }}
        sale={editSale}
        saleItems={editSaleItems}
        customPaymentMethods={customPaymentMethods}
        userId={user?.id || ""}
      />
    </MainLayout>
  );
}
