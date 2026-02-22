import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { Plus, Search, Minus, Users, Clock, X, Download, Instagram, MapPin } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculateSaleSplits } from "@/utils/profitEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VariantSelectionDialog } from "@/components/sales/VariantSelectionDialog";
import { VoiceSaleDialog } from "@/components/sales/VoiceSaleDialog";
import { ProfitBreakdownCard } from "@/components/sales/ProfitBreakdownCard";
import { ShippingSection, ShippingData, ShippingConfig, ShippingQuoteProduct } from "@/components/sales/ShippingSection";

// ─── Types ────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price?: number;
  stock_quantity: number;
  owner_id: string;
  group_id: string | null;
  category: string;
  color: string | null;
  size: string | null;
  b2b_source_product_id?: string | null;
  isB2B?: boolean;
}

interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  stock_quantity: number;
  image_url: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  isPartnerStock: boolean;
  ownerName?: string;
  variant?: ProductVariant | null;
  fromApprovedRequest?: boolean;
}

interface PartnerProduct extends Product {
  ownerName: string;
  ownerEmail: string;
}

interface CustomPaymentMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
  is_active: boolean;
}

// ─── Props ────────────────────────────────────────────────────
interface ConsignmentSaleData {
  consignmentId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    product_id: string;
    product_name: string;
    price: number;
    size: string | null;
    color: string | null;
    variant_id: string | null;
  }>;
}

interface CatalogOrderData {
  catalogOrderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    variant_color?: string | null;
    selected_size?: string | null;
    source?: string | null;
  }>;
  total: number;
}

interface PartnerPointOrderData {
  partnerPointSaleId: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  customPaymentMethodId: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    variant_id?: string | null;
  }>;
  totalGross: number;
  partnerName: string;
  rackCommissionPct: number;
}

interface NewSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voiceCommand?: {
    productSearch: string;
    quantity: number;
    color?: string | null;
    size?: string | null;
    customerName?: string | null;
    paymentMethod?: string | null;
  } | null;
  onVoiceCommandProcessed?: () => void;
  fromDraftId?: string | null;
  draftNotes?: string | null;
  eventName?: string | null;
  onDraftReconciled?: () => void;
  consignmentData?: ConsignmentSaleData | null;
  onConsignmentProcessed?: () => void;
  catalogOrderData?: CatalogOrderData | null;
  onCatalogOrderProcessed?: () => void;
  partnerPointOrderData?: PartnerPointOrderData | null;
  onPartnerPointOrderProcessed?: () => void;
}

