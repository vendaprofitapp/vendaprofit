import { useState, useMemo } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Download, Filter, X, Percent, Users, FileText, BarChart3 } from "lucide-react";
import { downloadXlsx } from "@/utils/xlsExport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSettlement } from "@/components/reports/AccountSettlement";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const COLORS = ["hsl(15, 90%, 55%)", "hsl(25, 95%, 60%)", "hsl(145, 65%, 42%)", "hsl(38, 92%, 50%)", "hsl(220, 10%, 50%)", "hsl(280, 60%, 55%)", "hsl(190, 70%, 45%)"];

const paymentMethodsLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  credito_1x: "Crédito 1x",
  credito_2x: "Crédito 2x",
  credito_3x: "Crédito 3x",
  credito_4x: "Crédito 4x",
  credito_5x: "Crédito 5x",
  credito_6x: "Crédito 6x",
  credito_8x: "Crédito 8x",
  credito_10x: "Crédito 10x",
  credito_12x: "Crédito 12x",
  boleto: "Boleto",
};

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "year", label: "Este Ano" },
  { value: "last7days", label: "Últimos 7 dias" },
  { value: "last30days", label: "Últimos 30 dias" },
  { value: "last12months", label: "Últimos 12 meses" },
];

interface SaleWithItems {
  id: string;
  customer_name: string | null;
  payment_method: string;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  total: number;
  status: string;
  created_at: string;
  owner_id: string;
  sale_items: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  category_2: string | null;
  category_3: string | null;
  color: string | null;
  cost_price: number | null;
  owner_id: string;
  group_id: string | null;
}

interface GroupMember {
  group_id: string;
  user_id: string;
  groups: {
    id: string;
    name: string;
    created_by: string;
  };
}

interface CustomPaymentMethod {
  id: string;
  name: string;
  fee_percent: number;
  is_deferred: boolean;
  is_active: boolean;
}

