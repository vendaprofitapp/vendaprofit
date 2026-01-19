import { useState, useMemo } from "react";
import { Package, Filter, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock_quantity: number;
}

interface ProductPartnership {
  id: string;
  product_id: string;
  group_id: string;
}

interface ProductPartnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  products: Product[];
  productPartnerships: ProductPartnership[];
  isAutoShareEnabled?: boolean;
  onToggleAutoShare?: () => void;
  isAutoSharePending?: boolean;
  showAutoShare?: boolean;
}

export function ProductPartnershipDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  products,
  productPartnerships,
  isAutoShareEnabled = false,
  onToggleAutoShare,
  isAutoSharePending = false,
  showAutoShare = false,
}: ProductPartnershipDialogProps) {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))];
    return cats.sort();
  }, [products]);

  // Filter products by category
  const filteredProducts = useMemo(() => {
    if (categoryFilter === "all") return products;
    return products.filter((p) => p.category === categoryFilter);
  }, [products, categoryFilter]);

  // Check if a product is in partnership
  const isProductInPartnership = (productId: string) => {
    return productPartnerships.some(
      (pp) => pp.product_id === productId && pp.group_id === groupId
    );
  };

  // Get count of partnerships for a product
  const getProductPartnershipsCount = (productId: string) => {
    return productPartnerships.filter((pp) => pp.product_id === productId).length;
  };

  // Count products released in current filter
  const releasedCount = filteredProducts.filter((p) =>
    isProductInPartnership(p.id)
  ).length;

  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Toggle single product mutation
  const toggleProductMutation = useMutation({
    mutationFn: async ({
      productId,
      isEnabled,
    }: {
      productId: string;
      isEnabled: boolean;
    }) => {
      if (isEnabled) {
        const { error } = await supabase
          .from("product_partnerships")
          .delete()
          .eq("product_id", productId)
          .eq("group_id", groupId);
        if (error) throw error;
      } else {
        // Use upsert with ignoreDuplicates to avoid UPDATE (no UPDATE policy on this table)
        const { error } = await supabase
          .from("product_partnerships")
          .upsert(
            { product_id: productId, group_id: groupId },
            { onConflict: "product_id,group_id", ignoreDuplicates: true }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"], exact: false });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Release all products mutation (filtered by category)
  const releaseAllMutation = useMutation({
    mutationFn: async () => {
      const productsToRelease = filteredProducts.filter(
        (p) => !isProductInPartnership(p.id)
      );

      if (productsToRelease.length === 0) {
        throw new Error("Todos os produtos já estão liberados");
      }

      const inserts = productsToRelease.map((p) => ({
        product_id: p.id,
        group_id: groupId,
      }));

      const { error } = await supabase
        .from("product_partnerships")
        .upsert(inserts, { onConflict: "product_id,group_id", ignoreDuplicates: true });

      if (error) throw error;
      return productsToRelease.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"], exact: false });
      toast({
        title: "Produtos liberados!",
        description: `${count} produto${count !== 1 ? "s" : ""} liberado${count !== 1 ? "s" : ""} com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao liberar produtos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Release by category mutation
  const releaseByCategoryMutation = useMutation({
    mutationFn: async (category: string) => {
      const productsInCategory = products.filter(
        (p) => p.category === category && !isProductInPartnership(p.id)
      );

      if (productsInCategory.length === 0) {
        throw new Error("Todos os produtos desta categoria já estão liberados");
      }

      const inserts = productsInCategory.map((p) => ({
        product_id: p.id,
        group_id: groupId,
      }));

      const { error } = await supabase
        .from("product_partnerships")
        .upsert(inserts, { onConflict: "product_id,group_id", ignoreDuplicates: true });

      if (error) throw error;
      return { count: productsInCategory.length, category };
    },
    onSuccess: ({ count, category }) => {
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"], exact: false });
      toast({
        title: "Categoria liberada!",
        description: `${count} produto${count !== 1 ? "s" : ""} de "${category}" liberado${count !== 1 ? "s" : ""}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao liberar categoria",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLoading =
    toggleProductMutation.isPending ||
    releaseAllMutation.isPending ||
    releaseByCategoryMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Produtos Liberados - {groupName}</DialogTitle>
          <DialogDescription>
            Selecione quais produtos você quer liberar para esta parceria.
          </DialogDescription>
        </DialogHeader>

        {/* Auto-share toggle (optional) */}
        {showAutoShare && onToggleAutoShare && (
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div>
              <p className="font-medium text-sm">
                Liberar todos os produtos automaticamente
              </p>
              <p className="text-xs text-muted-foreground">
                Inclui produtos atuais e futuros cadastrados
              </p>
            </div>
            <Button
              variant={isAutoShareEnabled ? "default" : "outline"}
              size="sm"
              onClick={onToggleAutoShare}
              disabled={isAutoSharePending}
            >
              {isAutoShareEnabled ? "Ativado" : "Ativar"}
            </Button>
          </div>
        )}

        {/* Filters and Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-3 py-2">
          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {categoryFilter !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => releaseByCategoryMutation.mutate(categoryFilter)}
                disabled={isLoading}
                className="whitespace-nowrap"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Liberar "{categoryFilter}"
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => releaseAllMutation.mutate()}
              disabled={isLoading}
              className="whitespace-nowrap"
            >
              <Package className="h-4 w-4 mr-2" />
              {categoryFilter === "all"
                ? "Liberar Todos"
                : `Liberar ${filteredProducts.length} Produtos`}
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-2">
          <span>
            {releasedCount} de {filteredProducts.length} produto
            {filteredProducts.length !== 1 ? "s" : ""} liberado
            {releasedCount !== 1 ? "s" : ""}
          </span>
          {categoryFilter !== "all" && (
            <Badge variant="secondary" className="text-xs">
              Filtro: {categoryFilter}
            </Badge>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Você ainda não tem produtos cadastrados.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum produto encontrado na categoria "{categoryFilter}".
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">Liberar</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const isEnabled = isProductInPartnership(product.id);
                  const partnershipsCount = getProductPartnershipsCount(product.id);

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={() => {
                            toggleProductMutation.mutate({
                              productId: product.id,
                              isEnabled,
                            });
                          }}
                          disabled={isLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {partnershipsCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Em {partnershipsCount} parceria
                              {partnershipsCount !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.stock_quantity}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
