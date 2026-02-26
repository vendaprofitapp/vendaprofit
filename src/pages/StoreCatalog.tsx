import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, MessageCircle, Store, Package, ShoppingCart, Plus, Minus, Trash2, X, Flame, Heart, ShoppingBag, Clock, Rocket, Layers, ChevronLeft, ChevronRight, Link2, Lock, Eye, EyeOff, Play, Video, Copy, Bell, CheckCircle2, Star, Tag } from "lucide-react";
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
import { WaitlistDialog } from "@/components/catalog/WaitlistDialog";
import { InstallmentInfo, CartProgressBar, CartInstallmentWarning, getNextTierMessage, getUnlockedTierMessage, type PurchaseIncentivesConfig, defaultIncentivesConfig } from "@/components/catalog/PurchaseIncentives";
import { LeadCaptureSheet } from "@/components/catalog/LeadCaptureSheet";
import { LoyaltyHeader } from "@/components/catalog/LoyaltyHeader";
import { VipAreaDrawer } from "@/components/catalog/VipAreaDrawer";
import { useCatalogLoyalty } from "@/hooks/useCatalogLoyalty";


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
  sizeConsignedCount: Record<string, number>; // count of consigned units per size
  sizePhysicalStock: Record<string, number>; // physical stock per size
  marketingStatus: MarketingStatus; // highest priority marketing status for the card
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  video_url: string | null;
  totalStock: number;
  owner_id: string;
  isPartner: boolean; // true if ALL sizes are from partner (for icon display)
  hasPartnerSizes: boolean; // true if ANY size is from partner
  isB2B: boolean; // true if product is from B2B dropshipping (zero local stock, from supplier)
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
  purchase_incentives_config: PurchaseIncentivesConfig | null;
  favicon_url: string | null;
  page_title: string | null;
}

