import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PartnerCheckoutPasses } from "@/components/partners/PartnerCheckoutPasses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  ShoppingBag, Search, Package, MapPin, X, Plus, Minus, Trash2,
  ChevronLeft, ChevronRight, Play, Video, Store
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface PartnerPoint {
  id: string;
  name: string;
  owner_id: string;
  payment_fee_pct: number;
  access_token: string;
  payment_receiver: string;
  allowed_payment_methods: AllowedMethod[];
}

interface AllowedMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
}

interface StoreSettings {
  id: string;
  owner_id: string;
  store_name: string;
  store_slug: string | null;
  whatsapp_number: string | null;
  logo_url: string | null;
  banner_url: string | null;
  banner_url_mobile: string | null;
  primary_color: string | null;
  background_color: string | null;
  card_background_color: string | null;
  font_heading: string | null;
  font_body: string | null;
  is_banner_visible: boolean;
  banner_height_mobile: string | null;
  logo_position: string | null;
  logo_size: string | null;
  banner_link: string | null;
}

interface PartnerProduct {
  id: string; // partner_point_item id
  product_id: string;
  name: string;
  price: number;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  video_url: string | null;
  category: string | null;
  main_category: string | null;
  subcategory: string | null;
  description: string | null;
  sizes: string[]; // variants alocados
  variantMap: Record<string, string>; // size → partner_item_id
}

interface CartItem {
  partner_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  selected_size: string;
}

interface MainCategory {
  id: string;
  name: string;
  has_subcategories: boolean;
  display_order: number;
}

interface Subcategory {
  id: string;
  name: string;
  main_category_id: string;
  display_order: number;
}

// ─────────────────────────────────────────────
// BoutiqueCard
// ─────────────────────────────────────────────
const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XXG", "XXXG"];
function sortSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

