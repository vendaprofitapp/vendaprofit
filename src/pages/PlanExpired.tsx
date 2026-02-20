import { Crown, AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import logoVendaProfit from "@/assets/logo-venda-profit.png";

export default function PlanExpired() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logoVendaProfit} alt="Venda PROFIT" className="h-16 w-16 rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-bold text-foreground">Venda PROFIT</h1>
        </div>

        {/* Card principal */}
        <Card className="border-destructive/30">
          <CardContent className="pt-6 pb-6 space-y-5 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Plano Expirado</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                O período do seu plano chegou ao fim. Para continuar usando o sistema, 
                entre em contato com o administrador para renovar ou fazer upgrade do seu plano.
              </p>
            </div>

            {/* Planos disponíveis */}
            <div className="space-y-2 text-left">
              <p className="text-sm font-semibold text-center mb-3">Planos disponíveis:</p>
              {[
                { name: "Basic Mensal", desc: "Funcionalidades essenciais de gestão", icon: "📦" },
                { name: "Basic Anual", desc: "Melhor custo para funcionalidades básicas", icon: "📦" },
                {
                  name: "Premium Mensal",
                  desc: "Todas as funcionalidades desbloqueadas",
                  icon: "👑",
                  highlight: true,
                },
                {
                  name: "Premium Anual",
                  desc: "Melhor custo com acesso completo",
                  icon: "👑",
                  highlight: true,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-lg border p-3 flex items-center gap-3 ${
                    plan.highlight
                      ? "border-yellow-400/40 bg-yellow-400/5"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <span className="text-lg">{plan.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                      {plan.name}
                      {plan.highlight && (
                        <Crown className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{plan.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Entre em contato com o administrador do sistema para reativar sua conta.
            </p>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair da conta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
