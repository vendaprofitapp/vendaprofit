import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, Search, Calendar, ShoppingCart, Eye, Trash2, X, Minus, Users, Clock, CheckCircle, XCircle, Mic, Instagram, Edit2, Truck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculateSaleSplits } from "@/utils/profitEngine";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { VoiceCommandButton } from "@/components/voice/VoiceCommandButton";
import { VoiceCommandFeedback } from "@/components/voice/VoiceCommandFeedback";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { EditSaleDialog } from "@/components/sales/EditSaleDialog";
import { ShippingSection, ShippingData, ShippingConfig, ShippingQuoteProduct } from "@/components/sales/ShippingSection";

interface Product {
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
}

interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  stock_quantity: number;
  image_url: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  isPartnerStock: boolean;
  ownerName?: string;
  variant?: ProductVariant | null;
  fromApprovedRequest?: boolean;
}

interface Sale {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
  shipping_method: string | null;
  shipping_company: string | null;
  shipping_cost: number | null;
  shipping_payer: string | null;
  shipping_address: string | null;
  shipping_notes: string | null;
  shipping_tracking: string | null;
  shipping_label_url: string | null;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
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

const statusConfig = {
  completed: { label: "Concluída", variant: "default" as const },
  pending: { label: "Pendente", variant: "secondary" as const },
  cancelled: { label: "Cancelada", variant: "destructive" as const },
};

export default function Sales() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  
  // New sale form state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerInstagram, setCustomerInstagram] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [installments, setInstallments] = useState(1);
  const [shippingData, setShippingData] = useState<ShippingData>({
    method: "presencial",
    company: "",
    cost: 0,
    payer: "seller",
    address: "",
    notes: "",
  });
  const [shippingLabelUrl, setShippingLabelUrl] = useState<string | null>(null);
  const [saleIdForShipping, setSaleIdForShipping] = useState<string>("");
  const [shippingTracking, setShippingTracking] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  // Auto partner lookup (when product is not in own stock)
  const [autoPartnerLastQuery, setAutoPartnerLastQuery] = useState<string>("");
  const [autoPartnerSearching, setAutoPartnerSearching] = useState(false);

  // Voice sale dialog state
  const [showVoiceSaleDialog, setShowVoiceSaleDialog] = useState(false);
  const [voiceSaleCommand, setVoiceSaleCommand] = useState<{
    productSearch: string;
    quantity: number;
    color?: string | null;
    size?: string | null;
    customerName?: string | null;
    paymentMethod?: string | null;
  } | null>(null);

  // Edit sale dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Ref for product search input to focus after voice add
  const productSearchInputRef = useRef<HTMLInputElement>(null);

