import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, TrendingUp, Users } from "lucide-react";

interface PartnershipProposalCardProps {
  costSplitPercent: number; // e.g., 50
  profitShareSeller: number; // e.g., 70 - when YOU sell
  profitSharePartner: number; // e.g., 30 - when PARTNER sells
  thirdPartyCommission: number; // e.g., 20 - commission on third-party sales
  inviterName: string;
}

export function PartnershipProposalCard({
  costSplitPercent,
  profitShareSeller,
  profitSharePartner,
  thirdPartyCommission,
  inviterName,
}: PartnershipProposalCardProps) {
  // Simulation values (Preço R$ 200, Custo R$ 100, Lucro R$ 100)
  const simulationPrice = 200;
  const simulationCost = 100;
  const simulationProfit = simulationPrice - simulationCost;

  // Cost split (50/50)
  const yourCostShare = simulationCost * (costSplitPercent / 100);
  const partnerCostShare = simulationCost * ((100 - costSplitPercent) / 100);

  // Situação 1: Direct Sale - When YOU sell
  const youSellYourProfit = simulationProfit * (profitShareSeller / 100);
  const youSellPartnerProfit = simulationProfit * (profitSharePartner / 100);
  const youSellYouReceive = yourCostShare + youSellYourProfit;
  const youSellPartnerReceives = partnerCostShare + youSellPartnerProfit;

  // Situação 2: Third-party sale
  // Third-party pays partnership: Cost + commission% of profit
  const partnershipCommissionAmount = simulationProfit * (thirdPartyCommission / 100);
  const thirdPartyPaysToParceria = simulationCost + partnershipCommissionAmount;
  
  // Commission is split according to seller/partner percentages
  const yourCommissionShare = partnershipCommissionAmount * (profitShareSeller / 100);
  const partnerCommissionShare = partnershipCommissionAmount * (profitSharePartner / 100);
  
  const youReceiveThirdParty = yourCostShare + yourCommissionShare;
  const partnerReceivesThirdParty = partnerCostShare + partnerCommissionShare;
  
  // External seller keeps the rest
  const externalSellerKeeps = simulationPrice - thirdPartyPaysToParceria;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="bg-gradient-to-br from-primary/5 via-background to-accent/5 rounded-xl border-2 border-primary/20 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xl">🤝</span>
        </div>
        <div>
          <h3 className="font-semibold text-lg">Proposta de Parceria Always Profit</h3>
          <p className="text-sm text-muted-foreground">Proposta de {inviterName}</p>
        </div>
      </div>

      <Separator />

      {/* Terms Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>Termos:</span>
        </div>

        <div className="space-y-2 pl-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">
              <strong>Divisão de Custo:</strong> {costSplitPercent}/{100 - costSplitPercent}%
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">
              <strong>Seu lucro quando vende:</strong>{" "}
              <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/30 ml-1">
                {profitShareSeller}%
              </Badge>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">
              <strong>Seu lucro quando o sócio vende:</strong>{" "}
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 border-orange-500/30 ml-1">
                {profitSharePartner}%
              </Badge>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">
              <strong>Comissão da Parceria (Venda por Terceiros):</strong>{" "}
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 border-purple-500/30 ml-1">
                {thirdPartyCommission}%
              </Badge>
              <span className="text-muted-foreground ml-1">(sobre o lucro)</span>
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Simulations Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
          <span className="text-lg">📊</span>
          <span>Simulação Real</span>
          <Badge variant="outline" className="text-xs font-normal">
            Exemplo: Peça de {formatCurrency(simulationPrice)} | Custo {formatCurrency(simulationCost)}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground pl-6">
          Lucro Líquido: <strong>{formatCurrency(simulationProfit)}</strong>
        </p>

        {/* Situação 1: Direct Sale */}
        <div className="bg-gradient-to-r from-green-500/5 to-green-500/10 rounded-lg p-4 space-y-3 border border-green-500/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="font-medium text-sm">Situação 1: Venda direta por você ou seu sócio</span>
          </div>
          
          <div className="bg-background/80 rounded-md p-3 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quem vendeu:</span>
                <span className="font-semibold text-green-600">{formatCurrency(youSellYouReceive)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ({formatCurrency(yourCostShare)} custo + {formatCurrency(youSellYourProfit)} lucro)
              </p>
            </div>
            
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">A outra sócia:</span>
                <span className="font-semibold text-orange-600">{formatCurrency(youSellPartnerReceives)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ({formatCurrency(partnerCostShare)} custo + {formatCurrency(youSellPartnerProfit)} lucro)
              </p>
            </div>
          </div>
        </div>

        {/* Situação 2: Third-party Sale */}
        <div className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 rounded-lg p-4 space-y-3 border border-purple-500/20">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-sm">Situação 2: Venda por terceiro (via Grupo)</span>
          </div>
          
          <p className="text-xs text-muted-foreground pl-4">
            O terceiro paga {formatCurrency(thirdPartyPaysToParceria)} à parceria (Custo + {thirdPartyCommission}% do lucro)
          </p>

          <div className="bg-background/80 rounded-md p-3 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Você recebe:</span>
                <span className="font-semibold text-purple-600">{formatCurrency(youReceiveThirdParty)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ({formatCurrency(yourCostShare)} custo + {profitShareSeller}% da comissão)
              </p>
            </div>
            
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sua sócia recebe:</span>
                <span className="font-semibold text-purple-600">{formatCurrency(partnerReceivesThirdParty)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ({formatCurrency(partnerCostShare)} custo + {profitSharePartner}% da comissão)
              </p>
            </div>

            <Separator className="my-2" />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">O vendedor externo fica com:</span>
                <span className="font-semibold text-blue-600">{formatCurrency(externalSellerKeeps)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-muted/30 rounded-lg p-3 flex items-start gap-2">
        <Calculator className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Os valores acima são calculados automaticamente com base nos percentuais definidos por {inviterName}. 
          Ao aceitar, estas serão as regras da sua parceria.
        </p>
      </div>
    </div>
  );
}
