import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { Zap } from "lucide-react";

export default function ReportEvent() {
  return (
    <SaleSourceReport
      title="Rel. Vendas em Eventos"
      subtitle="Vendas realizadas durante eventos (feiras, bazares, etc.)"
      saleSource="event"
      icon={<Zap className="h-5 w-5" />}
    />
  );
}
