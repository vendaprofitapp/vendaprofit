import { Award, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface LoyaltyHeaderProps {
  isIdentified: boolean;
  currentLevel: { name: string; color: string; features: string[]; min_spent: number } | null;
  nextLevel: { name: string; color: string; min_spent: number } | null;
  progress: number;
  amountToNext: number | null;
  totalSpent: number;
  isLoading: boolean;
  onIdentify: () => void;
  primaryColor: string;
}

export function LoyaltyHeader({
  isIdentified,
  currentLevel,
  nextLevel,
  progress,
  amountToNext,
  totalSpent,
  isLoading,
  onIdentify,
  primaryColor,
}: LoyaltyHeaderProps) {
  if (isLoading) return null;

  // Not identified — show CTA
  if (!isIdentified) {
    return (
      <div className="w-full px-4 py-2 border-b border-gray-100" style={{ backgroundColor: `${primaryColor}08` }}>
        <button
          onClick={onIdentify}
          className="flex items-center justify-center gap-2 w-full text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: primaryColor }}
        >
          <Award className="h-4 w-4" />
          Entrar para ver meu Nível
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Identified but no levels configured
  if (!currentLevel) return null;

  const isMaxLevel = !nextLevel;

  return (
    <div className="w-full px-4 py-2.5 border-b border-gray-100" style={{ backgroundColor: `${currentLevel.color}10` }}>
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
        {/* Level name + badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: currentLevel.color }}
            >
              <Award className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: currentLevel.color }}>
              {currentLevel.name}
            </span>
          </div>
          {isMaxLevel && (
            <span className="text-xs font-medium text-muted-foreground">Nível máximo! 🏆</span>
          )}
        </div>

        {/* Progress bar */}
        {!isMaxLevel && nextLevel && (
          <div className="flex flex-col gap-1">
            <Progress
              value={progress}
              className="h-2"
              style={
                {
                  "--progress-color": currentLevel.color,
                } as React.CSSProperties
              }
            />
            <p className="text-xs text-muted-foreground">
              Falta <span className="font-semibold" style={{ color: currentLevel.color }}>R$ {amountToNext?.toFixed(2).replace(".", ",")}</span> para{" "}
              <span className="font-semibold" style={{ color: nextLevel.color }}>Cliente Nível {nextLevel.name}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
