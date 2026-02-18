import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartnerPointCard } from "@/components/partners/PartnerPointCard";
import { NewPartnerDialog } from "@/components/partners/NewPartnerDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, Plus, Search, Package, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PartnerPoint {
  id: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  rack_commission_pct: number;
  is_active: boolean;
  access_token: string;
  allocated_count?: number;
}

export default function PartnerPoints() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<PartnerPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const fetchPartners = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("partner_points")
      .select("id, name, contact_name, contact_phone, address, rack_commission_pct, is_active, access_token")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch allocated item counts per partner
      const partnerIds = data.map(p => p.id);
      const countPromises = partnerIds.map(id =>
        supabase.from("partner_point_items").select("id", { count: "exact", head: true })
          .eq("partner_point_id", id).eq("status", "allocated")
      );
      const counts = await Promise.all(countPromises);
      setPartners(data.map((p, i) => ({ ...p, allocated_count: counts[i].count ?? 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, [user]);

  const filtered = partners.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.address ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalAllocated = partners.reduce((s, p) => s + (p.allocated_count ?? 0), 0);
  const activeCount = partners.filter(p => p.is_active).length;

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pontos Parceiros</h1>
              <p className="text-sm text-muted-foreground">Araras físicas em locais parceiros</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Novo Parceiro
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Locais ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{totalAllocated}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Peças em campo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{partners.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total parceiros</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar parceiro..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Partner list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            {partners.length === 0 ? (
              <>
                <p className="text-foreground font-medium">Nenhum parceiro cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Novo Parceiro" para começar a montar sua rede de araras físicas.
                </p>
                <Button onClick={() => setShowNew(true)} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Cadastrar primeiro parceiro
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhum parceiro encontrado para "{search}"</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(partner => (
              <PartnerPointCard key={partner.id} partner={partner} />
            ))}
          </div>
        )}
      </div>

      <NewPartnerDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={fetchPartners}
      />
    </MainLayout>
  );
}
