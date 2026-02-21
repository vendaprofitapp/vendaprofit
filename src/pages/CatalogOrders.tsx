import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShoppingCart, Phone, ChevronDown, ChevronUp, Package,
  AlertTriangle, MessageCircle, CheckCircle2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type PeriodFilter = "today" | "7days" | "30days";

function getPeriodDate(period: PeriodFilter) {
  if (period === "today") return startOfDay(new Date()).toISOString();
  if (period === "7days") return subDays(new Date(), 7).toISOString();
  return subDays(new Date(), 30).toISOString();
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function openWhatsApp(phone: string, message?: string) {
  const cleaned = phone.replace(/\D/g, "");
  const url = `https://wa.me/55${cleaned}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  window.open(url, "_blank");
}

export default function CatalogOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodFilter>("7days");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedCarts, setExpandedCarts] = useState<Set<string>>(new Set());

  const sinceDate = getPeriodDate(period);

  // Fetch received orders
  const { data: orders = [], isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["catalog-orders", user?.id, sinceDate],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_carts")
        .select("*, saved_cart_items(*)")
        .eq("owner_id", user.id)
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar pedidos");
        throw error;
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  // Fetch abandoned carts
  const { data: abandonedCarts = [], isLoading: loadingAbandoned, refetch: refetchAbandoned } = useQuery({
    queryKey: ["abandoned-carts", user?.id, sinceDate],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("lead_cart_items")
        .select("*, store_leads!lead_cart_items_lead_id_fkey(id, name, whatsapp, owner_id, created_at)")
        .eq("status", "abandoned")
        .gte("created_at", sinceDate)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar carrinhos abandonados");
        throw error;
      }
      // Filter valid items and group by lead
      const filtered = (data || []).filter(
        (item: any) => item.store_leads?.owner_id === user.id
      );
      const grouped = new Map<string, { lead: any; items: any[] }>();
      for (const item of filtered) {
        const leadId = item.lead_id;
        if (!grouped.has(leadId)) {
          grouped.set(leadId, { lead: item.store_leads, items: [] });
        }
        grouped.get(leadId)!.items.push(item);
      }
      return Array.from(grouped.values());
    },
    enabled: !!user,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  // Mark lead as contacted
  const contactMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("lead_cart_items")
        .update({ status: "contacted" })
        .eq("lead_id", leadId)
        .eq("status", "abandoned");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como contatado!");
      queryClient.invalidateQueries({ queryKey: ["abandoned-carts"] });
    },
  });

  const toggleOrder = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCart = (id: string) => {
    setExpandedCarts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const waitingOrders = orders.filter((o: any) => o.status === "waiting");
  const convertedOrders = orders.filter((o: any) => o.status !== "waiting");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              Pedidos da Loja
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Acompanhe pedidos recebidos e carrinhos abandonados do seu catálogo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => { refetchOrders(); refetchAbandoned(); toast.success("Atualizado!"); }}
              title="Atualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="orders">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="orders" className="gap-2">
              <Package className="h-4 w-4" />
              Pedidos Recebidos
              {waitingOrders.length > 0 && (
                <Badge variant="default" className="ml-1 h-5 min-w-5 text-xs">
                  {waitingOrders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="abandoned" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Carrinhos Abandonados
              {abandonedCarts.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-xs">
                  {abandonedCarts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Pedidos Recebidos */}
          <TabsContent value="orders" className="space-y-3 mt-4">
            {loadingOrders ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nenhum pedido no período selecionado</p>
                  <p className="text-sm">Pedidos feitos pelo catálogo aparecerão aqui</p>
                </CardContent>
              </Card>
            ) : (
              orders.map((order: any) => {
                const isExpanded = expandedOrders.has(order.id);
                const items = order.saved_cart_items || [];
                return (
                  <Card key={order.id} className="overflow-hidden">
                    <button
                      onClick={() => toggleOrder(order.id)}
                      className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-primary">
                              #{order.short_code}
                            </span>
                            <Badge
                              variant={order.status === "waiting" ? "default" : "secondary"}
                              className={order.status === "waiting" ? "bg-amber-500/90 text-white" : ""}
                            >
                              {order.status === "waiting" ? "Aguardando" : "Convertido"}
                            </Badge>
                          </div>
                          <p className="font-medium mt-1 truncate">{order.customer_name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                            <span>{format(new Date(order.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                            <span className="font-semibold text-foreground">{formatBRL(order.total)}</span>
                            <span>{items.length} {items.length === 1 ? "item" : "itens"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {order.customer_phone && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                openWhatsApp(order.customer_phone, `Olá ${order.customer_name}! Vi seu pedido #${order.short_code} 🛍️`);
                              }}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Itens do Pedido</p>
                        {items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.product_name}</p>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                {item.variant_color && <span>Cor: {item.variant_color}</span>}
                                {item.selected_size && <span>Tam: {item.selected_size}</span>}
                                {item.source && (
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {item.source === "stock" ? "Estoque" : "Sob encomenda"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="font-medium">{formatBRL(item.unit_price)}</p>
                              <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 font-semibold text-sm">
                          <span>Total</span>
                          <span>{formatBRL(order.total)}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Tab: Carrinhos Abandonados */}
          <TabsContent value="abandoned" className="space-y-3 mt-4">
            {loadingAbandoned ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : abandonedCarts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nenhum carrinho abandonado</p>
                  <p className="text-sm">Quando clientes adicionarem itens sem finalizar, aparecerão aqui</p>
                </CardContent>
              </Card>
            ) : (
              abandonedCarts.map((group: any) => {
                const lead = group.lead;
                const items = group.items;
                const leadId = lead?.id || items[0]?.lead_id;
                const isExpanded = expandedCarts.has(leadId);
                const cartTotal = items.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0);

                return (
                  <Card key={leadId} className="overflow-hidden border-destructive/20">
                    <button
                      onClick={() => toggleCart(leadId)}
                      className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{lead?.name || "Cliente anônimo"}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                            <span>{format(new Date(items[0]?.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                            <span className="font-semibold text-destructive">{formatBRL(cartTotal)}</span>
                            <span>{items.length} {items.length === 1 ? "item" : "itens"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {lead?.whatsapp && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                openWhatsApp(lead.whatsapp, `Olá ${lead.name}! Vi que você estava olhando alguns produtos na nossa loja 😊 Posso te ajudar?`);
                              }}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              contactMutation.mutate(leadId);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Itens Abandonados</p>
                        {items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.product_name}</p>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                {item.variant_color && <span>Cor: {item.variant_color}</span>}
                                {item.selected_size && <span>Tam: {item.selected_size}</span>}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="font-medium">{formatBRL(item.unit_price)}</p>
                              <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 font-semibold text-sm">
                          <span>Total abandonado</span>
                          <span className="text-destructive">{formatBRL(cartTotal)}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
