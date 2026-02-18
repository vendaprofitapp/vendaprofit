import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, AlertCircle, Loader2 } from "lucide-react";

interface PartnerData {
  id: string;
  name: string;
  contact_name: string | null;
  cpf_cnpj: string | null;
  rack_commission_pct: number;
  pickup_commission_pct: number;
  payment_fee_pct: number;
  payment_receiver: string;
  allowed_payment_methods: any[] | null;
  replenishment_cycle_days: number | null;
  loss_risk_enabled: boolean;
  contract_accepted_at: string | null;
  owner_id: string;
}

interface StoreData {
  store_name: string;
}

interface ProfileData {
  cpf: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function PartnerContract() {
  const { token } = useParams<{ token: string }>();

  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [store, setStore] = useState<StoreData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    (async () => {
      const { data: pp, error: ppErr } = await supabase
        .from("partner_points")
        .select("id, name, contact_name, cpf_cnpj, rack_commission_pct, pickup_commission_pct, payment_fee_pct, payment_receiver, allowed_payment_methods, replenishment_cycle_days, loss_risk_enabled, contract_accepted_at, owner_id")
        .eq("contract_token", token)
        .maybeSingle();

      if (ppErr || !pp) { setNotFound(true); setLoading(false); return; }

      setPartner(pp as PartnerData);

      if (pp.contract_accepted_at) {
        setAccepted(true);
        setAcceptedAt(pp.contract_accepted_at);
        setLoading(false);
        return;
      }

      const [{ data: storeData }, { data: profileData }] = await Promise.all([
        supabase.from("store_settings").select("store_name").eq("owner_id", pp.owner_id).maybeSingle(),
        supabase.from("profiles").select("cpf").eq("id", pp.owner_id).maybeSingle(),
      ]);

      setStore(storeData as StoreData | null);
      setProfile(profileData as ProfileData | null);
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!agreementChecked || !token) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-partner-contract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ contract_token: token }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "Erro ao registrar aceite. Tente novamente.");
        setSubmitting(false);
        return;
      }

      setAccepted(true);
      setAcceptedAt(json.accepted_at);
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !partner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Contrato não encontrado</h1>
        <p className="text-muted-foreground text-sm max-w-xs">Este link é inválido ou expirou. Solicite um novo link à vendedora.</p>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Contrato assinado!</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          A parceria foi confirmada em <strong>{acceptedAt ? formatDate(acceptedAt) : "—"}</strong>.
          {partner.contact_name && <><br />Obrigado, <strong>{partner.contact_name}</strong>!</>}
        </p>
        <Badge variant="secondary" className="text-xs mt-2">✅ Registro eletrônico com data/hora e IP</Badge>
      </div>
    );
  }

  // Payment methods list
  const methods: any[] = Array.isArray(partner.allowed_payment_methods) ? partner.allowed_payment_methods : [];

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const storeName = store?.store_name ?? "—";
  const sellerDoc = profile?.cpf ?? "—";
  const partnerName = partner.name ?? "—";
  const partnerDoc = partner.cpf_cnpj ?? "—";
  const responsible = partner.contact_name ?? "—";
  const fmtPct = (v: number) => `${v}%`;
  const rackPct = fmtPct(partner.rack_commission_pct);
  const pickupPct = fmtPct(partner.pickup_commission_pct);
  const cycle = partner.replenishment_cycle_days ?? 30;
  const lossRisk = partner.loss_risk_enabled;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Termo de Parceria Comercial</h1>
            <p className="text-xs text-muted-foreground">Leia com atenção antes de assinar</p>
          </div>
        </div>

        {/* Contract body */}
        <div className="prose prose-sm max-w-none space-y-5 text-sm text-foreground">

          {/* Partes */}
          <section className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">As Partes</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground font-medium">Parceiro Fornecedor (Vendedora)</p>
                <p className="font-semibold">{storeName}</p>
                <p className="text-xs text-muted-foreground">CPF/CNPJ: {sellerDoc}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground font-medium">Ponto Parceiro (Local)</p>
                <p className="font-semibold">{partnerName}</p>
                <p className="text-xs text-muted-foreground">CPF/CNPJ: {partnerDoc}</p>
                <p className="text-xs text-muted-foreground">Responsável: {responsible}</p>
              </div>
            </div>
          </section>

          {/* Cláusula 1 */}
          <section className="space-y-2">
            <h2 className="font-bold text-base">Cláusula 1: O Objeto da Parceria</h2>
            <p>O Ponto Parceiro cede espaço em suas instalações para a exposição de produtos da Fornecedora (consignação física), bem como atua como Ponto de Retirada (Pick-up Point) para vendas online. Toda a gestão de estoque e auditoria será feita pelo sistema VENDA PROFIT.</p>
          </section>

          {/* Cláusula 2 */}
          <section className="space-y-2">
            <h2 className="font-bold text-base">Cláusula 2: Comissionamento Básico</h2>
            <p>As taxas de comissão acordadas para este Ponto Parceiro são:</p>
            <div className="rounded-lg border divide-y overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Venda na Arara Física</span>
                <span className="font-bold text-primary">{rackPct}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Ponto de Retirada (Encomendas)</span>
                <span className="font-bold text-primary">{pickupPct}</span>
              </div>
            </div>
          </section>

          {/* Cláusula 3 — condicional */}
          <section className="space-y-2">
            <h2 className="font-bold text-base">Cláusula 3: Fluxo de Pagamento e Taxas</h2>

            {partner.payment_receiver === "partner" ? (
              <div className="rounded-xl bg-accent/50 border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Pagamento ao Ponto Parceiro</p>
                <p>As vendas realizadas neste local serão recebidas diretamente pelo Ponto Parceiro (em seu próprio caixa/maquininha).</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Regras de Cobrança:</strong> O Ponto Parceiro tem total liberdade para definir quais métodos de pagamento aceitará do cliente final.</li>
                  <li><strong>Taxas de Transação:</strong> Quaisquer custos com taxas de maquininha, antecipação ou operadoras de cartão são de inteira responsabilidade do Ponto Parceiro.</li>
                  <li><strong>Acerto Final:</strong> O Ponto Parceiro reterá sua comissão e repassará à Fornecedora o valor restante. As taxas financeiras pagas pelo Ponto Parceiro não serão abatidas do montante devido à Fornecedora.</li>
                </ul>
              </div>
            ) : (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Pagamento à Vendedora (Self-Checkout)</p>
                <p>As vendas realizadas neste local serão recebidas diretamente pela Fornecedora através do aplicativo/link de pagamento. A taxa de cada método de pagamento será descontada do valor bruto antes do cálculo da comissão.</p>
                {methods.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Métodos aceitos e taxas aplicáveis:</p>
                    <div className="rounded-lg border overflow-hidden text-xs">
                      <div className="grid grid-cols-3 bg-muted/60 px-3 py-2 font-semibold text-muted-foreground">
                        <span>Método</span>
                        <span className="text-center">Taxa</span>
                        <span className="text-right">Valor Mínimo</span>
                      </div>
                      {methods.map((m, i) => (
                        <div key={i} className="grid grid-cols-3 px-3 py-2 border-t items-center">
                          <span className="text-foreground font-medium">{m.name}</span>
                          <span className="text-center font-bold text-primary">
                            {m.fee_percent > 0 ? `${m.fee_percent}%` : "Sem taxa"}
                          </span>
                          <span className="text-right text-muted-foreground">
                            {m.min_amount > 0 ? fmtBRL(m.min_amount) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Cláusula 4 */}
          <section className="space-y-2">
            <h2 className="font-bold text-base">Cláusula 4: Liberação de Peças e Segurança</h2>
            <p>Para não gerar desvio de função na equipe do local, o aluno fará a leitura do QR Code na arara. A recepção do Ponto Parceiro deve liberar a saída das roupas apenas quando o cliente apresentar a tela de liberação gerada pelo VENDA PROFIT (Passe Verde, Amarelo, Azul ou Roxo), ou mediante pagamento confirmado no caixa local (caso aplicável na Cláusula 3).</p>
          </section>

          {/* Cláusula 5 */}
          <section className="space-y-2">
            <h2 className="font-bold text-base">Cláusula 5: Ciclo de Acerto de Contas</h2>
            <p>A apuração dos resultados, reposição de estoque e o repasse financeiro ocorrerão a cada <strong>{cycle} dias</strong>. O sistema emitirá um extrato transparente de todas as vendas, separando valores brutos, taxas abatidas (se aplicável) e o lucro de cada parte.</p>
          </section>

          {/* Cláusula 6 */}
          <section className="space-y-2">
            <h2 className="font-bold text-base">Cláusula 6: Responsabilidade sobre o Estoque Físico</h2>
            <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${lossRisk ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40"}`}>
              <span className="text-xl mt-0.5">{lossRisk ? "⚠️" : "✅"}</span>
              <div>
                <p className="font-semibold text-sm">
                  O Ponto Parceiro {lossRisk ? "ASSUME" : "NÃO ASSUME"} a responsabilidade por furtos ou perdas
                </p>
                {lossRisk && (
                  <p className="text-xs text-muted-foreground mt-1">Se houver falta de peças no inventário, o Parceiro deverá ressarcir exclusivamente o <strong>Preço de Custo</strong> da peça (não o preço de venda), abatido no acerto do ciclo.</p>
                )}
              </div>
            </div>
          </section>

          {/* Cláusula 7 */}
          <section className="space-y-2">
            <h2 className="font-bold text-base">Cláusula 7: Encerramento</h2>
            <p>A parceria tem caráter comercial (sem vínculo societário) e pode ser encerrada por qualquer parte a qualquer momento. Em caso de rescisão, o acerto final e a devolução do estoque ocorrerão em até 5 dias úteis.</p>
          </section>

          {/* Legal note */}
          <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground">
            <strong>Validade Legal:</strong> O registro eletrônico de aceite (data/hora + IP) tem validade conforme a Lei nº 14.063/2020 sobre assinaturas eletrônicas. Não é necessário certificado ICP-Brasil para contratos comerciais de pequeno porte entre pessoas físicas e jurídicas.
          </div>
        </div>

        {/* Accept section */}
        <div className="mt-8 space-y-4 border-t pt-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={agreementChecked}
              onCheckedChange={(v) => setAgreementChecked(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground leading-snug">
              Li e compreendi todos os termos acima e aceito formalmente os termos desta Parceria Comercial com <strong>{storeName}</strong>.
            </span>
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={!agreementChecked || submitting}
            onClick={handleAccept}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Registrando aceite...</>
            ) : (
              "✅ Confirmar Aceite da Parceria"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Ao confirmar, sua localização IP e data/hora serão registrados como prova de aceite eletrônico.
          </p>
        </div>
      </div>
    </div>
  );
}