export default function NewSaleDialog({
  open,
  onOpenChange,
  voiceCommand,
  onVoiceCommandProcessed,
  fromDraftId,
  draftNotes,
  eventName,
  onDraftReconciled,
  consignmentData,
  onConsignmentProcessed,
  catalogOrderData,
  onCatalogOrderProcessed,
  partnerPointOrderData,
  onPartnerPointOrderProcessed,
}: NewSaleDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // ─── Form state (persisted in sessionStorage) ──────────────
  const [cart, setCart, clearCart] = useFormPersistence<CartItem[]>("sales_cart", []);
  const [customerName, setCustomerName, clearCustomerName] = useFormPersistence("sales_customerName", "");
  const [customerPhone, setCustomerPhone, clearCustomerPhone] = useFormPersistence("sales_customerPhone", "");
  const [customerInstagram, setCustomerInstagram, clearCustomerInstagram] = useFormPersistence("sales_instagram", "");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId, clearPaymentMethodId] = useFormPersistence("sales_paymentMethodId", "");
  const [discountType, setDiscountType, clearDiscountType] = useFormPersistence("sales_discountType", "fixed");
  const [discountValue, setDiscountValue, clearDiscountValue] = useFormPersistence("sales_discountValue", 0);
  const [notes, setNotes, clearNotes] = useFormPersistence("sales_notes", "");
  const [dueDate, setDueDate, clearDueDate] = useFormPersistence("sales_dueDate", "");
  const [installments, setInstallments, clearInstallments] = useFormPersistence("sales_installments", 1);
  const [installmentDetails, setInstallmentDetails, clearInstallmentDetails] = useFormPersistence<Array<{ dueDate: string; amount: number }>>("sales_installmentDetails", []);
  const [shippingData, setShippingData, clearShippingData] = useFormPersistence<ShippingData>("sales_shippingData", {
    method: "presencial",
    company: "",
    cost: 0,
    payer: "seller",
    address: "",
    notes: "",
  });

  // ─── Search state with debounce ────────────────────────────
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const productSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(productSearch), 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // ─── Other local state ─────────────────────────────────────
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [shippingLabelUrl, setShippingLabelUrl] = useState<string | null>(null);
  const [saleIdForShipping, setSaleIdForShipping] = useState("");
  const [shippingTracking, setShippingTracking] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [importCartCode, setImportCartCode] = useState("");
  const [importedCartId, setImportedCartId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Variant selection dialog
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [selectedProductPartnerInfo, setSelectedProductPartnerInfo] = useState<{ isPartner: boolean; ownerName?: string } | null>(null);

  // Partner stock dialog
  const [partnerProducts, setPartnerProducts] = useState<PartnerProduct[]>([]);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [searchedProductName, setSearchedProductName] = useState("");
  const [selectedPartnerProduct, setSelectedPartnerProduct] = useState<PartnerProduct | null>(null);
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [reserveNotes, setReserveNotes] = useState("");
  const [reserveVariants, setReserveVariants] = useState<ProductVariant[]>([]);
  const [selectedReserveVariant, setSelectedReserveVariant] = useState<ProductVariant | null>(null);
  const [loadingReserveVariants, setLoadingReserveVariants] = useState(false);

  // Auto partner lookup
  const [autoPartnerLastQuery, setAutoPartnerLastQuery] = useState("");
  const [autoPartnerSearching, setAutoPartnerSearching] = useState(false);

  // Inline cost_price input
  const [costPriceProduct, setCostPriceProduct] = useState<Product | null>(null);
  const [costPriceValue, setCostPriceValue] = useState("");
  const [savingCostPrice, setSavingCostPrice] = useState(false);

  // Voice sale dialog state
  const [showVoiceSaleDialog, setShowVoiceSaleDialog] = useState(false);
  const [voiceSaleCommand, setVoiceSaleCommand] = useState<NewSaleDialogProps["voiceCommand"]>(null);

  // ─── Data queries ──────────────────────────────────────────
  const { data: ownProducts = [] } = useQuery({
    queryKey: ["own-products-for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, weight_grams, width_cm, height_cm, length_cm, b2b_source_product_id")
        .eq("is_active", true)
        .eq("owner_id", user?.id)
        .gt("stock_quantity", 0)
        .is("b2b_source_product_id", null)
        .order("name");
      if (error) throw error;

      const { data: b2bClones } = await supabase
        .from("products")
        .select("id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, weight_grams, width_cm, height_cm, length_cm, b2b_source_product_id")
        .eq("is_active", true)
        .eq("owner_id", user?.id)
        .not("b2b_source_product_id", "is", null)
        .order("name");

      const regularProducts = (data || []) as Product[];
      const allClones = ((b2bClones || []) as Product[]).map(p => ({ ...p, isB2B: true }));

      const sourceIds = allClones.map(p => p.b2b_source_product_id).filter(Boolean) as string[];
      let hiddenSourceIds = new Set<string>();
      if (sourceIds.length > 0) {
        const { data: hiddenSources } = await supabase
          .from("products")
          .select("id")
          .in("id", sourceIds)
          .eq("b2b_visible_in_store", false);
        hiddenSourceIds = new Set((hiddenSources || []).map(s => s.id));
      }
      const cloneProducts = allClones.filter(p => !hiddenSourceIds.has(p.b2b_source_product_id || ""));

      return [...regularProducts, ...cloneProducts];
    },
    enabled: !!user && open,
  });

  const { data: registeredCustomers = [] } = useQuery({
    queryKey: ["registered-customers-for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, instagram, photo_url, cpf, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip")
        .eq("owner_id", user?.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  const { data: shippingProfile } = useQuery({
    queryKey: ["shipping-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("origin_zip, melhor_envio_token, superfrete_token, cpf")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data as any as ShippingConfig;
    },
    enabled: !!user && open,
  });

  const { data: customPaymentMethods = [] } = useQuery({
    queryKey: ["custom-payment-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("*")
        .eq("owner_id", user?.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CustomPaymentMethod[];
    },
    enabled: !!user && open,
  });

  const { data: userGroupsData = [] } = useQuery({
    queryKey: ["user-groups-with-direct"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, groups!inner(id, is_direct)")
        .eq("user_id", user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  const userGroups = useMemo(() => userGroupsData.map(g => g.group_id), [userGroupsData]);
  const directGroupIds = useMemo(() =>
    userGroupsData
      .filter(g => (g.groups as any)?.is_direct === true)
      .map(g => g.group_id),
    [userGroupsData]
  );

  const { data: partnerProductsForList = [] } = useQuery({
    queryKey: ["partner-products-for-sale-list", directGroupIds, profiles],
    queryFn: async () => {
      if (directGroupIds.length === 0) return [];
      const { data, error } = await supabase
        .from("product_partnerships")
        .select(`product_id, group_id, product:products!inner(id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size)`)
        .in("group_id", directGroupIds)
        .neq("products.owner_id", user?.id)
        .eq("products.is_active", true)
        .gt("products.stock_quantity", 0);
      if (error) throw error;

      const uniqueById = new Map<string, any>();
      for (const row of data || []) {
        const product = (row as any).product;
        if (product?.id && !uniqueById.has(product.id)) {
          const owner = profiles.find(p => p.id === product.owner_id);
          uniqueById.set(product.id, { ...product, isPartner: true, ownerName: owner?.full_name || "Parceira" });
        }
      }
      return Array.from(uniqueById.values()) as (Product & { isPartner: boolean; ownerName: string })[];
    },
    enabled: !!user && open && directGroupIds.length > 0 && profiles.length > 0,
  });

  const { data: ownProductPartnerships = [] } = useQuery({
    queryKey: ["own-product-partnerships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_partnerships")
        .select(`product_id, group_id, group:groups!inner(id, is_direct, cost_split_ratio, profit_share_seller, profit_share_partner, commission_percent)`)
        .in("group_id", userGroups);
      if (error) throw error;
      return data;
    },
    enabled: !!user && open && userGroups.length > 0,
  });

  const productPartnershipsMap = useMemo(() => {
    const map = new Map<string, any>();
    ownProductPartnerships.forEach((pp: any) => {
      if (pp.group && pp.product_id) {
        map.set(pp.product_id, {
          groupId: pp.group_id,
          isDirect: pp.group.is_direct ?? false,
          costSplitRatio: pp.group.cost_split_ratio ?? 0.5,
          profitShareSeller: pp.group.profit_share_seller ?? 0.7,
          profitSharePartner: pp.group.profit_share_partner ?? 0.3,
          commissionPercent: pp.group.commission_percent ?? 0.2,
        });
      }
    });
    return map;
  }, [ownProductPartnerships]);

  const hasActivePartnership = userGroups.length > 0;

  // ─── Quote products for shipping ──────────────────────────
  const quoteProducts: ShippingQuoteProduct[] = useMemo(() => {
    return cart
      .filter((item) => {
        const p = item.product as any;
        return p.weight_grams && p.width_cm && p.height_cm && p.length_cm;
      })
      .map((item) => {
        const p = item.product as any;
        return { weight_grams: p.weight_grams, width_cm: p.width_cm, height_cm: p.height_cm, length_cm: p.length_cm, quantity: item.quantity };
      });
  }, [cart]);

  // ─── Totals (useMemo) ─────────────────────────────────────
  const { subtotal, discountAmount, shippingCostForBuyer, total } = useMemo(() => {
    const calculatedSubtotal = cart.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0);
    const calculatedDiscount = discountType === "percentage" ? (calculatedSubtotal * discountValue) / 100 : discountValue;
    const shippingForBuyer = shippingData.payer === "buyer" && shippingData.method !== "presencial" ? shippingData.cost : 0;
    const calculatedTotal = Math.max(0, calculatedSubtotal - calculatedDiscount + shippingForBuyer);
    return { subtotal: calculatedSubtotal, discountAmount: calculatedDiscount, shippingCostForBuyer: shippingForBuyer, total: calculatedTotal };
  }, [cart, discountType, discountValue, shippingData]);

  // ─── Filtered products (debounced + sliced to 30) ─────────
  const filteredOwnProducts = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) return [];
    const search = debouncedSearch.toLowerCase();
    return ownProducts.filter(p => p.name.toLowerCase().includes(search)).slice(0, 30);
  }, [ownProducts, debouncedSearch]);

  const filteredPartnerProducts = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) return [];
    const search = debouncedSearch.toLowerCase();
    return partnerProductsForList.filter(p => p.name.toLowerCase().includes(search)).slice(0, 30);
  }, [partnerProductsForList, debouncedSearch]);

  const combinedProductsList = useMemo(() => {
    const ownIds = new Set(filteredOwnProducts.map(p => p.id));
    const uniquePartnerProducts = filteredPartnerProducts.filter(pp => !ownIds.has(pp.id));
    return { ownProducts: filteredOwnProducts, partnerProducts: uniquePartnerProducts };
  }, [filteredOwnProducts, filteredPartnerProducts]);

  // ─── Cart functions (useCallback) ─────────────────────────
  const addToCart = useCallback((product: Product, isPartnerStock: boolean = false, ownerName?: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && !item.variant);
      if (existing) {
        if (existing.quantity < product.stock_quantity) {
          return prev.map((item) =>
            item.product.id === product.id && !item.variant
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }
        toast({ title: "Estoque insuficiente", variant: "destructive" });
        return prev;
      }
      return [...prev, { product, quantity: 1, isPartnerStock, ownerName }];
    });
    setProductSearch("");
  }, [setCart]);

  const updateQuantity = useCallback((itemKey: string, delta: number, variantId?: string) => {
    setCart((prev) =>
      prev.map((item) => {
        const isMatch = variantId
          ? item.variant?.id === variantId
          : item.product.id === itemKey && !item.variant;
        if (!isMatch) return item;
        const stockLimit = item.variant ? item.variant.stock_quantity : item.product.stock_quantity;
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > stockLimit) {
          toast({ title: "Estoque insuficiente", variant: "destructive" });
          return item;
        }
        return { ...item, quantity: newQty };
      }),
    );
  }, [setCart]);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    setCart((prev) => prev.filter((item) => {
      if (variantId) return item.variant?.id !== variantId;
      return !(item.product.id === productId && !item.variant);
    }));
  }, [setCart]);

  // ─── Partner search ────────────────────────────────────────
  const searchPartnerProducts = async (searchName: string) => {
    if (!user || userGroups.length === 0) return [];
    const { data, error } = await supabase
      .from("product_partnerships")
      .select("product:products!inner(id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size)")
      .in("group_id", userGroups)
      .eq("products.is_active", true)
      .gt("products.stock_quantity", 0)
      .neq("products.owner_id", user.id)
      .ilike("products.name", `%${searchName}%`)
      .order("name", { foreignTable: "products" })
      .limit(50);
    if (error) return [];
    const uniqueById = new Map<string, any>();
    for (const row of data || []) {
      const product = (row as any).product;
      if (product?.id && !uniqueById.has(product.id)) uniqueById.set(product.id, product);
    }
    return Array.from(uniqueById.values()).map((p) => {
      const owner = profiles.find((prof) => prof.id === p.owner_id);
      return { ...p, ownerName: owner?.full_name || "Parceiro", ownerEmail: owner?.email || "" } as PartnerProduct;
    });
  };

  const handleProductSearch = async (searchValue: string, opts?: { forcePartner?: boolean }) => {
    setProductSearch(searchValue);
    if (searchValue.length < 2) return;
    const forcePartner = !!opts?.forcePartner;
    const ownMatch = ownProducts.filter(p => p.name.toLowerCase().includes(searchValue.toLowerCase()));
    if (forcePartner || ownMatch.length === 0) {
      setSearchedProductName(searchValue);
      const partnerResults = await searchPartnerProducts(searchValue);
      setAutoPartnerLastQuery(searchValue);
      if (partnerResults.length > 0) {
        toast({ title: "Encontrado nos parceiros", description: `${partnerResults.length} opção(ões) disponível(is) com estoque.` });
        setPartnerProducts(partnerResults);
        setShowPartnerDialog(true);
      } else {
        toast({ title: "Não encontrado nos parceiros", description: "Nenhum parceiro tem este produto com estoque disponível.", variant: "destructive" });
      }
    }
  };

  // Auto partner search effect
  useEffect(() => {
    if (productSearch.length < 2) { setAutoPartnerSearching(false); return; }
    const ownMatch = ownProducts.some(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    if (ownMatch) return;
    if (productSearch === autoPartnerLastQuery) return;
    if (autoPartnerSearching) return;
    const t = window.setTimeout(async () => {
      setAutoPartnerSearching(true);
      setSearchedProductName(productSearch);
      const partnerResults = await searchPartnerProducts(productSearch);
      setAutoPartnerLastQuery(productSearch);
      setAutoPartnerSearching(false);
      if (partnerResults.length > 0) {
        toast({ title: "Encontrado nos parceiros", description: `${partnerResults.length} opção(ões) disponível(is) com estoque.` });
        setPartnerProducts(partnerResults);
        setShowPartnerDialog(true);
      } else {
        toast({ title: "Não encontrado nos parceiros", description: "Nenhum parceiro tem este produto com estoque disponível.", variant: "destructive" });
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [productSearch, ownProducts, autoPartnerLastQuery, autoPartnerSearching]);

  // ─── Reserve flow ──────────────────────────────────────────
  const createReserveMutation = useMutation({
    mutationFn: async ({ product, quantity, notes, variant }: { product: PartnerProduct; quantity: number; notes: string; variant?: ProductVariant | null }) => {
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase.from("stock_requests").insert({
        product_id: product.id, requester_id: user.id, owner_id: product.owner_id,
        quantity, notes: notes || null, status: "pending",
        variant_id: variant?.id || null, variant_color: null, variant_size: variant?.size || null,
        product_name: product.name, product_price: product.price,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Solicitação de reserva enviada!", description: "Aguarde a confirmação do parceiro." });
      setShowReserveDialog(false);
      setSelectedPartnerProduct(null);
      setReserveQuantity(1);
      setReserveNotes("");
      setSelectedReserveVariant(null);
      setReserveVariants([]);
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
    onError: (error) => { toast({ title: "Erro ao solicitar reserva", description: error.message, variant: "destructive" }); },
  });

  const loadPartnerVariants = async (productId: string) => {
    setLoadingReserveVariants(true);
    try {
      const { data, error } = await supabase.from("product_variants").select("id, product_id, size, stock_quantity, image_url").eq("product_id", productId).gt("stock_quantity", 0).order("size");
      if (error) throw error;
      setReserveVariants(data || []);
      if (data && data.length === 1) setSelectedReserveVariant(data[0]);
    } catch { setReserveVariants([]); } finally { setLoadingReserveVariants(false); }
  };

  const handleRequestReserve = (product: PartnerProduct) => {
    setSelectedPartnerProduct(product);
    setReserveQuantity(1);
    setReserveNotes("");
    setSelectedReserveVariant(null);
    setReserveVariants([]);
    setShowReserveDialog(true);
    setShowPartnerDialog(false);
    loadPartnerVariants(product.id);
  };

  // ─── Product click & variant confirm ──────────────────────
  const handleProductClick = useCallback((product: Product & { isPartner?: boolean; ownerName?: string }) => {
    if (product.isPartner) {
      handleRequestReserve({ ...product, ownerName: product.ownerName || "Parceira", ownerEmail: "" });
      return;
    }
    // Block products without cost_price - show inline form
    if (product.cost_price == null || product.cost_price <= 0) {
      setCostPriceProduct(product);
      setCostPriceValue("");
      return;
    }
    setSelectedProductForVariant(product);
    setSelectedProductPartnerInfo(null);
    setShowVariantDialog(true);
    setProductSearch("");
  }, []);

  const handleVariantConfirm = useCallback((product: Product, variant: ProductVariant | null, quantity: number, isPartnerStock: boolean = false, ownerName?: string) => {
    if (isPartnerStock) {
      toast({ title: "Produto de parceiro", description: "Use a Solicitação de Reserva para vender produtos de parceiros.", variant: "destructive" });
      return;
    }
    const stockLimit = variant ? variant.stock_quantity : product.stock_quantity;
    setCart((prev) => {
      const existing = prev.find((item) => {
        if (variant) return item.variant?.id === variant.id;
        return item.product.id === product.id && !item.variant && item.isPartnerStock === isPartnerStock;
      });
      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty <= stockLimit) {
          return prev.map((item) => {
            if (variant && item.variant?.id === variant.id) return { ...item, quantity: newQty };
            if (!variant && item.product.id === product.id && !item.variant && item.isPartnerStock === isPartnerStock) return { ...item, quantity: newQty };
            return item;
          });
        }
        toast({ title: "Estoque insuficiente", variant: "destructive" });
        return prev;
      }
      return [...prev, { product, quantity, isPartnerStock, ownerName, variant }];
    });
    setShowVariantDialog(false);
    setSelectedProductForVariant(null);
    setSelectedProductPartnerInfo(null);
  }, [setCart]);

  // ─── Inline cost_price save ────────────────────────────────
  const handleSaveCostPrice = useCallback(async () => {
    if (!costPriceProduct || !costPriceValue) return;
    const parsed = parseFloat(costPriceValue.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({ title: "Valor inválido", description: "Insira um valor numérico válido.", variant: "destructive" });
      return;
    }
    setSavingCostPrice(true);
    const { error } = await supabase
      .from("products")
      .update({ cost_price: parsed })
      .eq("id", costPriceProduct.id);
    setSavingCostPrice(false);
    if (error) {
      toast({ title: "Erro ao salvar custo", description: error.message, variant: "destructive" });
      return;
    }
    // Update the product in local cache and proceed
    const updatedProduct = { ...costPriceProduct, cost_price: parsed };
    queryClient.invalidateQueries({ queryKey: ["own-products-for-sale"] });
    setCostPriceProduct(null);
    setCostPriceValue("");
    toast({ title: "Preço de custo salvo!" });
    // Now proceed to add the product
    setSelectedProductForVariant(updatedProduct);
    setSelectedProductPartnerInfo(null);
    setShowVariantDialog(true);
    setProductSearch("");
  }, [costPriceProduct, costPriceValue, queryClient, setProductSearch]);

  // ─── Customer selection ───────────────────────────────────
  const handleCustomerSelect = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId === "") {
      setCustomerName(""); setCustomerPhone(""); setCustomerInstagram("");
    } else {
      const customer = registeredCustomers.find(c => c.id === customerId);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone || "");
        setCustomerInstagram(customer.instagram || "");
      }
    }
  }, [registeredCustomers, setCustomerName, setCustomerPhone, setCustomerInstagram]);

  // ─── Import cart ──────────────────────────────────────────
  const handleImportCart = async () => {
    if (!importCartCode.trim()) return;
    setIsImporting(true);
    try {
      const { data: savedCart, error: cartError } = await supabase
        .from("saved_carts")
        .select("id, customer_name, customer_phone, total, status, saved_cart_items(id, product_id, product_name, variant_color, selected_size, quantity, unit_price, source)")
        .eq("short_code", importCartCode.trim().toUpperCase())
        .single() as any;
      if (cartError || !savedCart) { toast({ title: "Carrinho não encontrado", description: "Verifique o código e tente novamente.", variant: "destructive" }); return; }
      if (savedCart.status === "converted") { toast({ title: "Carrinho já convertido", description: "Este carrinho já foi importado anteriormente.", variant: "destructive" }); return; }
      setCustomerName(savedCart.customer_name || "");
      setCustomerPhone(savedCart.customer_phone || "");
      const items: CartItem[] = [];
      for (const sci of (savedCart.saved_cart_items || [])) {
        let matchedProduct: Product | undefined;
        if (sci.source === "partner") {
          matchedProduct = partnerProductsForList.find((p: any) => p.id === sci.product_id) as any;
        } else {
          matchedProduct = ownProducts.find(p => p.id === sci.product_id);
        }
        const product: Product = matchedProduct ? {
          ...matchedProduct,
          isB2B: sci.source === "b2b" ? true : (matchedProduct.isB2B || !!matchedProduct.b2b_source_product_id),
        } : {
          id: sci.product_id || crypto.randomUUID(), name: sci.product_name, price: sci.unit_price,
          stock_quantity: 0, owner_id: user?.id || "", group_id: null, category: "", color: sci.variant_color,
          size: sci.selected_size, isB2B: sci.source === "b2b", b2b_source_product_id: sci.source === "b2b" ? "imported" : null,
        };
        items.push({ product, quantity: sci.quantity, isPartnerStock: sci.source === "partner", ownerName: sci.source === "partner" ? "Parceira" : undefined, variant: null });
      }
      setCart(items);
      setImportedCartId(savedCart.id);
      toast({ title: "Carrinho importado!", description: `${items.length} item(ns) carregados do código ${importCartCode.trim().toUpperCase()}` });
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally { setIsImporting(false); }
  };

  // ─── Load consignment data into cart ───────────────────────
  const [consignmentProcessed, setConsignmentProcessed] = useState(false);

  useEffect(() => {
    if (!open || !consignmentData || consignmentProcessed || !user) return;

    const loadConsignmentItems = async () => {
      const productIds = consignmentData.items.map(i => i.product_id).filter(Boolean);
      if (productIds.length === 0) return;

      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, b2b_source_product_id")
        .in("id", productIds);

      if (error || !products) {
        toast({ title: "Erro ao carregar produtos da malinha", variant: "destructive" });
        return;
      }

      const cartItems: CartItem[] = consignmentData.items.map(item => {
        const dbProduct = products.find(p => p.id === item.product_id);
        const product: Product = dbProduct
          ? { ...dbProduct, isB2B: false }
          : {
              id: item.product_id,
              name: item.product_name,
              price: item.price,
              stock_quantity: 1,
              owner_id: user.id,
              group_id: null,
              category: "",
              color: item.color,
              size: item.size,
            };
        return { product, quantity: 1, isPartnerStock: false };
      });

      setCart(cartItems);
      setCustomerName(consignmentData.customerName || "");
      setCustomerPhone(consignmentData.customerPhone || "");
      setNotes(`Venda originada da Bolsa Consignada #${consignmentData.consignmentId.slice(0, 8)}`);
      setConsignmentProcessed(true);
    };

    loadConsignmentItems();
  }, [open, consignmentData, consignmentProcessed, user]);

  // Reset consignment state when dialog closes
  useEffect(() => {
    if (!open && consignmentProcessed) {
      setConsignmentProcessed(false);
      onConsignmentProcessed?.();
    }
  }, [open, consignmentProcessed, onConsignmentProcessed]);

  // ─── Load catalog order data into cart ─────────────────────
  const [catalogOrderProcessed, setCatalogOrderProcessed] = useState(false);

  useEffect(() => {
    if (!open || !catalogOrderData || catalogOrderProcessed || !user) return;

    const loadCatalogOrderItems = async () => {
      const productIds = catalogOrderData.items.map(i => i.product_id).filter(Boolean);
      
      let products: any[] = [];
      if (productIds.length > 0) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, b2b_source_product_id")
          .in("id", productIds);
        if (!error && data) products = data;
      }

      const cartItems: CartItem[] = catalogOrderData.items.map(item => {
        const dbProduct = products.find(p => p.id === item.product_id);
        const product: Product = dbProduct
          ? { ...dbProduct, isB2B: false }
          : {
              id: item.product_id || crypto.randomUUID(),
              name: item.product_name,
              price: item.unit_price,
              stock_quantity: item.quantity,
              owner_id: user.id,
              group_id: null,
              category: "",
              color: item.variant_color || null,
              size: item.selected_size || null,
            };
        return { product, quantity: item.quantity, isPartnerStock: false };
      });

      setCart(cartItems);
      setCustomerName(catalogOrderData.customerName || "");
      setCustomerPhone(catalogOrderData.customerPhone || "");
      setNotes(`Pedido do catálogo #${catalogOrderData.catalogOrderId.slice(0, 8)}`);
      setCatalogOrderProcessed(true);
    };

    loadCatalogOrderItems();
  }, [open, catalogOrderData, catalogOrderProcessed, user]);

  // Reset catalog order state when dialog closes
  useEffect(() => {
    if (!open && catalogOrderProcessed) {
      setCatalogOrderProcessed(false);
      onCatalogOrderProcessed?.();
    }
  }, [open, catalogOrderProcessed, onCatalogOrderProcessed]);

  // ─── Load partner point order data into cart ──────────────
  const [partnerPointProcessed, setPartnerPointProcessed] = useState(false);

  useEffect(() => {
    if (!open || !partnerPointOrderData || partnerPointProcessed || !user) return;

    const loadPartnerPointItems = async () => {
      const productIds = partnerPointOrderData.items.map(i => i.product_id).filter(Boolean);
      let products: any[] = [];
      if (productIds.length > 0) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, b2b_source_product_id")
          .in("id", productIds);
        if (!error && data) products = data;
      }

      const cartItems: CartItem[] = partnerPointOrderData.items.map(item => {
        const dbProduct = products.find(p => p.id === item.product_id);
        const product: Product = dbProduct
          ? { ...dbProduct, isB2B: false }
          : {
              id: item.product_id || crypto.randomUUID(),
              name: item.product_name,
              price: item.unit_price,
              stock_quantity: item.quantity,
              owner_id: user.id,
              group_id: null,
              category: "",
              color: null,
              size: null,
            };
        return { product, quantity: item.quantity, isPartnerStock: false };
      });

      setCart(cartItems);
      setCustomerName(partnerPointOrderData.customerName || "");
      setCustomerPhone(partnerPointOrderData.customerPhone || "");
      setNotes(`Venda via Ponto Parceiro: ${partnerPointOrderData.partnerName}`);

      // Pre-select payment method
      if (partnerPointOrderData.customPaymentMethodId) {
        setSelectedPaymentMethodId(partnerPointOrderData.customPaymentMethodId);
      }

      setPartnerPointProcessed(true);
    };

    loadPartnerPointItems();
  }, [open, partnerPointOrderData, partnerPointProcessed, user]);

  useEffect(() => {
    if (!open && partnerPointProcessed) {
      setPartnerPointProcessed(false);
      onPartnerPointOrderProcessed?.();
    }
  }, [open, partnerPointProcessed, onPartnerPointOrderProcessed]);

  // ─── Reset form ───────────────────────────────────────────
  const resetForm = useCallback(() => {
    clearCart(); clearCustomerName(); clearCustomerPhone(); clearCustomerInstagram();
    clearPaymentMethodId(); clearDiscountType(); clearDiscountValue(); clearNotes();
    clearDueDate(); clearInstallments(); clearInstallmentDetails(); clearShippingData();
    setCart([]); setCustomerName(""); setCustomerPhone(""); setCustomerInstagram("");
    setSelectedPaymentMethodId(""); setInstallments(1); setInstallmentDetails([]); setDiscountType("fixed");
    setDiscountValue(0); setNotes(""); setProductSearch(""); setSelectedCustomerId("");
    setDueDate(""); setShippingData({ method: "presencial", company: "", cost: 0, payer: "seller", address: "", notes: "" });
    setShippingLabelUrl(null); setShippingTracking(null); setSaleIdForShipping("");
    setImportCartCode(""); setImportedCartId(null);
  }, [clearCart, clearCustomerName, clearCustomerPhone, clearCustomerInstagram, clearPaymentMethodId, clearDiscountType, clearDiscountValue, clearNotes, clearDueDate, clearInstallments, clearShippingData, setCart, setCustomerName, setCustomerPhone, setCustomerInstagram, setSelectedPaymentMethodId, setInstallments, setDiscountType, setDiscountValue, setNotes, setDueDate, setShippingData]);

  // ─── Create sale mutation (RPC-based, atomic) ─────────────
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (!user || cart.length === 0) throw new Error("Carrinho vazio");

      const unauthorizedPartnerItems = cart.filter(item => item.isPartnerStock && !item.fromApprovedRequest);
      if (unauthorizedPartnerItems.length > 0) {
        throw new Error("Produtos de parceiros só podem ser vendidos após aprovação da Solicitação de Reserva.");
      }

      const ownStockItems = cart.filter(item => !item.isPartnerStock);
      const partnerItems = cart.filter(item => item.isPartnerStock);

      const selectedPaymentMethod = customPaymentMethods.find(m => m.id === selectedPaymentMethodId);
      const paymentMethodName = selectedPaymentMethod?.name || "Dinheiro";
      const feePercent = selectedPaymentMethod?.fee_percent || 0;
      const isDeferred = selectedPaymentMethod?.is_deferred || false;

      let saleNotes = notes || "";
      if (partnerItems.length > 0) {
        const partnerInfo = partnerItems.map(item => `${item.product.name} (${item.quantity}x) - Parceiro: ${item.ownerName}`).join("; ");
        saleNotes = saleNotes ? `${saleNotes} | Itens de parceiros: ${partnerInfo}` : `Itens de parceiros: ${partnerInfo}`;
      }

      const shippingForBuyer = shippingData.payer === "buyer" && shippingData.method !== "presencial" ? shippingData.cost : 0;
      const saleNetMultiplier = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;

      // ── Pre-fetch ALL partnership data in batch (eliminates N+1) ──
      const productIds = cart.map(item => item.product.id);
      const { data: allPartnerships } = await supabase
        .from("product_partnerships")
        .select("product_id, group_id, group:groups!inner(id, is_direct, cost_split_ratio, profit_share_seller, profit_share_partner, commission_percent, created_by)")
        .in("product_id", productIds);

      const partnershipsByProduct = new Map<string, typeof allPartnerships>();
      for (const pp of allPartnerships || []) {
        const existing = partnershipsByProduct.get(pp.product_id) || [];
        existing.push(pp);
        partnershipsByProduct.set(pp.product_id, existing);
      }

      // Pre-fetch all group members for relevant groups
      const relevantGroupIds = [...new Set((allPartnerships || []).map(pp => pp.group_id))];
      let allGroupMembers: { group_id: string; user_id: string }[] = [];
      if (relevantGroupIds.length > 0) {
        const { data: members } = await supabase.from("group_members").select("group_id, user_id").in("group_id", relevantGroupIds);
        allGroupMembers = members || [];
      }

      // ── Compute financial splits client-side ──
      const financialSplitsPayload: Array<{ user_id: string; amount: number; type: string; description: string }> = [];

      for (const item of cart) {
        const salePriceGross = item.product.price * item.quantity;
        const salePriceAfterDiscount = salePriceGross * saleNetMultiplier;
        const costPrice = (item.product.cost_price ?? 0) * item.quantity;
        const sellerIsOwner = item.product.owner_id === user.id;

        const productPartnerships = partnershipsByProduct.get(item.product.id) || [];
        let productPartnershipData: any = null;
        if (productPartnerships.length > 0) {
          const directPartnership = productPartnerships.find(pp => (pp.group as any)?.is_direct === true);
          productPartnershipData = directPartnership || productPartnerships[0];
        }

        const isInPartnership = !!productPartnershipData?.group_id;
        const isPartnershipStock = item.isPartnerStock || isInPartnership;
        const partnershipGroup = productPartnershipData?.group as any;

        const splitResult = calculateSaleSplits({
          salePrice: salePriceAfterDiscount,
          costPrice,
          groupCommissionPercent: partnershipGroup?.commission_percent ?? 0.20,
          isPartnershipStock,
          sellerIsOwner,
          hasActivePartnership: isInPartnership || userGroups.length > 0,
          isDirectPartnership: partnershipGroup?.is_direct ?? false,
          paymentMethodFee: feePercent,
          partnership: partnershipGroup ? {
            cost_split_ratio: partnershipGroup.cost_split_ratio,
            profit_share_seller: partnershipGroup.profit_share_seller,
            profit_share_partner: partnershipGroup.profit_share_partner,
            is_direct: partnershipGroup.is_direct,
          } : null,
          group: partnershipGroup ? { commission_percent: partnershipGroup.commission_percent, is_direct: partnershipGroup.is_direct } : null,
        });

        const groupId = productPartnershipData?.group_id;
        const groupMembers = groupId ? allGroupMembers.filter(m => m.group_id === groupId) : [];

        if (splitResult.scenario === 'A' && isInPartnership && groupMembers.length >= 2) {
          const partnerUserId = groupMembers.find(m => m.user_id !== user.id)?.user_id;
          if (splitResult.seller.costRecovery > 0) financialSplitsPayload.push({ user_id: user.id, amount: splitResult.seller.costRecovery, type: 'cost_recovery', description: `Recuperação de custo ${((partnershipGroup?.cost_split_ratio ?? 0.5) * 100).toFixed(0)}% ${profiles.find(p => p.id === user.id)?.full_name || 'Vendedora'} (parceria) - ${item.product.name}` });
          if (splitResult.seller.profitShare > 0) financialSplitsPayload.push({ user_id: user.id, amount: splitResult.seller.profitShare, type: 'profit_share', description: `Lucro ${((partnershipGroup?.profit_share_seller ?? 0.7) * 100).toFixed(0)}% ${profiles.find(p => p.id === user.id)?.full_name || 'Vendedora'} (parceria) - ${item.product.name}` });
          if (partnerUserId && splitResult.partner.costRecovery > 0) financialSplitsPayload.push({ user_id: partnerUserId, amount: splitResult.partner.costRecovery, type: 'cost_recovery', description: `Recuperação de custo ${((1 - (partnershipGroup?.cost_split_ratio ?? 0.5)) * 100).toFixed(0)}% ${profiles.find(p => p.id === partnerUserId)?.full_name || 'Sócia'} (parceria) - ${item.product.name}` });
          if (partnerUserId && splitResult.partner.profitShare > 0) financialSplitsPayload.push({ user_id: partnerUserId, amount: splitResult.partner.profitShare, type: 'profit_share', description: `Lucro ${((partnershipGroup?.profit_share_partner ?? 0.3) * 100).toFixed(0)}% ${profiles.find(p => p.id === partnerUserId)?.full_name || 'Sócia'} (parceria) - ${item.product.name}` });
        } else if (splitResult.scenario === 'C' && isPartnershipStock && groupMembers.length >= 2) {
          const ownerUserId = item.product.owner_id;
          const partnerUserId = groupMembers.find(m => m.user_id !== ownerUserId)?.user_id;
          if (splitResult.owner.total > 0) financialSplitsPayload.push({ user_id: ownerUserId, amount: splitResult.owner.total, type: 'cost_recovery', description: `Comissão de Cessão de Estoque (Peça vendida por terceiro) - ${item.product.name}` });
          if (partnerUserId && splitResult.partner.total > 0) financialSplitsPayload.push({ user_id: partnerUserId, amount: splitResult.partner.total, type: 'cost_recovery', description: `Comissão de Cessão de Estoque (Peça vendida por terceiro) - ${item.product.name}` });
          if (splitResult.seller.profitShare > 0) financialSplitsPayload.push({ user_id: user.id, amount: splitResult.seller.profitShare, type: 'profit_share', description: `Lucro da venda (após pagamento à parceria) - ${item.product.name}` });
        } else {
          if (splitResult.seller.costRecovery > 0) financialSplitsPayload.push({ user_id: user.id, amount: splitResult.seller.costRecovery, type: 'cost_recovery', description: `Recuperação de custo - ${item.product.name}` });
          if (splitResult.seller.profitShare > 0) financialSplitsPayload.push({ user_id: user.id, amount: splitResult.seller.profitShare, type: 'profit_share', description: `Lucro da venda - ${item.product.name}` });
          if (splitResult.owner.total > 0 && item.product.owner_id !== user.id) {
            if (splitResult.owner.costRecovery > 0) financialSplitsPayload.push({ user_id: item.product.owner_id, amount: splitResult.owner.costRecovery, type: 'cost_recovery', description: `Recuperação de custo (dono) - ${item.product.name}` });
            if (splitResult.owner.groupCommission > 0) financialSplitsPayload.push({ user_id: item.product.owner_id, amount: splitResult.owner.groupCommission, type: 'group_commission', description: `Comissão de grupo - ${item.product.name}` });
          }
        }
      }

      // Override financial splits for partner point orders
      if (partnerPointOrderData) {
        financialSplitsPayload.length = 0;
        const paymentFeeAmount = (feePercent / 100) * total;
        const netAfterFees = total - paymentFeeAmount;
        const partnerCommission = netAfterFees * (partnerPointOrderData.rackCommissionPct / 100);
        const sellerNet = netAfterFees - partnerCommission;

        financialSplitsPayload.push({
          user_id: user.id,
          amount: sellerNet,
          type: 'profit_share',
          description: `Receita líquida — venda no ${partnerPointOrderData.partnerName}`,
        });

        if (partnerCommission > 0) {
          financialSplitsPayload.push({
            user_id: user.id,
            amount: -partnerCommission,
            type: 'group_commission',
            description: `Comissão ${partnerPointOrderData.rackCommissionPct}% — ${partnerPointOrderData.partnerName}`,
          });
        }
      }

      const itemsPayload = cart.map((item) => {
        let productName = item.product.name;
        if (item.variant) {
          const parts = [];
          if (item.variant.size) parts.push(item.variant.size);
          if (parts.length > 0) productName += ` (${parts.join(' - ')})`;
        }
        if (item.isPartnerStock && item.ownerName) productName += ` [Parceiro: ${item.ownerName}]`;
        let itemSource: string | null = null;
        let itemB2bStatus: string | null = null;
        if (item.isPartnerStock) { itemSource = 'partner'; }
        else if (item.product.isB2B || !!item.product.b2b_source_product_id) { itemSource = 'b2b'; itemB2bStatus = 'pending'; }
        else if (item.product.owner_id === user.id && item.product.stock_quantity <= 0) { itemSource = 'b2b'; itemB2bStatus = 'pending'; }
        return { product_id: item.product.id, product_name: productName, quantity: item.quantity, unit_price: item.product.price, total: item.product.price * item.quantity, source: itemSource, b2b_status: itemB2bStatus };
      });

      // ── Build stock updates payload ──
      const stockUpdates = ownStockItems.map(item => ({
        product_id: item.product.id,
        variant_id: item.variant?.id || null,
        quantity: item.quantity,
      }));

      // ── Build new_customer payload ──
      let newCustomerPayload = null;
      if (customerName && !selectedCustomerId) {
        const { data: existingCustomer } = await supabase.from("customers").select("id").eq("owner_id", user.id).eq("name", customerName.trim()).maybeSingle();
        if (!existingCustomer) {
          newCustomerPayload = { name: customerName.trim(), phone: customerPhone || null, instagram: customerInstagram || null };
        }
      }

      // ── Build payment_reminder payload ──
      let paymentRemindersPayload: any[] | null = null;
      if (isDeferred && dueDate) {
        if (installments > 1 && installmentDetails.length > 0) {
          // Multiple installments
          paymentRemindersPayload = installmentDetails.map((inst, idx) => ({
            customer_name: customerName || null, customer_phone: customerPhone || null,
            customer_instagram: customerInstagram || null, amount: inst.amount, due_date: inst.dueDate,
            payment_method_name: `${paymentMethodName} (${idx + 1}/${installmentDetails.length})`, notes: notes || null,
          }));
        } else {
          // Single payment (backward compat)
          paymentRemindersPayload = [{
            customer_name: customerName || null, customer_phone: customerPhone || null,
            customer_instagram: customerInstagram || null, amount: total, due_date: dueDate,
            payment_method_name: paymentMethodName, notes: notes || null,
          }];
        }
      }

      // ── Build shipping_expense payload ──
      let shippingExpensePayload = null;
      if (shippingData.method !== "presencial" && shippingData.cost > 0) {
        shippingExpensePayload = {
          amount: shippingData.cost,
          description: `Frete ${shippingData.company || shippingData.method} - Venda${customerName ? ` (${customerName})` : ""}`,
          expense_date: new Date().toISOString().split("T")[0],
        };
      }

      // ── Single atomic RPC call ──
      const payload = {
        owner_id: user.id,
        new_customer: newCustomerPayload,
        sale: {
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method: paymentMethodName,
          subtotal, discount_type: discountType, discount_value: discountValue,
          discount_amount: discountAmount, total,
          notes: saleNotes || null,
          status: isDeferred ? "pending" : "completed",
          sale_source: consignmentData ? "consignment" : fromDraftId ? "manual" : partnerPointOrderData ? "catalog" : catalogOrderData ? "catalog" : "manual",
          event_name: eventName || null,
          shipping_method: shippingData.method || null,
          shipping_company: shippingData.company || null,
          shipping_cost: shippingData.cost || 0,
          shipping_payer: shippingData.method !== "presencial" ? shippingData.payer : null,
          shipping_address: shippingData.address || null,
          shipping_notes: shippingData.notes || null,
          shipping_tracking: shippingTracking || null,
          shipping_label_url: shippingLabelUrl || null,
        },
        items: itemsPayload,
        stock_updates: stockUpdates,
        financial_splits: financialSplitsPayload,
        payment_reminders: paymentRemindersPayload,
        shipping_expense: shippingExpensePayload,
      };

      const { data: result, error } = await supabase.rpc('create_sale_transaction', { payload });
      if (error) throw error;

      const rpcResult = result as any;
      if (!rpcResult?.success) throw new Error(rpcResult?.error || "Erro ao registrar venda");

      setSaleIdForShipping(rpcResult.sale_id);
      return rpcResult;
    },
    onSuccess: async (result: any) => {
      if (pendingRequestId) {
        await supabase.from("stock_requests").update({ status: "completed" as any }).eq("id", pendingRequestId);
        setPendingRequestId(null);
        queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      }
      if (importedCartId) {
        await supabase.from("saved_carts").update({ status: "converted" } as any).eq("id", importedCartId);
        setImportedCartId(null);
      }
      if (fromDraftId) {
        await supabase.from("event_sale_drafts").update({ status: "reconciled" }).eq("id", fromDraftId);
        onDraftReconciled?.();
        queryClient.invalidateQueries({ queryKey: ["event-drafts-pending"] });
        queryClient.invalidateQueries({ queryKey: ["event-drafts-pending-count"] });
      }
      // Mark consignment as completed after successful sale
      if (consignmentData?.consignmentId) {
        await supabase
          .from("consignments")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", consignmentData.consignmentId);
        queryClient.invalidateQueries({ queryKey: ["consignments"] });
      }
      // Mark catalog order as converted after successful sale
      if (catalogOrderData?.catalogOrderId) {
        await supabase
          .from("saved_carts")
          .update({ status: "converted" } as any)
          .eq("id", catalogOrderData.catalogOrderId);
        queryClient.invalidateQueries({ queryKey: ["catalog-orders"] });
      }
      // Mark partner point sale as completed after successful sale
      if (partnerPointOrderData?.partnerPointSaleId) {
        await supabase
          .from("partner_point_sales")
          .update({
            pass_status: "completed",
            converted_sale_id: result?.sale_id || null,
          } as any)
          .eq("id", partnerPointOrderData.partnerPointSaleId);
        queryClient.invalidateQueries({ queryKey: ["partner-point-orders"] });
      }

      queryClient.invalidateQueries({ queryKey: ["registered-customers-for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["partner-sales"] });
      queryClient.invalidateQueries({ queryKey: ["products-for-partner-report"] });
      queryClient.invalidateQueries({ queryKey: ["product-partnerships-report"] });
      queryClient.invalidateQueries({ queryKey: ["settlement-splits"] });
      queryClient.invalidateQueries({ queryKey: ["settlement-sales"] });
      queryClient.invalidateQueries({ queryKey: ["financial-splits-received"] });
      queryClient.invalidateQueries({ queryKey: ["financial-splits-all"] });
      queryClient.invalidateQueries({ queryKey: ["my-products-financial"] });
      queryClient.invalidateQueries({ queryKey: ["product-partnerships-financial"] });

      toast({ title: "Venda registrada com sucesso!" });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => { toast({ title: "Erro ao registrar venda", description: error.message, variant: "destructive" }); },
  });

  // ─── Effects ──────────────────────────────────────────────
  // Auto-reopen if cart has items
  useEffect(() => {
    if (cart.length > 0 && !open) onOpenChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft notes
  useEffect(() => {
    if (fromDraftId && draftNotes) {
      setNotes(decodeURIComponent(draftNotes));
    }
  }, [fromDraftId, draftNotes]);

  // Pending sale from approved stock request
  useEffect(() => {
    const pendingSaleData = sessionStorage.getItem("pendingSaleFromRequest");
    if (!pendingSaleData) return;
    const loadPendingSale = async () => {
      try {
        const saleData = JSON.parse(pendingSaleData);
        sessionStorage.removeItem("pendingSaleFromRequest");
        if (saleData.requestId) setPendingRequestId(saleData.requestId);

        // Fetch real product data from DB to get accurate cost_price
        let productPrice = Number(saleData.productPrice) || 0;
        let costPrice: number | undefined;
        let ownerId = "";
        let groupId: string | null = null;

        if (saleData.productId) {
          const { data: dbProduct } = await supabase
            .from("products")
            .select("price, cost_price, owner_id, group_id")
            .eq("id", saleData.productId)
            .single();
          if (dbProduct) {
            productPrice = dbProduct.price ?? productPrice;
            costPrice = dbProduct.cost_price ?? undefined;
            ownerId = dbProduct.owner_id ?? "";
            groupId = dbProduct.group_id ?? null;
          }
        }

        let displayName = saleData.productName || "Produto";
        const variantParts = [];
        if (saleData.variantColor) variantParts.push(saleData.variantColor);
        if (saleData.variantSize) variantParts.push(saleData.variantSize);
        if (variantParts.length > 0) displayName += ` (${variantParts.join(' - ')})`;
        const partnerProduct: Product = { id: saleData.productId, name: displayName, price: productPrice, cost_price: costPrice, stock_quantity: saleData.quantity, owner_id: ownerId, group_id: groupId, category: "", color: saleData.variantColor || null, size: saleData.variantSize || null };
        const variant = saleData.variantId ? { id: saleData.variantId, product_id: saleData.productId, size: saleData.variantSize || "", stock_quantity: saleData.quantity, image_url: null } as ProductVariant : null;
        setCart([{ product: partnerProduct, quantity: saleData.quantity, isPartnerStock: true, ownerName: saleData.ownerName, variant, fromApprovedRequest: true }]);
        onOpenChange(true);
        toast({ title: "Produto do parceiro adicionado", description: `${displayName} (${saleData.quantity}x) de ${saleData.ownerName} foi adicionado ao carrinho.` });
      } catch (e) {
        console.error("Error parsing pending sale data:", e);
        sessionStorage.removeItem("pendingSaleFromRequest");
      }
    };
    loadPendingSale();
  }, []);

  // Voice command processing
  useEffect(() => {
    if (!voiceCommand || !open) return;
    if (voiceCommand.customerName) setCustomerName(voiceCommand.customerName);
    if (voiceCommand.paymentMethod) {
      const matchedMethod = customPaymentMethods.find(m => m.name.toLowerCase().includes(voiceCommand.paymentMethod?.toLowerCase() || ""));
      if (matchedMethod) setSelectedPaymentMethodId(matchedMethod.id);
    }
    setVoiceSaleCommand(voiceCommand);
    setShowVoiceSaleDialog(true);
    onVoiceCommandProcessed?.();
  }, [voiceCommand, open]);

  // Voice product selected handler
  const handleVoiceProductSelected = useCallback((product: Product, variant: any, quantity: number) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id && (!variant || item.variant?.id === variant?.id));
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + quantity };
        return updated;
      }
      return [...prev, { product, quantity, isPartnerStock: false, variant: variant || null }];
    });
    setProductSearch("");
    setTimeout(() => productSearchInputRef.current?.focus(), 100);
    toast({ title: "✓ Produto adicionado ao carrinho!", description: `${quantity}x ${product.name}${variant ? ` - ${variant.color || ''} ${variant.size}` : ''}` });
  }, [setCart]);

  // ─── JSX ──────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setProductSearch(""); }}>
        <DialogContent className="max-w-4xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Venda</DialogTitle>
          </DialogHeader>

          {/* Import Cart by Code */}
          <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/30">
            <Download className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Importar carrinho (ex: VP-A3F2)"
              value={importCartCode}
              onChange={e => setImportCartCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") handleImportCart(); }}
              className="h-8 text-sm flex-1"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={handleImportCart} disabled={isImporting || !importCartCode.trim()}>
              {isImporting ? "Importando..." : "Importar"}
            </Button>
          </div>

          {/* Mobile: Show totals at top */}
          {isMobile && (
            <div className="bg-primary/10 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total da Venda:</span>
                <span className="text-xl font-bold text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
              {cart.length > 0 && discountAmount > 0 && (
                <p className="text-xs text-muted-foreground text-right">Subtotal: R$ {subtotal.toFixed(2).replace(".", ",")} | Desc: -R$ {discountAmount.toFixed(2).replace(".", ",")}</p>
              )}
              {cart.length === 0 && <p className="text-xs text-muted-foreground">Adicione produtos ao carrinho</p>}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Product Selection */}
            <div className="space-y-4">
              <div>
                <Label>Buscar Produto</Label>
                <Input
                  ref={productSearchInputRef}
                  placeholder="Digite o nome do produto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyUp={(e) => { if (e.key === 'Enter' && productSearch.length >= 2) handleProductSearch(productSearch); }}
                  autoComplete="off"
                />
                {directGroupIds.length > 0 && <p className="text-xs text-muted-foreground mt-1">Mostrando seu estoque e de parceiras 1-1</p>}
              </div>

              {debouncedSearch && debouncedSearch.length >= 2 && (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {combinedProductsList.ownProducts.length === 0 && combinedProductsList.partnerProducts.length === 0 ? (
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>
                      <Button variant="link" className="p-0 h-auto text-sm text-primary hover:text-primary/80" type="button" onClick={(e) => { e.preventDefault(); handleProductSearch(productSearch, { forcePartner: true }); }}>
                        Buscar nos estoques de grupos
                      </Button>
                    </div>
                  ) : (
                    <>
                      {combinedProductsList.ownProducts.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-secondary/30 text-xs font-medium text-muted-foreground">Seu Estoque</div>
                          {combinedProductsList.ownProducts.map((product) => {
                            const noCost = product.cost_price == null || product.cost_price <= 0;
                            return (
                            <button type="button" key={product.id} className="w-full p-3 text-left hover:bg-secondary/50 flex justify-between items-center border-b last:border-b-0" onClick={() => handleProductClick(product)}>
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Estoque: {product.stock_quantity}
                                  {noCost && <span className="text-destructive ml-1">• Sem custo</span>}
                                  {!noCost && " • Toque para selecionar"}
                                </p>
                              </div>
                              <p className="font-semibold">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                            </button>
                            );
                          })}
                        </>
                      )}
                      {combinedProductsList.partnerProducts.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-primary/10 text-xs font-medium text-primary flex items-center gap-1">
                            <Users className="h-3 w-3" />Estoque de Parceiras
                          </div>
                          {combinedProductsList.partnerProducts.map((product) => (
                            <button type="button" key={`partner-${product.id}`} className="w-full p-3 text-left hover:bg-primary/5 flex justify-between items-center border-b last:border-b-0"
                              onClick={() => { handleRequestReserve({ ...product, ownerName: product.ownerName, ownerEmail: "" }); }}>
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-xs text-primary">{product.ownerName} • {product.stock_quantity} un • Requer reserva</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                                <Clock className="h-4 w-4 text-primary" />
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      <div className="p-2 border-t">
                        <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground hover:text-primary" type="button" onClick={(e) => { e.preventDefault(); handleProductSearch(productSearch, { forcePartner: true }); }}>
                          Buscar também em outros grupos
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Cart */}
              <div>
                <Label>Carrinho ({cart.length} itens)</Label>
                <div className="border rounded-lg mt-2 max-h-64 overflow-y-auto">
                  {cart.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">Adicione produtos ao carrinho</p>
                  ) : (
                    cart.map((item) => {
                      const itemKey = item.variant ? item.variant.id : item.product.id;
                      const stockLimit = item.variant ? item.variant.stock_quantity : item.product.stock_quantity;
                      let displayName = item.product.name;
                      if (item.variant) {
                        const parts = [];
                        if (item.variant.size) parts.push(item.variant.size);
                        if (parts.length > 0) displayName += ` (${parts.join(' - ')})`;
                      }
                      return (
                        <div key={itemKey} className="p-3 flex items-center justify-between border-b last:border-b-0">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{displayName}</p>
                            <p className="text-sm text-muted-foreground">R$ {item.product.price.toFixed(2).replace(".", ",")} x {item.quantity}</p>
                            {item.isPartnerStock && item.ownerName && <p className="text-xs text-primary mt-0.5">Origem: Estoque Parceiro - {item.ownerName}</p>}
                            {!item.isPartnerStock && (item.product.isB2B || item.product.b2b_source_product_id) && <p className="text-xs text-amber-600 mt-0.5">Origem: Sob Encomenda (B2B)</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-10 w-10" onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, -1, item.variant?.id); }}><Minus className="h-4 w-4" /></Button>
                            <Input type="number" inputMode="numeric" min={1} max={stockLimit} value={item.quantity}
                              onChange={(e) => {
                                const parsed = Number(e.target.value);
                                const newQty = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                                setCart((prev) => prev.map((c) => {
                                  if (item.variant) { if (c.variant?.id === item.variant!.id) return { ...c, quantity: Math.min(Math.max(1, newQty), stockLimit) }; }
                                  else if (c.product.id === item.product.id && !c.variant) return { ...c, quantity: Math.min(Math.max(1, newQty), stockLimit) };
                                  return c;
                                }));
                              }}
                              className="w-14 h-10 text-center px-1" />
                            <Button variant="outline" size="icon" className="h-10 w-10" onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, 1, item.variant?.id); }}><Plus className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id, item.variant?.id); }}><X className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right: Sale Details */}
            <div className="space-y-4">
              {/* Customer Selection */}
              <div>
                <Label>Selecionar Cliente Cadastrado</Label>
                <Select value={selectedCustomerId || "manual"} onValueChange={(v) => handleCustomerSelect(v === "manual" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione ou digite manualmente" /></SelectTrigger>
                  <SelectContent portal={!isMobile}>
                    <SelectItem value="manual">Digitar manualmente</SelectItem>
                    {registeredCustomers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>{customer.name} {customer.phone ? `- ${customer.phone}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input placeholder="Opcional" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomerId(""); }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input placeholder="(00) 00000-0000" value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setSelectedCustomerId(""); }} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><Instagram className="h-3.5 w-3.5" />Instagram</Label>
                    <Input placeholder="@usuario" value={customerInstagram} onChange={(e) => setCustomerInstagram(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={selectedPaymentMethodId || "default"} onValueChange={(v) => { setSelectedPaymentMethodId(v === "default" ? "" : v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent portal={!isMobile}>
                    <SelectItem value="default">Dinheiro (sem taxa)</SelectItem>
                    {customPaymentMethods.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.fee_percent > 0 ? `(${m.fee_percent}%)` : ""} {m.is_deferred ? "⏳" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>

              {/* Partner Point Commission Banner */}
              {partnerPointOrderData && (
                <div className="p-3 bg-muted/50 rounded-lg border space-y-1.5">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Venda via {partnerPointOrderData.partnerName}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Comissão do parceiro:</span>
                    <Badge variant="outline" className="font-mono">
                      {partnerPointOrderData.rackCommissionPct}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fórmula: (Total − Taxas) × {partnerPointOrderData.rackCommissionPct}%
                  </p>
                </div>
              )}
              </div>

              {/* Deferred payment fields */}
              {customPaymentMethods.find(m => m.id === selectedPaymentMethodId)?.is_deferred && (
                <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">💳 Pagamento a prazo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>1ª Data de Vencimento</Label>
                      <Input type="date" value={dueDate} onChange={(e) => {
                        setDueDate(e.target.value);
                        // Auto-generate installments when date changes
                        if (installments > 1 && e.target.value) {
                          const details = [];
                          const installmentAmount = Math.floor((total / installments) * 100) / 100;
                          const remainder = Math.round((total - installmentAmount * installments) * 100) / 100;
                          for (let i = 0; i < installments; i++) {
                            const date = new Date(e.target.value + "T12:00:00");
                            date.setMonth(date.getMonth() + i);
                            details.push({
                              dueDate: date.toISOString().split("T")[0],
                              amount: i === 0 ? installmentAmount + remainder : installmentAmount,
                            });
                          }
                          setInstallmentDetails(details);
                        }
                      }} />
                    </div>
                    <div>
                      <Label>Parcelas</Label>
                      <Input type="number" min="1" max="24" value={installments} onChange={(e) => {
                        const n = Math.max(1, Math.min(24, Number(e.target.value)));
                        setInstallments(n);
                        if (n > 1 && dueDate) {
                          const details = [];
                          const installmentAmount = Math.floor((total / n) * 100) / 100;
                          const remainder = Math.round((total - installmentAmount * n) * 100) / 100;
                          for (let i = 0; i < n; i++) {
                            const date = new Date(dueDate + "T12:00:00");
                            date.setMonth(date.getMonth() + i);
                            details.push({
                              dueDate: date.toISOString().split("T")[0],
                              amount: i === 0 ? installmentAmount + remainder : installmentAmount,
                            });
                          }
                          setInstallmentDetails(details);
                        } else {
                          setInstallmentDetails([]);
                        }
                      }} />
                    </div>
                  </div>
                  {/* Editable installment details */}
                  {installments > 1 && installmentDetails.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Detalhes das parcelas (editável):</p>
                      <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {installmentDetails.map((inst, idx) => (
                          <div key={idx} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                            <span className="text-xs font-medium text-muted-foreground w-6">{idx + 1}x</span>
                            <Input
                              type="date"
                              value={inst.dueDate}
                              className="h-8 text-sm"
                              onChange={(e) => {
                                setInstallmentDetails(prev => prev.map((item, i) => i === idx ? { ...item, dueDate: e.target.value } : item));
                              }}
                            />
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={inst.amount}
                                className="h-8 text-sm pl-8"
                                onChange={(e) => {
                                  setInstallmentDetails(prev => prev.map((item, i) => i === idx ? { ...item, amount: Number(e.target.value) } : item));
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Soma: R$ {installmentDetails.reduce((s, i) => s + i.amount, 0).toFixed(2).replace(".", ",")}
                        {Math.abs(installmentDetails.reduce((s, i) => s + i.amount, 0) - total) > 0.01 && (
                          <span className="text-destructive ml-1">(diferença de R$ {Math.abs(installmentDetails.reduce((s, i) => s + i.amount, 0) - total).toFixed(2).replace(".", ",")})</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Desconto</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent portal={!isMobile}>
                      <SelectItem value="fixed">R$ Fixo</SelectItem>
                      <SelectItem value="percentage">% Percentual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor do Desconto</Label>
                  <Input type="number" inputMode="decimal" min="0" placeholder="0" value={discountValue || ""} onChange={(e) => setDiscountValue(Number(e.target.value))} />
                </div>
              </div>

              {/* Shipping Section */}
              <ShippingSection
                value={shippingData}
                onChange={setShippingData}
                shippingConfig={shippingProfile || undefined}
                customerAddress={selectedCustomerId ? (() => {
                  const c = registeredCustomers.find(cu => cu.id === selectedCustomerId);
                  if (!c?.address_zip) return undefined;
                  return { address_zip: c.address_zip, address_street: c.address_street || "", address_number: c.address_number || "", address_complement: c.address_complement || "", address_neighborhood: c.address_neighborhood || "", address_city: c.address_city || "", address_state: c.address_state || "" };
                })() : undefined}
                quoteProducts={quoteProducts}
                onTrackingGenerated={(tracking, labelUrl) => { setShippingTracking(tracking); setShippingLabelUrl(labelUrl); }}
                saleId={saleIdForShipping}
              />

              {/* Notes */}
              <div>
                <Label>Observações</Label>
                <Textarea placeholder="Observações da venda..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>

              {/* Totals */}
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>R$ {subtotal.toFixed(2).replace(".", ",")}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-sm text-destructive"><span>Desconto</span><span>- R$ {discountAmount.toFixed(2).replace(".", ",")}</span></div>}
                {shippingCostForBuyer > 0 && <div className="flex justify-between text-sm text-blue-600"><span>Frete (compradora)</span><span>+ R$ {shippingCostForBuyer.toFixed(2).replace(".", ",")}</span></div>}
                {shippingData.method !== "presencial" && shippingData.cost > 0 && shippingData.payer === "seller" && (
                  <div className="flex justify-between text-sm text-muted-foreground"><span>Frete (despesa vendedora)</span><span>R$ {shippingData.cost.toFixed(2).replace(".", ",")}</span></div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total</span><span>R$ {total.toFixed(2).replace(".", ",")}</span></div>
              </div>

              {/* Profit Breakdown Card */}
              {user && (
                <ProfitBreakdownCard
                  cart={cart}
                  currentUserId={user.id}
                  currentUserName={profiles.find(p => p.id === user.id)?.full_name}
                  groupCommissionPercent={0.20}
                  hasActivePartnership={hasActivePartnership}
                  paymentFeePercent={selectedPaymentMethodId ? (customPaymentMethods.find(m => m.id === selectedPaymentMethodId)?.fee_percent || 0) : 0}
                  saleNetMultiplier={subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1}
                  productPartnerships={productPartnershipsMap}
                  profiles={profiles}
                />
              )}

              <Button className="w-full" size="lg"
                disabled={cart.filter(i => !i.isPartnerStock || i.fromApprovedRequest).length === 0 || createSaleMutation.isPending}
                onClick={() => createSaleMutation.mutate()}>
                {createSaleMutation.isPending ? "Registrando..." : "Finalizar Venda"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partner Products Dialog */}
      <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Produtos Encontrados em Parceiros</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Não encontramos "{searchedProductName}" no seu estoque, mas encontramos nos parceiros:</p>
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {partnerProducts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Nenhum produto encontrado nos estoques parceiros</p>
            ) : partnerProducts.map((product) => (
              <div key={product.id} className="p-3 flex justify-between items-center border-b last:border-b-0">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">Parceiro: {product.ownerName}</p>
                  <p className="text-xs text-muted-foreground">Disponível: {product.stock_quantity} | R$ {product.price.toFixed(2).replace(".", ",")}</p>
                </div>
                <Button size="sm" onClick={() => handleRequestReserve(product)}><Clock className="h-4 w-4 mr-1" />Solicitar Reserva</Button>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowPartnerDialog(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reserve Request Dialog */}
      <AlertDialog open={showReserveDialog} onOpenChange={setShowReserveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar Reserva</AlertDialogTitle>
            <AlertDialogDescription>
              Você está solicitando uma reserva para o parceiro {selectedPartnerProduct?.ownerName}. Após a confirmação, o parceiro receberá a solicitação e poderá aprovar ou recusar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedPartnerProduct && (
            <div className="space-y-4 py-2">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="font-medium">{selectedPartnerProduct.name}</p>
                <p className="text-sm text-muted-foreground">Preço: R$ {selectedPartnerProduct.price.toFixed(2).replace(".", ",")}</p>
              </div>
              {loadingReserveVariants ? (
                <div className="text-center py-4 text-muted-foreground">Carregando variantes...</div>
              ) : reserveVariants.length > 0 ? (
                <div>
                  <Label>Selecione a Variante *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto">
                    {reserveVariants.map((variant) => (
                      <button key={variant.id} type="button" onClick={() => { setSelectedReserveVariant(variant); setReserveQuantity(1); }}
                        className={`p-2 text-left rounded-lg border-2 transition-all ${selectedReserveVariant?.id === variant.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                        <p className="font-medium text-sm">{variant.size}</p>
                        <p className="text-xs text-muted-foreground">{variant.stock_quantity} un</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Disponível: {selectedPartnerProduct.stock_quantity} unidades</p>
              )}
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min="1" max={selectedReserveVariant?.stock_quantity || selectedPartnerProduct.stock_quantity}
                  value={reserveQuantity} onChange={(e) => setReserveQuantity(Math.min(Number(e.target.value), selectedReserveVariant?.stock_quantity || selectedPartnerProduct.stock_quantity))} />
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea placeholder="Adicione uma mensagem para o parceiro..." value={reserveNotes} onChange={(e) => setReserveNotes(e.target.value)} />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={createReserveMutation.isPending || (reserveVariants.length > 0 && !selectedReserveVariant)}
              onClick={() => { if (selectedPartnerProduct) createReserveMutation.mutate({ product: selectedPartnerProduct, quantity: reserveQuantity, notes: reserveNotes, variant: selectedReserveVariant }); }}>
              {createReserveMutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inline Cost Price Dialog */}
      <AlertDialog open={!!costPriceProduct} onOpenChange={(open) => { if (!open) setCostPriceProduct(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preço de Custo Obrigatório</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <strong>{costPriceProduct?.name}</strong> não possui preço de custo cadastrado. Insira o valor para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Preço de Custo (R$)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="Ex: 45,00"
              value={costPriceValue}
              onChange={(e) => setCostPriceValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveCostPrice(); }}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveCostPrice} disabled={savingCostPrice || !costPriceValue}>
              {savingCostPrice ? "Salvando..." : "Salvar e Adicionar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Variant Selection Dialog */}
      <VariantSelectionDialog
        open={showVariantDialog}
        onOpenChange={setShowVariantDialog}
        product={selectedProductForVariant}
        onConfirm={handleVariantConfirm}
        isB2B={!!selectedProductForVariant?.isB2B}
      />

      {/* Voice Sale Dialog */}
      <VoiceSaleDialog
        open={showVoiceSaleDialog}
        onOpenChange={setShowVoiceSaleDialog}
        command={voiceSaleCommand}
        userId={user?.id || ''}
        onProductSelected={handleVoiceProductSelected}
      />
    </>
  );
}
