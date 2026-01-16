import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePrices = async () => {
    if (!salePrice && !costPrice) {
      toast({ title: "Preencha pelo menos um campo de preço", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const updates: { price?: number; cost_price?: number } = {};
      
      if (salePrice) {
        updates.price = parseFloat(salePrice.replace(",", "."));
      }
      if (costPrice) {
        updates.cost_price = parseFloat(costPrice.replace(",", "."));
      }

      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("owner_id", user?.id);

      if (error) throw error;
      
      toast({ title: "Preços atualizados com sucesso!" });
      setSalePrice("");
      setCostPrice("");
    } catch (error: any) {
      toast({ title: "Erro ao atualizar preços", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Defina os preços padrão para todos os produtos</p>
      </div>

      <div className="grid gap-6 max-w-3xl">
        {/* Price Settings */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Preços Padrão</h3>
              <p className="text-sm text-muted-foreground">Defina os preços para todos os produtos cadastrados</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sale-price">Preço de Venda (R$)</Label>
              <Input 
                id="sale-price" 
                type="text"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="Ex: 139,90"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cost-price">Preço de Custo (R$)</Label>
              <Input 
                id="cost-price" 
                type="text"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="Ex: 59,90"
              />
            </div>
          </div>

          <div className="mt-6">
            <Button 
              onClick={handleUpdatePrices} 
              disabled={isUpdating}
              className="w-full"
            >
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aplicar Preços a Todos os Produtos
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
