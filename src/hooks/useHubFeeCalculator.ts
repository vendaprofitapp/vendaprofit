/**
 * useHubFeeCalculator.ts
 *
 * Cascade (Fallback) fee resolution for VENDA PROFIT HUB:
 *   1. Product-level override (admin_hub_fee_type / admin_hub_fee_value)
 *   2. Supplier profile-level negotiated rate (hub_fee_type / hub_fee_value)
 *   3. Global default constant
 *
 * The fee is ALWAYS calculated over the supplier's cost price (hub_fixed_cost
 * or the commission amount, depending on the product's pricing mode).
 */

// ─── Global default (fallback of last resort) ─────────────────────────────────
export const HUB_DEFAULT_FEE_TYPE: "fixed" | "percentage" = "fixed";
export const HUB_DEFAULT_FEE_VALUE = 5.0; // R$ 5,00

export interface HubFeeContext {
  /** Cost price the supplier charges for the product */
  costPrice: number;

  // Product-level override (from products.admin_hub_fee_type / admin_hub_fee_value)
  productFeeType?: "fixed" | "percentage" | null;
  productFeeValue?: number | null;

  // Supplier-level negotiated rate (from profiles.hub_fee_type / hub_fee_value)
  supplierFeeType?: "fixed" | "percentage" | null;
  supplierFeeValue?: number | null;
}

export interface HubFeeResult {
  /** The platform fee amount in R$ */
  feeAmount: number;
  /** Which fee source was used */
  feeSource: "product" | "supplier" | "global_default";
  /** Human-readable description for display */
  feeLabel: string;
  /** Total cost to the reseller = costPrice + feeAmount */
  totalCost: number;
}

/**
 * Pure calculation — no hooks, no side effects.
 * Can be used in both React components and plain utility functions.
 */
export function calcHubFee(ctx: HubFeeContext): HubFeeResult {
  const { costPrice } = ctx;

  // ── 1st priority: product-level override ──────────────────────────────────
  if (ctx.productFeeType && ctx.productFeeValue != null && ctx.productFeeValue > 0) {
    const feeAmount =
      ctx.productFeeType === "percentage"
        ? (costPrice * ctx.productFeeValue) / 100
        : ctx.productFeeValue;
    return {
      feeAmount,
      feeSource: "product",
      feeLabel:
        ctx.productFeeType === "percentage"
          ? `${ctx.productFeeValue}% (taxa produto)`
          : `R$ ${ctx.productFeeValue.toFixed(2)} (taxa produto)`,
      totalCost: costPrice + feeAmount,
    };
  }

  // ── 2nd priority: supplier-level negotiated rate ───────────────────────────
  if (ctx.supplierFeeType && ctx.supplierFeeValue != null && ctx.supplierFeeValue > 0) {
    const feeAmount =
      ctx.supplierFeeType === "percentage"
        ? (costPrice * ctx.supplierFeeValue) / 100
        : ctx.supplierFeeValue;
    return {
      feeAmount,
      feeSource: "supplier",
      feeLabel:
        ctx.supplierFeeType === "percentage"
          ? `${ctx.supplierFeeValue}% (taxa fornecedor)`
          : `R$ ${ctx.supplierFeeValue.toFixed(2)} (taxa fornecedor)`,
      totalCost: costPrice + feeAmount,
    };
  }

  // ── 3rd priority: global default ──────────────────────────────────────────
  const feeAmount =
    HUB_DEFAULT_FEE_TYPE === "percentage"
      ? (costPrice * HUB_DEFAULT_FEE_VALUE) / 100
      : HUB_DEFAULT_FEE_VALUE;

  return {
    feeAmount,
    feeSource: "global_default",
    feeLabel:
      HUB_DEFAULT_FEE_TYPE === "percentage"
        ? `${HUB_DEFAULT_FEE_VALUE}% (taxa padrão)`
        : `R$ ${HUB_DEFAULT_FEE_VALUE.toFixed(2)} (taxa padrão)`,
    totalCost: costPrice + feeAmount,
  };
}

/**
 * React hook — wraps calcHubFee for convenience inside components.
 * All inputs are optional; the hook is safe to call with partial data.
 */
export function useHubFeeCalculator(ctx: HubFeeContext): HubFeeResult {
  return calcHubFee(ctx);
}
