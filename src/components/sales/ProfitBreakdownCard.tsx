import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, TrendingUp, Building2, Wallet, Receipt, MapPin } from "lucide-react";
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

interface ProfileInfo {
  id: string;
  full_name: string;
  email?: string;
}

interface ProfitBreakdownCardProps {
  cart: CartItemWithCost[];
  currentUserId: string;
  currentUserName?: string;
  groupCommissionPercent?: number;
  hasActivePartnership: boolean;
  /** Percentual de taxa do método de pagamento (ex: 10 para 10%) */
  paymentFeePercent?: number;
  /** Multiplicador para refletir desconto aplicado no total (ex: total/subtotal) */
  saleNetMultiplier?: number;
  /** Map of product ID to partnership info (for own products in partnerships) */
  productPartnerships?: Map<string, ProductPartnershipInfo>;
  /** Profiles for name resolution */
  profiles?: ProfileInfo[];
  /** Partner point commission info */
  partnerPointCommission?: {
    pointName: string;
    commissionPercent: number;
  } | null;
  /** Frete pago pela vendedora (total) */
  sellerShippingCost?: number;
  /** Subtotal after discount for proportional shipping calc */
  totalAfterDiscount?: number;
}

interface DetailItem {
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
  ownerId?: string;
  costPrice: number;
  salePrice: number;
  feeAmount: number;
  salePriceGross: number;
  isB2B?: boolean;
  appliedConfig?: SaleSplitResult["appliedConfig"];
}

interface AggregatedSplits {
  sellerTotalReceive: number;
  sellerProfitOnly: number;
  partnerTotalReceive: number;
  partnerProfitOnly: number;
  ownerTotal: number;
  partnershipPaymentDue: number;
  paymentFeesTotal: number;
  totalCost: number;
  totalGross: number;
  scenarios: Set<SaleSplitResult["scenario"]>;
  details: DetailItem[];
}

