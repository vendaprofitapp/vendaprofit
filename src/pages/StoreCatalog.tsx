import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, useRef, useEffect } from "react";
import { Search, MessageCircle, Store, Package, ShoppingCart, Plus, Minus, Trash2, X, Flame, Heart, ShoppingBag, Clock, Rocket, Layers, ChevronLeft, ChevronRight, Link2, Lock, Eye, EyeOff, Play, Video, Copy } from "lucide-react";
import { CustomerFilters, CustomerFiltersState, ActiveFiltersDisplay } from "@/components/catalog/CustomerFilters";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VideoSalesBubble } from "@/components/marketing/VideoSalesBubble";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { MarketingPrices } from "@/components/stock/MarketingStatusSelector";
const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XXG", "XXXG"];

const sortSizes = (sizes: string[]): string[] => {
  return [...sizes].sort((a, b) => {
    const upperA = a.toUpperCase();
    const upperB = b.toUpperCase();
    const indexA = SIZE_ORDER.indexOf(upperA);
    const indexB = SIZE_ORDER.indexOf(upperB);
    
    // Both are standard sizes - sort by order
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // Only A is standard - A comes first
    if (indexA !== -1) return -1;
    // Only B is standard - B comes first
    if (indexB !== -1) return 1;
    
    // Both are numeric - sort numerically
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // Fallback to alphabetical
    return a.localeCompare(b);
  });
};

type MarketingStatusValue = "opportunity" | "presale" | "launch" | "secret";
type MarketingStatus = MarketingStatusValue[] | null;

// Helper to check if a marketing status array includes a specific value
const hasStatus = (status: MarketingStatus, value: MarketingStatusValue): boolean => 
  status?.includes(value) ?? false;

// Helper to get display status (priority: opportunity > presale > launch > secret)
const getDisplayStatus = (status: MarketingStatus): MarketingStatusValue | null => {
  if (!status || status.length === 0) return null;
  if (status.includes("opportunity")) return "opportunity";
  if (status.includes("presale")) return "presale";
  if (status.includes("launch")) return "launch";
  if (status.includes("secret")) return "secret";
  return null;
};

interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  stock_quantity: number;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  video_url: string | null;
  marketing_status: MarketingStatus;
  marketing_prices: MarketingPrices;
  marketing_delivery_days: number | null;
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
  image_url_2?: string | null;
  image_url_3?: string | null;
  video_url: string | null;
  stock_quantity: number;
  owner_id: string;
  model?: string | null;
  color_label?: string | null;
  custom_detail?: string | null;
  main_category?: string | null;
  subcategory?: string | null;
  is_new_release?: boolean;
}

// A display item represents one card in the catalog (either a product or a color variant)
interface CatalogDisplayItem {
  id: string;
  productId: string;
  variantId?: string; // When showing individual variants
  name: string;
  description: string | null;
  price: number;
  marketingPrices: MarketingPrices; // Per-status prices for this item
  marketingDeliveryDays: number | null; // Delivery days for presale
  category: string;
  category_2?: string | null;
  category_3?: string | null;
  main_category: string | null;
  subcategory: string | null;
  is_new_release: boolean;
  color: string | null;
  model: string | null;
  color_label: string | null;
  custom_detail: string | null;
  size?: string; // Specific size when showing individual variants
  sizes: string[];
  sizeMarketingStatus: Record<string, MarketingStatus>; // marketing status per size
  sizeMarketingPrices: Record<string, MarketingPrices>; // marketing prices per size (per status)
  sizeMarketingDeliveryDays: Record<string, number | null>; // delivery days per size
  sizeIsPartner: Record<string, boolean>; // track which sizes are from partner stock
  marketingStatus: MarketingStatus; // highest priority marketing status for the card
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  video_url: string | null;
  totalStock: number;
  owner_id: string;
  isPartner: boolean; // true if ALL sizes are from partner (for icon display)
  hasPartnerSizes: boolean; // true if ANY size is from partner
}


// Cart item with selected size
interface CartItem {
  displayItem: CatalogDisplayItem;
  selectedSize: string;
  quantity: number;
  effectivePrice: number; // The price shown when item was added (may differ from base price due to marketing)
}

// Filter button configuration type
interface FilterButtonConfig {
  visible: boolean;
  color: string;
  order: number;
  label: string;
}

interface FilterButtonsConfig {
  categories: FilterButtonConfig;
  opportunity: FilterButtonConfig;
  presale: FilterButtonConfig;
  launch: FilterButtonConfig;
}

const defaultFilterButtonsConfig: FilterButtonsConfig = {
  categories: { visible: true, color: "#1f2937", order: 0, label: "Categorias" },
  opportunity: { visible: true, color: "#f97316", order: 1, label: "Oportunidades" },
  presale: { visible: true, color: "#a855f7", order: 2, label: "Pré-venda" },
  launch: { visible: true, color: "#22c55e", order: 3, label: "Lançamentos" },
};

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
  filter_buttons_config: FilterButtonsConfig | null;
  bio_video_preview: string | null;
  bio_video_full: string | null;
  secret_area_active: boolean;
  secret_area_name: string | null;
  secret_area_password: string | null;
}

