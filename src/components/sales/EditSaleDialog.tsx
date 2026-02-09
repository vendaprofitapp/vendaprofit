import { useState, useEffect } from "react";
import { Trash2, Edit2, AlertTriangle, Package, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sale {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface CustomPaymentMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
  is_active: boolean;
}

interface EditSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  saleItems: SaleItem[];
  customPaymentMethods: CustomPaymentMethod[];
  userId: string;
}

export function EditSaleDialog({
  open,
  onOpenChange,
  sale,
  saleItems,
  customPaymentMethods,
  userId,
}: EditSaleDialogProps) {
  const queryClient = useQueryClient();
  
  // Edit form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("completed");
  
  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItemsToDelete, setSelectedItemsToDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"all" | "partial">("all");

  // Initialize form with sale data
  useEffect(() => {
    if (sale) {
      setCustomerName(sale.customer_name || "");
      setCustomerPhone(sale.customer_phone || "");
      setPaymentMethod(sale.payment_method);
      setDiscountType(sale.discount_type || "fixed");
      setDiscountValue(sale.discount_value || 0);
      setNotes(sale.notes || "");
      setStatus(sale.status);
      setSelectedItemsToDelete([]);
      setDeleteMode("all");
    }
  }, [sale]);

  const handleSave = async () => {
    if (!sale) return;
    setIsSaving(true);

    try {
      // Recalculate totals
      const subtotal = saleItems.reduce((sum, item) => sum + Number(item.total), 0);
      const discountAmount = discountType === "percentage" 
        ? (subtotal * discountValue) / 100 
        : discountValue;
      const total = Math.max(0, subtotal - discountAmount);

      const { error } = await supabase
        .from("sales")
        .update({
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method: paymentMethod,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: discountAmount,
          total,
          notes: notes || null,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sale.id);

      if (error) throw error;

      // Update payment reminders if exists
      await supabase
        .from("payment_reminders")
        .update({
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          amount: total,
          payment_method_name: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .eq("sale_id", sale.id);

      toast({ title: "Venda atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["financial-splits"] });
      queryClient.invalidateQueries({ queryKey: ["payment-reminders"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Erro ao atualizar venda", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const returnItemToStock = async (item: SaleItem) => {
    // Check if product still exists and belongs to user
    const { data: product } = await supabase
      .from("products")
      .select("id, stock_quantity, owner_id")
      .eq("id", item.product_id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (product) {
      // Check if it's a variant by looking for variant info in product_name
      const variantMatch = item.product_name.match(/\(([^)]+)\)/);
      
      if (variantMatch) {
        // Try to find the variant
        const variantInfo = variantMatch[1];
        const parts = variantInfo.split(' - ');
        
        const { data: variants } = await supabase
          .from("product_variants")
          .select("id, stock_quantity, size")
          .eq("product_id", item.product_id);

        if (variants) {
          // Find matching variant by size
          const matchingVariant = variants.find(v => {
            return parts.some(p => v.size === p);
          });

          if (matchingVariant) {
            // Update variant stock
            await supabase
              .from("product_variants")
              .update({ stock_quantity: matchingVariant.stock_quantity + item.quantity })
              .eq("id", matchingVariant.id);
          }
        }
      }

      // Always update product total stock
      await supabase
        .from("products")
        .update({ stock_quantity: product.stock_quantity + item.quantity })
        .eq("id", item.product_id);
    }
  };

  const handleDelete = async () => {
    if (!sale) return;
    setIsDeleting(true);

    try {
      const itemsToDelete = deleteMode === "all" 
        ? saleItems 
        : saleItems.filter(item => selectedItemsToDelete.includes(item.id));

      if (itemsToDelete.length === 0) {
        toast({ title: "Selecione pelo menos um item para excluir", variant: "destructive" });
        setIsDeleting(false);
        return;
      }

      // Return items to stock
      for (const item of itemsToDelete) {
        // Check if it's partner stock (has [Parceiro: ...] in name)
        const isPartnerStock = item.product_name.includes("[Parceiro:");
        
        if (!isPartnerStock) {
          await returnItemToStock(item);
        }
      }

      // Delete financial splits for this sale
      await supabase
        .from("financial_splits")
        .delete()
        .eq("sale_id", sale.id);

      if (deleteMode === "all" || itemsToDelete.length === saleItems.length) {
        // Delete entire sale
        await supabase
          .from("payment_reminders")
          .delete()
          .eq("sale_id", sale.id);

        await supabase
          .from("sale_items")
          .delete()
          .eq("sale_id", sale.id);

        await supabase
          .from("sales")
          .delete()
          .eq("id", sale.id);

        toast({ title: "Venda excluída e estoque restaurado!" });
      } else {
        // Partial delete - only selected items
        for (const item of itemsToDelete) {
          await supabase
            .from("sale_items")
            .delete()
            .eq("id", item.id);
        }

        // Recalculate sale totals
        const remainingItems = saleItems.filter(
          item => !selectedItemsToDelete.includes(item.id)
        );
        const newSubtotal = remainingItems.reduce((sum, item) => sum + Number(item.total), 0);
        const discountAmount = discountType === "percentage"
          ? (newSubtotal * discountValue) / 100
          : Math.min(discountValue, newSubtotal);
        const newTotal = Math.max(0, newSubtotal - discountAmount);

        await supabase
          .from("sales")
          .update({
            subtotal: newSubtotal,
            discount_amount: discountAmount,
            total: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sale.id);

        // Update payment reminder if exists
        await supabase
          .from("payment_reminders")
          .update({ amount: newTotal })
          .eq("sale_id", sale.id);

        toast({ 
          title: "Itens excluídos e estoque restaurado!",
          description: `${itemsToDelete.length} item(s) removido(s) da venda.`
        });
      }

      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["own-products-for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["product-variants"] });
      queryClient.invalidateQueries({ queryKey: ["financial-splits"] });
      queryClient.invalidateQueries({ queryKey: ["payment-reminders"] });
      
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Erro ao excluir", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemsToDelete(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAllItems = () => {
    if (selectedItemsToDelete.length === saleItems.length) {
      setSelectedItemsToDelete([]);
    } else {
      setSelectedItemsToDelete(saleItems.map(item => item.id));
    }
  };

  if (!sale) return null;

  const subtotal = saleItems.reduce((sum, item) => sum + Number(item.total), 0);
  const calculatedDiscount = discountType === "percentage" 
    ? (subtotal * discountValue) / 100 
    : discountValue;
  const total = Math.max(0, subtotal - calculatedDiscount);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Venda
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Sale Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">ID da Venda</p>
                <p className="font-mono font-medium">{sale.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium">
                  {new Date(sale.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            {/* Items (read-only display) */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4" />
                Itens da Venda
              </Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {saleItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-3 flex justify-between items-center border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity}x R$ {Number(item.unit_price).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <p className="font-semibold">
                      R$ {Number(item.total).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome do Cliente</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Payment & Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customPaymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.name}>
                        {method.name}
                      </SelectItem>
                    ))}
                    {/* Also allow current payment method if not in list */}
                    {!customPaymentMethods.find(m => m.name === paymentMethod) && (
                      <SelectItem value={paymentMethod}>{paymentMethod}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Desconto</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor do Desconto</Label>
                <Input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre a venda..."
              />
            </div>

            {/* Totals */}
            <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              {calculatedDiscount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Desconto</span>
                  <span>- R$ {calculatedDiscount.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span>R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="sm:mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Venda
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Venda
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá devolver os produtos ao estoque e atualizar os relatórios financeiros.
              Escolha o que deseja excluir:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            {/* Delete mode selection */}
            <div className="flex gap-2">
              <Button
                variant={deleteMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDeleteMode("all");
                  setSelectedItemsToDelete([]);
                }}
              >
                Excluir Tudo
              </Button>
              <Button
                variant={deleteMode === "partial" ? "default" : "outline"}
                size="sm"
                onClick={() => setDeleteMode("partial")}
              >
                Escolher Itens
              </Button>
            </div>

            {deleteMode === "partial" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Selecione os itens a excluir:</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllItems}
                  >
                    {selectedItemsToDelete.length === saleItems.length 
                      ? "Desmarcar todos" 
                      : "Selecionar todos"}
                  </Button>
                </div>
                
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {saleItems.map((item) => (
                    <div 
                      key={item.id}
                      className="p-3 flex items-center gap-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleItemSelection(item.id)}
                    >
                      <Checkbox
                        checked={selectedItemsToDelete.includes(item.id)}
                        onCheckedChange={() => toggleItemSelection(item.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x R$ {Number(item.unit_price).toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        R$ {Number(item.total).toFixed(2).replace(".", ",")}
                      </Badge>
                    </div>
                  ))}
                </div>

                {selectedItemsToDelete.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedItemsToDelete.length} item(s) selecionado(s)
                    {selectedItemsToDelete.length === saleItems.length && 
                      " - A venda inteira será excluída"}
                  </p>
                )}
              </div>
            )}

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <strong>Atenção:</strong> Os produtos serão devolvidos ao estoque 
                (exceto itens de parceiros). Os registros financeiros serão atualizados.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || (deleteMode === "partial" && selectedItemsToDelete.length === 0)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
