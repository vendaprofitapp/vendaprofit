import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users, Megaphone, Sparkles, Search, RefreshCw, UserPlus, Zap, Store } from "lucide-react";
import { toast } from "sonner";
import { ContentTaskCard } from "@/components/marketing/ContentTaskCard";
import { SearchDemandCard } from "@/components/marketing/SearchDemandCard";
import { GroupRecommendationCard } from "@/components/marketing/GroupRecommendationCard";
import { AdBoostCard } from "@/components/marketing/AdBoostCard";
import { ActiveCampaignsList } from "@/components/marketing/ActiveCampaignsList";
import { AdStockPausedCard } from "@/components/marketing/AdStockPausedCard";
import { ExternalShowcasesSection } from "@/components/marketing/ExternalShowcasesSection";

export default function Marketing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("content");

  const { data: storeSettings } = useQuery({
    queryKey: ["my-store-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("store_name, store_slug, id, lead_capture_enabled")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const toggleLeadCapture = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!storeSettings?.id) throw new Error("Loja não encontrada");
      const { error } = await supabase
        .from("store_settings")
        .update({ lead_capture_enabled: enabled } as any)
        .eq("id", storeSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-store-settings"] });
      toast.success("Configuração atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar configuração"),
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

  // Fetch ad-related tasks
  const { data: adTasks = [] } = useQuery({
    queryKey: ["ad-tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_tasks")
        .select("*")
        .eq("owner_id", user!.id)
        .in("task_type", ["ad_boost_meta", "ad_google_pmax", "ad_stock_paused"])
        .eq("is_completed", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && activeTab === "ads",
  });

  // Fetch ad campaigns
  const { data: adCampaigns = [] } = useQuery({
    queryKey: ["ad-campaigns", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_campaigns")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && activeTab === "ads",
  });

  // Fetch integrations
  const { data: adIntegrations = [] } = useQuery({
    queryKey: ["ad-integrations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_ad_integrations")
        .select("platform, is_active")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && activeTab === "ads",
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
      queryClient.invalidateQueries({ queryKey: ["ad-tasks"] });
      toast.success(`${data.tasks_generated} insights gerados!`);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao gerar insights"),
  });

  const boostTasks = adTasks.filter((t: any) => t.task_type === "ad_boost_meta" || t.task_type === "ad_google_pmax");
  const stockPausedTasks = adTasks.filter((t: any) => t.task_type === "ad_stock_paused");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Redes Sociais / Google</h1>
              <p className="text-sm text-muted-foreground">Otimize seu catálogo e alcance</p>
            </div>
          </div>
          {(activeTab === "content" || activeTab === "seo" || activeTab === "groups" || activeTab === "ads") && (
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
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="lead-capture-toggle" className="text-sm font-medium cursor-pointer">Captura de Leads</Label>
                <p className="text-xs text-muted-foreground">Solicitar nome e WhatsApp ao adicionar itens ao carrinho</p>
              </div>
            </div>
            <Switch
              id="lead-capture-toggle"
              checked={(storeSettings as any)?.lead_capture_enabled !== false}
              onCheckedChange={(checked) => toggleLeadCapture.mutate(checked)}
              disabled={toggleLeadCapture.isPending || !storeSettings}
            />
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
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
              Parcerias
            </TabsTrigger>
            <TabsTrigger value="ads" className="gap-1.5 text-xs">
              <Zap className="h-3.5 w-3.5" />
              Anúncios
            </TabsTrigger>
            <TabsTrigger value="showcases" className="gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" />
              Vitrines
            </TabsTrigger>
          </TabsList>

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
                title="Nenhuma recomendação de parceria"
                description='Clique em "Atualizar Insights" para descobrir parcerias que podem expandir seu catálogo.'
              />
            ) : (
              <div className="space-y-4">
                {marketingTasks.map((task: any) => (
                  <GroupRecommendationCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>


          {/* Ads Tab */}
          <TabsContent value="ads" className="mt-4">
            <div className="space-y-4">
              {stockPausedTasks.map((task: any) => (
                <AdStockPausedCard key={task.id} task={task} />
              ))}
              {boostTasks.map((task: any) => (
                <AdBoostCard key={task.id} task={task} integrations={adIntegrations as any} onCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
                  queryClient.invalidateQueries({ queryKey: ["ad-tasks"] });
                }} />
              ))}
              <ActiveCampaignsList campaigns={adCampaigns as any} />
              {boostTasks.length === 0 && stockPausedTasks.length === 0 && (adCampaigns as any[]).length === 0 && (
                <EmptyState
                  icon={Zap}
                  title="Nenhum anúncio ativo"
                  description='Conecte suas contas em Configurações e clique "Atualizar Insights" para receber recomendações de anúncios.'
                />
              )}
            </div>
          </TabsContent>

          {/* Showcases Tab */}
          <TabsContent value="showcases" className="mt-4">
            <ExternalShowcasesSection />
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