export default function StoreCatalog() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(() => searchParams.get("categoria") || null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(() => searchParams.get("sub") || null);
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [selectedMarketingFilter, setSelectedMarketingFilter] = useState<MarketingStatusValue | "all">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerFilters, setCustomerFilters] = useState<CustomerFiltersState>({
    categories: [],
    sizes: [],
    models: [],
    colors: [],
    details: [],
  });
  // Secret area state
  const [secretAreaUnlocked, setSecretAreaUnlocked] = useState(false);
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [secretPassword, setSecretPassword] = useState("");
  const [viewingSecretArea, setViewingSecretArea] = useState(false);

  // Session persistence for secret area
  useEffect(() => {
    if (slug) {
      const sessionKey = `secret_area_${slug}`;
      const isUnlocked = sessionStorage.getItem(sessionKey) === 'true';
      if (isUnlocked) {
        setSecretAreaUnlocked(true);
      }
    }
  }, [slug]);

  // Save to session when unlocked
  const handleSecretAreaUnlock = (password: string) => {
    if (password === store?.secret_area_password) {
      setSecretAreaUnlocked(true);
      setViewingSecretArea(true);
      setShowSecretDialog(false);
      setSecretPassword("");
      setSelectedMarketingFilter("secret");
      if (slug) {
        sessionStorage.setItem(`secret_area_${slug}`, 'true');
      }
      toast.success(`Bem-vindo(a) à ${store?.secret_area_name || "Área VIP"}! 🎉`);
    } else {
      toast.error("Senha incorreta. Tente novamente.");
    }
  };

  // Exit secret area
  const handleExitSecretArea = () => {
    setViewingSecretArea(false);
    setSelectedMarketingFilter("all");
  };

  // Cart functions
  const addToCart = (item: CatalogDisplayItem, size: string, effectivePrice: number) => {
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
      
      return [...prev, { displayItem: item, selectedSize: size, quantity: 1, effectivePrice }];
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

  const cartTotal = cart.reduce((sum, item) => sum + item.effectivePrice * item.quantity, 0);
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
      
      // Parse filter_buttons_config
      const result = {
        ...data,
        filter_buttons_config: (data.filter_buttons_config as unknown as FilterButtonsConfig) || defaultFilterButtonsConfig
      };
      return result as StoreSettings;
    },
    enabled: !!slug,
  });

  // Fetch system categories (main_categories + subcategories)
  const { data: systemMainCategories = [] } = useQuery({
    queryKey: ["system-main-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("main_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: systemSubcategories = [] } = useQuery({
    queryKey: ["system-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Check if current user is the store owner
  const isStoreOwner = useMemo(() => {
    return user?.id === store?.owner_id;
  }, [user?.id, store?.owner_id]);

  // Fetch store partnerships (groups linked to store)
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

  // Fetch 1-1 direct partnership groups for the store owner
  const { data: directPartnershipGroupIds = [] } = useQuery({
    queryKey: ["store-direct-partnerships", store?.owner_id],
    queryFn: async () => {
      // Get groups where the store owner is a member and the group is_direct = true
      const { data: memberGroups, error } = await supabase
        .from("group_members")
        .select("group_id, groups!inner(id, is_direct)")
        .eq("user_id", store!.owner_id);
      
      if (error) throw error;
      
      const directGroupIds = memberGroups
        ?.filter((gm: any) => gm.groups?.is_direct === true)
        .map((gm: any) => gm.group_id) || [];
      
      return directGroupIds;
    },
    enabled: !!store?.owner_id,
  });

  // Combine all partnership group IDs
  const allPartnershipGroupIds = useMemo(() => {
    const combined = new Set<string>();
    partnerships?.forEach(id => combined.add(id));
    directPartnershipGroupIds?.forEach(id => combined.add(id));
    return Array.from(combined);
  }, [partnerships, directPartnershipGroupIds]);

  // Fetch products with their variants (now includes video_url)
  const { data: catalogItems = [], isLoading: productsLoading } = useQuery({
    queryKey: ["catalog-products-variants", store?.id, store?.owner_id, store?.show_own_products, allPartnershipGroupIds],
    queryFn: async () => {
      const ownProductIds = new Set<string>();
      const ownProducts: (Product & { isPartner: boolean })[] = [];
      const partnerProducts: (Product & { isPartner: boolean })[] = [];

      // Get own products if enabled
      if (store?.show_own_products) {
        const { data: products, error } = await supabase
          .from("products")
          .select("id, name, description, price, category, category_2, category_3, main_category, subcategory, size, color, image_url, image_url_2, image_url_3, video_url, stock_quantity, owner_id, model, color_label, custom_detail, is_new_release")
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

      // Get partnership products from all groups (including 1-1 direct partnerships)
      if (allPartnershipGroupIds && allPartnershipGroupIds.length > 0) {
        const { data: partnershipProducts, error } = await supabase
          .from("product_partnerships")
          .select(`
            product_id,
            products!inner (
              id, name, description, price, category, category_2, category_3, main_category, subcategory, size, color, image_url, image_url_2, image_url_3, video_url, stock_quantity, owner_id, is_active, model, color_label, custom_detail, is_new_release
            )
          `)
          .in("group_id", allPartnershipGroupIds);
        
        if (!error && partnershipProducts) {
          partnershipProducts.forEach((pp: any) => {
            const p = pp.products;
            // Partner products: not owned by the store owner
            if (p && p.is_active && p.stock_quantity > 0 && !ownProductIds.has(p.id) && p.owner_id !== store?.owner_id) {
              partnerProducts.push({ ...p, isPartner: true });
            }
          });
        }
      }

      const allProducts = [...ownProducts, ...partnerProducts];
      if (allProducts.length === 0) return [];

      // Fetch variants for all products (including marketing fields and video)
      const { data: variants } = await supabase
        .from("product_variants")
        .select("id, product_id, size, stock_quantity, image_url, image_url_2, image_url_3, video_url, marketing_status, marketing_prices, marketing_delivery_days")
        .in("product_id", allProducts.map(p => p.id))
        .gt("stock_quantity", 0);

      // Helper to determine the highest priority marketing status (for public display)
      // Note: 'secret' is handled separately and not prioritized here
      const getPriorityMarketingStatus = (statuses: MarketingStatus[]): MarketingStatus => {
        // Priority: opportunity > presale > launch > secret > null
        // Flatten all arrays and check for each status
        for (const s of statuses) {
          if (s?.includes("opportunity")) return ["opportunity"];
        }
        for (const s of statuses) {
          if (s?.includes("presale")) return ["presale"];
        }
        for (const s of statuses) {
          if (s?.includes("launch")) return ["launch"];
        }
        for (const s of statuses) {
          if (s?.includes("secret")) return ["secret"];
        }
        return null;
      };

      // Create display items - unifying own and partner products by name+color
      const displayItems: CatalogDisplayItem[] = [];
      
      // Key: normalized name + color
      const makeCardKey = (name: string, color: string | null) => 
        `${name.toLowerCase().trim()}_${(color || '').toLowerCase().trim()}`;

      // First pass: collect all variants from own and partner products organized by name+color
      interface SizeInfo {
        size: string;
        isPartner: boolean;
        marketingStatus: MarketingStatus;
        marketingPrices: MarketingPrices;
        marketingDeliveryDays: number | null;
        stock: number;
      }
      
      interface CardData {
        productId: string;
        name: string;
        description: string | null;
        price: number;
        category: string;
        category_2?: string | null;
        category_3?: string | null;
        main_category: string | null;
        subcategory: string | null;
        is_new_release: boolean;
        color: string | null;
        model: string | null;
        color_label: string | null;
        custom_detail: string | null;
        image_url: string | null;
        image_url_2: string | null;
        image_url_3: string | null;
        video_url: string | null;
        owner_id: string;
        sizes: SizeInfo[];
      }

      const cardDataMap = new Map<string, CardData>();

      // Process own products first (they have priority)
      for (const product of ownProducts) {
        const productVariants: ProductVariant[] = (variants?.filter(v => v.product_id === product.id) || []).map(v => ({
          ...v,
          marketing_status: (v.marketing_status as MarketingStatusValue[] | null) || null,
          marketing_prices: ((v as any).marketing_prices as MarketingPrices) || null,
          marketing_delivery_days: v.marketing_delivery_days ? Number(v.marketing_delivery_days) : null
        }));
        
        // Use color_label if available, fallback to color for legacy support
        const productColorLabel = (product as any).color_label || product.color;
        const productModel = (product as any).model || null;
        const productCustomDetail = (product as any).custom_detail || null;
        
        if (productVariants.length > 0) {
          // Card key now based on full product name (which includes color in new structure)
          const cardKey = makeCardKey(product.name, productColorLabel);
          
          // Get images from product level (new structure)
          const productImage = product.image_url;
          const productImage2 = (product as any).image_url_2 || null;
          const productImage3 = (product as any).image_url_3 || null;
          
          // Video is at product level
          const variantWithVideo = productVariants.find(v => v.video_url);
          const variantVideoUrl = variantWithVideo?.video_url || product.video_url;
          
          const sizeInfos: SizeInfo[] = productVariants
            .filter(v => v.size)
            .map(v => ({
              size: v.size,
              isPartner: false,
              marketingStatus: v.marketing_status,
              marketingPrices: v.marketing_prices,
              marketingDeliveryDays: v.marketing_delivery_days,
              stock: v.stock_quantity,
            }));

          cardDataMap.set(cardKey, {
              productId: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              category: product.category,
              category_2: (product as any).category_2,
              category_3: (product as any).category_3,
              main_category: (product as any).main_category || null,
              subcategory: (product as any).subcategory || null,
              is_new_release: !!(product as any).is_new_release,
            color: productColorLabel,
            model: productModel,
            color_label: productColorLabel,
            custom_detail: productCustomDetail,
            image_url: productImage,
            image_url_2: productImage2,
            image_url_3: productImage3,
              video_url: variantVideoUrl,
              owner_id: product.owner_id,
              sizes: sizeInfos,
            });
        } else {
          // Product without variants
          const cardKey = makeCardKey(product.name, productColorLabel);
          
          const sizeInfos: SizeInfo[] = product.size ? [{
            size: product.size,
            isPartner: false,
            marketingStatus: null,
            marketingPrices: null,
            marketingDeliveryDays: null,
            stock: product.stock_quantity,
          }] : [];
          
          cardDataMap.set(cardKey, {
            productId: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            category_2: (product as any).category_2,
            category_3: (product as any).category_3,
            main_category: (product as any).main_category || null,
            subcategory: (product as any).subcategory || null,
            is_new_release: !!(product as any).is_new_release,
            color: productColorLabel,
            model: productModel,
            color_label: productColorLabel,
            custom_detail: productCustomDetail,
            image_url: product.image_url,
            image_url_2: (product as any).image_url_2 || null,
            image_url_3: (product as any).image_url_3 || null,
            video_url: product.video_url,
            owner_id: product.owner_id,
            sizes: sizeInfos,
          });
        }
      }

      // Process partner products - add sizes that don't exist in own stock
      for (const product of partnerProducts) {
        const productColorLabel = (product as any).color_label || product.color;
        const productModel = (product as any).model || null;
        const productCustomDetail = (product as any).custom_detail || null;
        
        const productVariants: ProductVariant[] = (variants?.filter(v => v.product_id === product.id) || []).map(v => ({
          ...v,
          marketing_status: (v.marketing_status as MarketingStatusValue[] | null) || null,
          marketing_prices: ((v as any).marketing_prices as MarketingPrices) || null,
          marketing_delivery_days: v.marketing_delivery_days ? Number(v.marketing_delivery_days) : null
        }));
        
        if (productVariants.length > 0) {
          const cardKey = makeCardKey(product.name, productColorLabel);
          
          const existing = cardDataMap.get(cardKey);
          
          if (existing) {
            // Card exists (from own products) - add partner sizes that don't exist
            const existingSizeSet = new Set(existing.sizes.map(s => s.size.toLowerCase().trim()));
            
            productVariants.forEach(v => {
              if (!existingSizeSet.has(v.size.toLowerCase().trim())) {
                existing.sizes.push({
                  size: v.size,
                  isPartner: true,
                  marketingStatus: v.marketing_status,
                  marketingPrices: v.marketing_prices,
                  marketingDeliveryDays: v.marketing_delivery_days,
                  stock: v.stock_quantity,
                });
              }
            });
          } else {
            // No existing card - create new one with partner product
            const productImage = product.image_url;
            const productImage2 = (product as any).image_url_2 || null;
            const productImage3 = (product as any).image_url_3 || null;
            const variantWithVideo = productVariants.find(v => v.video_url);
            const variantVideoUrl = variantWithVideo?.video_url || product.video_url;
            
            const sizeInfos: SizeInfo[] = productVariants
              .filter(v => v.size)
              .map(v => ({
                size: v.size,
                isPartner: true,
                marketingStatus: v.marketing_status,
                marketingPrices: v.marketing_prices,
                marketingDeliveryDays: v.marketing_delivery_days,
                stock: v.stock_quantity,
              }));
            
            cardDataMap.set(cardKey, {
              productId: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              category: product.category,
              category_2: (product as any).category_2,
              category_3: (product as any).category_3,
              main_category: (product as any).main_category || null,
              subcategory: (product as any).subcategory || null,
              is_new_release: !!(product as any).is_new_release,
              color: productColorLabel,
              model: productModel,
              color_label: productColorLabel,
              custom_detail: productCustomDetail,
              image_url: productImage,
              image_url_2: productImage2,
              image_url_3: productImage3,
              video_url: variantVideoUrl,
              owner_id: product.owner_id,
              sizes: sizeInfos,
            });
          }
        }
      }

      // Convert card data map to display items
      for (const [cardKey, cardData] of cardDataMap) {
        const sizes = cardData.sizes.map(s => s.size);
        const totalStock = cardData.sizes.reduce((sum, s) => sum + s.stock, 0);
        
        // Build maps per size
        const sizeMarketingStatus: Record<string, MarketingStatus> = {};
        const sizeMarketingPrices: Record<string, MarketingPrices> = {};
        const sizeMarketingDeliveryDays: Record<string, number | null> = {};
        const sizeIsPartner: Record<string, boolean> = {};
        
        cardData.sizes.forEach(s => {
          sizeMarketingStatus[s.size] = s.marketingStatus;
          sizeMarketingPrices[s.size] = s.marketingPrices;
          sizeMarketingDeliveryDays[s.size] = s.marketingDeliveryDays;
          sizeIsPartner[s.size] = s.isPartner;
        });
        
        // Determine marketing status for the card
        const allStatuses = cardData.sizes.map(s => s.marketingStatus);
        const marketingStatus = getPriorityMarketingStatus(allStatuses);
        
        const prioritySizeInfo = cardData.sizes.find(s => s.marketingStatus === marketingStatus);
        const marketingPrices = prioritySizeInfo?.marketingPrices ?? null;
        const marketingDeliveryDays = prioritySizeInfo?.marketingDeliveryDays ?? null;
        
        // isPartner = true only if ALL sizes are from partner
        const allSizesArePartner = cardData.sizes.length > 0 && cardData.sizes.every(s => s.isPartner);
        // hasPartnerSizes = true if ANY size is from partner
        const hasPartnerSizes = cardData.sizes.some(s => s.isPartner);
        
        displayItems.push({
          id: cardKey,
          productId: cardData.productId,
          name: cardData.name,
          description: cardData.description,
          price: cardData.price,
          marketingPrices,
          marketingDeliveryDays,
          category: cardData.category,
          category_2: cardData.category_2,
          category_3: cardData.category_3,
          main_category: cardData.main_category,
          subcategory: cardData.subcategory,
          is_new_release: cardData.is_new_release,
          color: cardData.color,
          model: cardData.model,
          color_label: cardData.color_label,
          custom_detail: cardData.custom_detail,
          sizes: [...new Set(sizes)],
          sizeMarketingStatus,
          sizeMarketingPrices,
          sizeMarketingDeliveryDays,
          sizeIsPartner,
          marketingStatus,
          image_url: cardData.image_url,
          image_url_2: cardData.image_url_2,
          image_url_3: cardData.image_url_3,
          video_url: cardData.video_url,
          totalStock,
          owner_id: cardData.owner_id,
          isPartner: allSizesArePartner,
          hasPartnerSizes,
        });
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

  // Get unique sizes from all products - sorted using SIZE_ORDER
  const availableSizes = useMemo(() => {
    const allSizes = catalogItems.flatMap(p => p.sizes);
    const uniqueSizes = [...new Set(allSizes)];
    return sortSizes(uniqueSizes);
  }, [catalogItems]);

  // Get unique colors from all products - sorted alphabetically
  const availableColors = useMemo(() => {
    const allColors = catalogItems
      .map(p => p.color)
      .filter((c): c is string => !!c);
    const uniqueColors = [...new Set(allColors)]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniqueColors;
  }, [catalogItems]);

  // Get unique models from all products - sorted alphabetically
  const availableModels = useMemo(() => {
    const allModels = catalogItems
      .map(p => p.model)
      .filter((m): m is string => !!m && m.trim() !== '');
    const uniqueModels = [...new Set(allModels)]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniqueModels;
  }, [catalogItems]);

  // Get unique details from all products - sorted alphabetically
  const availableDetails = useMemo(() => {
    const allDetails = catalogItems
      .map(p => p.custom_detail)
      .filter((d): d is string => !!d && d.trim() !== '');
    const uniqueDetails = [...new Set(allDetails)]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniqueDetails;
  }, [catalogItems]);

  // Filter and transform products
  // When a marketing filter is active, we group sizes with the same status into one card per product/color
  const filteredItems = useMemo(() => {
    // Helper to check customer filters
    const matchesCustomerFilters = (item: CatalogDisplayItem, sizesToCheck?: string[]) => {
      // Category filter
      if (customerFilters.categories.length > 0) {
        const productCategories = [item.category, item.category_2, item.category_3]
          .filter(Boolean)
          .map(c => c?.toLowerCase());
        const matchesAnyCategory = customerFilters.categories.some(
          cat => productCategories.includes(cat.toLowerCase())
        );
        if (!matchesAnyCategory) return false;
      }

      // Size filter - check if product has any of the selected sizes
      if (customerFilters.sizes.length > 0) {
        const itemSizes = sizesToCheck || item.sizes;
        const normalizedItemSizes = itemSizes.map(s => s.toLowerCase().trim());
        const matchesAnySize = customerFilters.sizes.some(
          size => normalizedItemSizes.includes(size.toLowerCase().trim())
        );
        if (!matchesAnySize) return false;
      }

      // Color filter
      if (customerFilters.colors.length > 0) {
        const itemColor = (item.color_label || item.color || '').toLowerCase().trim();
        const matchesAnyColor = customerFilters.colors.some(
          color => color.toLowerCase().trim() === itemColor
        );
        if (!matchesAnyColor) return false;
      }

      // Model filter
      if (customerFilters.models.length > 0) {
        const itemModel = (item.model || '').toLowerCase().trim();
        const matchesAnyModel = customerFilters.models.some(
          model => model.toLowerCase().trim() === itemModel
        );
        if (!matchesAnyModel) return false;
      }

      // Details filter
      if (customerFilters.details.length > 0) {
        const itemDetail = (item.custom_detail || '').toLowerCase().trim();
        const matchesAnyDetail = customerFilters.details.some(
          detail => detail.toLowerCase().trim() === itemDetail
        );
        if (!matchesAnyDetail) return false;
      }

      return true;
    };

    // Helper to filter out secret sizes from items (when secret area is NOT unlocked)
    const filterSecretSizes = (item: CatalogDisplayItem): CatalogDisplayItem | null => {
      if (secretAreaUnlocked) return item; // If unlocked, show all
      
      // Filter sizes that are NOT secret
      const nonSecretSizes = item.sizes.filter(size => !hasStatus(item.sizeMarketingStatus[size], "secret"));
      
      // If all sizes are secret, exclude the entire item
      if (nonSecretSizes.length === 0) return null;
      
      // If item has some secret sizes, return item with only non-secret sizes
      if (nonSecretSizes.length < item.sizes.length) {
        const newSizeMarketingStatus: Record<string, MarketingStatus> = {};
        const newSizeMarketingPrices: Record<string, MarketingPrices> = {};
        const newSizeMarketingDeliveryDays: Record<string, number | null> = {};
        const newSizeIsPartner: Record<string, boolean> = {};
        
        nonSecretSizes.forEach(size => {
          newSizeMarketingStatus[size] = item.sizeMarketingStatus[size];
          newSizeMarketingPrices[size] = item.sizeMarketingPrices[size];
          newSizeMarketingDeliveryDays[size] = item.sizeMarketingDeliveryDays[size];
          newSizeIsPartner[size] = item.sizeIsPartner[size];
        });
        
        // Recalculate marketing status for the card (excluding secret)
        const nonSecretStatuses = nonSecretSizes.map(s => newSizeMarketingStatus[s]);
        let newMarketingStatus: MarketingStatus = null;
        if (nonSecretStatuses.some(s => hasStatus(s, "opportunity"))) newMarketingStatus = ["opportunity"];
        else if (nonSecretStatuses.some(s => hasStatus(s, "presale"))) newMarketingStatus = ["presale"];
        else if (nonSecretStatuses.some(s => hasStatus(s, "launch"))) newMarketingStatus = ["launch"];
        
        return {
          ...item,
          sizes: nonSecretSizes,
          sizeMarketingStatus: newSizeMarketingStatus,
          sizeMarketingPrices: newSizeMarketingPrices,
          sizeMarketingDeliveryDays: newSizeMarketingDeliveryDays,
          sizeIsPartner: newSizeIsPartner,
          marketingStatus: newMarketingStatus,
        };
      }
      
      return item;
    };

    // If a marketing filter is active, group by product+color with matching sizes
    if (selectedMarketingFilter !== "all") {
      const groupedCards = new Map<string, CatalogDisplayItem>();
      
      // For 'secret' filter, only show if unlocked
      if (selectedMarketingFilter === "secret" && !secretAreaUnlocked) {
        return [];
      }
      
      catalogItems.forEach(item => {
        // Collect all sizes with matching marketing status for this product/color
        const matchingSizes: string[] = [];
        const matchingSizeStatuses: Record<string, MarketingStatus> = {};
        const matchingSizePrices: Record<string, MarketingPrices> = {};
        const matchingSizeDeliveryDays: Record<string, number | null> = {};
        
        // For "launch" filter, also include products marked as is_new_release
        const isLaunchFilter = selectedMarketingFilter === "launch";
        const itemIsNewRelease = isLaunchFilter && item.is_new_release;
        
        Object.entries(item.sizeMarketingStatus).forEach(([size, status]) => {
          if (hasStatus(status, selectedMarketingFilter as MarketingStatusValue) || itemIsNewRelease) {
            matchingSizes.push(size);
            matchingSizeStatuses[size] = status;
            matchingSizePrices[size] = item.sizeMarketingPrices[size] ?? null;
            matchingSizeDeliveryDays[size] = item.sizeMarketingDeliveryDays[size] ?? null;
          }
        });
        
        // If no sizes match, skip this item
        if (matchingSizes.length === 0) return;
        
        const matchesSearch = search === "" || 
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(search.toLowerCase())) ||
          (item.color && item.color.toLowerCase().includes(search.toLowerCase())) ||
          (item.model && item.model.toLowerCase().includes(search.toLowerCase())) ||
          (item.color_label && item.color_label.toLowerCase().includes(search.toLowerCase()));
        const matchesMainCat = !selectedMainCategory || 
          (selectedMainCategory.toLowerCase() === "lançamentos" 
            ? (item.is_new_release || Object.values(item.sizeMarketingStatus).some(s => hasStatus(s, "launch")))
            : (item.main_category && item.main_category.toLowerCase() === selectedMainCategory.toLowerCase()));
        const matchesSubCat = !selectedSubcategory || 
          (item.subcategory && item.subcategory.toLowerCase() === selectedSubcategory.toLowerCase());
        
        // Also check customer filters
        if (!matchesCustomerFilters(item, matchingSizes)) return;
        
        if (matchesSearch && matchesMainCat && matchesSubCat) {
          // Use the original item.id (product_color) as the grouping key
          const groupKey = item.id;
          
          // Get marketing prices from the first matching size
          const firstSize = matchingSizes[0];
          const marketingPrices = matchingSizePrices[firstSize] ?? null;
          const marketingDeliveryDays = matchingSizeDeliveryDays[firstSize] ?? null;
          
          groupedCards.set(groupKey, {
            ...item,
            id: `${item.id}_marketing`,
            sizes: sortSizes(matchingSizes), // All matching sizes grouped
            sizeMarketingStatus: matchingSizeStatuses,
            sizeMarketingPrices: matchingSizePrices,
            sizeMarketingDeliveryDays: matchingSizeDeliveryDays,
            marketingStatus: [selectedMarketingFilter as MarketingStatusValue],
            marketingPrices,
            marketingDeliveryDays,
          });
        }
      });
      
      return Array.from(groupedCards.values());
    }
    
    // Normal filtering (show grouped products) - filter out secret items unless unlocked
    return catalogItems
      .map(filterSecretSizes)
      .filter((p): p is CatalogDisplayItem => p !== null)
      .filter(p => {
        const matchesSearch = search === "" || 
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
          (p.color && p.color.toLowerCase().includes(search.toLowerCase())) ||
          (p.model && p.model.toLowerCase().includes(search.toLowerCase())) ||
          (p.color_label && p.color_label.toLowerCase().includes(search.toLowerCase()));
        const matchesMainCat = !selectedMainCategory || 
          (selectedMainCategory.toLowerCase() === "lançamentos" 
            ? (p.is_new_release || Object.values(p.sizeMarketingStatus).some(s => hasStatus(s, "launch")))
            : (p.main_category && p.main_category.toLowerCase() === selectedMainCategory.toLowerCase()));
        const matchesSubCat = !selectedSubcategory || 
          (p.subcategory && p.subcategory.toLowerCase() === selectedSubcategory.toLowerCase());
        
        // Legacy opportunity filter (category-based)
        if (showOpportunities) {
          const pCats = [p.category, p.category_2, p.category_3].filter(Boolean).map(c => c?.toLowerCase());
          const hasOpportunity = pCats.some(c => c?.toLowerCase() === "oportunidades");
          if (!hasOpportunity) return false;
        }

        // Customer filters
        if (!matchesCustomerFilters(p)) return false;
        
        return matchesSearch && matchesMainCat && matchesSubCat;
      });
  }, [catalogItems, selectedMarketingFilter, search, selectedMainCategory, selectedSubcategory, showOpportunities, customerFilters, secretAreaUnlocked]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const sendCartViaWhatsApp = () => {
    if (!store?.whatsapp_number || cart.length === 0) return;
    
    const hasPartnerProducts = cart.some(item => item.displayItem.isPartner);
    
    const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    
    let message = "Olá! Gostaria de fazer o seguinte pedido:\n\n";
    
    cart.forEach((item, index) => {
      const colorInfo = item.displayItem.color ? ` - ${item.displayItem.color}` : "";
      const partnerMark = item.displayItem.isPartner ? " *" : "";
      const emoji = index < numberEmojis.length ? numberEmojis[index] : `${index + 1}.`;
      message += `${emoji} ${item.displayItem.name}${colorInfo}${partnerMark}\n`;
      message += `Tamanho: ${item.selectedSize}\n`;
      message += `Quantidade: ${item.quantity}\n`;
      message += `Preço unitário: ${formatPrice(item.effectivePrice)}\n`;
      message += `Subtotal: ${formatPrice(item.effectivePrice * item.quantity)}\n\n`;
    });
    
    message += `✅ *TOTAL: ${formatPrice(cartTotal)}*`;
    
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

  // Google Fonts to load
  const googleFontsToLoad = [fontHeading, fontBody]
    .filter(f => f && f !== "Inter" && !customFontName)
    .filter((f, i, arr) => arr.indexOf(f) === i); // unique

  return (
    <div className="min-h-screen" style={{ backgroundColor, fontFamily: fontBody }}>
      {/* Google Fonts Loader */}
      {googleFontsToLoad.length > 0 && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?${googleFontsToLoad.map(f => `family=${f.replace(/\s+/g, '+')}:wght@400;500;600;700`).join('&')}&display=swap`}
        />
      )}
      
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
                                {formatPrice(item.effectivePrice * item.quantity)}
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
        {/* Marketing Status Filter Pills */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 mb-4 scrollbar-hide">
          <div className="flex gap-2 min-w-max justify-center">
            {/* "Todos" button always first */}
            <button
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5",
                selectedMarketingFilter === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              onClick={() => {
                setSelectedMarketingFilter("all");
                setShowOpportunities(false);
              }}
            >
              Todos
            </button>
            
            {/* Dynamic filter buttons based on store config */}
            {(() => {
              const filterConfig = store.filter_buttons_config || defaultFilterButtonsConfig;
              const buttonKeys = ["opportunity", "presale", "launch"] as const;
              const icons: Record<string, typeof Flame> = {
                opportunity: Flame,
                presale: Clock,
                launch: Rocket,
              };
              
              return buttonKeys
                .filter(key => filterConfig[key].visible)
                .sort((a, b) => filterConfig[a].order - filterConfig[b].order)
                .map((key) => {
                  const config = filterConfig[key];
                  const Icon = icons[key];
                  const isSelected = selectedMarketingFilter === key;
                  
                  return (
                    <button
                      key={key}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5",
                        isSelected
                          ? "text-white shadow-lg"
                          : "hover:opacity-80"
                      )}
                      style={{
                        backgroundColor: isSelected ? config.color : `${config.color}15`,
                        color: isSelected ? 'white' : config.color
                      }}
                      onClick={() => {
                        setSelectedMarketingFilter(selectedMarketingFilter === key ? "all" : key);
                        setShowOpportunities(false);
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                    </button>
                  );
                });
            })()}
            
            {/* Secret Area Button - only show if active */}
            {store.secret_area_active && store.secret_area_password && (
              <button
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5",
                  secretAreaUnlocked
                    ? "bg-rose-500 text-white shadow-lg"
                    : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                )}
                onClick={() => {
                  if (secretAreaUnlocked) {
                    // Toggle filter to show only secret items
                    setSelectedMarketingFilter(selectedMarketingFilter === "secret" ? "all" : "secret");
                    setShowOpportunities(false);
                  } else {
                    // Open password dialog
                    setShowSecretDialog(true);
                  }
                }}
              >
                <Lock className="h-3.5 w-3.5" />
                {store.secret_area_name || "Área VIP"}
                {secretAreaUnlocked && (
                  <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                    ✓
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex items-center gap-3 max-w-md mx-auto mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 rounded-full border-gray-200 bg-gray-50 focus:bg-white transition-colors"
            />
          </div>
          <CustomerFilters
            availableCategories={categories}
            availableSizes={availableSizes}
            availableModels={availableModels}
            availableColors={availableColors}
            availableDetails={availableDetails}
            filters={customerFilters}
            onFiltersChange={setCustomerFilters}
            primaryColor={primaryColor}
          />
        </div>

        {/* Active Filters Display */}
        <ActiveFiltersDisplay
          filters={customerFilters}
          onFiltersChange={setCustomerFilters}
          primaryColor={primaryColor}
        />

        {/* System Category Pills - Main Categories with Subcategories */}
        {(() => {
          const filterConfig = store.filter_buttons_config || defaultFilterButtonsConfig;
          const categoriesConfig = filterConfig.categories;
          
          if (!categoriesConfig.visible || systemMainCategories.length === 0) return null;
          
          const subcatsForSelected = selectedMainCategory 
            ? systemSubcategories.filter(sc => {
                const mainCat = systemMainCategories.find(mc => mc.name === selectedMainCategory);
                return mainCat && sc.main_category_id === mainCat.id;
              })
            : [];
          
          return (
            <div className="mb-6">
              {/* Main Categories */}
              <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                <div className="flex gap-2 min-w-max">
                  {systemMainCategories.map(cat => (
                    <button
                      key={cat.id}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 hover:opacity-80"
                      )}
                      style={{
                        backgroundColor: selectedMainCategory === cat.name ? categoriesConfig.color : '#f3f4f6',
                        color: selectedMainCategory === cat.name ? 'white' : '#4b5563'
                      }}
                      onClick={() => {
                        if (selectedMainCategory === cat.name) {
                          setSelectedMainCategory(null);
                          setSelectedSubcategory(null);
                          setSearchParams(prev => { prev.delete("categoria"); prev.delete("sub"); return prev; }, { replace: true });
                        } else {
                          setSelectedMainCategory(cat.name);
                          setSelectedSubcategory(null);
                          setSearchParams(prev => { prev.set("categoria", cat.name); prev.delete("sub"); return prev; }, { replace: true });
                        }
                        setShowOpportunities(false);
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Subcategories - shown when a main category with subcategories is selected */}
              {selectedMainCategory && subcatsForSelected.length > 0 && (
                <div className="overflow-x-auto pb-2 -mx-4 px-4 mt-2 scrollbar-hide">
                  <div className="flex gap-2 min-w-max">
                    <button
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 hover:opacity-80"
                      )}
                      style={{
                        backgroundColor: !selectedSubcategory ? `${categoriesConfig.color}30` : '#f3f4f6',
                        color: !selectedSubcategory ? categoriesConfig.color : '#6b7280'
                      }}
                      onClick={() => { setSelectedSubcategory(null); setSearchParams(prev => { prev.delete("sub"); return prev; }, { replace: true }); }}
                    >
                      Todos
                    </button>
                    {subcatsForSelected.map(sub => (
                      <button
                        key={sub.id}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 hover:opacity-80"
                        )}
                        style={{
                          backgroundColor: selectedSubcategory === sub.name ? `${categoriesConfig.color}30` : '#f3f4f6',
                          color: selectedSubcategory === sub.name ? categoriesConfig.color : '#6b7280'
                        }}
                        onClick={() => {
                          const newVal = selectedSubcategory === sub.name ? null : sub.name;
                          setSelectedSubcategory(newVal);
                          setSearchParams(prev => { if (newVal) prev.set("sub", newVal); else prev.delete("sub"); return prev; }, { replace: true });
                        }}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy filtered link button */}
              {selectedMainCategory && (
                <div className="flex justify-end mt-2">
                  <button
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                    style={{ backgroundColor: `${categoriesConfig.color}15`, color: categoriesConfig.color }}
                    onClick={() => {
                      const url = new URL(window.location.href);
                      navigator.clipboard.writeText(url.toString());
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copiar link filtrado
                  </button>
                </div>
              )}
            </div>
          );
        })()}

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
                isStoreOwner={isStoreOwner}
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

      {/* Secret Area Floating Badge */}
      {store.secret_area_active && store.secret_area_password && !viewingSecretArea && (
        <button
          onClick={() => {
            if (secretAreaUnlocked) {
              setViewingSecretArea(true);
              setSelectedMarketingFilter("secret");
            } else {
              setShowSecretDialog(true);
            }
          }}
          className={cn(
            "fixed z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-white font-semibold text-sm transition-all hover:scale-105 hover:shadow-xl",
            "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]",
            "bottom-20 right-4 md:bottom-6 md:right-6"
          )}
          style={{ 
            backgroundColor: primaryColor,
            boxShadow: `0 0 20px ${primaryColor}40, 0 4px 20px rgba(0,0,0,0.2)`
          }}
        >
          <Lock className="h-4 w-4" />
          <span>{store.secret_area_name || "Área VIP"}</span>
          {secretAreaUnlocked && (
            <span className="ml-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
        </button>
      )}

      {/* Exit Secret Area Banner */}
      {viewingSecretArea && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-50 py-3 px-4 backdrop-blur-sm border-t shadow-lg"
          style={{ backgroundColor: `${primaryColor}f0` }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5" />
              <span className="font-semibold">{store.secret_area_name || "Área VIP"}</span>
              <span className="text-white/80 text-sm hidden sm:inline">
                — Produtos exclusivos para você
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExitSecretArea}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <X className="h-4 w-4 mr-1" />
              Sair da Área
            </Button>
          </div>
        </div>
      )}

      {/* Video Sales Bubble */}
      <VideoSalesBubble 
        previewUrl={store.bio_video_preview} 
        fullUrl={store.bio_video_full} 
      />

      {/* Minimal Footer */}
      <footer className="py-8 px-4 border-t border-gray-100 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {store.store_name}
          </p>
        </div>
      </footer>
      
      {/* Secret Area Password Dialog */}
      <Dialog open={showSecretDialog} onOpenChange={setShowSecretDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
              <Lock className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <DialogTitle className="text-center text-xl">
              Acesso Restrito
            </DialogTitle>
            <DialogDescription className="text-center">
              Esta área contém produtos exclusivos.
              <br />
              Digite a senha para acessar.
            </DialogDescription>
          </DialogHeader>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSecretAreaUnlock(secretPassword);
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="secret-password" className="sr-only">Senha de Acesso</Label>
              <Input
                id="secret-password"
                type="password"
                placeholder="Digite a senha de acesso..."
                value={secretPassword}
                onChange={(e) => setSecretPassword(e.target.value)}
                className="h-12 text-center text-lg tracking-wider"
                autoFocus
              />
            </div>
            <Button 
              type="submit"
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: primaryColor }}
              disabled={!secretPassword.trim()}
            >
              <Lock className="h-4 w-4 mr-2" />
              Entrar
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowSecretDialog(false);
                setSecretPassword("");
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Voltar para a loja
            </button>
          </form>
        </DialogContent>
      </Dialog>
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
  onAddToCart: (item: CatalogDisplayItem, size: string, effectivePrice: number) => void;
  isStoreOwner: boolean;
}

function BoutiqueProductCard({ item, primaryColor, cardBackgroundColor, onAddToCart, isStoreOwner }: BoutiqueProductCardProps) {
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [isHovering, setIsHovering] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Build media array: all images + video (if exists)
  const mediaItems = useMemo(() => {
    const items: { type: 'image' | 'video'; url: string }[] = [];
    if (item.image_url) items.push({ type: 'image', url: item.image_url });
    if (item.image_url_2) items.push({ type: 'image', url: item.image_url_2 });
    if (item.image_url_3) items.push({ type: 'image', url: item.image_url_3 });
    if (item.video_url) items.push({ type: 'video', url: item.video_url });
    return items;
  }, [item.image_url, item.image_url_2, item.image_url_3, item.video_url]);

  // Auto-cycle through media - 3 seconds for images, 10 seconds for videos
  useEffect(() => {
    if (mediaItems.length <= 1) return;

    const currentMedia = mediaItems[currentMediaIndex];
    const delay = currentMedia?.type === 'video' ? 15000 : 3000;

    intervalRef.current = setTimeout(() => {
      setCurrentMediaIndex(prev => (prev + 1) % mediaItems.length);
    }, delay);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [mediaItems.length, currentMediaIndex, mediaItems]);

  // Handle video playback when it becomes current
  useEffect(() => {
    const currentMedia = mediaItems[currentMediaIndex];
    if (currentMedia?.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [currentMediaIndex, mediaItems]);

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
    const size = selectedSize || "Único";
    // Resolve the effective price: check marketing price for the selected size/status
    const activeStatus = item.marketingStatus?.[0] as string | undefined;
    const sizePrices = size !== "Único" ? item.sizeMarketingPrices?.[size] : item.marketingPrices;
    const marketingPrice = activeStatus && sizePrices ? sizePrices[activeStatus] : null;
    const resolvedPrice = (marketingPrice && marketingPrice > 0) ? marketingPrice : item.price;
    
    onAddToCart(item, size, resolvedPrice);
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
          {/* Partner indicator - Show if card has any sizes from partner */}
          {item.hasPartnerSizes && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute left-2 top-2 z-20 w-6 h-6 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                    <Link2 className="h-3 w-3 text-primary-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.isPartner ? "Produto de parceira" : "Alguns tamanhos de parceira"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Marketing Status Badge - Top Right */}
          {item.marketingStatus && item.marketingStatus.length > 0 && (
            <Badge 
              className={cn(
                "absolute right-2 top-2 z-20 text-[10px] font-semibold border-0 flex items-center gap-1 shadow-sm",
                hasStatus(item.marketingStatus, "opportunity") && "bg-orange-500 text-white",
                hasStatus(item.marketingStatus, "presale") && !hasStatus(item.marketingStatus, "opportunity") && "bg-purple-500 text-white",
                hasStatus(item.marketingStatus, "launch") && !hasStatus(item.marketingStatus, "opportunity") && !hasStatus(item.marketingStatus, "presale") && "bg-green-500 text-white",
                hasStatus(item.marketingStatus, "secret") && !hasStatus(item.marketingStatus, "opportunity") && !hasStatus(item.marketingStatus, "presale") && !hasStatus(item.marketingStatus, "launch") && "bg-rose-500 text-white"
              )}
            >
              {hasStatus(item.marketingStatus, "opportunity") && <><Flame className="h-3 w-3" /> Oportunidade</>}
              {hasStatus(item.marketingStatus, "presale") && !hasStatus(item.marketingStatus, "opportunity") && <><Clock className="h-3 w-3" /> Pré-venda</>}
              {hasStatus(item.marketingStatus, "launch") && !hasStatus(item.marketingStatus, "opportunity") && !hasStatus(item.marketingStatus, "presale") && <><Rocket className="h-3 w-3" /> Lançamento</>}
              {hasStatus(item.marketingStatus, "secret") && !hasStatus(item.marketingStatus, "opportunity") && !hasStatus(item.marketingStatus, "presale") && !hasStatus(item.marketingStatus, "launch") && <><Lock className="h-3 w-3" /> Exclusivo</>}
            </Badge>
          )}

          {/* Wishlist Button */}
          <button 
            className={cn(
              "absolute right-2 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shadow-sm opacity-0 group-hover:opacity-100",
              item.marketingStatus && item.marketingStatus.length > 0 ? "top-10" : "top-2"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toast.success("Adicionado aos favoritos!");
            }}
          >
            <Heart className="h-4 w-4" />
          </button>

          {/* Auto-cycling media carousel */}
          {mediaItems.map((media, index) => (
            media.type === 'image' ? (
              <img
                key={`img-${index}`}
                src={media.url}
                alt={`${item.name}${item.color ? ` - ${item.color}` : ''}`}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
                  currentMediaIndex === index ? "opacity-100" : "opacity-0"
                )}
              />
            ) : (
              <video
                key={`vid-${index}`}
                ref={videoRef}
                src={media.url}
                muted
                loop
                playsInline
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
                  currentMediaIndex === index ? "opacity-100" : "opacity-0"
                )}
              />
            )
          ))}

          {/* Fallback if no media */}
          {mediaItems.length === 0 && (
            <img
              src="/placeholder.svg"
              alt={item.name}
              className="h-full w-full object-cover"
            />
          )}

          {/* Navigation arrows - show when more than one media */}
          {mediaItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMediaIndex(prev => (prev - 1 + mediaItems.length) % mediaItems.length);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-700 hover:bg-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMediaIndex(prev => (prev + 1) % mediaItems.length);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-700 hover:bg-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Media indicators (dots) */}
          {mediaItems.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
              {mediaItems.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentMediaIndex(index);
                  }}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    currentMediaIndex === index 
                      ? "bg-white w-3" 
                      : "bg-white/50 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          )}

          {/* Partner Shipping Notice removed - customer should not see explicit partner info */}
        </div>

        {/* Product Info */}
        <div className="px-1 flex flex-col gap-2">
          {/* Product Name */}
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</h3>

          {/* Price - Show marketing price if available */}
          {(() => {
            // Resolve per-status price: use the active marketing filter status to pick the right price
            const activeStatus = item.marketingStatus?.[0] as string | undefined;
            const sizePrices = selectedSize ? item.sizeMarketingPrices?.[selectedSize] : item.marketingPrices;
            const displayMarketingPrice = activeStatus && sizePrices ? sizePrices[activeStatus] : null;
            const hasSpecialPrice = displayMarketingPrice && displayMarketingPrice !== item.price;
            
            return (
              <div className="flex items-baseline gap-2">
                {hasSpecialPrice ? (
                  <>
                    <span className="text-base font-bold text-orange-600">{formatPrice(displayMarketingPrice)}</span>
                    <span className="text-xs text-gray-400 line-through">{formatPrice(item.price)}</span>
                  </>
                ) : (
                  <span className="text-base font-bold text-gray-900">{formatPrice(item.price)}</span>
                )}
              </div>
            );
          })()}
          
          {/* Delivery days indicator for presale */}
          {(() => {
            const deliveryDays = selectedSize 
              ? item.sizeMarketingDeliveryDays?.[selectedSize] 
              : item.marketingDeliveryDays;
            const isPresaleItem = selectedSize 
              ? hasStatus(item.sizeMarketingStatus?.[selectedSize], "presale")
              : hasStatus(item.marketingStatus, "presale");
              
            if (isPresaleItem && deliveryDays) {
              return (
                <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                  <Clock className="h-3 w-3" />
                  <span>Entrega em ~{deliveryDays} dias</span>
                </div>
              );
            }
            return null;
          })()}

          {/* Size Selector - Clean Pills with marketing status and partner indicators */}
          {item.sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sortSizes(item.sizes).map(size => {
                const sizeStatus = item.sizeMarketingStatus[size];
                const isSizeFromPartner = item.sizeIsPartner?.[size] || false;
                return (
                  <TooltipProvider key={size} delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSelectedSize(size === selectedSize ? "" : size)}
                          className={cn(
                            "min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium border transition-all touch-manipulation relative",
                            selectedSize === size
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-400",
                            // Marketing status ring indicator
                            hasStatus(sizeStatus, "opportunity") && selectedSize !== size && "ring-1 ring-orange-400",
                            hasStatus(sizeStatus, "presale") && selectedSize !== size && "ring-1 ring-purple-400",
                            hasStatus(sizeStatus, "launch") && selectedSize !== size && "ring-1 ring-green-400"
                          )}
                        >
                          <span className="flex items-center gap-0.5">
                            {size}
                            {isSizeFromPartner && (
                              <Link2 className={cn(
                                "h-2.5 w-2.5 ml-0.5",
                                selectedSize === size ? "text-white/70" : "text-primary/70"
                              )} />
                            )}
                          </span>
                          {/* Small dot indicator for marketing status */}
                          {sizeStatus && sizeStatus.length > 0 && selectedSize !== size && (
                            <span className={cn(
                              "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                              hasStatus(sizeStatus, "opportunity") && "bg-orange-500",
                              hasStatus(sizeStatus, "presale") && !hasStatus(sizeStatus, "opportunity") && "bg-purple-500",
                              hasStatus(sizeStatus, "launch") && !hasStatus(sizeStatus, "opportunity") && !hasStatus(sizeStatus, "presale") && "bg-green-500"
                            )} />
                          )}
                        </button>
                      </TooltipTrigger>
                      {isSizeFromPartner && (
                        <TooltipContent side="top" className="text-xs">
                          Estoque de parceira
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}

          {/* Add to Cart Button - Changes text for presale */}
          {(() => {
            // Determine if selected size is presale or if product has presale marketing
            const selectedSizeStatus = selectedSize ? item.sizeMarketingStatus[selectedSize] : null;
            const isPresale = hasStatus(selectedSizeStatus, "presale") || 
              (!selectedSize && hasStatus(item.marketingStatus, "presale"));
            
            return (
              <Button
                className={cn(
                  "w-full h-10 rounded-xl font-semibold text-xs sm:text-sm transition-all hover:shadow-lg whitespace-nowrap overflow-hidden px-2",
                  isPresale && "bg-purple-500 hover:bg-purple-600"
                )}
                style={!isPresale ? { backgroundColor: primaryColor, color: 'white' } : { color: 'white' }}
                onClick={handleAddToCart}
              >
                {isPresale ? (
                  <>
                    <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Reservar Agora</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">Adicionar</span>
                  </>
                )}
              </Button>
            );
          })()}
        </div>
      </div>

      {/* Image Lightbox Dialog with Navigation */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <button
            onClick={() => setImageOpen(false)}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          
          {/* Lightbox Navigation - Previous */}
          {mediaItems.length > 1 && (
            <button
              onClick={() => setCurrentMediaIndex(prev => (prev - 1 + mediaItems.length) % mediaItems.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          
          {/* Lightbox Navigation - Next */}
          {mediaItems.length > 1 && (
            <button
              onClick={() => setCurrentMediaIndex(prev => (prev + 1) % mediaItems.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
          
          {/* Current Media Display */}
          <div className="flex items-center justify-center p-4 min-h-[50vh]">
            {mediaItems.length > 0 && mediaItems[currentMediaIndex]?.type === 'image' ? (
              <img
                src={mediaItems[currentMediaIndex].url}
                alt={`${item.name}${item.color ? ` - ${item.color}` : ''}`}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            ) : mediaItems.length > 0 && mediaItems[currentMediaIndex]?.type === 'video' ? (
              <video
                src={mediaItems[currentMediaIndex].url}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                controls
                autoPlay
                muted
              />
            ) : item.image_url ? (
              <img
                src={item.image_url}
                alt={`${item.name}${item.color ? ` - ${item.color}` : ''}`}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            ) : null}
          </div>
          
          {/* Media Indicators */}
          {mediaItems.length > 1 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
              {mediaItems.map((media, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentMediaIndex(index)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all",
                    currentMediaIndex === index 
                      ? "bg-white w-6" 
                      : "bg-white/50 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          )}
          
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-white font-medium text-lg drop-shadow-lg">
              {item.name}
              {item.color && <span className="text-white/80"> - {item.color}</span>}
              {mediaItems.length > 1 && (
                <span className="text-white/60 ml-2">
                  ({currentMediaIndex + 1}/{mediaItems.length})
                </span>
              )}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
