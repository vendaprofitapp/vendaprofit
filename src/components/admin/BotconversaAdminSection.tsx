import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, CheckCircle, AlertCircle, Info, RefreshCw, XCircle, SkipForward, Clock, Link2, Save } from "lucide-react";
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

const WEBHOOK_EVENTS = [
  {
    key: "botconversa_webhook_new_lead",
    label: "Webhook: Novo Lead",
    icon: "🆕",
    description: "Disparado quando um novo lead se cadastra pelo catálogo.",
    variables: "{{phone}}, {{name}}, {{created_at}}",
  },
  {
    key: "botconversa_webhook_cart_created",
    label: "Webhook: Carrinho Criado",
    icon: "🛒",
    description: "Disparado quando um lead adiciona um produto ao carrinho.",
    variables: "{{phone}}, {{lead_name}}, {{product_name}}, {{quantity}}, {{unit_price}}, {{selected_size}}, {{variant_color}}",
  },
  {
    key: "botconversa_webhook_catalog_sale",
    label: "Webhook: Venda pelo Catálogo",
    icon: "🎉",
    description: "Disparado quando uma venda é finalizada pelo catálogo.",
    variables: "{{phone}}, {{customer_name}}, {{customer_phone}}, {{total}}, {{payment_method}}",
  },
  {
    key: "botconversa_webhook_consignment_finalized",
    label: "Webhook: Bolsa Finalizada",
    icon: "👜",
    description: "Disparado quando uma cliente finaliza as escolhas na bolsa.",
    variables: "{{phone}}, {{customer_name}}, {{customer_phone}}",
  },
];

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
  const [testPhone, setTestPhone] = useState("");
  const [logs, setLogs] = useState<BotconversaLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
  const [savingWebhooks, setSavingWebhooks] = useState(false);

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
      const allKeys = ["botconversa_enabled", ...WEBHOOK_EVENTS.map((e) => e.key)];
      const { data: settings } = await supabase
        .from("system_settings" as "system_settings")
        .select("key, value")
        .in("key", allKeys);

      if (settings) {
        const enabledRow = settings.find((s: { key: string; value: string | null }) => s.key === "botconversa_enabled");
        setEnabled(enabledRow?.value === "true");

        const urls: Record<string, string> = {};
        for (const evt of WEBHOOK_EVENTS) {
          const row = settings.find((s: { key: string; value: string | null }) => s.key === evt.key);
          urls[evt.key] = row?.value || "";
        }
        setWebhookUrls(urls);
      }

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", user.id)
          .single();
        setTestPhone(profile?.phone || "");
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

  async function saveWebhookUrls() {
    setSavingWebhooks(true);
    try {
      const upserts = WEBHOOK_EVENTS.map((evt) => ({
        key: evt.key,
        value: webhookUrls[evt.key]?.trim() || "",
        updated_at: new Date().toISOString(),
      }));

      for (const row of upserts) {
        await supabase
          .from("system_settings" as "system_settings")
          .upsert(row);
      }

      toast.success("URLs dos webhooks salvas com sucesso!");
    } catch (err) {
      console.error("Error saving webhook URLs:", err);
      toast.error("Erro ao salvar URLs dos webhooks.");
    } finally {
      setSavingWebhooks(false);
    }
  }

  async function sendTestMessage() {
    if (!testPhone.trim()) {
      toast.error("Digite um número de telefone para enviar o teste.");
      return;
    }
    if (!user) return;

    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("botconversa-notify", {
        body: {
          event_type: "new_lead",
          owner_id: user.id,
          test_phone: testPhone.trim(),
          payload: {
            name: "Teste do Sistema ✅",
            phone: testPhone.trim(),
            created_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
      toast.success("Teste enviado! Verifique se o fluxo foi disparado no Botconversa.");
      setTimeout(() => loadLogs(), 1500);
    } catch (err) {
      console.error("Error sending test message:", err);
      toast.error("Erro ao enviar teste.");
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
  const configuredCount = WEBHOOK_EVENTS.filter((e) => webhookUrls[e.key]?.trim()).length;

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
                Envia notificações automáticas via WhatsApp usando webhooks do Botconversa.
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
                Quando ativo, os webhooks configurados abaixo serão chamados a cada evento.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} />
          </div>

          {/* Setup instructions */}
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-foreground">Como configurar:</p>
                <ol className="list-decimal ml-3 space-y-1 text-muted-foreground">
                  <li>No Botconversa, crie um <strong>Fluxo</strong> para cada evento (ex: "Notificação Novo Lead")</li>
                  <li>Adicione um bloco de entrada tipo <strong>"Webhook"</strong> no fluxo</li>
                  <li>Copie a <strong>URL gerada</strong> e cole no campo correspondente abaixo</li>
                  <li>Configure as mensagens no fluxo usando as variáveis recebidas (ex: {"{{name}}"}, {"{{phone}}"})</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Webhook URL fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">URLs dos Webhooks</Label>
              </div>
              <Badge variant="secondary" className="text-xs">
                {configuredCount}/{WEBHOOK_EVENTS.length} configurados
              </Badge>
            </div>

            {WEBHOOK_EVENTS.map((evt) => (
              <div key={evt.key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{evt.icon}</span>
                  <Label className="text-xs font-medium">{evt.label}</Label>
                  {webhookUrls[evt.key]?.trim() && (
                    <CheckCircle className="h-3 w-3 text-primary" />
                  )}
                </div>
                <Input
                  type="url"
                  placeholder="https://backend.botconversa.com.br/api/v1/webhook/..."
                  value={webhookUrls[evt.key] || ""}
                  onChange={(e) => setWebhookUrls((prev) => ({ ...prev, [evt.key]: e.target.value }))}
                  className="text-xs"
                />
                <p className="text-xs text-muted-foreground pl-1">
                  {evt.description} — Variáveis: <code className="bg-muted px-1 rounded text-xs">{evt.variables}</code>
                </p>
              </div>
            ))}

            <Button onClick={saveWebhookUrls} disabled={savingWebhooks} size="sm" className="w-full sm:w-auto">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {savingWebhooks ? "Salvando..." : "Salvar URLs"}
            </Button>
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
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Enviar teste (webhook Novo Lead)</p>
            <p className="text-xs text-muted-foreground">
              Dispara o webhook de "Novo Lead" com o número abaixo para validar se o fluxo está funcionando.
            </p>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="Ex: 11999990000"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={sendTestMessage}
                disabled={testing || !testPhone.trim() || !enabled}
                className="shrink-0"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {testing ? "Enviando..." : "Testar agora"}
              </Button>
            </div>
            {!enabled && (
              <p className="text-xs text-muted-foreground">⚠️ Ative as notificações acima para poder testar.</p>
            )}
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
                          <p className="text-xs font-medium text-foreground mb-0.5">Payload enviado:</p>
                          <pre className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 whitespace-pre-wrap font-mono break-all">
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
