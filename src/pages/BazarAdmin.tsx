import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle, XCircle, Package, Phone, User, Loader2, Truck, Tag, DollarSign } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  sold: { label: "Vendido", variant: "outline" },
};

function BazarItemCard({ item, tab, commissions, setCommissions, onApprove, onReject, isPending }: any) {
  const imgs = [item.image_url, item.image_url_2, item.image_url_3].filter(Boolean) as string[];
  const commVal = commissions[item.id] ?? "";
  const commNum = parseFloat((commVal || "0").replace(",", "."));
  const finalPrice = !isNaN(commNum) ? Number(item.seller_price) + commNum : Number(item.seller_price);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {imgs.length > 0 && (
          <div className="flex gap-1.5">
            {imgs.map((url, i) => (
              <img key={i} src={url} alt="" className="h-20 w-20 rounded-lg object-cover border" />
            ))}
          </div>
        )}

        <div>
          <h3 className="font-semibold text-sm">{item.title}</h3>
          {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="h-3 w-3" /> {item.seller_name || "—"}
          <Phone className="h-3 w-3 ml-2" /> {item.seller_phone}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Package className="h-3 w-3" />
          {(item.weight_grams / 1000).toFixed(1)}kg • {item.height_cm}×{item.width_cm}×{item.length_cm}cm
        </div>

        {item.seller_city && (
          <p className="text-xs text-muted-foreground">
            📍 {item.seller_city}/{item.seller_state} - CEP {item.seller_zip}
          </p>
        )}

        {/* Pricing */}
        <div className="border rounded-lg p-2 space-y-1 bg-muted/30">
          <div className="flex justify-between text-sm">
            <span>Preço vendedor:</span>
            <span className="font-semibold">R$ {Number(item.seller_price).toFixed(2).replace(".", ",")}</span>
          </div>
          {tab === "pending" ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap">Comissão:</span>
                <Input
                  value={commVal}
                  onChange={(e) => setCommissions((p: any) => ({ ...p, [item.id]: e.target.value }))}
                  placeholder="0,00"
                  className="h-7 text-sm"
                  inputMode="decimal"
                />
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Preço Final:</span>
                <span className="text-primary">R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
              </div>
            </>
          ) : (
            <>
              {item.store_commission != null && (
                <div className="flex justify-between text-sm">
                  <span>Comissão:</span>
                  <span>R$ {Number(item.store_commission).toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              {item.final_price != null && (
                <div className="flex justify-between text-sm font-semibold">
                  <span>Preço Final:</span>
                  <span className="text-primary">R$ {Number(item.final_price).toFixed(2).replace(".", ",")}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sold info */}
        {tab === "sold" && <SoldDetails item={item} />}

        <Badge variant={STATUS_MAP[item.status]?.variant || "secondary"}>
          {STATUS_MAP[item.status]?.label || item.status}
        </Badge>

        {tab === "pending" && (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => onApprove(item.id)} disabled={isPending}>
              <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => onReject(item.id)} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-1" /> Rejeitar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SoldDetails({ item }: { item: any }) {
  const [generating, setGenerating] = useState(false);

  const handleGenerateLabel = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Faça login"); return; }

      const { data, error } = await supabase.functions.invoke("purchase-shipping", {
        body: {
          origin_zip: item.seller_zip,
          destination_zip: item.buyer_zip,
          weight_grams: item.weight_grams,
          width_cm: item.width_cm,
          height_cm: item.height_cm,
          length_cm: item.length_cm,
          shipping_source: item.shipping_source,
          shipping_service_id: item.shipping_service_id,
          shipping_company: item.shipping_carrier,
          shipping_cost: item.shipping_cost,
          seller_name: item.seller_name,
          seller_phone: item.seller_phone,
          customer_name: item.buyer_name,
          customer_phone: item.buyer_phone,
          subtotal: Number(item.final_price || item.seller_price),
        },
      });

      if (error) throw error;
      if (data?.label_url) {
        await supabase.from("bazar_items").update({
          shipping_label_url: data.label_url,
          shipping_tracking: data.tracking,
        }).eq("id", item.id);

        toast.success("Etiqueta gerada com sucesso!");
        window.open(data.label_url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar etiqueta");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Buyer info */}
      <div className="border rounded-lg p-2 bg-blue-50/50 space-y-1">
        <p className="text-xs font-semibold flex items-center gap-1"><User className="h-3 w-3" /> Comprador</p>
        <p className="text-xs">{item.buyer_name} • {item.buyer_phone}</p>
        <p className="text-xs text-muted-foreground">CEP: {item.buyer_zip}</p>
      </div>

      {/* Shipping info */}
      {item.shipping_carrier && (
        <div className="border rounded-lg p-2 bg-green-50/50 space-y-1">
          <p className="text-xs font-semibold flex items-center gap-1"><Truck className="h-3 w-3" /> Frete</p>
          <p className="text-xs">{item.shipping_carrier} - {item.shipping_service}</p>
          <p className="text-xs">R$ {Number(item.shipping_cost).toFixed(2).replace(".", ",")} • {item.shipping_source}</p>
          {item.shipping_tracking && <p className="text-xs text-muted-foreground">Rastreio: {item.shipping_tracking}</p>}
        </div>
      )}

      {/* Value split */}
      <div className="border rounded-lg p-2 bg-amber-50/50 space-y-1">
        <p className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" /> Separação de Valores</p>
        <div className="flex justify-between text-xs">
          <span>Vendedor:</span>
          <span>R$ {Number(item.seller_price).toFixed(2).replace(".", ",")}</span>
        </div>
        {item.store_commission != null && Number(item.store_commission) > 0 && (
          <div className="flex justify-between text-xs">
            <span>Comissão loja:</span>
            <span>R$ {Number(item.store_commission).toFixed(2).replace(".", ",")}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span>Frete:</span>
          <span>R$ {Number(item.shipping_cost || 0).toFixed(2).replace(".", ",")}</span>
        </div>
      </div>

      {/* Label actions */}
      {item.shipping_label_url ? (
        <Button size="sm" variant="outline" className="w-full" onClick={() => window.open(item.shipping_label_url, "_blank")}>
          <Tag className="h-4 w-4 mr-1" /> Ver Etiqueta
        </Button>
      ) : (
        <Button size="sm" className="w-full" onClick={handleGenerateLabel} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Tag className="h-4 w-4 mr-1" />}
          Gerar Etiqueta
        </Button>
      )}
    </div>
  );
}

export default function BazarAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [commissions, setCommissions] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["bazar-items", user?.id, tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bazar_items")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, commission }: { id: string; status: string; commission?: number }) => {
      const updateData: Record<string, any> = { status };
      if (commission != null) {
        updateData.store_commission = commission;
        const item = items.find((i) => i.id === id);
        if (item) updateData.final_price = Number(item.seller_price) + commission;
      }
      const { error } = await supabase.from("bazar_items").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bazar-items"] });
      toast.success("Item atualizado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleApprove = (id: string) => {
    const raw = commissions[id];
    const commission = parseFloat((raw || "0").replace(",", "."));
    if (isNaN(commission) || commission < 0) { toast.error("Informe uma comissão válida"); return; }
    updateMutation.mutate({ id, status: "approved", commission });
  };

  const handleReject = (id: string) => updateMutation.mutate({ id, status: "rejected" });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Bazar VIP</h1>
          <p className="text-muted-foreground">Gerencie os itens enviados pelos clientes</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
            <TabsTrigger value="sold">Vendidos</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : items.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhum item {STATUS_MAP[tab]?.label.toLowerCase()}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <BazarItemCard
                    key={item.id}
                    item={item}
                    tab={tab}
                    commissions={commissions}
                    setCommissions={setCommissions}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isPending={updateMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
