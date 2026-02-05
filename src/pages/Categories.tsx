import { useState, useEffect } from "react";
import { Plus, Edit, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MainCategory {
  id: string;
  name: string;
  display_order: number;
  has_subcategories: boolean;
  is_active: boolean;
}

interface Subcategory {
  id: string;
  main_category_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export default function Categories() {
  const { user } = useAuth();
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editMainCategory, setEditMainCategory] = useState<MainCategory | null>(null);
  const [editSubcategory, setEditSubcategory] = useState<Subcategory | null>(null);
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formHasSubs, setFormHasSubs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

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

  const fetchData = async () => {
    setLoading(true);
    const [mainRes, subRes] = await Promise.all([
      supabase.from("main_categories").select("*").order("display_order"),
      supabase.from("subcategories").select("*").order("display_order"),
    ]);

    if (!mainRes.error) setMainCategories(mainRes.data || []);
    if (!subRes.error) setSubcategories(subRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveMainCategory = async () => {
    if (!formName.trim()) {
      toast.error("Digite o nome");
      return;
    }
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar categorias");
      return;
    }
    setSaving(true);
    try {
      if (editMainCategory) {
        const { error } = await supabase
          .from("main_categories")
          .update({ name: formName.trim(), has_subcategories: formHasSubs })
          .eq("id", editMainCategory.id);
        if (error) throw error;
        toast.success("Categoria atualizada");
      } else {
        const maxOrder = Math.max(0, ...mainCategories.map(c => c.display_order));
        const { error } = await supabase
          .from("main_categories")
          .insert({ name: formName.trim(), has_subcategories: formHasSubs, display_order: maxOrder + 1 });
        if (error) throw error;
        toast.success("Categoria criada");
      }
      setFormName("");
      setFormHasSubs(false);
      setEditMainCategory(null);
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSubcategory = async () => {
    if (!formName.trim() || !selectedMainCategoryId) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar subcategorias");
      return;
    }
    setSaving(true);
    try {
      if (editSubcategory) {
        const { error } = await supabase
          .from("subcategories")
          .update({ name: formName.trim() })
          .eq("id", editSubcategory.id);
        if (error) throw error;
        toast.success("Subcategoria atualizada");
      } else {
        const existingSubs = subcategories.filter(s => s.main_category_id === selectedMainCategoryId);
        const maxOrder = existingSubs.length > 0 ? Math.max(...existingSubs.map(s => s.display_order)) : 0;
        const { error } = await supabase
          .from("subcategories")
          .insert({ name: formName.trim(), main_category_id: selectedMainCategoryId, display_order: maxOrder + 1 });
        if (error) throw error;
        toast.success("Subcategoria criada");
      }
      setFormName("");
      setEditSubcategory(null);
      setSubDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSubcategoriesFor = (mainId: string) => subcategories.filter(s => s.main_category_id === mainId);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
            <p className="text-muted-foreground">
              Categorias fixas do sistema (somente admin pode editar)
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setEditMainCategory(null); setFormName(""); setFormHasSubs(false); setDialogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          )}
        </div>

        {!isAdmin && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4">
              <p className="text-amber-800 text-sm">
                ⚠️ Apenas administradores podem adicionar ou editar categorias.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
              </div>
            ) : (
              <div className="divide-y">
                {mainCategories.map((cat) => {
                  const subs = getSubcategoriesFor(cat.id);
                  const isExpanded = expandedCategories.has(cat.id);
                  
                  return (
                    <Collapsible key={cat.id} open={isExpanded} onOpenChange={() => toggleExpand(cat.id)}>
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 cursor-pointer flex-1">
                            {cat.has_subcategories ? (
                              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                            ) : (
                              <div className="w-4" />
                            )}
                            <Tag className="h-4 w-4 text-primary" />
                            <span className="font-medium">{cat.name}</span>
                            {cat.has_subcategories && (
                              <Badge variant="secondary" className="text-xs">{subs.length} sub</Badge>
                            )}
                            {!cat.is_active && <Badge variant="outline">Inativa</Badge>}
                          </div>
                        </CollapsibleTrigger>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => { setEditMainCategory(cat); setFormName(cat.name); setFormHasSubs(cat.has_subcategories); setDialogOpen(true); }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {cat.has_subcategories && (
                        <CollapsibleContent>
                          <div className="pl-12 pb-4 space-y-2">
                            {subs.map((sub) => (
                              <div key={sub.id} className="flex items-center justify-between py-1 px-3 rounded bg-muted/30">
                                <span className="text-sm">{sub.name}</span>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => { setEditSubcategory(sub); setFormName(sub.name); setSelectedMainCategoryId(cat.id); setSubDialogOpen(true); }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => { setEditSubcategory(null); setFormName(""); setSelectedMainCategoryId(cat.id); setSubDialogOpen(true); }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Adicionar Subcategoria
                              </Button>
                            )}
                          </div>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditMainCategory(null);
            setFormName("");
            setFormHasSubs(false);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editMainCategory ? "Editar Categoria" : "Nova Categoria Principal"}
              </DialogTitle>
              <DialogDescription>
                Categorias principais são fixas para todos os usuários
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da categoria</Label>
                <Input
                  placeholder="Ex: Feminino"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_subs"
                  checked={formHasSubs}
                  onCheckedChange={(checked) => setFormHasSubs(checked === true)}
                />
                <Label htmlFor="has_subs">Possui subcategorias</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveMainCategory} disabled={saving || !formName.trim()}>
                {saving ? "Salvando..." : editMainCategory ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={subDialogOpen} onOpenChange={(open) => {
          setSubDialogOpen(open);
          if (!open) {
            setEditSubcategory(null);
            setFormName("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editSubcategory ? "Editar Subcategoria" : "Nova Subcategoria"}
              </DialogTitle>
              <DialogDescription>
                Subcategorias ajudam a organizar produtos dentro de uma categoria principal
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da subcategoria</Label>
                <Input
                  placeholder="Ex: Shorts"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSubcategory} disabled={saving || !formName.trim()}>
                {saving ? "Salvando..." : editSubcategory ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}