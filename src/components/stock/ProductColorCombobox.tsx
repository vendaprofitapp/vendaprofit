import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Color } from "@/components/products/ColorManager";

interface ProductColorComboboxProps {
  value: string;
  onChange: (value: string) => void;
  existingProductId?: string | null; // ID of matched existing product
  placeholder?: string;
  userColors?: Color[]; // Pre-loaded user colors
}

interface ExistingVariantColor {
  color: string;
  stock: number;
}

export function ProductColorCombobox({
  value,
  onChange,
  existingProductId,
  placeholder = "Cor",
  userColors = [],
}: ProductColorComboboxProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [productColors, setProductColors] = useState<ExistingVariantColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Fetch existing colors from product variants when we have a match
  useEffect(() => {
    if (existingProductId && user) {
      fetchProductColors();
    } else {
      setProductColors([]);
    }
  }, [existingProductId, user]);

  const fetchProductColors = async () => {
    if (!existingProductId) return;
    setLoading(true);

    try {
      // Get colors from product variants
      const { data: variants } = await supabase
        .from("product_variants")
        .select("color, stock_quantity")
        .eq("product_id", existingProductId);

      // Get the main product color too
      const { data: product } = await supabase
        .from("products")
        .select("color")
        .eq("id", existingProductId)
        .single();

      const colorMap = new Map<string, number>();

      // Add product main color
      if (product?.color) {
        colorMap.set(product.color, 0);
      }

      // Add variant colors
      variants?.forEach((v) => {
        if (v.color) {
          const existing = colorMap.get(v.color) || 0;
          colorMap.set(v.color, existing + (v.stock_quantity || 0));
        }
      });

      const colors: ExistingVariantColor[] = Array.from(colorMap.entries()).map(
        ([color, stock]) => ({ color, stock })
      );

      setProductColors(colors);
    } catch (error) {
      console.error("Error fetching product colors:", error);
    }

    setLoading(false);
  };

  // Combine product colors with user colors for suggestions
  const allSuggestions = useMemo(() => {
    const suggestions: { name: string; source: "product" | "user"; stock?: number }[] = [];
    const addedNames = new Set<string>();

    // First add product colors (priority)
    productColors.forEach((pc) => {
      const normalized = pc.color.toLowerCase().trim();
      if (!addedNames.has(normalized)) {
        addedNames.add(normalized);
        suggestions.push({ name: pc.color, source: "product", stock: pc.stock });
      }
    });

    // Then add user colors that aren't already in product colors
    userColors.forEach((uc) => {
      const normalized = uc.name.toLowerCase().trim();
      if (!addedNames.has(normalized)) {
        addedNames.add(normalized);
        suggestions.push({ name: uc.name, source: "user" });
      }
    });

    return suggestions;
  }, [productColors, userColors]);

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return allSuggestions;
    const search = inputValue.toLowerCase().trim();
    return allSuggestions.filter((s) => s.name.toLowerCase().includes(search));
  }, [allSuggestions, inputValue]);

  // Check if current input matches any suggestion
  const inputMatchesSuggestion = useMemo(() => {
    const search = inputValue.toLowerCase().trim();
    return allSuggestions.some((s) => s.name.toLowerCase() === search);
  }, [inputValue, allSuggestions]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
    setInputValue("");
  };

  const handleCreateNew = () => {
    if (inputValue.trim()) {
      onChange(inputValue.trim());
      setOpen(false);
      setInputValue("");
    }
  };

  // If no existing product, show simple input
  if (!existingProductId) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar ou digitar cor..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : (
              <>
                {/* Product colors (existing in this product) */}
                {filteredSuggestions.filter((s) => s.source === "product").length > 0 && (
                  <CommandGroup heading="Cores deste produto">
                    {filteredSuggestions
                      .filter((s) => s.source === "product")
                      .map((suggestion) => (
                        <CommandItem
                          key={suggestion.name}
                          value={suggestion.name}
                          onSelect={() => handleSelect(suggestion.name)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === suggestion.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex-1">{suggestion.name}</span>
                          {suggestion.stock !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              ({suggestion.stock} un)
                            </span>
                          )}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}

                {/* User colors (from color palette) */}
                {filteredSuggestions.filter((s) => s.source === "user").length > 0 && (
                  <>
                    {filteredSuggestions.filter((s) => s.source === "product").length > 0 && (
                      <CommandSeparator />
                    )}
                    <CommandGroup heading="Suas cores">
                      {filteredSuggestions
                        .filter((s) => s.source === "user")
                        .map((suggestion) => (
                          <CommandItem
                            key={suggestion.name}
                            value={suggestion.name}
                            onSelect={() => handleSelect(suggestion.name)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                value === suggestion.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {suggestion.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </>
                )}

                {/* Empty state */}
                {filteredSuggestions.length === 0 && !inputValue && (
                  <CommandEmpty>Nenhuma cor encontrada</CommandEmpty>
                )}

                {/* Create new option */}
                {inputValue.trim() && !inputMatchesSuggestion && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={handleCreateNew}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar nova cor: "{inputValue.trim()}"
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
