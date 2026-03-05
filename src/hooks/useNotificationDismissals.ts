import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addDays, addHours } from "date-fns";

interface Dismissal {
  alert_key: string;
  dismissed_until: string | null;
}

export function useNotificationDismissals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: dismissals = [] } = useQuery({
    queryKey: ["notification-dismissals", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_notification_dismissals")
        .select("alert_key, dismissed_until")
        .eq("user_id", user!.id);
      if (error) throw error;
      return ((data ?? []) as unknown) as Dismissal[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const isDismissed = (alertKey: string): boolean => {
    const d = dismissals.find((d) => d.alert_key === alertKey);
    if (!d) return false;
    if (!d.dismissed_until) return true; // permanent
    return new Date(d.dismissed_until) > new Date();
  };

  const dismiss = useMutation({
    mutationFn: async ({
      alertKey,
      dismissedUntil,
    }: {
      alertKey: string;
      dismissedUntil?: Date | null;
    }) => {
      const { error } = await (supabase as any)
        .from("user_notification_dismissals")
        .upsert(
          {
            user_id: user!.id,
            alert_key: alertKey,
            dismissed_at: new Date().toISOString(),
            dismissed_until: dismissedUntil?.toISOString() ?? null,
          },
          { onConflict: "user_id,alert_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-dismissals"] });
    },
  });

  /** Helper: dismiss for 24 hours */
  const dismiss24h = (alertKey: string) =>
    dismiss.mutate({ alertKey, dismissedUntil: addHours(new Date(), 24) });

  /** Helper: dismiss for 7 days */
  const dismiss7d = (alertKey: string) =>
    dismiss.mutate({ alertKey, dismissedUntil: addDays(new Date(), 7) });

  /** Helper: dismiss permanently */
  const dismissPermanent = (alertKey: string) =>
    dismiss.mutate({ alertKey, dismissedUntil: null });

  return {
    isDismissed,
    dismiss,
    dismiss24h,
    dismiss7d,
    dismissPermanent,
  };
}
