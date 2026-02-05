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

interface MarketingStatusSelectorProps {
  value: MarketingStatus;
  onChange: (value: MarketingStatus) => void;
  marketingPrice?: number | null;
  onMarketingPriceChange?: (price: number | null) => void;
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

export function MarketingStatusSelector({ 
  value, 
  onChange, 
  marketingPrice,
  onMarketingPriceChange,
  compact = true 
}: MarketingStatusSelectorProps) {
  const currentValues = value || [];
  const [openPopover, setOpenPopover] = useState<MarketingStatusValue | null>(null);
  const [tempPrice, setTempPrice] = useState<string>("");
  
  const handleStatusClick = (status: MarketingStatusValue) => {
    const isSelected = currentValues.includes(status);
    
    if (isSelected) {
      // Removing status - just toggle off
      const newValues = currentValues.filter(v => v !== status);
      onChange(newValues.length > 0 ? newValues : null);
      // Clear price if no marketing status is active
      if (newValues.length === 0 && onMarketingPriceChange) {
        onMarketingPriceChange(null);
      }
    } else {
      // Adding status - open popover to set price
      setTempPrice(marketingPrice ? String(marketingPrice) : "");
      setOpenPopover(status);
    }
  };

  const handleConfirmPrice = (status: MarketingStatusValue) => {
    const newValues = [...currentValues, status];
    onChange(newValues);
    
    if (onMarketingPriceChange && tempPrice) {
      const price = parseFloat(tempPrice.replace(",", "."));
      if (!isNaN(price) && price > 0) {
        onMarketingPriceChange(price);
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

  if (compact) {
    // Compact mode: show selected statuses or a neutral icon
    
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-0.5">
          {statusOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = currentValues.includes(option.value);
            
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
                          "flex items-center justify-center w-6 h-6 rounded transition-all",
                          option.bgColor,
                          isSelected ? option.color : "text-muted-foreground/30",
                          isSelected && "ring-1 ring-current/30 scale-110"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-muted-foreground">
                      {isSelected ? "Clique para remover" : "Clique para adicionar"}
                    </p>
                    {isSelected && marketingPrice && (
                      <p className="text-primary font-medium">
                        Preço: R$ {marketingPrice.toFixed(2)}
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
                        Defina um preço promocional para esta variante
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleSkipPrice(option.value)}
                      >
                        Pular
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleConfirmPrice(option.value)}
                      >
                        Confirmar
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
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
                        "flex items-center justify-center w-8 h-8 rounded-md transition-all",
                        option.bgColor,
                        option.color,
                        isSelected && "ring-2 ring-current/50 scale-110",
                        !isSelected && "opacity-40 hover:opacity-100"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {option.label}
                  {isSelected ? " (selecionado)" : ""}
                  {isSelected && marketingPrice && (
                    <span className="block text-primary">
                      Preço: R$ {marketingPrice.toFixed(2)}
                    </span>
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
                      Defina um preço promocional para esta variante
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`price-full-${option.value}`} className="text-xs">
                      Preço Promocional (R$)
                    </Label>
                    <Input
                      id={`price-full-${option.value}`}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleSkipPrice(option.value)}
                    >
                      Pular
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleConfirmPrice(option.value)}
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
