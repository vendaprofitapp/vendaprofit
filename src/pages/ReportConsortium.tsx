import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { Gift } from "lucide-react";

export default function ReportConsortium() {
  return (
    <SaleSourceReport
      title="Rel. Vendas Consórcios"
      subtitle="Vendas originadas de consórcios"
      saleSource="consortium"
      icon={<Gift className="h-5 w-5" />}
    />
  );
}
