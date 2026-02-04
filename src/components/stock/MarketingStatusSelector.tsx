import { Flame, Clock, Rocket, Circle, Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MarketingStatusValue = "opportunity" | "presale" | "launch" | "secret";
export type MarketingStatus = MarketingStatusValue[] | null;

interface MarketingStatusSelectorProps {
  value: MarketingStatus;
  onChange: (value: MarketingStatus) => void;
  compact?: boolean;
}

const statusOptions: { value: MarketingStatusValue; icon: typeof Flame; label: string; color: string; bgColor: string }[] = [
  { 
    value: "opportunity", 
    icon: Flame, 
    label: "Oportunidade", 
    color: "text-orange-500",
    bgColor: "hover:bg-orange-500/10"
  },
  { 
    value: "presale", 
    icon: Clock, 
    label: "Pré-venda", 
    color: "text-purple-500",
    bgColor: "hover:bg-purple-500/10"
  },
  { 
    value: "launch", 
    icon: Rocket, 
    label: "Lançamento", 
    color: "text-green-500",
    bgColor: "hover:bg-green-500/10"
  },
  { 
    value: "secret", 
    icon: Lock, 
    label: "Área Secreta", 
    color: "text-rose-500",
    bgColor: "hover:bg-rose-500/10"
  },
];

export function MarketingStatusSelector({ value, onChange, compact = true }: MarketingStatusSelectorProps) {
  const currentValues = value || [];
  
  const toggleStatus = (status: MarketingStatusValue) => {
    const newValues = currentValues.includes(status)
      ? currentValues.filter(v => v !== status)
      : [...currentValues, status];
    
    onChange(newValues.length > 0 ? newValues : null);
  };

  if (compact) {
    // Compact mode: show selected statuses or a neutral icon
    const hasSelection = currentValues.length > 0;
    
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-0.5">
          {statusOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = currentValues.includes(option.value);
            
            return (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toggleStatus(option.value)}
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded transition-all",
                      option.bgColor,
                      isSelected ? option.color : "text-muted-foreground/30",
                      isSelected && "ring-1 ring-current/30 scale-110"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{option.label}</p>
                  <p className="text-muted-foreground">
                    {isSelected ? "Clique para remover" : "Clique para adicionar"}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  // Full mode: show all options with toggle behavior
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        {statusOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = currentValues.includes(option.value);
          
          return (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => toggleStatus(option.value)}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md transition-all",
                    option.bgColor,
                    option.color,
                    isSelected && "ring-2 ring-current/50 scale-110",
                    !isSelected && "opacity-40 hover:opacity-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {option.label}
                {isSelected ? " (selecionado)" : ""}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// Badge component for displaying status in lists/cards
export function MarketingStatusBadge({ status, size = "sm" }: { status: MarketingStatus; size?: "sm" | "md" }) {
  if (!status || status.length === 0) return null;
  
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5">
        {status.map((s) => {
          const option = statusOptions.find(opt => opt.value === s);
          if (!option) return null;
          
          const Icon = option.icon;
          
          return (
            <Tooltip key={s}>
              <TooltipTrigger asChild>
                <span className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
                  s === "opportunity" && "bg-orange-500/10 text-orange-600",
                  s === "presale" && "bg-purple-500/10 text-purple-600",
                  s === "launch" && "bg-green-500/10 text-green-600",
                  s === "secret" && "bg-rose-500/10 text-rose-600"
                )}>
                  <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
                  {size === "md" && option.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {option.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
