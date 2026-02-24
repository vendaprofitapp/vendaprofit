import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, ShoppingCart, Search, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  winnerId: string;
  participantId: string;
  participantName: string;
  consortiumId: string;
  consortiumValue: number;
  participantBalance?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CartItemData {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  variant_color: string | null;
  selected_size: string | null;
  source: string | null;
}

interface ImportedCart {
  id: string;
  short_code: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  items: CartItemData[];
}

export function ConsortiumItemsDialog({
  winnerId,
  participantId,
  participantName,
  consortiumId,
  consortiumValue,
  participantBalance = 0,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cartCode, setCartCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [importedCart, setImportedCart] = useState<ImportedCart | null>(null);

  // Buscar itens já cadastrados (para histórico)
  const { data: existingItems = [] } = useQuery({
    queryKey: ["consortium-items", winnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_items")
        .select("*")
        .eq("winner_id", winnerId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const creditTotal = Number(consortiumValue);
  const usedFromBalance = creditTotal - participantBalance;
  const cartTotal = importedCart?.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) || 0;
  const existingTotal = existingItems.reduce((sum, i) => sum + Number(i.total), 0);
  const totalUsed = usedFromBalance + cartTotal + existingTotal;
  const remaining = creditTotal - totalUsed;
  const hasDebt = remaining < 0;
  const hasCredit = remaining > 0;

  // Buscar carrinho por código
  const handleSearchCart = async () => {
    if (!cartCode.trim()) return;
    setIsSearching(true);
    try {
      const { data: savedCart, error } = await supabase
        .from("saved_carts")
        .select("id, short_code, customer_name, customer_phone, total, status, saved_cart_items(id, product_id, product_name, variant_color, selected_size, quantity, unit_price, source)")
        .eq("short_code", cartCode.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;
      if (!savedCart) {
        toast.error("Carrinho não encontrado. Verifique o código.");
        return;
      }
      if ((savedCart as any).status === "converted") {
        toast.error("Este carrinho já foi convertido em venda.");
        return;
      }

      setImportedCart({
        id: savedCart.id,
        short_code: (savedCart as any).short_code,
        customer_name: (savedCart as any).customer_name || "",
        customer_phone: (savedCart as any).customer_phone || "",
        total: (savedCart as any).total || 0,
        items: ((savedCart as any).saved_cart_items || []) as CartItemData[],
      });
      toast.success(`Carrinho ${cartCode.toUpperCase()} importado!`);
    } catch (err: any) {
      toast.error("Erro ao buscar carrinho: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Converter em venda
  const handleConvertToSale = async () => {
    if (!importedCart || importedCart.items.length === 0) {
      toast.error("Importe um carrinho primeiro.");
      return;
    }

    // Salvar itens na tabela consortium_items para histórico
    for (const item of importedCart.items) {
      await supabase.from("consortium_items").insert({
        winner_id: winnerId,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.unit_price * item.quantity,
        notes: item.source === "b2b" ? "Pedido sob encomenda" : null,
      });
    }

    // Se sobrou crédito, atualizar current_balance do participante
    if (hasCredit) {
      await supabase
        .from("consortium_participants")
        .update({ current_balance: remaining })
        .eq("id", participantId);
    }

    // Preparar dados para o NewSaleDialog via sessionStorage
    const consortiumSaleData = {
      consortiumId,
      winnerId,
      participantId,
      participantName,
      cartId: importedCart.id,
      creditAmount: participantBalance,
      cartTotal,
      items: importedCart.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        variant_color: item.variant_color,
        selected_size: item.selected_size,
        source: item.source,
      })),
      customerName: importedCart.customer_name || participantName,
      customerPhone: importedCart.customer_phone || "",
    };

    // Limpar dados de venda manual pendente
    sessionStorage.removeItem("sales_cart");
    sessionStorage.removeItem("sales_customerName");
    sessionStorage.removeItem("sales_customerPhone");
    sessionStorage.removeItem("sales_notes");
    sessionStorage.removeItem("sales_discountType");
    sessionStorage.removeItem("sales_discountValue");
    sessionStorage.removeItem("sales_paymentMethodId");

    // Salvar dados do consórcio
    sessionStorage.setItem("consortium_sale_data", JSON.stringify(consortiumSaleData));

    queryClient.invalidateQueries({ queryKey: ["consortium-items", winnerId] });
    onOpenChange(false);

    // Navegar para a página de vendas
    navigate("/sales");
    toast.success("Redirecionando para registro de venda...");
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
          {/* Resumo de crédito */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-muted">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Crédito Total</p>
                <p className="text-lg font-bold text-primary">R$ {creditTotal.toFixed(2)}</p>
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
                  {hasDebt ? "A Pagar" : "Restante"}
                </p>
                <p className={`text-lg font-bold ${hasDebt ? "text-destructive" : "text-green-500"}`}>
                  R$ {Math.abs(remaining).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Alerta de débito */}
          {hasDebt && (
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Valor excede o crédito</p>
                  <p className="text-sm text-muted-foreground">
                    A diferença de R$ {Math.abs(remaining).toFixed(2)} será cobrada na venda
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alerta de crédito restante */}
          {hasCredit && importedCart && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-primary">Crédito restante</p>
                  <p className="text-sm text-muted-foreground">
                    R$ {remaining.toFixed(2)} ficará como crédito no consórcio
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campo de código do carrinho */}
          <div className="space-y-2">
            <Label>Código do Carrinho (Minha Loja)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: VP-A3F2"
                value={cartCode}
                onChange={(e) => setCartCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearchCart()}
                className="flex-1"
              />
              <Button
                onClick={handleSearchCart}
                disabled={isSearching || !cartCode.trim()}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                {isSearching ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>

          {/* Itens do carrinho importado */}
          {importedCart && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens do Carrinho ({importedCart.short_code})</Label>
                <Badge variant="secondary">{importedCart.items.length} itens</Badge>
              </div>

              {/* Mobile cards */}
              <div className="block sm:hidden space-y-2">
                {importedCart.items.map((item) => (
                  <Card key={item.id} className="bg-card">
                    <CardContent className="p-3">
                      <p className="font-medium">{item.product_name}</p>
                      {(item.variant_color || item.selected_size) && (
                        <p className="text-xs text-muted-foreground">
                          {[item.variant_color, item.selected_size].filter(Boolean).join(" / ")}
                        </p>
                      )}
                      <div className="flex justify-between mt-1">
                        <span className="text-sm text-muted-foreground">{item.quantity}x R$ {Number(item.unit_price).toFixed(2)}</span>
                        <span className="text-sm font-medium">R$ {(item.quantity * item.unit_price).toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor Un.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedCart.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.product_name}</span>
                            {(item.variant_color || item.selected_size) && (
                              <p className="text-xs text-muted-foreground">
                                {[item.variant_color, item.selected_size].filter(Boolean).join(" / ")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">R$ {Number(item.unit_price).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">R$ {(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Resumo e botão de conversão */}
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total do Carrinho</span>
                  <span className="font-medium">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-primary">
                  <span>Crédito do Consórcio</span>
                  <span className="font-medium">- R$ {Math.min(participantBalance, cartTotal).toFixed(2)}</span>
                </div>
                {hasDebt && (
                  <div className="flex justify-between text-sm text-destructive border-t pt-2">
                    <span className="font-bold">A Pagar</span>
                    <span className="font-bold">R$ {Math.abs(remaining).toFixed(2)}</span>
                  </div>
                )}
                {!hasDebt && (
                  <div className="flex justify-between text-sm text-primary border-t pt-2">
                    <span className="font-bold">Valor Coberto</span>
                    <span className="font-bold">✓ Crédito cobre 100%</span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleConvertToSale}
                className="w-full gap-2"
                size="lg"
              >
                <ArrowRight className="h-4 w-4" />
                Converter em Venda
              </Button>
            </div>
          )}

          {/* Itens já cadastrados (histórico) */}
          {existingItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Itens Anteriores</Label>
              <div className="text-sm space-y-1">
                {existingItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-muted-foreground">
                    <span>{item.product_name} (x{item.quantity})</span>
                    <span>R$ {Number(item.total).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
