import { Flame, Clock, Rocket, Circle, Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MarketingStatus = "opportunity" | "presale" | "launch" | "secret" | null;

interface MarketingStatusSelectorProps {
  value: MarketingStatus;
  onChange: (value: MarketingStatus) => void;
  compact?: boolean;
}

const statusOptions: { value: MarketingStatus; icon: typeof Flame; label: string; color: string; bgColor: string }[] = [
  { 
    value: null, 
    icon: Circle, 
    label: "Normal", 
    color: "text-muted-foreground",
    bgColor: "hover:bg-muted"
  },
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
  const currentOption = statusOptions.find(opt => opt.value === value) || statusOptions[0];
  
  if (compact) {
    // Compact mode: cycle through options on click
    const handleClick = () => {
      const currentIndex = statusOptions.findIndex(opt => opt.value === value);
      const nextIndex = (currentIndex + 1) % statusOptions.length;
      onChange(statusOptions[nextIndex].value);
    };

    const CurrentIcon = currentOption.icon;

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-md transition-colors shrink-0",
                currentOption.bgColor,
                currentOption.color,
                value !== null && "ring-1 ring-current/30"
              )}
            >
              <CurrentIcon className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-medium">{currentOption.label}</p>
            <p className="text-muted-foreground">Clique para alterar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full mode: show all options
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        {statusOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          
          return (
            <Tooltip key={option.label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(option.value)}
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
  if (!status) return null;
  
  const option = statusOptions.find(opt => opt.value === status);
  if (!option) return null;
  
  const Icon = option.icon;
  
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
            status === "opportunity" && "bg-orange-500/10 text-orange-600",
            status === "presale" && "bg-purple-500/10 text-purple-600",
            status === "launch" && "bg-green-500/10 text-green-600",
            status === "secret" && "bg-rose-500/10 text-rose-600"
          )}>
            <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
            {size === "md" && option.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {option.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
