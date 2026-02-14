import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  task: {
    id: string;
    title: string;
    description: string;
    product_name: string | null;
    metric_value: number | null; // daily_budget saved
  };
}

export function AdStockPausedCard({ task }: Props) {
  const queryClient = useQueryClient();

  const dismissTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("marketing_tasks")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-tasks"] });
      toast.success("Alerta marcado como visto");
    },
  });

  const savedAmount = task.metric_value || 0;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm">{task.title}</h3>
              <Badge className="bg-green-600 text-white text-[10px]">Always Profit</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{task.description}</p>
            {savedAmount > 0 && (
              <p className="text-sm font-medium text-green-600 mt-1">
                💰 R$ {savedAmount}/dia economizado
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => dismissTask.mutate()}
          disabled={dismissTask.isPending}
        >
          <CheckCircle2 className="h-4 w-4" />
          Entendido
        </Button>
      </CardContent>
    </Card>
  );
}
