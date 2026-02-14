import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet } from "lucide-react";

interface ProfitSplitDisplayProps {
  profitShareSeller: number; // 0-1
  profitSharePartner: number; // 0-1
  compact?: boolean;
}

export function ProfitSplitDisplay({ profitShareSeller, profitSharePartner, compact }: ProfitSplitDisplayProps) {
  const sellerPercent = Math.round(profitShareSeller * 100);
  const partnerPercent = Math.round(profitSharePartner * 100);

  if (compact) {
    return (
      <Badge variant="secondary" className="gap-1 text-xs font-semibold">
        <TrendingUp className="h-3 w-3" />
        Você fica com {sellerPercent}%
      </Badge>
    );
  }

  return (
    <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
      <p className="text-sm font-medium flex items-center gap-1.5">
        <Wallet className="h-4 w-4 text-primary" />
        Divisão de Lucros
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Seu lucro (vendedor)</span>
          <span className="font-bold text-primary">{sellerPercent}%</span>
        </div>
        <Progress value={sellerPercent} className="h-2.5" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Lucro do dono do estoque</span>
          <span className="font-semibold">{partnerPercent}%</span>
        </div>
        <Progress value={partnerPercent} className="h-2.5 [&>div]:bg-muted-foreground/40" />
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Neste grupo, por cada venda na sua loja, você fica com {sellerPercent}% do lucro líquido sem investir em estoque físico.
      </p>
    </div>
  );
}
