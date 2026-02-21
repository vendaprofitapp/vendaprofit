import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subDays } from "date-fns";

export interface NotificationSection {
  key: string;
  label: string;
  count: number;
  icon: string;
  route: string;
  color: string;
  description: string;
}

export interface NotificationsData {
  totalCount: number;
  sections: NotificationSection[];
  isLoading: boolean;
}

export function useNotifications(): NotificationsData {
  const { user } = useAuth();

  const sevenDaysAgo = subDays(new Date(), 7).toISOString();
  const oneDayAgo = subDays(new Date(), 1).toISOString();

  // Modo Evento — rascunhos pendentes
  const { data: eventDrafts = [], isLoading: loadingEvent } = useQuery({
    queryKey: ["notifications-event-drafts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sale_drafts")
        .select("id")
        .eq("owner_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Bolsa Consignada — clientes finalizaram escolhas
  const { data: consignmentsReady = [], isLoading: loadingConsignment } = useQuery({
    queryKey: ["notifications-consignments-ready", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consignments")
        .select("id, customers(name, phone)")
        .eq("seller_id", user!.id)
        .eq("status", "finalized_by_client");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Bazar VIP — novos itens para curadoria
  const { data: bazarPending = [], isLoading: loadingBazarPending } = useQuery({
    queryKey: ["notifications-bazar-pending", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazar_items")
        .select("id")
        .eq("owner_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Bazar VIP — vendas realizadas (últimos 7 dias)
  const { data: bazarSold = [], isLoading: loadingBazarSold } = useQuery({
    queryKey: ["notifications-bazar-sold", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazar_items")
        .select("id")
        .eq("owner_id", user!.id)
        .eq("status", "sold")
        .gte("sold_at", sevenDaysAgo);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Pontos Parceiros — movimentações recentes (24h)
  const { data: partnerMovements = [], isLoading: loadingPartner } = useQuery({
    queryKey: ["notifications-partner-movements", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_point_items")
        .select("id")
        .eq("owner_id", user!.id)
        .in("status", ["returned", "sold"])
        .gte("updated_at", oneDayAgo);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Catálogo — novos leads (últimas 24h)
  const { data: newLeads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["notifications-new-leads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_leads")
        .select("id")
        .eq("owner_id", user!.id)
        .gte("created_at", oneDayAgo);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Catálogo — carrinhos abandonados (últimos 7 dias)
  const { data: abandonedCarts = [], isLoading: loadingCarts } = useQuery({
    queryKey: ["notifications-abandoned-carts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_cart_items")
        .select("id, lead_id")
        .eq("status", "abandoned")
        .gte("created_at", sevenDaysAgo);
      if (error) throw error;
      // Deduplicate by lead_id to count unique carts
      const uniqueLeads = new Set((data || []).map((d: { lead_id: string }) => d.lead_id));
      return Array.from(uniqueLeads);
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Catálogo — pedidos recebidos aguardando (últimos 7 dias)
  const { data: catalogOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["notifications-catalog-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_carts")
        .select("id")
        .eq("owner_id", user!.id)
        .eq("status", "waiting")
        .gte("created_at", sevenDaysAgo);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const isLoading = loadingEvent || loadingConsignment || loadingBazarPending || loadingBazarSold || loadingPartner || loadingLeads || loadingCarts || loadingOrders;

  const sections: NotificationSection[] = [];

  if (catalogOrders.length > 0) {
    sections.push({
      key: "catalog-orders",
      label: "Pedidos da Loja",
      count: catalogOrders.length,
      icon: "🛍️",
      route: "/catalog-orders",
      color: "#10b981",
      description: `${catalogOrders.length} pedido${catalogOrders.length > 1 ? "s" : ""} aguardando atendimento`,
    });
  }

  if (eventDrafts.length > 0) {
    sections.push({
      key: "event",
      label: "Modo Evento",
      count: eventDrafts.length,
      icon: "⚡",
      route: "/evento/conciliacao",
      color: "hsl(var(--primary))",
      description: `${eventDrafts.length} rascunho${eventDrafts.length > 1 ? "s" : ""} pendente${eventDrafts.length > 1 ? "s" : ""} de conciliar`,
    });
  }

  if (consignmentsReady.length > 0) {
    sections.push({
      key: "consignment",
      label: "Bolsa Consignada",
      count: consignmentsReady.length,
      icon: "👜",
      route: "/consignments",
      color: "#a855f7",
      description: `${consignmentsReady.length} cliente${consignmentsReady.length > 1 ? "s" : ""} finalizou as escolhas`,
    });
  }

  if (bazarPending.length > 0) {
    sections.push({
      key: "bazar-pending",
      label: "Bazar VIP — Curadoria",
      count: bazarPending.length,
      icon: "🛍️",
      route: "/admin/bazar",
      color: "#6366f1",
      description: `${bazarPending.length} item${bazarPending.length > 1 ? "ns" : ""} aguardando aprovação`,
    });
  }

  if (bazarSold.length > 0) {
    sections.push({
      key: "bazar-sold",
      label: "Bazar VIP — Vendas",
      count: bazarSold.length,
      icon: "🎉",
      route: "/admin/bazar",
      color: "#22c55e",
      description: `${bazarSold.length} venda${bazarSold.length > 1 ? "s" : ""} no Bazar nos últimos 7 dias`,
    });
  }

  if (partnerMovements.length > 0) {
    sections.push({
      key: "partner",
      label: "Pontos Parceiros",
      count: partnerMovements.length,
      icon: "📍",
      route: "/partner-points",
      color: "#3b82f6",
      description: `${partnerMovements.length} movimentação${partnerMovements.length > 1 ? "ões" : ""} recente${partnerMovements.length > 1 ? "s" : ""}`,
    });
  }

  if (newLeads.length > 0) {
    sections.push({
      key: "new-leads",
      label: "Novos Leads",
      count: newLeads.length,
      icon: "🧲",
      route: "/catalog-orders",
      color: "#f59e0b",
      description: `${newLeads.length} novo${newLeads.length > 1 ? "s" : ""} lead${newLeads.length > 1 ? "s" : ""} nas últimas 24h`,
    });
  }

  if (abandonedCarts.length > 0) {
    sections.push({
      key: "abandoned-carts",
      label: "Carrinhos Abandonados",
      count: abandonedCarts.length,
      icon: "🛒",
      route: "/catalog-orders",
      color: "#ef4444",
      description: `${abandonedCarts.length} carrinho${abandonedCarts.length > 1 ? "s" : ""} abandonado${abandonedCarts.length > 1 ? "s" : ""} nos últimos 7 dias`,
    });
  }

  const totalCount = sections.reduce((sum, s) => sum + s.count, 0);

  return { totalCount, sections, isLoading };
}
