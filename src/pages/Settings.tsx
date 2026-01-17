import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { PaymentFeesSection } from "@/components/settings/PaymentFeesSection";
import { CustomPaymentMethodsSection } from "@/components/settings/CustomPaymentMethodsSection";
import { AISettingsSection } from "@/components/settings/AISettingsSection";
import { PaymentRemindersSection } from "@/components/settings/PaymentRemindersSection";

export default function Settings() {
  const { user } = useAuth();
  
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch user profile for AI settings
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("preferred_ai_provider, gemini_api_key, openai_api_key")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

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
        <p className="text-muted-foreground">Gerencie taxas, formas de pagamento e configurações de IA</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Payment Reminders Section - Show first if there are pending payments */}
        {user?.id && <PaymentRemindersSection userId={user.id} />}

        {/* Payment Fees Section */}
        {user?.id && <PaymentFeesSection userId={user.id} />}

        {/* Custom Payment Methods Section */}
        {user?.id && <CustomPaymentMethodsSection userId={user.id} />}

        {/* AI Settings Section */}
        {user?.id && (
          <AISettingsSection 
            userId={user.id} 
            profile={profile} 
            onUpdate={refetchProfile} 
          />
        )}

        {/* Bulk Price Update Section */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Preços Padrão em Lote</h3>
              <p className="text-sm text-muted-foreground">Aplique preços a todos os produtos de uma vez</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
              variant="secondary"
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