export default function StoreCatalog() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(() => {
    const cat = searchParams.get("categoria");
    return cat === "Bazar VIP" ? null : cat || null;
  });
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

  // Bazar VIP state
  const [bazarMode, setBazarMode] = useState(() => searchParams.get("categoria") === "Bazar VIP");
  const [showBazarBuyerDialog, setShowBazarBuyerDialog] = useState(false);
  const [bazarBuyerPhone, setBazarBuyerPhone] = useState("");
  const [bazarBuyerVerified, setBazarBuyerVerified] = useState(false);
  const [bazarPendingItem, setBazarPendingItem] = useState<{ item: any; } | null>(null);
  const [bazarBuyerChecking, setBazarBuyerChecking] = useState(false);

  // Lead capture state (inline in cart)
  const [showLoyaltyCapture, setShowLoyaltyCapture] = useState(false);
  const [inlineLeadName, setInlineLeadName] = useState("");
  const [inlineLeadWhatsapp, setInlineLeadWhatsapp] = useState("");

  // Passive lead bar state
  const [showLeadBar, setShowLeadBar] = useState(false);
  const [leadBarDismissed, setLeadBarDismissed] = useState(() => {
    try { return sessionStorage.getItem("lead_bar_dismissed") === "true"; } catch { return false; }
  });
  const [leadBarSaved, setLeadBarSaved] = useState(false);
  const [barLeadName, setBarLeadName] = useState("");
  const [barLeadWhatsapp, setBarLeadWhatsapp] = useState("");
  

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

  

  // Save abandoned cart snapshot when cart changes
  useEffect(() => {
    if (cart.length === 0) return;
    const storedLead = getStoredLead();
    if (!storedLead?.lead_id) return;
    
    const timer = setTimeout(() => {
      saveAbandonedCart(storedLead.lead_id!, cart);
    }, 2000);
    return () => clearTimeout(timer);
  }, [cart]);

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

  // Check if lead data exists in localStorage
  const getStoredLead = (): { name: string; whatsapp: string; lead_id?: string } | null => {
    if (!slug) return null;
    try {
      const stored = localStorage.getItem(`store_lead_${slug}`);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  };

  // Save lead to localStorage and DB — detects returning customers by WhatsApp
  const saveLeadData = async (data: { name: string; whatsapp: string }): Promise<{ leadId: string; isReturning: boolean }> => {
    if (!store) {
      console.error("[LeadCapture] Store não carregada, impossível salvar lead.");
      return { leadId: "", isReturning: false };
    }

    // 1. Check if a lead already exists for this WhatsApp + store
    const { data: existingLead, error: selectErr } = await supabase
      .from("store_leads")
      .select("id, name")
      .eq("store_id", store.id)
      .eq("whatsapp", data.whatsapp)
      .maybeSingle();

    if (selectErr) {
      console.error("[LeadCapture] Erro ao buscar lead existente:", selectErr);
    }

    let leadId = "";
    let isReturning = false;

    if (existingLead) {
      // Returning customer — reuse existing lead, update last_seen
      leadId = existingLead.id;
      isReturning = true;
      await supabase
        .from("store_leads")
        .update({ last_seen_at: new Date().toISOString(), name: data.name })
        .eq("id", existingLead.id);
    } else {
      // New customer — insert new lead
      const deviceId = `${slug}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { data: leadRow, error: insertErr } = await supabase
        .from("store_leads")
        .insert({
          store_id: store.id,
          owner_id: store.owner_id,
          name: data.name,
          whatsapp: data.whatsapp,
          device_id: deviceId,
          last_seen_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[LeadCapture] Erro ao salvar lead:", insertErr);
        toast.error("Não foi possível salvar seu cadastro. Tente novamente.");
        return { leadId: "", isReturning: false };
      }
      leadId = leadRow?.id || "";
    }

    // Save to localStorage regardless of DB result
    localStorage.setItem(`store_lead_${slug}`, JSON.stringify({
      name: data.name,
      whatsapp: data.whatsapp,
      lead_id: leadId,
      captured_at: new Date().toISOString(),
    }));

    return { leadId, isReturning };
  };

  // Save cart snapshot as abandoned items
  const saveAbandonedCart = async (leadId: string, cartItems: CartItem[]) => {
    if (!leadId || cartItems.length === 0) return;
    
    // Delete old abandoned items for this lead first
    await supabase
      .from("lead_cart_items")
      .delete()
      .eq("lead_id", leadId)
      .eq("status", "abandoned");

    const items = cartItems.map(ci => ({
      lead_id: leadId,
      product_id: ci.displayItem.productId,
      product_name: ci.displayItem.name,
      variant_color: ci.displayItem.color || null,
      selected_size: ci.selectedSize,
      quantity: ci.quantity,
      unit_price: ci.effectivePrice,
      status: "abandoned" as const,
    }));

    await supabase.from("lead_cart_items").insert(items);
  };

  const addToCart = (item: CatalogDisplayItem, size: string, effectivePrice: number) => {
    doAddToCart(item, size, effectivePrice);
  };

  // Format WhatsApp for inline lead capture
  const formatInlineWhatsApp = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const isInlineLeadValid = inlineLeadName.trim().length >= 2 && inlineLeadWhatsapp.replace(/\D/g, "").length >= 10;

  const doAddToCart = (item: CatalogDisplayItem, size: string, effectivePrice: number) => {
    const prevTotal = cartTotal;
    
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
    
    // Calculate new total after adding
    const newTotal = prevTotal + effectivePrice;
    
    // Check for unlocked tier (celebratory toast)
    const unlockedMsg = getUnlockedTierMessage(prevTotal, newTotal, incentivesConfig);
    const incentiveToastClass = "!text-base !font-semibold !p-4 !shadow-lg";
    const incentiveDescClass = "!text-sm";
    if (unlockedMsg) {
      toast.success(unlockedMsg, {
        icon: "🎉",
        duration: 8000,
        className: incentiveToastClass,
        descriptionClassName: incentiveDescClass,
        description: "Aproveite seu benefício! 🎁",
      });
    } else {
      // Show contextual incentive message
      const tierMsg = getNextTierMessage(newTotal, incentivesConfig);
      if (tierMsg) {
        toast.success(`${item.name} adicionado à sacola`, {
          description: tierMsg,
          duration: 6000,
          className: incentiveToastClass,
          descriptionClassName: incentiveDescClass,
        });
      } else if (incentivesConfig.enabled && incentivesConfig.messages.on_add) {
        toast.success(`${item.name} adicionado à sacola`, {
          description: incentivesConfig.messages.on_add,
          duration: 5000,
          className: incentiveToastClass,
          descriptionClassName: incentiveDescClass,
        });
      } else {
        toast.success(`${item.name} adicionado à sacola`);
      }
    }

    // Save abandoned cart snapshot after adding
    setTimeout(() => {
      const storedLead = getStoredLead();
      if (storedLead?.lead_id) {
        // Get latest cart from DOM - we use a workaround via ref
      }
    }, 100);
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
      
      // Parse configs
      const result = {
        ...data,
        filter_buttons_config: (data.filter_buttons_config as unknown as FilterButtonsConfig) || defaultFilterButtonsConfig,
        purchase_incentives_config: (data.purchase_incentives_config as unknown as PurchaseIncentivesConfig) || defaultIncentivesConfig,
      };
      return result as StoreSettings;
    },
    enabled: !!slug,
  });

  // Passive lead bar trigger (8s timer + scroll > 300px)
  useEffect(() => {
    const leadCaptureEnabled = (store as any)?.lead_capture_enabled !== false;
    if (!leadCaptureEnabled || leadBarDismissed || leadBarSaved) return;
    const storedLead = getStoredLead();
    if (storedLead?.lead_id) return;

    let activated = false;
    const activate = () => { if (!activated) { activated = true; setShowLeadBar(true); } };

    const timer = setTimeout(activate, 8000);
    const handleScroll = () => { if (window.scrollY > 300) activate(); };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [store, leadBarDismissed, leadBarSaved]);

  // Incentives config - after store query
  const incentivesConfig: PurchaseIncentivesConfig = (store?.purchase_incentives_config as PurchaseIncentivesConfig) || defaultIncentivesConfig;

  // Loyalty: only load if loyalty_enabled on store
  const loyaltyEnabled = (store as any)?.loyalty_enabled === true;
  const storedLeadForLoyalty = slug ? (() => { try { const s = localStorage.getItem(`store_lead_${slug}`); return s ? JSON.parse(s) : null; } catch { return null; } })() : null;
  const loyaltyPhone = loyaltyEnabled ? (storedLeadForLoyalty?.whatsapp || undefined) : undefined;
  const loyalty = useCatalogLoyalty(loyaltyEnabled ? store?.owner_id : undefined, loyaltyPhone);

  // Dynamic title, favicon, apple-touch-icon & PWA manifest
  useEffect(() => {
    if (!store) return;
    const originalTitle = document.title;
    document.title = store.page_title || store.store_name || "Venda PROFIT";

    const faviconUrl = store.favicon_url;
    let oldFaviconHref: string | null = null;
    let oldAppleIconHref: string | null = null;
    let manifestBlobUrl: string | null = null;
    let oldManifestHref: string | null = null;

    if (faviconUrl) {
      const bustUrl = faviconUrl + (faviconUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();

      // Update favicon
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (link) {
        oldFaviconHref = link.href;
        link.href = bustUrl;
      } else {
        link = document.createElement("link");
        link.rel = "icon";
        link.href = bustUrl;
        document.head.appendChild(link);
      }

      // Update apple-touch-icon
      const appleIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
      if (appleIcon) {
        oldAppleIconHref = appleIcon.href;
        appleIcon.href = bustUrl;
      }
    }

    // Dynamic PWA manifest
    const manifestLink = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (manifestLink) {
      oldManifestHref = manifestLink.href;
      const dynamicManifest = {
        name: store.page_title || store.store_name || "Venda PROFIT",
        short_name: store.store_name || "Loja",
        start_url: "/" + store.store_slug,
        display: "standalone",
        background_color: store.background_color || "#ffffff",
        theme_color: store.primary_color || "#DA2576",
        icons: faviconUrl
          ? [
              { src: faviconUrl, type: "image/png", sizes: "192x192" },
              { src: faviconUrl, type: "image/png", sizes: "512x512" },
            ]
          : [
              { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
              { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
            ],
      };
      const blob = new Blob([JSON.stringify(dynamicManifest)], { type: "application/json" });
      manifestBlobUrl = URL.createObjectURL(blob);
      manifestLink.href = manifestBlobUrl;
    }

    return () => {
      document.title = originalTitle;
      if (oldFaviconHref) {
        const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (link) link.href = oldFaviconHref;
      }
      if (oldAppleIconHref) {
        const appleIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
        if (appleIcon) appleIcon.href = oldAppleIconHref;
      }
      if (oldManifestHref) {
        const ml = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
        if (ml) ml.href = oldManifestHref;
      }
      if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
    };
  }, [store]);

  // --- Analytics Tracking ---
  const viewBatchRef = useRef<{ product_id: string; store_id: string; owner_id: string; device_id: string }[]>([]);
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDeviceId = useCallback(() => {
    const key = `device_id_${slug}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }, [slug]);

  const flushViewBatch = useCallback(() => {
    const batch = viewBatchRef.current;
    if (batch.length === 0) return;
    viewBatchRef.current = [];
    supabase.from("catalog_product_views").insert(batch as any).then(() => {});
  }, []);

  const trackProductView = useCallback((productId: string) => {
    if (!store) return;
    viewBatchRef.current.push({
      product_id: productId,
      store_id: store.id,
      owner_id: store.owner_id,
      device_id: getDeviceId(),
    });
    if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    viewTimerRef.current = setTimeout(flushViewBatch, 5000);
  }, [store, getDeviceId, flushViewBatch]);

  useEffect(() => {
    return () => {
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
      if (viewBatchRef.current.length > 0) {
        const batch = [...viewBatchRef.current];
        viewBatchRef.current = [];
        supabase.from("catalog_product_views").insert(batch as any).then(() => {});
      }
    };
  }, []);

  const trackSearch = useCallback((term: string, resultsCount: number) => {
    if (!store || term.trim().length < 3) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      supabase.from("catalog_search_logs").insert({
        store_id: store.id,
        owner_id: store.owner_id,
        search_term: term.toLowerCase().trim(),
        results_count: resultsCount,
        device_id: getDeviceId(),
      } as any).then(() => {});
    }, 1000);
  }, [store, getDeviceId]);

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

  

  // Check if store owner has bazar items (for showing BAZAR VIP button)
  const { data: bazarItemsCount = 0 } = useQuery({
    queryKey: ["bazar-items-count", store?.owner_id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("bazar_items")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", store!.owner_id)
        .eq("status", "approved");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!store?.owner_id,
  });

  // Fetch bazar items when bazarMode is active
  const { data: bazarItems = [], isLoading: bazarLoading } = useQuery({
    queryKey: ["bazar-catalog-items", store?.owner_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazar_items")
        .select("*")
        .eq("owner_id", store!.owner_id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!store?.owner_id && bazarMode,
  });

  // Fetch featured products for sorting
  const { data: featuredProductIds = [] } = useQuery({
    queryKey: ["featured-products-order", store?.owner_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_products")
        .select("product_id, position")
        .eq("owner_id", store!.owner_id)
        .order("position");
      if (error) throw error;
      return data || [];
    },
    enabled: !!store?.owner_id,
  });

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

  // Fetch HUB connections where the store owner is the owner (has active sellers)
  const { data: hubSharedProductIds = [] } = useQuery({
    queryKey: ["hub-shared-product-ids-public", store?.owner_id],
    queryFn: async () => {
      // Public query: find connections where store owner is the SELLER
      // Uses the public RLS policy that allows anonymous access
      const { data: connections, error } = await supabase
        .from("hub_connections")
        .select("id")
        .eq("seller_id", store!.owner_id)
        .eq("status", "active");
      if (error || !connections || connections.length === 0) return [];

      const connectionIds = connections.map(c => c.id);
      const BATCH = 100;
      const allIds: string[] = [];
      for (let i = 0; i < connectionIds.length; i += BATCH) {
        const { data: sharedRows } = await supabase
          .from("hub_shared_products")
          .select("product_id")
          .in("connection_id", connectionIds.slice(i, i + BATCH))
          .eq("is_active", true);
        if (sharedRows) allIds.push(...sharedRows.map(r => r.product_id));
      }
      return [...new Set(allIds)];
    },
    enabled: !!store?.owner_id,
  });

  // Fetch products with their variants (now includes video_url)
  const { data: catalogItems = [], isLoading: productsLoading } = useQuery({
    queryKey: ["catalog-products-variants", store?.id, store?.owner_id, store?.show_own_products, allPartnershipGroupIds, hubSharedProductIds],
    queryFn: async () => {
      const ownProductIds = new Set<string>();
      const ownProducts: (Product & { isPartner: boolean; isB2B?: boolean })[] = [];
      const partnerProducts: (Product & { isPartner: boolean; isB2B?: boolean })[] = [];

      // Get own products if enabled
      if (store?.show_own_products) {
        const { data: products, error } = await supabase
          .from("products")
          .select("id, name, description, price, category, category_2, category_3, main_category, subcategory, size, color, image_url, image_url_2, image_url_3, video_url, stock_quantity, owner_id, model, color_label, custom_detail, is_new_release, b2b_product_url, supplier_id")
          .eq("owner_id", store.owner_id)
          .eq("is_active", true)
          .gt("stock_quantity", 0);
        
        if (!error && products) {
          products.forEach(p => {
            ownProductIds.add(p.id);
            ownProducts.push({ ...p, isPartner: false });
          });
        }

        // Fetch B2B clone products (products with b2b_source_product_id)
        // These are shown when the original local product has zero stock
        const { data: b2bClones, error: b2bError } = await supabase
          .from("products")
          .select("id, name, description, price, category, category_2, category_3, main_category, subcategory, size, color, image_url, image_url_2, image_url_3, video_url, stock_quantity, owner_id, model, color_label, custom_detail, is_new_release, b2b_product_url, supplier_id, b2b_source_product_id")
          .eq("owner_id", store.owner_id)
          .eq("is_active", true)
          .not("b2b_source_product_id", "is", null);

        if (!b2bError && b2bClones) {
          // Fetch visibility flags for source products
          const sourceIds = b2bClones.map(p => (p as any).b2b_source_product_id).filter(Boolean);
          const hiddenSourceIds = new Set<string>();
          if (sourceIds.length > 0) {
            const { data: sourceProducts } = await supabase
              .from("products")
              .select("id, b2b_visible_in_store")
              .in("id", sourceIds)
              .eq("b2b_visible_in_store", false);
            (sourceProducts || []).forEach(sp => hiddenSourceIds.add(sp.id));
          }

          // Only show B2B clone if the original product has zero stock AND is visible in store
          b2bClones.forEach(p => {
            const sourceId = (p as any).b2b_source_product_id;
            const originalInStock = ownProductIds.has(sourceId);
            if (!originalInStock && !ownProductIds.has(p.id) && !hiddenSourceIds.has(sourceId)) {
              ownProductIds.add(p.id);
              ownProducts.push({ ...p, isPartner: false, isB2B: true });
            }
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

      // Get HUB products (products shared with this store owner as a seller)
      const hubProducts: (Product & { isPartner: boolean; isB2B?: boolean })[] = [];
      if (hubSharedProductIds.length > 0) {
        const BATCH = 100;
        for (let i = 0; i < hubSharedProductIds.length; i += BATCH) {
          const { data: batchProducts } = await supabase
            .from("products")
            .select("id, name, description, price, category, category_2, category_3, main_category, subcategory, size, color, image_url, image_url_2, image_url_3, video_url, stock_quantity, owner_id, model, color_label, custom_detail, is_new_release")
            .in("id", hubSharedProductIds.slice(i, i + BATCH))
            .eq("is_active", true);
          if (batchProducts) {
            batchProducts.forEach(p => {
              if (!ownProductIds.has(p.id)) {
                hubProducts.push({ ...p, isPartner: true });
              }
            });
          }
        }
      }

      const allProducts = [...ownProducts, ...partnerProducts, ...hubProducts];
      if (allProducts.length === 0) return [];

      // Fetch variants for all products (including marketing fields and video)
      const productIds = allProducts.map(p => p.id);
      const b2bProductIds = new Set(allProducts.filter(p => (p as any).isB2B).map(p => p.id));
      const nonB2bProductIds = productIds.filter(id => !b2bProductIds.has(id));
      
      // Fetch variants: stock > 0 for regular products, ALL variants for B2B products
      const variantQueries: PromiseLike<{ data: any[] | null }>[] = [];
      if (nonB2bProductIds.length > 0) {
        variantQueries.push(
          supabase
            .from("product_variants")
            .select("id, product_id, size, stock_quantity, image_url, image_url_2, image_url_3, video_url, marketing_status, marketing_prices, marketing_delivery_days")
            .in("product_id", nonB2bProductIds)
            .gt("stock_quantity", 0)
        );
      }
      if (b2bProductIds.size > 0) {
        variantQueries.push(
          supabase
            .from("product_variants")
            .select("id, product_id, size, stock_quantity, image_url, image_url_2, image_url_3, video_url, marketing_status, marketing_prices, marketing_delivery_days")
            .in("product_id", Array.from(b2bProductIds))
        );
      }
      
      const variantResults = await Promise.all(variantQueries.map(q => Promise.resolve(q)));
      const variants = variantResults.flatMap(r => r.data || []);
      
      const { data: consignmentItems } = await supabase
        .from("consignment_items")
        .select("product_id, variant_id, status, consignments!inner(status)")
        .in("product_id", productIds)
        .in("status", ["pending", "active"]);

      // Build consigned count map: key = "productId_variantId" or "productId_null"
      const consignedCountMap = new Map<string, number>();
      if (consignmentItems) {
        consignmentItems.forEach((ci: any) => {
          // Filter by consignment status on the client side to avoid deep type issues
          const consignmentStatus = ci.consignments?.status;
          if (consignmentStatus !== 'active' && consignmentStatus !== 'awaiting_approval') return;
          const key = `${ci.product_id}_${ci.variant_id || 'null'}`;
          consignedCountMap.set(key, (consignedCountMap.get(key) || 0) + 1);
        });
      }

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
        variantId?: string;
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
        isB2B: boolean;
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
              variantId: v.id,
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
              isB2B: !!(product as any).isB2B,
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
            isB2B: !!(product as any).isB2B,
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
              isB2B: false,
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
        const sizeConsignedCount: Record<string, number> = {};
        const sizePhysicalStock: Record<string, number> = {};
        
        cardData.sizes.forEach(s => {
          sizeMarketingStatus[s.size] = s.marketingStatus;
          sizeMarketingPrices[s.size] = s.marketingPrices;
          sizeMarketingDeliveryDays[s.size] = s.marketingDeliveryDays;
          sizeIsPartner[s.size] = s.isPartner;
          sizePhysicalStock[s.size] = s.stock;
          // Look up consigned count by variant_id
          const consignedKey = s.variantId 
            ? `${cardData.productId}_${s.variantId}` 
            : `${cardData.productId}_null`;
          sizeConsignedCount[s.size] = consignedCountMap.get(consignedKey) || 0;
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
          sizeConsignedCount,
          sizePhysicalStock,
          marketingStatus,
          image_url: cardData.image_url,
          image_url_2: cardData.image_url_2,
          image_url_3: cardData.image_url_3,
          video_url: cardData.video_url,
          totalStock,
          owner_id: cardData.owner_id,
          isPartner: allSizesArePartner,
          hasPartnerSizes,
          isB2B: cardData.isB2B,
        });
      }

      return displayItems;
    },
    enabled: !!store,
  });


  // B2B clone enrichment: set virtual stock for B2B products (clones have stock_quantity=0 in DB but are sob encomenda)
  const enrichedCatalogItems = useMemo(() => {
    return catalogItems.map(item => {
      if (!item.isB2B) return item;

      // B2B clones: override stock to 999 (sob encomenda)
      const sizePhysicalStock: Record<string, number> = {};
      item.sizes.forEach(size => {
        sizePhysicalStock[size] = 999;
      });

      return {
        ...item,
        sizePhysicalStock,
        totalStock: 999,
      };
    });
  }, [catalogItems]);

  // Filter system main categories to only those with in-stock products
  const visibleMainCategories = useMemo(() => {
    const usedMainCats = new Set(
      enrichedCatalogItems
        .filter(item => item.totalStock > 0)
        .map(item => item.main_category?.toLowerCase())
        .filter(Boolean)
    );
    const hasLaunches = enrichedCatalogItems.some(item =>
      item.totalStock > 0 && (item.is_new_release || Object.values(item.sizeMarketingStatus).some(s => hasStatus(s, "launch")))
    );
    return systemMainCategories.filter(cat => {
      if (cat.name.toLowerCase() === "lançamentos") return hasLaunches;
      return usedMainCats.has(cat.name.toLowerCase());
    });
  }, [enrichedCatalogItems, systemMainCategories]);

  // Filter subcategories to only those with in-stock products
  const visibleSubcategories = useMemo(() => {
    const usedSubcats = new Set(
      enrichedCatalogItems
        .filter(item => item.totalStock > 0)
        .map(item => item.subcategory?.toLowerCase())
        .filter(Boolean)
    );
    return systemSubcategories.filter(sc => usedSubcats.has(sc.name.toLowerCase()));
  }, [enrichedCatalogItems, systemSubcategories]);

  // Get unique categories - sorted alphabetically, excluding "oportunidades"
  const categories = useMemo(() => {
    const allCats = enrichedCatalogItems.flatMap(p => [p.category, p.category_2, p.category_3].filter(Boolean));
    const uniqueCats = [...new Set(allCats)]
      .filter(cat => cat?.toLowerCase() !== "oportunidades")
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniqueCats;
  }, [enrichedCatalogItems]);

  // Get unique sizes from all products - sorted using SIZE_ORDER
  const availableSizes = useMemo(() => {
    const allSizes = enrichedCatalogItems.flatMap(p => p.sizes);
    const uniqueSizes = [...new Set(allSizes)];
    return sortSizes(uniqueSizes);
  }, [enrichedCatalogItems]);

  // Get unique colors from all products - sorted alphabetically
  const availableColors = useMemo(() => {
    const allColors = enrichedCatalogItems
      .map(p => p.color)
      .filter((c): c is string => !!c);
    const uniqueColors = [...new Set(allColors)]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniqueColors;
  }, [enrichedCatalogItems]);

  // Get unique models from all products - sorted alphabetically
  const availableModels = useMemo(() => {
    const allModels = enrichedCatalogItems
      .map(p => p.model)
      .filter((m): m is string => !!m && m.trim() !== '');
    const uniqueModels = [...new Set(allModels)]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniqueModels;
  }, [enrichedCatalogItems]);

  // Get unique details from all products - sorted alphabetically
  const availableDetails = useMemo(() => {
    const allDetails = enrichedCatalogItems
      .map(p => p.custom_detail)
      .filter((d): d is string => !!d && d.trim() !== '');
    const uniqueDetails = [...new Set(allDetails)]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return uniqueDetails;
  }, [enrichedCatalogItems]);

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
      
      enrichedCatalogItems.forEach(item => {
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
    return enrichedCatalogItems
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
  }, [enrichedCatalogItems, selectedMarketingFilter, search, selectedMainCategory, selectedSubcategory, showOpportunities, customerFilters, secretAreaUnlocked]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const generateShortCode = (): string => {
    const hex = Math.random().toString(16).substring(2, 6).toUpperCase();
    return `VP-${hex}`;
  };

  const getItemSource = (item: CartItem): string => {
    if (item.displayItem.isB2B) return "b2b";
    if (item.displayItem.isPartner) return "partner";
    return "local";
  };

  const getSourceLabel = (source: string): string => {
    switch (source) {
      case "b2b": return "[Sob Encomenda]";
      case "partner": return "[Parceira]";
      default: return "[Estoque]";
    }
  };

  const sendCartViaWhatsApp = async () => {
    if (!store?.whatsapp_number || cart.length === 0) return;

    try {
      const storedLead = getStoredLead();
      const customerName = storedLead?.name || inlineLeadName.trim();
      const customerPhone = (storedLead?.whatsapp || inlineLeadWhatsapp).replace(/\D/g, "");
      const shortCode = generateShortCode();

      // 1. Save cart (saved_carts + saved_cart_items)
      const { data: savedCart } = await supabase
        .from("saved_carts")
        .insert({
          short_code: shortCode,
          store_id: store.id,
          owner_id: store.owner_id,
          lead_id: storedLead?.lead_id || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          total: cartTotal,
          status: "waiting",
        } as any)
        .select("id")
        .single();

      if (savedCart) {
        const cartItems = cart.map(item => ({
          cart_id: savedCart.id,
          product_id: item.displayItem.productId,
          product_name: item.displayItem.name,
          variant_color: item.displayItem.color || null,
          selected_size: item.selectedSize,
          quantity: item.quantity,
          unit_price: item.effectivePrice,
          source: getItemSource(item),
        }));
        await supabase.from("saved_cart_items").insert(cartItems as any);
      }

      // 2. Insert sale with source='catalog' to trigger BotConversa webhook
      await supabase.from("sales").insert({
        owner_id: store.owner_id,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_method: "Pendente",
        subtotal: cartTotal,
        total: cartTotal,
        discount_amount: 0,
        status: "completed",
        sale_source: "catalog",
        notes: `Pedido via catálogo ${shortCode}`,
      } as any);

      // 3. Mark lead_cart_items as converted
      if (storedLead?.lead_id) {
        await supabase
          .from("lead_cart_items")
          .update({ status: "converted" } as any)
          .eq("lead_id", storedLead.lead_id)
          .eq("status", "abandoned");
      }

      // 4. Build WhatsApp message and open
      const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      let message = `🧾 *Código do pedido: ${shortCode}*\n\n`;
      message += "Olá! Gostaria de fazer o seguinte pedido:\n\n";

      cart.forEach((item, index) => {
        const colorInfo = item.displayItem.color ? ` - ${item.displayItem.color}` : "";
        const source = getItemSource(item);
        const sourceLabel = getSourceLabel(source);
        const emoji = index < numberEmojis.length ? numberEmojis[index] : `${index + 1}.`;
        message += `${emoji} ${item.displayItem.name}${colorInfo} ${sourceLabel}\n`;
        message += `Tamanho: ${item.selectedSize}\n`;
        message += `Quantidade: ${item.quantity}\n`;
        message += `Preço unitário: ${formatPrice(item.effectivePrice)}\n`;
        message += `Subtotal: ${formatPrice(item.effectivePrice * item.quantity)}\n\n`;
      });

      message += `✅ *TOTAL: ${formatPrice(cartTotal)}*`;

      const phone = store.whatsapp_number!.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank");

      toast.success("Pedido enviado com sucesso! 🎉");
      setCartOpen(false);
      setCart([]);
    } catch (err) {
      console.error("Erro ao finalizar pedido:", err);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    }
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
                    {/* Purchase Incentives Progress Bar */}
                    <CartProgressBar
                      cartTotal={cartTotal}
                      config={incentivesConfig}
                      primaryColor={primaryColor}
                    />
                    {/* Installment minimum warning */}
                    <CartInstallmentWarning
                      cartTotal={cartTotal}
                      config={incentivesConfig}
                    />
                    
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
                    
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total</span>
                        <span className="text-xl font-bold text-gray-900">
                          {formatPrice(cartTotal)}
                        </span>
                      </div>

                      {/* Inline Lead Capture - always visible */}
                      {(() => {
                        const storedLead = getStoredLead();

                        if (storedLead?.lead_id) {
                          return (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                              <span className="text-sm text-green-800 truncate">{storedLead.name}</span>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">Preencha para finalizar:</p>
                            <Input
                              placeholder="Seu nome"
                              value={inlineLeadName}
                              onChange={e => setInlineLeadName(e.target.value)}
                              onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 350)}
                              inputMode="text"
                              maxLength={100}
                              className="h-9 text-sm"
                            />
                            <Input
                              placeholder="(00) 00000-0000"
                              value={inlineLeadWhatsapp}
                              onChange={e => setInlineLeadWhatsapp(formatInlineWhatsApp(e.target.value))}
                              onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 350)}
                              inputMode="tel"
                              maxLength={16}
                              className="h-9 text-sm"
                            />
                          </div>
                        );
                      })()}
                      
                      <Button 
                        className="w-full h-12 gap-2 text-base font-semibold rounded-xl"
                        style={{ backgroundColor: "#25D366" }}
                        onClick={async () => {
                          const storedLead = getStoredLead();
                          // Save inline lead data before checkout if needed
                          if (!storedLead?.lead_id && isInlineLeadValid) {
                            const { isReturning } = await saveLeadData({ name: inlineLeadName.trim(), whatsapp: inlineLeadWhatsapp });
                            if (isReturning) {
                              toast.success(`Bem-vindo(a) de volta, ${inlineLeadName.trim()}! 🎉`);
                            } else {
                              toast.success(`Bem-vindo(a), ${inlineLeadName.trim()}! 🎉`);
                            }
                          }
                          sendCartViaWhatsApp();
                        }}
                        disabled={!store.whatsapp_number || (() => {
                          const storedLead = getStoredLead();
                          return !storedLead?.lead_id && !isInlineLeadValid;
                        })()}
                      >
                        <MessageCircle className="h-5 w-5" />
                        Enviar pedido
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

      {/* Loyalty Header */}
      {loyaltyEnabled && (
        <LoyaltyHeader
          isIdentified={!!loyaltyPhone}
          currentLevel={loyalty.currentLevel}
          nextLevel={loyalty.nextLevel}
          progress={loyalty.progress}
          amountToNext={loyalty.amountToNext}
          totalSpent={loyalty.totalSpent}
          isLoading={loyalty.isLoading}
          onIdentify={() => setShowLoyaltyCapture(true)}
          primaryColor={primaryColor}
        />
      )}

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
                setBazarMode(false);
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
                        setBazarMode(false);
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

            {/* Bazar VIP button removed - entry via category badge only */}
          </div>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex items-center gap-3 max-w-md mx-auto mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                trackSearch(e.target.value, filteredItems.length);
              }}
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
          
          if (!categoriesConfig.visible || visibleMainCategories.length === 0) return null;
          
          const activeMainCatName = bazarMode ? "Bazar VIP" : selectedMainCategory;
          const subcatsForSelected = activeMainCatName 
            ? visibleSubcategories.filter(sc => {
                const mainCat = systemMainCategories.find(mc => mc.name === activeMainCatName);
                return mainCat && sc.main_category_id === mainCat.id;
              })
            : [];
          
          return (
            <div className="mb-6">
              {/* Main Categories */}
              <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                <div className="flex gap-2 min-w-max">
                  {visibleMainCategories.map(cat => (
                    <button
                      key={cat.id}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 hover:opacity-80"
                      )}
                      style={{
                        backgroundColor: (cat.name === "Bazar VIP" ? bazarMode : selectedMainCategory === cat.name) ? categoriesConfig.color : '#f3f4f6',
                        color: (cat.name === "Bazar VIP" ? bazarMode : selectedMainCategory === cat.name) ? 'white' : '#4b5563'
                      }}
                      onClick={() => {
                        // If "Bazar VIP" category, activate bazarMode instead of filtering products
                        if (cat.name === "Bazar VIP") {
                          setBazarMode(true);
                          setSelectedMainCategory(null);
                          setSelectedSubcategory(null);
                          setSelectedMarketingFilter("all");
                          setShowOpportunities(false);
                          setSearchParams(prev => { prev.delete("categoria"); prev.delete("sub"); return prev; }, { replace: true });
                          return;
                        }
                        setBazarMode(false);
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
              {(selectedMainCategory || bazarMode) && subcatsForSelected.length > 0 && (
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
        {bazarMode ? (
          // BAZAR VIP Grid
          bazarLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-gray-100 rounded-xl mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (() => {
            // Filter bazar items by selected subcategory
            const filteredBazar = selectedSubcategory
              ? bazarItems.filter((item) => item.subcategory === selectedSubcategory)
              : bazarItems;
            return filteredBazar.length === 0 ? (
            <div className="text-center py-16">
              <Tag className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum item no Bazar VIP</h3>
              <p className="text-gray-500 text-sm">Volte em breve para novidades!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {filteredBazar.map((item) => {
                const img = item.image_url || item.image_url_2 || item.image_url_3;
                const bazarPrice = Number(item.final_price || item.seller_price);
                return (
                  <div key={item.id} className="group flex flex-col p-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow" style={{ backgroundColor: cardBackgroundColor }}>
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100 mb-3">
                      <Badge className="absolute left-2 top-2 z-20 text-[10px] font-semibold border-0 bg-pink-600 text-white">
                        <Tag className="h-3 w-3 mr-1" />
                        Bazar VIP
                      </Badge>
                      {img ? (
                        <img src={img} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="px-1 flex flex-col gap-2">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{item.title}</h3>
                      {item.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                      )}
                      <span className="text-base font-bold text-gray-900">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(bazarPrice)}
                      </span>
                      <Button
                        className="w-full h-10 rounded-xl font-semibold text-xs sm:text-sm bg-pink-600 hover:bg-pink-700 text-white"
                        onClick={() => {
                          // Check if buyer is already verified
                          if (bazarBuyerVerified) {
                            // Add bazar item directly to cart as a CatalogDisplayItem
                            const bazarDisplayItem: CatalogDisplayItem = {
                              id: `bazar-${item.id}`,
                              productId: item.id,
                              name: item.title,
                              description: item.description,
                              price: bazarPrice,
                              marketingPrices: null,
                              marketingDeliveryDays: null,
                              category: "Bazar VIP",
                              main_category: "Bazar VIP",
                              subcategory: null,
                              is_new_release: false,
                              color: null,
                              model: null,
                              color_label: null,
                              custom_detail: null,
                              sizes: ["Único"],
                              sizeMarketingStatus: {},
                              sizeMarketingPrices: {},
                              sizeMarketingDeliveryDays: {},
                              sizeIsPartner: {},
                              sizeConsignedCount: {},
                              sizePhysicalStock: { "Único": 1 },
                              marketingStatus: null,
                              image_url: img || null,
                              image_url_2: null,
                              image_url_3: null,
                              video_url: null,
                              totalStock: 1,
                              owner_id: item.owner_id,
                              isPartner: false,
                              hasPartnerSizes: false,
                              isB2B: false,
                            };
                            addToCart(bazarDisplayItem, "Único", bazarPrice);
                          } else {
                            // Need to verify buyer first
                            setBazarPendingItem({ item });
                            setShowBazarBuyerDialog(true);
                          }
                        }}
                      >
                        <ShoppingBag className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">Comprar</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
          })()
        ) : (
          // Regular products grid
          productsLoading ? (
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
              {(() => {
                // Sort: featured products first by position, then rest
                const featuredMap = new Map(featuredProductIds.map((fp: any) => [fp.product_id, fp.position]));
                const sorted = [...filteredItems].sort((a, b) => {
                  const posA = featuredMap.get(a.productId);
                  const posB = featuredMap.get(b.productId);
                  if (posA !== undefined && posB !== undefined) return posA - posB;
                  if (posA !== undefined) return -1;
                  if (posB !== undefined) return 1;
                  return 0;
                });
                return sorted.map(item => (
                  <BoutiqueProductCard 
                    key={item.id}
                    item={item}
                    primaryColor={primaryColor}
                    cardBackgroundColor={cardBackgroundColor}
                    onAddToCart={addToCart}
                    isStoreOwner={isStoreOwner}
                    incentivesConfig={incentivesConfig}
                    onTrackView={trackProductView}
                  />
                ));
              })()}
            </div>
          )
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

      {/* Secret Area Floating Badge removed — only the top bar button remains */}

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
      {(store as any).bio_video_enabled && (
        <VideoSalesBubble 
          previewUrl={store.bio_video_preview} 
          fullUrl={store.bio_video_full} 
        />
      )}

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

      {/* Lead Capture Sheet removed — now inline in cart */}

      {/* Bazar VIP Buyer Verification Dialog */}
      <Dialog open={showBazarBuyerDialog} onOpenChange={setShowBazarBuyerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-pink-100">
              <Tag className="h-8 w-8 text-pink-600" />
            </div>
            <DialogTitle className="text-center text-xl">
              Bazar VIP
            </DialogTitle>
            <DialogDescription className="text-center">
              Para comprar no Bazar VIP, informe seu WhatsApp cadastrado.
            </DialogDescription>
          </DialogHeader>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!store || bazarBuyerChecking) return;
              setBazarBuyerChecking(true);
              try {
                const cleanPhone = bazarBuyerPhone.replace(/\D/g, "");
                const { data, error } = await supabase.rpc("validate_bazar_buyer", {
                  _owner_id: store.owner_id,
                  _buyer_phone: cleanPhone,
                });
                if (error) throw error;
                if (data === true) {
                  setBazarBuyerVerified(true);
                  setShowBazarBuyerDialog(false);
                  toast.success("Acesso liberado! Bem-vindo(a) ao Bazar VIP 🎉");
                  // If there's a pending item, add it to cart
                  if (bazarPendingItem) {
                    const item = bazarPendingItem.item;
                    const img = item.image_url || item.image_url_2 || item.image_url_3;
                    const bazarPrice = Number(item.final_price || item.seller_price);
                    const bazarDisplayItem: CatalogDisplayItem = {
                      id: `bazar-${item.id}`,
                      productId: item.id,
                      name: item.title,
                      description: item.description,
                      price: bazarPrice,
                      marketingPrices: null,
                      marketingDeliveryDays: null,
                      category: "Bazar VIP",
                      main_category: "Bazar VIP",
                      subcategory: null,
                      is_new_release: false,
                      color: null,
                      model: null,
                      color_label: null,
                      custom_detail: null,
                      sizes: ["Único"],
                      sizeMarketingStatus: {},
                      sizeMarketingPrices: {},
                      sizeMarketingDeliveryDays: {},
                      sizeIsPartner: {},
                      sizeConsignedCount: {},
                      sizePhysicalStock: { "Único": 1 },
                      marketingStatus: null,
                      image_url: img || null,
                      image_url_2: null,
                      image_url_3: null,
                      video_url: null,
                      totalStock: 1,
                      owner_id: item.owner_id,
                      isPartner: false,
                      hasPartnerSizes: false,
                      isB2B: false,
                    };
                    addToCart(bazarDisplayItem, "Único", bazarPrice);
                    setBazarPendingItem(null);
                  }
                } else {
                  toast.error("Seu número não tem permissão para comprar no Bazar VIP. Entre em contato com a loja.");
                }
              } catch (err) {
                console.error("Erro ao verificar comprador:", err);
                toast.error("Erro ao verificar. Tente novamente.");
              } finally {
                setBazarBuyerChecking(false);
              }
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="bazar-buyer-phone">Seu WhatsApp</Label>
              <Input
                id="bazar-buyer-phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={bazarBuyerPhone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  if (digits.length <= 2) setBazarBuyerPhone(digits.length ? `(${digits}` : "");
                  else if (digits.length <= 7) setBazarBuyerPhone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
                  else setBazarBuyerPhone(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`);
                }}
                className="h-12 text-center text-lg"
                inputMode="tel"
                maxLength={16}
                autoFocus
              />
            </div>
            <Button 
              type="submit"
              className="w-full h-12 text-base font-semibold bg-pink-600 hover:bg-pink-700"
              disabled={bazarBuyerPhone.replace(/\D/g, "").length < 10 || bazarBuyerChecking}
            >
              {bazarBuyerChecking ? (
                <span className="animate-spin mr-2">⏳</span>
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Verificar Acesso
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowBazarBuyerDialog(false);
                setBazarPendingItem(null);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Voltar para a loja
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Loyalty Lead Capture Sheet */}
      <LeadCaptureSheet
        open={showLoyaltyCapture}
        onOpenChange={setShowLoyaltyCapture}
        onSubmit={async (data) => {
          setShowLoyaltyCapture(false);
          await saveLeadData(data);
          toast.success(`Bem-vindo(a), ${data.name}! 🎉`);
        }}
        primaryColor={primaryColor}
      />

      {/* VIP Area Drawer */}
      {loyaltyEnabled && (
        <VipAreaDrawer
          unlockedFeatures={loyalty.unlockedFeatures}
          currentLevel={loyalty.currentLevel}
          nextLevel={loyalty.nextLevel}
          progress={loyalty.progress}
          amountToNext={loyalty.amountToNext}
          primaryColor={primaryColor}
          isIdentified={!!loyaltyPhone}
          onIdentify={() => setShowLoyaltyCapture(true)}
          ownerId={store?.owner_id}
          sellerPhone={loyaltyPhone}
          sellerName={storedLeadForLoyalty?.name}
          storeSlug={slug}
        />
      )}
      {/* Passive Lead Capture Bar */}
      {(() => {
        const leadCaptureEnabled = (store as any)?.lead_capture_enabled !== false;
        const storedLead = getStoredLead();
        const shouldShow = leadCaptureEnabled && !storedLead?.lead_id && !leadBarDismissed && showLeadBar && !leadBarSaved;
        const primaryColor = store?.primary_color || "#DA2576";

        const dismissBar = () => {
          setLeadBarDismissed(true);
          try { sessionStorage.setItem("lead_bar_dismissed", "true"); } catch {}
        };

        const handleBarSubmit = async () => {
          const name = barLeadName.trim();
          const whatsapp = barLeadWhatsapp;
          if (name.length < 2 || whatsapp.replace(/\D/g, "").length < 10) return;
          try {
            const { isReturning, leadId } = await saveLeadData({ name, whatsapp });
            if (!leadId) return; // Error toast already shown by saveLeadData
            setLeadBarSaved(true);
            setShowLeadBar(false);
            if (isReturning) {
              toast.success(`Bem-vindo(a) de volta, ${name}! 🎉`);
            } else {
              toast.success("Obrigado! Você receberá nossas novidades 💜");
            }
          } catch (err) {
            console.error("[LeadCapture] Erro inesperado na barra passiva:", err);
            toast.error("Erro ao salvar. Tente novamente.");
          }
        };

        return (
          <div
            className={cn(
              "fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t shadow-lg transition-transform duration-500 ease-out",
              shouldShow ? "translate-y-0" : "translate-y-full"
            )}
          >
            <div className="max-w-xl mx-auto px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-gray-800">Quer receber novidades? Deixe seu WhatsApp 💬</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Seu nome"
                      value={barLeadName}
                      onChange={e => setBarLeadName(e.target.value)}
                      inputMode="text"
                      maxLength={100}
                      className="h-9 text-sm flex-1"
                    />
                    <Input
                      placeholder="(00) 00000-0000"
                      value={barLeadWhatsapp}
                      onChange={e => setBarLeadWhatsapp(formatInlineWhatsApp(e.target.value))}
                      inputMode="tel"
                      maxLength={16}
                      className="h-9 text-sm flex-1"
                    />
                    <Button
                      onClick={handleBarSubmit}
                      disabled={barLeadName.trim().length < 2 || barLeadWhatsapp.replace(/\D/g, "").length < 10}
                      className="h-9 px-4 text-sm font-semibold rounded-lg shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
                <button
                  onClick={dismissBar}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
  incentivesConfig: PurchaseIncentivesConfig;
  onTrackView?: (productId: string) => void;
}

function BoutiqueProductCard({ item, primaryColor, cardBackgroundColor, onAddToCart, isStoreOwner, incentivesConfig, onTrackView }: BoutiqueProductCardProps) {
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [isHovering, setIsHovering] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const viewTrackedRef = useRef(false);

  // Track view when card becomes visible (IntersectionObserver)
  useEffect(() => {
    if (!cardRef.current || !onTrackView || viewTrackedRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewTrackedRef.current) {
          viewTrackedRef.current = true;
          onTrackView(item.productId);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [onTrackView, item.productId]);

  // Check if a size is fully consigned (available stock = 0 but physical > 0)
  const isSizeConsigned = (size: string) => {
    const physical = item.sizePhysicalStock?.[size] || 0;
    const consigned = item.sizeConsignedCount?.[size] || 0;
    return physical > 0 && consigned >= physical;
  };

  // Check if ALL sizes are consigned
  const allSizesConsigned = item.sizes.length > 0 && item.sizes.every(s => isSizeConsigned(s));
  const someSizesConsigned = item.sizes.some(s => isSizeConsigned(s));

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
        ref={cardRef}
        className="group flex flex-col p-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
        style={{ backgroundColor: cardBackgroundColor }}
        onMouseEnter={handleInteractionStart}
        onMouseLeave={handleInteractionEnd}
        onTouchStart={handleInteractionStart}
      >
        {/* Image Container - 3:4 Portrait */}
        <div 
          className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100 mb-3 cursor-pointer"
          onClick={() => { if (item.image_url) { setImageOpen(true); } }}
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

          {/* B2B "Sob Encomenda" Badge */}
          {item.isB2B && (
            <Badge 
              className="absolute left-2 bottom-2 z-20 text-[10px] font-semibold border-0 flex items-center gap-1 shadow-sm bg-orange-500 text-white"
            >
              📦 Sob Encomenda
            </Badge>
          )}

          {/* Consignment "Em Provação" Badge - when all sizes are consigned */}
          {allSizesConsigned && (
            <Badge 
              className="absolute right-2 top-2 z-20 text-[10px] font-semibold border-0 flex items-center gap-1 shadow-sm bg-yellow-500 text-white"
            >
              <Clock className="h-3 w-3" />
              Em Provação
            </Badge>
          )}

          {/* Marketing Status Badge - Top Right (only if not showing consignment badge) */}
          {!allSizesConsigned && item.marketingStatus && item.marketingStatus.length > 0 && (
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
            const displayPrice = hasSpecialPrice ? displayMarketingPrice : item.price;
            
            return (
              <>
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
                {/* Installment & PIX info */}
                <InstallmentInfo price={displayPrice} config={incentivesConfig} />
              </>
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

          {/* Size Selector - Clean Pills with marketing status, partner, and consignment indicators */}
          {item.sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sortSizes(item.sizes).map(size => {
                const sizeStatus = item.sizeMarketingStatus[size];
                const isSizeFromPartner = item.sizeIsPartner?.[size] || false;
                const isConsigned = isSizeConsigned(size);
                return (
                  <TooltipProvider key={size} delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            if (isConsigned) {
                              setWaitlistOpen(true);
                              return;
                            }
                            setSelectedSize(size === selectedSize ? "" : size);
                          }}
                          className={cn(
                            "min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium border transition-all touch-manipulation relative",
                            isConsigned
                              ? "border-yellow-300 bg-yellow-50 text-yellow-600 line-through opacity-70 cursor-pointer"
                              : selectedSize === size
                                ? "border-gray-900 bg-gray-900 text-white"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400",
                            // Marketing status ring indicator (not for consigned)
                            !isConsigned && hasStatus(sizeStatus, "opportunity") && selectedSize !== size && "ring-1 ring-orange-400",
                            !isConsigned && hasStatus(sizeStatus, "presale") && selectedSize !== size && "ring-1 ring-purple-400",
                            !isConsigned && hasStatus(sizeStatus, "launch") && selectedSize !== size && "ring-1 ring-green-400"
                          )}
                        >
                          <span className="flex items-center gap-0.5">
                            {size}
                            {isSizeFromPartner && !isConsigned && (
                              <Link2 className={cn(
                                "h-2.5 w-2.5 ml-0.5",
                                selectedSize === size ? "text-white/70" : "text-primary/70"
                              )} />
                            )}
                          </span>
                          {/* Consignment dot indicator (yellow) */}
                          {isConsigned && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-500" />
                          )}
                          {/* Small dot indicator for marketing status */}
                          {!isConsigned && sizeStatus && sizeStatus.length > 0 && selectedSize !== size && (
                            <span className={cn(
                              "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                              hasStatus(sizeStatus, "opportunity") && "bg-orange-500",
                              hasStatus(sizeStatus, "presale") && !hasStatus(sizeStatus, "opportunity") && "bg-purple-500",
                              hasStatus(sizeStatus, "launch") && !hasStatus(sizeStatus, "opportunity") && !hasStatus(sizeStatus, "presale") && "bg-green-500"
                            )} />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {isConsigned ? "Em Provação - Clique para entrar na fila" : isSizeFromPartner ? "Estoque de parceira" : null}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}

          {/* Add to Cart / Waitlist Button */}
          {(() => {
            // If all sizes are consigned, show "Entrar na Fila" button
            if (allSizesConsigned) {
              return (
                <Button
                  className="w-full h-10 rounded-xl font-semibold text-xs sm:text-sm transition-all hover:shadow-lg whitespace-nowrap overflow-hidden px-2 bg-yellow-500 hover:bg-yellow-600"
                  style={{ color: 'white' }}
                  onClick={() => setWaitlistOpen(true)}
                >
                  <Bell className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">Entrar na Fila</span>
                </Button>
              );
            }

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
      <Dialog open={imageOpen} onOpenChange={(open) => { setImageOpen(open); if (!open) setDescriptionExpanded(false); }}>
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
          
          <div className="absolute bottom-4 left-0 right-0 px-4">
            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 max-w-lg mx-auto">
              <p className="text-white font-medium text-lg text-center">
                {item.name}
                {item.color && <span className="text-white/80"> - {item.color}</span>}
                {mediaItems.length > 1 && (
                  <span className="text-white/60 ml-2 text-sm">
                    ({currentMediaIndex + 1}/{mediaItems.length})
                  </span>
                )}
              </p>
              {item.description && (
                <div className="mt-2">
                  <p className={cn(
                    "text-white/80 text-sm text-center",
                    !descriptionExpanded && "line-clamp-3"
                  )}>
                    {item.description}
                  </p>
                  {item.description.length > 100 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDescriptionExpanded(!descriptionExpanded); }}
                      className="text-white/60 text-xs mt-1 hover:text-white/90 transition-colors w-full text-center"
                    >
                      {descriptionExpanded ? "Ver menos ▲" : "Ver mais ▼"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waitlist Dialog for consigned products */}
      <WaitlistDialog
        productId={item.productId}
        productName={item.name}
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        primaryColor={primaryColor}
      />
    </>
  );
}
