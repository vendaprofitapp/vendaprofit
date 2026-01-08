import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  winnerId: string;
  participantName: string;
  consortiumValue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConsortiumItem {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

export function ConsortiumItemsDialog({ winnerId, participantName, consortiumValue, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [manualProduct, setManualProduct] = useState({ name: "", price: "", quantity: "1" });

  // Buscar itens já cadastrados
  const { data: items = [] } = useQuery({
    queryKey: ["consortium-items", winnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_items")
        .select("*")
        .eq("winner_id", winnerId)
        .order("created_at");
      if (error) throw error;
      return data as ConsortiumItem[];
    },
    enabled: open,
  });

  // Buscar produtos disponíveis
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-consortium"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: open,
  });

  const totalUsed = items.reduce((sum, item) => sum + Number(item.total), 0);
  const remaining = Number(consortiumValue) - totalUsed;

  // Adicionar item do catálogo
  const addFromCatalogMutation = useMutation({
    mutationFn: async () => {
      const product = products.find((p) => p.id === selectedProductId);
      if (!product) throw new Error("Produto não encontrado");

      const { error } = await supabase.from("consortium_items").insert({
        winner_id: winnerId,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        total: product.price,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-items", winnerId] });
      setSelectedProductId("");
      toast.success("Produto adicionado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Adicionar item manual
  const addManualMutation = useMutation({
    mutationFn: async () => {
      const quantity = parseInt(manualProduct.quantity) || 1;
      const unitPrice = parseFloat(manualProduct.price) || 0;

      const { error } = await supabase.from("consortium_items").insert({
        winner_id: winnerId,
        product_id: null,
        product_name: manualProduct.name,
        quantity,
        unit_price: unitPrice,
        total: quantity * unitPrice,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-items", winnerId] });
      setManualProduct({ name: "", price: "", quantity: "1" });
      toast.success("Item adicionado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Remover item
  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consortium_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-items", winnerId] });
      toast.success("Item removido!");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Peças de {participantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold text-primary">R$ {Number(consortiumValue).toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Utilizado</p>
              <p className="text-lg font-bold">R$ {totalUsed.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Restante</p>
              <p className={`text-lg font-bold ${remaining < 0 ? "text-destructive" : "text-green-500"}`}>
                R$ {remaining.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Adicionar do catálogo */}
          <div className="space-y-2">
            <Label>Adicionar do Catálogo</Label>
            <div className="flex gap-2">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - R$ {Number(p.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => addFromCatalogMutation.mutate()} disabled={!selectedProductId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Adicionar manual */}
          <div className="space-y-2">
            <Label>Adicionar Item Manual</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do produto"
                value={manualProduct.name}
                onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="Preço"
                type="number"
                value={manualProduct.price}
                onChange={(e) => setManualProduct({ ...manualProduct, price: e.target.value })}
                className="w-24"
              />
              <Input
                placeholder="Qtd"
                type="number"
                value={manualProduct.quantity}
                onChange={(e) => setManualProduct({ ...manualProduct, quantity: e.target.value })}
                className="w-16"
              />
              <Button
                onClick={() => addManualMutation.mutate()}
                disabled={!manualProduct.name || !manualProduct.price}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de itens */}
          <div>
            <Label className="mb-2 block">Itens Cadastrados</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor Un.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      Nenhum item cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">R$ {Number(item.unit_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">R$ {Number(item.total).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItemMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
