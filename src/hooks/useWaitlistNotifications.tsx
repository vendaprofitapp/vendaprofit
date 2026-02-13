import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface WaitlistNotification {
  id: string;
  product_id: string;
  waitlist_id: string;
  consignment_item_id: string;
  status: string;
  created_at: string;
  product_name?: string;
  customer_name?: string;
  customer_phone?: string;
}

export function useWaitlistNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["waitlist-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get pending waitlist notifications for products owned by the user
      const { data, error } = await supabase
        .from("waitlist_notifications")
        .select("*")
        .eq("status", "pending");

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Enrich with product and waitlist info
      const productIds = [...new Set(data.map(n => n.product_id))];
      const waitlistIds = [...new Set(data.map(n => n.waitlist_id))];

      const [{ data: products }, { data: waitlistEntries }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name")
          .in("id", productIds),
        supabase
          .from("product_waitlist")
          .select("id, customer_name, customer_phone")
          .in("id", waitlistIds),
      ]);

      const productMap = new Map(products?.map(p => [p.id, p.name]) || []);
      const waitlistMap = new Map(waitlistEntries?.map(w => [w.id, w]) || []);

      return data.map(n => ({
        ...n,
        product_name: productMap.get(n.product_id) || "Produto desconhecido",
        customer_name: waitlistMap.get(n.waitlist_id)?.customer_name || null,
        customer_phone: waitlistMap.get(n.waitlist_id)?.customer_phone || null,
      })) as WaitlistNotification[];
    },
    enabled: !!user?.id,
  });

  const dismissNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("waitlist_notifications")
        .update({ status: "dismissed" } as any)
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist-notifications"] });
    },
  });

  const markNotified = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("waitlist_notifications")
        .update({ status: "notified" } as any)
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist-notifications"] });
    },
  });

  // Group notifications by product
  const groupedByProduct = notifications.reduce((acc, n) => {
    if (!acc[n.product_id]) {
      acc[n.product_id] = {
        product_name: n.product_name || "",
        product_id: n.product_id,
        customers: [],
        notification_ids: [],
      };
    }
    acc[n.product_id].customers.push({
      name: n.customer_name || "Sem nome",
      phone: n.customer_phone || "",
    });
    acc[n.product_id].notification_ids.push(n.id);
    return acc;
  }, {} as Record<string, { product_name: string; product_id: string; customers: { name: string; phone: string }[]; notification_ids: string[] }>);

  return {
    notifications,
    groupedByProduct: Object.values(groupedByProduct),
    isLoading,
    dismissNotification,
    markNotified,
    pendingCount: notifications.length,
  };
}
