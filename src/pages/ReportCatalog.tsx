import SaleSourceReport from "@/components/reports/SaleSourceReport";
import { Store } from "lucide-react";

export default function ReportCatalog() {
  return (
    <SaleSourceReport
      title="Rel. Vendas Catálogo"
      subtitle="Vendas originadas pelo catálogo online da loja"
      saleSource="catalog"
      icon={<Store className="h-5 w-5" />}
    />
  );
}
