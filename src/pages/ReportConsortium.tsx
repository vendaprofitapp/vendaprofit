import { useState, useMemo } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, DollarSign, Users, Hash, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, startOfWeek, startOfYear, startOfDay, endOfDay, subDays, subMonths, parseISO } from "date-fns";
import { useConsortiumPaymentsInPeriod } from "@/hooks/useConsortiumPaymentsInPeriod";
import { downloadXlsx } from "@/utils/xlsExport";
import { toast } from "sonner";

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "year", label: "Este Ano" },
  { value: "last7days", label: "Últimos 7 dias" },
  { value: "last30days", label: "Últimos 30 dias" },
  { value: "last12months", label: "Últimos 12 meses" },
];

export default function ReportConsortium() {
  const { user } = useAuth();
  const [period, setPeriod] = useFormPersistence("report_consortium_period", "month");

  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    const end = endOfDay(now);
    switch (period) {
      case "today": start = startOfDay(now); break;
      case "week": start = startOfWeek(now, { weekStartsOn: 0 }); break;
      case "month": start = startOfMonth(now); break;
      case "year": start = startOfYear(now); break;
      case "last7days": start = subDays(now, 7); break;
      case "last30days": start = subDays(now, 30); break;
      case "last12months": start = subMonths(now, 12); break;
      default: start = startOfMonth(now);
    }
    return { start, end };
  }, [period]);

  const { consortiumPayments, totalConsortiumRevenue, isLoading } = useConsortiumPaymentsInPeriod(user?.id, dateRange);

  // Group by consortium
  const byConsortium = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const p of consortiumPayments) {
      const existing = map.get(p.consortium_id) || { name: p.consortium_name, total: 0, count: 0 };
      existing.total += p.amount;
      existing.count += 1;
      map.set(p.consortium_id, existing);
    }
    return Array.from(map.values());
  }, [consortiumPayments]);

  const handleExport = () => {
    if (consortiumPayments.length === 0) { toast.error("Nenhum dado para exportar"); return; }
    const headers = ["Data Pgto", "Consórcio", "Participante", "Parcela", "Valor"];
    const rows = consortiumPayments.map(p => [
      format(parseISO(p.paid_at), "dd/MM/yyyy HH:mm"),
      p.consortium_name,
      p.participant_name,
      p.installment_number,
      p.amount,
    ]);
    rows.push(["TOTAL", "", "", "", totalConsortiumRevenue]);
    downloadXlsx([headers, ...rows], "Consórcios", `relatorio-consorcios-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Relatório exportado!");
  };

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Rel. Consórcios</h1>
              <p className="text-muted-foreground">Pagamentos de parcelas recebidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalConsortiumRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Parcelas Pagas</CardTitle>
              <Hash className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{consortiumPayments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consórcios Ativos</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{byConsortium.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* By Consortium Summary */}
        {byConsortium.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {byConsortium.map((c, i) => (
              <Card key={i} className="border-primary/10">
                <CardContent className="pt-4 pb-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate">{c.name}</span>
                    <Badge variant="secondary">{c.count} parcelas</Badge>
                  </div>
                  <p className="text-lg font-bold text-primary mt-1">{formatCurrency(c.total)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Pgto</TableHead>
                    <TableHead>Consórcio</TableHead>
                    <TableHead>Participante</TableHead>
                    <TableHead className="text-center">Parcela</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : consortiumPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum pagamento no período</TableCell></TableRow>
                  ) : (
                    consortiumPayments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">{format(parseISO(p.paid_at), "dd/MM/yyyy HH:mm")}</TableCell>
                        <TableCell>{p.consortium_name}</TableCell>
                        <TableCell>{p.participant_name}</TableCell>
                        <TableCell className="text-center">{p.installment_number}ª</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {consortiumPayments.length > 0 && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={4}>TOTAL</TableCell>
                      <TableCell className="text-right text-primary">{formatCurrency(totalConsortiumRevenue)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
