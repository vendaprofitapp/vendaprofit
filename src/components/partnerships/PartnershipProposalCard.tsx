import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, Percent, TrendingUp, Users } from "lucide-react";

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
  // Simulation values (Custo R$ 100, Preço R$ 200, Lucro R$ 100)
  const simulationCost = 100;
  const simulationPrice = 200;
  const simulationProfit = simulationPrice - simulationCost;

  // Situação 1: When YOU sell
  const youSellYouReceive = (simulationCost * (costSplitPercent / 100)) + (simulationProfit * (profitShareSeller / 100));
  const youSellPartnerReceives = (simulationCost * ((100 - costSplitPercent) / 100)) + (simulationProfit * (profitSharePartner / 100));

  // Situação 1b: When PARTNER sells
  const partnerSellsYouReceive = (simulationCost * (costSplitPercent / 100)) + (simulationProfit * (profitSharePartner / 100));
  const partnerSellsPartnerReceives = (simulationCost * ((100 - costSplitPercent) / 100)) + (simulationProfit * (profitShareSeller / 100));

  // Situação 2: Third-party sale
  const partnershipCommissionTotal = simulationProfit * (thirdPartyCommission / 100);
  const yourCostBack = simulationCost * (costSplitPercent / 100);
  const partnerCostBack = simulationCost * ((100 - costSplitPercent) / 100);
  const yourCommissionShare = partnershipCommissionTotal * (costSplitPercent / 100); // Using cost split for commission division
  const partnerCommissionShare = partnershipCommissionTotal * ((100 - costSplitPercent) / 100);
  const youReceiveThirdParty = yourCostBack + yourCommissionShare;
  const partnerReceivesThirdParty = partnerCostBack + partnerCommissionShare;

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
          <h3 className="font-semibold text-lg">Proposta de Divisão Always Profit</h3>
          <p className="text-sm text-muted-foreground">Proposta de {inviterName}</p>
        </div>
      </div>

      <Separator />

      {/* Split Rules Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-lg">📊</span>
          <span>Regras de Divisão (Split):</span>
        </div>

        <div className="space-y-2 pl-6">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">
              <strong>Divisão de Custo:</strong> {costSplitPercent}% para cada sócia
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">
              <strong>Sua Parte no Lucro quando VOCÊ vende:</strong>{" "}
              <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/30 ml-1">
                {profitShareSeller}%
              </Badge>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">
              <strong>Sua Parte no Lucro quando o PARCEIRO vende:</strong>{" "}
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 border-orange-500/30 ml-1">
                {profitSharePartner}%
              </Badge>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">•</span>
            <span className="text-sm">
              <strong>Comissão da Parceria em Vendas de Terceiros:</strong>{" "}
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 border-purple-500/30 ml-1">
                {thirdPartyCommission}%
              </Badge>
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Simulations Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-lg">💡</span>
          <span>Simulações Reais:</span>
          <Badge variant="outline" className="text-xs font-normal">
            Peça de {formatCurrency(simulationCost)} vendida por {formatCurrency(simulationPrice)}
          </Badge>
        </div>

        {/* Situação 1: Direct Sale */}
        <div className="bg-gradient-to-r from-green-500/5 to-green-500/10 rounded-lg p-4 space-y-3 border border-green-500/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="font-medium text-sm">Situação 1: Venda direta por uma das parceiras</span>
          </div>
          
          <div className="grid gap-2 pl-4 text-sm">
            <div className="bg-background/80 rounded-md p-3 space-y-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Quando VOCÊ vende:</p>
              <div className="flex items-center justify-between">
                <span>Você recebe:</span>
                <span className="font-semibold text-green-600">{formatCurrency(youSellYouReceive)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                (Custo + {profitShareSeller}% do lucro)
              </p>
              <div className="flex items-center justify-between mt-1">
                <span>{inviterName} recebe:</span>
                <span className="font-semibold text-orange-600">{formatCurrency(youSellPartnerReceives)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                (Custo + {profitSharePartner}% do lucro)
              </p>
            </div>

            <div className="bg-background/80 rounded-md p-3 space-y-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Quando {inviterName.toUpperCase()} vende:</p>
              <div className="flex items-center justify-between">
                <span>Você recebe:</span>
                <span className="font-semibold text-orange-600">{formatCurrency(partnerSellsYouReceive)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                (Custo + {profitSharePartner}% do lucro)
              </p>
              <div className="flex items-center justify-between mt-1">
                <span>{inviterName} recebe:</span>
                <span className="font-semibold text-green-600">{formatCurrency(partnerSellsPartnerReceives)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                (Custo + {profitShareSeller}% do lucro)
              </p>
            </div>
          </div>
        </div>

        {/* Situação 2: Third-party Sale */}
        <div className="bg-gradient-to-r from-purple-500/5 to-purple-500/10 rounded-lg p-4 space-y-3 border border-purple-500/20">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-sm">Situação 2: Venda através de Grupo (Cessão de Estoque)</span>
          </div>
          
          <p className="text-xs text-muted-foreground pl-4">
            Um terceiro vende e a parceria recebe {thirdPartyCommission}% de comissão sobre o lucro
          </p>

          <div className="grid gap-2 pl-4 text-sm">
            <div className="bg-background/80 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span>Você recebe:</span>
                <span className="font-semibold text-purple-600">{formatCurrency(youReceiveThirdParty)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                ({formatCurrency(yourCostBack)} custo + {formatCurrency(yourCommissionShare)} comissão)
              </p>
              
              <div className="flex items-center justify-between mt-2">
                <span>{inviterName} recebe:</span>
                <span className="font-semibold text-purple-600">{formatCurrency(partnerReceivesThirdParty)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                ({formatCurrency(partnerCostBack)} custo + {formatCurrency(partnerCommissionShare)} comissão)
              </p>
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
