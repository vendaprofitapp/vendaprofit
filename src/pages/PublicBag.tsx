import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Package, MessageCircle, Check, CheckCircle, Heart, RotateCcw, 
  ShoppingBag, AlertCircle, ArrowRight, Loader2, Repeat
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useProductSwap } from "@/hooks/useProductSwap";
import { ProductSwapDialog } from "@/components/consignment/ProductSwapDialog";

interface StoreSettings {
  store_name: string;
  logo_url: string | null;
  primary_color: string | null;
  background_color: string | null;
  whatsapp_number: string | null;
}

interface ConsignmentItem {
  id: string;
  status: string;
  original_price: number;
  product_id: string;
  variant_id: string | null;
  products: {
    id: string;
    name: string;
    category: string;
    image_url: string | null;
    size: string | null;
    color: string | null;
  };
  product_variants?: {
    size: string;
    image_url: string | null;
  } | null;
}

interface Consignment {
  id: string;
  status: string;
  seller_id: string;
  deadline_at: string | null;
  shipping_cost: number | null;
  approved_at: string | null;
  customers: {
    name: string;
    phone: string | null;
  } | null;
  consignment_items: ConsignmentItem[];
}

// Interface for swap requests
interface SwapRequest {
  originalItemId: string;
  originalProductName: string;
  originalSize: string | null;
  originalColor: string | null;
  newProductId: string;
  newVariantId?: string;
  newSize: string | null;
  newColor: string | null;
  newProductName: string;
  newPrice: number;
}

