import { MainLayout } from "@/components/layout/MainLayout";
import { ShoppingBasket, Clock } from "lucide-react";

export default function HubVendedor() {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="rounded-full bg-primary/10 p-6">
          <ShoppingBasket className="h-12 w-12 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">HUB Vendedor</h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Em breve você poderá acessar catálogos de fornecedores parceiros e realizar pedidos diretamente por aqui.
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted rounded-full px-4 py-2">
          <Clock className="h-4 w-4" />
          <span>Em desenvolvimento</span>
        </div>
      </div>
    </MainLayout>
  );
}
