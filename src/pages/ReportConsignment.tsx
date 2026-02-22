import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { Briefcase } from "lucide-react";

export default function ReportConsignment() {
  return (
    <SaleSourceReport
      title="Rel. Vendas Consignação"
      subtitle="Vendas originadas de bolsas consignadas"
      saleSource="consignment"
      icon={<Briefcase className="h-5 w-5" />}
    />
  );
}
