import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Save } from "lucide-react";
import { toast } from "sonner";

interface QuickProductRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchTerm: string;
}

export function QuickProductRenameDialog({ open, onOpenChange, searchTerm }: QuickProductRenameDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["quick-rename-products", user?.id, productSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, description")
        .eq("owner_id", user!.id)
        .eq("is_active", true)
        .order("name")
        .limit(20);
      
      if (productSearch.trim()) {
        query = query.ilike("name", `%${productSearch}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!user?.id,
  });

  const updateProduct = useMutation({
    mutationFn: async () => {
      if (!selectedProductId || !newName.trim()) throw new Error("Dados incompletos");
      const { error } = await supabase
        .from("products")
        .update({ name: newName.trim() })
        .eq("id", selectedProductId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-rename-products"] });
      toast.success("Produto renomeado com sucesso!");
      setSelectedProductId(null);
      setNewName("");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const selectProduct = (product: { id: string; name: string }) => {
    setSelectedProductId(product.id);
    // Suggest adding the search term to the product name
    const termLower = searchTerm.toLowerCase();
    const nameLower = product.name.toLowerCase();
    if (!nameLower.includes(termLower)) {
      setNewName(`${product.name} - ${searchTerm}`);
    } else {
      setNewName(product.name);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edição Rápida de Produto</DialogTitle>
          <DialogDescription>
            Adicione o termo "<strong>{searchTerm}</strong>" ao nome de um produto existente para que ele apareça nas buscas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedProductId ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto para editar..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors"
                    >
                      <p className="font-medium truncate">{p.name}</p>
                    </button>
                  ))}
                  {products.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Novo nome do produto</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedProductId(null)}>
                  Voltar
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() => updateProduct.mutate()}
                  disabled={updateProduct.isPending || !newName.trim()}
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
