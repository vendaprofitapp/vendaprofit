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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleOpenFittingRoom = (product: Product) => {
    setSelectedProduct(product);
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

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["catalog-products", store?.id, store?.owner_id, store?.show_own_products, partnerships],
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

      return allProducts;
    },
    enabled: !!store,
  });

  // Get unique categories
  const categories = [...new Set(products.map(p => p.category))].filter(Boolean);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = search === "" || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleWhatsApp = (product: Product) => {
    if (!store?.whatsapp_number) return;
    const message = encodeURIComponent(
      `Olá! Tenho interesse no produto: ${product.name}\nPreço: ${formatPrice(product.price)}`
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
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <Card key={product.id} className="overflow-hidden group">
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  {product.stock_quantity <= 3 && (
                    <Badge className="absolute top-2 right-2" variant="destructive">
                      Últimas unidades
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium text-foreground line-clamp-2 mb-1">
                    {product.name}
                  </h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {product.size && (
                      <Badge variant="secondary" className="text-xs">
                        {product.size}
                      </Badge>
                    )}
                    {product.color && (
                      <Badge variant="secondary" className="text-xs">
                        {product.color}
                      </Badge>
                    )}
                  </div>
                  <p 
                    className="text-lg font-bold mb-3"
                    style={{ color: primaryColor }}
                  >
                    {formatPrice(product.price)}
                  </p>
                  <div className="space-y-2">
                    {product.image_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={() => handleOpenFittingRoom(product)}
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
                        onClick={() => handleWhatsApp(product)}
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
        product={selectedProduct}
      />
    </div>
  );
}
