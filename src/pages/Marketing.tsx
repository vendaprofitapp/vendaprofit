import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, ShoppingCart, Clock, Users, Megaphone, Package, Sparkles, Search, RefreshCw, CheckCircle2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContentTaskCard } from "@/components/marketing/ContentTaskCard";
import { SearchDemandCard } from "@/components/marketing/SearchDemandCard";
import { GroupRecommendationCard } from "@/components/marketing/GroupRecommendationCard";
import { AnalyticsDashboard } from "@/components/marketing/AnalyticsDashboard";
import { LeadsCRM } from "@/components/marketing/LeadsCRM";

interface LeadWithCart {
  id: string;
  name: string;
  whatsapp: string;
  created_at: string;
  last_seen_at: string | null;
  store_name: string;
  items: {
    id: string;
    product_name: string;
    variant_color: string | null;
    selected_size: string | null;
    quantity: number;
    unit_price: number;
    status: string;
  }[];
  cart_total: number;
}

export default function Marketing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [analyticsDateRange, setAnalyticsDateRange] = useState({
    start: startOfDay(subDays(new Date(), 6)),
    end: new Date(),
  });

  const { data: storeSettings } = useQuery({
    queryKey: ["my-store-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("store_name, store_slug")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch leads for pending/contacted tabs
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["marketing-leads", user?.id, activeTab],
    queryFn: async () => {
      const targetStatus = activeTab === "pending" ? "abandoned" : "contacted";
      const { data: cartItems, error } = await supabase
        .from("lead_cart_items")
        .select("*, store_leads!inner(id, name, whatsapp, created_at, last_seen_at, owner_id, store_id)")
        .eq("status", targetStatus)
        .eq("store_leads.owner_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const leadMap = new Map<string, LeadWithCart>();
      (cartItems || []).forEach((item: any) => {
        const lead = item.store_leads;
        if (!leadMap.has(lead.id)) {
          leadMap.set(lead.id, {
            id: lead.id, name: lead.name, whatsapp: lead.whatsapp,
            created_at: lead.created_at, last_seen_at: lead.last_seen_at,
            store_name: storeSettings?.store_name || "nossa loja",
            items: [], cart_total: 0,
          });
        }
        const entry = leadMap.get(lead.id)!;
        entry.items.push({
          id: item.id, product_name: item.product_name, variant_color: item.variant_color,
          selected_size: item.selected_size, quantity: item.quantity,
          unit_price: item.unit_price, status: item.status,
        });
        entry.cart_total += item.unit_price * item.quantity;
      });

      return Array.from(leadMap.values());
    },
    enabled: !!user?.id && (activeTab === "pending" || activeTab === "contacted"),
  });

  // Fetch marketing tasks
  const { data: marketingTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["marketing-tasks", user?.id, activeTab],
    queryFn: async () => {
      const taskTypeMap: Record<string, string[]> = {
        seo: ["search_demand"],
        content: ["high_objection", "hidden_gold", "capital_freeze"],
        groups: ["group_cross_sell", "group_opportunity", "group_create"],
      };
      const taskTypes = taskTypeMap[activeTab] || [];
      
      const { data, error } = await supabase
        .from("marketing_tasks")
        .select("*")
        .eq("owner_id", user!.id)
        .in("task_type", taskTypes)
        .eq("is_completed", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && (activeTab === "content" || activeTab === "seo" || activeTab === "groups"),
  });

  // Generate insights mutation
  const generateInsights = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const res = await supabase.functions.invoke("generate-marketing-tasks", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
      toast.success(`${data.tasks_generated} insights gerados!`);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao gerar insights"),
  });

  const markContacted = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("lead_cart_items")
        .update({ status: "contacted" })
        .eq("lead_id", leadId)
        .eq("status", "abandoned");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
      toast.success("Lead marcado como contatado!");
    },
  });

  const sendWhatsApp = (lead: LeadWithCart) => {
    const storeName = storeSettings?.store_name || "nossa loja";
    const message = `Oi ${lead.name}, aqui é da ${storeName}. Vi que você separou algumas peças lindas no carrinho, mas não finalizou. Posso te ajudar com alguma dúvida sobre tamanhos ou frete?`;
    const phone = lead.whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
    markContacted.mutate(lead.id);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Marketing</h1>
              <p className="text-sm text-muted-foreground">Recupere vendas e otimize seu catálogo</p>
            </div>
          </div>
          {(activeTab === "content" || activeTab === "seo" || activeTab === "groups") && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => generateInsights.mutate()}
              disabled={generateInsights.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${generateInsights.isPending ? "animate-spin" : ""}`} />
              Atualizar Insights
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-3xl grid-cols-6">
            <TabsTrigger value="pending" className="gap-1.5 text-xs">
              <ShoppingCart className="h-3.5 w-3.5" />
              Pendentes
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5 text-xs">
              <Search className="h-3.5 w-3.5" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Grupos
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="contacted" className="gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Contatados
            </TabsTrigger>
          </TabsList>

          {/* Pending Tab */}
          <TabsContent value="pending" className="mt-4">
            {isLoading ? (
              <LoadingSkeleton />
            ) : leads.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="Nenhum carrinho abandonado" description="Quando visitantes deixarem itens no carrinho sem finalizar, eles aparecerão aqui." />
            ) : (
              <div className="space-y-4">
                {leads.map(lead => (
                  <AbandonedCartCard key={lead.id} lead={lead} onSendWhatsApp={() => sendWhatsApp(lead)} formatPrice={formatPrice} isPending />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="mt-4">
            {tasksLoading ? (
              <LoadingSkeleton />
            ) : marketingTasks.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Nenhum insight de conteúdo"
                description='Clique em "Atualizar Insights" para gerar cards de ação baseados nas métricas da sua loja.'
              />
            ) : (
              <div className="space-y-4">
                {marketingTasks.map((task: any) => (
                  <ContentTaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="mt-4">
            {tasksLoading ? (
              <LoadingSkeleton />
            ) : marketingTasks.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nenhuma demanda de pesquisa"
                description='Clique em "Atualizar Insights" para analisar o que seus visitantes estão pesquisando na loja.'
              />
            ) : (
              <div className="space-y-4">
                {marketingTasks.map((task: any) => (
                  <SearchDemandCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="mt-4">
            {tasksLoading ? (
              <LoadingSkeleton />
            ) : marketingTasks.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhuma recomendação de grupo"
                description='Clique em "Atualizar Insights" para descobrir grupos que podem expandir seu catálogo.'
              />
            ) : (
              <div className="space-y-4">
                {marketingTasks.map((task: any) => (
                  <GroupRecommendationCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            {user?.id && (
              <div className="space-y-8">
                <AnalyticsDashboard
                  ownerId={user.id}
                  dateRange={analyticsDateRange}
                  onDateRangeChange={setAnalyticsDateRange}
                />
                <LeadsCRM ownerId={user.id} dateRange={analyticsDateRange} />
              </div>
            )}
          </TabsContent>

          {/* Contacted Tab */}
          <TabsContent value="contacted" className="mt-4">
            {isLoading ? (
              <LoadingSkeleton />
            ) : leads.length === 0 ? (
              <EmptyState icon={Users} title="Nenhum lead contatado ainda" description="Leads contatados aparecerão aqui após você enviar o WhatsApp." />
            ) : (
              <div className="space-y-4">
                {leads.map(lead => (
                  <AbandonedCartCard key={lead.id} lead={lead} onSendWhatsApp={() => sendWhatsApp(lead)} formatPrice={formatPrice} isPending={false} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse rounded-xl border p-4 space-y-3">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="text-center py-16">
      <Icon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function AbandonedCartCard({ lead, onSendWhatsApp, formatPrice, isPending }: {
  lead: LeadWithCart;
  onSendWhatsApp: () => void;
  formatPrice: (p: number) => string;
  isPending: boolean;
}) {
  const timeAgo = formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base truncate">{lead.name}</h3>
            {isPending ? (
              <Badge variant="destructive" className="text-[10px] shrink-0">Recuperar</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] shrink-0">Contatado</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo}</span>
            <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{lead.items.length} {lead.items.length === 1 ? "item" : "itens"}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-primary">{formatPrice(lead.cart_total)}</p>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        {lead.items.slice(0, 3).map(item => (
          <div key={item.id} className="flex justify-between text-muted-foreground">
            <span className="truncate flex-1">
              {item.product_name}
              {item.variant_color ? ` - ${item.variant_color}` : ""}
              {item.selected_size ? ` (${item.selected_size})` : ""}
              {item.quantity > 1 ? ` x${item.quantity}` : ""}
            </span>
            <span className="ml-2 shrink-0">{formatPrice(item.unit_price * item.quantity)}</span>
          </div>
        ))}
        {lead.items.length > 3 && (
          <p className="text-xs text-muted-foreground">+{lead.items.length - 3} mais itens</p>
        )}
      </div>

      {isPending && (
        <Button onClick={onSendWhatsApp} className="w-full gap-2 font-semibold" style={{ backgroundColor: "#25D366" }}>
          <MessageCircle className="h-4 w-4" />
          Enviar WhatsApp
        </Button>
      )}
    </div>
  );
}
