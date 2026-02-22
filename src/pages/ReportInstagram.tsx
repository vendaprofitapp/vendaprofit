import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { Instagram } from "lucide-react";

export default function ReportInstagram() {
  return (
    <SaleSourceReport
      title="Rel. Instagram / Redes Sociais"
      subtitle="Vendas originadas de Instagram e outras redes sociais"
      saleSource="instagram"
      icon={<Instagram className="h-5 w-5" />}
    />
  );
}
