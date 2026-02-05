import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";
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
  const [showMainDropdown, setShowMainDropdown] = useState(false);
  const [showSubDropdown, setShowSubDropdown] = useState(false);

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

  const handleMainCategorySelect = (categoryName: string) => {
    onMainCategoryChange(categoryName);
    setShowMainDropdown(false);
    
    const newMainCat = mainCategories.find(c => c.name === categoryName);
    if (!newMainCat?.has_subcategories) {
      onSubcategoryChange("");
    } else {
      const validSubcats = subcategories.filter(s => s.main_category_id === newMainCat?.id);
      if (!validSubcats.find(s => s.name === subcategory)) {
        onSubcategoryChange("");
      }
    }
  };

  const handleSubcategorySelect = (subcategoryName: string) => {
    onSubcategoryChange(subcategoryName);
    setShowSubDropdown(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.category-dropdown-container')) {
        setShowMainDropdown(false);
        setShowSubDropdown(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

      {/* Main Category Selector */}
      <div className="space-y-2">
        <Label>Categoria Principal *</Label>
        <div className="category-dropdown-container relative">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMainDropdown(!showMainDropdown);
              setShowSubDropdown(false);
            }}
            disabled={loading}
            className="w-full justify-between h-10 font-normal"
          >
            <span className={cn(!mainCategory && "text-muted-foreground")}>
              {loading ? "Carregando..." : mainCategory || "Selecione a categoria"}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showMainDropdown && "rotate-180")} />
          </Button>
          
          {showMainDropdown && (
            <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
              {mainCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMainCategorySelect(cat.name);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between",
                    mainCategory === cat.name && "bg-accent"
                  )}
                >
                  {cat.name}
                  {mainCategory === cat.name && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subcategory Selector */}
      {selectedMainCategory?.has_subcategories && availableSubcategories.length > 0 && (
        <div className="space-y-2">
          <Label>Subcategoria</Label>
          <div className="category-dropdown-container relative">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowSubDropdown(!showSubDropdown);
                setShowMainDropdown(false);
              }}
              className="w-full justify-between h-10 font-normal"
            >
              <span className={cn(!subcategory && "text-muted-foreground")}>
                {subcategory || "Selecione a subcategoria"}
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showSubDropdown && "rotate-180")} />
            </Button>
            
            {showSubDropdown && (
              <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                {availableSubcategories.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubcategorySelect(sub.name);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between",
                      subcategory === sub.name && "bg-accent"
                    )}
                  >
                    {sub.name}
                    {subcategory === sub.name && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>
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
