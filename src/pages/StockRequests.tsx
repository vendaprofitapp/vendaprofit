import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Clock, CheckCircle, XCircle, Users, Eye, MessageCircle, ShoppingCart, Palette, Ruler } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface StockRequest {
  id: string;
  product_id: string;
  requester_id: string;
  owner_id: string;
  quantity: number;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  response_notes: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  variant_id: string | null;
  variant_color: string | null;
  variant_size: string | null;
}

interface RequestWithDetails extends StockRequest {
  product_name: string;
  product_price: number;
  requester_name: string;
  requester_email: string;
  owner_name: string;
  owner_phone: string | null;
}

interface ProductVariant {
  id: string;
  product_id: string;
  color: string | null;
  size: string;
  stock_quantity: number;
  image_url: string | null;
}

const statusConfig = {
  pending: { label: "Pendente", variant: "secondary" as const, icon: Clock },
  approved: { label: "Aprovada", variant: "default" as const, icon: CheckCircle },
  rejected: { label: "Recusada", variant: "destructive" as const, icon: XCircle },
};

// Size ordering helper
const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG', 'EG', 'EGG', 'EGGG', 
  'U', 'UN', 'UNICO', 'ÚNICO',
  '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const getSizeIndex = (size: string) => {
  const upperSize = size.toUpperCase().trim();
  const idx = SIZE_ORDER.indexOf(upperSize);
  return idx === -1 ? 999 : idx;
};

