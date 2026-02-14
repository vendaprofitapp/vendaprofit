import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { QuickProductRenameDialog } from "./QuickProductRenameDialog";

interface MarketingTask {
  id: string;
  task_type: string;
  title: string;
  description: string;
  product_name: string | null;
  metric_value: number;
  is_completed: boolean;
}

export function SearchDemandCard({ task }: { task: MarketingTask }) {
  const [showRename, setShowRename] = useState(false);
  const queryClient = useQueryClient();

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
      toast.success("Tarefa concluída!");
    },
  });

  return (
    <>
      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-purple-500">
              <Search className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm">{task.title}</h3>
                <Badge variant="outline" className="text-[10px] shrink-0 border-purple-300 text-purple-600">
                  Demanda Reprimida
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>"{task.product_name}" — {task.metric_value} pesquisas</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowRename(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edição Rápida
            </Button>
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

      <QuickProductRenameDialog
        open={showRename}
        onOpenChange={setShowRename}
        searchTerm={task.product_name || ""}
      />
    </>
  );
}
