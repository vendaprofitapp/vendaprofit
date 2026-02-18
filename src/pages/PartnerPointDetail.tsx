import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TransferItemsDialog } from "@/components/partners/TransferItemsDialog";
import { ReturnItemsDialog } from "@/components/partners/ReturnItemsDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, Package, Phone, Send, RotateCcw,
  Copy, CheckCircle2, ShoppingBag, Clock, AlertTriangle
} from "lucide-react";

interface PartnerPoint {
  id: string;
  name: string;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  rack_commission_pct: number;
  pickup_commission_pct: number;
  payment_fee_pct: number;
  loss_risk_enabled: boolean;
  replenishment_cycle_days: number | null;
  min_stock_alert: number | null;
  access_token: string;
  is_active: boolean;
  notes: string | null;
}

interface AllocatedItem {
  id: string;
  product_id: string;
  quantity: number;
  status: string;
  allocated_at: string;
  product?: { name: string; image_url: string | null; price: number };
}

interface Sale {
  id: string;
  customer_name: string;
  customer_phone: string;
  total_gross: number;
  payment_method: string;
  pass_color: string;
  pass_status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  allocated: { label: "Na Arara", variant: "default" },
  sold_online: { label: "Vendido Online — Recolher", variant: "destructive" },
  sold_at_location: { label: "Vendido no Local", variant: "secondary" },
  returning: { label: "Retornando", variant: "outline" },
  returned: { label: "Devolvido", variant: "secondary" },
  lost: { label: "Extraviado", variant: "destructive" },
};

const PASS_LABELS: Record<string, string> = {
  pix: "🟢 PIX",
  card: "🟡 Cartão",
  try_home: "🔵 Casa 24h",
  infinite_shelf: "🟣 Encomenda",
};

const SALE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  validated: "Validado",
  completed: "Concluído",
  returned: "Devolvido",
};

