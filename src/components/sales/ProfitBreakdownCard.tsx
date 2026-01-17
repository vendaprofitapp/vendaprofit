import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, TrendingUp, Building2, Wallet } from "lucide-react";
import { calculateSaleSplits, SaleSplitResult, formatCurrency } from "@/utils/profitEngine";

interface CartItemWithCost {
  product: {
    id: string;
    name: string;
    price: number;
    cost_price?: number;
    owner_id: string;
  };
  quantity: number;
  isPartnerStock: boolean;
  ownerName?: string;
}

interface ProfitBreakdownCardProps {
  cart: CartItemWithCost[];
  currentUserId: string;
  groupCommissionPercent?: number;
  hasActivePartnership: boolean;
}

interface AggregatedSplits {
  sellerTotal: number;
  partnerTotal: number;
  ownerTotal: number;
  partnershipPaymentDue: number; // NEW: Total payment due to partnership for third-party sales
  scenarios: Set<SaleSplitResult['scenario']>;
  details: Array<{
    productName: string;
    scenario: SaleSplitResult['scenario'];
    scenarioDescription: string;
    seller: number;
    partner: number;
    owner: number;
    partnershipPaymentDue: number; // NEW
    ownerName?: string;
  }>;
}

export function ProfitBreakdownCard({
  cart,
  currentUserId,
  groupCommissionPercent = 0.20,
  hasActivePartnership,
}: ProfitBreakdownCardProps) {
  const aggregatedSplits = useMemo<AggregatedSplits>(() => {
    const result: AggregatedSplits = {
      sellerTotal: 0,
      partnerTotal: 0,
      ownerTotal: 0,
      partnershipPaymentDue: 0,
      scenarios: new Set(),
      details: [],
    };

    cart.forEach((item) => {
      const salePrice = item.product.price * item.quantity;
      // Use cost_price if available, otherwise estimate as 50% of sale price
      const costPrice = (item.product.cost_price || item.product.price * 0.5) * item.quantity;
      const sellerIsOwner = item.product.owner_id === currentUserId;
      const isPartnershipStock = item.isPartnerStock;

      const splitResult = calculateSaleSplits({
        salePrice,
        costPrice,
        groupCommissionPercent,
        isPartnershipStock,
        sellerIsOwner,
        hasActivePartnership,
      });

      result.sellerTotal += splitResult.seller.total;
      result.partnerTotal += splitResult.partner.total;
      result.ownerTotal += splitResult.owner.total;
      result.partnershipPaymentDue += splitResult.partnershipPaymentDue || 0;
      result.scenarios.add(splitResult.scenario);

      result.details.push({
        productName: item.product.name,
        scenario: splitResult.scenario,
        scenarioDescription: splitResult.scenarioDescription,
        seller: splitResult.seller.total,
        partner: splitResult.partner.total,
        owner: splitResult.owner.total,
        partnershipPaymentDue: splitResult.partnershipPaymentDue || 0,
        ownerName: item.ownerName,
      });
    });

    return result;
  }, [cart, currentUserId, groupCommissionPercent, hasActivePartnership]);

  // Don't show if cart is empty
  if (cart.length === 0) {
    return null;
  }

  // Only show if there are partnership items or active partnerships
  const hasPartnershipItems = cart.some(item => item.isPartnerStock || item.product.owner_id !== currentUserId);
  const shouldShow = hasPartnershipItems || hasActivePartnership;

  if (!shouldShow && aggregatedSplits.scenarios.has('OWN_STOCK') && aggregatedSplits.scenarios.size === 1) {
    return null; // Don't show for pure own stock sales without partnerships
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
          {/* Seller's earnings - Green */}
          <Badge 
            variant="outline" 
            className="bg-green-500/10 text-green-700 border-green-500/30 px-3 py-1.5 text-sm font-medium"
          >
            <Wallet className="h-3.5 w-3.5 mr-1.5" />
            Seu Lucro Líquido: {formatCurrency(aggregatedSplits.sellerTotal)}
          </Badge>

          {/* Partner's share - Blue */}
          {aggregatedSplits.partnerTotal > 0 && (
            <Badge 
              variant="outline" 
              className="bg-blue-500/10 text-blue-700 border-blue-500/30 px-3 py-1.5 text-sm font-medium"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Parte da Sócia: {formatCurrency(aggregatedSplits.partnerTotal)}
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
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {getScenarioShortLabel(detail.scenario)}
                    </Badge>
                  </div>
                  <div className="flex gap-2 text-muted-foreground flex-wrap">
                    <span className="text-green-600">Você: {formatCurrency(detail.seller)}</span>
                    {detail.partner > 0 && (
                      <span className="text-blue-600">Sócia: {formatCurrency(detail.partner)}</span>
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

        {/* Single item explanation */}
        {aggregatedSplits.details.length === 1 && aggregatedSplits.details[0].scenario !== 'OWN_STOCK' && (
          <p className="text-xs text-muted-foreground italic">
            {aggregatedSplits.details[0].scenarioDescription}
          </p>
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
