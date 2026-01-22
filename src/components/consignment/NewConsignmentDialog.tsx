import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConsignment } from "@/hooks/useConsignment";
import { getAvailableStock } from "@/utils/stockHelpers";
import { Search, Plus, Trash2, Package, Send, MessageCircle, Copy, Check, Star } from "lucide-react";
import { format, addDays } from "date-fns";
import { Switch } from "@/components/ui/switch";

interface NewConsignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  size: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  size: string | null;
  color: string | null;
  stock_quantity: number;
  product_variants?: Array<{
    id: string;
    size: string;
    color: string | null;
    stock_quantity: number;
  }>;
}

interface SelectedItem {
  product: Product;
  variant_id?: string;
  size: string | null;
  color: string | null;
  price: number;
  availableStock: number;
}

export function NewConsignmentDialog({ open, onOpenChange, onSuccess }: NewConsignmentDialogProps) {
  const { user } = useAuth();
  const { createConsignment, addItem, requestApproval } = useConsignment();
  const [step, setStep] = useState<"details" | "products" | "review">("details");
  const [customerId, setCustomerId] = useState<string>("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [shippingCost, setShippingCost] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdConsignment, setCreatedConsignment] = useState<{ id: string; access_token: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [filterByCustomerSize, setFilterByCustomerSize] = useState(true);

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, size")
        .eq("owner_id", user.id)
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!user && open,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-consignment", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, price, image_url, size, color, stock_quantity,
          product_variants (id, size, color, stock_quantity)
        `)
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .gt("stock_quantity", 0);
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user && open && step === "products",
  });

  // Fetch store settings for WhatsApp and custom domain
  const { data: storeSettings } = useQuery({
    queryKey: ["store-settings-consignment", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("store_settings")
        .select("whatsapp_number, custom_domain")
        .eq("owner_id", user.id)
        .single();
      return data as { whatsapp_number: string | null; custom_domain: string | null } | null;
    },
    enabled: !!user,
  });

  const selectedCustomer = customers.find(c => c.id === customerId);
  const customerSize = selectedCustomer?.size?.toUpperCase()?.trim() || null;

  // Filter products - only include those with own available stock (not partner stock)
  // And filter variants to only show those with stock > 0
  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    .map(p => ({
      ...p,
      // Filter variants to only show those with stock > 0
      product_variants: p.product_variants?.filter(v => v.stock_quantity > 0) || [],
    }))
    // Only show product if it has stock (variants with stock or base product stock for non-variant products)
    .filter(p => {
      const hasVariantsWithStock = p.product_variants && p.product_variants.length > 0;
      const hasBaseStock = p.stock_quantity > 0 && (!p.product_variants || p.product_variants.length === 0);
      return hasVariantsWithStock || hasBaseStock;
    });

  // Helper to check if a size matches customer's preferred size
  const matchesCustomerSize = (size: string | null): boolean => {
    if (!customerSize || !size) return false;
    return size.toUpperCase().trim() === customerSize;
  };

  // Sort products: customer size matches first if filter is enabled
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!customerSize || !filterByCustomerSize) return 0;
    
    // Check if product A has any matching sizes
    const aHasMatch = matchesCustomerSize(a.size) || 
      a.product_variants?.some(v => matchesCustomerSize(v.size));
    // Check if product B has any matching sizes  
    const bHasMatch = matchesCustomerSize(b.size) || 
      b.product_variants?.some(v => matchesCustomerSize(v.size));
    
    if (aHasMatch && !bHasMatch) return -1;
    if (!aHasMatch && bHasMatch) return 1;
    return 0;
  });

  const addProduct = async (product: Product, variantId?: string) => {
    const variant = variantId 
      ? product.product_variants?.find(v => v.id === variantId)
      : null;
    
    const availableStock = await getAvailableStock(product.id, variantId);
    
    if (availableStock <= 0) {
      toast.error("Produto sem estoque disponível");
      return;
    }

    // Check if already added
    const alreadyAdded = selectedItems.some(
      item => item.product.id === product.id && item.variant_id === variantId
    );

    if (alreadyAdded) {
      toast.info("Produto já adicionado à malinha");
      return;
    }

    setSelectedItems(prev => [...prev, {
      product,
      variant_id: variantId,
      size: variant?.size || product.size,
      color: variant?.color || product.color,
      price: product.price,
      availableStock,
    }]);
    
    toast.success("Produto adicionado");
  };

  const removeProduct = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!customerId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    setIsSubmitting(true);
    try {
      const deadlineDate = addDays(new Date(), parseInt(deadlineDays));
      
      const consignment = await createConsignment({
        customer_id: customerId,
        deadline_at: deadlineDate.toISOString(),
        shipping_cost: shippingCost ? parseFloat(shippingCost) : undefined,
      });

      if (!consignment) throw new Error("Falha ao criar malinha");

      // Add all items
      for (const item of selectedItems) {
        await addItem({
          consignment_id: consignment.id,
          product_id: item.product.id,
          variant_id: item.variant_id,
          original_price: item.price,
        });
      }

      // Request approval
      await requestApproval(consignment.id);

      setCreatedConsignment({
        id: consignment.id,
        access_token: consignment.access_token,
      });

      setStep("review");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar malinha");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPublicUrl = () => {
    if (!createdConsignment) return "";
    // Prioriza domínio personalizado, depois usa o padrão
    if (storeSettings?.custom_domain) {
      const domain = storeSettings.custom_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `https://${domain}/bag/${createdConsignment.access_token}`;
    }
    return `https://vendaprofit.com.br/bag/${createdConsignment.access_token}`;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(getPublicUrl());
    setLinkCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const sendWhatsApp = () => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer?.phone) {
      toast.error("Cliente não tem telefone cadastrado");
      return;
    }

    const url = getPublicUrl();
    const total = selectedItems.reduce((sum, item) => sum + item.price, 0);
    const message = `Olá ${customer.name}! 🛍️\n\nSua malinha está pronta com ${selectedItems.length} peças!\n\n💰 Valor total: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}\n\nClique no link abaixo para conferir e aprovar:\n${url}\n\n📅 Prazo para decisão: ${deadlineDays} dias\n\nQualquer dúvida, é só me chamar! 💕`;
    
    const phone = customer.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleClose = () => {
    setStep("details");
    setCustomerId("");
    setDeadlineDays("7");
    setShippingCost("");
    setSelectedItems([]);
    setProductSearch("");
    setCreatedConsignment(null);
    onOpenChange(false);
    if (createdConsignment) {
      onSuccess();
    }
  };

  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "details" && "Nova Malinha - Dados"}
            {step === "products" && "Nova Malinha - Produtos"}
            {step === "review" && "Malinha Criada! 🎉"}
          </DialogTitle>
        </DialogHeader>

        {step === "details" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prazo para decisão (dias)</Label>
              <Select value={deadlineDays} onValueChange={setDeadlineDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="2">2 dias</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="5">5 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="10">10 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Custo de Envio (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={() => setStep("products")} disabled={!customerId}>
                Próximo
              </Button>
            </div>
          </div>
        )}

        {step === "products" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  className="pl-10"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              {customerSize && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Tam. {customerSize}</span>
                  <Switch
                    checked={filterByCustomerSize}
                    onCheckedChange={setFilterByCustomerSize}
                    className="scale-90"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">
              {/* Products list */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-3 py-2 text-sm font-medium">
                  Produtos Disponíveis
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="p-2 space-y-2">
                    {sortedProducts.map(product => {
                      const productHasMatchingSize = matchesCustomerSize(product.size) || 
                        product.product_variants?.some(v => matchesCustomerSize(v.size));
                      
                      return (
                        <Card 
                          key={product.id} 
                          className={`p-2 ${customerSize && filterByCustomerSize && productHasMatchingSize ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium truncate">{product.name}</p>
                                {customerSize && filterByCustomerSize && productHasMatchingSize && (
                                  <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.price)}
                              </p>
                            </div>
                          </div>
                          
                          {product.product_variants && product.product_variants.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {product.product_variants.map(variant => {
                                const isMatchingSize = matchesCustomerSize(variant.size);
                                return (
                                  <Button
                                    key={variant.id}
                                    size="sm"
                                    variant={customerSize && filterByCustomerSize && isMatchingSize ? "default" : "outline"}
                                    className={`h-6 text-xs px-2 ${
                                      customerSize && filterByCustomerSize && isMatchingSize 
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                                        : ''
                                    }`}
                                    onClick={() => addProduct(product, variant.id)}
                                  >
                                    {variant.size} {variant.color && `- ${variant.color}`}
                                  </Button>
                                );
                              })}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-2"
                              onClick={() => addProduct(product)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Adicionar
                            </Button>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Selected items */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-3 py-2 text-sm font-medium flex justify-between">
                  <span>Na Malinha ({selectedItems.length})</span>
                  <span className="font-bold">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
                  </span>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="p-2 space-y-2">
                    {selectedItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum produto adicionado
                      </div>
                    ) : (
                      selectedItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <div className="w-10 h-10 bg-muted rounded overflow-hidden flex-shrink-0">
                            {item.product.image_url ? (
                              <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.product.name}</p>
                            <div className="flex items-center gap-1">
                              {item.size && <Badge variant="outline" className="text-xs">{item.size}</Badge>}
                              {item.color && <Badge variant="outline" className="text-xs">{item.color}</Badge>}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeProduct(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("details")}>
                Voltar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={selectedItems.length === 0 || isSubmitting}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "Criando..." : "Criar e Enviar para Aprovação"}
              </Button>
            </div>
          </div>
        )}

        {step === "review" && createdConsignment && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-muted-foreground">
                Malinha criada com {selectedItems.length} itens e enviada para aprovação!
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <Label className="text-sm text-muted-foreground">Link para o cliente:</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input value={getPublicUrl()} readOnly className="text-sm" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={sendWhatsApp} className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Enviar via WhatsApp
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