export function ProfitBreakdownCard({
  cart,
  currentUserId,
  currentUserName,
  groupCommissionPercent = 0.20,
  hasActivePartnership,
  paymentFeePercent = 0,
  saleNetMultiplier = 1,
  productPartnerships,
  profiles = [],
  partnerPointCommission = null,
  sellerShippingCost = 0,
  totalAfterDiscount = 0,
}: ProfitBreakdownCardProps) {

  const getProfileName = (userId: string): string => {
    if (userId === currentUserId) return currentUserName || profiles.find(p => p.id === userId)?.full_name || "Você";
    return profiles.find(p => p.id === userId)?.full_name || "Parceira";
  };

  const aggregatedSplits = useMemo<AggregatedSplits>(() => {
    const result: AggregatedSplits = {
      sellerTotalReceive: 0,
      sellerProfitOnly: 0,
      partnerTotalReceive: 0,
      partnerProfitOnly: 0,
      ownerTotal: 0,
      partnershipPaymentDue: 0,
      paymentFeesTotal: 0,
      totalCost: 0,
      totalGross: 0,
      scenarios: new Set(),
      details: [],
    };

    cart.forEach((item) => {
      const salePriceGross = item.product.price * item.quantity;
      const salePriceAfterDiscount = salePriceGross * saleNetMultiplier;
      const costPrice = (item.product.cost_price ?? 0) * item.quantity;
      const sellerIsOwner = item.product.owner_id === currentUserId;
      const partnershipInfo = productPartnerships?.get(item.product.id);
      const isInPartnership = !!partnershipInfo;
      const isPartnershipStock = item.isPartnerStock || isInPartnership;

      // Proportional shipping cost for this item
      const itemShippingCost = sellerShippingCost > 0 && totalAfterDiscount > 0
        ? sellerShippingCost * (salePriceAfterDiscount / totalAfterDiscount)
        : 0;

      const splitResult = calculateSaleSplits({
        salePrice: salePriceAfterDiscount,
        costPrice,
        groupCommissionPercent: partnershipInfo?.commissionPercent ?? groupCommissionPercent,
        isPartnershipStock,
        sellerIsOwner,
        hasActivePartnership: isInPartnership || hasActivePartnership,
        isDirectPartnership: partnershipInfo?.isDirect ?? false,
        paymentMethodFee: paymentFeePercent,
        sellerShippingCost: itemShippingCost,
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
      result.totalCost += costPrice;
      result.totalGross += salePriceGross;
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
        ownerId: item.product.owner_id,
        costPrice,
        salePrice: splitResult.netRevenue,
        feeAmount,
        salePriceGross,
        isB2B: !!(item.product.isB2B || item.product.b2b_source_product_id),
        appliedConfig: splitResult.appliedConfig,
      });
    });

    return result;
  }, [cart, currentUserId, groupCommissionPercent, hasActivePartnership, paymentFeePercent, saleNetMultiplier, productPartnerships, sellerShippingCost, totalAfterDiscount]);

  // Group details by owner for multi-stock display (must be before early returns)
  const groupedByOwner = useMemo(() => {
    const groups = new Map<string, DetailItem[]>();
    aggregatedSplits.details.forEach(d => {
      const key = d.ownerId || currentUserId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    });
    return groups;
  }, [aggregatedSplits.details, currentUserId]);

  if (cart.length === 0) return null;

  const hasPartnershipItems = cart.some(item =>
    item.isPartnerStock ||
    item.product.owner_id !== currentUserId ||
    productPartnerships?.has(item.product.id)
  );
  const hasPaymentFee = paymentFeePercent > 0;
  const hasPartnerPointComm = !!partnerPointCommission && partnerPointCommission.commissionPercent > 0;
  const shouldShow = hasPartnershipItems || hasActivePartnership || hasPaymentFee || hasPartnerPointComm;

  if (!shouldShow && aggregatedSplits.scenarios.has('OWN_STOCK') && aggregatedSplits.scenarios.size === 1) {
    return null;
  }

  // Calculate partner point commission amount
  const ppCommissionAmount = hasPartnerPointComm
    ? ((aggregatedSplits.totalGross * saleNetMultiplier - aggregatedSplits.paymentFeesTotal) * partnerPointCommission!.commissionPercent / 100)
    : 0;

  // Calculate total net profit (gross - cost - fees - shipping - partner point commission)
  const totalNetProfit = aggregatedSplits.totalGross * saleNetMultiplier - aggregatedSplits.totalCost - aggregatedSplits.paymentFeesTotal - sellerShippingCost - ppCommissionAmount;

  // Build cost+fees label
  const costFeesLabels: string[] = [];
  if (aggregatedSplits.totalCost > 0) costFeesLabels.push(`Custo ${formatCurrency(aggregatedSplits.totalCost)}`);
  if (aggregatedSplits.paymentFeesTotal > 0) costFeesLabels.push(`Taxas ${formatCurrency(aggregatedSplits.paymentFeesTotal)}`);
  if (sellerShippingCost > 0) costFeesLabels.push(`Frete ${formatCurrency(sellerShippingCost)}`);
  if (ppCommissionAmount > 0) costFeesLabels.push(`Comissão ${formatCurrency(ppCommissionAmount)}`);
  const costFeesLabel = costFeesLabels.length > 0 ? costFeesLabels.join(' + ') : `Custo ${formatCurrency(0)}`;

  // Find partner user id from partnership items for naming
  const getPartnerUserId = (): string | null => {
    for (const detail of aggregatedSplits.details) {
      if (detail.scenario === 'A' && detail.ownerId && detail.ownerId !== currentUserId) {
        return detail.ownerId;
      }
    }
    for (const item of cart) {
      if (item.isPartnerStock && item.product.owner_id !== currentUserId) {
        return item.product.owner_id;
      }
    }
    return null;
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Divisão de Lucros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main: Lucro Líquido (Custo + Taxas) = R$ XX */}
        <Badge
          variant="outline"
          className="bg-sky-500/10 text-sky-700 border-sky-500/30 px-3 py-1.5 text-sm font-medium w-full justify-center"
        >
          <Wallet className="h-3.5 w-3.5 mr-1.5" />
          Lucro Líquido ({costFeesLabel}) = {formatCurrency(Math.max(0, totalNetProfit))}
        </Badge>

        {/* Per-person splits */}
        <div className="flex flex-col gap-2">
          {/* Scenario A: Sociedade 1-1 splits */}
          {aggregatedSplits.scenarios.has('A') && (() => {
            const sellerName = getProfileName(currentUserId);
            const partnerUserId = getPartnerUserId();
            const partnerName = partnerUserId ? getProfileName(partnerUserId) : 
              (aggregatedSplits.details.find(d => d.ownerName)?.ownerName || "Parceira");
            
            // Get config from first scenario A detail
            const configDetail = aggregatedSplits.details.find(d => d.scenario === 'A');
            const config = configDetail?.appliedConfig;
            const profitSellerPct = config ? (config.profitShareSeller * 100).toFixed(0) : "70";
            const profitPartnerPct = config ? (config.profitSharePartner * 100).toFixed(0) : "30";

            return (
              <>
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-700 border-green-500/30 px-3 py-1.5 text-sm font-medium"
                >
                  <Receipt className="h-3.5 w-3.5 mr-1.5" />
                  {sellerName} recebe {profitSellerPct}% do lucro = {formatCurrency(aggregatedSplits.sellerTotalReceive)}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-700 border-amber-500/30 px-3 py-1.5 text-sm font-medium"
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  {partnerName} recebe {profitPartnerPct}% do lucro = {formatCurrency(aggregatedSplits.partnerTotalReceive)}
                </Badge>
              </>
            );
          })()}

          {/* Scenario B: Parceria de Grupo */}
          {aggregatedSplits.scenarios.has('B') && (() => {
            const sellerName = getProfileName(currentUserId);
            const configDetail = aggregatedSplits.details.find(d => d.scenario === 'B');
            const config = configDetail?.appliedConfig;
            const commPct = config ? (config.groupCommission * 100).toFixed(0) : "20";
            const sellerPct = config ? ((1 - config.groupCommission) * 100).toFixed(0) : "80";

            return (
              <>
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-700 border-green-500/30 px-3 py-1.5 text-sm font-medium"
                >
                  <Receipt className="h-3.5 w-3.5 mr-1.5" />
                  {sellerName} recebe ({sellerPct}% comissão) = {formatCurrency(aggregatedSplits.sellerProfitOnly)}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-orange-500/10 text-orange-700 border-orange-500/30 px-3 py-1.5 text-sm font-medium"
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  Grupo recebe ({commPct}% comissão) = {formatCurrency(aggregatedSplits.ownerTotal)}
                </Badge>
              </>
            );
          })()}

          {/* Scenario C: Third-party sells partnership stock */}
          {aggregatedSplits.scenarios.has('C') && (
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
          )}

          {/* OWN_STOCK with fees/commission - simple display */}
          {aggregatedSplits.scenarios.has('OWN_STOCK') && !aggregatedSplits.scenarios.has('A') && !aggregatedSplits.scenarios.has('B') && (hasPaymentFee || hasPartnerPointComm) && (
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-700 border-green-500/30 px-3 py-1.5 text-sm font-medium"
            >
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              Lucro Líquido Real: {formatCurrency(totalNetProfit)}
            </Badge>
          )}

          {/* Partner Point Commission badge */}
          {hasPartnerPointComm && (
            <Badge
              variant="outline"
              className="bg-orange-500/10 text-orange-700 border-orange-500/30 px-3 py-1.5 text-sm font-medium"
            >
              <MapPin className="h-3.5 w-3.5 mr-1.5" />
              Comissão {partnerPointCommission!.pointName} ({partnerPointCommission!.commissionPercent}%): -{formatCurrency(ppCommissionAmount)}
            </Badge>
          )}
        </div>

        {/* Detailed breakdown per product (if multiple items from different owners) */}
        {groupedByOwner.size > 1 && (
          <>
            <Separator className="my-2" />
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Detalhes por estoque:</p>
              {Array.from(groupedByOwner.entries()).map(([ownerId, items]) => {
                const ownerLabel = ownerId === currentUserId
                  ? "Seu Estoque"
                  : `Estoque de ${getProfileName(ownerId)}`;
                return (
                  <div key={ownerId} className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">{ownerLabel}</p>
                    {items.map((detail, idx) => (
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
                          <span className="text-green-600">Seu Lucro: {formatCurrency(detail.sellerProfitOnly)}</span>
                          {detail.partnerTotalReceive > 0 && (
                            <span className="text-blue-600">Sócia: {formatCurrency(detail.partnerTotalReceive)}</span>
                          )}
                          {detail.owner > 0 && (
                            <span className="text-orange-600">Grupo: {formatCurrency(detail.owner)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Single owner, multiple products */}
        {groupedByOwner.size === 1 && aggregatedSplits.details.length > 1 && (
          <>
            <Separator className="my-2" />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Detalhes por produto:</p>
              {aggregatedSplits.details.map((detail, idx) => (
                <div key={idx} className="text-xs bg-background/50 rounded p-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate max-w-[180px]">{detail.productName}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {getScenarioShortLabel(detail.scenario)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Venda: {formatCurrency(detail.salePriceGross)} | Custo: {formatCurrency(detail.costPrice)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Single item explanation */}
        {aggregatedSplits.details.length === 1 && (
          <div className="text-xs text-muted-foreground">
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
