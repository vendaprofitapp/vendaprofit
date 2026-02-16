import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageCircle, ShoppingCart, UserPlus, Clock, CheckCircle, X,
  Cake, UserX, Phone, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type FilterType = "all" | "abandoned" | "new" | "contacted" | "birthday" | "inactive";

interface UnifiedLead {
  id: string;
  name: string;
  phone: string;
  type: "abandoned" | "new" | "birthday" | "inactive";
  cartTotal?: number;
  cartItems?: { id: string; product_name: string; quantity: number; unit_price: number }[];
  createdAt: string;
  sourceTable: "lead" | "customer";
  leadCartItemIds?: string[];
}

export default function WhatsAppCRM() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const { data: storeSettings } = useQuery({
    queryKey: ["crm-store-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("store_name, store_slug, id")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // 1. Abandoned carts
  const { data: abandonedLeads = [] } = useQuery({
    queryKey: ["crm-abandoned", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_cart_items")
        .select("id, product_name, quantity, unit_price, lead_id, store_leads!inner(id, name, whatsapp, created_at, owner_id)")
        .eq("status", "abandoned")
        .eq("store_leads.owner_id", user!.id);
      if (error) throw error;

      const map = new Map<string, UnifiedLead>();
      (data || []).forEach((item: any) => {
        const lead = item.store_leads;
        if (!map.has(lead.id)) {
          map.set(lead.id, {
            id: lead.id, name: lead.name, phone: lead.whatsapp,
            type: "abandoned", cartTotal: 0, cartItems: [],
            createdAt: lead.created_at, sourceTable: "lead", leadCartItemIds: [],
          });
        }
        const entry = map.get(lead.id)!;
        entry.cartItems!.push({ id: item.id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price });
        entry.cartTotal! += item.unit_price * item.quantity;
        entry.leadCartItemIds!.push(item.id);
      });
      return Array.from(map.values());
    },
    enabled: !!user?.id,
  });

  // 2. New leads (no cart items, last 7 days)
  const { data: newLeads = [] } = useQuery({
    queryKey: ["crm-new-leads", user?.id],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: leads, error } = await supabase
        .from("store_leads")
        .select("id, name, whatsapp, created_at")
        .eq("owner_id", user!.id)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // filter out leads that have cart items
      const leadIds = (leads || []).map(l => l.id);
      if (leadIds.length === 0) return [];
      const { data: cartLeads } = await supabase
        .from("lead_cart_items")
        .select("lead_id")
        .in("lead_id", leadIds);
      const cartLeadIds = new Set((cartLeads || []).map((c: any) => c.lead_id));

      return (leads || [])
        .filter(l => !cartLeadIds.has(l.id))
        .map(l => ({
          id: l.id, name: l.name, phone: l.whatsapp,
          type: "new" as const, createdAt: l.created_at, sourceTable: "lead" as const,
        }));
    },
    enabled: !!user?.id,
  });

  // 3. Contacted leads
  const { data: contactedLeads = [] } = useQuery({
    queryKey: ["crm-contacted", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_cart_items")
        .select("id, product_name, quantity, unit_price, lead_id, store_leads!inner(id, name, whatsapp, created_at, owner_id)")
        .eq("status", "contacted")
        .eq("store_leads.owner_id", user!.id);
      if (error) throw error;

      const map = new Map<string, UnifiedLead>();
      (data || []).forEach((item: any) => {
        const lead = item.store_leads;
        if (!map.has(lead.id)) {
          map.set(lead.id, {
            id: lead.id, name: lead.name, phone: lead.whatsapp,
            type: "abandoned", cartTotal: 0, cartItems: [],
            createdAt: lead.created_at, sourceTable: "lead", leadCartItemIds: [],
          });
        }
        const entry = map.get(lead.id)!;
        entry.cartItems!.push({ id: item.id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price });
        entry.cartTotal! += item.unit_price * item.quantity;
        entry.leadCartItemIds!.push(item.id);
      });
      return Array.from(map.values());
    },
    enabled: !!user?.id,
  });

  // 4. Birthday customers
  const { data: birthdayCustomers = [] } = useQuery({
    queryKey: ["crm-birthdays", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, birth_date, created_at")
        .eq("owner_id", user!.id)
        .not("birth_date", "is", null);
      if (error) throw error;

      const currentMonth = new Date().getMonth() + 1;
      return (data || [])
        .filter(c => {
          if (!c.birth_date) return false;
          const month = parseInt(c.birth_date.split("-")[1], 10);
          return month === currentMonth;
        })
        .map(c => ({
          id: c.id, name: c.name, phone: c.phone || "",
          type: "birthday" as const, createdAt: c.created_at, sourceTable: "customer" as const,
        }));
    },
    enabled: !!user?.id,
  });

  // 5. Inactive 30d customers
  const { data: inactiveCustomers = [] } = useQuery({
    queryKey: ["crm-inactive", user?.id],
    queryFn: async () => {
      const { data: customers, error } = await supabase
        .from("customers")
        .select("id, name, phone, created_at")
        .eq("owner_id", user!.id);
      if (error) throw error;
      if (!customers || customers.length === 0) return [];

      const { data: sales } = await supabase
        .from("sales")
        .select("customer_name, created_at")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });

      const lastSaleMap = new Map<string, string>();
      (sales || []).forEach((s: any) => {
        const key = s.customer_name?.toLowerCase();
        if (key && !lastSaleMap.has(key)) lastSaleMap.set(key, s.created_at);
      });

      const thirtyDaysAgo = subDays(new Date(), 30);
      return customers
        .filter(c => {
          const lastSale = lastSaleMap.get(c.name?.toLowerCase());
          if (!lastSale) return true;
          return new Date(lastSale) < thirtyDaysAgo;
        })
        .filter(c => c.phone)
        .map(c => ({
          id: c.id, name: c.name, phone: c.phone || "",
          type: "inactive" as const, createdAt: c.created_at, sourceTable: "customer" as const,
        }));
    },
    enabled: !!user?.id,
  });

  // Summary counts
  const abandonedTotal = abandonedLeads.reduce((sum, l) => sum + (l.cartTotal || 0), 0);
  const contactedCount = contactedLeads.length;

  // Merge pending leads
  const pendingLeads = useMemo(() => {
    let all: UnifiedLead[] = [...abandonedLeads, ...newLeads, ...birthdayCustomers, ...inactiveCustomers];
    if (activeFilter === "abandoned") all = abandonedLeads;
    else if (activeFilter === "new") all = newLeads;
    else if (activeFilter === "birthday") all = birthdayCustomers;
    else if (activeFilter === "inactive") all = inactiveCustomers;
    return all;
  }, [activeFilter, abandonedLeads, newLeads, birthdayCustomers, inactiveCustomers]);

  // Mutations
  const markContacted = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("lead_cart_items")
        .update({ status: "contacted" })
        .eq("lead_id", leadId)
        .eq("status", "abandoned");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-abandoned"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacted"] });
      toast.success("Lead movido para Contatados!");
    },
  });

  const updateLeadStatus = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { error } = await supabase
        .from("lead_cart_items")
        .update({ status })
        .eq("lead_id", leadId)
        .eq("status", "contacted");
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacted"] });
      toast.success(status === "converted" ? "Convertido em venda!" : "Lead descartado.");
    },
  });

  const storeName = storeSettings?.store_name || "nossa loja";

  const getWhatsAppMessage = (lead: UnifiedLead) => {
    switch (lead.type) {
      case "abandoned":
        return `Oi ${lead.name}, vi que você separou peças lindas no carrinho da ${storeName}... posso ajudar? 😊`;
      case "new":
        return `Oi ${lead.name}, bem-vinda à ${storeName}! Tem novidades incríveis te esperando 💜`;
      case "birthday":
        return `Parabéns ${lead.name}! 🎂 A ${storeName} preparou algo especial pra você!`;
      case "inactive":
        return `Oi ${lead.name}, sentimos sua falta! Tem muita novidade na ${storeName} 🛍️`;
      default:
        return `Oi ${lead.name}!`;
    }
  };

  const handleWhatsApp = (lead: UnifiedLead) => {
    const phone = lead.phone.replace(/\D/g, "");
    const msg = getWhatsAppMessage(lead);
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    if (lead.sourceTable === "lead" && lead.type === "abandoned") {
      markContacted.mutate(lead.id);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const badgeConfig: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
    abandoned: { label: "Carrinho Abandonado", variant: "destructive" },
    new: { label: "Novo Cadastro", variant: "default" },
    birthday: { label: "Aniversariante", variant: "secondary" },
    inactive: { label: "Inativo 30d", variant: "outline" },
  };

  const summaryCards = [
    { key: "abandoned" as FilterType, icon: ShoppingCart, label: "Carrinhos Abandonados", value: formatPrice(abandonedTotal), count: abandonedLeads.length, color: "text-orange-500", bg: "bg-orange-500/10" },
    { key: "new" as FilterType, icon: UserPlus, label: "Novos Cadastros", value: String(newLeads.length), color: "text-blue-500", bg: "bg-blue-500/10" },
    { key: "contacted" as FilterType, icon: Clock, label: "Aguardando Retorno", value: String(contactedCount), color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { key: "birthday" as FilterType, icon: Cake, label: "Aniversariantes do Mês", value: String(birthdayCustomers.length), color: "text-pink-500", bg: "bg-pink-500/10" },
    { key: "inactive" as FilterType, icon: UserX, label: "30 Dias sem Visita", value: String(inactiveCustomers.length), color: "text-muted-foreground", bg: "bg-muted" },
  ];

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, lead: UnifiedLead) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: lead.id, sourceTable: lead.sourceTable, type: lead.type }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn("contacted");
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.sourceTable === "customer") {
        toast.info(`${data.type === "birthday" ? "Aniversariante" : "Cliente inativo"} — contate via WhatsApp.`);
        return;
      }
      if (data.sourceTable === "lead") {
        markContacted.mutate(data.id);
      }
    } catch { /* ignore */ }
  };

  const renderPendingCard = (lead: UnifiedLead) => {
    const badge = badgeConfig[lead.type];
    return (
      <div
        key={`${lead.sourceTable}-${lead.id}`}
        draggable
        onDragStart={(e) => handleDragStart(e, lead)}
        className="rounded-xl border bg-card p-4 space-y-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GripVertical className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate text-foreground">{lead.name}</h3>
                <Badge variant={badge.variant} className="text-[10px] shrink-0">{badge.label}</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm mt-1">
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true, locale: ptBR })}</span>
              </div>
            </div>
          </div>
          {lead.cartTotal && lead.cartTotal > 0 && (
            <p className="text-lg font-bold text-primary shrink-0">{formatPrice(lead.cartTotal)}</p>
          )}
        </div>

        {lead.cartItems && lead.cartItems.length > 0 && (
          <div className="space-y-1 text-sm text-muted-foreground">
            {lead.cartItems.slice(0, 3).map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="truncate flex-1">{item.product_name}{item.quantity > 1 ? ` x${item.quantity}` : ""}</span>
                <span className="ml-2 shrink-0">{formatPrice(item.unit_price * item.quantity)}</span>
              </div>
            ))}
            {lead.cartItems.length > 3 && <p className="text-xs">+{lead.cartItems.length - 3} mais itens</p>}
          </div>
        )}

        <Button onClick={() => handleWhatsApp(lead)} className="w-full gap-2 font-semibold" style={{ backgroundColor: "#25D366" }}>
          <MessageCircle className="h-4 w-4" />
          Chamar no WhatsApp
        </Button>
      </div>
    );
  };

  const renderContactedCard = (lead: UnifiedLead) => (
    <div key={lead.id} className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{lead.name}</h3>
            <Badge variant="secondary" className="text-[10px] shrink-0">Contatado</Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>
          </div>
        </div>
        {lead.cartTotal && lead.cartTotal > 0 && (
          <p className="text-lg font-bold text-primary shrink-0">{formatPrice(lead.cartTotal)}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => handleWhatsApp(lead)}>
          <MessageCircle className="h-3.5 w-3.5" />Follow-up
        </Button>
        <Button size="sm" className="flex-1 gap-1.5" onClick={() => updateLeadStatus.mutate({ leadId: lead.id, status: "converted" })}>
          <CheckCircle className="h-3.5 w-3.5" />Converter
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => updateLeadStatus.mutate({ leadId: lead.id, status: "cancelled" })}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WhatsApp CRM</h1>
            <p className="text-sm text-muted-foreground">Recuperação de vendas e relacionamento</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {summaryCards.map((card) => (
            <Card
              key={card.key}
              className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === card.key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setActiveFilter(activeFilter === card.key ? "all" : card.key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pendentes Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <ShoppingCart className="h-4 w-4 text-orange-500" />
              <h2 className="font-semibold">Pendentes</h2>
              <Badge variant="outline" className="ml-auto">{pendingLeads.length}</Badge>
            </div>
            <div className="space-y-3 min-h-[200px] rounded-xl border-2 border-dashed border-border p-3 bg-muted/30">
              {pendingLeads.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum lead pendente</p>
                </div>
              ) : (
                pendingLeads.map(renderPendingCard)
              )}
            </div>
          </div>

          {/* Contatados Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <h2 className="font-semibold">Contatados</h2>
              <Badge variant="outline" className="ml-auto">{contactedLeads.length}</Badge>
            </div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`space-y-3 min-h-[200px] rounded-xl border-2 border-dashed p-3 transition-colors ${
                dragOverColumn === "contacted"
                  ? "border-green-500 bg-green-500/5 ring-2 ring-green-500/20"
                  : "border-border bg-muted/30"
              }`}
            >
              {contactedLeads.length === 0 && !dragOverColumn ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Arraste leads aqui para marcar como contatados</p>
                </div>
              ) : contactedLeads.length === 0 && dragOverColumn ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-10 w-10 text-green-500/50 mx-auto mb-3" />
                  <p className="text-sm text-green-600 font-medium">Solte aqui para marcar como contatado</p>
                </div>
              ) : (
                contactedLeads.map(renderContactedCard)
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
