import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Copy, ExternalLink, ShoppingBag, Instagram, CheckCircle2, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export function ExternalShowcasesSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [googleHelpOpen, setGoogleHelpOpen] = useState(false);
  const [metaHelpOpen, setMetaHelpOpen] = useState(false);

  const { data: storeSettings } = useQuery({
    queryKey: ["store-settings-feed", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("id, store_slug, store_name, feed_token")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Auto-generate feed_token if missing
  const generateToken = useMutation({
    mutationFn: async () => {
      if (!storeSettings?.id) throw new Error("Loja não encontrada");
      const token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const { error } = await supabase
        .from("store_settings")
        .update({ feed_token: token } as any)
        .eq("id", storeSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-settings-feed"] });
    },
  });

  useEffect(() => {
    if (storeSettings && !storeSettings.feed_token) {
      generateToken.mutate();
    }
  }, [storeSettings]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const googleFeedUrl = storeSettings?.feed_token
    ? `${supabaseUrl}/functions/v1/product-feed?store_id=${storeSettings.id}&token=${storeSettings.feed_token}&format=google`
    : "";

  const metaFeedUrl = storeSettings?.feed_token
    ? `${supabaseUrl}/functions/v1/product-feed?store_id=${storeSettings.id}&token=${storeSettings.feed_token}&format=meta`
    : "";

  const copyToClipboard = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`Link do feed ${label} copiado!`);
  };

  if (!storeSettings) {
    return (
      <div className="text-center py-16">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-lg font-medium">Configure sua loja primeiro</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Acesse Configurações da Loja para criar sua vitrine antes de ativar os feeds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Vitrines Externas</h2>
        <p className="text-sm text-muted-foreground">
          Exporte seu catálogo automaticamente para Google e Instagram. Produtos com estoque zero são removidos em tempo real.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Google Shopping Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Google Shopping</CardTitle>
                <CardDescription className="text-xs">
                  Apareça de graça nas buscas de produtos do Google
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px]">XML</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={googleFeedUrl}
                className="flex-1 text-xs bg-muted rounded-md px-3 py-2 font-mono truncate border"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(googleFeedUrl, "Google")}
                disabled={!googleFeedUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs"
                onClick={() => setGoogleHelpOpen(true)}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Como configurar
              </Button>
              {googleFeedUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open(googleFeedUrl, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Testar Feed
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Meta/Instagram Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                <Instagram className="h-5 w-5 text-pink-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Instagram & Facebook Shop</CardTitle>
                <CardDescription className="text-xs">
                  Habilite a sacolinha no seu perfil do Instagram
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px]">CSV</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={metaFeedUrl}
                className="flex-1 text-xs bg-muted rounded-md px-3 py-2 font-mono truncate border"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(metaFeedUrl, "Meta")}
                disabled={!metaFeedUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs"
                onClick={() => setMetaHelpOpen(true)}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Como configurar
              </Button>
              {metaFeedUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open(metaFeedUrl, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Testar Feed
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Google Help Dialog */}
      <Dialog open={googleHelpOpen} onOpenChange={setGoogleHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Como configurar o Google Shopping</DialogTitle>
            <DialogDescription>Siga estes 3 passos simples</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { step: 1, text: "Acesse merchant.google.com e crie uma conta gratuita no Google Merchant Center" },
              { step: 2, text: "Vá em Produtos → Feeds → Adicionar feed de dados" },
              { step: 3, text: 'Selecione "Feed agendado (URL)" e cole o link que você copiou acima' },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{step}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{text}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            O Google atualiza automaticamente o catálogo a cada poucas horas
          </div>
        </DialogContent>
      </Dialog>

      {/* Meta Help Dialog */}
      <Dialog open={metaHelpOpen} onOpenChange={setMetaHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Como configurar o Instagram Shop</DialogTitle>
            <DialogDescription>Siga estes 3 passos simples</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { step: 1, text: "Acesse business.facebook.com → Gerenciador de Comércio" },
              { step: 2, text: "Adicione um Catálogo → Feed de dados" },
              { step: 3, text: "Cole o link copiado e agende atualizações diárias" },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{step}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{text}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            A sacolinha ficará disponível após aprovação do Instagram (pode levar até 48h)
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
