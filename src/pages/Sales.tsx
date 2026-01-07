import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Calendar, ShoppingCart, Eye, Trash2, X, Minus, Users, Clock, CheckCircle, XCircle, Mic } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { VoiceCommandButton } from "@/components/voice/VoiceCommandButton";
import { VoiceCommandFeedback } from "@/components/voice/VoiceCommandFeedback";
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
  DialogFooter,
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

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  owner_id: string;
  group_id: string | null;
  category: string;
  color: string | null;
  size: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  isPartnerStock: boolean;
  ownerName?: string;
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

interface PartnerProduct extends Product {
  ownerName: string;
  ownerEmail: string;
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

  // Partner stock dialog
  const [partnerProducts, setPartnerProducts] = useState<PartnerProduct[]>([]);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [searchedProductName, setSearchedProductName] = useState("");
  const [selectedPartnerProduct, setSelectedPartnerProduct] = useState<PartnerProduct | null>(null);
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [reserveNotes, setReserveNotes] = useState("");

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

  // Fetch OWN products for adding to cart (only user's own stock)
  const { data: ownProducts = [] } = useQuery({
    queryKey: ["own-products-for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, stock_quantity, owner_id, group_id, category, color, size")
        .eq("is_active", true)
        .eq("owner_id", user?.id)
        .gt("stock_quantity", 0)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Fetch profiles for partner names
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's groups
  const { data: userGroups = [] } = useQuery({
    queryKey: ["user-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user?.id);
      if (error) throw error;
      return data.map(g => g.group_id);
    },
    enabled: !!user,
  });

  // Search partner products when own stock doesn't have the product
  const searchPartnerProducts = async (searchName: string) => {
    if (!user || userGroups.length === 0) return [];

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, stock_quantity, owner_id, group_id, category, color, size")
      .eq("is_active", true)
      .neq("owner_id", user.id)
      .gt("stock_quantity", 0)
      .in("group_id", userGroups)
      .ilike("name", `%${searchName}%`)
      .order("name");

    if (error) {
      console.error("Error searching partner products:", error);
      return [];
    }

    // Map owner names
    return (data || []).map(p => {
      const owner = profiles.find(prof => prof.id === p.owner_id);
      return {
        ...p,
        ownerName: owner?.full_name || "Parceiro",
        ownerEmail: owner?.email || "",
      } as PartnerProduct;
    });
  };

  // Create stock request mutation
  const createReserveMutation = useMutation({
    mutationFn: async ({ product, quantity, notes }: { product: PartnerProduct; quantity: number; notes: string }) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("stock_requests")
        .insert({
          product_id: product.id,
          requester_id: user.id,
          owner_id: product.owner_id,
          quantity,
          notes: notes || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Solicitação de reserva enviada!", description: "Aguarde a confirmação do parceiro." });
      setShowReserveDialog(false);
      setSelectedPartnerProduct(null);
      setReserveQuantity(1);
      setReserveNotes("");
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao solicitar reserva", description: error.message, variant: "destructive" });
    },
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (!user || cart.length === 0) throw new Error("Carrinho vazio");

      // Only process own stock items
      const ownStockItems = cart.filter(item => !item.isPartnerStock);
      if (ownStockItems.length === 0) throw new Error("Adicione produtos do seu estoque para finalizar a venda");

      const subtotal = ownStockItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
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
      const itemsToInsert = ownStockItems.map((item) => ({
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
      for (const item of ownStockItems) {
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
      queryClient.invalidateQueries({ queryKey: ["own-products-for-sale"] });
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

  const addToCart = (product: Product, isPartnerStock: boolean = false, ownerName?: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity < product.stock_quantity) {
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }
        toast({ title: "Estoque insuficiente", variant: "destructive" });
        return prev;
      }

      return [...prev, { product, quantity: 1, isPartnerStock, ownerName }];
    });

    setProductSearch("");
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;

        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.product.stock_quantity) {
          toast({ title: "Estoque insuficiente", variant: "destructive" });
          return item;
        }
        return { ...item, quantity: newQty };
      }),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleProductSearch = async (searchValue: string) => {
    setProductSearch(searchValue);
    
    if (searchValue.length >= 2) {
      // Check if product exists in own stock
      const ownMatch = ownProducts.filter(p => 
        p.name.toLowerCase().includes(searchValue.toLowerCase())
      );

      if (ownMatch.length === 0) {
        // Search in partner stocks
        setSearchedProductName(searchValue);
        const partnerResults = await searchPartnerProducts(searchValue);
        if (partnerResults.length > 0) {
          setPartnerProducts(partnerResults);
          setShowPartnerDialog(true);
        }
      }
    }
  };

  const handleRequestReserve = (product: PartnerProduct) => {
    setSelectedPartnerProduct(product);
    setReserveQuantity(1);
    setReserveNotes("");
    setShowReserveDialog(true);
    setShowPartnerDialog(false);
  };

  const subtotal = cart.filter(i => !i.isPartnerStock).reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = discountType === "percentage" 
    ? (subtotal * discountValue) / 100 
    : discountValue;
  const total = Math.max(0, subtotal - discountAmount);

  const filteredOwnProducts = ownProducts.filter((p) =>
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

  const isMobile = useIsMobile();

  // Smart voice command handler using AI
  const handleSmartSaleResult = useCallback((result: any, rawText: string) => {
    console.log('Smart sale result:', result);
    
    if (!result.success) {
      toast({ 
        title: "Não foi possível interpretar", 
        description: result.error || result.message || rawText,
        variant: "destructive"
      });
      return;
    }

    // Clear search field to allow new searches
    setProductSearch("");

    // Open new sale dialog
    setIsNewSaleOpen(true);
    
    // Set payment method if identified
    if (result.paymentMethod) {
      setPaymentMethod(result.paymentMethod);
    }
    
    // Set customer name if identified
    if (result.customerName) {
      setCustomerName(result.customerName);
    }
    
    // Add product to cart if found
    if (result.productId) {
      setTimeout(() => {
        const matchingProduct = ownProducts.find(p => p.id === result.productId);
        
        if (matchingProduct) {
          const qty = result.quantity || 1;
          // Reset cart and add the product with correct quantity
          setCart([{ product: matchingProduct, quantity: qty, isPartnerStock: false }]);
          
          toast({ 
            title: "✓ Venda reconhecida por voz!", 
            description: `${qty}x ${matchingProduct.name}${result.paymentMethod ? ` - ${paymentMethods.find(p => p.value === result.paymentMethod)?.label || result.paymentMethod}` : ''}`
          });
        }
      }, 300);
    } else if (result.productName) {
      // Product not found in user's stock, show message
      toast({ 
        title: "Produto não encontrado no estoque", 
        description: `"${result.productName}" - ${result.message || 'Verifique o nome do produto'}`,
        variant: "destructive"
      });
    }
  }, [ownProducts]);

  const { isListening, isProcessing, transcript, isSupported, startListening, stopListening } = useVoiceCommand({
    smartSaleMode: true,
    userId: user?.id,
    onSmartSaleResult: handleSmartSaleResult,
    onError: (error) => {
      toast({ title: "Erro no comando de voz", description: error, variant: "destructive" });
    },
  });

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <MainLayout>
      {/* Voice Command Feedback */}
      <VoiceCommandFeedback isListening={isListening || isProcessing} transcript={transcript} />

      {/* Page Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe e gerencie suas vendas</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {isSupported && (
            <VoiceCommandButton
              isListening={isListening}
              isSupported={isSupported}
              onClick={toggleVoice}
              size={isMobile ? "lg" : "default"}
              showLabel={!isMobile}
              className={isMobile ? "flex-1" : ""}
            />
          )}
          <Button onClick={() => setIsNewSaleOpen(true)} className="flex-1 sm:flex-initial" size={isMobile ? "lg" : "default"}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Venda
          </Button>
        </div>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs sm:text-sm text-muted-foreground">Vendas Hoje</p>
          <p className="text-xl sm:text-2xl font-bold">R$ {todayTotal.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">{todaySales.length} vendas</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs sm:text-sm text-muted-foreground">Vendas do Mês</p>
          <p className="text-xl sm:text-2xl font-bold">R$ {monthTotal.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">{monthSales.length} vendas</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs sm:text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-xl sm:text-2xl font-bold">R$ {avgTicket.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">baseado em {monthSales.length} vendas</p>
        </div>
      </div>

      {/* Filters - Mobile Optimized */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
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

      {/* Sales List - Mobile Cards / Desktop Table */}
      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</div>
          ) : (
            filteredSales.map((sale) => {
              const status = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.completed;
              const paymentLabel = paymentMethods.find((p) => p.value === sale.payment_method)?.label || sale.payment_method;
              return (
                <div
                  key={sale.id}
                  className="rounded-xl bg-card p-4 shadow-soft cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => viewSaleDetails(sale)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground">{sale.id.slice(0, 8)}</span>
                    </div>
                    <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="font-medium">{sale.customer_name || "Cliente não informado"}</p>
                      <p className="text-xs text-muted-foreground">{paymentLabel} • {new Date(sale.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <p className="text-lg font-bold text-primary">
                      R$ {Number(sale.total).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
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
      )}

      <Dialog open={isNewSaleOpen} onOpenChange={(open) => {
        setIsNewSaleOpen(open);
        if (!open) setProductSearch("");
      }}>
        <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto !left-0 !top-auto !bottom-0 !translate-x-0 !translate-y-0 rounded-t-xl sm:rounded-lg sm:!left-[50%] sm:!top-[50%] sm:!bottom-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]">
          <DialogHeader>
            <DialogTitle>Nova Venda</DialogTitle>
          </DialogHeader>

          {/* Mobile: Show totals at top */}
          {isMobile && cart.length > 0 && (
            <div className="bg-primary/10 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total da Venda:</span>
                <span className="text-xl font-bold text-primary">
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  Subtotal: R$ {subtotal.toFixed(2).replace(".", ",")} | Desc: -R$ {discountAmount.toFixed(2).replace(".", ",")}
                </p>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Product Selection */}
            <div className="space-y-4">
              <div>
                <Label>Buscar Produto (Seu Estoque)</Label>
                <Input
                  placeholder="Digite o nome do produto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyUp={(e) => {
                    if (e.key === 'Enter' && productSearch.length >= 2) {
                      handleProductSearch(productSearch);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se não encontrar no seu estoque, buscaremos nos parceiros
                </p>
              </div>

              {productSearch && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredOwnProducts.length === 0 ? (
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground">Nenhum produto encontrado no seu estoque</p>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-sm"
                        onClick={() => handleProductSearch(productSearch)}
                      >
                        Buscar nos estoques parceiros
                      </Button>
                    </div>
                  ) : (
                    filteredOwnProducts.slice(0, 10).map((product) => (
                      <button
                        key={product.id}
                        className="w-full p-3 text-left hover:bg-secondary/50 flex justify-between items-center border-b last:border-b-0"
                        onClick={() => addToCart(product, false)}
                      >
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Estoque próprio: {product.stock_quantity}
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
                          {item.isPartnerStock && (
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {item.ownerName}
                            </Badge>
                          )}
                        </div>
                      <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(item.product.id, -1);
                            }}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={item.product.stock_quantity}
                            value={item.quantity}
                            onChange={(e) => {
                              const next = e.target.value;
                              const parsed = Number(next);
                              const newQty = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                              setCart((prev) =>
                                prev.map((c) =>
                                  c.product.id === item.product.id
                                    ? { ...c, quantity: Math.min(Math.max(1, newQty), item.product.stock_quantity) }
                                    : c,
                                ),
                              );
                            }}
                            className="w-14 h-10 text-center px-1"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(item.product.id, 1);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromCart(item.product.id);
                            }}
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
                    <SelectContent portal={!isMobile ? undefined : false}>
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
                      <SelectContent portal={!isMobile ? undefined : false}>
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
                    <SelectContent portal={!isMobile ? undefined : false}>
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
                disabled={cart.filter(i => !i.isPartnerStock).length === 0 || createSaleMutation.isPending}
                onClick={() => createSaleMutation.mutate()}
              >
                {createSaleMutation.isPending ? "Registrando..." : "Finalizar Venda"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partner Products Dialog */}
      <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Produtos Encontrados em Parceiros
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground">
            Não encontramos "{searchedProductName}" no seu estoque, mas encontramos nos parceiros:
          </p>

          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {partnerProducts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                Nenhum produto encontrado nos estoques parceiros
              </p>
            ) : (
              partnerProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-3 flex justify-between items-center border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Parceiro: {product.ownerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Disponível: {product.stock_quantity} | R$ {product.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => handleRequestReserve(product)}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Solicitar Reserva
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartnerDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reserve Request Dialog */}
      <AlertDialog open={showReserveDialog} onOpenChange={setShowReserveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar Reserva</AlertDialogTitle>
            <AlertDialogDescription>
              Você está solicitando uma reserva para o parceiro {selectedPartnerProduct?.ownerName}.
              Após a confirmação, o parceiro receberá a solicitação e poderá aprovar ou recusar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedPartnerProduct && (
            <div className="space-y-4 py-2">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="font-medium">{selectedPartnerProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  Preço: R$ {selectedPartnerProduct.price.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Disponível: {selectedPartnerProduct.stock_quantity} unidades
                </p>
              </div>

              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedPartnerProduct.stock_quantity}
                  value={reserveQuantity}
                  onChange={(e) => setReserveQuantity(Math.min(
                    Number(e.target.value),
                    selectedPartnerProduct.stock_quantity
                  ))}
                />
              </div>

              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Adicione uma mensagem para o parceiro..."
                  value={reserveNotes}
                  onChange={(e) => setReserveNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={createReserveMutation.isPending}
              onClick={() => {
                if (selectedPartnerProduct) {
                  createReserveMutation.mutate({
                    product: selectedPartnerProduct,
                    quantity: reserveQuantity,
                    notes: reserveNotes,
                  });
                }
              }}
            >
              {createReserveMutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
