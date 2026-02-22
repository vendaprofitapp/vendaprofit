import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { ShoppingBag } from "lucide-react";

export default function ReportBazar() {
  return (
    <SaleSourceReport
      title="Rel. Vendas Bazar"
      subtitle="Vendas originadas pelo Bazar VIP"
      saleSource="bazar"
      icon={<ShoppingBag className="h-5 w-5" />}
    />
  );
}
