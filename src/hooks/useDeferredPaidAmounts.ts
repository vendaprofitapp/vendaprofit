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

// Legacy compatibility
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

interface PaidReminderInPeriod {
  sale_id: string;
  amount: number;
  paid_at: string;
}

interface DeferredSaleInPeriod {
  saleId: string;
  /** Revenue recognized in THIS period (sum of reminders paid in range) */
  revenueInPeriod: number;
  /** Cost ratio for this period: reminders paid in period / total reminders */
  costRatioInPeriod: number;
  /** Total installments for the sale */
  totalInstallments: number;
  /** Installments paid in this period */
  paidInPeriod: number;
}

/**
 * Fetches deferred sales revenue recognized in a specific period.
 * Returns sale IDs with their recognized revenue and cost ratios for the period.
 * 
 * Logic:
 * - Fetches payment_reminders where is_paid=true and paid_at is within dateRange
 * - Groups by sale_id to calculate recognized revenue in this period
 * - Also fetches ALL reminders for those sales to know total installment count
 */
export function useDeferredRevenueInPeriod(
  userId: string | undefined,
  dateRange: { start: Date; end: Date }
) {
  // 1. Fetch reminders paid in this period
  const { data: paidInPeriod = [] } = useQuery({
    queryKey: ["deferred-revenue-period", userId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_reminders")
        .select("sale_id, amount, paid_at")
        .eq("owner_id", userId!)
        .eq("is_paid", true)
        .gte("paid_at", dateRange.start.toISOString())
        .lte("paid_at", dateRange.end.toISOString());
      if (error) throw error;
      return (data || []) as PaidReminderInPeriod[];
    },
    enabled: !!userId,
  });

  // Get unique sale IDs from paid reminders
  const deferredSaleIds = useMemo(() => {
    return [...new Set(paidInPeriod.map(r => r.sale_id))];
  }, [paidInPeriod]);

  // 2. Fetch ALL reminders for those sales (to know total installment count)
  const { data: allRemindersForSales = [] } = useQuery({
    queryKey: ["deferred-all-reminders", deferredSaleIds],
    queryFn: async () => {
      if (deferredSaleIds.length === 0) return [];
      const results: { sale_id: string; amount: number; is_paid: boolean }[] = [];
      for (let i = 0; i < deferredSaleIds.length; i += 500) {
        const chunk = deferredSaleIds.slice(i, i + 500);
        const { data, error } = await supabase
          .from("payment_reminders")
          .select("sale_id, amount, is_paid")
          .in("sale_id", chunk);
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: deferredSaleIds.length > 0,
  });

  // 3. Build map: sale_id -> { revenueInPeriod, costRatioInPeriod }
  const deferredSalesMap = useMemo(() => {
    const map = new Map<string, DeferredSaleInPeriod>();

    // Count total installments per sale
    const totalCountBySale = new Map<string, number>();
    for (const r of allRemindersForSales) {
      totalCountBySale.set(r.sale_id, (totalCountBySale.get(r.sale_id) || 0) + 1);
    }

    // Sum paid in period per sale
    for (const r of paidInPeriod) {
      const existing = map.get(r.sale_id) || {
        saleId: r.sale_id,
        revenueInPeriod: 0,
        costRatioInPeriod: 0,
        totalInstallments: totalCountBySale.get(r.sale_id) || 1,
        paidInPeriod: 0,
      };
      existing.revenueInPeriod += r.amount;
      existing.paidInPeriod++;
      existing.costRatioInPeriod = existing.paidInPeriod / existing.totalInstallments;
      map.set(r.sale_id, existing);
    }

    return map;
  }, [paidInPeriod, allRemindersForSales]);

  return { deferredSaleIds, deferredSalesMap };
}
