import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Key, Send, CheckCircle, AlertCircle, Info, RefreshCw, XCircle, SkipForward, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BotconversaLog {
  id: string;
  event_type: string;
  owner_id: string;
  phone: string | null;
  message: string | null;
  status: string;
  error_message: string | null;
  botconversa_status: number | null;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  new_lead: "Novo Lead",
  cart_created: "Carrinho Criado",
  catalog_sale: "Venda pelo Catálogo",
  consignment_finalized: "Bolsa Finalizada",
};

const EVENT_ICONS: Record<string, string> = {
  new_lead: "🆕",
  cart_created: "🛒",
  catalog_sale: "🎉",
  consignment_finalized: "👜",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <CheckCircle className="h-3.5 w-3.5" /> Enviado
    </span>
  );
  if (status === "failed") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
      <XCircle className="h-3.5 w-3.5" /> Falhou
    </span>
  );
  if (status === "skipped") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <SkipForward className="h-3.5 w-3.5" /> Ignorado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Clock className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

export function BotconversaAdminSection() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [logs, setLogs] = useState<BotconversaLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from("botconversa_logs" as "botconversa_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs((data as BotconversaLog[]) || []);
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadLogs();
  }, [loadLogs]);

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const { data: settings } = await supabase
        .from("system_settings" as "system_settings")
        .select("key, value")
        .in("key", ["botconversa_enabled"]);

      if (settings) {
        const enabledRow = settings.find((s: { key: string; value: string | null }) => s.key === "botconversa_enabled");
        setEnabled(enabledRow?.value === "true");
      }

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
            name: "Teste do Sistema ✅",
            phone: adminPhone,
            created_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
      toast.success("Mensagem de teste enviada! Verifique seu WhatsApp.");
      // Refresh logs after a short delay
      setTimeout(() => loadLogs(), 1500);
    } catch (err) {
      console.error("Error sending test message:", err);
      toast.error("Erro ao enviar mensagem de teste.");
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

  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;
  const skippedCount = logs.filter((l) => l.status === "skipped").length;

  return (
    <div className="space-y-4">
      {/* Main config card */}
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
                    <li>Vá em <strong>Integrações → API</strong> e copie a API Key</li>
                    <li>No Lovable, acesse <strong>Cloud → Secrets</strong></li>
                    <li>Edite o secret <strong>BOTCONVERSA_API_KEY</strong> e cole o valor</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 bg-background">
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Secret <code className="bg-muted px-1 rounded text-xs">BOTCONVERSA_API_KEY</code> configurado</p>
                <p className="text-xs text-muted-foreground mt-0.5">Para alterar o valor, edite o secret em Cloud → Secrets.</p>
              </div>
            </div>
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
                <div key={evt.label} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-foreground bg-background">
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

      {/* Logs card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Histórico de Envios</CardTitle>
              <CardDescription className="mt-0.5">Últimos 50 disparos registrados pelo sistema</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Summary counters */}
              {logs.length > 0 && (
                <div className="hidden sm:flex items-center gap-3 text-xs mr-2">
                  <span className="text-primary font-medium">{successCount} enviados</span>
                  {failedCount > 0 && <span className="text-destructive font-medium">{failedCount} falhas</span>}
                  {skippedCount > 0 && <span className="text-muted-foreground">{skippedCount} ignorados</span>}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={loadLogs} disabled={loadingLogs}>
                <RefreshCw className={`h-4 w-4 ${loadingLogs ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loadingLogs ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando logs...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">Os logs aparecerão aqui quando eventos forem disparados.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id}>
                  <button
                    className="w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base leading-none">
                        {EVENT_ICONS[log.event_type] || "📬"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-foreground">
                            {EVENT_LABELS[log.event_type] || log.event_type}
                          </span>
                          {log.phone && (
                            <span className="text-xs text-muted-foreground truncate">→ {log.phone}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                      <StatusBadge status={log.status} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expandedLog === log.id && (
                    <div className="mx-1 mb-1 rounded-b-lg border border-t-0 bg-muted/20 px-3 py-2.5 space-y-2">
                      {log.botconversa_status && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Status HTTP:</span> {log.botconversa_status}
                        </p>
                      )}
                      {log.error_message && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-0.5">Erro / Resposta:</p>
                          <p className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1 font-mono break-all">
                            {log.error_message}
                          </p>
                        </div>
                      )}
                      {log.message && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-0.5">Mensagem enviada:</p>
                          <pre className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 whitespace-pre-wrap font-sans">
                            {log.message}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
