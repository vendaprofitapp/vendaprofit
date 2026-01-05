import { useState, useEffect } from "react";
import { Plus, Search, Calendar, ShoppingCart, Eye, Trash2, X, Minus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Sale {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  total: number;
  status: string;
  created_at: string;
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

const paymentMethods = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
];

const statusConfig = {
  completed: { label: "Concluída", variant: "default" as const },
  pending: { label: "Pendente", variant: "secondary" as const },
  cancelled: { label: "Cancelada", variant: "destructive" as const },
};

export default function Sales() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  
  // New sale form state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [installments, setInstallments] = useState(1);

  // Fetch sales
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user,
  });

  // Fetch products for adding to cart
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, stock_quantity")
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (!user || cart.length === 0) throw new Error("Carrinho vazio");

      const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const discountAmount = discountType === "percentage" 
        ? (subtotal * discountValue) / 100 
        : discountValue;
      const total = Math.max(0, subtotal - discountAmount);

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          owner_id: user.id,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method: paymentMethod,
          subtotal,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: discountAmount,
          total,
          notes: notes || null,
          status: "completed",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const itemsToInsert = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update product stock
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from("products")
          .update({ stock_quantity: item.product.stock_quantity - item.quantity })
          .eq("id", item.product.id);
        if (stockError) console.error("Error updating stock:", stockError);
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products-for-sale"] });
      toast({ title: "Venda registrada com sucesso!" });
      resetForm();
      setIsNewSaleOpen(false);
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar venda", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("dinheiro");
    setInstallments(1);
    setDiscountType("fixed");
    setDiscountValue(0);
    setNotes("");
    setProductSearch("");
  };

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock_quantity) {
        setCart(cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        toast({ title: "Estoque insuficiente", variant: "destructive" });
      }
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    setProductSearch("");
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map((item) => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.product.stock_quantity) {
          toast({ title: "Estoque insuficiente", variant: "destructive" });
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = discountType === "percentage" 
    ? (subtotal * discountValue) / 100 
    : discountValue;
  const total = Math.max(0, subtotal - discountAmount);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredSales = sales.filter(
    (sale) =>
      sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const viewSaleDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data, error } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", sale.id);
    if (!error && data) {
      setSaleItems(data);
    }
    setIsViewOpen(true);
  };

  // Stats
  const todaySales = sales.filter((s) => {
    const today = new Date().toDateString();
    return new Date(s.created_at).toDateString() === today && s.status === "completed";
  });
  const todayTotal = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
  const monthSales = sales.filter((s) => {
    const now = new Date();
    const saleDate = new Date(s.created_at);
    return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear() && s.status === "completed";
  });
  const monthTotal = monthSales.reduce((sum, s) => sum + Number(s.total), 0);
  const avgTicket = monthSales.length > 0 ? monthTotal / monthSales.length : 0;

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground">Acompanhe e gerencie suas vendas</p>
        </div>
        <Button onClick={() => setIsNewSaleOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Venda
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Vendas Hoje</p>
          <p className="text-2xl font-bold">R$ {todayTotal.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">{todaySales.length} vendas</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Vendas do Mês</p>
          <p className="text-2xl font-bold">R$ {monthTotal.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">{monthSales.length} vendas</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-bold">R$ {avgTicket.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">baseado em {monthSales.length} vendas</p>
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
      </div>

      {/* Sales Table */}
      <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma venda encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => {
                const status = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.completed;
                const paymentLabel = paymentMethods.find((p) => p.value === sale.payment_method)?.label || sale.payment_method;
                return (
                  <TableRow key={sale.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-medium text-xs">{sale.id.slice(0, 8)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">{sale.customer_name || "—"}</TableCell>
                    <TableCell>{paymentLabel}</TableCell>
                    <TableCell className="font-semibold">
                      R$ {Number(sale.total).toFixed(2).replace(".", ",")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => viewSaleDetails(sale)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* New Sale Dialog */}
      <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Venda</DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Product Selection */}
            <div className="space-y-4">
              <div>
                <Label>Buscar Produto</Label>
                <Input
                  placeholder="Digite o nome do produto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              {productSearch && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado</p>
                  ) : (
                    filteredProducts.slice(0, 10).map((product) => (
                      <button
                        key={product.id}
                        className="w-full p-3 text-left hover:bg-secondary/50 flex justify-between items-center border-b last:border-b-0"
                        onClick={() => addToCart(product)}
                      >
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Estoque: {product.stock_quantity}
                          </p>
                        </div>
                        <p className="font-semibold">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Cart */}
              <div>
                <Label>Carrinho ({cart.length} itens)</Label>
                <div className="border rounded-lg mt-2 max-h-64 overflow-y-auto">
                  {cart.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      Adicione produtos ao carrinho
                    </p>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="p-3 flex items-center justify-between border-b last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            R$ {item.product.price.toFixed(2).replace(".", ",")} x {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right: Sale Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input
                    placeholder="Opcional"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    placeholder="Opcional"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={(value) => {
                    setPaymentMethod(value);
                    if (value !== "credito") setInstallments(1);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === "credito" && (
                  <div>
                    <Label>Nº de Parcelas</Label>
                    <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x {n === 1 ? "à vista" : `de R$ ${(total / n).toFixed(2).replace(".", ",")}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Desconto</Label>
                  <Select value={discountType} onValueChange={setDiscountType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor do Desconto</Label>
                  <Input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações sobre a venda..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Totals */}
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto</span>
                    <span>- R$ {discountAmount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={cart.length === 0 || createSaleMutation.isPending}
                onClick={() => createSaleMutation.mutate()}
              >
                {createSaleMutation.isPending ? "Registrando..." : "Finalizar Venda"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Sale Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ID</p>
                  <p className="font-medium">{selectedSale.id.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {new Date(selectedSale.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedSale.customer_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-medium">{selectedSale.customer_phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pagamento</p>
                  <p className="font-medium">
                    {paymentMethods.find((p) => p.value === selectedSale.payment_method)?.label}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={statusConfig[selectedSale.status as keyof typeof statusConfig]?.variant}>
                    {statusConfig[selectedSale.status as keyof typeof statusConfig]?.label}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground mb-2">Itens</p>
                <div className="border rounded-lg">
                  {saleItems.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between border-b last:border-b-0">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x R$ {Number(item.unit_price).toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      <p className="font-semibold">
                        R$ {Number(item.total).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>R$ {Number(selectedSale.subtotal).toFixed(2).replace(".", ",")}</span>
                </div>
                {Number(selectedSale.discount_amount) > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto</span>
                    <span>- R$ {Number(selectedSale.discount_amount).toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>R$ {Number(selectedSale.total).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
