import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { ShoppingCart } from "lucide-react";

export default function ReportManual() {
  return (
    <SaleSourceReport
      title="Rel. Vendas Manuais"
      subtitle="Vendas registradas manualmente no sistema"
      saleSource="manual"
      icon={<ShoppingCart className="h-5 w-5" />}
    />
  );
}