export default function Reports() {
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useFormPersistence("reports_activeTab", "vendas");
  
  // Filter states
  const [period, setPeriod] = useFormPersistence("reports_period", "month");
  const [paymentMethodFilter, setPaymentMethodFilter] = useFormPersistence("reports_paymentFilter", "all");
  const [stockTypeFilter, setStockTypeFilter] = useFormPersistence("reports_stockFilter", "all");
  const [partnerFilter, setPartnerFilter] = useFormPersistence("reports_partnerFilter", "all");
  const [categoryFilter, setCategoryFilter] = useFormPersistence("reports_categoryFilter", "all");
  const [colorFilter, setColorFilter] = useFormPersistence("reports_colorFilter", "all");
  const [discountFilter, setDiscountFilter] = useFormPersistence("reports_discountFilter", "all");

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end = endOfDay(now);

    switch (period) {
      case "today":
        start = startOfDay(now);
        break;
      case "week":
        start = startOfWeek(now, { weekStartsOn: 0 });
        break;
      case "month":
        start = startOfMonth(now);
        break;
      case "year":
        start = startOfYear(now);
        break;
      case "last7days":
        start = subDays(now, 7);
        break;
      case "last30days":
        start = subDays(now, 30);
        break;
      case "last12months":
        start = subMonths(now, 12);
        break;
      default:
        start = startOfMonth(now);
    }

    return { start, end };
  }, [period]);

  // Fetch sales with items
  const { data: salesData = [], isLoading: salesLoading } = useQuery({
    queryKey: ["sales-report", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SaleWithItems[];
    },
    enabled: !!user,
  });

  // Fetch own products for category/color/cost info
  const { data: ownProducts = [] } = useQuery({
    queryKey: ["products-report-own", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, category_2, category_3, color, cost_price, owner_id, group_id")
        .eq("owner_id", user!.id)
        .limit(5000);
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Fetch groups for partner info (must be before userGroupIds)
  const { data: groupMembers = [] } = useQuery({
    queryKey: ["group-members-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          group_id,
          user_id,
          groups (
            id,
            name,
            created_by
          )
        `);
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!user,
  });

  // Fetch user's group IDs for partner products
  const userGroupIds = useMemo(() => {
    return groupMembers.filter(gm => gm.user_id === user?.id).map(gm => gm.group_id);
  }, [groupMembers, user?.id]);

  // Fetch partner product IDs via product_partnerships
  const { data: partnerProductIds = [] } = useQuery({
    queryKey: ["partner-product-ids-report", userGroupIds],
    queryFn: async () => {
      if (userGroupIds.length === 0) return [];
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("product_id")
        .in("group_id", userGroupIds)
        .limit(5000);
      if (error) throw error;
      return (data || []).map(d => d.product_id);
    },
    enabled: !!user && userGroupIds.length > 0,
  });

  // Fetch partner products data
  const { data: partnerProducts = [] } = useQuery({
    queryKey: ["partner-products-report", partnerProductIds],
    queryFn: async () => {
      if (partnerProductIds.length === 0) return [];
      const chunks: string[][] = [];
      for (let i = 0; i < partnerProductIds.length; i += 500) {
        chunks.push(partnerProductIds.slice(i, i + 500));
      }
      const results: Product[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, category, category_2, category_3, color, cost_price, owner_id, group_id")
          .in("id", chunk);
        if (error) throw error;
        if (data) results.push(...(data as Product[]));
      }
      return results;
    },
    enabled: partnerProductIds.length > 0,
  });

  // Merge own + partner products
  const products = useMemo(() => {
    const map = new Map<string, Product>();
    ownProducts.forEach(p => map.set(p.id, p));
    partnerProducts.forEach(p => { if (!map.has(p.id)) map.set(p.id, p); });
    return Array.from(map.values());
  }, [ownProducts, partnerProducts]);

  // Fetch custom payment methods (for fees)
  const { data: customPaymentMethods = [] } = useQuery({
    queryKey: ["custom-payment-methods-report", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_payment_methods")
        .select("id, name, fee_percent, is_deferred, is_active")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data as CustomPaymentMethod[];
    },
    enabled: !!user,
  });

  // Fetch financial_splits for the period to calculate real profit considering partnerships
  const { data: financialSplitsData = [] } = useQuery({
    queryKey: ["financial-splits-report", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_splits")
        .select("id, sale_id, user_id, amount, type, description")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create map: sale_id -> detailed splits breakdown
  const splitsBySale = useMemo(() => {
    const map = new Map<string, { 
      myTotal: number; 
      hasPartnership: boolean; 
      partnerAmount: number;
      hasSplits: boolean;
      feeAmount: number;
      partnerCommission: number;
      myCostRecovery: number;
      myProfitShare: number;
    }>();
    for (const split of financialSplitsData) {
      const existing = map.get(split.sale_id) || { 
        myTotal: 0, hasPartnership: false, partnerAmount: 0, hasSplits: false,
        feeAmount: 0, partnerCommission: 0, myCostRecovery: 0, myProfitShare: 0
      };
      existing.hasSplits = true;
      
      if (split.user_id === user?.id) {
        if (split.type === 'payment_fee') {
          existing.feeAmount += Math.abs(split.amount);
        } else if (split.type === 'group_commission') {
          // Partner point commission stored as negative on seller's own user_id
          existing.partnerCommission += Math.abs(split.amount);
        } else if (split.type === 'cost_recovery') {
          existing.myCostRecovery += split.amount;
        } else if (split.type === 'profit_share') {
          existing.myProfitShare += split.amount;
        }
        existing.myTotal += split.amount;
      } else {
        existing.partnerAmount += split.amount;
        existing.hasPartnership = true;
        if (split.type === 'group_commission') {
          existing.partnerCommission += Math.abs(split.amount);
        } else {
          // cost_recovery + profit_share for partner
          existing.partnerCommission += split.amount;
        }
      }
      map.set(split.sale_id, existing);
    }
    return map;
  }, [financialSplitsData, user?.id]);

  // Create product map for quick lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Create payment fees map (by payment method name)
  const feesMap = useMemo(() => {
    const map = new Map<string, number>();
    customPaymentMethods.forEach(m => map.set(m.name, m.fee_percent));
    return map;
  }, [customPaymentMethods]);

  // Get unique categories and colors from products (including all 3 category fields)
  const categories = useMemo(() => {
    const allCats = products.flatMap(p => [p.category, p.category_2, p.category_3].filter(Boolean)) as string[];
    return [...new Set(allCats)].sort();
  }, [products]);

  const colors = useMemo(() => {
    const cols = [...new Set(products.map(p => p.color).filter(Boolean))] as string[];
    return cols.sort();
  }, [products]);

  // Get partners (groups where user is member)
  const partners = useMemo(() => {
    const partnerList = groupMembers
      .filter(gm => gm.groups && gm.groups.created_by !== user?.id)
      .map(gm => ({
        id: gm.groups.created_by,
        name: gm.groups.name,
        groupId: gm.group_id,
      }));
    
    const uniquePartners = Array.from(
      new Map(partnerList.map(p => [p.groupId, p])).values()
    );
    return uniquePartners;
  }, [groupMembers, user?.id]);

  // Filter sales based on all criteria
  const filteredSales = useMemo(() => {
    return salesData.filter(sale => {
      if (paymentMethodFilter !== "all" && sale.payment_method !== paymentMethodFilter) {
        return false;
      }

      if (discountFilter === "with_discount" && (!sale.discount_amount || sale.discount_amount <= 0)) {
        return false;
      }
      if (discountFilter === "no_discount" && sale.discount_amount && sale.discount_amount > 0) {
        return false;
      }

      if (stockTypeFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        
        if (stockTypeFilter === "own") {
          const hasOwnStock = saleItemProducts.some(p => p && p.owner_id === user?.id && !p.group_id);
          if (!hasOwnStock) return false;
        } else if (stockTypeFilter === "partner") {
          const hasPartnerStock = saleItemProducts.some(p => p && p.group_id);
          if (!hasPartnerStock) return false;
          
          if (partnerFilter !== "all") {
            const hasSpecificPartner = saleItemProducts.some(p => p && p.group_id === partnerFilter);
            if (!hasSpecificPartner) return false;
          }
        }
      }

      if (categoryFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        const hasCategory = saleItemProducts.some(p => {
          if (!p) return false;
          const productCategories = [p.category, p.category_2, p.category_3].filter(Boolean);
          return productCategories.includes(categoryFilter);
        });
        if (!hasCategory) return false;
      }

      if (colorFilter !== "all") {
        const saleItemProducts = sale.sale_items.map(item => productMap.get(item.product_id));
        const hasColor = saleItemProducts.some(p => p && p.color === colorFilter);
        if (!hasColor) return false;
      }

      return true;
    });
  }, [salesData, paymentMethodFilter, discountFilter, stockTypeFilter, partnerFilter, categoryFilter, colorFilter, productMap, user?.id]);

  // Detailed sales data for table - includes discount proportionally distributed
  const detailedSalesData = useMemo(() => {
    return filteredSales.flatMap(sale => {
      const feePercent = feesMap.get(sale.payment_method) || 0;
      const saleDiscount = Number(sale.discount_amount) || 0;
      const saleSubtotal = Number(sale.subtotal) || 0;
      const saleInfo = splitsBySale.get(sale.id);
      const hasSplits = saleInfo?.hasSplits ?? false;
      const hasPartnership = saleInfo?.hasPartnership ?? false;
      
      return sale.sale_items.map(item => {
        const product = productMap.get(item.product_id);
        const costPrice = product?.cost_price || 0;
        const totalCost = costPrice * item.quantity;
        const itemTotal = Number(item.total);
        
        // Proportionally distribute the sale discount across items
        const discountProportion = saleSubtotal > 0 ? itemTotal / saleSubtotal : 0;
        const itemDiscount = saleDiscount * discountProportion;
        const totalSaleAfterDiscount = itemTotal - itemDiscount;
        
        const grossProfit = totalSaleAfterDiscount - totalCost;
        
        // Use financial_splits as source of truth when available
        const itemProportion = saleSubtotal > 0 ? itemTotal / saleSubtotal : 1 / sale.sale_items.length;
        
        let feeAmount: number;
        let partnerCommission: number;
        let myRealProfit: number;
        
        if (hasSplits && saleInfo) {
          // Use actual recorded splits
          feeAmount = saleInfo.feeAmount * itemProportion;
          partnerCommission = saleInfo.partnerCommission * itemProportion;
          // myProfitShare from splits already represents net profit (revenue - cost was split at sale time)
          myRealProfit = saleInfo.myProfitShare * itemProportion;
        } else {
          // Fallback: calculate from fee map (own stock, no splits recorded)
          feeAmount = (totalSaleAfterDiscount * feePercent) / 100;
          partnerCommission = 0;
          myRealProfit = grossProfit - feeAmount;
        }
        
        const realProfit = grossProfit - feeAmount - partnerCommission;

        return {
          saleId: sale.id,
          date: sale.created_at,
          customer: sale.customer_name || "Não informado",
          productName: item.product_name,
          quantity: item.quantity,
          totalCost,
          totalSale: itemTotal,
          itemDiscount,
          totalSaleAfterDiscount,
          grossProfit,
          feePercent,
          feeAmount,
          partnerCommission,
          realProfit,
          myRealProfit,
          hasPartnership,
          hasSplits,
          partnerAmount: hasPartnership ? (saleInfo?.partnerAmount ?? 0) * itemProportion : 0,
          paymentMethod: sale.payment_method,
        };
      });
    });
  }, [filteredSales, productMap, feesMap, splitsBySale]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalSales = filteredSales.length;
    const totalItems = filteredSales.reduce((sum, sale) => 
      sum + sale.sale_items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const totalDiscount = filteredSales.reduce((sum, sale) => sum + (Number(sale.discount_amount) || 0), 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const uniqueCustomers = new Set(filteredSales.filter(s => s.customer_name).map(s => s.customer_name)).size;

    // Calculate totals from detailed data
    const totalCost = detailedSalesData.reduce((sum, d) => sum + d.totalCost, 0);
    const totalItemDiscount = detailedSalesData.reduce((sum, d) => sum + d.itemDiscount, 0);
    const totalGrossProfit = detailedSalesData.reduce((sum, d) => sum + d.grossProfit, 0);
    const totalFees = detailedSalesData.reduce((sum, d) => sum + d.feeAmount, 0);
    const totalPartnerCommission = detailedSalesData.reduce((sum, d) => sum + d.partnerCommission, 0);
    const totalRealProfit = detailedSalesData.reduce((sum, d) => sum + d.realProfit, 0);
    const totalMyRealProfit = detailedSalesData.reduce((sum, d) => sum + d.myRealProfit, 0);
    const totalPartnerAmount = detailedSalesData.reduce((sum, d) => sum + d.partnerAmount, 0);
    const hasAnyPartnership = detailedSalesData.some(d => d.hasPartnership);

    return { totalRevenue, totalSales, totalItems, totalDiscount, avgTicket, uniqueCustomers, totalCost, totalItemDiscount, totalGrossProfit, totalFees, totalPartnerCommission, totalRealProfit, totalMyRealProfit, totalPartnerAmount, hasAnyPartnership };
  }, [filteredSales, detailedSalesData]);

  // Chart data: Sales over time
  const salesOverTime = useMemo(() => {
    const groupedData: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      const date = parseISO(sale.created_at);
      let key: string;
      
      if (period === "today") {
        key = format(date, "HH:00");
      } else if (period === "week" || period === "last7days") {
        key = format(date, "EEE", { locale: ptBR });
      } else if (period === "month" || period === "last30days") {
        key = format(date, "dd/MM");
      } else {
        key = format(date, "MMM", { locale: ptBR });
      }
      
      groupedData[key] = (groupedData[key] || 0) + sale.total;
    });

    return Object.entries(groupedData).map(([name, vendas]) => ({ name, vendas }));
  }, [filteredSales, period]);

  // Chart data: Sales by category
  const salesByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      sale.sale_items.forEach(item => {
        const product = productMap.get(item.product_id);
        const category = product?.category || "Outros";
        categoryTotals[category] = (categoryTotals[category] || 0) + item.total;
      });
    });

    const total = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);
    
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value: total > 0 ? Math.round((value / total) * 100) : 0,
        total: value,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filteredSales, productMap]);

  // Chart data: Sales by payment method
  const salesByPayment = useMemo(() => {
    const paymentTotals: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      const method = sale.payment_method;
      paymentTotals[method] = (paymentTotals[method] || 0) + sale.total;
    });

    return Object.entries(paymentTotals)
      .map(([method, total]) => ({
        name: paymentMethodsLabels[method] || method,
        value: total,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Chart data: Sales by color
  const salesByColor = useMemo(() => {
    const colorTotals: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
      sale.sale_items.forEach(item => {
        const product = productMap.get(item.product_id);
        const color = product?.color || "Sem cor";
        colorTotals[color] = (colorTotals[color] || 0) + item.quantity;
      });
    });

    return Object.entries(colorTotals)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [filteredSales, productMap]);

  const clearFilters = () => {
    setPeriod("month");
    setPaymentMethodFilter("all");
    setStockTypeFilter("all");
    setPartnerFilter("all");
    setCategoryFilter("all");
    setColorFilter("all");
    setDiscountFilter("all");
  };

  const activeFiltersCount = [
    paymentMethodFilter !== "all",
    stockTypeFilter !== "all",
    categoryFilter !== "all",
    colorFilter !== "all",
    discountFilter !== "all",
  ].filter(Boolean).length;

  // Export to XLSX
  const handleExport = () => {
    if (detailedSalesData.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const headers = [
      "ID da Venda",
      "Data/Hora",
      "Cliente",
      "Produto",
      "Quantidade",
      "Preço Unitário",
      "Custo Unitário",
      "Custo Total",
      "Venda Total",
      "Desconto",
      "Venda Após Desconto",
      "Lucro Bruto",
      "Forma de Pagamento",
      "Taxa Pagamento",
      "Comissão Parceiro",
      "Meu Lucro",
      "Parceria?",
    ];

    const rows = detailedSalesData.map(d => {
      const matchedProduct = products.find(p => p.name === d.productName);
      const costPrice = matchedProduct?.cost_price || 0;
      const unitPrice = d.totalSale / (d.quantity || 1);
      return [
        d.saleId.slice(0, 8),
        format(parseISO(d.date), "dd/MM/yyyy HH:mm"),
        d.customer,
        d.productName,
        d.quantity,
        unitPrice,
        costPrice,
        d.totalCost,
        d.totalSale,
        d.itemDiscount,
        d.totalSaleAfterDiscount,
        d.grossProfit,
        d.paymentMethod,
        d.feeAmount,
        d.partnerCommission,
        d.myRealProfit,
        d.hasPartnership ? "Sim" : "Não",
      ];
    });

    // Add totals row
    rows.push([
      "TOTAIS",
      "",
      "",
      "",
      detailedSalesData.reduce((s, d) => s + d.quantity, 0),
      "",
      "",
      stats.totalCost,
      stats.totalRevenue + stats.totalDiscount,
      stats.totalDiscount,
      stats.totalRevenue,
      stats.totalGrossProfit,
      "",
      stats.totalFees,
      stats.totalPartnerCommission,
      stats.totalMyRealProfit,
      "",
    ]);

    downloadXlsx(
      [headers, ...rows],
      "Vendas",
      `relatorio-vendas-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );

    toast.success("Relatório exportado com sucesso!");
  };

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada do seu negócio</p>
        </div>
        {activeTab === "vendas" && (
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="vendas" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Vendas
          </TabsTrigger>
          <TabsTrigger value="acerto" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Acerto de Contas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-6">

      {/* Filters Section */}
      <div className="rounded-xl bg-card p-4 shadow-soft mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-card-foreground">Filtros</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">{activeFiltersCount} ativos</Badge>
          )}
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Period Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Período</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pagamento</label>
            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(paymentMethodsLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Type Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo de Estoque</label>
            <Select value={stockTypeFilter} onValueChange={(v) => {
              setStockTypeFilter(v);
              if (v !== "partner") setPartnerFilter("all");
            }}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="own">Estoque Próprio</SelectItem>
                <SelectItem value="partner">Estoque Parceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Partner Filter (visible when stockTypeFilter === "partner") */}
          {stockTypeFilter === "partner" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Parceiro</label>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Parceiros</SelectItem>
                  {partners.map(p => (
                    <SelectItem key={p.groupId} value={p.groupId}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
            <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {colors.map(color => (
                  <SelectItem key={color} value={color}>{color}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Discount Filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Desconto</label>
            <Select value={discountFilter} onValueChange={setDiscountFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="with_discount">Com Desconto</SelectItem>
                <SelectItem value="no_discount">Sem Desconto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7 mb-6">
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Receita Bruta</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {(stats.totalRevenue + stats.totalDiscount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Descontos Cedidos</p>
          <p className="text-2xl font-bold text-destructive">
            - R$ {stats.totalDiscount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Custo Total</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Lucro Bruto</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.totalGrossProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">(Após descontos)</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Percent className="h-3 w-3" /> Taxas Pagamento
          </p>
          <p className="text-2xl font-bold text-destructive">
            - R$ {stats.totalFees.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        {stats.totalPartnerCommission > 0 && (
          <div className="rounded-xl bg-card p-5 shadow-soft">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Comissão Parceiros
            </p>
            <p className="text-2xl font-bold text-destructive">
              - R$ {stats.totalPartnerCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
        <div className="rounded-xl bg-card p-5 shadow-soft border-2 border-primary/30">
          <p className="text-sm text-muted-foreground font-medium">Meu Lucro Real</p>
          <p className="text-2xl font-bold text-primary">
            R$ {stats.totalMyRealProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">
            (Após custo, taxas e comissões)
          </p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Total de Vendas</p>
          <p className="text-2xl font-bold text-foreground">{stats.totalSales}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Itens Vendidos</p>
          <p className="text-2xl font-bold text-foreground">{stats.totalItems}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-bold text-foreground">
            R$ {stats.avgTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Clientes Únicos
          </p>
          <p className="text-2xl font-bold text-foreground">{stats.uniqueCustomers}</p>
        </div>
      </div>

      {/* Detailed Sales Table */}
      <div className="rounded-xl bg-card p-6 shadow-soft mb-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Detalhamento das Vendas</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Lucro Bruto</TableHead>
                <TableHead className="text-right">Taxa Pgto</TableHead>
                <TableHead className="text-right">Comissão Parceiro</TableHead>
                <TableHead className="text-right">Meu Lucro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                <TableRow>
                   <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : detailedSalesData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda encontrada no período
                  </TableCell>
                </TableRow>
              ) : (
                detailedSalesData.slice(0, 50).map((item, index) => (
                  <TableRow key={`${item.saleId}-${index}`}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(item.date), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate">{item.customer}</TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      <span className="flex items-center gap-1">
                        {item.productName}
                        {item.hasPartnership && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                            <Users className="h-2.5 w-2.5 mr-0.5" />
                            Parceria
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      R$ {item.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      R$ {item.totalSale.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-destructive">
                      {item.itemDiscount > 0 ? `- R$ ${item.itemDiscount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      R$ {item.grossProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-destructive">
                      {item.feeAmount > 0.01 ? `- R$ ${item.feeAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-destructive">
                      {item.partnerCommission > 0.01 ? `- R$ ${item.partnerCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium text-primary">
                      R$ {item.myRealProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {detailedSalesData.length > 50 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Mostrando 50 de {detailedSalesData.length} registros. Exporte para ver todos.
            </p>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Sales Over Time Chart */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Vendas no Período</h3>
          <div className="h-72">
            {salesOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(1)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Vendas"]}
                  />
                  <Bar dataKey="vendas" fill="hsl(15, 90%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhuma venda encontrada no período
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Vendas por Categoria</h3>
          <div className="h-72 flex items-center">
            {salesByCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {salesByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `R$ ${props.payload.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${value}%)`,
                        props.payload.name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 pl-4 flex-1">
                  {salesByCategory.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm text-muted-foreground truncate">{item.name}</span>
                      <span className="text-sm font-medium ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods Chart */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Vendas por Forma de Pagamento</h3>
          <div className="h-72">
            {salesByPayment.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByPayment} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${(value / 1000).toFixed(1)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Total"]}
                  />
                  <Bar dataKey="value" fill="hsl(145, 65%, 42%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

        {/* Sales by Color */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">Peças Vendidas por Cor</h3>
          <div className="h-72">
            {salesByColor.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByColor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value} unidades`, "Quantidade"]}
                  />
                  <Bar dataKey="quantity" fill="hsl(280, 60%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="acerto">
          <AccountSettlement />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
