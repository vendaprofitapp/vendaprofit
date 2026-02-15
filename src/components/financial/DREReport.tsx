import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useExpenseTotals } from "./ExpenseSummaryCards";

interface DREReportProps {
  dateRange: { start: Date; end: Date };
}

export function DREReport({ dateRange }: DREReportProps) {
  const { user } = useAuth();

  // Fetch sales in period
  const { data: sales = [] } = useQuery({
    queryKey: ["dre-sales", user?.id, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("total, subtotal, payment_method")
        .eq("owner_id", user?.id!)
        .eq("status", "completed")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch sale items for CMV
  const { data: saleItems = [] } = useQuery({
    queryKey: ["dre-sale-items", user?.id, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("sale_items(product_id, quantity)")
        .eq("owner_id", user?.id!)
        .eq("status", "completed")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

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
  const productIds = new Set<string>();
  saleItems.forEach((s: any) => {
    (s.sale_items || []).forEach((item: any) => {
      if (item.product_id) productIds.add(item.product_id);
    });
  });

  const { data: products = [] } = useQuery({
    queryKey: ["dre-products", Array.from(productIds)],
    queryFn: async () => {
      if (productIds.size === 0) return [];
      const ids = Array.from(productIds);
      // Batch in chunks of 500 to avoid URI too long
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

  // Calculate DRE values
  const grossRevenue = sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);

  // Payment fees
  const feeMap = new Map<string, number>();
  paymentFees.forEach((f: any) => feeMap.set(f.payment_method, f.fee_percent));

  let totalFees = 0;
  for (const sale of sales) {
    const feePercent = feeMap.get(sale.payment_method) || 0;
    totalFees += (sale.total || 0) * (feePercent / 100);
  }

  const netRevenue = grossRevenue - totalFees;

  // CMV (cost of goods sold)
  const productCostMap = new Map<string, number>();
  products.forEach((p: any) => productCostMap.set(p.id, p.cost_price || p.price * 0.5));

  let cmv = 0;
  saleItems.forEach((s: any) => {
    (s.sale_items || []).forEach((item: any) => {
      const cost = productCostMap.get(item.product_id) || 0;
      cmv += cost * (item.quantity || 1);
    });
  });

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
            Considera apenas sua parte nas despesas divididas com parceiros
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
