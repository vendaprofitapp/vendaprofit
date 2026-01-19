import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Search, MessageCircle, Store, Package, ShoppingCart, Plus, Minus, Trash2, X, Flame } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

interface ProductVariant {
  id: string;
  product_id: string;
  color: string | null;
  size: string;
  stock_quantity: number;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  size: string | null;
  color: string | null;
  image_url: string | null;
  stock_quantity: number;
  owner_id: string;
}

// A display item represents one card in the catalog (either a product or a color variant)
interface CatalogDisplayItem {
  id: string; // unique key for React
  productId: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  category_2?: string | null;
  category_3?: string | null;
  color: string | null;
  sizes: string[];
  image_url: string | null;
  totalStock: number;
  owner_id: string;
  isPartner: boolean; // true if product is from a partner's stock
}

// Cart item with selected size
interface CartItem {
  displayItem: CatalogDisplayItem;
  selectedSize: string;
  quantity: number;
}

interface StoreSettings {
  id: string;
  owner_id: string;
  store_slug: string;
  store_name: string;
  store_description: string | null;
  whatsapp_number: string | null;
  show_own_products: boolean;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
}

export default function StoreCatalog() {
  const { slug } = useParams<{ slug: string }>();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Cart functions
  const addToCart = (item: CatalogDisplayItem, size: string) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(
        c => c.displayItem.id === item.id && c.selectedSize === size
      );
      
      if (existingIndex >= 0) {
        // Increment quantity
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        };
        return updated;
      }
      
      // Add new item
      return [...prev, { displayItem: item, selectedSize: size, quantity: 1 }];
    });
    toast.success(`${item.name} adicionado ao carrinho`);
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.displayItem.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Fetch store settings
  const { data: store, isLoading: storeLoading, error: storeError } = useQuery({
    queryKey: ["store", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("store_slug", slug)
        .eq("is_active", true)
        .single();
      
      if (error) throw error;
      return data as StoreSettings;
    },
    enabled: !!slug,
  });

  // Fetch store partnerships
  const { data: partnerships } = useQuery({
    queryKey: ["store-partnerships", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_partnerships")
        .select("group_id")
        .eq("store_id", store!.id);
      
      if (error) throw error;
      return data.map(p => p.group_id);
    },
    enabled: !!store?.id,
  });

  // Fetch products with their variants
  const { data: catalogItems = [], isLoading: productsLoading } = useQuery({
    queryKey: ["catalog-products-variants", store?.id, store?.owner_id, store?.show_own_products, partnerships],
    queryFn: async () => {
      const ownProductIds = new Set<string>();
      const ownProducts: (Product & { isPartner: boolean })[] = [];
      const partnerProducts: (Product & { isPartner: boolean })[] = [];

      // Get own products if enabled
      if (store?.show_own_products) {
        const { data: products, error } = await supabase
          .from("products")
          .select("id, name, description, price, category, size, color, image_url, stock_quantity, owner_id")
          .eq("owner_id", store.owner_id)
          .eq("is_active", true)
          .gt("stock_quantity", 0);
        
        if (!error && products) {
          products.forEach(p => {
            ownProductIds.add(p.id);
            ownProducts.push({ ...p, isPartner: false });
          });
        }
      }

      // Get partnership products
      if (partnerships && partnerships.length > 0) {
        const { data: partnershipProducts, error } = await supabase
          .from("product_partnerships")
          .select(`
            product_id,
            products!inner (
              id, name, description, price, category, size, color, image_url, stock_quantity, owner_id, is_active
            )
          `)
          .in("group_id", partnerships);
        
        if (!error && partnershipProducts) {
          partnershipProducts.forEach((pp: any) => {
            const p = pp.products;
            // Only add if not already in own products (by ID) and is active with stock
            if (p && p.is_active && p.stock_quantity > 0 && !ownProductIds.has(p.id)) {
              partnerProducts.push({ ...p, isPartner: true });
            }
          });
        }
      }

      const allProducts = [...ownProducts, ...partnerProducts];
      if (allProducts.length === 0) return [];

      // Fetch variants for all products
      const { data: variants } = await supabase
        .from("product_variants")
        .select("id, product_id, color, size, stock_quantity, image_url, image_url_2, image_url_3")
        .in("product_id", allProducts.map(p => p.id))
        .gt("stock_quantity", 0);

      // Create display items
      const displayItems: CatalogDisplayItem[] = [];
      
      // Track which color/size combinations we already have from own stock
      // Key: "productName_color_size" (normalized)
      const ownStockCombinations = new Set<string>();

      // Helper to create a unique key for product+color+size
      const makeKey = (name: string, color: string | null, size: string) => 
        `${name.toLowerCase().trim()}_${(color || '').toLowerCase().trim()}_${size.toLowerCase().trim()}`;

      // Process own products first to track combinations
      for (const product of ownProducts) {
        const productVariants = variants?.filter(v => v.product_id === product.id) || [];
        
        if (productVariants.length > 0) {
          const colorGroups = new Map<string, ProductVariant[]>();
          
          productVariants.forEach(v => {
            const color = v.color || '__no_color__';
            if (!colorGroups.has(color)) {
              colorGroups.set(color, []);
            }
            colorGroups.get(color)!.push(v);
          });

          for (const [color, colorVariants] of colorGroups) {
            const sizes = colorVariants.map(v => v.size).filter(Boolean);
            const totalStock = colorVariants.reduce((sum, v) => sum + v.stock_quantity, 0);
            const variantImage = colorVariants.find(v => v.image_url)?.image_url || product.image_url;
            
            // Track each size in own stock
            sizes.forEach(size => {
              ownStockCombinations.add(makeKey(product.name, color === '__no_color__' ? null : color, size));
            });

            displayItems.push({
              id: `${product.id}_${color}`,
              productId: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              category: product.category,
              color: color === '__no_color__' ? null : color,
              sizes: [...new Set(sizes)],
              image_url: variantImage,
              totalStock,
              owner_id: product.owner_id,
              isPartner: false,
            });
          }
        } else {
          // No variants
          if (product.size) {
            ownStockCombinations.add(makeKey(product.name, product.color, product.size));
          }
          
          displayItems.push({
            id: product.id,
            productId: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            color: product.color,
            sizes: product.size ? [product.size] : [],
            image_url: product.image_url,
            totalStock: product.stock_quantity,
            owner_id: product.owner_id,
            isPartner: false,
          });
        }
      }

      // Process partner products, filtering out duplicates
      for (const product of partnerProducts) {
        const productVariants = variants?.filter(v => v.product_id === product.id) || [];
        
        if (productVariants.length > 0) {
          const colorGroups = new Map<string, ProductVariant[]>();
          
          productVariants.forEach(v => {
            const color = v.color || '__no_color__';
            if (!colorGroups.has(color)) {
              colorGroups.set(color, []);
            }
            colorGroups.get(color)!.push(v);
          });

          for (const [color, colorVariants] of colorGroups) {
            // Filter sizes: only include sizes NOT in own stock for same product name + color
            const displayColor = color === '__no_color__' ? null : color;
            const availableSizes = colorVariants
              .map(v => v.size)
              .filter(size => size && !ownStockCombinations.has(makeKey(product.name, displayColor, size)));
            
            // Skip if all sizes are already in own stock
            if (availableSizes.length === 0) continue;
            
            const filteredVariants = colorVariants.filter(v => availableSizes.includes(v.size));
            const totalStock = filteredVariants.reduce((sum, v) => sum + v.stock_quantity, 0);
            const variantImage = filteredVariants.find(v => v.image_url)?.image_url || product.image_url;

            displayItems.push({
              id: `${product.id}_${color}_partner`,
              productId: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              category: product.category,
              color: displayColor,
              sizes: [...new Set(availableSizes)],
              image_url: variantImage,
              totalStock,
              owner_id: product.owner_id,
              isPartner: true,
            });
          }
        } else {
          // No variants - check if same name+color+size exists in own stock
          if (product.size && ownStockCombinations.has(makeKey(product.name, product.color, product.size))) {
            continue; // Skip, own stock has this
          }
          
          displayItems.push({
            id: `${product.id}_partner`,
            productId: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            color: product.color,
            sizes: product.size ? [product.size] : [],
            image_url: product.image_url,
            totalStock: product.stock_quantity,
            owner_id: product.owner_id,
            isPartner: true,
          });
        }
      }

      return displayItems;
    },
    enabled: !!store,
  });

  // Get unique categories (including all 3 category fields)
  const categories = useMemo(() => {
    const allCats = catalogItems.flatMap(p => [p.category, p.category_2, p.category_3].filter(Boolean));
    return [...new Set(allCats)];
  }, [catalogItems]);

  // Filter products
  const filteredItems = catalogItems.filter(p => {
    const matchesSearch = search === "" || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.color && p.color.toLowerCase().includes(search.toLowerCase()));
    const productCategories = [p.category, p.category_2, p.category_3].filter(Boolean).map(c => c?.toLowerCase());
    const matchesCategory = !selectedCategory || productCategories.includes(selectedCategory.toLowerCase());
    
    // Filter for opportunities
    if (showOpportunities) {
      const hasOpportunity = productCategories.some(c => c?.toLowerCase() === "oportunidades");
      if (!hasOpportunity) return false;
    }
    
    return matchesSearch && matchesCategory;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const sendCartViaWhatsApp = () => {
    if (!store?.whatsapp_number || cart.length === 0) return;
    
    const hasPartnerProducts = cart.some(item => item.displayItem.isPartner);
    
    let message = "Olá! Gostaria de fazer o seguinte pedido:\n\n";
    
    cart.forEach((item, index) => {
      const colorInfo = item.displayItem.color ? ` - ${item.displayItem.color}` : "";
      const partnerMark = item.displayItem.isPartner ? " *" : "";
      message += `${index + 1}. ${item.displayItem.name}${colorInfo}${partnerMark}\n`;
      message += `   Tamanho: ${item.selectedSize}\n`;
      message += `   Quantidade: ${item.quantity}\n`;
      message += `   Preço unitário: ${formatPrice(item.displayItem.price)}\n`;
      message += `   Subtotal: ${formatPrice(item.displayItem.price * item.quantity)}\n\n`;
    });
    
    message += `*TOTAL: ${formatPrice(cartTotal)}*`;
    
    if (hasPartnerProducts) {
      message += "\n\n_* Produto de estoque parceiro_";
    }
    
    const phone = store.whatsapp_number.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");
    
    // Clear cart after sending
    clearCart();
    setCartOpen(false);
    toast.success("Pedido enviado pelo WhatsApp!");
  };

  if (storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Store className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Loja não encontrada</h1>
        <p className="text-muted-foreground mb-4">Esta loja não existe ou está desativada.</p>
        <Link to="/">
          <Button>Voltar ao início</Button>
        </Link>
      </div>
    );
  }

  const primaryColor = store.primary_color || "#8B5CF6";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header 
        className="py-8 px-4 relative"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 md:gap-6">
            {store.logo_url && (
              <img 
                src={store.logo_url} 
                alt={store.store_name}
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full object-cover bg-white shadow-lg flex-shrink-0"
              />
            )}
            <div className="text-white flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">{store.store_name}</h1>
              {store.store_description && (
                <p className="text-white/80 mt-1 text-sm md:text-base">{store.store_description}</p>
              )}
            </div>
            
            {/* Cart Button in Header */}
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="relative h-12 w-12 rounded-full shadow-lg"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartItemCount > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: "#e11d48" }}
                    >
                      {cartItemCount > 9 ? "9+" : cartItemCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Meu Carrinho ({cartItemCount})
                  </SheetTitle>
                </SheetHeader>
                
                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                    <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Seu carrinho está vazio</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Adicione produtos para continuar
                    </p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="flex-1 -mx-6 px-6">
                      <div className="space-y-4 py-4">
                        {cart.map((item, index) => (
                          <div key={`${item.displayItem.id}-${item.selectedSize}`} className="flex gap-3 p-3 border rounded-lg">
                            {item.displayItem.image_url ? (
                              <img 
                                src={item.displayItem.image_url} 
                                alt={item.displayItem.name}
                                className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm line-clamp-1">{item.displayItem.name}</h4>
                              {item.displayItem.color && (
                                <p className="text-xs text-muted-foreground">Cor: {item.displayItem.color}</p>
                              )}
                              <p className="text-xs text-muted-foreground">Tam: {item.selectedSize}</p>
                              <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>
                                {formatPrice(item.displayItem.price * item.quantity)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removeFromCart(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => updateCartQuantity(index, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => updateCartQuantity(index, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total:</span>
                        <span className="text-xl font-bold" style={{ color: primaryColor }}>
                          {formatPrice(cartTotal)}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={clearCart}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Limpar
                        </Button>
                        <Button 
                          className="flex-1 gap-2"
                          style={{ backgroundColor: "#25D366" }}
                          onClick={sendCartViaWhatsApp}
                          disabled={!store.whatsapp_number}
                        >
                          <MessageCircle className="h-4 w-4" />
                          Enviar Pedido
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Opportunities Button Bar */}
        <div className="flex justify-center mb-4">
          <Button
            variant={showOpportunities ? "default" : "outline"}
            size="lg"
            className={`gap-2 font-bold text-base px-6 ${showOpportunities ? "" : "border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"}`}
            style={showOpportunities ? { backgroundColor: "#f97316" } : {}}
            onClick={() => {
              setShowOpportunities(!showOpportunities);
              if (!showOpportunities) {
                setSelectedCategory(null);
              }
            }}
          >
            <Flame className="h-5 w-5" />
            OPORTUNIDADES
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null && !showOpportunities ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCategory(null);
                setShowOpportunities(false);
              }}
            >
              Todos
            </Button>
            {categories.filter(cat => cat?.toLowerCase() !== "oportunidades").map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCategory(cat);
                  setShowOpportunities(false);
                }}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-muted"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <ProductCard 
                key={item.id}
                item={item}
                primaryColor={primaryColor}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Cart Button (Mobile) */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 right-4 md:hidden z-50">
          <Button
            size="lg"
            className="rounded-full h-14 w-14 shadow-xl"
            style={{ backgroundColor: primaryColor }}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-6 w-6" />
            <span 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: "#e11d48" }}
            >
              {cartItemCount > 9 ? "9+" : cartItemCount}
            </span>
          </Button>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 px-4 border-t mt-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {store.store_name}. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}

// Separate component for product card with size selection
interface ProductCardProps {
  item: CatalogDisplayItem;
  primaryColor: string;
  onAddToCart: (item: CatalogDisplayItem, size: string) => void;
}

function ProductCard({ item, primaryColor, onAddToCart }: ProductCardProps) {
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [imageOpen, setImageOpen] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleAddToCart = () => {
    if (item.sizes.length > 0 && !selectedSize) {
      toast.error("Selecione um tamanho");
      return;
    }
    onAddToCart(item, selectedSize || "Único");
  };

  return (
    <>
      <Card className="overflow-hidden group">
        <div 
          className="aspect-square bg-muted relative overflow-hidden cursor-pointer"
          onClick={() => item.image_url && setImageOpen(true)}
        >
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={`${item.name}${item.color ? ` - ${item.color}` : ''}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {item.totalStock <= 3 && (
            <Badge className="absolute top-2 right-2" variant="destructive">
              Últimas unidades
            </Badge>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-medium text-foreground line-clamp-2 mb-1">
            {item.name}
          </h3>
          
          {/* Color info */}
          {item.color && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="font-medium">Cor:</span> {item.color}
            </p>
          )}

          <p 
            className="text-lg font-bold mb-2"
            style={{ color: primaryColor }}
          >
            {formatPrice(item.price)}
          </p>

          {/* Partner product shipping notice */}
          {item.isPartner && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mb-2">
              <p className="text-xs text-amber-700 font-medium text-center">
                📦 Prazo de Envio: 7-10 dias
              </p>
            </div>
          )}

          {/* Size selector - using buttons instead of Select for better iOS compatibility */}
          {item.sizes.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1.5">Tamanho:</p>
              <div className="flex flex-wrap gap-1.5">
                {item.sizes.map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors touch-manipulation ${
                      selectedSize === size
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button
              size="sm"
              className="w-full gap-2"
              style={{ backgroundColor: primaryColor }}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Image Lightbox Dialog */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <button
            onClick={() => setImageOpen(false)}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          {item.image_url && (
            <div className="flex items-center justify-center p-4 min-h-[50vh]">
              <img
                src={item.image_url}
                alt={`${item.name}${item.color ? ` - ${item.color}` : ''}`}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          )}
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-white font-medium text-lg drop-shadow-lg">
              {item.name}
              {item.color && <span className="text-white/80"> - {item.color}</span>}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
