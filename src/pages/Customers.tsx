import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  Plus,
  Edit,
  Trash2,
  Camera,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

interface SaleData {
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

interface CustomerWithSales extends Customer {
  totalSpent: number;
  purchaseCount: number;
  lastPurchase: string | null;
  sales: SaleData[];
}

export default function Customers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithSales | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    photo_url: "",
  });

  // Fetch customers from database
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("owner_id", user.id)
        .order("name");

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!user?.id,
  });

  // Fetch sales data to merge with customers
  const { data: salesData = [] } = useQuery({
    queryKey: ["sales-for-customers", user?.id],
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
      return data as SaleData[];
    },
    enabled: !!user?.id,
  });

  // Merge customers with their sales data
  const customersWithSales = useMemo(() => {
    return customers.map((customer) => {
      // Find sales that match by phone
      const customerSales = salesData.filter(
        (sale) =>
          sale.customer_phone &&
          customer.phone &&
          sale.customer_phone.replace(/\D/g, "") === customer.phone.replace(/\D/g, "")
      );

      const totalSpent = customerSales.reduce((sum, s) => sum + Number(s.total), 0);
      const lastPurchase = customerSales.length > 0 ? customerSales[0].created_at : null;

      return {
        ...customer,
        totalSpent,
        purchaseCount: customerSales.length,
        lastPurchase,
        sales: customerSales,
      } as CustomerWithSales;
    });
  }, [customers, salesData]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customersWithSales;
    const term = searchTerm.toLowerCase();
    return customersWithSales.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.email?.toLowerCase().includes(term)
    );
  }, [customersWithSales, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = customersWithSales.length;
    const totalRevenue = customersWithSales.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalPurchases = customersWithSales.reduce((sum, c) => sum + c.purchaseCount, 0);
    const avgTicket = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;
    const recurrentCustomers = customersWithSales.filter((c) => c.purchaseCount > 1).length;

    return { total, totalRevenue, avgTicket, recurrentCustomers };
  }, [customersWithSales]);

  // Create/Update customer mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update({
            name: formData.name,
            phone: formData.phone || null,
            email: formData.email || null,
            notes: formData.notes || null,
            photo_url: formData.photo_url || null,
          })
          .eq("id", editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({
          owner_id: user.id,
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          notes: formData.notes || null,
          photo_url: formData.photo_url || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editingCustomer ? "Cliente atualizado!" : "Cliente cadastrado!");
      closeForm();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Delete customer mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente removido!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const handlePhotoUpload = async (file: File) => {
    if (!user?.id) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("customer-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("customer-photos")
        .getPublicUrl(fileName);

      setFormData({ ...formData, photo_url: data.publicUrl });
      toast.success("Foto enviada!");
    } catch (error: any) {
      toast.error("Erro ao enviar foto: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const openNewForm = () => {
    setEditingCustomer(null);
    setFormData({ name: "", phone: "", email: "", notes: "", photo_url: "" });
    setIsFormOpen(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
      photo_url: customer.photo_url || "",
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
    setFormData({ name: "", phone: "", email: "", notes: "", photo_url: "" });
  };

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
    window.open(`https://wa.me/${countryCode}${cleaned}?text=${message}`, "_blank");
  };

  const viewCustomerDetails = (customer: CustomerWithSales) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground">
              Gerencie seus clientes e envie mensagens via WhatsApp
            </p>
          </div>
          <Button onClick={openNewForm} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
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
                placeholder="Buscar por nome, telefone ou email..."
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
                <p className="text-sm mt-1">Clique em "Novo Cliente" para cadastrar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead className="text-center">Compras</TableHead>
                      <TableHead className="text-right">Total Gasto</TableHead>
                      <TableHead>Última Compra</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              {customer.photo_url ? (
                                <AvatarImage src={customer.photo_url} alt={customer.name} />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(customer.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{customer.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {customer.phone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {formatPhone(customer.phone)}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {customer.email}
                              </div>
                            )}
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
                          {customer.lastPurchase ? (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(customer.lastPurchase), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewCustomerDetails(customer)}
                            >
                              Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditForm(customer)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {customer.phone && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => openWhatsApp(customer.phone!, customer.name)}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm("Remover este cliente?")) {
                                  deleteMutation.mutate(customer.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
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

        {/* Customer Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Photo upload */}
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    {formData.photo_url ? (
                      <AvatarImage src={formData.photo_url} alt="Foto" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {formData.name ? getInitials(formData.name) : <User className="h-8 w-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                    }}
                  />
                </div>
              </div>

              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações sobre o cliente..."
                  rows={3}
                />
              </div>

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !formData.name}
                className="w-full"
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Customer Details Dialog */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Detalhes do Cliente
              </DialogTitle>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      {selectedCustomer.photo_url ? (
                        <AvatarImage src={selectedCustomer.photo_url} alt={selectedCustomer.name} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {getInitials(selectedCustomer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg">{selectedCustomer.name}</h3>
                      {selectedCustomer.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatPhone(selectedCustomer.phone)}
                        </p>
                      )}
                      {selectedCustomer.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedCustomer.email}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedCustomer.phone && (
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => openWhatsApp(selectedCustomer.phone!, selectedCustomer.name)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  )}
                </div>

                {selectedCustomer.notes && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">{selectedCustomer.notes}</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{selectedCustomer.purchaseCount}</p>
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
                      R${" "}
                      {selectedCustomer.purchaseCount > 0
                        ? (selectedCustomer.totalSpent / selectedCustomer.purchaseCount).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })
                        : "0,00"}
                    </p>
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  </div>
                </div>

                {/* Purchase History */}
                {selectedCustomer.sales.length > 0 && (
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
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
