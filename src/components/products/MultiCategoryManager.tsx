import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Category {
  id: string;
  name: string;
  owner_id: string;
}

interface MultiCategoryManagerProps {
  values: string[];
  onChange: (values: string[]) => void;
  onCategoriesChange?: (categories: Category[]) => void;
  maxCategories?: number;
}

export function MultiCategoryManager({ 
  values, 
  onChange, 
  onCategoriesChange,
  maxCategories = 3 
}: MultiCategoryManagerProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const fetchCategories = async () => {
    if (!user) return;
    
    // Fetch all categories globally so all users see the same list
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, owner_id")
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
      setCategories([]);
    } else {
      setCategories(data ?? []);
      onCategoriesChange?.(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSaveCategory = async () => {
    if (!user || !categoryName.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }

    if (editCategory) {
      const { error } = await supabase
        .from("categories")
        .update({ name: categoryName.trim() })
        .eq("id", editCategory.id);

      if (error) {
        toast.error("Erro ao atualizar categoria");
        return;
      }
      
      // Update values if the category name changed
      const oldName = editCategory.name;
      const newName = categoryName.trim();
      if (values.includes(oldName)) {
        onChange(values.map(v => v === oldName ? newName : v));
      }
      
      toast.success("Categoria atualizada!");
    } else {
      const { error } = await supabase
        .from("categories")
        .insert({ name: categoryName.trim(), owner_id: user.id });

      if (error) {
        toast.error("Erro ao criar categoria");
        return;
      }
      toast.success("Categoria criada!");
    }

    setCategoryName("");
    setEditCategory(null);
    fetchCategories();
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`Excluir categoria "${category.name}"?`)) return;

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (error) {
      toast.error("Erro ao excluir categoria");
      return;
    }

    toast.success("Categoria excluída!");
    // Remove from values if selected
    if (values.includes(category.name)) {
      onChange(values.filter(v => v !== category.name));
    }
    fetchCategories();
  };

  const openEditCategory = (category: Category) => {
    setEditCategory(category);
    setCategoryName(category.name);
  };

  const resetCategoryForm = () => {
    setEditCategory(null);
    setCategoryName("");
  };

  const addCategory = (categoryName: string) => {
    if (!categoryName || values.includes(categoryName)) return;
    if (values.length >= maxCategories) {
      toast.error(`Máximo de ${maxCategories} categorias permitido`);
      return;
    }
    onChange([...values, categoryName]);
  };

  const removeCategory = (categoryName: string) => {
    onChange(values.filter(v => v !== categoryName));
  };

  const availableCategories = categories.filter(c => !values.includes(c.name));

  return (
    <div className="space-y-2">
      {/* Selected categories as badges */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((cat, index) => (
            <Badge 
              key={`${cat}-${index}`} 
              variant={index === 0 ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              {cat}
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="ml-1 hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      {/* Category selector and manage button */}
      <div className="flex gap-2">
        <Select 
          value="" 
          onValueChange={addCategory}
          disabled={values.length >= maxCategories}
        >
          <SelectTrigger className="flex-1">
            <SelectValue 
              placeholder={
                loading 
                  ? "Carregando..." 
                  : values.length >= maxCategories 
                    ? `Máximo de ${maxCategories} categorias` 
                    : values.length === 0 
                      ? "Selecione categorias" 
                      : "Adicionar categoria"
              } 
            />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((c) => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
            {availableCategories.length === 0 && !loading && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {categories.length === 0 ? "Nenhuma categoria" : "Todas selecionadas"}
              </div>
            )}
          </SelectContent>
        </Select>

        <Dialog open={manageOpen} onOpenChange={(open) => {
          setManageOpen(open);
          if (!open) resetCategoryForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" type="button">
              <Tag className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar Categorias</DialogTitle>
              <DialogDescription>
                Adicione, edite ou remova categorias de produtos
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da categoria"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveCategory()}
                />
                <Button onClick={handleSaveCategory}>
                  {editCategory ? "Salvar" : <Plus className="h-4 w-4" />}
                </Button>
                {editCategory && (
                  <Button variant="outline" onClick={resetCategoryForm}>
                    Cancelar
                  </Button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                  >
                    <span className="text-sm font-medium">{category.name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditCategory(category)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDeleteCategory(category)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma categoria cadastrada
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setManageOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        {values.length}/{maxCategories} categorias selecionadas
      </p>
    </div>
  );
}
