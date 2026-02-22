import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, TrendingUp, Building2, Wallet, Receipt } from "lucide-react";
import { calculateSaleSplits, SaleSplitResult, formatCurrency } from "@/utils/profitEngine";

interface CartItemWithCost {
  product: {
    id: string;
    name: string;
    price: number;
    cost_price?: number;
    owner_id: string;
    isB2B?: boolean;
    b2b_source_product_id?: string | null;
  };
  quantity: number;
  isPartnerStock: boolean;
  ownerName?: string;
}

// Partnership config for a specific product
interface ProductPartnershipInfo {
  groupId: string;
  isDirect: boolean;
  costSplitRatio: number;
  profitShareSeller: number;
  profitSharePartner: number;
  commissionPercent: number;
}

interface ProfitBreakdownCardProps {
  cart: CartItemWithCost[];
  currentUserId: string;
  groupCommissionPercent?: number;
  hasActivePartnership: boolean;
  /** Percentual de taxa do método de pagamento (ex: 10 para 10%) */
  paymentFeePercent?: number;
  /** Multiplicador para refletir desconto aplicado no total (ex: total/subtotal) */
  saleNetMultiplier?: number;
  /** Map of product ID to partnership info (for own products in partnerships) */
  productPartnerships?: Map<string, ProductPartnershipInfo>;
}

interface AggregatedSplits {
  sellerTotalReceive: number; // Cost recovery + profit share
  sellerProfitOnly: number; // Only profit share (real net profit)
  partnerTotalReceive: number; // Cost recovery + profit share
  partnerProfitOnly: number; // Only profit share
  ownerTotal: number;
  partnershipPaymentDue: number;
  paymentFeesTotal: number; // Total de taxas do pagamento (cartão etc.)
  scenarios: Set<SaleSplitResult["scenario"]>;
  details: Array<{
    productName: string;
    scenario: SaleSplitResult["scenario"];
    scenarioDescription: string;
    sellerTotalReceive: number;
    sellerProfitOnly: number;
    partnerTotalReceive: number;
    partnerProfitOnly: number;
    owner: number;
    partnershipPaymentDue: number;
    ownerName?: string;
    costPrice: number;
    salePrice: number;
    feeAmount: number;
    salePriceGross: number;
    isB2B?: boolean;
  }>;
}

