import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { Mic } from "lucide-react";

export default function ReportVoice() {
  return (
    <SaleSourceReport
      title="Rel. Vendas por Voz"
      subtitle="Vendas registradas via comando de voz"
      saleSource="voice"
      icon={<Mic className="h-5 w-5" />}
    />
  );
}
