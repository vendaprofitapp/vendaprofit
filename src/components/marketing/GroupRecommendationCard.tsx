import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Package, Plus, Eye, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ProfitSplitDisplay } from "./ProfitSplitDisplay";
import { GroupProductPreviewDialog } from "./GroupProductPreviewDialog";

interface GroupRecommendationCardProps {
  task: {
    id: string;
    task_type: string;
    title: string;
    description: string;
    product_name: string | null;
    metric_value: number | null;
    metric_secondary: number | null;
    group_id: string | null;
  };
}

export function GroupRecommendationCard({ task }: GroupRecommendationCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);

  const profitPercent = task.metric_secondary || 70;

  const joinGroupMutation = useMutation({
    mutationFn: async () => {
      if (!user || !task.group_id) throw new Error("Dados inválidos");

      // Insert as member
      const { error: joinError } = await supabase
        .from("group_members")
        .insert({ group_id: task.group_id, user_id: user.id, role: "member" });
      if (joinError) throw joinError;

      // Mark task as completed
      await supabase
        .from("marketing_tasks")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("id", task.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["group-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Você entrou no grupo!", { description: "Acesse suas Parcerias para ver os produtos.", action: { label: "Ver Parcerias", onClick: () => navigate("/partnerships") } });
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.info("Você já é membro deste grupo.");
      } else {
        toast.error(err.message || "Erro ao entrar no grupo");
      }
    },
  });

  const getIcon = () => {
    switch (task.task_type) {
      case "group_cross_sell": return <Package className="h-5 w-5 text-blue-500" />;
      case "group_opportunity": return <TrendingUp className="h-5 w-5 text-emerald-500" />;
      case "group_create": return <Plus className="h-5 w-5 text-amber-500" />;
      default: return <Users className="h-5 w-5 text-primary" />;
    }
  };

  const getBadgeColor = () => {
    switch (task.task_type) {
      case "group_cross_sell": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "group_opportunity": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
      case "group_create": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      default: return "";
    }
  };

  const getLabel = () => {
    switch (task.task_type) {
      case "group_cross_sell": return "Expansão";
      case "group_opportunity": return "Oportunidade";
      case "group_create": return "Fornecedor";
      default: return "Grupo";
    }
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{task.title}</h3>
                <Badge variant="outline" className={`text-[10px] ${getBadgeColor()}`}>{getLabel()}</Badge>
                {task.task_type !== "group_create" && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5">
                    <TrendingUp className="h-2.5 w-2.5" />
                    {profitPercent}% lucro
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{task.description}</p>
            </div>
          </div>

          {task.task_type !== "group_create" && task.metric_value && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {task.metric_value} produtos
              </span>
            </div>
          )}

          {task.task_type === "group_create" && task.metric_secondary && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              R$ {Math.round(task.metric_secondary).toLocaleString("pt-BR")} em estoque
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {task.task_type === "group_create" ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate("/partnerships?tab=groups&action=create")}
              >
                <Plus className="h-3.5 w-3.5" />
                Criar Meu Grupo
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => joinGroupMutation.mutate()}
                  disabled={joinGroupMutation.isPending}
                >
                  {joinGroupMutation.isPending ? (
                    <CheckCircle2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                  Solicitar Entrada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver Produtos
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {task.group_id && (
        <GroupProductPreviewDialog
          groupId={task.group_id}
          groupName={task.product_name || "Grupo"}
          profitShareSeller={(profitPercent) / 100}
          profitSharePartner={1 - (profitPercent) / 100}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </>
  );
}