function MediaCarousel({ images, videoUrl, name }: { images: (string | null)[]; videoUrl: string | null; name: string }) {
  const media = [
    ...images.filter(Boolean).map(url => ({ type: "image" as const, url: url! })),
    ...(videoUrl ? [{ type: "video" as const, url: videoUrl }] : []),
  ];
  const [idx, setIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (media.length === 0) {
    return (
      <div className="aspect-[3/4] bg-muted flex items-center justify-center">
        <Package className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }

  const current = media[idx];

  return (
    <div className="relative aspect-[3/4] overflow-hidden bg-muted select-none">
      {current.type === "image" ? (
        <img src={current.url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="relative w-full h-full" onClick={() => {
          if (videoRef.current) {
            isPlaying ? videoRef.current.pause() : videoRef.current.play();
            setIsPlaying(!isPlaying);
          }
        }}>
          <video ref={videoRef} src={current.url} className="w-full h-full object-cover" loop playsInline />
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play className="h-10 w-10 text-white drop-shadow" />
            </div>
          )}
          <Badge className="absolute top-2 right-2 text-[10px] gap-1 py-0.5 bg-black/60 border-none">
            <Video className="h-3 w-3" /> Vídeo
          </Badge>
        </div>
      )}
      {media.length > 1 && (
        <>
          <button className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 rounded-full p-1 text-white"
            onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + media.length) % media.length); setIsPlaying(false); }}>
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 rounded-full p-1 text-white"
            onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % media.length); setIsPlaying(false); }}>
            <ChevronRight className="h-3 w-3" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {media.map((_, i) => (
              <span key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === idx ? "bg-white scale-125" : "bg-white/50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface BoutiqueCardProps {
  product: PartnerProduct;
  primaryColor: string;
  onAddToCart: (product: PartnerProduct, size: string) => void;
  cartItems: CartItem[];
  observerRef: (el: HTMLDivElement | null) => void;
}

function BoutiqueCard({ product, primaryColor, onAddToCart, cartItems, observerRef }: BoutiqueCardProps) {
  const sorted = sortSizes(product.sizes);
  const inCartSizes = cartItems.filter(c => c.product_id === product.product_id).map(c => c.selected_size);
  const [selectedSize, setSelectedSize] = useState<string | null>(sorted.length === 1 ? sorted[0] : null);
  const isInCart = selectedSize ? inCartSizes.includes(selectedSize) : false;

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div ref={observerRef} className="flex flex-col rounded-xl overflow-hidden bg-card border shadow-sm">
      <MediaCarousel
        images={[product.image_url, product.image_url_2, product.image_url_3]}
        videoUrl={product.video_url}
        name={product.name}
      />
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-sm font-semibold leading-tight line-clamp-2 text-card-foreground">{product.name}</p>
        <p className="text-base font-bold" style={{ color: primaryColor }}>{fmtBRL(product.price)}</p>

        {sorted.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sorted.map(size => (
              <button
                key={size}
                className={cn(
                  "text-xs px-2 py-0.5 rounded border transition-all font-medium",
                  selectedSize === size
                    ? "text-white border-transparent"
                    : inCartSizes.includes(size)
                    ? "border-green-500 text-green-600 bg-green-50"
                    : "border-border text-muted-foreground hover:border-foreground"
                )}
                style={selectedSize === size ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                onClick={() => setSelectedSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        )}

        <Button
          size="sm"
          className="w-full mt-auto text-xs gap-1 rounded-lg"
          style={!isInCart ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
          variant={isInCart ? "outline" : "default"}
          disabled={sorted.length > 0 && !selectedSize}
          onClick={() => {
            const size = selectedSize ?? (sorted.length === 0 ? "Único" : "");
            if (!size) { toast.info("Selecione um tamanho"); return; }
            onAddToCart(product, size);
          }}
        >
          {isInCart ? (
            <><ShoppingBag className="h-3 w-3 text-green-600" /><span className="text-green-600">Na sacola</span></>
          ) : (
            <><Plus className="h-3 w-3" />Adicionar</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function PartnerCatalog() {
  const { token } = useParams<{ token: string }>();

  const [partnerPoint, setPartnerPoint] = useState<PartnerPoint | null>(null);
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [products, setProducts] = useState<PartnerProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [showFullStockDialog, setShowFullStockDialog] = useState(false);

  // Category filters
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  // Analytics tracking
  const viewedRef = useRef<Set<string>>(new Set());
  const viewBatchRef = useRef<{ product_id: string; store_id: string; owner_id: string; device_id: string; partner_point_id: string }[]>([]);
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDeviceId = useCallback(() => {
    const key = `device_id_partner_${token}`;
    let id = localStorage.getItem(key);
    if (!id) { id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem(key, id); }
    return id;
  }, [token]);

  const flushViewBatch = useCallback(() => {
    const batch = viewBatchRef.current;
    if (!batch.length) return;
    viewBatchRef.current = [];
    supabase.from("catalog_product_views").insert(batch as any).then(() => {});
  }, []);

  const trackView = useCallback((productId: string) => {
    if (!partnerPoint || !store || viewedRef.current.has(productId)) return;
    viewedRef.current.add(productId);
    viewBatchRef.current.push({
      product_id: productId,
      store_id: store.id,
      owner_id: store.owner_id,
      device_id: getDeviceId(),
      partner_point_id: partnerPoint.id,
    });
    if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    viewTimerRef.current = setTimeout(flushViewBatch, 5000);
  }, [partnerPoint, store, getDeviceId, flushViewBatch]);

  // IntersectionObserver refs per product
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pid = (entry.target as HTMLElement).dataset.productId;
          if (pid) trackView(pid);
        }
      });
    }, { threshold: 0.5 });

    cardRefs.current.forEach(el => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
      if (viewBatchRef.current.length > 0) {
        const batch = [...viewBatchRef.current];
        viewBatchRef.current = [];
        supabase.from("catalog_product_views").insert(batch as any).then(() => {});
      }
    };
  }, [trackView]);

  const registerCardRef = useCallback((productId: string) => (el: HTMLDivElement | null) => {
    if (el) {
      el.dataset.productId = productId;
      cardRefs.current.set(productId, el);
      observerRef.current?.observe(el);
    } else {
      const old = cardRefs.current.get(productId);
      if (old) observerRef.current?.unobserve(old);
      cardRefs.current.delete(productId);
    }
  }, []);

  // Lead helpers
  const getStoredLead = useCallback(() => {
    try {
      const s = localStorage.getItem(`partner_lead_${token}`);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }, [token]);

  const saveLeadData = async (data: { name: string; whatsapp: string }) => {
    if (!partnerPoint || !store) return "";

    const { data: existing } = await supabase
      .from("store_leads")
      .select("id")
      .eq("store_id", store.id)
      .eq("whatsapp", data.whatsapp)
      .maybeSingle();

    let leadId = "";
    if (existing) {
      leadId = existing.id;
      await supabase.from("store_leads").update({ last_seen_at: new Date().toISOString(), name: data.name }).eq("id", leadId);
    } else {
      const deviceId = getDeviceId();
      const { data: row } = await supabase.from("store_leads").insert({
        store_id: store.id,
        owner_id: store.owner_id,
        name: data.name,
        whatsapp: data.whatsapp,
        device_id: deviceId,
        last_seen_at: new Date().toISOString(),
      }).select("id").single();
      leadId = row?.id ?? "";
    }

    localStorage.setItem(`partner_lead_${token}`, JSON.stringify({
      name: data.name, whatsapp: data.whatsapp, lead_id: leadId, captured_at: new Date().toISOString(),
    }));
    return leadId;
  };

  // Load data
  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);

      // 1. Load partner point
      const { data: pp } = await supabase
        .from("partner_points")
        .select("id, name, owner_id, payment_fee_pct, access_token, payment_receiver, allowed_payment_methods")
        .eq("access_token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (!pp) { setNotFound(true); setLoading(false); return; }
      setPartnerPoint({
        ...pp,
        payment_receiver: (pp as any).payment_receiver ?? "partner",
        allowed_payment_methods: ((pp as any).allowed_payment_methods ?? []) as AllowedMethod[],
      });

      // 2. Load store settings (including store_slug)
      const { data: storeData } = await supabase
        .from("store_settings")
        .select("id, owner_id, store_name, store_slug, whatsapp_number, logo_url, banner_url, banner_url_mobile, primary_color, background_color, card_background_color, font_heading, font_body, is_banner_visible, banner_height_mobile, logo_position, logo_size, banner_link")
        .eq("owner_id", pp.owner_id)
        .maybeSingle();
      setStore(storeData as StoreSettings ?? null);

      // 3. Load categories in parallel
      const [{ data: mainCats }, { data: subCats }] = await Promise.all([
        supabase.from("main_categories").select("*").eq("is_active", true).order("display_order"),
        supabase.from("subcategories").select("*").eq("is_active", true).order("display_order"),
      ]);
      setMainCategories((mainCats ?? []) as MainCategory[]);
      setSubcategories((subCats ?? []) as Subcategory[]);

      // 4. Load allocated partner_point_items
      const { data: rawItems } = await supabase
        .from("partner_point_items")
        .select("id, product_id, quantity, variant_id")
        .eq("partner_point_id", pp.id)
        .eq("status", "allocated");

      if (!rawItems || rawItems.length === 0) { setLoading(false); return; }

      const productIds = [...new Set((rawItems as any[]).map(i => i.product_id))];

      // 5. Load products — now includes main_category and subcategory
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, price, image_url, image_url_2, image_url_3, video_url, category, description, size, main_category, subcategory")
        .in("id", productIds)
        .eq("is_active", true);

      // 6. Load variants for size info
      const variantIds = (rawItems as any[]).filter(i => i.variant_id).map(i => i.variant_id);
      let variantsData: any[] = [];
      if (variantIds.length > 0) {
        const { data: vd } = await supabase
          .from("product_variants")
          .select("id, product_id, size")
          .in("id", variantIds);
        variantsData = vd ?? [];
      }

      const variantMap = Object.fromEntries(variantsData.map(v => [v.id, v.size]));
      const productMap = Object.fromEntries((productsData ?? []).map(p => [p.id, p]));

      // Build PartnerProduct (one card per product, aggregating sizes)
      const productCardsMap = new Map<string, PartnerProduct>();

      for (const item of rawItems as any[]) {
        const p = productMap[item.product_id];
        if (!p) continue;

        const size = item.variant_id ? (variantMap[item.variant_id] ?? p.size ?? "Único") : (p.size ?? "Único");

        if (!productCardsMap.has(p.id)) {
          productCardsMap.set(p.id, {
            id: item.id,
            product_id: p.id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
            image_url_2: (p as any).image_url_2 ?? null,
            image_url_3: (p as any).image_url_3 ?? null,
            video_url: (p as any).video_url ?? null,
            category: p.category,
            main_category: (p as any).main_category ?? null,
            subcategory: (p as any).subcategory ?? null,
            description: p.description,
            sizes: [size],
            variantMap: { [size]: item.id },
          });
        } else {
          const card = productCardsMap.get(p.id)!;
          if (!card.sizes.includes(size)) {
            card.sizes.push(size);
            card.variantMap[size] = item.id;
          }
        }
      }

      setProducts(Array.from(productCardsMap.values()));
      setLoading(false);
    };
    load();
  }, [token]);

  // Primary color
  const primaryColor = store?.primary_color ?? "#8B5CF6";
  const backgroundColor = store?.background_color ?? "#fafaf9";

  // Cart helpers — sem verificação de lead
  const addToCart = (product: PartnerProduct, size: string) => {
    const partner_item_id = product.variantMap[size] ?? product.id;
    setCart(prev => {
      const exists = prev.find(c => c.partner_item_id === partner_item_id);
      if (exists) return prev;
      return [...prev, {
        partner_item_id,
        product_id: product.product_id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        selected_size: size,
      }];
    });
    toast.success(`${product.name} adicionado à sacola`);
  };

  const removeFromCart = (partner_item_id: string) => setCart(prev => prev.filter(c => c.partner_item_id !== partner_item_id));

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // Filter products
  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? "").toLowerCase().includes(search.toLowerCase());
    const matchMain = !selectedMainCategory || p.main_category === selectedMainCategory;
    const matchSub = !selectedSubcategory || p.subcategory === selectedSubcategory;
    return matchSearch && matchMain && matchSub;
  });

  // Subcategories for selected main category
  const subcatsForSelected = selectedMainCategory
    ? (() => {
        const mainCat = mainCategories.find(mc => mc.name === selectedMainCategory);
        return mainCat ? subcategories.filter(sc => (sc as any).main_category_id === mainCat.id) : [];
      })()
    : [];

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (notFound || !partnerPoint) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <MapPin className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-xl font-bold">Ponto não encontrado</h1>
        <p className="text-sm text-muted-foreground text-center">Este QR Code pode ser inválido ou o ponto estar inativo.</p>
      </div>
    );
  }

  // Banner URLs (responsive)
  const mobileBannerUrl = store?.banner_url_mobile || store?.banner_url;
  const desktopBannerUrl = store?.banner_url || store?.banner_url_mobile;
  const showBanner = store?.is_banner_visible && (store?.banner_url || store?.banner_url_mobile);

  // Logo sizing classes (same as StoreCatalog)
  const logoSizeClasses: Record<string, string> = {
    small: 'h-10 md:h-[60px]',
    medium: 'h-[50px] md:h-20',
    large: 'h-[60px] md:h-[100px]',
  };
  const alignClasses: Record<string, string> = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  };
  const logoPosition = store?.logo_position || 'center';
  const logoSize = store?.logo_size || 'medium';

  return (
    <div className="min-h-screen" style={{ backgroundColor, fontFamily: store?.font_body || undefined }}>

      {/* ── Header white-label (mesmo padrão do StoreCatalog) ── */}
      <header className="sticky top-0 z-50 backdrop-blur-sm border-b border-gray-100 relative"
        style={{ backgroundColor: `${backgroundColor}f5` }}>
        <div className="max-w-7xl mx-auto px-4 py-2">
          {/* Carrinho flutuante no canto */}
          <div className="absolute right-4 top-4 z-10">
            <button
              className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
              onClick={() => setCartOpen(true)}
              aria-label="Abrir sacola"
            >
              <ShoppingBag className="h-6 w-6 text-gray-700" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Logo/nome posicionado igual ao StoreCatalog */}
          <div className={cn(
            "flex flex-col w-full pr-12",
            alignClasses[logoPosition] || 'items-center text-center',
          )}>
            {store?.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.store_name || "Logo"}
                className={cn("object-contain w-auto", logoSizeClasses[logoSize] || logoSizeClasses.medium)}
              />
            ) : (
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-gray-900"
                style={{ fontFamily: store?.font_heading || undefined }}>
                {store?.store_name}
              </h1>
            )}
          </div>
        </div>
      </header>

      {/* ── Banner responsivo ── */}
      {showBanner && (
        store?.banner_link ? (
          <a href={store.banner_link} target="_blank" rel="noopener noreferrer" className="block w-full cursor-pointer hover:opacity-95 transition-opacity">
            {desktopBannerUrl && <img src={desktopBannerUrl} alt="Banner" className="hidden md:block w-full h-auto object-contain" />}
            {mobileBannerUrl && <img src={mobileBannerUrl} alt="Banner" className="block md:hidden w-full h-auto object-contain" />}
          </a>
        ) : (
          <div className="w-full">
            {desktopBannerUrl && <img src={desktopBannerUrl} alt="Banner" className="hidden md:block w-full h-auto object-contain" />}
            {mobileBannerUrl && <img src={mobileBannerUrl} alt="Banner" className="block md:hidden w-full h-auto object-contain" />}
          </div>
        )
      )}

      {/* ── Badge do Ponto Parceiro ── */}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: `${primaryColor}18` }}>
        <MapPin className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
        <p className="text-sm font-semibold" style={{ color: primaryColor }}>
          Estoque disponível em <strong>{partnerPoint.name}</strong>
        </p>
      </div>

      {/* ── Filtros e busca ── */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">

        {/* Linha 1: Botão "Ver estoque completo" (no lugar dos filtros de marketing) */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            <button
              className="px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 text-white shadow"
              style={{ backgroundColor: primaryColor }}
              onClick={() => setShowFullStockDialog(true)}
            >
              <Store className="h-3.5 w-3.5" />
              Ver estoque completo
            </button>
          </div>
        </div>

        {/* Linha 2: Busca */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar produto..."
            className="pl-11 h-12 rounded-full border-gray-200 bg-gray-50 focus:bg-white transition-colors"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Linha 3: Categorias principais */}
        {mainCategories.length > 0 && (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="flex gap-2 min-w-max">
              {mainCategories.map(cat => (
                <button
                  key={cat.id}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 hover:opacity-80"
                  style={{
                    backgroundColor: selectedMainCategory === cat.name ? primaryColor : '#f3f4f6',
                    color: selectedMainCategory === cat.name ? 'white' : '#4b5563',
                  }}
                  onClick={() => {
                    if (selectedMainCategory === cat.name) {
                      setSelectedMainCategory(null);
                      setSelectedSubcategory(null);
                    } else {
                      setSelectedMainCategory(cat.name);
                      setSelectedSubcategory(null);
                    }
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Linha 4: Subcategorias (quando uma categoria principal está selecionada) */}
        {subcatsForSelected.length > 0 && (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="flex gap-2 min-w-max">
              {subcatsForSelected.map((sc: any) => (
                <button
                  key={sc.id}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 hover:opacity-80 border"
                  style={{
                    backgroundColor: selectedSubcategory === sc.name ? primaryColor : 'transparent',
                    color: selectedSubcategory === sc.name ? 'white' : primaryColor,
                    borderColor: primaryColor,
                  }}
                  onClick={() => {
                    setSelectedSubcategory(selectedSubcategory === sc.name ? null : sc.name);
                  }}
                >
                  {sc.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Product grid ── */}
      <div className="max-w-7xl mx-auto px-4 pb-28">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum produto disponível neste momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
            {filtered.map(product => (
              <BoutiqueCard
                key={product.product_id}
                product={product}
                primaryColor={primaryColor}
                onAddToCart={addToCart}
                cartItems={cart}
                observerRef={registerCardRef(product.product_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Floating cart button ── */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 border-t backdrop-blur-sm z-40">
          <Button
            className="w-full max-w-7xl mx-auto flex gap-3 h-12 text-base font-semibold"
            style={{ backgroundColor: primaryColor }}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag className="h-5 w-5" />
            <span>Ver sacola ({cartCount} peças)</span>
            <span className="ml-auto font-bold">{fmtBRL(cartTotal)}</span>
          </Button>
        </div>
      )}

      {/* ── Cart Sheet ── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Minha Sacola ({cartCount} peças)
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 p-4">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Sua sacola está vazia</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.partner_item_id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Tam: {item.selected_size}</p>
                      <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>{fmtBRL(item.unit_price)}</p>
                    </div>
                    <button className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive" onClick={() => removeFromCart(item.partner_item_id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {cart.length > 0 && (
            <div className="p-4 border-t space-y-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span style={{ color: primaryColor }}>{fmtBRL(cartTotal)}</span>
              </div>
              <Button
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: primaryColor }}
                onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
              >
                Finalizar Compra
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Checkout Sheet ── */}
      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Finalizar Compra</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 p-4">
            {checkoutOpen && (
              <PartnerCheckoutPasses
                key="checkout"
                cartItems={cart}
                partnerPoint={partnerPoint}
                pixKey={undefined}
                whatsappNumber={store?.whatsapp_number ?? undefined}
                initialName={getStoredLead()?.name ?? undefined}
                initialPhone={getStoredLead()?.whatsapp ?? undefined}
                onCustomerCaptured={async (name, phone) => {
                  await saveLeadData({ name, whatsapp: phone });
                }}
                onCheckoutComplete={() => {
                  setCart([]);
                  setCheckoutOpen(false);
                }}
              />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ── Dialog: Acesso ao estoque completo ── */}
      <Dialog open={showFullStockDialog} onOpenChange={setShowFullStockDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" style={{ color: primaryColor }} />
              Estoque completo
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Você está prestes a acessar o estoque completo de{" "}
              <strong className="text-foreground">{store?.store_name}</strong>.
              <br /><br />
              Deseja solicitar uma <strong className="text-foreground">Malinha Consignada</strong> para deixar aqui em{" "}
              <strong className="text-foreground">{partnerPoint.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pt-2">
            {store?.store_slug && (
              <>
                <Button
                  className="w-full gap-2"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => {
                    window.open(`/${store.store_slug}`, "_blank");
                    setShowFullStockDialog(false);
                  }}
                >
                  <Store className="h-4 w-4" />
                  Ver catálogo completo
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                  onClick={() => {
                    const params = new URLSearchParams({
                      modo: "consignado",
                      ponto: partnerPoint.name,
                    });
                    window.open(`/${store.store_slug}?${params.toString()}`, "_blank");
                    setShowFullStockDialog(false);
                  }}
                >
                  🎒 Solicitar Malinha Consignada
                </Button>
              </>
            )}
            {!store?.store_slug && (
              <p className="text-sm text-muted-foreground text-center py-2">
                O link do catálogo completo não está disponível no momento.
              </p>
            )}
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowFullStockDialog(false)}
            >
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
