import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConsortiumPaymentEntry {
  id: string;
  amount: number;
  paid_at: string;
  installment_number: number;
  participant_name: string;
  consortium_name: string;
  consortium_id: string;
}

export function useConsortiumPaymentsInPeriod(
  userId: string | undefined,
  dateRange: { start: Date; end: Date }
) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["consortium-payments-period", userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_payments")
        .select(`
          id, amount, paid_at, installment_number,
          consortium_participants!inner (
            customer_name,
            consortium_id,
            consortiums!inner ( name, owner_id )
          )
        `)
        .eq("is_paid", true)
        .gte("paid_at", dateRange.start.toISOString())
        .lte("paid_at", dateRange.end.toISOString());

      if (error) throw error;
      if (!data) return [];

      // Filter by owner and map
      return (data as any[])
        .filter((p) => p.consortium_participants?.consortiums?.owner_id === userId)
        .map((p): ConsortiumPaymentEntry => ({
          id: p.id,
          amount: p.amount,
          paid_at: p.paid_at,
          installment_number: p.installment_number,
          participant_name: p.consortium_participants.customer_name,
          consortium_name: p.consortium_participants.consortiums.name,
          consortium_id: p.consortium_participants.consortium_id,
        }));
    },
    enabled: !!userId,
  });

  const totalConsortiumRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  return { consortiumPayments: payments, totalConsortiumRevenue, isLoading };
}
