import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SupplierCatalogTab } from "@/components/admin/SupplierCatalogTab";
import { BrandRequestsList } from "@/components/admin/BrandRequestsList";

const ADMIN_ID = "9cd05136-6005-4e16-85a9-02539aaa12c1";

interface Supplier {
  id: string;
  name: string;
  website: string | null;
  b2b_url: string | null;
  productCount: number;
}

export default function AdminCatalog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!data);
      if (!data) {
        toast.error("Você não tem permissão para acessar esta página.");
        navigate("/");
      }
    }
    checkAdmin();
  }, [user, navigate]);

  useEffect(() => {
    async function fetchSuppliers() {
      if (!isAdmin) return;
      setLoading(true);

      const { data: supplierData, error } = await supabase
        .from("suppliers")
        .select("id, name, website, b2b_url")
        .eq("owner_id", ADMIN_ID)
        .order("name");

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // Count products per supplier
      const suppliersWithCounts: Supplier[] = [];
      for (const s of supplierData || []) {
        const { count } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", ADMIN_ID)
          .eq("supplier_id", s.id);

        suppliersWithCounts.push({
          ...s,
          productCount: count || 0,
        });
      }

      setSuppliers(suppliersWithCounts);
      setLoading(false);
    }
    fetchSuppliers();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Central de Controle de Peças
          </h1>
          <p className="text-muted-foreground">
            Gerencie o catálogo master por fornecedor
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {suppliers.reduce((acc, s) => acc + s.productCount, 0)} peças no catálogo
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum fornecedor cadastrado no admin.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={suppliers[0]?.id} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {suppliers.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="gap-2">
                {s.name}
                <Badge variant="secondary" className="text-xs ml-1">
                  {s.productCount}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {suppliers.map((s) => (
            <TabsContent key={s.id} value={s.id}>
              <SupplierCatalogTab
                supplierId={s.id}
                supplierName={s.name}
                supplierWebsite={s.website}
                supplierB2bUrl={s.b2b_url}
                adminId={ADMIN_ID}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Brand Requests Section */}
      <div className="mt-8">
        <BrandRequestsList />
      </div>
    </MainLayout>
  );
}
