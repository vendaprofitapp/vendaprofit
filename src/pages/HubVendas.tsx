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
import { HubSellerProductsDialog } from "@/components/hub/HubSellerProductsDialog";
import { HubSettlementDialog } from "@/components/hub/HubSettlementDialog";
import { HubPendingOrdersList } from "@/components/hub/HubPendingOrdersList";
import { Plus, Link2, ShoppingBag, Bell } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export interface HubConnection {
  id: string;
  owner_id: string;
  seller_id: string | null;
  invited_email: string;
  commission_pct: number;
  status: string;
  invite_code: string;
  created_at: string;
  owner_profile?: { full_name: string; email: string } | null;
  seller_profile?: { full_name: string; email: string } | null;
  _sharedCount?: number;
  _splitTotal?: number;
}

export default function HubVendas() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<HubConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [acceptCode, setAcceptCode] = useState("");
  const [manageProductsId, setManageProductsId] = useState<string | null>(null);
  const [settlementId, setSettlementId] = useState<string | null>(null);
  const [sellerViewProductsId, setSellerViewProductsId] = useState<string | null>(null);

  const handleAcceptInvite = (conn: HubConnection) => {
    setAcceptCode(conn.invite_code);
    setShowAccept(true);
  };

  const deleteInvite = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este convite?")) return;
    const { error } = await supabase.from("hub_connections").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Convite excluído.");
    loadConnections();
  };

  const archiveConnection = async (id: string) => {
    if (!confirm("Encerrar parceria? O histórico será preservado e vocês poderão criar um novo HUB no futuro.")) return;
    const { error } = await supabase
      .from("hub_connections")
      .update({ status: "archived" })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Parceria encerrada. Histórico preservado.");
    loadConnections();
  };

  useEffect(() => {
    if (user) loadConnections();
  }, [user]);

  const loadConnections = async () => {
    setLoading(true);

    // Fetch connections
    const { data, error } = await supabase
      .from("hub_connections")
      .select("*")
      .or(`owner_id.eq.${user!.id},seller_id.eq.${user!.id},invited_email.eq.${user!.email}`)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (error) { toast.error("Erro ao carregar conexões"); setLoading(false); return; }

    const rows = data ?? [];

    // Collect all user IDs to fetch profiles
    const userIds = [...new Set([
      ...rows.map(c => c.owner_id),
      ...rows.filter(c => c.seller_id).map(c => c.seller_id as string),
    ])];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const enriched = await Promise.all(
      rows.map(async (conn) => {
        const base: HubConnection = {
          ...conn,
          owner_profile: profileMap.get(conn.owner_id) ?? null,
          seller_profile: conn.seller_id ? (profileMap.get(conn.seller_id) ?? null) : null,
        };

        if (conn.status !== "active") return base;

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
          ...base,
          _sharedCount: sharedRes.count ?? 0,
          _splitTotal: splitTotal,
        };
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
  const myAsSeller = connections.filter((c) => c.seller_id === user?.id || (c.status === "pending" && c.invited_email === user?.email));

  const { data: pendingOrdersCount = 0 } = useQuery({
    queryKey: ["hub-pending-orders-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("hub_pending_orders")
        .select("id", { count: "exact", head: true })
        .or(`seller_id.eq.${user!.id},owner_id.eq.${user!.id}`)
        .neq("status", "completed")
        .neq("status", "cancelled");
      return count ?? 0;
    },
    enabled: !!user,
  });

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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="owner">
            HUB's Cedendo Meu Estoque ({myAsOwner.length})
          </TabsTrigger>
          <TabsTrigger value="solicitacoes" className="relative">
            <Bell className="h-3.5 w-3.5 mr-1" />
            Solicitações Meu Estoque
          </TabsTrigger>
          <TabsTrigger value="seller">
            HUB's Vendendo Outro Estoque ({myAsSeller.length})
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="relative">
            <ShoppingBag className="h-3.5 w-3.5 mr-1" />
            Solicitações Outro Estoque
            {pendingOrdersCount > 0 && (
              <span className="ml-1.5 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                {pendingOrdersCount > 9 ? "9+" : pendingOrdersCount}
              </span>
            )}
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
                  onDeleteInvite={deleteInvite}
                  onArchive={archiveConnection}
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
                  onManageProducts={setSellerViewProductsId}
                  onViewReport={setSettlementId}
                  onToggleStatus={() => {}}
                  onAcceptInvite={handleAcceptInvite}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pedidos" className="mt-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Pedidos de produtos HUB que você criou e aguardam aprovação, logística e finalização.
            </p>
          </div>
          <HubPendingOrdersList asSeller={true} />
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Solicitações de vendedores que querem usar seus produtos. Aprove, defina a data de despacho ou rejeite.
            </p>
          </div>
          <HubPendingOrdersList asSeller={false} />
        </TabsContent>
      </Tabs>

      <HubInviteDialog
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onCreated={loadConnections}
      />
      <HubAcceptDialog
        open={showAccept}
        onClose={() => { setShowAccept(false); setAcceptCode(""); }}
        onAccepted={loadConnections}
        initialCode={acceptCode}
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
      <HubSellerProductsDialog
        open={!!sellerViewProductsId}
        connectionId={sellerViewProductsId}
        onClose={() => setSellerViewProductsId(null)}
      />
    </MainLayout>
  );
}