export default function StockRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedRequest, setSelectedRequest] = useState<RequestWithDetails | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isRespondOpen, setIsRespondOpen] = useState(false);
  const [responseNotes, setResponseNotes] = useState("");

  // Fetch all requests (both sent and received)
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["stock-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StockRequest[];
    },
    enabled: !!user,
  });

  // Fetch products for request details
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch profiles for names
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Map requests with details
  const enrichedRequests: RequestWithDetails[] = requests.map(req => {
    const product = products.find(p => p.id === req.product_id);
    const requester = profiles.find(p => p.id === req.requester_id);
    const owner = profiles.find(p => p.id === req.owner_id);
    
    return {
      ...req,
      product_name: product?.name || "Produto desconhecido",
      product_price: product?.price || 0,
      requester_name: requester?.full_name || "Usuário",
      requester_email: requester?.email || "",
      owner_name: owner?.full_name || "Usuário",
      owner_phone: owner?.phone || null,
    };
  });

  // Function to open WhatsApp with pre-filled message
  const openWhatsApp = (request: RequestWithDetails) => {
    if (!request.owner_phone) {
      toast({ 
        title: "Telefone não cadastrado", 
        description: "O parceiro ainda não cadastrou um número de telefone.",
        variant: "destructive" 
      });
      return;
    }

    // Clean phone number (remove non-digits)
    const cleanPhone = request.owner_phone.replace(/\D/g, "");
    
    // Build variant info
    const variantInfo = request.variant_color || request.variant_size
      ? ` (${[request.variant_color, request.variant_size].filter(Boolean).join(' - ')})`
      : '';
    
    // Build the pre-filled message
    const message = `Olá ${request.owner_name}! 👋

Minha solicitação de reserva foi aprovada e gostaria de combinar a entrega/retirada da peça:

📦 *Produto:* ${request.product_name}${variantInfo}
🔢 *Quantidade:* ${request.quantity} unidade(s)
💰 *Valor:* R$ ${(request.product_price * request.quantity).toFixed(2).replace(".", ",")}

Quando podemos agendar?`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // Open WhatsApp with the message
    window.open(`https://wa.me/55${cleanPhone}?text=${encodedMessage}`, "_blank");
  };

  // Separate received and sent requests
  const receivedRequests = enrichedRequests.filter(r => r.owner_id === user?.id);
  const sentRequests = enrichedRequests.filter(r => r.requester_id === user?.id);

  // Respond to request mutation using atomic function
  const respondMutation = useMutation({
    mutationFn: async ({ requestId, status, notes }: { requestId: string; status: "approved" | "rejected"; notes: string }) => {
      if (status === "approved") {
        // Use the atomic function for approvals
        const { data, error } = await supabase.rpc("approve_stock_request", {
          _request_id: requestId,
          _response_notes: notes || null,
        });

        if (error) throw error;
        
        const result = data as { success: boolean; error?: string };
        if (!result.success) {
          throw new Error(result.error || "Erro ao aprovar solicitação");
        }
        
        return result;
      } else {
        // For rejections, just update the status
        const { error } = await supabase
          .from("stock_requests")
          .update({
            status,
            response_notes: notes || null,
            responded_at: new Date().toISOString(),
          })
          .eq("id", requestId);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      const action = variables.status === "approved" ? "aprovada" : "recusada";
      const extraMsg = variables.status === "approved" ? " O estoque foi atualizado automaticamente." : "";
      toast({ title: `Solicitação ${action} com sucesso!${extraMsg}` });
      setIsRespondOpen(false);
      setSelectedRequest(null);
      setResponseNotes("");
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-variants"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao responder solicitação", description: error.message, variant: "destructive" });
    },
  });

  // Cancel request mutation (for sent requests)
  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("stock_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
        .eq("requester_id", user?.id)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação cancelada" });
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    },
  });

  const viewRequest = (request: RequestWithDetails) => {
    setSelectedRequest(request);
    setIsViewOpen(true);
  };

  const openRespond = (request: RequestWithDetails) => {
    setSelectedRequest(request);
    setResponseNotes("");
    setIsRespondOpen(true);
  };

  // Navigate to Sales page with pre-filled data from approved request
  const createSaleFromRequest = (request: RequestWithDetails) => {
    // Store the request data in sessionStorage for the Sales page to pick up
    const saleData = {
      productId: request.product_id,
      productName: request.product_name,
      productPrice: request.product_price,
      quantity: request.quantity,
      ownerName: request.owner_name,
      requestId: request.id,
      variantId: request.variant_id,
      variantColor: request.variant_color,
      variantSize: request.variant_size,
    };
    sessionStorage.setItem("pendingSaleFromRequest", JSON.stringify(saleData));
    navigate("/sales");
  };

  const pendingReceived = receivedRequests.filter(r => r.status === "pending").length;
  const pendingSent = sentRequests.filter(r => r.status === "pending").length;

  // Build variant display string
  const getVariantDisplay = (request: RequestWithDetails) => {
    const parts = [];
    if (request.variant_color) parts.push(request.variant_color);
    if (request.variant_size) parts.push(request.variant_size);
    return parts.length > 0 ? parts.join(' - ') : null;
  };

  const renderRequestRow = (request: RequestWithDetails, isReceived: boolean) => {
    const StatusIcon = statusConfig[request.status].icon;
    const variantDisplay = getVariantDisplay(request);
    
    return (
      <TableRow key={request.id} className="group">
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{request.product_name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{request.quantity} unidade{request.quantity > 1 ? "s" : ""}</span>
                {variantDisplay && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {request.variant_color && <Palette className="h-3 w-3" />}
                      {request.variant_size && <Ruler className="h-3 w-3" />}
                      {variantDisplay}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          {isReceived ? (
            <div>
              <p className="font-medium">{request.requester_name}</p>
              <p className="text-xs text-muted-foreground">{request.requester_email}</p>
            </div>
          ) : (
            <div>
              <p className="font-medium">{request.owner_name}</p>
            </div>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {new Date(request.created_at).toLocaleDateString("pt-BR")}
        </TableCell>
        <TableCell>
          <Badge variant={statusConfig[request.status].variant} className="flex items-center gap-1 w-fit">
            <StatusIcon className="h-3 w-3" />
            {statusConfig[request.status].label}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => viewRequest(request)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {isReceived && request.status === "pending" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openRespond(request)}
                >
                  Responder
                </Button>
              </>
            )}
            {!isReceived && request.status === "pending" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate(request.id)}
                disabled={cancelMutation.isPending}
              >
                Cancelar
              </Button>
            )}
            {!isReceived && request.status === "approved" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => createSaleFromRequest(request)}
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Vender Agora
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                  onClick={() => openWhatsApp(request)}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  WhatsApp
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Reserva</h1>
          <p className="text-muted-foreground">Gerencie solicitações de produtos entre parceiros</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Recebidas Pendentes</p>
          <p className="text-2xl font-bold">{pendingReceived}</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Enviadas Pendentes</p>
          <p className="text-2xl font-bold">{pendingSent}</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Total Recebidas</p>
          <p className="text-2xl font-bold">{receivedRequests.length}</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">Total Enviadas</p>
          <p className="text-2xl font-bold">{sentRequests.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="received" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="received" className="flex items-center gap-2">
            Recebidas
            {pendingReceived > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingReceived}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            Enviadas
            {pendingSent > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingSent}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produto</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : receivedRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitação recebida
                    </TableCell>
                  </TableRow>
                ) : (
                  receivedRequests.map((request) => renderRequestRow(request, true))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="sent">
          <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produto</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : sentRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitação enviada
                    </TableCell>
                  </TableRow>
                ) : (
                  sentRequests.map((request) => renderRequestRow(request, false))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* View Request Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Produto</p>
                  <p className="font-medium">{selectedRequest.product_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Quantidade</p>
                  <p className="font-medium">{selectedRequest.quantity}</p>
                </div>
                {(selectedRequest.variant_color || selectedRequest.variant_size) && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Variante</p>
                    <div className="flex items-center gap-2 font-medium">
                      {selectedRequest.variant_color && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Palette className="h-3 w-3" />
                          {selectedRequest.variant_color}
                        </Badge>
                      )}
                      {selectedRequest.variant_size && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Ruler className="h-3 w-3" />
                          {selectedRequest.variant_size}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Preço Unitário</p>
                  <p className="font-medium">
                    R$ {selectedRequest.product_price.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Total</p>
                  <p className="font-medium">
                    R$ {(selectedRequest.product_price * selectedRequest.quantity).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Solicitante</p>
                  <p className="font-medium">{selectedRequest.requester_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Proprietário</p>
                  <p className="font-medium">{selectedRequest.owner_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={statusConfig[selectedRequest.status].variant}>
                    {statusConfig[selectedRequest.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {new Date(selectedRequest.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>

              {selectedRequest.notes && (
                <div>
                  <p className="text-muted-foreground text-sm">Observações do solicitante</p>
                  <p className="text-sm bg-secondary/30 rounded-lg p-3 mt-1">
                    {selectedRequest.notes}
                  </p>
                </div>
              )}

              {selectedRequest.response_notes && (
                <div>
                  <p className="text-muted-foreground text-sm">Resposta do proprietário</p>
                  <p className="text-sm bg-secondary/30 rounded-lg p-3 mt-1">
                    {selectedRequest.response_notes}
                  </p>
                </div>
              )}

              {selectedRequest.responded_at && (
                <p className="text-xs text-muted-foreground">
                  Respondido em: {new Date(selectedRequest.responded_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Respond Dialog */}
      <Dialog open={isRespondOpen} onOpenChange={setIsRespondOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder Solicitação</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="font-medium">{selectedRequest.product_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest.quantity} unidade{selectedRequest.quantity > 1 ? "s" : ""} • 
                  Solicitante: {selectedRequest.requester_name}
                </p>
                {(selectedRequest.variant_color || selectedRequest.variant_size) && (
                  <div className="flex items-center gap-2 mt-2">
                    {selectedRequest.variant_color && (
                      <Badge variant="outline" className="text-xs">
                        <Palette className="h-3 w-3 mr-1" />
                        {selectedRequest.variant_color}
                      </Badge>
                    )}
                    {selectedRequest.variant_size && (
                      <Badge variant="outline" className="text-xs">
                        <Ruler className="h-3 w-3 mr-1" />
                        {selectedRequest.variant_size}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {selectedRequest.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Mensagem do solicitante:</p>
                  <p className="text-sm bg-secondary/20 rounded-lg p-2 mt-1">
                    {selectedRequest.notes}
                  </p>
                </div>
              )}

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Atenção:</strong> Ao aprovar, o estoque será automaticamente subtraído da sua conta e o produto ficará disponível para venda pelo solicitante.
                </p>
              </div>

              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Adicione uma mensagem para o solicitante..."
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              disabled={respondMutation.isPending}
              onClick={() => {
                if (selectedRequest) {
                  respondMutation.mutate({
                    requestId: selectedRequest.id,
                    status: "rejected",
                    notes: responseNotes,
                  });
                }
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Recusar
            </Button>
            <Button
              disabled={respondMutation.isPending}
              onClick={() => {
                if (selectedRequest) {
                  respondMutation.mutate({
                    requestId: selectedRequest.id,
                    status: "approved",
                    notes: responseNotes,
                  });
                }
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprovar e Liberar Estoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
