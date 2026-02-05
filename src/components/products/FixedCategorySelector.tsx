import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface MainCategory {
  id: string;
  name: string;
  display_order: number;
  has_subcategories: boolean;
}

export interface Subcategory {
  id: string;
  main_category_id: string;
  name: string;
  display_order: number;
}

interface FixedCategorySelectorProps {
  mainCategory: string;
  subcategory: string;
  isNewRelease: boolean;
  onMainCategoryChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
  onIsNewReleaseChange: (value: boolean) => void;
}

export function FixedCategorySelector({
  mainCategory,
  subcategory,
  isNewRelease,
  onMainCategoryChange,
  onSubcategoryChange,
  onIsNewReleaseChange,
}: FixedCategorySelectorProps) {
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainCategoryOpen, setMainCategoryOpen] = useState(false);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    
    const [mainRes, subRes] = await Promise.all([
      supabase
        .from("main_categories")
        .select("id, name, display_order, has_subcategories")
        .eq("is_active", true)
        .neq("name", "Lançamentos")
        .order("display_order"),
      supabase
        .from("subcategories")
        .select("id, main_category_id, name, display_order")
        .eq("is_active", true)
        .order("display_order"),
    ]);

    if (!mainRes.error) {
      setMainCategories(mainRes.data || []);
    }
    if (!subRes.error) {
      setSubcategories(subRes.data || []);
    }
    
    setLoading(false);
  };

  const selectedMainCategory = mainCategories.find(c => c.name === mainCategory);
  
  const availableSubcategories = selectedMainCategory
    ? subcategories.filter(s => s.main_category_id === selectedMainCategory.id)
    : [];

  const handleMainCategoryChange = (value: string) => {
    onMainCategoryChange(value);
    setMainCategoryOpen(false);
    const newMainCat = mainCategories.find(c => c.name === value);
    if (!newMainCat?.has_subcategories) {
      onSubcategoryChange("");
    } else {
      const validSubcats = subcategories.filter(s => s.main_category_id === newMainCat?.id);
      if (!validSubcats.find(s => s.name === subcategory)) {
        onSubcategoryChange("");
      }
    }
  };

  const handleSubcategoryChange = (value: string) => {
    onSubcategoryChange(value);
    setSubcategoryOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* New Release Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_new_release"
          checked={isNewRelease}
          onCheckedChange={(checked) => onIsNewReleaseChange(checked === true)}
        />
        <Label htmlFor="is_new_release" className="cursor-pointer flex items-center gap-2">
          Lançamento
          {isNewRelease && (
            <Badge variant="default" className="bg-primary">
              🚀 Novo
            </Badge>
          )}
        </Label>
      </div>

      {/* Main Category Combobox */}
      <div className="space-y-2">
        <Label>Categoria Principal *</Label>
        <Popover open={mainCategoryOpen} onOpenChange={setMainCategoryOpen} modal={true}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={mainCategoryOpen}
              className="w-full justify-between font-normal"
              disabled={loading}
            >
              {mainCategory || (loading ? "Carregando..." : "Selecione a categoria")}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar categoria..." />
              <CommandList>
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                <CommandGroup>
                  {mainCategories.map((cat) => (
                    <CommandItem
                      key={cat.id}
                      value={cat.name}
                      onSelect={(currentValue) => {
                        const selected = mainCategories.find(
                          c => c.name.toLowerCase() === currentValue.toLowerCase()
                        );
                        if (selected) {
                          handleMainCategoryChange(selected.name);
                        }
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          mainCategory === cat.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {cat.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Subcategory Combobox */}
      {selectedMainCategory?.has_subcategories && availableSubcategories.length > 0 && (
        <div className="space-y-2">
          <Label>Subcategoria</Label>
          <Popover open={subcategoryOpen} onOpenChange={setSubcategoryOpen} modal={true}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={subcategoryOpen}
                className="w-full justify-between font-normal"
              >
                {subcategory || "Selecione a subcategoria"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar subcategoria..." />
                <CommandList>
                  <CommandEmpty>Nenhuma subcategoria encontrada.</CommandEmpty>
                  <CommandGroup>
                    {availableSubcategories.map((sub) => (
                      <CommandItem
                        key={sub.id}
                        value={sub.name}
                        onSelect={(currentValue) => {
                          const selected = availableSubcategories.find(
                            s => s.name.toLowerCase() === currentValue.toLowerCase()
                          );
                          if (selected) {
                            handleSubcategoryChange(selected.name);
                          }
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            subcategory === sub.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {sub.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Display selected categories */}
      {(mainCategory || isNewRelease) && (
        <div className="flex flex-wrap gap-2 pt-2">
          {isNewRelease && (
            <Badge variant="secondary" className="bg-accent text-accent-foreground">
              🚀 Lançamentos
            </Badge>
          )}
          {mainCategory && (
            <Badge variant="outline">{mainCategory}</Badge>
          )}
          {subcategory && (
            <Badge variant="outline" className="bg-muted">
              {subcategory}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// Hook to fetch categories for filters
export function useFixedCategories() {
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const [mainRes, subRes] = await Promise.all([
        supabase
          .from("main_categories")
          .select("id, name, display_order, has_subcategories")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("subcategories")
          .select("id, main_category_id, name, display_order")
          .eq("is_active", true)
          .order("display_order"),
      ]);

      if (!mainRes.error) {
        setMainCategories(mainRes.data || []);
      }
      if (!subRes.error) {
        setSubcategories(subRes.data || []);
      }
      setLoading(false);
    };

    fetchCategories();
  }, []);

  return { mainCategories, subcategories, loading };
}