export default function PartnerPointDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [partner, setPartner] = useState<PartnerPoint | null>(null);
  const [items, setItems] = useState<AllocatedItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchData = async () => {
    if (!id || !user) return;
    setLoading(true);

    const [{ data: pp }, { data: rawItems }, { data: rawSales }] = await Promise.all([
      supabase.from("partner_points").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle(),
      supabase.from("partner_point_items").select("id, product_id, quantity, status, allocated_at")
        .eq("partner_point_id", id).not("status", "in", '("returned","lost")').order("allocated_at", { ascending: false }),
      supabase.from("partner_point_sales").select("id, customer_name, customer_phone, total_gross, payment_method, pass_color, pass_status, created_at")
        .eq("partner_point_id", id).order("created_at", { ascending: false }).limit(50),
    ]);

    if (!pp) { navigate("/partner-points"); return; }
    setPartner(pp as PartnerPoint);
    setSales((rawSales ?? []) as Sale[]);

    if (rawItems && rawItems.length > 0) {
      const productIds = [...new Set(rawItems.map((i: any) => i.product_id))];
      const { data: products } = await supabase.from("products").select("id, name, image_url, price").in("id", productIds);
      const productMap = Object.fromEntries((products ?? []).map(p => [p.id, p]));
      setItems((rawItems as any[]).map(i => ({ ...i, product: productMap[i.product_id] })));
    } else {
      setItems([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id, user]);

  const handleCopyLink = () => {
    if (!partner) return;
    navigator.clipboard.writeText(`${window.location.origin}/p/${partner.access_token}`);
    setLinkCopied(true);
    toast.success("Link do catálogo QR copiado!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const allocatedItems = items.filter(i => i.status === "allocated");
  const alertItems = items.filter(i => i.status === "sold_online");

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 space-y-4 max-w-4xl mx-auto">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-32 bg-muted rounded-xl animate-pulse" />
          <div className="h-64 bg-muted rounded-xl animate-pulse" />
        </div>
      </MainLayout>
    );
  }

  if (!partner) return null;

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/partner-points")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{partner.name}</h1>
            {partner.address && <p className="text-sm text-muted-foreground truncate">{partner.address}</p>}
          </div>
          <Badge variant={partner.is_active ? "default" : "secondary"}>{partner.is_active ? "Ativo" : "Inativo"}</Badge>
        </div>

        {/* Info card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              {partner.contact_name && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{partner.contact_name}</span>
                  {partner.contact_phone && <span className="text-muted-foreground">— {partner.contact_phone}</span>}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>{allocatedItems.length} peças na arara</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-3">
              <span>Comissão arara: <b className="text-foreground">{partner.rack_commission_pct}%</b></span>
              <span>Comissão retirada: <b className="text-foreground">{partner.pickup_commission_pct}%</b></span>
              <span>Taxa maquininha: <b className="text-foreground">{partner.payment_fee_pct}%</b></span>
              {partner.loss_risk_enabled && <Badge variant="outline" className="text-xs">Risco de Perda Ativo</Badge>}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyLink}>
                {linkCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {linkCopied ? "Copiado!" : "Copiar Link QR"}
              </Button>
              {partner.contact_phone && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`https://wa.me/55${partner.contact_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                    <Phone className="h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alert for sold online */}
        {alertItems.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">{alertItems.length} peça(s) vendida(s) online — recolher da arara</p>
                <p className="text-xs text-muted-foreground mt-0.5">Estas peças foram vendidas pelo catálogo principal e precisam ser retiradas da arara do parceiro.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="stock">
          <TabsList className="w-full">
            <TabsTrigger value="stock" className="flex-1 gap-1.5">
              <Package className="h-4 w-4" />
              Estoque ({allocatedItems.length})
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex-1 gap-1.5">
              <ShoppingBag className="h-4 w-4" />
              Vendas ({sales.length})
            </TabsTrigger>
          </TabsList>

          {/* Stock tab */}
          <TabsContent value="stock" className="space-y-3 mt-4">
            <div className="flex gap-2">
              <Button className="gap-2 flex-1" onClick={() => setShowTransfer(true)}>
                <Send className="h-4 w-4" />
                Enviar Peças
              </Button>
              <Button variant="outline" className="gap-2 flex-1" onClick={() => setShowReturn(true)}>
                <RotateCcw className="h-4 w-4" />
                Recolher Peças
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-10">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground text-sm">Nenhuma peça alocada neste ponto.</p>
                <Button variant="outline" className="mt-3 gap-2" onClick={() => setShowTransfer(true)}>
                  <Send className="h-4 w-4" />
                  Enviar primeira peça
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => {
                  const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, variant: "outline" as const };
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      {item.product?.image_url ? (
                        <img src={item.product.image_url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product?.name ?? "Produto"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={statusInfo.variant} className="text-xs py-0">{statusInfo.label}</Badge>
                          <span className="text-xs text-muted-foreground">{item.quantity} un.</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {item.product?.price && <p className="text-sm font-medium">{fmtBRL(item.product.price)}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(item.allocated_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Sales tab */}
          <TabsContent value="sales" className="space-y-3 mt-4">
            {sales.length === 0 ? (
              <div className="text-center py-10">
                <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground text-sm">Nenhuma venda registrada ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">As vendas aparecem aqui quando clientes usam o catálogo QR deste parceiro.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sales.map(sale => (
                  <div key={sale.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{sale.customer_name}</p>
                        <span className="text-xs text-muted-foreground">{PASS_LABELS[sale.payment_method]}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={sale.pass_status === "completed" ? "default" : "secondary"} className="text-xs py-0">
                          {SALE_STATUS_LABELS[sale.pass_status] ?? sale.pass_status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{sale.customer_phone}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{fmtBRL(sale.total_gross)}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TransferItemsDialog
        open={showTransfer}
        onOpenChange={setShowTransfer}
        partnerPointId={partner.id}
        partnerName={partner.name}
        partnerPhone={partner.contact_phone}
        onTransferred={fetchData}
      />
      <ReturnItemsDialog
        open={showReturn}
        onOpenChange={setShowReturn}
        partnerPointId={partner.id}
        partnerName={partner.name}
        onReturned={fetchData}
      />
    </MainLayout>
  );
}
