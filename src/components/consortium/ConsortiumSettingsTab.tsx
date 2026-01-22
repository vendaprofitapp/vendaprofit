import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, AlertTriangle, Truck, RefreshCw, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  consortiumId: string;
}

interface ConsortiumSettings {
  id: string;
  consortium_id: string;
  grace_period_days: number;
  penalty_money_pct: number;
  penalty_product_pct: number;
  shipping_policy: "first_free" | "all_paid" | "all_free";
  rebalance_mode: "manual" | "auto_distribute";
}

const defaultSettings: Omit<ConsortiumSettings, "id" | "consortium_id"> = {
  grace_period_days: 5,
  penalty_money_pct: 10,
  penalty_product_pct: 5,
  shipping_policy: "first_free",
  rebalance_mode: "manual",
};

export function ConsortiumSettingsTab({ consortiumId }: Props) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(defaultSettings);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["consortium-settings", consortiumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_settings")
        .select("*")
        .eq("consortium_id", consortiumId)
        .maybeSingle();
      if (error) throw error;
      return data as ConsortiumSettings | null;
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        grace_period_days: settings.grace_period_days,
        penalty_money_pct: settings.penalty_money_pct,
        penalty_product_pct: settings.penalty_product_pct,
        shipping_policy: settings.shipping_policy as "first_free" | "all_paid" | "all_free",
        rebalance_mode: settings.rebalance_mode as "manual" | "auto_distribute",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings) {
        const { error } = await supabase
          .from("consortium_settings")
          .update(formData)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consortium_settings").insert({
          consortium_id: consortiumId,
          ...formData,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consortium-settings", consortiumId] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Carência e Inadimplência */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Carência e Inadimplência
          </CardTitle>
          <CardDescription>
            Configure as regras para pagamentos em atraso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grace_period">Dias de Carência</Label>
            <Input
              id="grace_period"
              type="number"
              min={0}
              max={30}
              value={formData.grace_period_days}
              onChange={(e) =>
                setFormData({ ...formData, grace_period_days: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Dias após o vencimento antes de bloquear participação no sorteio
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Multas por Desistência */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Percent className="h-5 w-5 text-destructive" />
            Multas por Desistência
          </CardTitle>
          <CardDescription>
            Defina as porcentagens de multa ao encerrar cotas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="penalty_money">Multa (Devolução em Dinheiro)</Label>
              <div className="relative">
                <Input
                  id="penalty_money"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={formData.penalty_money_pct}
                  onChange={(e) =>
                    setFormData({ ...formData, penalty_money_pct: parseFloat(e.target.value) || 0 })
                  }
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Sobre o valor já pago
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="penalty_product">Multa (Troca por Roupa)</Label>
              <div className="relative">
                <Input
                  id="penalty_product"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={formData.penalty_product_pct}
                  onChange={(e) =>
                    setFormData({ ...formData, penalty_product_pct: parseFloat(e.target.value) || 0 })
                  }
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Multa menor incentiva troca por produtos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Política de Frete */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-blue-500" />
            Política de Frete
          </CardTitle>
          <CardDescription>
            Como o frete será tratado nas entregas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={formData.shipping_policy}
            onValueChange={(v: "first_free" | "all_paid" | "all_free") =>
              setFormData({ ...formData, shipping_policy: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first_free">Primeiro frete grátis pela loja</SelectItem>
              <SelectItem value="all_paid">Todos os fretes pagos pelo cliente</SelectItem>
              <SelectItem value="all_free">Todos os fretes grátis</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Reequilíbrio */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5 text-primary" />
            Regra de Extinção de Cota
          </CardTitle>
          <CardDescription>
            O que acontece quando um participante desiste
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={formData.rebalance_mode}
            onValueChange={(v: "manual" | "auto_distribute") =>
              setFormData({ ...formData, rebalance_mode: v })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual (ajustar manualmente)</SelectItem>
              <SelectItem value="auto_distribute">Rateio Automático (distribuir entre ativos)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            {formData.rebalance_mode === "auto_distribute"
              ? "O valor restante será distribuído automaticamente entre as parcelas pendentes dos demais participantes"
              : "Você precisará ajustar manualmente as parcelas após uma desistência"}
          </p>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full sm:w-auto gap-2"
        size="lg"
      >
        <Save className="h-4 w-4" />
        {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}
