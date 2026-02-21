import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketingStatusSelector, type MarketingStatus, type MarketingPrices } from "@/components/stock/MarketingStatusSelector";

export interface ProductVariant {
  id?: string;
  size: string;
  stock_quantity: number;
  marketing_status?: MarketingStatus;
  marketing_prices?: MarketingPrices;
  marketing_delivery_days?: number | null;
}

const availableSizes = ["2", "4", "6", "8", "10", "12", "PP", "P", "M", "G", "GG", "XG", "XXG", "XXXG", "EG", "EGG", "EGGG", "Único", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "Pote 220 grs", "Pote 350 grs", "Pote 400 grs", "Pacote 500 grs", "Pacote 1 kg"];

interface ProductVariantsSectionProps {
  variants: ProductVariant[];
  totalStock: number;
  onAddVariant: () => void;
  onRemoveVariant: (index: number) => void;
  onUpdateVariant: (index: number, field: keyof ProductVariant, value: any) => void;
}

const VariantRow = React.memo(function VariantRow({
  variant,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: {
  variant: ProductVariant;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, field: keyof ProductVariant, value: any) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex gap-2 items-center p-2 border rounded-lg bg-muted/30">
      <Select
        value={variant.size}
        onValueChange={(value) => onUpdate(index, "size", value)}
      >
        <SelectTrigger className="w-20 sm:w-24 shrink-0">
          <SelectValue placeholder="Tamanho" />
        </SelectTrigger>
        <SelectContent>
          {availableSizes.map((size) => (
            <SelectItem key={size} value={size}>{size}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Input
        type="number"
        inputMode="numeric"
        placeholder="Qtd"
        className="w-16 sm:w-20 shrink-0"
        value={variant.stock_quantity || ""}
        onChange={(e) => onUpdate(index, "stock_quantity", parseInt(e.target.value) || 0)}
      />
      
      <div className="flex-1 flex justify-center">
        <MarketingStatusSelector
          value={variant.marketing_status || null}
          onChange={(status) => onUpdate(index, "marketing_status", status)}
          marketingPrices={variant.marketing_prices}
          onMarketingPricesChange={(prices) => onUpdate(index, "marketing_prices", prices)}
          compact
        />
      </div>
      
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-destructive"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});

export const ProductVariantsSection = React.memo(function ProductVariantsSection({
  variants,
  totalStock,
  onAddVariant,
  onRemoveVariant,
  onUpdateVariant,
}: ProductVariantsSectionProps) {
  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Variantes de Tamanho *</h3>
        <span className="text-sm font-medium text-primary">
          Total: {totalStock} un.
        </span>
      </div>
      
      <div className="space-y-2">
        {variants.map((variant, index) => (
          <VariantRow
            key={`${variant.size}-${index}`}
            variant={variant}
            index={index}
            canRemove={variants.length > 1}
            onUpdate={onUpdateVariant}
            onRemove={onRemoveVariant}
          />
        ))}
      </div>
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddVariant}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Tamanho
      </Button>
    </div>
  );
});
