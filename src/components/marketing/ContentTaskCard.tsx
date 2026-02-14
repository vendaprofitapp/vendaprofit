import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, TrendingUp, Package, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface MarketingTask {
  id: string;
  task_type: string;
  title: string;
  description: string;
  product_name: string | null;
  product_id: string | null;
  metric_value: number;
  metric_secondary: number;
  store_slug: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

const taskConfig: Record<string, { icon: typeof Eye; color: string; badge: string }> = {
  high_objection: { icon: Eye, color: "text-orange-500", badge: "Alta Objeção" },
  hidden_gold: { icon: TrendingUp, color: "text-emerald-500", badge: "Ouro Escondido" },
  capital_freeze: { icon: Package, color: "text-blue-500", badge: "Giro de Capital" },
};

export function ContentTaskCard({ task }: { task: MarketingTask }) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const config = taskConfig[task.task_type] || taskConfig.high_objection;
  const Icon = config.icon;

  const completeTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("marketing_tasks")
        .update({ is_completed: true, completed_at: new Date().toISOString() } as any)
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
      toast.success("Tarefa concluída! 🎉");
    },
  });

  const copyProductLink = () => {
    if (!task.store_slug || !task.product_id) return;
    const url = `${window.location.origin}/loja/${task.store_slug}?utm_source=instagram_task&product=${task.product_id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: config.color.includes("orange") ? "#f97316" : config.color.includes("emerald") ? "#10b981" : "#3b82f6" }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${config.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm">{task.title}</h3>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {config.badge}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
            
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {task.task_type === "high_objection" && (
                <span>{task.metric_value} visualizações</span>
              )}
              {task.task_type === "hidden_gold" && (
                <>
                  <span>{task.metric_value} conversões</span>
                  <span>{task.metric_secondary}% taxa</span>
                </>
              )}
              {task.task_type === "capital_freeze" && (
                <>
                  <span>{task.metric_value} unidades</span>
                  <span>R$ {task.metric_secondary?.toFixed(2)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {task.product_id && task.store_slug && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copyProductLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar Link"}
            </Button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Checkbox
              checked={task.is_completed}
              onCheckedChange={() => completeTask.mutate()}
              disabled={completeTask.isPending}
            />
            <span className="text-xs text-muted-foreground">Concluída</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
