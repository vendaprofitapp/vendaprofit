import { Flame, Clock, Rocket, Circle, Lock } from "lucide-react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MarketingStatusValue = "opportunity" | "presale" | "launch" | "secret";
export type MarketingStatus = MarketingStatusValue[] | null;
export type MarketingPrices = Record<string, number> | null; // { "opportunity": 99.90, "secret": 79.90 }

interface MarketingStatusSelectorProps {
  value: MarketingStatus;
  onChange: (value: MarketingStatus) => void;
  marketingPrices?: MarketingPrices;
  onMarketingPricesChange?: (prices: MarketingPrices) => void;
  compact?: boolean;
}

const statusOptions: { value: MarketingStatusValue; icon: typeof Flame; label: string; color: string; bgColor: string }[] = [
  { value: "opportunity", icon: Flame, label: "Oportunidade", color: "text-orange-500", bgColor: "hover:bg-orange-500/10" },
  { value: "presale", icon: Clock, label: "Pré-venda", color: "text-purple-500", bgColor: "hover:bg-purple-500/10" },
  { value: "launch", icon: Rocket, label: "Lançamento", color: "text-green-500", bgColor: "hover:bg-green-500/10" },
  { value: "secret", icon: Lock, label: "Área Secreta", color: "text-rose-500", bgColor: "hover:bg-rose-500/10" },
];

export function MarketingStatusSelector({ 
  value, 
  onChange, 
  marketingPrices,
  onMarketingPricesChange,
  compact = true 
}: MarketingStatusSelectorProps) {
  const currentValues = value || [];
  const prices = marketingPrices || {};
  const [openPopover, setOpenPopover] = useState<MarketingStatusValue | null>(null);
  const [tempPrice, setTempPrice] = useState<string>("");
  
  const handleStatusClick = (status: MarketingStatusValue) => {
    const isSelected = currentValues.includes(status);
    
    if (isSelected) {
      const newValues = currentValues.filter(v => v !== status);
      onChange(newValues.length > 0 ? newValues : null);
      // Remove price for this status
      if (onMarketingPricesChange) {
        const newPrices = { ...prices };
        delete newPrices[status];
        onMarketingPricesChange(Object.keys(newPrices).length > 0 ? newPrices : null);
      }
    } else {
      setTempPrice(prices[status] ? String(prices[status]) : "");
      setOpenPopover(status);
    }
  };

  const handleConfirmPrice = (status: MarketingStatusValue) => {
    const newValues = [...currentValues, status];
    onChange(newValues);
    
    if (onMarketingPricesChange && tempPrice) {
      const price = parseFloat(tempPrice.replace(",", "."));
      if (!isNaN(price) && price > 0) {
        onMarketingPricesChange({ ...prices, [status]: price });
      }
    }
    
    setOpenPopover(null);
    setTempPrice("");
  };

  const handleSkipPrice = (status: MarketingStatusValue) => {
    const newValues = [...currentValues, status];
    onChange(newValues);
    setOpenPopover(null);
    setTempPrice("");
  };

  const renderStatusButton = (option: typeof statusOptions[0], isCompact: boolean) => {
    const Icon = option.icon;
    const isSelected = currentValues.includes(option.value);
    const statusPrice = prices[option.value];
    const btnSize = isCompact ? "w-6 h-6" : "w-8 h-8";
    const iconSize = isCompact ? "h-3.5 w-3.5" : "h-4 w-4";

    return (
      <Popover 
        key={option.value} 
        open={openPopover === option.value}
        onOpenChange={(open) => !open && setOpenPopover(null)}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={() => handleStatusClick(option.value)}
                className={cn(
                  "flex items-center justify-center rounded transition-all",
                  btnSize,
                  option.bgColor,
                  isCompact
                    ? cn(isSelected ? option.color : "text-muted-foreground/30", isSelected && "ring-1 ring-current/30 scale-110")
                    : cn(option.color, isSelected && "ring-2 ring-current/50 scale-110", !isSelected && "opacity-40 hover:opacity-100")
                )}
              >
                <Icon className={iconSize} />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-medium">{option.label}</p>
            <p className="text-muted-foreground">
              {isSelected ? "Clique para remover" : "Clique para adicionar"}
            </p>
            {isSelected && statusPrice && (
              <p className="text-primary font-medium">
                Preço: R$ {statusPrice.toFixed(2)}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-64 p-3" side="top" align="center">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Icon className={cn("h-4 w-4", option.color)} />
                {option.label}
              </Label>
              <p className="text-xs text-muted-foreground">
                Defina um preço promocional para este status
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`price-${option.value}`} className="text-xs">
                Preço Promocional (R$)
              </Label>
              <Input
                id={`price-${option.value}`}
                type="text"
                inputMode="decimal"
                placeholder="Ex: 99.90"
                value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                className="h-9"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => handleSkipPrice(option.value)}>
                Pular
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={() => handleConfirmPrice(option.value)}>
                Confirmar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex items-center", compact ? "gap-0.5" : "gap-1")}>
        {statusOptions.map((option) => renderStatusButton(option, compact))}
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
