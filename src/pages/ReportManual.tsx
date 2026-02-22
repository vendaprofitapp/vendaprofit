import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { ShoppingCart } from "lucide-react";

export default function ReportManual() {
  return (
    <SaleSourceReport
      title="Venda Direta"
      subtitle="Vendas diretas registradas no PDV"
      saleSource="manual"
      icon={<ShoppingCart className="h-5 w-5" />}
    />
  );
}
