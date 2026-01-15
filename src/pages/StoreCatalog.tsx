import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, MessageCircle, Store, Package, Sparkles } from "lucide-react";
import { AIFittingRoomDialog } from "@/components/catalog/AIFittingRoomDialog";

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
  color: string | null;
  sizes: string[];
  image_url: string | null;
  totalStock: number;
  owner_id: string;
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
  const [fittingRoomOpen, setFittingRoomOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogDisplayItem | null>(null);

  const handleOpenFittingRoom = (item: CatalogDisplayItem) => {
    setSelectedProduct(item);
    setFittingRoomOpen(true);
  };

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
      const productIds = new Set<string>();
      const allProducts: Product[] = [];

      // Get own products if enabled
      if (store?.show_own_products) {
        const { data: ownProducts, error } = await supabase
          .from("products")
          .select("id, name, description, price, category, size, color, image_url, stock_quantity, owner_id")
          .eq("owner_id", store.owner_id)
          .eq("is_active", true)
          .gt("stock_quantity", 0);
        
        if (!error && ownProducts) {
          ownProducts.forEach(p => {
            if (!productIds.has(p.id)) {
              productIds.add(p.id);
              allProducts.push(p);
            }
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
            if (p && p.is_active && p.stock_quantity > 0 && !productIds.has(p.id)) {
              productIds.add(p.id);
              allProducts.push(p);
            }
          });
        }
      }

      if (allProducts.length === 0) return [];

      // Fetch variants for all products
      const { data: variants } = await supabase
        .from("product_variants")
        .select("id, product_id, color, size, stock_quantity, image_url, image_url_2, image_url_3")
        .in("product_id", allProducts.map(p => p.id))
        .gt("stock_quantity", 0);

      // Group variants by product and color
      const variantsByProductColor = new Map<string, ProductVariant[]>();
      
      variants?.forEach(v => {
        const key = `${v.product_id}_${v.color || '__no_color__'}`;
        if (!variantsByProductColor.has(key)) {
          variantsByProductColor.set(key, []);
        }
        variantsByProductColor.get(key)!.push(v);
      });

      // Create display items
      const displayItems: CatalogDisplayItem[] = [];

      for (const product of allProducts) {
        // Get all variants for this product
        const productVariants = variants?.filter(v => v.product_id === product.id) || [];
        
        if (productVariants.length > 0) {
          // Group variants by color
          const colorGroups = new Map<string, ProductVariant[]>();
          
          productVariants.forEach(v => {
            const color = v.color || '__no_color__';
            if (!colorGroups.has(color)) {
              colorGroups.set(color, []);
            }
            colorGroups.get(color)!.push(v);
          });

          // Create one display item per color
          for (const [color, colorVariants] of colorGroups) {
            const sizes = colorVariants.map(v => v.size).filter(Boolean);
            const totalStock = colorVariants.reduce((sum, v) => sum + v.stock_quantity, 0);
            
            // Use the first variant's image, or fall back to product image
            const variantImage = colorVariants.find(v => v.image_url)?.image_url || product.image_url;

            displayItems.push({
              id: `${product.id}_${color}`,
              productId: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              category: product.category,
              color: color === '__no_color__' ? null : color,
              sizes: [...new Set(sizes)], // Remove duplicates
              image_url: variantImage,
              totalStock,
              owner_id: product.owner_id,
            });
          }
        } else {
          // No variants, show product as-is
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
          });
        }
      }

      return displayItems;
    },
    enabled: !!store,
  });

  // Get unique categories
  const categories = [...new Set(catalogItems.map(p => p.category))].filter(Boolean);

  // Filter products
  const filteredItems = catalogItems.filter(p => {
    const matchesSearch = search === "" || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.color && p.color.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleWhatsApp = (item: CatalogDisplayItem) => {
    if (!store?.whatsapp_number) return;
    const colorInfo = item.color ? ` - Cor: ${item.color}` : "";
    const sizesInfo = item.sizes.length > 0 ? ` - Tamanhos: ${item.sizes.join(", ")}` : "";
    const message = encodeURIComponent(
      `Olá! Tenho interesse no produto: ${item.name}${colorInfo}${sizesInfo}\nPreço: ${formatPrice(item.price)}`
    );
    const phone = store.whatsapp_number.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
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
        className="py-8 px-4"
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
            <div className="text-white">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">{store.store_name}</h1>
              {store.store_description && (
                <p className="text-white/80 mt-1 text-sm md:text-base">{store.store_description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="max-w-6xl mx-auto px-4 py-6">
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
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
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
              <Card key={item.id} className="overflow-hidden group">
                <div className="aspect-square bg-muted relative overflow-hidden">
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
                  
                  {/* Color and sizes info */}
                  <div className="space-y-1 mb-2">
                    {item.color && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Cor:</span> {item.color}
                      </p>
                    )}
                    {item.sizes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.sizes.map(size => (
                          <Badge key={size} variant="secondary" className="text-xs">
                            {size}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <p 
                    className="text-lg font-bold mb-3"
                    style={{ color: primaryColor }}
                  >
                    {formatPrice(item.price)}
                  </p>
                  <div className="space-y-2">
                    {item.image_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={() => handleOpenFittingRoom(item)}
                      >
                        <Sparkles className="h-4 w-4" />
                        Provador I.A.
                      </Button>
                    )}
                    {store.whatsapp_number && (
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        style={{ backgroundColor: "#25D366" }}
                        onClick={() => handleWhatsApp(item)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Comprar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 px-4 border-t mt-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {store.store_name}. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* AI Fitting Room Dialog */}
      <AIFittingRoomDialog
        open={fittingRoomOpen}
        onOpenChange={setFittingRoomOpen}
        product={selectedProduct ? {
          id: selectedProduct.productId,
          name: selectedProduct.name,
          image_url: selectedProduct.image_url,
        } : null}
      />
    </div>
  );
}
