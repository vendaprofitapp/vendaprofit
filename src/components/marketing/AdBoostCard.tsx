import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Rocket, AlertTriangle, Settings } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface AdBoostCardProps {
  task: {
    id: string;
    task_type: string;
    title: string;
    description: string;
    product_id: string | null;
    product_name: string | null;
    metric_value: number | null;
  };
  integrations: { platform: string; is_active: boolean }[];
  onCreated?: () => void;
}

const PLATFORM_MAP: Record<string, { label: string; color: string; icon: string }> = {
  ad_boost_meta: { label: "Meta / Instagram", color: "bg-pink-500", icon: "📸" },
  ad_google_pmax: { label: "Google Ads", color: "bg-blue-500", icon: "🔍" },
};

export function AdBoostCard({ task, integrations, onCreated }: AdBoostCardProps) {
  const navigate = useNavigate();
  const [budget, setBudget] = useState(30);

  const platformInfo = PLATFORM_MAP[task.task_type] || { label: "Anúncio", color: "bg-primary", icon: "📢" };
  const targetPlatform = task.task_type === "ad_boost_meta" ? "meta_ads" : "google_ads";
  const isConnected = integrations.some((i) => i.platform === targetPlatform && i.is_active);

  const createCampaign = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const res = await supabase.functions.invoke("create-ad-campaign", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          product_id: task.product_id,
          platform: targetPlatform,
          daily_budget: budget,
          campaign_type: task.task_type === "ad_boost_meta" ? "boost" : "performance_max",
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Anúncio criado! ${data.campaign_name}`);
      // Mark task as completed
      supabase.from("marketing_tasks").update({ is_completed: true, completed_at: new Date().toISOString() }).eq("id", task.id).then();
      onCreated?.();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar anúncio"),
  });

  const estimatedReach = budget * 100;

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{platformInfo.icon}</span>
              <h3 className="font-semibold text-sm">{task.title}</h3>
              <Badge className={`${platformInfo.color} text-white text-[10px]`}>
                {platformInfo.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{task.description}</p>
          </div>
        </div>

        {!isConnected ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">
              {platformInfo.label} não conectado.{" "}
              <button
                onClick={() => navigate("/settings")}
                className="underline font-medium inline-flex items-center gap-0.5"
              >
                <Settings className="h-3 w-3" /> Ir para Configurações
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Orçamento diário</span>
                <span className="font-bold text-primary">R$ {budget}/dia</span>
              </div>
              <Slider
                min={15}
                max={100}
                step={5}
                value={[budget]}
                onValueChange={(v) => setBudget(v[0])}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>R$ 15</span>
                <span>R$ 100</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Alcance estimado: ~{estimatedReach.toLocaleString("pt-BR")} pessoas/dia
            </p>

            <Button
              className="w-full gap-2"
              onClick={() => createCampaign.mutate()}
              disabled={createCampaign.isPending}
            >
              <Rocket className="h-4 w-4" />
              {createCampaign.isPending ? "Criando..." : "Criar Anúncio Agora"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
