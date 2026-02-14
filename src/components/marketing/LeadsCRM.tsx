import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LeadDetailExpander } from "./LeadDetailExpander";
import { MessageCircle, ChevronDown, ChevronUp, Download, Search, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

interface LeadsCRMProps {
  ownerId: string;
  dateRange: { start: Date; end: Date };
}

type FunnelStatus = "all" | "new" | "abandoned" | "contacted" | "converted";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Novo Lead", variant: "secondary" },
  abandoned: { label: "Carrinho Abandonado", variant: "destructive" },
  contacted: { label: "Em Atendimento", variant: "default" },
  converted: { label: "Venda Concluída", variant: "outline" },
};

const PAGE_SIZE = 20;

export function LeadsCRM({ ownerId, dateRange }: LeadsCRMProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FunnelStatus>("all");
  const [page, setPage] = useState(0);
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());

  const startISO = dateRange.start.toISOString();
  const endISO = dateRange.end.toISOString();

  // Fetch all leads in period with their cart items
  const { data: rawLeads = [], isLoading } = useQuery({
    queryKey: ["crm-leads", ownerId, startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_leads")
        .select("id, name, whatsapp, created_at, lead_cart_items(id, status, product_name, unit_price, quantity, variant_color, selected_size)")
        .eq("owner_id", ownerId)
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((lead: any) => {
        const items = lead.lead_cart_items || [];
        let status: string = "new";
        if (items.some((i: any) => i.status === "converted")) status = "converted";
        else if (items.some((i: any) => i.status === "contacted")) status = "contacted";
        else if (items.some((i: any) => i.status === "abandoned")) status = "abandoned";
        const total = items.reduce((s: number, i: any) => s + (i.unit_price || 0) * (i.quantity || 1), 0);
        return { ...lead, funnel_status: status, cart_total: total, items };
      });
    },
  });

  // Filter leads
  const filteredLeads = useMemo(() => {
    let result = rawLeads;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((l: any) => l.name.toLowerCase().includes(term));
    }
    if (statusFilter !== "all") {
      result = result.filter((l: any) => l.funnel_status === statusFilter);
    }
    return result;
  }, [rawLeads, searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);
  const paginatedLeads = filteredLeads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleExpand = (id: string) => {
    setExpandedLeads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
  };

  const openWhatsApp = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${digits}`, "_blank");
  };

  const exportCSV = () => {
    const rows = filteredLeads.map((l: any) => ({
      Nome: l.name,
      WhatsApp: l.whatsapp,
      Status: STATUS_CONFIG[l.funnel_status]?.label || l.funnel_status,
      "Data de Captura": format(parseISO(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      Produtos: l.items.map((i: any) => i.product_name).join(", "),
      "Valor Total": l.cart_total,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_${format(new Date(), "yyyy-MM-dd")}.csv`, { bookType: "csv" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">CRM de Leads</h3>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as FunnelStatus); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="new">Novo Lead</SelectItem>
            <SelectItem value="abandoned">Carrinho Abandonado</SelectItem>
            <SelectItem value="contacted">Em Atendimento</SelectItem>
            <SelectItem value="converted">Venda Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leads List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-xl border p-4 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : paginatedLeads.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum lead encontrado no período selecionado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedLeads.map((lead: any) => {
            const isExpanded = expandedLeads.has(lead.id);
            const statusCfg = STATUS_CONFIG[lead.funnel_status] || STATUS_CONFIG.new;
            return (
              <Collapsible key={lead.id} open={isExpanded} onOpenChange={() => toggleExpand(lead.id)}>
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{lead.name}</span>
                        <Badge variant={statusCfg.variant} className="text-[10px]">{statusCfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span>{format(parseISO(lead.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); openWhatsApp(lead.whatsapp); }}
                          className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {formatPhone(lead.whatsapp)}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lead.cart_total > 0 && (
                        <span className="text-sm font-bold text-primary">{formatPrice(lead.cart_total)}</span>
                      )}
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <LeadDetailExpander leadId={lead.id} />
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">{page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}
