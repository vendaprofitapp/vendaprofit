import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Send, MessageCircle, Copy, Check, Package, Clock, CheckCircle, XCircle, Bell, Users, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { NewConsignmentDialog } from "@/components/consignment/NewConsignmentDialog";
import { ConsignmentDetailsDialog } from "@/components/consignment/ConsignmentDetailsDialog";
import { useWaitlistNotifications } from "@/hooks/useWaitlistNotifications";

interface Consignment {
  id: string;
  status: string;
  created_at: string;
  deadline_at: string | null;
  shipping_cost: number | null;
  approved_at: string | null;
  access_token: string;
  customers: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  consignment_items: { count: number }[];
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Package }> = {
  draft: { label: "Rascunho", color: "bg-gray-500", icon: Package },
  awaiting_approval: { label: "Aguardando Aprovação", color: "bg-yellow-500", icon: Clock },
  active: { label: "Ativa", color: "bg-blue-500", icon: Package },
  finalized_by_client: { label: "Finalizada pelo Cliente", color: "bg-purple-500", icon: CheckCircle },
  completed: { label: "Concluída", color: "bg-green-500", icon: CheckCircle },
  cancelled: { label: "Cancelada", color: "bg-red-500", icon: XCircle },
};

export default function Consignments() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { groupedByProduct, pendingCount, markNotified, dismissNotification } = useWaitlistNotifications();

  // Handle navigation state to open new consignment dialog
  useEffect(() => {
    const state = location.state as any;
    if (state?.openNewConsignment) {
      setNewDialogOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const { data: consignments = [], isLoading, refetch } = useQuery({
    queryKey: ["consignments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("consignments")
        .select(`
          id,
          status,
          created_at,
          deadline_at,
          shipping_cost,
          approved_at,
          access_token,
          customers (id, name, phone),
          consignment_items (count)
        `)
        .eq("seller_id", user.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Consignment[];
    },
    enabled: !!user,
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["store-settings-for-consignment", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data } = await supabase
        .from("store_settings")
        .select("store_slug, whatsapp_number, custom_domain")
        .eq("owner_id", user.id)
        .single();

      return data as { store_slug: string; whatsapp_number: string | null; custom_domain: string | null } | null;
    },
    enabled: !!user,
  });

  const getPublicUrl = (token: string) => {
    // Prioriza domínio personalizado, depois usa o padrão
    if (storeSettings?.custom_domain) {
      const domain = storeSettings.custom_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `https://${domain}/bag/${token}`;
    }
    return `https://vendaprofit.com.br/bag/${token}`;
  };

  const copyLink = async (token: string) => {
    const url = getPublicUrl(token);
    await navigator.clipboard.writeText(url);
    setCopiedId(token);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendWhatsApp = (consignment: Consignment) => {
    if (!consignment.customers?.phone) {
      toast.error("Cliente não tem telefone cadastrado");
      return;
    }

    const url = getPublicUrl(consignment.access_token);
    const message = `Olá ${consignment.customers.name}! 🛍️\n\nSua malinha está pronta para você conferir!\n\nClique no link abaixo para visualizar os itens e aprovar o recebimento:\n${url}\n\nQualquer dúvida, é só me chamar! 💕`;
    
    const phone = consignment.customers.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bolsa Consignada</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas malinhas de consignação
            </p>
          </div>
          <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Malinha
          </Button>
        </div>

        {/* Waitlist Notifications Alert */}
        {pendingCount > 0 && (
          <div className="space-y-3">
            {groupedByProduct.map((group) => (
              <Card key={group.product_id} className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <Bell className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">
                          {group.product_name} retornou ao estoque
                        </h4>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          <Users className="h-3 w-3 inline mr-1" />
                          {group.customers.length} cliente{group.customers.length > 1 ? "s" : ""} na fila de espera
                        </p>
                        <div className="mt-2 space-y-1">
                          {group.customers.map((customer, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{customer.name}</span>
                              {customer.phone && (
                                <button
                                  className="text-primary hover:underline flex items-center gap-1 text-xs"
                                  onClick={() => {
                                    const phone = customer.phone.replace(/\D/g, "");
                                    const message = `Olá ${customer.name}! 🎉\n\nO produto ${group.product_name} que você estava aguardando está disponível novamente!\n\nDeseja reservar?`;
                                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
                                  }}
                                >
                                  <Phone className="h-3 w-3" />
                                  {customer.phone}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const contacts = group.customers
                            .map(c => `${c.name}${c.phone ? ` - ${c.phone}` : ""}`)
                            .join("\n");
                          navigator.clipboard.writeText(contacts);
                          toast.success("Contatos copiados!");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          group.notification_ids.forEach(id => dismissNotification.mutate(id));
                          toast.success("Notificação dispensada");
                        }}
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-5 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : consignments.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma malinha criada</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira malinha de consignação para começar
            </p>
            <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Malinha
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {consignments.map((consignment) => {
              const status = statusConfig[consignment.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              const itemCount = consignment.consignment_items?.[0]?.count || 0;

              return (
                <Card key={consignment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {consignment.customers?.name || "Cliente não definido"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(consignment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge className={`${status.color} text-white gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Itens:</span>
                      <span className="font-medium">{itemCount}</span>
                    </div>
                    
                    {consignment.deadline_at && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Prazo:</span>
                        <span className="font-medium">
                          {format(new Date(consignment.deadline_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    )}

                    {consignment.shipping_cost && consignment.shipping_cost > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Frete:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(consignment.shipping_cost)}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedConsignment(consignment)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      
                      {consignment.status === "awaiting_approval" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(consignment.access_token)}
                          >
                            {copiedId === consignment.access_token ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => sendWhatsApp(consignment)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <NewConsignmentDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSuccess={() => {
          refetch();
          setNewDialogOpen(false);
        }}
      />

      {selectedConsignment && (
        <ConsignmentDetailsDialog
          consignment={selectedConsignment}
          open={!!selectedConsignment}
          onOpenChange={(open) => !open && setSelectedConsignment(null)}
          onUpdate={refetch}
        />
      )}
    </MainLayout>
  );
}
