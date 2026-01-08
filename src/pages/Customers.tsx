import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Users,
  Phone,
  ShoppingBag,
  Calendar,
  MessageCircle,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sale {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  created_at: string;
  payment_method: string;
  sale_items?: {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
}

interface Customer {
  name: string;
  phone: string;
  totalPurchases: number;
  totalSpent: number;
  lastPurchase: string;
  purchaseCount: number;
  sales: Sale[];
}

export default function Customers() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch all sales with customer data
  const { data: salesData = [], isLoading } = useQuery({
    queryKey: ["sales-with-customers", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          customer_name,
          customer_phone,
          total,
          created_at,
          payment_method,
          sale_items (
            id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user?.id,
  });

  // Aggregate customers from sales data
  const customers = useMemo(() => {
    const customerMap = new Map<string, Customer>();

    salesData.forEach((sale) => {
      // Only include sales with customer phone (required for WhatsApp)
      if (!sale.customer_phone) return;

      const phone = sale.customer_phone.replace(/\D/g, "");
      const name = sale.customer_name || "Cliente sem nome";

      if (customerMap.has(phone)) {
        const existing = customerMap.get(phone)!;
        existing.totalSpent += Number(sale.total);
        existing.purchaseCount += 1;
        existing.sales.push(sale);
        if (new Date(sale.created_at) > new Date(existing.lastPurchase)) {
          existing.lastPurchase = sale.created_at;
          existing.name = name; // Update name to most recent
        }
      } else {
        customerMap.set(phone, {
          name,
          phone: sale.customer_phone,
          totalPurchases: 1,
          totalSpent: Number(sale.total),
          lastPurchase: sale.created_at,
          purchaseCount: 1,
          sales: [sale],
        });
      }
    });

    return Array.from(customerMap.values()).sort(
      (a, b) => b.totalSpent - a.totalSpent
    );
  }, [salesData]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term)
    );
  }, [customers, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = customers.length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgTicket = total > 0 ? totalRevenue / customers.reduce((sum, c) => sum + c.purchaseCount, 0) : 0;
    const recurrentCustomers = customers.filter((c) => c.purchaseCount > 1).length;

    return { total, totalRevenue, avgTicket, recurrentCustomers };
  }, [customers]);

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const openWhatsApp = (phone: string, name: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const countryCode = cleaned.startsWith("55") ? "" : "55";
    const message = encodeURIComponent(
      `Olá ${name}! 👋\n\nTemos novidades especiais para você! Confira nossos lançamentos e promoções exclusivas.`
    );
    window.open(
      `https://wa.me/${countryCode}${cleaned}?text=${message}`,
      "_blank"
    );
  };

  const viewCustomerDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Relatório de Clientes
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus clientes e envie mensagens via WhatsApp
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Clientes
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Total
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ticket Médio
              </CardTitle>
              <ShoppingBag className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats.avgTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clientes Recorrentes
              </CardTitle>
              <User className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recurrentCustomers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${((stats.recurrentCustomers / stats.total) * 100).toFixed(0)}% do total`
                  : "0% do total"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Clientes ({filteredCustomers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente encontrado</p>
                <p className="text-sm mt-1">
                  Clientes são cadastrados automaticamente ao registrar vendas com nome e telefone
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-center">Compras</TableHead>
                      <TableHead className="text-right">Total Gasto</TableHead>
                      <TableHead>Última Compra</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.phone}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{customer.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {formatPhone(customer.phone)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={customer.purchaseCount > 1 ? "default" : "secondary"}>
                            {customer.purchaseCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {customer.totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(customer.lastPurchase), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewCustomerDetails(customer)}
                            >
                              Ver Histórico
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => openWhatsApp(customer.phone, customer.name)}
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              WhatsApp
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Details Dialog */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Histórico do Cliente
              </DialogTitle>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{selectedCustomer.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhone(selectedCustomer.phone)}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => openWhatsApp(selectedCustomer.phone, selectedCustomer.name)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">
                      {selectedCustomer.purchaseCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Compras</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      R$ {selectedCustomer.totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Gasto</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      R$ {(selectedCustomer.totalSpent / selectedCustomer.purchaseCount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  </div>
                </div>

                {/* Purchase History */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Histórico de Compras
                  </h4>
                  <div className="space-y-3">
                    {selectedCustomer.sales.map((sale) => (
                      <div key={sale.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                          <Badge variant="outline">{sale.payment_method}</Badge>
                        </div>
                        
                        {sale.sale_items && sale.sale_items.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {sale.sale_items.map((item) => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span>
                                  {item.quantity}x {item.product_name}
                                </span>
                                <span className="text-muted-foreground">
                                  R$ {Number(item.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center mt-3 pt-2 border-t">
                          <span className="font-medium">Total</span>
                          <span className="font-bold text-primary">
                            R$ {Number(sale.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
