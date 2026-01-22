import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, AlertTriangle, ShoppingCart, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  winnerId: string;
  participantName: string;
  consortiumValue: number;
  participantBalance?: number;
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
  notes: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
}

export function ConsortiumItemsDialog({ 
  winnerId, 
  participantName, 
  consortiumValue, 
  participantBalance = 0,
  open, 
  onOpenChange 
}: Props) {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [manualProduct, setManualProduct] = useState({ name: "", price: "", quantity: "1" });
  const [isOnOrder, setIsOnOrder] = useState(false);

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
        .select("id, name, price, stock_quantity")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: open,
  });

  // Calcular valores
  const totalUsed = items.reduce((sum, item) => sum + Number(item.total), 0);
  const creditAvailable = Number(consortiumValue) + participantBalance;
  const remaining = creditAvailable - totalUsed;
  const hasDebt = remaining < 0;

  // Adicionar item do catálogo
  const addFromCatalogMutation = useMutation({
    mutationFn: async () => {
      const product = products.find((p) => p.id === selectedProductId);
      if (!product) throw new Error("Produto não encontrado");

      const outOfStock = product.stock_quantity <= 0;
      
      const { error } = await supabase.from("consortium_items").insert({
        winner_id: winnerId,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        total: product.price,
        notes: outOfStock ? "Pedido sob encomenda" : null,
      });
      if (error) throw error;

      // Se tiver estoque, baixar do estoque
      if (!outOfStock) {
        await supabase
          .from("products")
          .update({ stock_quantity: product.stock_quantity - 1 })
          .eq("id", product.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-items", winnerId] });
      queryClient.invalidateQueries({ queryKey: ["products-for-consortium"] });
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
        notes: isOnOrder ? "Pedido sob encomenda" : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-items", winnerId] });
      setManualProduct({ name: "", price: "", quantity: "1" });
      setIsOnOrder(false);
      toast.success("Item adicionado!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Remover item
  const removeItemMutation = useMutation({
    mutationFn: async (item: ConsortiumItem) => {
      const { error } = await supabase.from("consortium_items").delete().eq("id", item.id);
      if (error) throw error;

      // Se tinha produto vinculado e não era encomenda, devolver ao estoque
      if (item.product_id && !item.notes?.includes("encomenda")) {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          await supabase
            .from("products")
            .update({ stock_quantity: product.stock_quantity + item.quantity })
            .eq("id", item.product_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-items", winnerId] });
      queryClient.invalidateQueries({ queryKey: ["products-for-consortium"] });
      toast.success("Item removido!");
    },
  });

  // Abrir WhatsApp para cobrar diferença
  const handlePayDifference = () => {
    const message = encodeURIComponent(
      `Olá ${participantName}! 😊\n\nSuas peças do consórcio foram selecionadas e o valor total ficou R$ ${Math.abs(remaining).toFixed(2)} acima do seu crédito.\n\nPodemos acertar essa diferença?`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  // Verificar se um produto está sem estoque
  const getProductStock = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.stock_quantity || 0;
  };

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Crédito Total</p>
                <p className="text-lg font-bold text-primary">R$ {creditAvailable.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Utilizado</p>
                <p className="text-lg font-bold">R$ {totalUsed.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className={`${hasDebt ? "bg-destructive/10" : "bg-green-500/10"}`}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  {hasDebt ? "Débito" : "Restante"}
                </p>
                <p className={`text-lg font-bold ${hasDebt ? "text-destructive" : "text-green-500"}`}>
                  R$ {Math.abs(remaining).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            {participantBalance > 0 && (
              <Card className="bg-primary/10">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Bônus Desistência</p>
                  <p className="text-lg font-bold text-primary">R$ {participantBalance.toFixed(2)}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Alerta de débito com botão de cobrança */}
          {hasDebt && (
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Valor excede o crédito</p>
                    <p className="text-sm text-muted-foreground">
                      Cliente deve pagar R$ {Math.abs(remaining).toFixed(2)} de diferença
                    </p>
                  </div>
                </div>
                <Button onClick={handlePayDifference} variant="destructive" size="sm" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Cobrar Diferença
                </Button>
              </CardContent>
            </Card>
          )}

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
                      <div className="flex items-center gap-2">
                        {p.name} - R$ {Number(p.price).toFixed(2)}
                        {p.stock_quantity <= 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Encomenda
                          </Badge>
                        )}
                      </div>
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
            <div className="flex flex-col sm:flex-row gap-2">
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
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={isOnOrder}
                  onChange={(e) => setIsOnOrder(e.target.checked)}
                />
                Encomenda
              </label>
              <Button
                onClick={() => addManualMutation.mutate()}
                disabled={!manualProduct.name || !manualProduct.price}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de itens - Mobile Cards */}
          <div className="block sm:hidden space-y-2">
            <Label className="mb-2 block">Itens Cadastrados ({items.length})</Label>
            {items.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="p-4 text-center text-muted-foreground">
                  Nenhum item cadastrado
                </CardContent>
              </Card>
            ) : (
              items.map((item) => (
                <Card key={item.id} className="bg-card">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.product_name}</p>
                          {item.notes?.includes("encomenda") && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Encomenda
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x R$ {Number(item.unit_price).toFixed(2)}
                        </p>
                        <p className="text-sm font-medium">
                          Total: R$ {Number(item.total).toFixed(2)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItemMutation.mutate(item)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Lista de itens - Desktop Table */}
          <div className="hidden sm:block">
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.product_name}</span>
                          {item.notes?.includes("encomenda") && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Encomenda
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">R$ {Number(item.unit_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">R$ {Number(item.total).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItemMutation.mutate(item)}
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
