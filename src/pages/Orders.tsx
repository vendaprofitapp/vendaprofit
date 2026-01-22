import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderForm } from "@/components/orders/OrderForm";
import { OrdersList } from "@/components/orders/OrdersList";
import { ShoppingList } from "@/components/orders/ShoppingList";
import { ClipboardList, ShoppingCart } from "lucide-react";

export default function Orders() {
  const [activeTab, setActiveTab] = useState("orders");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Encomendas</h1>
          <p className="text-muted-foreground">
            Gerencie pedidos de produtos sob demanda
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Encomendas
            </TabsTrigger>
            <TabsTrigger value="shopping" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Lista de Compras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            <OrderForm />
            <OrdersList />
          </TabsContent>

          <TabsContent value="shopping">
            <ShoppingList />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
