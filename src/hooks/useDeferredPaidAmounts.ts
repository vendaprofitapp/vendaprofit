import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

/**
 * Fetches paid payment_reminders for a list of (pending) sale IDs.
 * Returns a Map<sale_id, paid_amount>.
 */
export function useDeferredPaidAmounts(saleIds: string[]) {
  const { data: reminders = [] } = useQuery({
    queryKey: ["deferred-paid-amounts", saleIds],
    queryFn: async () => {
      if (saleIds.length === 0) return [];
      const results: { sale_id: string; amount: number; is_paid: boolean }[] = [];
      for (let i = 0; i < saleIds.length; i += 500) {
        const chunk = saleIds.slice(i, i + 500);
        const { data, error } = await supabase
          .from("payment_reminders")
          .select("sale_id, amount, is_paid")
          .in("sale_id", chunk);
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: saleIds.length > 0,
  });

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reminders) {
      if (r.is_paid) {
        map.set(r.sale_id, (map.get(r.sale_id) || 0) + r.amount);
      }
    }
    return map;
  }, [reminders]);
}

/**
 * Returns the ratio of paid amount vs total for a sale.
 * Completed sales return 1. Pending sales return paidAmount/total.
 */
export function getSalePaidRatio(
  sale: { id: string; status: string; total: number },
  paidBySale: Map<string, number>
): number {
  if (sale.status === "completed") return 1;
  if (sale.total <= 0) return 0;
  const paid = paidBySale.get(sale.id) || 0;
  return Math.min(paid / sale.total, 1);
}
