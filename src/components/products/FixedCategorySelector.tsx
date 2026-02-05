 import { useState, useEffect } from "react";
 import { Label } from "@/components/ui/label";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
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
         .neq("name", "Lançamentos") // Lançamentos is handled separately
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
 
   // Get selected main category object
   const selectedMainCategory = mainCategories.find(c => c.name === mainCategory);
   
   // Get subcategories for selected main category
   const availableSubcategories = selectedMainCategory
     ? subcategories.filter(s => s.main_category_id === selectedMainCategory.id)
     : [];
 
   // Clear subcategory when main category changes and doesn't have subcategories
   const handleMainCategoryChange = (value: string) => {
     onMainCategoryChange(value);
     const newMainCat = mainCategories.find(c => c.name === value);
     if (!newMainCat?.has_subcategories) {
       onSubcategoryChange("");
     } else {
       // Clear subcategory if it doesn't belong to the new main category
       const validSubcats = subcategories.filter(s => s.main_category_id === newMainCat?.id);
       if (!validSubcats.find(s => s.name === subcategory)) {
         onSubcategoryChange("");
       }
     }
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
             <Badge variant="default" className="bg-green-500">
               🚀 Novo
             </Badge>
           )}
         </Label>
       </div>
 
       {/* Main Category Select */}
       <div className="space-y-2">
         <Label>Categoria Principal *</Label>
         <Select 
           value={mainCategory} 
           onValueChange={handleMainCategoryChange}
           disabled={loading}
         >
           <SelectTrigger>
             <SelectValue placeholder={loading ? "Carregando..." : "Selecione a categoria"} />
           </SelectTrigger>
            <SelectContent className="z-[9999]">
             {mainCategories.map((cat) => (
               <SelectItem key={cat.id} value={cat.name}>
                 {cat.name}
               </SelectItem>
             ))}
           </SelectContent>
         </Select>
       </div>
 
       {/* Subcategory Select - only show if main category has subcategories */}
       {selectedMainCategory?.has_subcategories && availableSubcategories.length > 0 && (
         <div className="space-y-2">
           <Label>Subcategoria</Label>
           <Select 
             value={subcategory} 
             onValueChange={onSubcategoryChange}
           >
             <SelectTrigger>
               <SelectValue placeholder="Selecione a subcategoria" />
             </SelectTrigger>
            <SelectContent className="z-[9999]">
               {availableSubcategories.map((sub) => (
                 <SelectItem key={sub.id} value={sub.name}>
                   {sub.name}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
       )}
 
       {/* Display selected categories */}
       {(mainCategory || isNewRelease) && (
         <div className="flex flex-wrap gap-2 pt-2">
           {isNewRelease && (
             <Badge variant="secondary" className="bg-green-100 text-green-800">
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