  // Fetch sales
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user,
  });

  // Fetch OWN products for adding to cart (only user's own stock)
  const { data: ownProducts = [] } = useQuery({
    queryKey: ["own-products-for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size, weight_grams, width_cm, height_cm, length_cm")
        .eq("is_active", true)
        .eq("owner_id", user?.id)
        .gt("stock_quantity", 0)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Fetch registered customers for selection (including address)
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
    enabled: !!user,
  });

  // Fetch profiles for partner names
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's shipping config from profile
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
    enabled: !!user,
  });

  // Build quote products from cart (only items with weight/dimensions)
  const quoteProducts: ShippingQuoteProduct[] = useMemo(() => {
    return cart
      .filter((item) => {
        const p = item.product as any;
        return p.weight_grams && p.width_cm && p.height_cm && p.length_cm;
      })
      .map((item) => {
        const p = item.product as any;
        return {
          weight_grams: p.weight_grams,
          width_cm: p.width_cm,
          height_cm: p.height_cm,
          length_cm: p.length_cm,
          quantity: item.quantity,
        };
      });
  }, [cart]);

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
    enabled: !!user,
  });

  // Fetch user's groups (with is_direct flag)
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
    enabled: !!user,
  });

  // Extract just group IDs for queries that need them
  const userGroups = useMemo(() => userGroupsData.map(g => g.group_id), [userGroupsData]);
  
  // Get direct (1-1) partnership group IDs
  const directGroupIds = useMemo(() => 
    userGroupsData
      .filter(g => (g.groups as any)?.is_direct === true)
      .map(g => g.group_id),
    [userGroupsData]
  );

  // Fetch products from 1-1 partners to show in product list
  const { data: partnerProductsForList = [] } = useQuery({
    queryKey: ["partner-products-for-sale-list", directGroupIds, profiles],
    queryFn: async () => {
      if (directGroupIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("product_partnerships")
        .select(`
          product_id,
          group_id,
          product:products!inner(
            id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size
          )
        `)
        .in("group_id", directGroupIds)
        .neq("products.owner_id", user?.id)
        .eq("products.is_active", true)
        .gt("products.stock_quantity", 0);
      
      if (error) throw error;
      
      // Deduplicate by product id
      const uniqueById = new Map<string, any>();
      for (const row of data || []) {
        const product = (row as any).product;
        if (product?.id && !uniqueById.has(product.id)) {
          const owner = profiles.find(p => p.id === product.owner_id);
          uniqueById.set(product.id, {
            ...product,
            isPartner: true,
            ownerName: owner?.full_name || "Parceira",
          });
        }
      }
      
      return Array.from(uniqueById.values()) as (Product & { isPartner: boolean; ownerName: string })[];
    },
    enabled: !!user && directGroupIds.length > 0 && profiles.length > 0,
  });

  // Fetch product partnerships for user's own products (to detect when own stock is in a partnership)
  const { data: ownProductPartnerships = [] } = useQuery({
    queryKey: ["own-product-partnerships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_partnerships")
        .select(`
          product_id,
          group_id,
          group:groups!inner(id, is_direct, cost_split_ratio, profit_share_seller, profit_share_partner, commission_percent)
        `)
        .in("group_id", userGroups);
      if (error) throw error;
      return data;
    },
    enabled: !!user && userGroups.length > 0,
  });

  // Create a map of product ID to partnership info for ProfitBreakdownCard
  const productPartnershipsMap = useMemo(() => {
    const map = new Map<string, {
      groupId: string;
      isDirect: boolean;
      costSplitRatio: number;
      profitShareSeller: number;
      profitSharePartner: number;
      commissionPercent: number;
    }>();
    
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

  // Check if user has any active partnerships (for profit breakdown display)
  const hasActivePartnership = userGroups.length > 0;

  // Search partner products when own stock doesn't have the product
  const searchPartnerProducts = async (searchName: string) => {
    if (!user || userGroups.length === 0) return [];

    // IMPORTANT: do NOT fetch all shared IDs first (can exceed URL limits and cause 400 Bad Request).
    // Query partnerships and join products in a single request, filtered by the user's groups.
    const { data, error } = await supabase
      .from("product_partnerships")
      .select(
        "product:products!inner(id, name, price, cost_price, stock_quantity, owner_id, group_id, category, color, size)"
      )
      .in("group_id", userGroups)
      .eq("products.is_active", true)
      .gt("products.stock_quantity", 0)
      .neq("products.owner_id", user.id)
      .ilike("products.name", `%${searchName}%`)
      .order("name", { foreignTable: "products" })
      .limit(50);

    if (error) {
      console.error("Error searching partner products:", error);
      return [];
    }

    // Deduplicate (a product can be shared in multiple groups)
    const uniqueById = new Map<string, any>();
    for (const row of data || []) {
      const product = (row as any).product;
      if (product?.id && !uniqueById.has(product.id)) uniqueById.set(product.id, product);
    }

    // Map owner names
    return Array.from(uniqueById.values()).map((p) => {
      const owner = profiles.find((prof) => prof.id === p.owner_id);
      return {
        ...p,
        ownerName: owner?.full_name || "Parceiro",
        ownerEmail: owner?.email || "",
      } as PartnerProduct;
    });
  };

  // Create stock request mutation with variant support
  const createReserveMutation = useMutation({
    mutationFn: async ({ 
      product, 
      quantity, 
      notes, 
      variant 
    }: { 
      product: PartnerProduct; 
      quantity: number; 
      notes: string;
      variant?: ProductVariant | null;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("stock_requests")
        .insert({
          product_id: product.id,
          requester_id: user.id,
          owner_id: product.owner_id,
          quantity,
          notes: notes || null,
          status: "pending",
          variant_id: variant?.id || null,
          variant_color: null,
          variant_size: variant?.size || null,
          product_name: product.name,
          product_price: product.price,
        })
        .select()
        .single();

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
    onError: (error) => {
      toast({ title: "Erro ao solicitar reserva", description: error.message, variant: "destructive" });
    },
  });

  // Fetch variants for partner product when opening reserve dialog
  const loadPartnerVariants = async (productId: string) => {
    setLoadingReserveVariants(true);
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, product_id, size, stock_quantity, image_url")
        .eq("product_id", productId)
        .gt("stock_quantity", 0)
        .order("size");

      if (error) throw error;
      setReserveVariants(data || []);
      
      // Auto-select if only one variant
      if (data && data.length === 1) {
        setSelectedReserveVariant(data[0]);
      }
    } catch (error) {
      console.error("Error loading variants:", error);
      setReserveVariants([]);
    } finally {
      setLoadingReserveVariants(false);
    }
  };

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (!user || cart.length === 0) throw new Error("Carrinho vazio");

      // Block sale if cart contains partner items not from approved reservations
      const unauthorizedPartnerItems = cart.filter(item => item.isPartnerStock && !item.fromApprovedRequest);
      if (unauthorizedPartnerItems.length > 0) {
        throw new Error("Produtos de parceiros só podem ser vendidos após aprovação da Solicitação de Reserva.");
      }

      // Separate own stock items and partner items
      const ownStockItems = cart.filter(item => !item.isPartnerStock);
      const partnerItems = cart.filter(item => item.isPartnerStock);

      // Calculate subtotal including ALL items (own + partner)
      const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const discountAmount = discountType === "percentage" 
        ? (subtotal * discountValue) / 100 
        : discountValue;
      const shippingForBuyer = shippingData.payer === "buyer" && shippingData.method !== "presencial" ? shippingData.cost : 0;
      const total = Math.max(0, subtotal - discountAmount + shippingForBuyer);

      // If customer name is provided but not from registered customers, create new customer
      if (customerName && !selectedCustomerId) {
        // Check if customer already exists with this name
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("owner_id", user.id)
          .eq("name", customerName.trim())
          .maybeSingle();

        if (!existingCustomer) {
          // Create new customer
          const { error: customerError } = await supabase
            .from("customers")
            .insert({
              owner_id: user.id,
              name: customerName.trim(),
              phone: customerPhone || null,
              instagram: customerInstagram || null,
            });

          if (customerError) {
            console.error("Error creating customer:", customerError);
            // Don't throw - continue with sale even if customer creation fails
          }
        }
      }

      const selectedPaymentMethod = customPaymentMethods.find(m => m.id === selectedPaymentMethodId);
      const paymentMethodName = selectedPaymentMethod?.name || "Dinheiro";
      const feePercent = selectedPaymentMethod?.fee_percent || 0;
      const isDeferred = selectedPaymentMethod?.is_deferred || false;

      // Build notes including partner info if applicable
      let saleNotes = notes || "";
      if (partnerItems.length > 0) {
        const partnerInfo = partnerItems.map(item => 
          `${item.product.name} (${item.quantity}x) - Parceiro: ${item.ownerName}`
        ).join("; ");
        saleNotes = saleNotes 
          ? `${saleNotes} | Itens de parceiros: ${partnerInfo}` 
          : `Itens de parceiros: ${partnerInfo}`;
      }

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          owner_id: user.id,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method: paymentMethodName,
          subtotal,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: discountAmount,
          total,
          notes: saleNotes || null,
          status: isDeferred ? "pending" : "completed",
          shipping_method: shippingData.method || null,
          shipping_company: shippingData.company || null,
          shipping_cost: shippingData.cost || 0,
          shipping_payer: shippingData.method !== "presencial" ? shippingData.payer : null,
          shipping_address: shippingData.address || null,
          shipping_notes: shippingData.notes || null,
          shipping_tracking: shippingTracking || null,
          shipping_label_url: shippingLabelUrl || null,
        } as any)
        .select()
        .single();

      if (saleError) throw saleError;

      // If deferred payment, create payment reminder
      if (isDeferred && dueDate) {
        const { error: reminderError } = await supabase
          .from("payment_reminders")
          .insert({
            sale_id: sale.id,
            owner_id: user.id,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            customer_instagram: customerInstagram || null,
            amount: total,
            due_date: dueDate,
            payment_method_name: paymentMethodName,
            notes: notes || null,
          });
        if (reminderError) console.error("Error creating reminder:", reminderError);
      }

      // Create sale items for ALL items (own + partner)
      const allItemsToInsert = cart.map((item) => {
        let productName = item.product.name;
        if (item.variant) {
          const parts = [];
          if (item.variant.size) parts.push(item.variant.size);
          if (parts.length > 0) productName += ` (${parts.join(' - ')})`;
        }
        if (item.isPartnerStock && item.ownerName) {
          productName += ` [Parceiro: ${item.ownerName}]`;
        }
        return {
          sale_id: sale.id,
          product_id: item.product.id,
          product_name: productName,
          quantity: item.quantity,
          unit_price: item.product.price,
          total: item.product.price * item.quantity,
        };
      });

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(allItemsToInsert);

      if (itemsError) throw itemsError;

      // Update stock ONLY for own stock items (not partner items)
      for (const item of ownStockItems) {
        if (item.variant) {
          // Update variant stock (trigger auto-syncs product stock)
          const { error: variantStockError } = await supabase
            .from("product_variants")
            .update({ stock_quantity: item.variant.stock_quantity - item.quantity })
            .eq("id", item.variant.id);
          if (variantStockError) console.error("Error updating variant stock:", variantStockError);
        } else {
          // Update product stock directly
          const { error: stockError } = await supabase
            .from("products")
            .update({ stock_quantity: item.product.stock_quantity - item.quantity })
            .eq("id", item.product.id);
          if (stockError) console.error("Error updating stock:", stockError);
        }
      }

      // Create financial_splits using profitEngine
      // Calculate the net multiplier (discount effect) to apply to each item proportionally
      const saleNetMultiplier = subtotal > 0 ? total / subtotal : 1;
      
      const financialSplitsToInsert: Array<{
        sale_id: string;
        user_id: string;
        amount: number;
        type: 'cost_recovery' | 'profit_share' | 'group_commission';
        description: string;
      }> = [];

      for (const item of cart) {
        const salePriceGross = item.product.price * item.quantity;
        // Apply discount multiplier to get proportional sale price after discount
        const salePriceAfterDiscount = salePriceGross * saleNetMultiplier;
        const costPrice = (item.product.cost_price || item.product.price * 0.5) * item.quantity;
        const sellerIsOwner = item.product.owner_id === user.id;
        
        // Check if this product is in a partnership (even if it's our own stock)
        // Products in product_partnerships should ALWAYS apply partnership rules
        // PRIORITY: Direct (1-1) partnerships take precedence over group partnerships
        const { data: allProductPartnerships } = await supabase
          .from("product_partnerships")
          .select("group_id, group:groups!inner(id, is_direct, cost_split_ratio, profit_share_seller, profit_share_partner, commission_percent, created_by)")
          .eq("product_id", item.product.id);
        
        // Sort partnerships: direct (1-1) first, then by membership (where user is a member)
        let productPartnershipData: typeof allProductPartnerships extends Array<infer T> ? T : never | null = null;
        
        if (allProductPartnerships && allProductPartnerships.length > 0) {
          // First, try to find a direct partnership where the user is a member
          const directPartnership = allProductPartnerships.find(pp => {
            const g = pp.group as any;
            return g?.is_direct === true;
          });
          
          // If direct partnership exists, use it; otherwise fall back to first available
          productPartnershipData = directPartnership || allProductPartnerships[0];
        }
        
        // If product is in product_partnerships, it's partnership stock regardless of who owns it
        const isInPartnership = !!productPartnershipData?.group_id;
        const isPartnershipStock = item.isPartnerStock || isInPartnership;
        const partnershipGroup = productPartnershipData?.group as {
          id: string;
          is_direct: boolean;
          cost_split_ratio: number;
          profit_share_seller: number;
          profit_share_partner: number;
          commission_percent: number;
        } | null;

        // Pass payment method fee to profitEngine - it will deduct fee before calculating profit
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
          group: partnershipGroup ? {
            commission_percent: partnershipGroup.commission_percent,
            is_direct: partnershipGroup.is_direct,
          } : null,
        });

        // SCENARIO A: Partnership stock sold by partner (seller is also an owner in the partnership)
        // Generate splits for both partners
        if (splitResult.scenario === 'A' && isInPartnership && productPartnershipData?.group_id) {
          // Get all members of this partnership group
          const { data: groupMembers } = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", productPartnershipData.group_id);

          if (groupMembers && groupMembers.length >= 2) {
            // Find the partner (the other member who is not the seller)
            const partnerUserId = groupMembers.find(m => m.user_id !== user.id)?.user_id;

            // Add seller split (current user)
            if (splitResult.seller.costRecovery > 0) {
              financialSplitsToInsert.push({
                sale_id: sale.id,
                user_id: user.id,
                amount: splitResult.seller.costRecovery,
                type: 'cost_recovery',
                description: `Recuperação de custo ${((partnershipGroup?.cost_split_ratio ?? 0.5) * 100).toFixed(0)}% ${profiles.find(p => p.id === user.id)?.full_name || 'Vendedora'} (parceria) - ${item.product.name}`,
              });
            }
            if (splitResult.seller.profitShare > 0) {
              const sellerProfile = profiles.find(p => p.id === user.id);
              const sellerName = sellerProfile?.full_name || 'Vendedora';
              financialSplitsToInsert.push({
                sale_id: sale.id,
                user_id: user.id,
                amount: splitResult.seller.profitShare,
                type: 'profit_share',
                description: `Lucro ${((partnershipGroup?.profit_share_seller ?? 0.7) * 100).toFixed(0)}% ${sellerName} (parceria) - ${item.product.name}`,
              });
            }

            // Add partner split
            if (partnerUserId && splitResult.partner.total > 0) {
              const partnerProfile = profiles.find(p => p.id === partnerUserId);
              const partnerName = partnerProfile?.full_name || 'Sócia';
              if (splitResult.partner.costRecovery > 0) {
                financialSplitsToInsert.push({
                  sale_id: sale.id,
                  user_id: partnerUserId,
                  amount: splitResult.partner.costRecovery,
                  type: 'cost_recovery',
                  description: `Recuperação de custo ${((1 - (partnershipGroup?.cost_split_ratio ?? 0.5)) * 100).toFixed(0)}% ${partnerName} (parceria) - ${item.product.name}`,
                });
              }
              if (splitResult.partner.profitShare > 0) {
                financialSplitsToInsert.push({
                  sale_id: sale.id,
                  user_id: partnerUserId,
                  amount: splitResult.partner.profitShare,
                  type: 'profit_share',
                  description: `Lucro ${((partnershipGroup?.profit_share_partner ?? 0.3) * 100).toFixed(0)}% ${partnerName} (parceria) - ${item.product.name}`,
                });
              }
            }
          }
        }
        // SCENARIO C: Third-party sells partnership stock
        // Generate two financial_splits, one for each partner
        else if (splitResult.scenario === 'C' && isPartnershipStock) {
          // Use the partnership data we already have, or fetch if needed
          const groupId = productPartnershipData?.group_id;

          if (groupId) {
            // Get all members of this partnership group
            const { data: groupMembers } = await supabase
              .from("group_members")
              .select("user_id")
              .eq("group_id", groupId);

            if (groupMembers && groupMembers.length >= 2) {
              // Find the two partners (owner and the other member)
              const ownerUserId = item.product.owner_id;
              const partnerUserId = groupMembers.find(m => m.user_id !== ownerUserId)?.user_id;

              // Add split for owner (sócio 1)
              if (splitResult.owner.total > 0) {
                financialSplitsToInsert.push({
                  sale_id: sale.id,
                  user_id: ownerUserId,
                  amount: splitResult.owner.total,
                  type: 'cost_recovery',
                  description: `Comissão de Cessão de Estoque (Peça vendida por terceiro) - ${item.product.name}`,
                });
              }

              // Add split for partner (sócio 2)
              if (partnerUserId && splitResult.partner.total > 0) {
                financialSplitsToInsert.push({
                  sale_id: sale.id,
                  user_id: partnerUserId,
                  amount: splitResult.partner.total,
                  type: 'cost_recovery',
                  description: `Comissão de Cessão de Estoque (Peça vendida por terceiro) - ${item.product.name}`,
                });
              }

              // Add seller split
              if (splitResult.seller.profitShare > 0) {
                financialSplitsToInsert.push({
                  sale_id: sale.id,
                  user_id: user.id,
                  amount: splitResult.seller.profitShare,
                  type: 'profit_share',
                  description: `Lucro da venda (após pagamento à parceria) - ${item.product.name}`,
                });
              }
            }
          }
        } else {
          // Other scenarios (OWN_STOCK, B): seller splits (current user)
          if (splitResult.seller.total > 0) {
            if (splitResult.seller.costRecovery > 0) {
              financialSplitsToInsert.push({
                sale_id: sale.id,
                user_id: user.id,
                amount: splitResult.seller.costRecovery,
                type: 'cost_recovery',
                description: `Recuperação de custo - ${item.product.name}`,
              });
            }
            if (splitResult.seller.profitShare > 0) {
              financialSplitsToInsert.push({
                sale_id: sale.id,
                user_id: user.id,
                amount: splitResult.seller.profitShare,
                type: 'profit_share',
                description: `Lucro da venda - ${item.product.name}`,
              });
            }
          }

          // Add owner splits (product owner, when different from seller - Scenario B)
          if (splitResult.owner.total > 0 && item.product.owner_id !== user.id) {
            if (splitResult.owner.costRecovery > 0) {
              financialSplitsToInsert.push({
                sale_id: sale.id,
                user_id: item.product.owner_id,
                amount: splitResult.owner.costRecovery,
                type: 'cost_recovery',
                description: `Recuperação de custo (dono) - ${item.product.name}`,
              });
            }
            if (splitResult.owner.groupCommission > 0) {
              financialSplitsToInsert.push({
                sale_id: sale.id,
                user_id: item.product.owner_id,
                amount: splitResult.owner.groupCommission,
                type: 'group_commission',
                description: `Comissão de grupo - ${item.product.name}`,
              });
            }
          }
        }
      }

      // Insert financial splits if there are any
      if (financialSplitsToInsert.length > 0) {
        const { error: splitsError } = await supabase
          .from("financial_splits")
          .insert(financialSplitsToInsert);
        if (splitsError) console.error("Error creating financial splits:", splitsError);
      }

      // Create automatic shipping expense if shipping cost > 0
      if (shippingData.method !== "presencial" && shippingData.cost > 0) {
        const shippingDescription = `Frete ${shippingData.company || shippingData.method} - Venda ${sale.id.slice(0, 8)}${customerName ? ` (${customerName})` : ""}`;
        const { error: expenseError } = await supabase
          .from("expenses")
          .insert({
            owner_id: user.id,
            category: "Frete",
            category_type: "variable",
            amount: shippingData.cost,
            description: shippingDescription,
            expense_date: new Date().toISOString().split("T")[0],
            split_mode: "none",
          });
        if (expenseError) console.error("Error creating shipping expense:", expenseError);
      }

      // Set sale ID for shipping label generation
      setSaleIdForShipping(sale.id);

      return sale;
    },
    onSuccess: async () => {
      // Mark stock request as completed if this sale came from an approved request
      if (pendingRequestId) {
        await supabase
          .from("stock_requests")
          .update({ status: "completed" as any })
          .eq("id", pendingRequestId);
        setPendingRequestId(null);
        queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      }

      // Core lists
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["own-products-for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["registered-customers-for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });

      // Reports / settlements (keep base keys so date-range variants are also refreshed)
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
      setIsNewSaleOpen(false);
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar venda", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerInstagram("");
    setSelectedPaymentMethodId("");
    setInstallments(1);
    setDiscountType("fixed");
    setDiscountValue(0);
    setNotes("");
    setProductSearch("");
    setSelectedCustomerId("");
    setDueDate("");
    setShippingData({
      method: "presencial",
      company: "",
      cost: 0,
      payer: "seller",
      address: "",
      notes: "",
    });
    setShippingLabelUrl(null);
    setShippingTracking(null);
    setSaleIdForShipping("");
    setShippingData({ method: "presencial", company: "", cost: 0, payer: "seller", address: "", notes: "" });
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId === "") {
      setCustomerName("");
      setCustomerPhone("");
      setCustomerInstagram("");
    } else {
      const customer = registeredCustomers.find(c => c.id === customerId);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone || "");
        setCustomerInstagram(customer.instagram || "");
      }
    }
  };

  // Opens variant selection dialog before adding to cart
  const handleProductClick = (product: Product & { isPartner?: boolean; ownerName?: string }) => {
    // Block direct addition of partner products - must go through Solicitação de Reserva
    if (product.isPartner) {
      const partnerProduct: PartnerProduct = {
        ...product,
        ownerName: product.ownerName || "Parceira",
        ownerEmail: "",
      };
      handleRequestReserve(partnerProduct);
      return;
    }
    
    setSelectedProductForVariant(product);
    setSelectedProductPartnerInfo(null);
    setShowVariantDialog(true);
    setProductSearch("");
  };

  // Called when variant is selected and confirmed (now handles partner variants)
  const handleVariantConfirm = (
    product: Product, 
    variant: ProductVariant | null, 
    quantity: number,
    isPartnerStock: boolean = false,
    ownerName?: string
  ) => {
    // Block partner stock from being added via variant dialog - must go through reservation
    if (isPartnerStock) {
      toast({ title: "Produto de parceiro", description: "Use a Solicitação de Reserva para vender produtos de parceiros.", variant: "destructive" });
      return;
    }
    const stockLimit = variant ? variant.stock_quantity : product.stock_quantity;
    
    setCart((prev) => {
      const existing = prev.find((item) => {
        if (variant) {
          return item.variant?.id === variant.id;
        }
        return item.product.id === product.id && !item.variant && item.isPartnerStock === isPartnerStock;
      });
      
      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty <= stockLimit) {
          return prev.map((item) => {
            if (variant && item.variant?.id === variant.id) {
              return { ...item, quantity: newQty };
            }
            if (!variant && item.product.id === product.id && !item.variant && item.isPartnerStock === isPartnerStock) {
              return { ...item, quantity: newQty };
            }
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
  };

  const addToCart = (product: Product, isPartnerStock: boolean = false, ownerName?: string) => {
    // For partner products, add directly without variant selection
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
  };

  const updateQuantity = (itemKey: string, delta: number, variantId?: string) => {
    setCart((prev) =>
      prev.map((item) => {
        // Match by variant id if exists, otherwise by product id
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
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    setCart((prev) => prev.filter((item) => {
      if (variantId) {
        return item.variant?.id !== variantId;
      }
      return !(item.product.id === productId && !item.variant);
    }));
  };

  const handleProductSearch = async (searchValue: string, opts?: { forcePartner?: boolean }) => {
    setProductSearch(searchValue);

    if (searchValue.length < 2) return;

    const forcePartner = !!opts?.forcePartner;

    // Check if product exists in own stock
    const ownMatch = ownProducts.filter((p) =>
      p.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    // If user explicitly requested partner search, always do it (even if there are own matches)
    if (forcePartner || ownMatch.length === 0) {
      setSearchedProductName(searchValue);
      const partnerResults = await searchPartnerProducts(searchValue);
      setAutoPartnerLastQuery(searchValue);

      if (partnerResults.length > 0) {
        toast({
          title: "Encontrado nos parceiros",
          description: `${partnerResults.length} opção(ões) disponível(is) com estoque.`,
        });
        setPartnerProducts(partnerResults);
        setShowPartnerDialog(true);
      } else {
        toast({
          title: "Não encontrado nos parceiros",
          description: "Nenhum parceiro tem este produto com estoque disponível.",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    if (productSearch.length < 2) {
      setAutoPartnerSearching(false);
      return;
    }

    const ownMatch = ownProducts.some((p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    // Only auto-search partners when the user has no match in own stock
    if (ownMatch) return;

    // Avoid repeating the same query (Enter key / manual partner search already handled)
    if (productSearch === autoPartnerLastQuery) return;

    // Avoid multiple concurrent searches
    if (autoPartnerSearching) return;

    const t = window.setTimeout(async () => {
      setAutoPartnerSearching(true);
      setSearchedProductName(productSearch);

      const partnerResults = await searchPartnerProducts(productSearch);
      setAutoPartnerLastQuery(productSearch);
      setAutoPartnerSearching(false);

      if (partnerResults.length > 0) {
        toast({
          title: "Encontrado nos parceiros",
          description: `${partnerResults.length} opção(ões) disponível(is) com estoque.`,
        });
        setPartnerProducts(partnerResults);
        setShowPartnerDialog(true);
      } else {
        toast({
          title: "Não encontrado nos parceiros",
          description: "Nenhum parceiro tem este produto com estoque disponível.",
          variant: "destructive",
        });
      }
    }, 500);

    return () => window.clearTimeout(t);
  }, [productSearch, ownProducts, autoPartnerLastQuery, autoPartnerSearching]);

  // Check for pending sale from approved stock request
  useEffect(() => {
    const pendingSaleData = sessionStorage.getItem("pendingSaleFromRequest");
    if (!pendingSaleData) return;

    try {
      const saleData = JSON.parse(pendingSaleData);
      sessionStorage.removeItem("pendingSaleFromRequest");
      
      // Save the request ID to mark as completed after sale
      if (saleData.requestId) {
        setPendingRequestId(saleData.requestId);
      }

      // Ensure price is a valid number
      const productPrice = Number(saleData.productPrice) || 0;
      
      // Build display name with variant info
      let displayName = saleData.productName || "Produto";
      const variantParts = [];
      if (saleData.variantColor) variantParts.push(saleData.variantColor);
      if (saleData.variantSize) variantParts.push(saleData.variantSize);
      if (variantParts.length > 0) {
        displayName += ` (${variantParts.join(' - ')})`;
      }

      // Create a virtual product for the partner item and add to cart
      const partnerProduct: Product = {
        id: saleData.productId,
        name: displayName,
        price: productPrice,
        stock_quantity: saleData.quantity,
        owner_id: "",
        group_id: null,
        category: "",
        color: saleData.variantColor || null,
        size: saleData.variantSize || null,
      };

      // Create virtual variant if present
      const variant = saleData.variantId ? {
        id: saleData.variantId,
        product_id: saleData.productId,
        color: saleData.variantColor || null,
        size: saleData.variantSize || "",
        stock_quantity: saleData.quantity,
        image_url: null,
      } as ProductVariant : null;

      // Add to cart as partner stock WITH fromApprovedRequest flag
      setCart([{
        product: partnerProduct,
        quantity: saleData.quantity,
        isPartnerStock: true,
        ownerName: saleData.ownerName,
        variant,
        fromApprovedRequest: true,
      }]);

      // Open the new sale dialog
      setIsNewSaleOpen(true);

      toast({
        title: "Produto do parceiro adicionado",
        description: `${displayName} (${saleData.quantity}x) de ${saleData.ownerName} foi adicionado ao carrinho.`,
      });
    } catch (e) {
      console.error("Error parsing pending sale data:", e);
      sessionStorage.removeItem("pendingSaleFromRequest");
    }
  }, []);

  const handleRequestReserve = (product: PartnerProduct) => {
    setSelectedPartnerProduct(product);
    setReserveQuantity(1);
    setReserveNotes("");
    setSelectedReserveVariant(null);
    setReserveVariants([]);
    setShowReserveDialog(true);
    setShowPartnerDialog(false);
    // Load variants for the product
    loadPartnerVariants(product.id);
  };

  // Calculate subtotal for ALL items (own + partner) using useMemo for real-time updates
  const { subtotal, discountAmount, shippingCostForBuyer, total } = useMemo(() => {
    const calculatedSubtotal = cart.reduce((sum, item) => {
      const itemPrice = item.product.price || 0;
      return sum + itemPrice * item.quantity;
    }, 0);
    
    const calculatedDiscount = discountType === "percentage" 
      ? (calculatedSubtotal * discountValue) / 100 
      : discountValue;
    
    const shippingForBuyer = shippingData.payer === "buyer" && shippingData.method !== "presencial" ? shippingData.cost : 0;
    
    const calculatedTotal = Math.max(0, calculatedSubtotal - calculatedDiscount + shippingForBuyer);
    
    return {
      subtotal: calculatedSubtotal,
      discountAmount: calculatedDiscount,
      shippingCostForBuyer: shippingForBuyer,
      total: calculatedTotal,
    };
  }, [cart, discountType, discountValue, shippingData]);

  const filteredOwnProducts = ownProducts.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Filter partner products for the search list
  const filteredPartnerProducts = useMemo(() => {
    if (!productSearch || productSearch.length < 2) return [];
    const search = productSearch.toLowerCase();
    return partnerProductsForList.filter((p) =>
      p.name.toLowerCase().includes(search)
    );
  }, [partnerProductsForList, productSearch]);

  // Combined list: own products first, then partner products (excluding duplicates by name)
  const combinedProductsList = useMemo(() => {
    const ownIds = new Set(filteredOwnProducts.map(p => p.id));
    // Filter out partner products that are the exact same record (same ID), but allow same-name different products
    const uniquePartnerProducts = filteredPartnerProducts.filter(
      pp => !ownIds.has(pp.id)
    );
    return {
      ownProducts: filteredOwnProducts,
      partnerProducts: uniquePartnerProducts,
    };
  }, [filteredOwnProducts, filteredPartnerProducts]);

  const filteredSales = sales.filter(
    (sale) =>
      sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const viewSaleDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data, error } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", sale.id);
    if (!error && data) {
      setSaleItems(data);
    }
    setIsViewOpen(true);
  };

  const openEditSale = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data, error } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", sale.id);
    if (!error && data) {
      setSaleItems(data);
    }
    setIsEditOpen(true);
  };

  // Stats
  const todaySales = sales.filter((s) => {
    const today = new Date().toDateString();
    return new Date(s.created_at).toDateString() === today && s.status === "completed";
  });
  const todayTotal = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
  const monthSales = sales.filter((s) => {
    const now = new Date();
    const saleDate = new Date(s.created_at);
    return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear() && s.status === "completed";
  });
  const monthTotal = monthSales.reduce((sum, s) => sum + Number(s.total), 0);
  const avgTicket = monthSales.length > 0 ? monthTotal / monthSales.length : 0;

  const isMobile = useIsMobile();

  // Smart voice command handler using AI
  const handleSmartSaleResult = useCallback((result: any, rawText: string) => {
    console.log('Smart sale result:', result);
    
    if (!result.success) {
      toast({ 
        title: "Não foi possível interpretar", 
        description: result.error || result.message || rawText,
        variant: "destructive"
      });
      return;
    }

    // Clear search field to allow new searches
    setProductSearch("");

    // Open new sale dialog
    setIsNewSaleOpen(true);
    
    // Set payment method if identified - try to match with custom methods
    if (result.paymentMethod) {
      const matchedMethod = customPaymentMethods.find(m => 
        m.name.toLowerCase().includes(result.paymentMethod?.toLowerCase() || "")
      );
      if (matchedMethod) {
        setSelectedPaymentMethodId(matchedMethod.id);
      }
    }
    
    // Set customer name if identified
    if (result.customerName) {
      setCustomerName(result.customerName);
    }
    
    // Add product to cart if found by exact ID match
    if (result.productId) {
      setTimeout(() => {
        const matchingProduct = ownProducts.find(p => p.id === result.productId);
        
        if (matchingProduct) {
          const qty = result.quantity || 1;
          // Reset cart and add the product with correct quantity
          setCart([{ product: matchingProduct, quantity: qty, isPartnerStock: false }]);
          
          toast({ 
            title: "✓ Venda reconhecida por voz!", 
            description: `${qty}x ${matchingProduct.name}`
          });
        } else {
          // Product ID not found in own products - use similarity search
          if (result.productName) {
            setVoiceSaleCommand({
              productSearch: result.productName,
              quantity: result.quantity || 1,
              color: result.color || null,
              size: result.size || null,
              customerName: result.customerName || null,
              paymentMethod: result.paymentMethod || null,
            });
            setShowVoiceSaleDialog(true);
          }
        }
      }, 300);
    } else if (result.productName) {
      // No exact product ID - use similarity search dialog
      setVoiceSaleCommand({
        productSearch: result.productName,
        quantity: result.quantity || 1,
        color: result.color || null,
        size: result.size || null,
        customerName: result.customerName || null,
        paymentMethod: result.paymentMethod || null,
      });
      setShowVoiceSaleDialog(true);
    }
  }, [ownProducts, customPaymentMethods]);

  // Handler when product is selected from voice sale dialog
  const handleVoiceProductSelected = useCallback((product: Product, variant: any, quantity: number) => {
    const cartItem: CartItem = {
      product,
      quantity,
      isPartnerStock: false,
      variant: variant || null,
    };
    
    // Add to cart (or update quantity if already exists)
    setCart(prev => {
      // Check if product is already in cart
      const existingIndex = prev.findIndex(item => 
        item.product.id === product.id && 
        (!variant || item.variant?.id === variant?.id)
      );
      
      if (existingIndex >= 0) {
        // Update quantity
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity
        };
        return updated;
      }
      
      return [...prev, cartItem];
    });
    
    // Clear search and focus on input for next product
    setProductSearch("");
    
    // Focus on product search input after a short delay to allow state updates
    setTimeout(() => {
      productSearchInputRef.current?.focus();
    }, 100);
    
    toast({ 
      title: "✓ Produto adicionado ao carrinho!", 
      description: `${quantity}x ${product.name}${variant ? ` - ${variant.color || ''} ${variant.size}` : ''}`
    });
  }, []);

  const { isListening, isProcessing, transcript, isSupported, startListening, stopListening } = useVoiceCommand({
    smartSaleMode: true,
    userId: user?.id,
    onSmartSaleResult: handleSmartSaleResult,
    onError: (error) => {
      toast({ title: "Erro no comando de voz", description: error, variant: "destructive" });
    },
  });

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <MainLayout>
      {/* Voice Command Feedback */}
      <VoiceCommandFeedback isListening={isListening || isProcessing} transcript={transcript} />

      {/* Page Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe e gerencie suas vendas</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {isSupported && (
            <VoiceCommandButton
              isListening={isListening}
              isSupported={isSupported}
              onClick={toggleVoice}
              size={isMobile ? "lg" : "default"}
              showLabel={!isMobile}
              className={isMobile ? "flex-1" : ""}
            />
          )}
          <Button onClick={() => setIsNewSaleOpen(true)} className="flex-1 sm:flex-initial" size={isMobile ? "lg" : "default"}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Venda
          </Button>
        </div>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs sm:text-sm text-muted-foreground">Vendas Hoje</p>
          <p className="text-xl sm:text-2xl font-bold">R$ {todayTotal.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">{todaySales.length} vendas</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs sm:text-sm text-muted-foreground">Vendas do Mês</p>
          <p className="text-xl sm:text-2xl font-bold">R$ {monthTotal.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">{monthSales.length} vendas</p>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <p className="text-xs sm:text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-xl sm:text-2xl font-bold">R$ {avgTicket.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground">baseado em {monthSales.length} vendas</p>
        </div>
      </div>

      {/* Filters - Mobile Optimized */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por ID ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Sales List - Mobile Cards / Desktop Table */}
      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</div>
          ) : (
            filteredSales.map((sale) => {
              const status = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.completed;
              const paymentLabel = sale.payment_method;
              return (
                <div
                  key={sale.id}
                  className="rounded-xl bg-card p-4 shadow-soft cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => viewSaleDetails(sale)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground">{sale.id.slice(0, 8)}</span>
                    </div>
                    <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="font-medium">{sale.customer_name || "Cliente não informado"}</p>
                      <p className="text-xs text-muted-foreground">{paymentLabel} • {new Date(sale.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <p className="text-lg font-bold text-primary">
                      R$ {Number(sale.total).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>ID</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => {
                  const status = statusConfig[sale.status as keyof typeof statusConfig] || statusConfig.completed;
                  const paymentLabel = sale.payment_method;
                  return (
                    <TableRow key={sale.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium text-xs">{sale.id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium">{sale.customer_name || "—"}</TableCell>
                      <TableCell>{paymentLabel}</TableCell>
                      <TableCell className="font-semibold">
                        R$ {Number(sale.total).toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewSaleDetails(sale)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isNewSaleOpen} onOpenChange={(open) => {
        setIsNewSaleOpen(open);
        if (!open) setProductSearch("");
      }}>
        <DialogContent className="max-w-4xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Venda</DialogTitle>
          </DialogHeader>

          {/* Mobile: Show totals at top - always visible */}
          {isMobile && (
            <div className="bg-primary/10 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total da Venda:</span>
                <span className="text-xl font-bold text-primary">
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              </div>
              {cart.length > 0 && discountAmount > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  Subtotal: R$ {subtotal.toFixed(2).replace(".", ",")} | Desc: -R$ {discountAmount.toFixed(2).replace(".", ",")}
                </p>
              )}
              {cart.length === 0 && (
                <p className="text-xs text-muted-foreground">Adicione produtos ao carrinho</p>
              )}
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
                  onKeyUp={(e) => {
                    if (e.key === 'Enter' && productSearch.length >= 2) {
                      handleProductSearch(productSearch);
                    }
                  }}
                  autoComplete="off"
                />
                {directGroupIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Mostrando seu estoque e de parceiras 1-1
                  </p>
                )}
              </div>

              {productSearch && productSearch.length >= 2 && (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {combinedProductsList.ownProducts.length === 0 && combinedProductsList.partnerProducts.length === 0 ? (
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-sm text-primary hover:text-primary/80"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleProductSearch(productSearch, { forcePartner: true });
                        }}
                      >
                        Buscar nos estoques de grupos
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Own products section */}
                      {combinedProductsList.ownProducts.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-secondary/30 text-xs font-medium text-muted-foreground">
                            Seu Estoque
                          </div>
                          {combinedProductsList.ownProducts.slice(0, 10).map((product) => (
                            <button
                              type="button"
                              key={product.id}
                              className="w-full p-3 text-left hover:bg-secondary/50 flex justify-between items-center border-b last:border-b-0"
                              onClick={() => handleProductClick(product)}
                            >
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Estoque: {product.stock_quantity} • Toque para selecionar
                                </p>
                              </div>
                              <p className="font-semibold">
                                R$ {product.price.toFixed(2).replace(".", ",")}
                              </p>
                            </button>
                          ))}
                        </>
                      )}
                      
                      {/* Partner products section */}
                      {combinedProductsList.partnerProducts.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-primary/10 text-xs font-medium text-primary flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Estoque de Parceiras
                          </div>
                          {combinedProductsList.partnerProducts.slice(0, 10).map((product) => (
                            <button
                              type="button"
                              key={`partner-${product.id}`}
                              className="w-full p-3 text-left hover:bg-primary/5 flex justify-between items-center border-b last:border-b-0"
                              onClick={() => {
                                // Partner products MUST go through Solicitação de Reserva
                                const partnerProduct: PartnerProduct = {
                                  ...product,
                                  ownerName: product.ownerName,
                                  ownerEmail: "",
                                };
                                handleRequestReserve(partnerProduct);
                              }}
                            >
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-xs text-primary">
                                  {product.ownerName} • {product.stock_quantity} un • Requer reserva
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">
                                  R$ {product.price.toFixed(2).replace(".", ",")}
                                </p>
                                <Clock className="h-4 w-4 text-primary" />
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      
                      <div className="p-2 border-t">
                        <Button 
                          variant="link" 
                          className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleProductSearch(productSearch, { forcePartner: true });
                          }}
                        >
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
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      Adicione produtos ao carrinho
                    </p>
                  ) : (
                    cart.map((item) => {
                      const itemKey = item.variant ? item.variant.id : item.product.id;
                      const stockLimit = item.variant ? item.variant.stock_quantity : item.product.stock_quantity;
                      
                      // Build display name with variant info
                      let displayName = item.product.name;
                      if (item.variant) {
                        const parts = [];
                        if (item.variant.size) parts.push(item.variant.size);
                        if (parts.length > 0) displayName += ` (${parts.join(' - ')})`;
                      }
                      
                      return (
                        <div
                          key={itemKey}
                          className="p-3 flex items-center justify-between border-b last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{displayName}</p>
                            <p className="text-sm text-muted-foreground">
                              R$ {item.product.price.toFixed(2).replace(".", ",")} x {item.quantity}
                            </p>
                            {item.isPartnerStock && item.ownerName && (
                              <p className="text-xs text-primary mt-0.5">
                                Origem: Estoque Parceiro - {item.ownerName}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.product.id, -1, item.variant?.id);
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={stockLimit}
                              value={item.quantity}
                              onChange={(e) => {
                                const next = e.target.value;
                                const parsed = Number(next);
                                const newQty = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                                setCart((prev) =>
                                  prev.map((c) => {
                                    if (item.variant) {
                                      if (c.variant?.id === item.variant.id) {
                                        return { ...c, quantity: Math.min(Math.max(1, newQty), stockLimit) };
                                      }
                                    } else if (c.product.id === item.product.id && !c.variant) {
                                      return { ...c, quantity: Math.min(Math.max(1, newQty), stockLimit) };
                                    }
                                    return c;
                                  }),
                                );
                              }}
                              className="w-14 h-10 text-center px-1"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.product.id, 1, item.variant?.id);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromCart(item.product.id, item.variant?.id);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou digite manualmente" />
                  </SelectTrigger>
                  <SelectContent portal={!isMobile}>
                    <SelectItem value="manual">Digitar manualmente</SelectItem>
                    {registeredCustomers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} {customer.phone ? `- ${customer.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input
                    placeholder="Opcional"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setSelectedCustomerId("");
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        setSelectedCustomerId("");
                      }}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <Instagram className="h-3.5 w-3.5" />
                      Instagram
                    </Label>
                    <Input
                      placeholder="@usuario"
                      value={customerInstagram}
                      onChange={(e) => {
                        setCustomerInstagram(e.target.value);
                        setSelectedCustomerId("");
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <Label>Forma de Pagamento</Label>
                  {customPaymentMethods.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed bg-muted/30 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhuma forma de pagamento cadastrada
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cadastre em Configurações → Formas de Pagamento
                      </p>
                    </div>
                  ) : (
                    <Select value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent portal={!isMobile}>
                        {customPaymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            <div className="flex items-center gap-2">
                              <span>{method.name}</span>
                              {method.fee_percent > 0 && (
                                <span className="text-xs text-muted-foreground">({method.fee_percent}%)</span>
                              )}
                              {method.is_deferred && (
                                <span className="text-xs text-primary">(a prazo)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Deferred payment - show due date picker */}
                {selectedPaymentMethodId && customPaymentMethods.find(m => m.id === selectedPaymentMethodId)?.is_deferred && (
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                    <Label className="flex items-center gap-2 text-primary">
                      <Calendar className="h-4 w-4" />
                      Data de Vencimento *
                    </Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Você receberá um lembrete com o WhatsApp do cliente para enviar cobrança
                    </p>
                  </div>
                )}

                {/* Fee display */}
                {selectedPaymentMethodId && (customPaymentMethods.find(m => m.id === selectedPaymentMethodId)?.fee_percent || 0) > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Taxa aplicada: {customPaymentMethods.find(m => m.id === selectedPaymentMethodId)?.fee_percent}%
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Desconto</Label>
                  <Select value={discountType} onValueChange={setDiscountType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent portal={!isMobile}>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor do Desconto</Label>
                  <Input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações sobre a venda..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Shipping Section */}
              <ShippingSection
                value={shippingData}
                onChange={setShippingData}
                customerAddress={selectedCustomerId ? registeredCustomers.find(c => c.id === selectedCustomerId) : null}
                shippingConfig={shippingProfile}
                quoteProducts={quoteProducts}
                saleId={saleIdForShipping}
                saleTotal={subtotal}
                customerCpf={selectedCustomerId ? (registeredCustomers.find(c => c.id === selectedCustomerId) as any)?.cpf : null}
                customerName={customerName}
                customerPhone={customerPhone}
                shippingLabelUrl={shippingLabelUrl}
                onLabelGenerated={(url) => setShippingLabelUrl(url)}
                onTrackingGenerated={(tracking, labelUrl) => {
                  setShippingTracking(tracking);
                  if (labelUrl) setShippingLabelUrl(labelUrl);
                }}
              />

              {/* Totals */}
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto</span>
                    <span>- R$ {discountAmount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                {shippingCostForBuyer > 0 && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Frete (compradora)</span>
                    <span>+ R$ {shippingCostForBuyer.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                {shippingData.method !== "presencial" && shippingData.cost > 0 && shippingData.payer === "seller" && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Frete (despesa vendedora)</span>
                    <span>R$ {shippingData.cost.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              {/* Profit Breakdown Card - L.E.V.E. */}
              {user && (
                <ProfitBreakdownCard
                  cart={cart}
                  currentUserId={user.id}
                  groupCommissionPercent={0.20}
                  hasActivePartnership={hasActivePartnership}
                  paymentFeePercent={
                    selectedPaymentMethodId
                      ? (customPaymentMethods.find((m) => m.id === selectedPaymentMethodId)?.fee_percent || 0)
                      : 0
                  }
                  saleNetMultiplier={subtotal > 0 ? total / subtotal : 1}
                  productPartnerships={productPartnershipsMap}
                />
              )}

              <Button
                className="w-full"
                size="lg"
                disabled={cart.filter(i => !i.isPartnerStock || i.fromApprovedRequest).length === 0 || createSaleMutation.isPending}
                onClick={() => createSaleMutation.mutate()}
              >
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
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Produtos Encontrados em Parceiros
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground">
            Não encontramos "{searchedProductName}" no seu estoque, mas encontramos nos parceiros:
          </p>

          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {partnerProducts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                Nenhum produto encontrado nos estoques parceiros
              </p>
            ) : (
              partnerProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-3 flex justify-between items-center border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Parceiro: {product.ownerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Disponível: {product.stock_quantity} | R$ {product.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => handleRequestReserve(product)}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Solicitar Reserva
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartnerDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reserve Request Dialog */}
      <AlertDialog open={showReserveDialog} onOpenChange={setShowReserveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar Reserva</AlertDialogTitle>
            <AlertDialogDescription>
              Você está solicitando uma reserva para o parceiro {selectedPartnerProduct?.ownerName}.
              Após a confirmação, o parceiro receberá a solicitação e poderá aprovar ou recusar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedPartnerProduct && (
            <div className="space-y-4 py-2">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="font-medium">{selectedPartnerProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  Preço: R$ {selectedPartnerProduct.price.toFixed(2).replace(".", ",")}
                </p>
              </div>

              {/* Variant Selection */}
              {loadingReserveVariants ? (
                <div className="text-center py-4 text-muted-foreground">Carregando variantes...</div>
              ) : reserveVariants.length > 0 ? (
                <div>
                  <Label>Selecione a Variante *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto">
                    {reserveVariants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedReserveVariant(variant);
                          setReserveQuantity(1);
                        }}
                        className={`p-2 text-left rounded-lg border-2 transition-all ${
                          selectedReserveVariant?.id === variant.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium text-sm">
                          {variant.size}
                        </p>
                        <p className="text-xs text-muted-foreground">{variant.stock_quantity} un</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Disponível: {selectedPartnerProduct.stock_quantity} unidades
                </p>
              )}

              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedReserveVariant?.stock_quantity || selectedPartnerProduct.stock_quantity}
                  value={reserveQuantity}
                  onChange={(e) => setReserveQuantity(Math.min(
                    Number(e.target.value),
                    selectedReserveVariant?.stock_quantity || selectedPartnerProduct.stock_quantity
                  ))}
                />
              </div>

              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Adicione uma mensagem para o parceiro..."
                  value={reserveNotes}
                  onChange={(e) => setReserveNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={createReserveMutation.isPending || (reserveVariants.length > 0 && !selectedReserveVariant)}
              onClick={() => {
                if (selectedPartnerProduct) {
                  createReserveMutation.mutate({
                    product: selectedPartnerProduct,
                    quantity: reserveQuantity,
                    notes: reserveNotes,
                    variant: selectedReserveVariant,
                  });
                }
              }}
            >
              {createReserveMutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Sale Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ID</p>
                  <p className="font-medium">{selectedSale.id.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {new Date(selectedSale.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedSale.customer_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-medium">{selectedSale.customer_phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pagamento</p>
                  <p className="font-medium">
                    {selectedSale.payment_method}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={statusConfig[selectedSale.status as keyof typeof statusConfig]?.variant}>
                    {statusConfig[selectedSale.status as keyof typeof statusConfig]?.label}
                  </Badge>
                </div>
              </div>

              {/* Shipping Info */}
              {selectedSale.shipping_method && selectedSale.shipping_method !== "presencial" && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    Envio: {selectedSale.shipping_method === "postagem" ? "Postagem" : selectedSale.shipping_method === "app" ? "Aplicativo" : "Outros"}
                    {selectedSale.shipping_company && ` - ${selectedSale.shipping_company}`}
                  </p>
                  {selectedSale.shipping_address && (
                    <p className="text-xs text-muted-foreground">{selectedSale.shipping_address}</p>
                  )}
                  {Number(selectedSale.shipping_cost) > 0 && (
                    <p className="text-xs">
                      Frete: R$ {Number(selectedSale.shipping_cost).toFixed(2).replace(".", ",")} 
                      ({selectedSale.shipping_payer === "buyer" ? "compradora" : "vendedora"})
                    </p>
                  )}
                  {selectedSale.shipping_notes && (
                    <p className="text-xs text-muted-foreground">{selectedSale.shipping_notes}</p>
                  )}
                  {selectedSale.shipping_tracking && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <p className="text-xs font-medium">Rastreio: {selectedSale.shipping_tracking}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedSale.shipping_tracking!);
                          toast({ title: "Código copiado!" });
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                  )}
                  {selectedSale.shipping_label_url && (
                    <a
                      href={selectedSale.shipping_label_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline mt-1 inline-block"
                    >
                      📄 Ver etiqueta
                    </a>
                  )}
                  {selectedSale.shipping_tracking && selectedSale.customer_phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 text-xs"
                      onClick={() => {
                        const msg = encodeURIComponent(
                          `Olá ${selectedSale.customer_name || ""}! 📦\n\nSeu pedido foi enviado!\n\n🔎 Código de rastreio: *${selectedSale.shipping_tracking}*\n\nVocê pode acompanhar pelo site dos Correios ou pelo app da transportadora.\n\nQualquer dúvida, estou à disposição! 😊`
                        );
                        const phone = selectedSale.customer_phone!.replace(/\D/g, "");
                        window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
                      }}
                    >
                      📱 Enviar Rastreio via WhatsApp
                    </Button>
                  )}
                </div>
              )}

              <div>
                <p className="text-muted-foreground mb-2">Itens</p>
                <div className="border rounded-lg">
                  {saleItems.map((item) => (
                    <div key={item.id} className="p-3 flex justify-between border-b last:border-b-0">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x R$ {Number(item.unit_price).toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      <p className="font-semibold">
                        R$ {Number(item.total).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>R$ {Number(selectedSale.subtotal).toFixed(2).replace(".", ",")}</span>
                </div>
                {Number(selectedSale.discount_amount) > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto</span>
                    <span>- R$ {Number(selectedSale.discount_amount).toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>R$ {Number(selectedSale.total).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              {/* Edit/Delete Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsViewOpen(false);
                    openEditSale(selectedSale);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar Venda
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <EditSaleDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        sale={selectedSale}
        saleItems={saleItems}
        customPaymentMethods={customPaymentMethods}
        userId={user?.id || ""}
      />

      {/* Variant Selection Dialog - Own stock only */}
      <VariantSelectionDialog
        open={showVariantDialog}
        onOpenChange={setShowVariantDialog}
        product={selectedProductForVariant}
        onConfirm={handleVariantConfirm}
      />

      {/* Voice Sale Dialog - Similarity Search */}
      <VoiceSaleDialog
        open={showVoiceSaleDialog}
        onOpenChange={setShowVoiceSaleDialog}
        command={voiceSaleCommand}
        userId={user?.id || ''}
        onProductSelected={handleVoiceProductSelected}
      />
    </MainLayout>
  );
}
