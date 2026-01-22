import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CustomerOrder {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  customer_name: string;
  product_id: string | null;
  product_name: string;
  supplier_name: string;
  quantity: number;
  notes: string | null;
  status: "pending" | "ordered" | "arrived" | "delivered" | "cancelled";
  profiles?: {
    full_name: string;
  };
}

export interface OrderFormData {
  customer_name: string;
  product_id: string | null;
  product_name: string;
  supplier_name: string;
  quantity: number;
  notes?: string;
}

export function useOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all orders (own + partner's via RLS)
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch profile names for partner orders
      const userIds = [...new Set(data.map(o => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      
      return data.map(order => ({
        ...order,
        status: order.status as CustomerOrder["status"],
        profiles: { full_name: profileMap.get(order.user_id) || "" }
      })) as CustomerOrder[];
    },
    enabled: !!user,
  });

  // Create order mutation
  const createOrder = useMutation({
    mutationFn: async (formData: OrderFormData) => {
      const { error } = await supabase.from("customer_orders").insert({
        user_id: user?.id,
        customer_name: formData.customer_name,
        product_id: formData.product_id,
        product_name: formData.product_name,
        supplier_name: formData.supplier_name,
        quantity: formData.quantity,
        notes: formData.notes || null,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      toast.success("Encomenda criada com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating order:", error);
      toast.error("Erro ao criar encomenda");
    },
  });

  // Update order status mutation
  const updateOrderStatus = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: CustomerOrder["status"];
    }) => {
      const { error } = await supabase
        .from("customer_orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      console.error("Error updating order:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  // Delete order mutation
  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("customer_orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      toast.success("Encomenda removida!");
    },
    onError: (error) => {
      console.error("Error deleting order:", error);
      toast.error("Erro ao remover encomenda");
    },
  });

  // Get pending orders
  const pendingOrders = orders.filter((o) => o.status === "pending");

  // Group orders by supplier for shopping list
  const ordersBySupplier = pendingOrders.reduce(
    (acc, order) => {
      const supplier = order.supplier_name;
      if (!acc[supplier]) {
        acc[supplier] = [];
      }
      acc[supplier].push(order);
      return acc;
    },
    {} as Record<string, CustomerOrder[]>
  );

  return {
    orders,
    pendingOrders,
    ordersBySupplier,
    ordersLoading,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    currentUserId: user?.id,
  };
}