export default function PublicBag() {
  const { token } = useParams<{ token: string }>();
  const [isApproving, setIsApproving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  // Use plain objects instead of Map for iOS Safari compatibility
  const [localItems, setLocalItems] = useState<Record<string, "kept" | "returned" | "swap_requested">>({});
  const [swapItem, setSwapItem] = useState<ConsignmentItem | null>(null);
  const [swapRequests, setSwapRequests] = useState<Record<string, SwapRequest>>({});
  // Fetch consignment by token
  const { data: consignment, isLoading, error, refetch } = useQuery({
    queryKey: ["public-consignment", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consignments")
        .select(`
          id,
          status,
          seller_id,
          deadline_at,
          shipping_cost,
          approved_at,
          customers (name, phone),
          consignment_items (
            id,
            status,
            original_price,
            product_id,
            variant_id,
            products (id, name, category, image_url, size, color),
            product_variants (size, color, image_url)
          )
        `)
        .eq("access_token", token)
        .single();

      if (error) throw error;
      return data as Consignment;
    },
    enabled: !!token,
  });

  // Fetch store settings for styling
  const { data: storeSettings } = useQuery({
    queryKey: ["store-settings-public", consignment?.seller_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("store_name, logo_url, primary_color, background_color, whatsapp_number")
        .eq("owner_id", consignment!.seller_id)
        .single();

      if (error) return null;
      return data as StoreSettings;
    },
    enabled: !!consignment?.seller_id,
  });

  const primaryColor = storeSettings?.primary_color || "#000000";
  const backgroundColor = storeSettings?.background_color || "#fafaf9";

  // Load Google Fonts dynamically
  useEffect(() => {
    // Use default fonts for public page
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  };

  const handleApprove = async () => {
    if (!consignment) return;
    
    setIsApproving(true);
    try {
      // Update consignment status to active
      const { error: consignmentError } = await supabase
        .from("consignments")
        .update({ 
          status: "active",
          approved_at: new Date().toISOString()
        })
        .eq("id", consignment.id);

      if (consignmentError) throw consignmentError;

      // Update all items to active
      const { error: itemsError } = await supabase
        .from("consignment_items")
        .update({ status: "active" })
        .eq("consignment_id", consignment.id);

      if (itemsError) throw itemsError;

      toast.success("Malinha aprovada com sucesso!");
      refetch();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao aprovar malinha");
    } finally {
      setIsApproving(false);
    }
  };

  const handleItemChoice = async (itemId: string, choice: "kept" | "returned") => {
    // Update local state for immediate feedback
    setLocalItems(prev => ({ ...prev, [itemId]: choice }));

    // Update in database
    try {
      const { error } = await supabase
        .from("consignment_items")
        .update({ status: choice })
        .eq("id", itemId);

      if (error) throw error;
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar escolha");
      // Revert local state
      setLocalItems(prev => {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleFinalize = async () => {
    if (!consignment) return;

    // Check if all items have been decided
    const items = consignment.consignment_items;
    const allDecided = items.every(item => {
      const localChoice = localItems[item.id];
      return localChoice || item.status === "kept" || item.status === "returned" || item.status === "swap_requested";
    });

    if (!allDecided) {
      toast.error("Por favor, decida sobre todos os itens antes de finalizar");
      return;
    }

    setIsFinalizing(true);
    try {
      const { error } = await supabase
        .from("consignments")
        .update({ status: "finalized_by_client" })
        .eq("id", consignment.id);

      if (error) throw error;

      // Send WhatsApp summary
      sendWhatsAppSummary();
      
      toast.success("Escolhas enviadas com sucesso!");
      refetch();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao finalizar escolhas");
    } finally {
      setIsFinalizing(false);
    }
  };

  const sendWhatsAppSummary = () => {
    if (!consignment || !storeSettings?.whatsapp_number) return;

    const items = consignment.consignment_items;
    const keptItems = items.filter(item => {
      const choice = localItems[item.id] || item.status;
      return choice === "kept";
    });
    
    const returnedItems = items.filter(item => {
      const choice = localItems[item.id] || item.status;
      return choice === "returned";
    });

    const swapItems = items.filter(item => {
      const choice = localItems[item.id];
      return choice === "swap_requested";
    });

    // Calculate totals
    const keptTotal = keptItems.reduce((sum, item) => sum + item.original_price, 0);
    
    // Calculate swap items total (new items to be added)
    const swapTotal = swapItems.reduce((sum, item) => {
      const swapRequest = swapRequests[item.id];
      return sum + (swapRequest?.newPrice || 0);
    }, 0);

    const shippingCostValue = consignment.shipping_cost || 0;
    const grandTotal = keptTotal + swapTotal + shippingCostValue;

    let message = `Olá! Finalizei minhas escolhas da malinha! 🛍️\n\n`;
    
    if (keptItems.length > 0) {
      message += `*VOU FICAR:* ❤️\n`;
      keptItems.forEach(item => {
        const size = item.product_variants?.size || item.products?.size;
        const color = item.product_variants?.color || item.products?.color;
        message += `• ${item.products?.name}`;
        if (color) message += ` | ${color}`;
        if (size) message += ` | Tam ${size}`;
        message += ` (${formatPrice(item.original_price)})\n`;
      });
      message += `\n`;
    }

    if (swapItems.length > 0) {
      message += `🔄 *QUERO TROCAR (adicionar ao pedido):*\n`;
      swapItems.forEach(item => {
        const swapRequest = swapRequests[item.id];
        if (swapRequest) {
          // Original item details
          const originalSize = item.product_variants?.size || item.products?.size || "único";
          const originalColor = item.product_variants?.color || item.products?.color;
          
          message += `• De: ${item.products?.name}`;
          if (originalColor) message += ` | ${originalColor}`;
          message += ` | Tam ${originalSize}\n`;
          
          // New item details with price
          message += `  ➡️ Para: ${swapRequest.newProductName}`;
          if (swapRequest.newColor) message += ` | ${swapRequest.newColor}`;
          message += ` | Tam ${swapRequest.newSize || "único"}`;
          message += ` (${formatPrice(swapRequest.newPrice)})\n`;
        }
      });
      message += `\n`;
    }

    if (returnedItems.length > 0) {
      message += `*VOU DEVOLVER:* ↩️\n`;
      returnedItems.forEach(item => {
        const size = item.product_variants?.size || item.products?.size;
        const color = item.product_variants?.color || item.products?.color;
        message += `• ${item.products?.name}`;
        if (color) message += ` | ${color}`;
        if (size) message += ` | Tam ${size}`;
        message += `\n`;
      });
      message += `\n`;
    }

    // Summary section
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*RESUMO DO PEDIDO:*\n`;
    
    if (keptItems.length > 0) {
      message += `Itens da malinha: ${formatPrice(keptTotal)}\n`;
    }
    
    if (swapItems.length > 0) {
      message += `Itens de troca: ${formatPrice(swapTotal)}\n`;
    }
    
    if (shippingCostValue > 0) {
      message += `Frete: ${formatPrice(shippingCostValue)}\n`;
    }
    
    message += `\n*💰 TOTAL A PAGAR: ${formatPrice(grandTotal)}*`;

    const phone = storeSettings.whatsapp_number.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const contactSeller = () => {
    if (!storeSettings?.whatsapp_number) {
      toast.error("Número de WhatsApp não disponível");
      return;
    }

    const message = `Olá! Tenho uma dúvida sobre minha malinha 🛍️`;
    const phone = storeSettings.whatsapp_number.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor }}
      >
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
          <p className="text-muted-foreground">Carregando sua malinha...</p>
        </div>
      </div>
    );
  }

  if (error || !consignment) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ backgroundColor }}
      >
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Malinha não encontrada</h1>
        <p className="text-muted-foreground text-center">
          Este link pode ter expirado ou a malinha foi cancelada.
        </p>
      </div>
    );
  }

  const items = consignment.consignment_items || [];
  const isApprovalState = consignment.status === "awaiting_approval";
  const isActiveState = consignment.status === "active";
  const isFinalizedState = consignment.status === "finalized_by_client" || consignment.status === "completed";
  
  const keptItems = items.filter(item => {
    const choice = localItems[item.id] || item.status;
    return choice === "kept";
  });

  const swapItemsList = items.filter(item => {
    const choice = localItems[item.id];
    return choice === "swap_requested";
  });
  
  const keptTotal = keptItems.reduce((sum, item) => sum + item.original_price, 0);
  
  // Calculate swap items total
  const swapTotal = swapItemsList.reduce((sum, item) => {
    const swapRequest = swapRequests[item.id];
    return sum + (swapRequest?.newPrice || 0);
  }, 0);
  
  const totalValue = items.reduce((sum, item) => sum + item.original_price, 0);
  const shippingCost = consignment.shipping_cost || 0;
  
  // Grand total includes kept items + swap items + shipping
  const grandTotal = keptTotal + swapTotal + shippingCost;

  return (
    <div className="min-h-screen" style={{ backgroundColor }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-3">
            {storeSettings?.logo_url ? (
              <img 
                src={storeSettings.logo_url} 
                alt={storeSettings.store_name} 
                className="h-10 object-contain"
              />
            ) : (
              <ShoppingBag className="h-8 w-8" style={{ color: primaryColor }} />
            )}
            <h1 className="text-xl font-bold">{storeSettings?.store_name || "Sua Malinha"}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Welcome message */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-1">
            Olá{consignment.customers?.name ? `, ${consignment.customers.name.split(" ")[0]}` : ""}! 👋
          </h2>
          {isApprovalState && (
            <p className="text-muted-foreground">
              Confira os itens da sua malinha e aprove para receber
            </p>
          )}
          {isActiveState && (
            <p className="text-muted-foreground">
              Hora de experimentar! Escolha o que vai ficar 💕
            </p>
          )}
          {isFinalizedState && (
            <p className="text-muted-foreground">
              Suas escolhas foram enviadas ✨
            </p>
          )}
        </div>

        {/* Deadline warning */}
        {consignment.deadline_at && !isFinalizedState && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span>
                Prazo para decisão: {format(new Date(consignment.deadline_at), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </CardContent>
          </Card>
        )}

        {/* Items list */}
        <div className="space-y-3 mb-6">
          {items.map(item => {
            const size = item.product_variants?.size || item.products?.size;
            const color = item.product_variants?.color || item.products?.color;
            const imageUrl = item.product_variants?.image_url || item.products?.image_url;
            const localChoice = localItems[item.id];
            const currentStatus = localChoice || item.status;
            const isKept = currentStatus === "kept";
            const isReturned = currentStatus === "returned";
            const isSwapRequested = currentStatus === "swap_requested";
            const swapRequest = swapRequests[item.id];

            return (
              <Card 
                key={item.id} 
                className={`overflow-hidden transition-all ${
                  isKept ? "ring-2 ring-green-500" : 
                  isSwapRequested ? "ring-2 ring-yellow-500" :
                  isReturned ? "opacity-60" : ""
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Product image */}
                    <div className="w-24 h-24 bg-muted flex-shrink-0">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={item.products?.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 p-3">
                      <h3 className="font-medium line-clamp-1">{item.products?.name}</h3>
                      <div className="flex items-center gap-1 mt-1">
                        {size && <Badge variant="outline" className="text-xs">{size}</Badge>}
                        {color && <Badge variant="outline" className="text-xs">{color}</Badge>}
                      </div>
                      <p className="font-bold mt-1" style={{ color: primaryColor }}>
                        {formatPrice(item.original_price)}
                      </p>

                      {/* Swap requested status badge */}
                      {isActiveState && isSwapRequested && swapRequest && (
                        <div className="mt-2">
                          <Badge className="bg-yellow-500 text-white gap-1">
                            <Repeat className="h-3 w-3" />
                            Trocar pelo Tam {swapRequest.newSize || "único"}
                          </Badge>
                          <Button
                            variant="link"
                            size="sm"
                            className="px-0 h-auto mt-1 text-xs text-muted-foreground"
                            onClick={() => {
                              // Remove swap request and reset to no choice
                              setSwapRequests(prev => {
                                const { [item.id]: _, ...rest } = prev;
                                return rest;
                              });
                              setLocalItems(prev => {
                                const { [item.id]: _, ...rest } = prev;
                                return rest;
                              });
                            }}
                          >
                            Cancelar troca
                          </Button>
                        </div>
                      )}

                      {/* Action buttons for active state - only show if not swap requested */}
                      {isActiveState && !isSwapRequested && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant={isKept ? "default" : "outline"}
                            className={`flex-1 gap-1 ${isKept ? "" : ""}`}
                            style={isKept ? { backgroundColor: primaryColor } : {}}
                            onClick={() => handleItemChoice(item.id, "kept")}
                          >
                            <Heart className="h-3 w-3" />
                            Ficar
                          </Button>
                          <Button
                            size="sm"
                            variant={isReturned ? "secondary" : "outline"}
                            className="flex-1 gap-1"
                            onClick={() => handleItemChoice(item.id, "returned")}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Devolver
                          </Button>
                        </div>
                      )}

                      {/* Swap button - always visible in active state when not kept and not already swap requested */}
                      {isActiveState && !isKept && !isSwapRequested && (
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0 h-auto mt-1 text-xs gap-1"
                          style={{ color: primaryColor }}
                          onClick={() => setSwapItem(item)}
                        >
                          <Repeat className="h-3 w-3" />
                          🔄 Não serviu? Ver tamanhos
                        </Button>
                      )}

                      {/* Status badge for finalized state */}
                      {isFinalizedState && (
                        <Badge 
                          className={`mt-2 ${
                            currentStatus === "kept" ? "bg-green-500" : 
                            currentStatus === "swap_requested" ? "bg-yellow-500" :
                            "bg-orange-500"
                          } text-white`}
                        >
                          {currentStatus === "kept" ? "Vai ficar ❤️" : 
                           currentStatus === "swap_requested" ? `Trocar pelo Tam ${swapRequest?.newSize || "outro"} 🔄` :
                           "Devolvido ↩️"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary and actions */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t p-4 -mx-4 shadow-lg">
          {isApprovalState && (
            <>
              <div className="flex justify-between mb-3">
                <span className="text-muted-foreground">Total da malinha:</span>
                <span className="font-bold">{formatPrice(totalValue)}</span>
              </div>
              {shippingCost > 0 && (
                <div className="flex justify-between mb-3 text-sm">
                  <span className="text-muted-foreground">Frete:</span>
                  <span>{formatPrice(shippingCost)}</span>
                </div>
              )}
              <Button 
                className="w-full gap-2 mb-2"
                size="lg"
                style={{ backgroundColor: primaryColor }}
                onClick={handleApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Aprovar e Receber Malinha
              </Button>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={contactSeller}
              >
                <MessageCircle className="h-4 w-4" />
                Falar com Vendedora
              </Button>
            </>
          )}

          {isActiveState && (
            <>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Itens que vão ficar:</span>
                <span className="font-medium">{keptItems.length} de {items.length}</span>
              </div>
              {swapItemsList.length > 0 && (
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Itens de troca:</span>
                  <span className="font-medium">{swapItemsList.length} ({formatPrice(swapTotal)})</span>
                </div>
              )}
              {shippingCost > 0 && (
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Frete:</span>
                  <span className="font-medium">{formatPrice(shippingCost)}</span>
                </div>
              )}
              <div className="flex justify-between mb-3 pt-2 border-t">
                <span className="font-medium">Total a pagar:</span>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>
                  {formatPrice(grandTotal)}
                </span>
              </div>
              <Button 
                className="w-full gap-2 mb-2"
                size="lg"
                style={{ backgroundColor: primaryColor }}
                onClick={handleFinalize}
                disabled={isFinalizing}
              >
                {isFinalizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                Enviar Pedido no WhatsApp
              </Button>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={contactSeller}
              >
                <MessageCircle className="h-4 w-4" />
                Tirar Dúvida
              </Button>
            </>
          )}

          {isFinalizedState && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                <Check className="h-5 w-5" />
                <span className="font-medium">Escolhas enviadas!</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                A vendedora entrará em contato para combinar a entrega
              </p>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={contactSeller}
              >
                <MessageCircle className="h-4 w-4" />
                Falar com Vendedora
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Swap Dialog */}
      {swapItem && (
        <ProductSwapDialog
          item={swapItem}
          sellerId={consignment?.seller_id}
          open={!!swapItem}
          onOpenChange={(open) => !open && setSwapItem(null)}
          onSwapComplete={(selection) => {
            if (selection) {
              // Set the item as swap_requested
              setLocalItems(prev => ({ ...prev, [swapItem.id]: "swap_requested" as const }));
              
              // Store the swap request details
              setSwapRequests(prev => ({
                ...prev,
                [swapItem.id]: {
                  originalItemId: swapItem.id,
                  originalProductName: swapItem.products.name,
                  originalSize: swapItem.product_variants?.size || swapItem.products.size,
                  originalColor: swapItem.product_variants?.color || swapItem.products.color,
                  newProductId: selection.productId,
                  newVariantId: selection.variantId,
                  newSize: selection.size,
                  newColor: selection.color,
                  newProductName: selection.productName,
                  newPrice: selection.price,
                },
              }));
              
              toast.success(`Troca pelo tamanho ${selection.size || "novo"} solicitada!`);
            }
            setSwapItem(null);
          }}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
}