export function ProfitBreakdownCard({
  cart,
  currentUserId,
  groupCommissionPercent = 0.20,
  hasActivePartnership,
  paymentFeePercent = 0,
  saleNetMultiplier = 1,
  productPartnerships,
}: ProfitBreakdownCardProps) {
  const aggregatedSplits = useMemo<AggregatedSplits>(() => {
    const result: AggregatedSplits = {
      sellerTotalReceive: 0,
      sellerProfitOnly: 0,
      partnerTotalReceive: 0,
      partnerProfitOnly: 0,
      ownerTotal: 0,
      partnershipPaymentDue: 0,
      paymentFeesTotal: 0,
      scenarios: new Set(),
      details: [],
    };

    cart.forEach((item) => {
      const salePriceGross = item.product.price * item.quantity;
      // Apply discount multiplier first
      const salePriceAfterDiscount = salePriceGross * saleNetMultiplier;

      // Use cost_price if available, otherwise estimate as 50% of sale price
      const costPrice = (item.product.cost_price ?? item.product.price * 0.5) * item.quantity;
      const sellerIsOwner = item.product.owner_id === currentUserId;
      
      // Check if product is in a partnership (from passed map)
      const partnershipInfo = productPartnerships?.get(item.product.id);
      const isInPartnership = !!partnershipInfo;
      
      // Product is partnership stock if it came from partner OR if it's in our partnerships
      const isPartnershipStock = item.isPartnerStock || isInPartnership;

      // Pass payment fee to profitEngine - it will calculate net revenue internally
      const splitResult = calculateSaleSplits({
        salePrice: salePriceAfterDiscount,
        costPrice,
        groupCommissionPercent: partnershipInfo?.commissionPercent ?? groupCommissionPercent,
        isPartnershipStock,
        sellerIsOwner,
        hasActivePartnership: isInPartnership || hasActivePartnership,
        isDirectPartnership: partnershipInfo?.isDirect ?? false,
        paymentMethodFee: paymentFeePercent,
        partnership: partnershipInfo ? {
          cost_split_ratio: partnershipInfo.costSplitRatio,
          profit_share_seller: partnershipInfo.profitShareSeller,
          profit_share_partner: partnershipInfo.profitSharePartner,
          is_direct: partnershipInfo.isDirect,
        } : null,
        group: partnershipInfo ? {
          commission_percent: partnershipInfo.commissionPercent,
          is_direct: partnershipInfo.isDirect,
        } : null,
      });
      
      const feeAmount = splitResult.paymentFeeAmount;

      result.sellerTotalReceive += splitResult.seller.total;
      result.sellerProfitOnly += splitResult.seller.profitShare;
      result.partnerTotalReceive += splitResult.partner.total;
      result.partnerProfitOnly += splitResult.partner.profitShare;
      result.ownerTotal += splitResult.owner.total;
      result.partnershipPaymentDue += splitResult.partnershipPaymentDue || 0;
      result.paymentFeesTotal += feeAmount;
      result.scenarios.add(splitResult.scenario);

      result.details.push({
        productName: item.product.name,
        scenario: splitResult.scenario,
        scenarioDescription: splitResult.scenarioDescription,
        sellerTotalReceive: splitResult.seller.total,
        sellerProfitOnly: splitResult.seller.profitShare,
        partnerTotalReceive: splitResult.partner.total,
        partnerProfitOnly: splitResult.partner.profitShare,
        owner: splitResult.owner.total,
        partnershipPaymentDue: splitResult.partnershipPaymentDue || 0,
        ownerName: item.ownerName,
        costPrice,
        salePrice: splitResult.netRevenue,
        feeAmount,
        salePriceGross,
        isB2B: !!(item.product.isB2B || item.product.b2b_source_product_id),
      });
    });

    return result;
  }, [cart, currentUserId, groupCommissionPercent, hasActivePartnership, paymentFeePercent, saleNetMultiplier, productPartnerships]);

  // Don't show if cart is empty
  if (cart.length === 0) {
    return null;
  }

  // Show if there are partnership items, active partnerships, OR payment fees
  // Also show if any product in cart is in a partnership
  const hasPartnershipItems = cart.some(item => 
    item.isPartnerStock || 
    item.product.owner_id !== currentUserId || 
    productPartnerships?.has(item.product.id)
  );
  const hasPaymentFee = paymentFeePercent > 0;
  const shouldShow = hasPartnershipItems || hasActivePartnership || hasPaymentFee;

  if (!shouldShow && aggregatedSplits.scenarios.has('OWN_STOCK') && aggregatedSplits.scenarios.size === 1) {
    return null; // Don't show for pure own stock sales without partnerships and no fees
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Divisão de Lucros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Summary Badges */}
        <div className="flex flex-wrap gap-2">
          {/* Seller's net profit - Green (only profit, no cost recovery) */}
          <Badge
            variant="outline"
            className="bg-green-500/10 text-green-700 border-green-500/30 px-3 py-1.5 text-sm font-medium"
          >
            <Wallet className="h-3.5 w-3.5 mr-1.5" />
            Lucro Líquido Real: {formatCurrency(aggregatedSplits.sellerProfitOnly)}
          </Badge>

          {/* Seller's total to receive (cost + profit) - Emerald */}
          {aggregatedSplits.sellerTotalReceive !== aggregatedSplits.sellerProfitOnly && (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 px-3 py-1.5 text-sm font-medium"
            >
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              Total a Receber: {formatCurrency(aggregatedSplits.sellerTotalReceive)}
            </Badge>
          )}

          {/* Payment fee badge (card etc.) */}
          {aggregatedSplits.paymentFeesTotal > 0 && (
            <Badge
              variant="outline"
              className="bg-destructive/10 text-destructive border-destructive/30 px-3 py-1.5 text-sm font-medium"
            >
              Taxa ({paymentFeePercent}%): -{formatCurrency(aggregatedSplits.paymentFeesTotal)}
            </Badge>
          )}

          {/* Partner's share - Blue */}
          {aggregatedSplits.partnerTotalReceive > 0 && (
            <Badge
              variant="outline"
              className="bg-blue-500/10 text-blue-700 border-blue-500/30 px-3 py-1.5 text-sm font-medium"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Sócia Recebe: {formatCurrency(aggregatedSplits.partnerTotalReceive)}
            </Badge>
          )}

          {/* Partner's net profit if different */}
          {aggregatedSplits.partnerProfitOnly > 0 &&
            aggregatedSplits.partnerProfitOnly !== aggregatedSplits.partnerTotalReceive && (
              <Badge
                variant="outline"
                className="bg-sky-500/10 text-sky-700 border-sky-500/30 px-3 py-1.5 text-xs"
              >
                Lucro Sócia: {formatCurrency(aggregatedSplits.partnerProfitOnly)}
              </Badge>
            )}

          {/* Owner/Group commission - Orange */}
          {aggregatedSplits.ownerTotal > 0 && (
            <Badge
              variant="outline"
              className="bg-orange-500/10 text-orange-700 border-orange-500/30 px-3 py-1.5 text-sm font-medium"
            >
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Pago ao Grupo: {formatCurrency(aggregatedSplits.ownerTotal)}
            </Badge>
          )}
        </div>

        {/* Third-party partnership payment notice */}
        {aggregatedSplits.partnershipPaymentDue > 0 && (
          <>
            <Separator className="my-2" />
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Pagamento Devido à Parceria
              </p>
              <p className="text-lg font-bold text-amber-800">
                {formatCurrency(aggregatedSplits.partnershipPaymentDue)}
              </p>
              {aggregatedSplits.details.filter(d => d.scenario === 'C').map((detail, idx) => (
                <p key={idx} className="text-xs text-amber-600 mt-1">
                  Esta peça pertence à Parceria{detail.ownerName ? ` (${detail.ownerName})` : ''}
                </p>
              ))}
            </div>
          </>
        )}

        {/* Detailed breakdown per product (if multiple items) */}
        {aggregatedSplits.details.length > 1 && (
          <>
            <Separator className="my-2" />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Detalhes por produto:</p>
              {aggregatedSplits.details.map((detail, idx) => (
                <div key={idx} className="text-xs bg-background/50 rounded p-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate max-w-[180px]">{detail.productName}</span>
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] px-1.5 ${detail.isB2B && detail.scenario === 'OWN_STOCK' ? 'bg-amber-500/15 text-amber-700 border-amber-500/30' : ''}`}
                    >
                      {detail.isB2B && detail.scenario === 'OWN_STOCK' ? 'Sob Encomenda' : getScenarioShortLabel(detail.scenario)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Venda: {formatCurrency(detail.salePriceGross)}
                    {detail.feeAmount > 0 && (
                      <span className="text-destructive"> | Taxa: -{formatCurrency(detail.feeAmount)}</span>
                    )}
                    {' '}| Custo: {formatCurrency(detail.costPrice)}
                  </p>
                  <div className="flex gap-2 text-muted-foreground flex-wrap">
                    <span className="text-green-600">
                      Seu Lucro: {formatCurrency(detail.sellerProfitOnly)}
                    </span>
                    {detail.sellerTotalReceive !== detail.sellerProfitOnly && (
                      <span className="text-emerald-600">
                        (Total: {formatCurrency(detail.sellerTotalReceive)})
                      </span>
                    )}
                    {detail.partnerTotalReceive > 0 && (
                      <span className="text-blue-600">
                        Sócia: {formatCurrency(detail.partnerTotalReceive)}
                      </span>
                    )}
                    {detail.owner > 0 && (
                      <span className="text-orange-600">Grupo: {formatCurrency(detail.owner)}</span>
                    )}
                    {detail.partnershipPaymentDue > 0 && (
                      <span className="text-amber-600">Parceria: {formatCurrency(detail.partnershipPaymentDue)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Single item explanation with cost breakdown */}
        {aggregatedSplits.details.length === 1 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              Venda Bruta: {formatCurrency(aggregatedSplits.details[0].salePriceGross)}
              {aggregatedSplits.details[0].feeAmount > 0 && (
                <span className="text-destructive"> | Taxa Finan.: -{formatCurrency(aggregatedSplits.details[0].feeAmount)}</span>
              )}
            </p>
            <p>
              Venda Líquida: {formatCurrency(aggregatedSplits.details[0].salePrice)} | 
              Custo: {formatCurrency(aggregatedSplits.details[0].costPrice)} | 
              Lucro Bruto: {formatCurrency(aggregatedSplits.details[0].salePrice - aggregatedSplits.details[0].costPrice)}
            </p>
            {aggregatedSplits.details[0].scenario !== 'OWN_STOCK' && (
              <p className="italic">{aggregatedSplits.details[0].scenarioDescription}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getScenarioShortLabel(scenario: SaleSplitResult['scenario']): string {
  const labels: Record<SaleSplitResult['scenario'], string> = {
    'A': 'Parceria',
    'B': 'Grupo',
    'C': 'Terceiro',
    'OWN_STOCK': 'Próprio',
  };
  return labels[scenario];
}
