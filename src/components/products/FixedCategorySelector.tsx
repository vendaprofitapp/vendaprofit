import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  const mainSelectRef = useRef<HTMLSelectElement>(null);
  const subSelectRef = useRef<HTMLSelectElement>(null);

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

  const handleMainCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onMainCategoryChange(value);
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

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSubcategoryChange(e.target.value);
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

      {/* Main Category Select */}
      <div className="space-y-2">
        <Label>Categoria Principal *</Label>
        <select
          ref={mainSelectRef}
          value={mainCategory}
          onChange={handleMainCategoryChange}
          disabled={loading}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{loading ? "Carregando..." : "Selecione a categoria"}</option>
          {mainCategories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Subcategory Select */}
      {selectedMainCategory?.has_subcategories && availableSubcategories.length > 0 && (
        <div className="space-y-2">
          <Label>Subcategoria</Label>
          <select
            ref={subSelectRef}
            value={subcategory}
            onChange={handleSubcategoryChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Selecione a subcategoria</option>
            {availableSubcategories.map((sub) => (
              <option key={sub.id} value={sub.name}>
                {sub.name}
              </option>
            ))}
          </select>
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