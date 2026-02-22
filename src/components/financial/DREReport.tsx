import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useExpenseTotals } from "./ExpenseSummaryCards";
import { useDeferredPaidAmounts, getSalePaidRatio } from "@/hooks/useDeferredPaidAmounts";

interface DREReportProps {
  dateRange: { start: Date; end: Date };
}

export function DREReport({ dateRange }: DREReportProps) {
  const { user } = useAuth();

  // Fetch sales with items in period
  const { data: salesWithItems = [] } = useQuery({
    queryKey: ["dre-sales", user?.id, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, status, total, subtotal, payment_method, sale_items(product_id, quantity)")
        .eq("owner_id", user?.id!)
        .in("status", ["completed", "pending"])
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Adjust pending sales to only count paid installments
  const pendingSaleIds = useMemo(() =>
    salesWithItems.filter((s: any) => s.status === 'pending').map((s: any) => s.id),
    [salesWithItems]
  );
  const paidBySale = useDeferredPaidAmounts(pendingSaleIds);

  // Fetch payment fees
  const { data: paymentFees = [] } = useQuery({
    queryKey: ["dre-payment-fees", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_fees")
        .select("payment_method, fee_percent")
        .eq("owner_id", user?.id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Get product costs for CMV
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    salesWithItems.forEach((s: any) => {
      (s.sale_items || []).forEach((item: any) => {
        if (item.product_id) ids.add(item.product_id);
      });
    });
    return ids;
  }, [salesWithItems]);

  const { data: products = [] } = useQuery({
    queryKey: ["dre-products", Array.from(productIds)],
    queryFn: async () => {
      if (productIds.size === 0) return [];
      const ids = Array.from(productIds);
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 500) {
        chunks.push(ids.slice(i, i + 500));
      }
      const results: any[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from("products")
          .select("id, cost_price, price")
          .in("id", chunk);
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: productIds.size > 0,
  });

  const expenseTotals = useExpenseTotals(user?.id, dateRange);

  // Calculate DRE values with deferred sales ratio
  const feeMap = useMemo(() => {
    const map = new Map<string, number>();
    paymentFees.forEach((f: any) => map.set(f.payment_method, f.fee_percent));
    return map;
  }, [paymentFees]);

  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p: any) => map.set(p.id, p.cost_price || 0));
    return map;
  }, [products]);

  const { grossRevenue, totalFees, cmv } = useMemo(() => {
    let rev = 0, fees = 0, cost = 0;

    for (const sale of salesWithItems as any[]) {
      const ratio = getSalePaidRatio(sale, paidBySale);
      const adjustedTotal = (sale.total || 0) * ratio;

      rev += adjustedTotal;

      const feePercent = feeMap.get(sale.payment_method) || 0;
      fees += adjustedTotal * (feePercent / 100);

      for (const item of (sale.sale_items || [])) {
        const unitCost = productCostMap.get(item.product_id) || 0;
        cost += unitCost * (item.quantity || 1) * ratio;
      }
    }

    return { grossRevenue: rev, totalFees: fees, cmv: cost };
  }, [salesWithItems, paidBySale, feeMap, productCostMap]);

  const netRevenue = grossRevenue - totalFees;
  const grossProfit = netRevenue - cmv;
  const netProfit = grossProfit - expenseTotals.total;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const DRELine = ({ label, value, isTotal, isPositive, isNegative, indent }: {
    label: string;
    value: number;
    isTotal?: boolean;
    isPositive?: boolean;
    isNegative?: boolean;
    indent?: boolean;
  }) => (
    <div className={`flex justify-between items-center py-2 px-3 ${isTotal ? "border-t-2 border-foreground/20 font-bold text-base" : "text-sm"} ${indent ? "pl-8" : ""}`}>
      <span className={isTotal ? "" : "text-muted-foreground"}>
        {isNegative && !isTotal ? "(-) " : isPositive && !isTotal ? "(+) " : isTotal ? "(=) " : ""}
        {label}
      </span>
      <span className={`font-mono ${isTotal && value > 0 ? "text-green-600" : isTotal && value < 0 ? "text-red-600" : isNegative ? "text-red-500" : ""}`}>
        {isNegative && !isTotal ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          DRE Simplificado
        </CardTitle>
        <CardDescription>Demonstrativo de Resultado do Exercício</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <DRELine label="Receita Bruta de Vendas" value={grossRevenue} isPositive />
        <DRELine label="Taxas de Pagamento" value={totalFees} isNegative />
        <DRELine label="Receita Líquida" value={netRevenue} isTotal />

        <div className="py-2" />

        <DRELine label="Custo das Mercadorias (CMV)" value={cmv} isNegative />
        <DRELine label="Lucro Bruto" value={grossProfit} isTotal />

        <div className="py-2" />

        <DRELine label="Custos Fixos" value={expenseTotals.byType.fixed || 0} isNegative indent />
        <DRELine label="Custos Variáveis" value={expenseTotals.byType.variable || 0} isNegative indent />
        <DRELine label="Custos de Eventos" value={expenseTotals.byType.event || 0} isNegative indent />
        <DRELine label="Outras Despesas" value={expenseTotals.byType.other || 0} isNegative indent />

        <div className="py-1" />

        <div className={`rounded-lg p-4 ${netProfit >= 0 ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">LUCRO LÍQUIDO REAL</span>
            <span className={`text-2xl font-bold font-mono ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(netProfit)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Considera apenas sua parte nas despesas divididas com parceiros. Vendas a prazo contam apenas parcelas recebidas.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
