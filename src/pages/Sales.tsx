import { useState, useCallback, useEffect } from "react";
import { Plus, Search, ShoppingCart, Eye, Edit2, Truck, Mic } from "lucide-react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
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
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EditSaleDialog } from "@/components/sales/EditSaleDialog";
import NewSaleDialog from "@/components/sales/NewSaleDialog";

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
  notes: string | null;
  created_at: string;
  shipping_method: string | null;
  shipping_company: string | null;
  shipping_cost: number | null;
  shipping_payer: string | null;
  shipping_address: string | null;
  shipping_notes: string | null;
  shipping_tracking: string | null;
  shipping_label_url: string | null;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface CustomPaymentMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
  is_active: boolean;
}

const statusConfig = {
  completed: { label: "Concluída", variant: "default" as const },
  pending: { label: "Pendente", variant: "secondary" as const },
  cancelled: { label: "Cancelada", variant: "destructive" as const },
};

export default function Sales() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const isMobile = useIsMobile();
  const [consignmentData, setConsignmentData] = useState<any>(null);
  const [catalogOrderData, setCatalogOrderData] = useState<any>(null);
  const [partnerPointOrderData, setPartnerPointOrderData] = useState<any>(null);

  // Voice command state for passing to NewSaleDialog
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState<{
    productSearch: string;
    quantity: number;
    color?: string | null;
    size?: string | null;
    customerName?: string | null;
    paymentMethod?: string | null;
  } | null>(null);

  // Draft params
  const fromDraftId = searchParams.get("from_draft");
  const draftNotes = searchParams.get("draft_notes");

  // Fetch sales
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("owner_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user,
  });

  // Custom payment methods (needed for EditSaleDialog)
  const { data: customPaymentMethods = [] } = useQuery({
    queryKey: ["custom-payment-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("*")
        .eq("owner_id", user?.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CustomPaymentMethod[];
    },
    enabled: !!user,
  });

  // Smart voice command handler
  const handleSmartSaleResult = useCallback((result: any, rawText: string) => {
    if (!result.success) {
      toast({ title: "Não foi possível interpretar", description: result.error || result.message || rawText, variant: "destructive" });
      return;
    }
    setIsNewSaleOpen(true);

    if (result.productId || result.productName) {
      setPendingVoiceCommand({
        productSearch: result.productName || "",
        quantity: result.quantity || 1,
        color: result.color || null,
        size: result.size || null,
        customerName: result.customerName || null,
        paymentMethod: result.paymentMethod || null,
      });
    }
  }, []);

  const { isListening, isProcessing, transcript, isSupported, startListening, stopListening } = useVoiceCommand({
    smartSaleMode: true,
    userId: user?.id,
    onSmartSaleResult: handleSmartSaleResult,
    onError: (error) => { toast({ title: "Erro no comando de voz", description: error, variant: "destructive" }); },
  });

  const toggleVoice = () => { isListening ? stopListening() : startListening(); };

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

  const filteredSales = sales.filter(
    (sale) =>
      sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const viewSaleDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data, error } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    if (!error && data) setSaleItems(data);
    setIsViewOpen(true);
  };

  const openEditSale = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data, error } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    if (!error && data) setSaleItems(data);
    setIsEditOpen(true);
  };

  // Handle draft opening
  const handleDraftReconciled = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Open dialog if draft params present
  useEffect(() => {
    if (fromDraftId && draftNotes) setIsNewSaleOpen(true);
  }, [fromDraftId, draftNotes]);

  // Handle consignment data from navigation state
  useEffect(() => {
    const state = location.state as any;
    if (state?.consignmentData) {
      setConsignmentData(state.consignmentData);
      setIsNewSaleOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.fromPartnerPointOrder) {
      // Clear persisted sale form data so partner point order data takes priority
      const keysToClean = [
        "sales_cart", "sales_customerName", "sales_customerPhone", "sales_instagram",
        "sales_paymentMethodId", "sales_discountType", "sales_discountValue",
        "sales_notes", "sales_dueDate", "sales_installments", "sales_installmentDetails",
        "sales_shippingData",
      ];
      keysToClean.forEach(k => sessionStorage.removeItem(k));

      setPartnerPointOrderData({
        partnerPointSaleId: state.partnerPointSaleId,
        customerName: state.customer_name,
        customerPhone: state.customer_phone,
        paymentMethod: state.payment_method,
        customPaymentMethodId: state.custom_payment_method_id,
        items: state.items,
        totalGross: state.total,
        partnerName: state.partner_name,
        rackCommissionPct: state.rack_commission_pct,
      });
      setIsNewSaleOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state?.fromCatalogOrder) {
      // Clear persisted sale form data so catalog order data takes priority
      const keysToClean = [
        "sales_cart", "sales_customerName", "sales_customerPhone", "sales_instagram",
        "sales_paymentMethodId", "sales_discountType", "sales_discountValue",
        "sales_notes", "sales_dueDate", "sales_installments", "sales_installmentDetails",
        "sales_shippingData",
      ];
      keysToClean.forEach(k => sessionStorage.removeItem(k));

      setCatalogOrderData({
        catalogOrderId: state.catalogOrderId,
        customerName: state.customer_name,
        customerPhone: state.customer_phone,
        items: state.items,
        total: state.total,
      });
      setIsNewSaleOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  return (
    <MainLayout>
      <VoiceCommandFeedback isListening={isListening || isProcessing} transcript={transcript} />

      {/* Page Header */}
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

      {/* Stats Cards */}
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

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Buscar por ID ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
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
              return (
                <div key={sale.id} className="rounded-xl bg-card p-4 shadow-soft cursor-pointer active:scale-[0.98] transition-transform" onClick={() => viewSaleDetails(sale)}>
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
                      <p className="text-xs text-muted-foreground">{sale.payment_method} • {new Date(sale.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <p className="text-lg font-bold text-primary">R$ {Number(sale.total).toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-card shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filteredSales.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</TableCell></TableRow>
              ) : (
                filteredSales.map((sale) => {
                  const status = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.completed;
                  return (
                    <TableRow key={sale.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => viewSaleDetails(sale)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <ShoppingCart className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-xs">{sale.id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(sale.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{sale.customer_name || "—"}</TableCell>
                      <TableCell>{sale.payment_method}</TableCell>
                      <TableCell className="font-semibold">R$ {Number(sale.total).toFixed(2).replace(".", ",")}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => viewSaleDetails(sale)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Sale Dialog */}
      <NewSaleDialog
        open={isNewSaleOpen}
        onOpenChange={setIsNewSaleOpen}
        voiceCommand={pendingVoiceCommand}
        onVoiceCommandProcessed={() => setPendingVoiceCommand(null)}
        fromDraftId={fromDraftId}
        draftNotes={draftNotes}
        onDraftReconciled={handleDraftReconciled}
        consignmentData={consignmentData}
        onConsignmentProcessed={() => setConsignmentData(null)}
        catalogOrderData={catalogOrderData}
        onCatalogOrderProcessed={() => setCatalogOrderData(null)}
        partnerPointOrderData={partnerPointOrderData}
        onPartnerPointOrderProcessed={() => setPartnerPointOrderData(null)}
      />

      {/* View Sale Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">ID</p><p className="font-medium">{selectedSale.id.slice(0, 8)}</p></div>
                <div><p className="text-muted-foreground">Data</p><p className="font-medium">{new Date(selectedSale.created_at).toLocaleString("pt-BR")}</p></div>
                <div><p className="text-muted-foreground">Cliente</p><p className="font-medium">{selectedSale.customer_name || "—"}</p></div>
                <div><p className="text-muted-foreground">Telefone</p><p className="font-medium">{selectedSale.customer_phone || "—"}</p></div>
                <div><p className="text-muted-foreground">Pagamento</p><p className="font-medium">{selectedSale.payment_method}</p></div>
                <div><p className="text-muted-foreground">Status</p><Badge variant={statusConfig[selectedSale.status as keyof typeof statusConfig]?.variant}>{statusConfig[selectedSale.status as keyof typeof statusConfig]?.label}</Badge></div>
              </div>

              {/* Shipping Info */}
              {selectedSale.shipping_method && selectedSale.shipping_method !== "presencial" && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    Envio: {selectedSale.shipping_method === "postagem" ? "Postagem" : selectedSale.shipping_method === "app" ? "Aplicativo" : "Outros"}
                    {selectedSale.shipping_company && ` - ${selectedSale.shipping_company}`}
                  </p>
                  {selectedSale.shipping_address && <p className="text-xs text-muted-foreground">{selectedSale.shipping_address}</p>}
                  {Number(selectedSale.shipping_cost) > 0 && (
                    <p className="text-xs">Frete: R$ {Number(selectedSale.shipping_cost).toFixed(2).replace(".", ",")} ({selectedSale.shipping_payer === "buyer" ? "compradora" : "vendedora"})</p>
                  )}
                  {selectedSale.shipping_notes && <p className="text-xs text-muted-foreground">{selectedSale.shipping_notes}</p>}
                  {selectedSale.shipping_tracking && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <p className="text-xs font-medium">Rastreio: {selectedSale.shipping_tracking}</p>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { navigator.clipboard.writeText(selectedSale.shipping_tracking!); toast({ title: "Código copiado!" }); }}>Copiar</Button>
                    </div>
                  )}
                  {selectedSale.shipping_label_url && (
                    <a href={selectedSale.shipping_label_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 inline-block">📄 Ver etiqueta</a>
                  )}
                  {selectedSale.shipping_tracking && selectedSale.customer_phone && (
                    <Button variant="outline" size="sm" className="w-full mt-2 text-xs"
                      onClick={() => {
                        const msg = encodeURIComponent(`Olá ${selectedSale.customer_name || ""}! 📦\n\nSeu pedido foi enviado!\n\n🔎 Código de rastreio: *${selectedSale.shipping_tracking}*\n\nVocê pode acompanhar pelo site dos Correios ou pelo app da transportadora.\n\nQualquer dúvida, estou à disposição! 😊`);
                        const phone = selectedSale.customer_phone!.replace(/\D/g, "");
                        window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
                      }}>
                      📱 Enviar Rastreio via WhatsApp
                    </Button>
                  )}
                </div>
              )}

              <div>
                <p className="text-muted-foreground mb-2">Itens</p>
                <div className="border rounded-lg">
                  {saleItems.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between border-b last:border-b-0">
                      <div><p className="font-medium">{item.product_name}</p><p className="text-sm text-muted-foreground">{item.quantity}x R$ {Number(item.unit_price).toFixed(2).replace(".", ",")}</p></div>
                      <p className="font-semibold">R$ {Number(item.total).toFixed(2).replace(".", ",")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>R$ {Number(selectedSale.subtotal).toFixed(2).replace(".", ",")}</span></div>
                {Number(selectedSale.discount_amount) > 0 && (
                  <div className="flex justify-between text-sm text-destructive"><span>Desconto</span><span>- R$ {Number(selectedSale.discount_amount).toFixed(2).replace(".", ",")}</span></div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total</span><span>R$ {Number(selectedSale.total).toFixed(2).replace(".", ",")}</span></div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setIsViewOpen(false); openEditSale(selectedSale); }}>
                  <Edit2 className="h-4 w-4 mr-2" />Editar Venda
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <EditSaleDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        sale={selectedSale}
        saleItems={saleItems}
        customPaymentMethods={customPaymentMethods}
        userId={user?.id || ""}
      />
    </MainLayout>
  );
}
