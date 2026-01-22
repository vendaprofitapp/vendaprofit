import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Tag, Search, Users, Merge } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  owner_id: string;
  owner_email?: string;
  product_count?: number;
}

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeDestination, setMergeDestination] = useState("");
  const [merging, setMerging] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      setIsAdmin(!!data);
    }
    checkAdmin();
  }, [user]);

  const fetchCategories = async () => {
    setLoading(true);
    
    // Fetch all categories with owner info
    const { data: categoriesData, error: catError } = await supabase
      .from("categories")
      .select("id, name, owner_id")
      .order("name");

    if (catError) {
      console.error("Error fetching categories:", catError);
      toast.error("Erro ao carregar categorias");
      setLoading(false);
      return;
    }

    // Fetch owner emails
    const ownerIds = [...new Set(categoriesData?.map(c => c.owner_id) || [])];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", ownerIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

    // Count products per category
    const { data: products } = await supabase
      .from("products")
      .select("category, category_2, category_3");

    const categoryCountMap = new Map<string, number>();
    products?.forEach(p => {
      [p.category, p.category_2, p.category_3].forEach(cat => {
        if (cat) {
          categoryCountMap.set(cat, (categoryCountMap.get(cat) || 0) + 1);
        }
      });
    });

    // Find orphan categories (used in products but not in categories table)
    const registeredNames = new Set(categoriesData?.map(c => c.name) || []);
    const orphanCategories: Category[] = [];
    
    categoryCountMap.forEach((count, name) => {
      if (!registeredNames.has(name)) {
        orphanCategories.push({
          id: `orphan-${name}`,
          name,
          owner_id: "",
          owner_email: "Não cadastrada",
          product_count: count,
        });
      }
    });

    const enrichedCategories: Category[] = (categoriesData || []).map(c => ({
      ...c,
      owner_email: profileMap.get(c.owner_id) || "Desconhecido",
      product_count: categoryCountMap.get(c.name) || 0,
    }));

    // Combine registered and orphan categories
    setCategories([...enrichedCategories, ...orphanCategories]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchCategories();
  }, [user?.id]);

  const handleSaveCategory = async () => {
    if (!user || !categoryName.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }

    setSaving(true);

    try {
      if (editCategory) {
        const oldName = editCategory.name;
        const newName = categoryName.trim();

        if (editCategory.id.startsWith("orphan-")) {
          // Create a new category with the new name
          const { error } = await supabase
            .from("categories")
            .insert({ name: newName, owner_id: user.id });

          if (error) {
            toast.error("Erro ao cadastrar categoria");
            setSaving(false);
            return;
          }

          // Update all products that use the old name using the SECURITY DEFINER function
          if (oldName !== newName) {
            await (supabase.rpc as any)("rename_category_in_products", {
              old_name: oldName,
              new_name: newName,
            });
          }

          toast.success("Categoria cadastrada e produtos atualizados!");
        } else {
          // Update existing category
          const { error } = await supabase
            .from("categories")
            .update({ name: newName })
            .eq("id", editCategory.id);

          if (error) {
            toast.error("Erro ao atualizar categoria");
            setSaving(false);
            return;
          }

          // Update products with the old category name using SECURITY DEFINER function
          if (oldName !== newName) {
            await (supabase.rpc as any)("rename_category_in_products", {
              old_name: oldName,
              new_name: newName,
            });
          }

          toast.success("Categoria atualizada!");
        }
      } else {
        // Create new category
        const { error } = await supabase
          .from("categories")
          .insert({ name: categoryName.trim(), owner_id: user.id });

        if (error) {
          if (error.code === "23505") {
            toast.error("Esta categoria já existe");
          } else {
            toast.error("Erro ao criar categoria");
          }
          setSaving(false);
          return;
        }
        toast.success("Categoria criada!");
      }

      setCategoryName("");
      setEditCategory(null);
      setDialogOpen(false);
      fetchCategories();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar categoria");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (category.id.startsWith("orphan-")) {
      toast.error("Esta categoria precisa ser cadastrada primeiro");
      return;
    }

    if ((category.product_count || 0) > 0) {
      if (!window.confirm(
        `A categoria "${category.name}" está sendo usada em ${category.product_count} produto(s). Deseja excluir mesmo assim? A categoria será removida dos produtos.`
      )) {
        return;
      }
    } else {
      if (!window.confirm(`Excluir categoria "${category.name}"?`)) return;
    }

    // Check if user owns this category or is admin
    if (category.owner_id !== user?.id && !isAdmin) {
      toast.error("Você só pode excluir categorias que você criou");
      return;
    }

    const categoryName = category.name;

    // Clear category references from all products before deleting using SECURITY DEFINER function
    await (supabase.rpc as any)("clear_category_from_products", {
      category_name: categoryName,
    });

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (error) {
      console.error("Delete error:", error);
      if (error.code === "42501" || error.message?.includes("policy")) {
        toast.error("Você não tem permissão para excluir esta categoria");
      } else {
        toast.error("Erro ao excluir categoria");
      }
      return;
    }

    toast.success("Categoria excluída e removida dos produtos!");
    fetchCategories();
  };

  const openEditDialog = (category: Category) => {
    setEditCategory(category);
    setCategoryName(category.name);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditCategory(null);
    setCategoryName("");
    setDialogOpen(true);
  };

  const handleMergeCategories = async () => {
    if (!mergeSource || !mergeDestination) {
      toast.error("Selecione as categorias de origem e destino");
      return;
    }

    if (mergeSource === mergeDestination) {
      toast.error("As categorias de origem e destino devem ser diferentes");
      return;
    }

    const sourceCategory = categories.find(c => c.name === mergeSource);
    if (!window.confirm(
      `Mesclar "${mergeSource}" em "${mergeDestination}"?\n\n${sourceCategory?.product_count || 0} produto(s) serão movidos para "${mergeDestination}" e a categoria "${mergeSource}" será excluída.`
    )) {
      return;
    }

    setMerging(true);
    try {
      // Transfer all products from source to destination
      await (supabase.rpc as any)("merge_categories", {
        source_name: mergeSource,
        destination_name: mergeDestination,
      });

      // Delete the source category if it's registered
      if (sourceCategory && !sourceCategory.id.startsWith("orphan-")) {
        await supabase
          .from("categories")
          .delete()
          .eq("id", sourceCategory.id);
      }

      toast.success(`Categoria "${mergeSource}" mesclada com "${mergeDestination}"!`);
      setMergeDialogOpen(false);
      setMergeSource("");
      setMergeDestination("");
      fetchCategories();
    } catch (err) {
      console.error("Merge error:", err);
      toast.error("Erro ao mesclar categorias");
    } finally {
      setMerging(false);
    }
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const registeredCount = categories.filter(c => !c.id.startsWith("orphan-")).length;
  const orphanCount = categories.filter(c => c.id.startsWith("orphan-")).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
            <p className="text-muted-foreground">
              Gerencie as categorias de produtos do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setMergeDialogOpen(true)} 
              className="gap-2"
              disabled={categories.length < 2}
            >
              <Merge className="h-4 w-4" />
              Mesclar
            </Button>
            <Button onClick={openNewDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categorias Cadastradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{registeredCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categorias Órfãs
              </CardTitle>
              <CardDescription className="text-xs">
                Usadas em produtos mas não cadastradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{orphanCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Categorias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar categorias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Categories Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Criada por</TableHead>
                  <TableHead className="text-center">Produtos</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary" />
                          {category.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {category.owner_email}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {category.product_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {category.id.startsWith("orphan-") ? (
                          <Badge variant="outline" className="text-amber-500 border-amber-500">
                            Não cadastrada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-500 border-green-500">
                            Cadastrada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(category)}
                            title={category.id.startsWith("orphan-") ? "Cadastrar categoria" : "Editar"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!category.id.startsWith("orphan-") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteCategory(category)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit/Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditCategory(null);
            setCategoryName("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editCategory 
                  ? editCategory.id.startsWith("orphan-") 
                    ? "Cadastrar Categoria" 
                    : "Editar Categoria"
                  : "Nova Categoria"
                }
              </DialogTitle>
              <DialogDescription>
                {editCategory?.id.startsWith("orphan-")
                  ? "Esta categoria está sendo usada em produtos mas não foi cadastrada formalmente. Cadastre-a agora."
                  : editCategory
                    ? "Altere o nome da categoria. Os produtos serão atualizados automaticamente."
                    : "Digite o nome da nova categoria"
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da categoria</label>
                <Input
                  placeholder="Ex: Camisetas"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !saving && handleSaveCategory()}
                  autoFocus
                />
              </div>
              
              {editCategory && (editCategory.product_count || 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  ⚠️ Esta categoria está sendo usada em {editCategory.product_count} produto(s).
                  Ao renomear, todos os produtos serão atualizados.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveCategory} disabled={saving || !categoryName.trim()}>
                {saving ? "Salvando..." : editCategory ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Merge Categories Dialog */}
        <Dialog open={mergeDialogOpen} onOpenChange={(open) => {
          setMergeDialogOpen(open);
          if (!open) {
            setMergeSource("");
            setMergeDestination("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mesclar Categorias</DialogTitle>
              <DialogDescription>
                Transfira todos os produtos de uma categoria para outra. A categoria de origem será excluída.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria de origem (será excluída)</label>
                <Select value={mergeSource} onValueChange={setMergeSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter(c => c.name !== mergeDestination)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          <span className="flex items-center gap-2">
                            {c.name} ({c.product_count || 0} produtos)
                            {c.id.startsWith("orphan-") && (
                              <span className="text-xs text-amber-500">(não cadastrada)</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria de destino (receberá os produtos)</label>
                <Select value={mergeDestination} onValueChange={setMergeDestination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter(c => c.name !== mergeSource && !c.id.startsWith("orphan-"))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name} ({c.product_count || 0} produtos)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {mergeSource && mergeDestination && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  ⚠️ Esta ação é irreversível. Todos os produtos de "{mergeSource}" serão movidos para "{mergeDestination}" e a categoria de origem será excluída.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleMergeCategories} 
                disabled={merging || !mergeSource || !mergeDestination}
                variant="destructive"
              >
                {merging ? "Mesclando..." : "Mesclar Categorias"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
