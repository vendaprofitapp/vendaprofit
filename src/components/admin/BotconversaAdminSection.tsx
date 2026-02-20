import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Key, Send, CheckCircle, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function BotconversaAdminSection() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      // Load botconversa_enabled from system_settings
      const { data: settings } = await supabase
        .from("system_settings" as "system_settings")
        .select("key, value")
        .in("key", ["botconversa_enabled"]);

      if (settings) {
        const enabledRow = settings.find((s: { key: string; value: string | null }) => s.key === "botconversa_enabled");
        setEnabled(enabledRow?.value === "true");
      }

      // Load admin phone
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", user.id)
          .single();
        setAdminPhone(profile?.phone || null);
      }
    } catch (err) {
      console.error("Error loading botconversa settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      // Save enabled toggle
      const { error: enabledError } = await supabase
        .from("system_settings" as "system_settings")
        .upsert({ key: "botconversa_enabled", value: enabled ? "true" : "false", updated_at: new Date().toISOString() });

      if (enabledError) throw enabledError;

      // Save API key via edge function if provided
      if (apiKey.trim()) {
        const { error: fnError } = await supabase.functions.invoke("botconversa-save-key", {
          body: { api_key: apiKey.trim() },
        });
        // If edge function doesn't exist yet, show instructions
        if (fnError) {
          toast.info("Configure a API Key nas configurações do servidor (BOTCONVERSA_API_KEY secret).");
        } else {
          setApiKey("");
          toast.success("API Key salva com segurança!");
        }
      } else {
        toast.success("Configurações salvas!");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(value: boolean) {
    setEnabled(value);
    try {
      await supabase
        .from("system_settings" as "system_settings")
        .upsert({ key: "botconversa_enabled", value: value ? "true" : "false", updated_at: new Date().toISOString() });
      toast.success(value ? "Notificações ativadas!" : "Notificações desativadas.");
    } catch (err) {
      console.error("Error toggling botconversa:", err);
      toast.error("Erro ao atualizar configuração.");
      setEnabled(!value);
    }
  }

  async function sendTestMessage() {
    if (!adminPhone) {
      toast.error("Você não tem telefone cadastrado no perfil. Cadastre em Configurações > Perfil.");
      return;
    }
    if (!user) return;

    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("botconversa-notify", {
        body: {
          event_type: "new_lead",
          owner_id: user.id,
          payload: {
            name: "Teste do Sistema",
            phone: adminPhone,
            created_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
      toast.success("Mensagem de teste enviada! Verifique seu WhatsApp.");
    } catch (err) {
      console.error("Error sending test message:", err);
      toast.error("Erro ao enviar mensagem de teste. Verifique se a API Key está configurada.");
    } finally {
      setTesting(false);
    }
  }

  if (loadingSettings) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Carregando configurações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Botconversa — WhatsApp Automático
              <Badge variant="outline" className={enabled ? "border-primary/40 text-primary bg-primary/10" : "border-muted-foreground/30 text-muted-foreground"}>
                {enabled ? "Ativo" : "Inativo"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Envia notificações automáticas via WhatsApp para as vendedoras quando eventos importantes acontecem.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
          <div>
            <p className="text-sm font-medium text-foreground">Ativar notificações WhatsApp</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quando ativo, todas as vendedoras com telefone cadastrado receberão as notificações.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggleEnabled} />
        </div>

        {/* API Key section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">API Key do Botconversa</Label>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-foreground">Como configurar a API Key:</p>
                <ol className="list-decimal ml-3 space-y-1 text-muted-foreground">
                  <li>Acesse o painel do Botconversa</li>
                  <li>Vá em <strong>Integrações → API</strong></li>
                  <li>Copie a sua API Key</li>
                  <li>Cole no campo abaixo e salve</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Cole aqui a API Key do Botconversa..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1"
            />
            <Button onClick={saveSettings} disabled={saving} variant="outline">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A chave é armazenada de forma segura e nunca fica exposta no código.
          </p>
        </div>

        {/* Events list */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Eventos monitorados</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: "Novo lead cadastrado", icon: "🆕" },
              { label: "Carrinho criado no catálogo", icon: "🛒" },
              { label: "Venda finalizada pelo catálogo", icon: "🎉" },
              { label: "Bolsa consignada finalizada", icon: "👜" },
            ].map((evt) => (
              <div
                key={evt.label}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-foreground bg-background"
              >
                <span>{evt.icon}</span>
                <span>{evt.label}</span>
                <CheckCircle className="h-3.5 w-3.5 text-primary ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Prerequisites */}
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium mb-1 text-foreground">Pré-requisito para as vendedoras</p>
              <p className="text-muted-foreground">
                Cada vendedora precisa ter o <strong>número de WhatsApp cadastrado no perfil</strong> (Configurações → Perfil → Telefone).
                Se o número estiver vazio, a notificação é ignorada silenciosamente.
              </p>
            </div>
          </div>
        </div>

        {/* Test message */}
        <div className="border-t pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Enviar mensagem de teste</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {adminPhone
                  ? `Será enviado para: ${adminPhone}`
                  : "⚠️ Cadastre seu telefone no perfil para testar."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestMessage}
              disabled={testing || !adminPhone || !enabled}
              className="shrink-0"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {testing ? "Enviando..." : "Testar agora"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
