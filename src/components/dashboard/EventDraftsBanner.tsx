import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function EventDraftsBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["event-drafts-pending-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("event_sale_drafts")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user?.id)
        .eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  if (pendingCount === 0) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Zap className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          Você tem <span className="font-bold text-primary">{pendingCount}</span>{" "}
          {pendingCount === 1 ? "rascunho de evento pendente" : "rascunhos de evento pendentes"}
        </p>
        <p className="text-xs text-muted-foreground">Concilie para transformar em vendas oficiais</p>
      </div>
      <Button size="sm" onClick={() => navigate("/evento/conciliacao")}>
        Conciliar
      </Button>
    </div>
  );
}
