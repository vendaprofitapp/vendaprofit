import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Megaphone, Plug, Unplug, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  {
    key: "google_ads",
    name: "Google Ads",
    description: "Campanhas de Pesquisa e Performance Max",
    color: "bg-blue-500",
    icon: "🔍",
  },
  {
    key: "meta_ads",
    name: "Meta / Instagram Ads",
    description: "Impulsionamento e tráfego no Instagram e Facebook",
    color: "bg-pink-500",
    icon: "📸",
  },
  {
    key: "tiktok_ads",
    name: "TikTok Ads",
    description: "Anúncios em vídeo no TikTok",
    color: "bg-foreground",
    icon: "🎵",
  },
];

interface Props {
  userId: string;
}

export function AdIntegrationsSection({ userId }: Props) {
  const queryClient = useQueryClient();
  const [connectDialog, setConnectDialog] = useState<string | null>(null);
  const [testToken, setTestToken] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountId, setAccountId] = useState("");

  const { data: integrations = [] } = useQuery({
    queryKey: ["ad-integrations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_ad_integrations")
        .select("*")
        .eq("owner_id", userId);
      if (error) throw error;
      return data || [];
    },
  });

  const connectMutation = useMutation({
    mutationFn: async ({ platform }: { platform: string }) => {
      const { error } = await supabase.from("user_ad_integrations").upsert(
        {
          owner_id: userId,
          platform,
          access_token: testToken || "pending_oauth",
          account_name: accountName || `Conta ${platform}`,
          account_id: accountId || "",
          is_active: true,
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "owner_id,platform" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-integrations"] });
      toast.success("Plataforma conectada!");
      setConnectDialog(null);
      setTestToken("");
      setAccountName("");
      setAccountId("");
    },
    onError: () => toast.error("Erro ao conectar"),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const { error } = await supabase
        .from("user_ad_integrations")
        .delete()
        .eq("owner_id", userId)
        .eq("platform", platform);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-integrations"] });
      toast.success("Plataforma desconectada");
    },
    onError: () => toast.error("Erro ao desconectar"),
  });

  const getIntegration = (platform: string) =>
    integrations.find((i: any) => i.platform === platform);

  const currentPlatform = PLATFORMS.find((p) => p.key === connectDialog);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Integrações de Tráfego Pago</CardTitle>
          </div>
          <CardDescription>
            Conecte suas contas de anúncios para criar campanhas com 1 clique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PLATFORMS.map((platform) => {
            const integration = getIntegration(platform.key);
            const isConnected = !!integration?.is_active;

            return (
              <div
                key={platform.key}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{platform.name}</span>
                      {isConnected && (
                        <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-700">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isConnected
                        ? integration.account_name || "Conta conectada"
                        : platform.description}
                    </p>
                  </div>
                </div>

                {isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive"
                    onClick={() => disconnectMutation.mutate(platform.key)}
                    disabled={disconnectMutation.isPending}
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setConnectDialog(platform.key)}
                  >
                    <Plug className="h-3.5 w-3.5" />
                    Conectar
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!connectDialog} onOpenChange={(o) => !o && setConnectDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentPlatform?.icon} Conectar {currentPlatform?.name}
            </DialogTitle>
            <DialogDescription>
              O fluxo OAuth completo será ativado quando as credenciais da plataforma estiverem configuradas.
              Por enquanto, pode inserir um token de teste para validar a integração.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Conta</Label>
              <Input
                placeholder="Ex: Minha Loja Principal"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ID da Conta (opcional)</Label>
              <Input
                placeholder="Ex: act_123456789"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Token de Acesso (teste)</Label>
              <Input
                placeholder="Cole aqui o access_token"
                value={testToken}
                onChange={(e) => setTestToken(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => connectDialog && connectMutation.mutate({ platform: connectDialog })}
              disabled={connectMutation.isPending}
              className="gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              Conectar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
