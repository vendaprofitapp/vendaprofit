import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface DeferredSaleInfo {
  paidAmount: number;
  paidCount: number;
  totalCount: number;
}

/**
 * Fetches payment_reminders for a list of (pending) sale IDs.
 * Returns a Map<sale_id, DeferredSaleInfo> with paid amount, paid count, and total installment count.
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
    const map = new Map<string, DeferredSaleInfo>();
    for (const r of reminders) {
      const existing = map.get(r.sale_id) || { paidAmount: 0, paidCount: 0, totalCount: 0 };
      existing.totalCount++;
      if (r.is_paid) {
        existing.paidAmount += r.amount;
        existing.paidCount++;
      }
      map.set(r.sale_id, existing);
    }
    return map;
  }, [reminders]);
}

/**
 * Returns the revenue amount to recognize for a sale.
 * Completed sales return full total. Pending sales return only paid installment amounts.
 */
export function getDeferredRevenueAmount(
  sale: { id: string; status: string; total: number },
  deferredInfo: Map<string, DeferredSaleInfo>
): number {
  if (sale.status === "completed") return sale.total;
  const info = deferredInfo.get(sale.id);
  if (!info) return 0;
  return info.paidAmount;
}

/**
 * Returns the cost ratio to apply for a pending sale.
 * Cost = total_cost * (paid_installments / total_installments).
 * Completed sales return 1.
 */
export function getDeferredCostRatio(
  sale: { id: string; status: string },
  deferredInfo: Map<string, DeferredSaleInfo>
): number {
  if (sale.status === "completed") return 1;
  const info = deferredInfo.get(sale.id);
  if (!info || info.totalCount === 0) return 0;
  return info.paidCount / info.totalCount;
}

// Legacy compatibility — keep old name working
export function getSalePaidRatio(
  sale: { id: string; status: string; total: number },
  paidBySale: Map<string, DeferredSaleInfo>
): number {
  if (sale.status === "completed") return 1;
  if (sale.total <= 0) return 0;
  const info = paidBySale.get(sale.id);
  if (!info) return 0;
  return Math.min(info.paidAmount / sale.total, 1);
}
