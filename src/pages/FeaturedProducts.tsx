import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FeaturedProductsDialog } from "@/components/catalog/FeaturedProductsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

export default function FeaturedProducts() {
  const { user } = useAuth();
  const [showDialog, setShowDialog] = useState(false);

  const { data: catalogProducts = [] } = useQuery({
    queryKey: ["catalog-products-for-featured", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, color, image_url")
        .eq("owner_id", user!.id)
        .gt("stock_quantity", 0);
      if (error) throw error;
      return (data || []).map((p) => ({
        productId: p.id,
        name: p.name,
        color: p.color,
        image_url: p.image_url,
      }));
    },
    enabled: !!user?.id,
  });

  const { data: featuredCount = 0 } = useQuery({
    queryKey: ["featured-products-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("featured_products")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Produtos em Destaque</h1>
        <p className="text-muted-foreground">
          Escolha até 10 produtos para aparecer primeiro no catálogo
        </p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Destaques Configurados
            </CardTitle>
            <CardDescription>
              {featuredCount > 0
                ? `Você tem ${featuredCount} produto(s) em destaque no seu catálogo.`
                : "Nenhum produto em destaque ainda. Configure para que apareçam primeiro no catálogo."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowDialog(true)}>
              <Star className="h-4 w-4 mr-2" />
              Editar Destaques
            </Button>
          </CardContent>
        </Card>
      </div>

      {user?.id && (
        <FeaturedProductsDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          ownerId={user.id}
          catalogItems={catalogProducts}
        />
      )}
    </MainLayout>
  );
}
