import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Store, ShoppingBag, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { BazarSubmissionDialog } from "@/components/catalog/BazarSubmissionDialog";

export default function BazarSeller() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [identified, setIdentified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);

  // Look up the permission record by token
  const { data: permission, isLoading, error } = useQuery({
    queryKey: ["bazar-seller-token", token],
    queryFn: async () => {
      if (!token) throw new Error("Token inválido");
      const { data, error } = await supabase
        .from("customer_bazar_permissions")
        .select("id, owner_id, customer_id, can_sell, bazar_token")
        .eq("bazar_token", token)
        .eq("can_sell", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Link inválido ou sem permissão de venda");
      return data;
    },
    enabled: !!token,
    retry: false,
  });

  // Get store info (store_settings) from the owner
  const { data: storeInfo } = useQuery({
    queryKey: ["bazar-store-info", permission?.owner_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("store_name, store_slug, primary_color, logo_url")
        .eq("owner_id", permission!.owner_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!permission?.owner_id,
  });

  // Get customer info from the permission
  const { data: customer } = useQuery({
    queryKey: ["bazar-customer-info", permission?.customer_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("id", permission!.customer_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!permission?.customer_id,
  });

  const handleIdentify = () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Informe um número de WhatsApp válido");
      return;
    }

    setVerifying(true);
    // Check if this phone matches the customer record
    if (customer?.phone) {
      const customerClean = customer.phone.replace(/\D/g, "");
      if (customerClean.includes(cleanPhone) || cleanPhone.includes(customerClean)) {
        setName(customer.name || "");
        setIdentified(true);
        setVerifying(false);
        return;
      }
    }

    // If no match, let them proceed anyway with the phone they provided
    setIdentified(true);
    setVerifying(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || error || !permission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center space-y-3">
            <Store className="h-10 w-10 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Link inválido</h2>
            <p className="text-sm text-muted-foreground">
              Este link de venda não é válido ou a permissão foi revogada. Entre em contato com a loja.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = storeInfo?.primary_color || "#8B5CF6";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b p-4" style={{ borderColor: primaryColor + "30" }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          {storeInfo?.logo_url ? (
            <img src={storeInfo.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor + "20" }}>
              <Store className="h-5 w-5" style={{ color: primaryColor }} />
            </div>
          )}
          <div>
            <h1 className="font-semibold text-sm">{storeInfo?.store_name || "Loja"}</h1>
            <p className="text-xs text-muted-foreground">Bazar VIP — Venda suas peças</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {!identified ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Identifique-se
              </CardTitle>
              <CardDescription>
                Informe seu WhatsApp para verificar sua permissão de venda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>WhatsApp *</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  maxLength={15}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleIdentify}
                disabled={verifying}
                style={{ backgroundColor: primaryColor }}
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Continuar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Welcome message */}
            <Card>
              <CardContent className="p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: primaryColor }} />
                <div>
                  <p className="text-sm font-medium">
                    Olá{name ? `, ${name}` : ""}! 👋
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você pode cadastrar itens para vender no Bazar VIP de{" "}
                    <strong>{storeInfo?.store_name || "nossa loja"}</strong>. 
                    Cada item será analisado pela loja antes de ser disponibilizado para venda.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CTA button */}
            <Button
              className="w-full h-14 text-base gap-2"
              onClick={() => setSubmissionOpen(true)}
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingBag className="h-5 w-5" />
              Cadastrar Item para Venda
            </Button>

            {/* How it works */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">Como funciona?</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <Badge variant="outline" className="h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center p-0 text-[10px]">1</Badge>
                    <span>Cadastre o item com fotos, preço desejado e dados da embalagem</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center p-0 text-[10px]">2</Badge>
                    <span>A loja analisa e define o preço final com a comissão</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center p-0 text-[10px]">3</Badge>
                    <span>O item é exibido no Bazar VIP para compradores</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center p-0 text-[10px]">4</Badge>
                    <span>Após a venda, você envia o item e recebe seu valor</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Submission dialog */}
      {permission && (
        <BazarSubmissionDialog
          open={submissionOpen}
          onOpenChange={setSubmissionOpen}
          ownerId={permission.owner_id}
          sellerPhone={customer?.phone || phone}
          sellerName={name || customer?.name || undefined}
          storeSlug={storeInfo?.store_slug || "store"}
        />
      )}
    </div>
  );
}
