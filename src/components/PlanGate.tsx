import { useState } from "react";
import { Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlan } from "@/hooks/usePlan";

interface PlanGateProps {
  children: React.ReactNode;
  /** Se true, apenas usuários premium têm acesso. Basic e Trial ficam bloqueados. */
  requirePremium?: boolean;
}

const PREMIUM_PLANS = [
  {
    name: "Premium Mensal",
    price: "Consulte o administrador",
    description: "Acesso completo a todas as funcionalidades",
  },
  {
    name: "Premium Anual",
    price: "Consulte o administrador",
    description: "Melhor custo-benefício com acesso completo",
  },
];

const PREMIUM_FEATURES = [
  "Consórcios",
  "Bazar VIP",
  "Pontos Parceiros",
  "Redes Sociais / Google Ads",
  "Programa de Fidelidade",
  "Incentivos de Compra",
  "Área Secreta VIP",
  "Pedidos B2B",
];

export function PlanGate({ children, requirePremium = true }: PlanGateProps) {
  const { isPremium, loading } = usePlan();
  const [modalOpen, setModalOpen] = useState(false);

  // Admin e premium sempre passam
  if (loading || isPremium || !requirePremium) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Item bloqueado com opacidade e coroa */}
      <div
        className="relative cursor-pointer select-none"
        onClick={() => setModalOpen(true)}
        title="Funcionalidade Premium"
      >
        <div className="opacity-50 pointer-events-none">{children}</div>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 drop-shadow">
          <Crown className="h-4 w-4" style={{ fill: "hsl(48 96% 53%)", color: "hsl(48 96% 53%)" }} />
        </span>
      </div>

      {/* Modal de upgrade */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-5 w-5" style={{ fill: "hsl(48 96% 53%)", color: "hsl(48 96% 53%)" }} />
              Funcionalidade Premium
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Esta funcionalidade está disponível apenas nos planos Premium.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Funcionalidades exclusivas Premium:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PREMIUM_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Crown className="h-3 w-3 shrink-0" style={{ fill: "hsl(48 96% 53%)", color: "hsl(48 96% 53%)" }} />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Planos disponíveis:</p>
              {PREMIUM_PLANS.map((p) => (
                <div
                  key={p.name}
                  className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    {p.price}
                  </Badge>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Entre em contato com o administrador do sistema para fazer upgrade do seu plano.
            </p>

            <Button className="w-full" onClick={() => setModalOpen(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
