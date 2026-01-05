import { useState } from "react";
import { Plus, Search, Calendar, ShoppingCart, Eye } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const sales = [
  { id: "VND001", date: "05/01/2026", customer: "Maria Silva", items: 3, total: 289.70, status: "completed" },
  { id: "VND002", date: "05/01/2026", customer: "João Santos", items: 1, total: 79.90, status: "completed" },
  { id: "VND003", date: "05/01/2026", customer: "Ana Costa", items: 2, total: 179.80, status: "pending" },
  { id: "VND004", date: "04/01/2026", customer: "Pedro Oliveira", items: 4, total: 399.60, status: "completed" },
  { id: "VND005", date: "04/01/2026", customer: "Carla Mendes", items: 1, total: 249.90, status: "cancelled" },
  { id: "VND006", date: "04/01/2026", customer: "Lucas Ferreira", items: 2, total: 139.80, status: "completed" },
  { id: "VND007", date: "03/01/2026", customer: "Juliana Alves", items: 5, total: 549.50, status: "completed" },
  { id: "VND008", date: "03/01/2026", customer: "Ricardo Lima", items: 1, total: 89.90, status: "pending" },
];

const statusConfig = {
  completed: { label: "Concluída", variant: "default" as const },
  pending: { label: "Pendente", variant: "secondary" as const },
  cancelled: { label: "Cancelada", variant: "destructive" as const },
};

export default function Sales() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSales = sales.filter(
    (sale) =>
      sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground">Acompanhe e gerencie suas vendas</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Venda
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Vendas Hoje</p>
          <p className="text-2xl font-bold">R$ 549,40</p>
          <p className="text-xs text-success">+15% vs ontem</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Vendas do Mês</p>
          <p className="text-2xl font-bold">R$ 23.847</p>
          <p className="text-xs text-success">+8% vs mês passado</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-bold">R$ 156,30</p>
          <p className="text-xs text-muted-foreground">baseado em 153 vendas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por ID ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Calendar className="h-4 w-4 mr-2" />
          Período
        </Button>
      </div>

      {/* Sales Table */}
      <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.map((sale) => {
              const status = statusConfig[sale.status as keyof typeof statusConfig];
              return (
                <TableRow key={sale.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">{sale.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                  <TableCell className="font-medium">{sale.customer}</TableCell>
                  <TableCell>{sale.items} produto{sale.items > 1 ? "s" : ""}</TableCell>
                  <TableCell className="font-semibold">
                    R$ {sale.total.toFixed(2).replace(".", ",")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
}
