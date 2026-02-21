import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cake, Calendar, AlertTriangle, Users, MessageCircle, ArrowRight, CreditCard, Clock, CheckCircle, ShoppingCart, Zap, ShoppingBag, Package, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  birth_date: string | null;
}

interface ConsortiumPayment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string | null;
  is_paid: boolean;
  participant: {
    customer_name: string;
    customer_phone: string | null;
  } | null;
}

interface StockRequest {
  id: string;
  quantity: number;
  status: string;
  product_name: string | null;
  requester_profile?: {
    full_name: string;
  } | null;
  owner_profile?: {
    full_name: string;
  } | null;
}

interface PaymentReminder {
  id: string;
  amount: number;
  due_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method_name: string;
}

export function SystemAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayMonthDay = format(new Date(), "MM-dd");

  // Aniversariantes de hoje
  const { data: birthdayCustomers = [] } = useQuery({
    queryKey: ["birthday-customers", user?.id, todayMonthDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, birth_date")
        .not("birth_date", "is", null);
      if (error) throw error;
      
      // Filtrar por mês e dia
      return (data as Customer[]).filter(c => {
        if (!c.birth_date) return false;
        const birthMonthDay = c.birth_date.substring(5); // "MM-DD"
        return birthMonthDay === todayMonthDay;
      });
    },
    enabled: !!user?.id,
  });

  // Pagamentos de consórcio vencendo hoje
  const { data: dueTodayPayments = [] } = useQuery({
    queryKey: ["due-today-payments", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_payments")
        .select(`
          id,
          installment_number,
          amount,
          due_date,
          is_paid,
          participant:consortium_participants(customer_name, customer_phone)
        `)
        .eq("due_date", today)
        .eq("is_paid", false);
      if (error) throw error;
      return data as unknown as ConsortiumPayment[];
    },
    enabled: !!user?.id,
  });

  // Pagamentos de consórcio em atraso
  const { data: overduePayments = [] } = useQuery({
    queryKey: ["overdue-payments", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_payments")
        .select(`
          id,
          installment_number,
          amount,
          due_date,
          is_paid,
          participant:consortium_participants(customer_name, customer_phone)
        `)
        .lt("due_date", today)
        .eq("is_paid", false);
      if (error) throw error;
      return data as unknown as ConsortiumPayment[];
    },
    enabled: !!user?.id,
  });

  // Buscar formas de pagamento "a prazo" (is_deferred = true)
  const { data: deferredPaymentMethods = [] } = useQuery({
    queryKey: ["deferred-payment-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("name")
        .eq("owner_id", user?.id)
        .eq("is_deferred", true)
        .eq("is_active", true);
      if (error) throw error;
      return data.map(pm => pm.name);
    },
    enabled: !!user?.id,
  });

  // Pagamentos a prazo vencendo hoje
  const { data: deferredDueToday = [] } = useQuery({
    queryKey: ["deferred-due-today", user?.id, today, deferredPaymentMethods],
    queryFn: async () => {
      if (deferredPaymentMethods.length === 0) return [];
      
      const { data, error } = await supabase
        .from("payment_reminders")
        .select("id, amount, due_date, customer_name, customer_phone, payment_method_name")
        .eq("owner_id", user?.id)
        .eq("due_date", today)
        .eq("is_paid", false)
        .in("payment_method_name", deferredPaymentMethods);
      if (error) throw error;
      return data as PaymentReminder[];
    },
    enabled: !!user?.id && deferredPaymentMethods.length > 0,
  });

  // Pagamentos a prazo em atraso
  const { data: deferredOverdue = [] } = useQuery({
    queryKey: ["deferred-overdue", user?.id, today, deferredPaymentMethods],
    queryFn: async () => {
      if (deferredPaymentMethods.length === 0) return [];
      
      const { data, error } = await supabase
        .from("payment_reminders")
        .select("id, amount, due_date, customer_name, customer_phone, payment_method_name")
        .eq("owner_id", user?.id)
        .lt("due_date", today)
        .eq("is_paid", false)
        .in("payment_method_name", deferredPaymentMethods);
      if (error) throw error;
      return data as PaymentReminder[];
    },
    enabled: !!user?.id && deferredPaymentMethods.length > 0,
  });

  // Solicitações de parceiros pendentes (recebidas)
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pending-stock-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_requests")
        .select(`
          id,
          quantity,
          status,
          product_name,
          requester_id
        `)
        .eq("owner_id", user?.id)
        .eq("status", "pending");
      if (error) throw error;
      
      // Buscar nomes dos solicitantes
      const requestsWithNames = await Promise.all(
        (data || []).map(async (req) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", req.requester_id)
            .single();
          return {
            ...req,
            requester_profile: profile
          };
        })
      );
      
      return requestsWithNames as StockRequest[];
    },
    enabled: !!user?.id,
  });

  // Minhas solicitações enviadas pendentes (aguardando resposta)
  const { data: mySentPendingRequests = [] } = useQuery({
    queryKey: ["my-sent-pending-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_requests")
        .select(`
          id,
          quantity,
          status,
          product_name,
          owner_id
        `)
        .eq("requester_id", user?.id)
        .eq("status", "pending");
      if (error) throw error;
      
      // Buscar nomes dos donos
      const requestsWithNames = await Promise.all(
        (data || []).map(async (req) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", req.owner_id)
            .single();
          return {
            ...req,
            owner_profile: profile
          };
        })
      );
      
      return requestsWithNames as StockRequest[];
    },
    enabled: !!user?.id,
  });

  // Minhas solicitações aprovadas (prontas para vender)
  const { data: myApprovedRequests = [] } = useQuery({
    queryKey: ["my-approved-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_requests")
        .select(`
          id,
          quantity,
          status,
          product_name,
          owner_id
        `)
        .eq("requester_id", user?.id)
        .eq("status", "approved");
      if (error) throw error;
      
      // Buscar nomes dos donos
      const requestsWithNames = await Promise.all(
        (data || []).map(async (req) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", req.owner_id)
            .single();
          return {
            ...req,
            owner_profile: profile
          };
        })
      );
      
      return requestsWithNames as StockRequest[];
    },
    enabled: !!user?.id,
  });

  const openWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Bolsa Consignada — clientes finalizaram escolhas
  const { data: consignmentsReady = [] } = useQuery({
    queryKey: ["alerts-consignments-ready", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consignments")
        .select("id, customers(name)")
        .eq("seller_id", user!.id)
        .eq("status", "finalized_by_client");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Modo Evento — rascunhos pendentes
  const { data: eventDrafts = [] } = useQuery({
    queryKey: ["alerts-event-drafts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sale_drafts")
        .select("id, estimated_total")
        .eq("owner_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Bazar VIP — novos itens para curadoria
  const { data: bazarPendingItems = [] } = useQuery({
    queryKey: ["alerts-bazar-pending", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazar_items")
        .select("id, title")
        .eq("owner_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Bazar VIP — vendas realizadas (últimos 7 dias)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: bazarSoldItems = [] } = useQuery({
    queryKey: ["alerts-bazar-sold", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazar_items")
        .select("id, title, final_price")
        .eq("owner_id", user!.id)
        .eq("status", "sold")
        .gte("sold_at", sevenDaysAgo);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Pontos Parceiros — movimentações recentes (24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: partnerMovements = [] } = useQuery({
    queryKey: ["alerts-partner-movements", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_point_items")
        .select("id, status")
        .eq("owner_id", user!.id)
        .in("status", ["returned", "sold"])
        .gte("updated_at", oneDayAgo);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const hasAlerts = birthdayCustomers.length > 0 || dueTodayPayments.length > 0 || overduePayments.length > 0 || pendingRequests.length > 0 || deferredDueToday.length > 0 || deferredOverdue.length > 0 || mySentPendingRequests.length > 0 || myApprovedRequests.length > 0 || consignmentsReady.length > 0 || eventDrafts.length > 0 || bazarPendingItems.length > 0 || bazarSoldItems.length > 0 || partnerMovements.length > 0;

  if (!hasAlerts) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {/* Aniversariantes */}
      {birthdayCustomers.length > 0 && (
        <Card className="border-pink-500/30 bg-pink-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-pink-500">
              <Cake className="h-4 w-4" />
              Aniversariantes Hoje
              <Badge variant="secondary" className="ml-auto">{birthdayCustomers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {birthdayCustomers.slice(0, 3).map((customer) => (
              <div key={customer.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{customer.name}</span>
                {customer.phone && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-500"
                    onClick={() => openWhatsApp(customer.phone!, `Olá ${customer.name}! 🎂 Feliz aniversário! Desejamos muitas felicidades!`)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {birthdayCustomers.length > 3 && (
              <Button variant="link" size="sm" className="p-0 h-auto text-pink-500" onClick={() => navigate("/customers")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vencimentos Hoje */}
      {dueTodayPayments.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-500">
              <Calendar className="h-4 w-4" />
              Vencendo Hoje
              <Badge variant="secondary" className="ml-auto">{dueTodayPayments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueTodayPayments.slice(0, 3).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm">
                <div className="truncate">
                  <span>{payment.participant?.customer_name}</span>
                  <span className="text-muted-foreground ml-1">(R$ {Number(payment.amount).toFixed(2)})</span>
                </div>
                {payment.participant?.customer_phone && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-500"
                    onClick={() => openWhatsApp(payment.participant!.customer_phone!, `Olá ${payment.participant!.customer_name}! Lembramos que a parcela ${payment.installment_number} do consórcio vence hoje. Valor: R$ ${Number(payment.amount).toFixed(2)}`)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {dueTodayPayments.length > 3 && (
              <Button variant="link" size="sm" className="p-0 h-auto text-yellow-500" onClick={() => navigate("/consortiums")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagamentos em Atraso */}
      {overduePayments.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Pagamentos Atrasados
              <Badge variant="destructive" className="ml-auto">{overduePayments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overduePayments.slice(0, 3).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm">
                <div className="truncate">
                  <span>{payment.participant?.customer_name}</span>
                  <span className="text-muted-foreground ml-1">(R$ {Number(payment.amount).toFixed(2)})</span>
                </div>
                {payment.participant?.customer_phone && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-500"
                    onClick={() => openWhatsApp(payment.participant!.customer_phone!, `Olá ${payment.participant!.customer_name}! Identificamos que a parcela ${payment.installment_number} do consórcio está em atraso. Valor: R$ ${Number(payment.amount).toFixed(2)}. Por favor, entre em contato para regularização.`)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {overduePayments.length > 3 && (
              <Button variant="link" size="sm" className="p-0 h-auto text-destructive" onClick={() => navigate("/consortiums")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vendas a Prazo - Vencendo Hoje */}
      {deferredDueToday.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-500">
              <CreditCard className="h-4 w-4" />
              Vendas a Prazo - Hoje
              <Badge variant="secondary" className="ml-auto">{deferredDueToday.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deferredDueToday.slice(0, 3).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm">
                <div className="truncate">
                  <span>{payment.customer_name || "Cliente"}</span>
                  <span className="text-muted-foreground ml-1">(R$ {Number(payment.amount).toFixed(2)})</span>
                </div>
                {payment.customer_phone && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-500"
                    onClick={() => openWhatsApp(payment.customer_phone!, `Olá ${payment.customer_name || ""}! Lembramos que seu pagamento no valor de R$ ${Number(payment.amount).toFixed(2)} vence hoje.`)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {deferredDueToday.length > 3 && (
              <Button variant="link" size="sm" className="p-0 h-auto text-orange-500" onClick={() => navigate("/dashboard")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vendas a Prazo - Em Atraso */}
      {deferredOverdue.length > 0 && (
        <Card className="border-red-600/30 bg-red-600/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
              <CreditCard className="h-4 w-4" />
              Vendas a Prazo Atrasadas
              <Badge variant="destructive" className="ml-auto">{deferredOverdue.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deferredOverdue.slice(0, 3).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm">
                <div className="truncate">
                  <span>{payment.customer_name || "Cliente"}</span>
                  <span className="text-muted-foreground ml-1">(R$ {Number(payment.amount).toFixed(2)})</span>
                </div>
                {payment.customer_phone && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-500"
                    onClick={() => openWhatsApp(payment.customer_phone!, `Olá ${payment.customer_name || ""}! Identificamos que seu pagamento no valor de R$ ${Number(payment.amount).toFixed(2)} está em atraso. Por favor, entre em contato para regularização.`)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {deferredOverdue.length > 3 && (
              <Button variant="link" size="sm" className="p-0 h-auto text-red-600" onClick={() => navigate("/dashboard")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Solicitações de Parceiros (Recebidas) */}
      {pendingRequests.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
              <Users className="h-4 w-4" />
              Solicitações Recebidas
              <Badge className="ml-auto">{pendingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="text-sm truncate">
                <span className="font-medium">{request.requester_profile?.full_name}</span>
                <span className="text-muted-foreground"> - {request.quantity}x {request.product_name || "Produto"}</span>
              </div>
            ))}
            {pendingRequests.length > 3 && (
              <Button variant="link" size="sm" className="p-0 h-auto text-primary" onClick={() => navigate("/stock-requests")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            <Button size="sm" className="w-full mt-2" onClick={() => navigate("/stock-requests")}>
              Gerenciar Solicitações
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Minhas Solicitações Aguardando Resposta */}
      {mySentPendingRequests.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-500">
              <Clock className="h-4 w-4" />
              Aguardando Resposta
              <Badge variant="secondary" className="ml-auto">{mySentPendingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mySentPendingRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="text-sm truncate">
                <span className="text-muted-foreground">{request.quantity}x {request.product_name || "Produto"}</span>
                <span className="font-medium"> - {request.owner_profile?.full_name}</span>
              </div>
            ))}
            {mySentPendingRequests.length > 3 && (
              <Button variant="link" size="sm" className="p-0 h-auto text-amber-500" onClick={() => navigate("/stock-requests")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Minhas Solicitações Aprovadas (Prontas para Vender) */}
      {myApprovedRequests.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-500">
              <CheckCircle className="h-4 w-4" />
              Prontas para Vender
              <Badge variant="secondary" className="ml-auto bg-green-500/20 text-green-500">{myApprovedRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myApprovedRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="text-sm truncate">
                <span className="text-muted-foreground">{request.quantity}x {request.product_name || "Produto"}</span>
                <span className="font-medium"> - {request.owner_profile?.full_name}</span>
              </div>
            ))}
            {myApprovedRequests.length > 3 && (
              <Button variant="link" size="sm" className="p-0 h-auto text-green-500" onClick={() => navigate("/stock-requests")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            <Button size="sm" className="w-full mt-2 bg-green-500 hover:bg-green-600" onClick={() => navigate("/stock-requests")}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Vender Agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bolsa Consignada — Clientes finalizaram escolhas */}
      {consignmentsReady.length > 0 && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-500">
              <ShoppingBag className="h-4 w-4" />
              Bolsa Consignada
              <Badge variant="secondary" className="ml-auto bg-purple-500/20 text-purple-500">{consignmentsReady.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {consignmentsReady.length} cliente{consignmentsReady.length > 1 ? "s" : ""} finalizou as escolhas e aguarda conciliação
            </p>
            <Button size="sm" className="w-full mt-1 bg-purple-500 hover:bg-purple-600 text-white" onClick={() => navigate("/consignments")}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Ver Bolsas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modo Evento — Rascunhos pendentes */}
      {eventDrafts.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
              <Zap className="h-4 w-4" />
              Modo Evento
              <Badge className="ml-auto">{eventDrafts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {eventDrafts.length} rascunho{eventDrafts.length > 1 ? "s" : ""} pendente{eventDrafts.length > 1 ? "s" : ""} de conciliar
            </p>
            <Button size="sm" className="w-full mt-1" onClick={() => navigate("/evento/conciliacao")}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Conciliar Vendas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bazar VIP — Novos itens para curadoria */}
      {bazarPendingItems.length > 0 && (
        <Card className="border-indigo-500/30 bg-indigo-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-indigo-500">
              <Package className="h-4 w-4" />
              Bazar VIP — Curadoria
              <Badge variant="secondary" className="ml-auto bg-indigo-500/20 text-indigo-500">{bazarPendingItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bazarPendingItems.slice(0, 2).map((item) => (
              <div key={item.id} className="text-xs text-muted-foreground truncate">• {item.title}</div>
            ))}
            <Button size="sm" className="w-full mt-1 bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => navigate("/admin/bazar")}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Gerenciar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bazar VIP — Vendas recentes */}
      {bazarSoldItems.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Bazar VIP — Vendas
              <Badge variant="secondary" className="ml-auto bg-green-500/20 text-green-600">{bazarSoldItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {bazarSoldItems.length} venda{bazarSoldItems.length > 1 ? "s" : ""} realizadas nos últimos 7 dias
            </p>
            <Button size="sm" variant="outline" className="w-full mt-1 border-green-500/30 text-green-600" onClick={() => navigate("/admin/bazar")}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Ver Bazar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pontos Parceiros — Movimentações recentes */}
      {partnerMovements.length > 0 && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-500">
              <MapPin className="h-4 w-4" />
              Pontos Parceiros
              <Badge variant="secondary" className="ml-auto bg-blue-500/20 text-blue-500">{partnerMovements.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {partnerMovements.length} movimentação{partnerMovements.length > 1 ? "ões" : ""} nas últimas 24h
            </p>
            <Button size="sm" className="w-full mt-1 bg-blue-500 hover:bg-blue-600 text-white" onClick={() => navigate("/partner-points")}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Ver Pontos
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
