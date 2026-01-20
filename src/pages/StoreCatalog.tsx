import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, useRef } from "react";
import { Search, MessageCircle, Store, Package, ShoppingCart, Plus, Minus, Trash2, X, Flame, Heart, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  video_url: string | null;
  stock_quantity: number;
  owner_id: string;
}

// A display item represents one card in the catalog (either a product or a color variant)
interface CatalogDisplayItem {
  id: string;
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
  video_url: string | null;
  totalStock: number;
  owner_id: string;
  isPartner: boolean;
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
  logo_position: string | null;
  logo_size: string | null;
  banner_url: string | null;
  banner_url_mobile: string | null;
  primary_color: string | null;
  background_color: string | null;
  card_background_color: string | null;
  banner_link: string | null;
  is_banner_visible: boolean;
  banner_height_mobile: string | null;
  banner_height_desktop: string | null;
  font_heading: string | null;
  font_body: string | null;
  custom_font_url: string | null;
  custom_font_name: string | null;
  show_opportunities_button: boolean;
  opportunities_button_text: string | null;
  opportunities_button_color: string | null;
  show_store_url: boolean;
  show_store_description: boolean;
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
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        };
        return updated;
      }
      
      return [...prev, { displayItem: item, selectedSize: size, quantity: 1 }];
    });
    toast.success(`${item.name} adicionado à sacola`);
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

  // Fetch products with their variants (now includes video_url)
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
          .select("id, name, description, price, category, category_2, category_3, size, color, image_url, video_url, stock_quantity, owner_id")
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
              id, name, description, price, category, category_2, category_3, size, color, image_url, video_url, stock_quantity, owner_id, is_active
            )
          `)
          .in("group_id", partnerships);
        
        if (!error && partnershipProducts) {
          partnershipProducts.forEach((pp: any) => {
            const p = pp.products;
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
      const ownStockCombinations = new Set<string>();

      const makeKey = (name: string, color: string | null, size: string) => 
        `${name.toLowerCase().trim()}_${(color || '').toLowerCase().trim()}_${size.toLowerCase().trim()}`;

      // Process own products first
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
              category_2: (product as any).category_2,
              category_3: (product as any).category_3,
              color: color === '__no_color__' ? null : color,
              sizes: [...new Set(sizes)],
              image_url: variantImage,
              video_url: product.video_url,
              totalStock,
              owner_id: product.owner_id,
              isPartner: false,
            });
          }
        } else {
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
            category_2: (product as any).category_2,
            category_3: (product as any).category_3,
            color: product.color,
            sizes: product.size ? [product.size] : [],
            image_url: product.image_url,
            video_url: product.video_url,
            totalStock: product.stock_quantity,
            owner_id: product.owner_id,
            isPartner: false,
          });
        }
      }

      // Process partner products
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
            const displayColor = color === '__no_color__' ? null : color;
            const availableSizes = colorVariants
              .map(v => v.size)
              .filter(size => size && !ownStockCombinations.has(makeKey(product.name, displayColor, size)));
            
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
              category_2: (product as any).category_2,
              category_3: (product as any).category_3,
              color: displayColor,
              sizes: [...new Set(availableSizes)],
              image_url: variantImage,
              video_url: product.video_url,
              totalStock,
              owner_id: product.owner_id,
              isPartner: true,
            });
          }
        } else {
          if (product.size && ownStockCombinations.has(makeKey(product.name, product.color, product.size))) {
            continue;
          }
          
          displayItems.push({
            id: `${product.id}_partner`,
            productId: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            category_2: (product as any).category_2,
            category_3: (product as any).category_3,
            color: product.color,
            sizes: product.size ? [product.size] : [],
            image_url: product.image_url,
            video_url: product.video_url,
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

  // Get unique categories - sorted alphabetically, excluding "oportunidades"
  const categories = useMemo(() => {
    const allCats = catalogItems.flatMap(p => [p.category, p.category_2, p.category_3].filter(Boolean));
    const uniqueCats = [...new Set(allCats)]
      .filter(cat => cat?.toLowerCase() !== "oportunidades")
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniqueCats;
  }, [catalogItems]);

  // Filter products
  const filteredItems = catalogItems.filter(p => {
    const matchesSearch = search === "" || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.color && p.color.toLowerCase().includes(search.toLowerCase()));
    const productCategories = [p.category, p.category_2, p.category_3].filter(Boolean).map(c => c?.toLowerCase());
    const matchesCategory = !selectedCategory || productCategories.includes(selectedCategory.toLowerCase());
    
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
    
    clearCart();
    setCartOpen(false);
    toast.success("Pedido enviado pelo WhatsApp!");
  };

  if (storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-200" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <Store className="h-16 w-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-light text-gray-900 mb-2">Loja não encontrada</h1>
        <p className="text-gray-500 mb-4">Esta loja não existe ou está desativada.</p>
        <Link to="/">
          <Button variant="outline">Voltar ao início</Button>
        </Link>
      </div>
    );
  }

  const primaryColor = store.primary_color || "#000000";
  const backgroundColor = store.background_color || "#fafaf9";
  const cardBackgroundColor = store.card_background_color || "#ffffff";
  
  // Banner configuration - check if at least one banner exists
  const hasBannerDesktop = store.is_banner_visible && store.banner_url;
  const hasBannerMobile = store.is_banner_visible && store.banner_url_mobile;
  const showBanner = store.is_banner_visible && (store.banner_url || store.banner_url_mobile);
  
  // Opportunities button customization
  const showOpportunitiesButton = store.show_opportunities_button ?? true;
  const opportunitiesButtonText = store.opportunities_button_text || "OPORTUNIDADES";
  const opportunitiesButtonColor = store.opportunities_button_color || "#f97316";
  
  // Font customization
  const fontHeading = store.font_heading || "Inter";
  const fontBody = store.font_body || "Inter";
  const customFontUrl = store.custom_font_url;
  const customFontName = store.custom_font_name;

  // Promotional Banner Component with separate images for mobile/desktop
  const PromotionalBanner = () => {
    if (!showBanner) return null;
    
    // Get appropriate banner URL - mobile takes priority on small screens
    const mobileBannerUrl = store.banner_url_mobile || store.banner_url;
    const desktopBannerUrl = store.banner_url || store.banner_url_mobile;
    
    const bannerContent = (
      <>
        {/* Desktop Banner - hidden on mobile */}
        {desktopBannerUrl && (
          <img 
            src={desktopBannerUrl} 
            alt="Promoção"
            className="hidden md:block w-full h-auto object-contain"
          />
        )}
        {/* Mobile Banner - hidden on desktop */}
        {mobileBannerUrl && (
          <img 
            src={mobileBannerUrl} 
            alt="Promoção"
            className="block md:hidden w-full h-auto object-contain"
          />
        )}
      </>
    );

    if (store.banner_link) {
      return (
        <a 
          href={store.banner_link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block w-full cursor-pointer hover:opacity-95 transition-opacity"
        >
          {bannerContent}
        </a>
      );
    }

    return <div className="w-full">{bannerContent}</div>;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor, fontFamily: fontBody }}>
      {/* Custom Font Loader */}
      {customFontUrl && customFontName && (
        <style>{`
          @font-face {
            font-family: '${customFontName}';
            src: url('${customFontUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `}</style>
      )}
      
      {/* Minimal Header */}
      <header className="sticky top-0 z-50 backdrop-blur-sm border-b border-gray-100 relative" style={{ backgroundColor: `${backgroundColor}f5`, fontFamily: fontBody }}>
        <div className="max-w-7xl mx-auto px-4 py-2">
          {/* Carrinho no canto superior direito */}
          <div className="absolute right-4 top-4 z-10">
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <button 
                  className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Abrir sacola"
                >
                  <ShoppingBag className="h-6 w-6 text-gray-700" />
                  {cartItemCount > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {cartItemCount > 9 ? "9+" : cartItemCount}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md flex flex-col bg-white">
                <SheetHeader className="border-b pb-4">
                  <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
                    <ShoppingBag className="h-5 w-5" />
                    Sua Sacola ({cartItemCount})
                  </SheetTitle>
                </SheetHeader>
                
                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                    <ShoppingBag className="h-16 w-16 text-gray-200 mb-4" />
                    <p className="text-gray-500 font-medium">Sua sacola está vazia</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Explore nossa coleção
                    </p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="flex-1 -mx-6 px-6">
                      <div className="space-y-4 py-4">
                        {cart.map((item, index) => (
                          <div key={`${item.displayItem.id}-${item.selectedSize}`} className="flex gap-4 pb-4 border-b border-gray-100">
                            {item.displayItem.image_url ? (
                              <img 
                                src={item.displayItem.image_url} 
                                alt={item.displayItem.name}
                                className="w-20 h-24 object-cover rounded-lg flex-shrink-0"
                              />
                            ) : (
                              <div className="w-20 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package className="h-6 w-6 text-gray-300" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-gray-900 line-clamp-2">{item.displayItem.name}</h4>
                              <div className="flex gap-2 mt-1">
                                {item.displayItem.color && (
                                  <span className="text-xs text-gray-500">{item.displayItem.color}</span>
                                )}
                                <span className="text-xs text-gray-500">Tam: {item.selectedSize}</span>
                              </div>
                              <p className="text-sm font-semibold mt-2 text-gray-900">
                                {formatPrice(item.displayItem.price * item.quantity)}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:border-gray-400 transition-colors"
                                  onClick={() => updateCartQuantity(index, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                                <button
                                  className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:border-gray-400 transition-colors"
                                  onClick={() => updateCartQuantity(index, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <button
                                  className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                                  onClick={() => removeFromCart(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total</span>
                        <span className="text-xl font-bold text-gray-900">
                          {formatPrice(cartTotal)}
                        </span>
                      </div>
                      
                      <Button 
                        className="w-full h-12 gap-2 text-base font-semibold rounded-xl"
                        style={{ backgroundColor: "#25D366" }}
                        onClick={sendCartViaWhatsApp}
                        disabled={!store.whatsapp_number}
                      >
                        <MessageCircle className="h-5 w-5" />
                        Finalizar pelo WhatsApp
                      </Button>
                      
                      <button 
                        className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        onClick={clearCart}
                      >
                        Limpar sacola
                      </button>
                    </div>
                  </>
                )}
              </SheetContent>
            </Sheet>
          </div>

          {/* Conteúdo - posição baseada em logo_position */}
          {(() => {
            const logoPosition = store.logo_position || 'center';
            const logoSize = store.logo_size || 'medium';
            
            // Classes de tamanho para logo - altura fixa responsiva
            // Pequena: 40px mobile / 60px desktop
            // Média: 50px mobile / 80px desktop  
            // Grande: 60px mobile / 100px desktop
            const logoSizeClasses: Record<string, string> = {
              small: 'h-10 md:h-[60px]',
              medium: 'h-[50px] md:h-20',
              large: 'h-[60px] md:h-[100px]'
            };
            
            // Alinhamento baseado na posição
            const alignClasses: Record<string, string> = {
              left: 'items-start text-left',
              center: 'items-center text-center',
              right: 'items-end text-right'
            };
            
            return (
              <div className={cn(
                "flex flex-col w-full",
                alignClasses[logoPosition] || 'items-center text-center',
                (store.logo_url || store.store_name || store.store_description) ? "gap-1" : ""
              )}>
                {/* Logo com formato livre - preserva proporção original */}
                {store.logo_url && (
                  <img 
                    src={store.logo_url} 
                    alt={store.store_name || "Logo"}
                    className={cn(
                      "object-contain w-auto",
                      logoSizeClasses[logoSize] || logoSizeClasses.medium
                    )}
                  />
                )}
            
                {/* Nome da loja - só aparece se preenchido E show_store_url for true */}
                {store.store_name && (store.show_store_url ?? true) && (
                  <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-gray-900" style={{ fontFamily: fontHeading }}>
                    {store.store_name}
                  </h1>
                )}
                
                {/* Descrição em bullet points - só aparece se preenchido E show_store_description for true */}
                {store.store_description && store.store_description.trim() && (store.show_store_description ?? true) && (
                  <div className={cn(
                    "text-xs text-gray-600 max-w-md",
                    logoPosition === 'center' ? "text-center" : logoPosition === 'right' ? "text-right" : "text-left"
                  )}>
                    {store.store_description.split('\n').filter(line => line.trim()).map((line, i) => (
                      <p key={i} className={cn(
                        "flex gap-1",
                        logoPosition === 'center' ? "items-center justify-center" : 
                        logoPosition === 'right' ? "items-center justify-end" : "items-center justify-start"
                      )}>
                        <span className="text-gray-400">•</span>
                        <span>{line.trim().replace(/^[-•]\s*/, '')}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </header>

      {/* Promotional Banner - Below header */}
      <PromotionalBanner />

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Opportunities Button */}
        {showOpportunitiesButton && (
          <div className="flex justify-center mb-6">
            <button
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all",
                showOpportunities
                  ? "text-white shadow-lg"
                  : "hover:opacity-80"
              )}
              style={{
                backgroundColor: showOpportunities ? opportunitiesButtonColor : `${opportunitiesButtonColor}15`,
                color: showOpportunities ? "white" : opportunitiesButtonColor,
                boxShadow: showOpportunities ? `0 10px 15px -3px ${opportunitiesButtonColor}40` : undefined,
              }}
              onClick={() => {
                setShowOpportunities(!showOpportunities);
                if (!showOpportunities) {
                  setSelectedCategory(null);
                }
              }}
            >
              <Flame className="h-4 w-4" />
              {opportunitiesButtonText}
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-12 rounded-full border-gray-200 bg-gray-50 focus:bg-white transition-colors"
          />
        </div>

        {/* Category Pills - horizontal scroll on mobile */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 mb-6 scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {categories.map(cat => (
              <button
                key={cat}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                  selectedCategory === cat
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
                onClick={() => {
                  setSelectedCategory(selectedCategory === cat ? null : cat);
                  setShowOpportunities(false);
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid - 2 cols mobile, 4 cols desktop */}
        {productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-gray-100 rounded-xl mb-3" />
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum produto encontrado</h3>
            <p className="text-gray-500 text-sm">Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {filteredItems.map(item => (
              <BoutiqueProductCard 
                key={item.id}
                item={item}
                primaryColor={primaryColor}
                cardBackgroundColor={cardBackgroundColor}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Cart Button (Mobile) */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-6 right-6 md:hidden z-50">
          <button
            className="h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-white"
            style={{ backgroundColor: primaryColor }}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag className="h-6 w-6" />
            <span 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-red-500 text-white"
            >
              {cartItemCount > 9 ? "9+" : cartItemCount}
            </span>
          </button>
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="py-8 px-4 border-t border-gray-100 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {store.store_name}
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================
// BOUTIQUE PRODUCT CARD - Vertical 3:4 format
// ============================================

interface BoutiqueProductCardProps {
  item: CatalogDisplayItem;
  primaryColor: string;
  cardBackgroundColor: string;
  onAddToCart: (item: CatalogDisplayItem, size: string) => void;
}

function BoutiqueProductCard({ item, primaryColor, cardBackgroundColor, onAddToCart }: BoutiqueProductCardProps) {
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [isHovering, setIsHovering] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
    setSelectedSize("");
  };

  const handleInteractionStart = () => {
    setIsHovering(true);
    if (item.video_url && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleInteractionEnd = () => {
    setIsHovering(false);
    if (item.video_url && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <>
      <div 
        className="group flex flex-col p-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
        style={{ backgroundColor: cardBackgroundColor }}
        onMouseEnter={handleInteractionStart}
        onMouseLeave={handleInteractionEnd}
        onTouchStart={handleInteractionStart}
      >
        {/* Image Container - 3:4 Portrait */}
        <div 
          className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100 mb-3 cursor-pointer"
          onClick={() => item.image_url && setImageOpen(true)}
        >
          {/* Category Badge */}
          {item.category && (
            <Badge 
              className="absolute left-2 top-2 z-20 bg-white/90 text-[10px] font-semibold uppercase text-gray-700 backdrop-blur-sm border-0 shadow-sm"
            >
              {item.category}
            </Badge>
          )}

          {/* Low Stock Badge */}
          {item.totalStock <= 3 && (
            <Badge 
              className="absolute right-2 top-2 z-20 bg-red-500 text-white text-[10px] font-semibold border-0"
            >
              Últimas peças
            </Badge>
          )}

          {/* Wishlist Button */}
          <button 
            className="absolute right-2 top-10 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              toast.success("Adicionado aos favoritos!");
            }}
          >
            <Heart className="h-4 w-4" />
          </button>

          {/* Product Image */}
          <img
            src={item.image_url || "/placeholder.svg"}
            alt={`${item.name}${item.color ? ` - ${item.color}` : ''}`}
            className={cn(
              "h-full w-full object-cover transition-all duration-500 group-hover:scale-105",
              isHovering && isVideoLoaded && item.video_url ? "opacity-0" : "opacity-100"
            )}
          />

          {/* Video (plays on hover if available) */}
          {item.video_url && (
            <video
              ref={videoRef}
              src={item.video_url}
              muted
              loop
              playsInline
              onLoadedData={() => setIsVideoLoaded(true)}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                isHovering && isVideoLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}

          {/* Partner Shipping Notice */}
          {item.isPartner && (
            <div className="absolute bottom-2 left-2 right-2 z-20">
              <div className="bg-amber-50/95 backdrop-blur-sm border border-amber-200 rounded-lg px-2 py-1.5">
                <p className="text-[10px] text-amber-700 font-medium text-center">
                  📦 Envio: 7-10 dias úteis
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="px-1 flex flex-col gap-2">
          {/* Name and Color */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</h3>
            {item.color && (
              <p className="text-xs text-gray-500">{item.color}</p>
            )}
          </div>

          {/* Price */}
          <span className="text-base font-bold text-gray-900">{formatPrice(item.price)}</span>

          {/* Size Selector - Clean Pills */}
          {item.sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.sizes.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size === selectedSize ? "" : size)}
                  className={cn(
                    "min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium border transition-all touch-manipulation",
                    selectedSize === size
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          )}

          {/* Add to Cart Button */}
          <Button
            className="w-full h-10 rounded-xl font-semibold text-xs sm:text-sm transition-all hover:shadow-lg whitespace-nowrap overflow-hidden px-2"
            style={{ backgroundColor: primaryColor, color: 'white' }}
            onClick={handleAddToCart}
          >
            <ShoppingBag className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="truncate">Adicionar</span>
          </Button>
        </div>
      </div>

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
