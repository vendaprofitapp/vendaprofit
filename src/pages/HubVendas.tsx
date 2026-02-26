import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HubConnectionCard } from "@/components/hub/HubConnectionCard";
import { HubInviteDialog } from "@/components/hub/HubInviteDialog";
import { HubAcceptDialog } from "@/components/hub/HubAcceptDialog";
import { HubProductsDialog } from "@/components/hub/HubProductsDialog";
import { HubSettlementDialog } from "@/components/hub/HubSettlementDialog";
import { Plus, Link2 } from "lucide-react";
import { toast } from "sonner";

interface HubConnection {
  id: string;
  owner_id: string;
  seller_id: string | null;
  invited_email: string;
  commission_pct: number;
  status: string;
  invite_code: string;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
  _sharedCount?: number;
  _splitTotal?: number;
}

export default function HubVendas() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<HubConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [manageProductsId, setManageProductsId] = useState<string | null>(null);
  const [settlementId, setSettlementId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadConnections();
  }, [user]);

  const loadConnections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hub_connections")
      .select("*")
      .or(`owner_id.eq.${user!.id},seller_id.eq.${user!.id}`)
      .order("created_at", { ascending: false });

    if (error) { toast.error("Erro ao carregar conexões"); setLoading(false); return; }

    // Load extra stats for active connections
    const active = (data ?? []).filter((c) => c.status === "active");
    const enriched = await Promise.all(
      (data ?? []).map(async (conn) => {
        if (conn.status !== "active") return { ...conn };

        const [sharedRes, splitsRes] = await Promise.all([
          supabase
            .from("hub_shared_products")
            .select("id", { count: "exact", head: true })
            .eq("connection_id", conn.id)
            .eq("is_active", true),
          supabase
            .from("hub_sale_splits")
            .select("owner_amount, seller_amount")
            .eq("connection_id", conn.id),
        ]);

        const splitTotal = (splitsRes.data ?? []).reduce(
          (sum, s) => sum + s.owner_amount + s.seller_amount, 0
        );

        return {
          ...conn,
          profiles: undefined,
          _sharedCount: sharedRes.count ?? 0,
          _splitTotal: splitTotal,
        } as HubConnection;
      })
    );

    setConnections(enriched);
    setLoading(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    const next = current === "active" ? "suspended" : "active";
    const { error } = await supabase
      .from("hub_connections")
      .update({ status: next })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "active" ? "Conexão reativada!" : "Conexão suspensa.");
    loadConnections();
  };

  const myAsOwner = connections.filter((c) => c.owner_id === user?.id);
  const myAsSeller = connections.filter((c) => c.seller_id === user?.id);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HUB de VENDAS</h1>
          <p className="text-muted-foreground">Gerencie suas conexões de venda compartilhada</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAccept(true)} className="gap-2">
            <Link2 className="h-4 w-4" />
            Entrar em HUB
          </Button>
          <Button onClick={() => setShowInvite(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Convidar Vendedor
          </Button>
        </div>
      </div>

      <Tabs defaultValue="owner">
        <TabsList>
          <TabsTrigger value="owner">
            Meu Estoque ({myAsOwner.length})
          </TabsTrigger>
          <TabsTrigger value="seller">
            Vendo para Outros ({myAsSeller.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owner" className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : myAsOwner.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <p className="text-muted-foreground text-sm">
                Você ainda não tem vendedores no seu HUB.
              </p>
              <Button className="mt-3" onClick={() => setShowInvite(true)}>
                Convidar primeiro vendedor
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {myAsOwner.map((conn) => (
                <HubConnectionCard
                  key={conn.id}
                  connection={conn}
                  isOwner={true}
                  onManageProducts={setManageProductsId}
                  onViewReport={setSettlementId}
                  onToggleStatus={toggleStatus}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="seller" className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : myAsSeller.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <p className="text-muted-foreground text-sm">
                Você ainda não está em nenhum HUB como vendedor.
              </p>
              <Button variant="outline" className="mt-3" onClick={() => setShowAccept(true)}>
                Entrar com código de convite
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {myAsSeller.map((conn) => (
                <HubConnectionCard
                  key={conn.id}
                  connection={conn}
                  isOwner={false}
                  onManageProducts={() => {}}
                  onViewReport={setSettlementId}
                  onToggleStatus={() => {}}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <HubInviteDialog
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onCreated={loadConnections}
      />
      <HubAcceptDialog
        open={showAccept}
        onClose={() => setShowAccept(false)}
        onAccepted={loadConnections}
      />
      <HubProductsDialog
        open={!!manageProductsId}
        connectionId={manageProductsId}
        onClose={() => setManageProductsId(null)}
      />
      <HubSettlementDialog
        open={!!settlementId}
        connectionId={settlementId}
        onClose={() => setSettlementId(null)}
      />
    </MainLayout>
  );
}
