import { useState, useEffect } from "react";
import { Truck, Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ShippingSettingsSectionProps {
  userId: string;
  profile: {
    origin_zip?: string | null;
    melhor_envio_token?: string | null;
    superfrete_token?: string | null;
  } | null;
  onUpdate: () => void;
}

export function ShippingSettingsSection({ userId, profile, onUpdate }: ShippingSettingsSectionProps) {
  const [originZip, setOriginZip] = useState(profile?.origin_zip || "");
  const [melhorEnvioToken, setMelhorEnvioToken] = useState(profile?.melhor_envio_token || "");
  const [superfreteToken, setSuperfreteToken] = useState(profile?.superfrete_token || "");
  const [showMelhorEnvio, setShowMelhorEnvio] = useState(false);
  const [showSuperfrete, setShowSuperfrete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setOriginZip(profile.origin_zip || "");
      setMelhorEnvioToken(profile.melhor_envio_token || "");
      setSuperfreteToken(profile.superfrete_token || "");
    }
  }, [profile]);

  const maskToken = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 4) + "•".repeat(Math.min(key.length - 8, 20)) + key.substring(key.length - 4);
  };

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) {
      return digits.slice(0, 5) + "-" + digits.slice(5);
    }
    return digits;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          origin_zip: originZip.replace(/\D/g, "") || null,
          melhor_envio_token: melhorEnvioToken || null,
          superfrete_token: superfreteToken || null,
        } as any)
        .eq("id", userId);

      if (error) throw error;

      toast({ title: "Configurações de frete salvas com sucesso!" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Integração de Frete</h3>
          <p className="text-sm text-muted-foreground">
            Configure seus tokens para cotação automática de frete
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* CEP de Origem */}
        <div className="space-y-2">
          <Label htmlFor="origin-zip">CEP de Origem</Label>
          <Input
            id="origin-zip"
            value={formatCep(originZip)}
            onChange={(e) => setOriginZip(e.target.value)}
            placeholder="00000-000"
            maxLength={9}
          />
          <p className="text-xs text-muted-foreground">
            CEP de onde saem seus produtos para cálculo de frete.
          </p>
        </div>

        {/* Melhor Envio Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="melhor-envio-token">Token do Melhor Envio</Label>
            <a
              href="https://melhorenvio.com.br/painel/gerenciar/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Obter token <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative">
            <Input
              id="melhor-envio-token"
              type={showMelhorEnvio ? "text" : "password"}
              value={showMelhorEnvio ? melhorEnvioToken : maskToken(melhorEnvioToken)}
              onChange={(e) => setMelhorEnvioToken(e.target.value)}
              placeholder="Cole seu token do Melhor Envio..."
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowMelhorEnvio(!showMelhorEnvio)}
            >
              {showMelhorEnvio ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Agrega Correios, Jadlog, Azul Cargo e outras transportadoras.
          </p>
        </div>

        {/* SuperFrete Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="superfrete-token">Token do SuperFrete</Label>
            <a
              href="https://web.superfrete.com/#/integracoes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Obter token <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative">
            <Input
              id="superfrete-token"
              type={showSuperfrete ? "text" : "password"}
              value={showSuperfrete ? superfreteToken : maskToken(superfreteToken)}
              onChange={(e) => setSuperfreteToken(e.target.value)}
              placeholder="Cole seu token do SuperFrete..."
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowSuperfrete(!showSuperfrete)}
            >
              {showSuperfrete ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Agrega Correios, Jadlog e outras transportadoras com desconto.
          </p>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configurações de Frete
        </Button>
      </div>
    </div>
  );
}
