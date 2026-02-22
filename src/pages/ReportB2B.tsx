import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { Package } from "lucide-react";

export default function ReportB2B() {
  return (
    <SaleSourceReport
      title="Rel. Vendas B2B"
      subtitle="Vendas de origem B2B (atacado/revenda)"
      saleSource="b2b"
      icon={<Package className="h-5 w-5" />}
    />
  );
}
