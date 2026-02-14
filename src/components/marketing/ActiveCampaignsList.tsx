import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Campaign {
  id: string;
  campaign_name: string;
  platform: string;
  daily_budget: number;
  status: string;
  target_url: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  paused: { label: "Pausado", variant: "outline" },
  paused_no_stock: { label: "Pausado (sem stock)", variant: "destructive" },
  error: { label: "Erro", variant: "destructive" },
  completed: { label: "Concluído", variant: "secondary" },
};

const PLATFORM_ICON: Record<string, string> = {
  meta_ads: "📸",
  google_ads: "🔍",
  tiktok_ads: "🎵",
};

interface Props {
  campaigns: Campaign[];
}

export function ActiveCampaignsList({ campaigns }: Props) {
  const queryClient = useQueryClient();

  const manageCampaign = useMutation({
    mutationFn: async ({ campaignId, action }: { campaignId: string; action: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const res = await supabase.functions.invoke("manage-ad-campaign", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { campaign_id: campaignId, action },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
      const msgs: Record<string, string> = {
        pause: "Campanha pausada",
        resume: "Campanha retomada",
        delete: "Campanha removida",
      };
      toast.success(msgs[action] || "Ação realizada");
    },
    onError: (err: any) => toast.error(err.message || "Erro"),
  });

  if (campaigns.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground">Campanhas Ativas</h3>
      {campaigns.map((c) => {
        const statusInfo = STATUS_MAP[c.status] || { label: c.status, variant: "outline" as const };
        return (
          <Card key={c.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-lg">{PLATFORM_ICON[c.platform] || "📢"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.campaign_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={statusInfo.variant} className="text-[10px]">
                      {statusInfo.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      R$ {c.daily_budget}/dia
                    </span>
                  </div>
                  {c.status === "paused_no_stock" && (
                    <p className="text-[11px] text-destructive mt-1">
                      ⚠️ Pausado automaticamente — stock esgotado
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {c.status === "active" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => manageCampaign.mutate({ campaignId: c.id, action: "pause" })}
                    disabled={manageCampaign.isPending}
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                {(c.status === "paused" || c.status === "paused_no_stock") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => manageCampaign.mutate({ campaignId: c.id, action: "resume" })}
                    disabled={manageCampaign.isPending}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => manageCampaign.mutate({ campaignId: c.id, action: "delete" })}
                  disabled={manageCampaign.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
