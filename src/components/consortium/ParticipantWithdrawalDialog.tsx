import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, DollarSign, ShoppingBag, Calculator, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  participantId: string;
  participantName: string;
  consortiumId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConsortiumSettings {
  grace_period_days: number;
  penalty_money_pct: number;
  penalty_product_pct: number;
  rebalance_mode: "manual" | "auto_distribute";
}

interface PaymentSummary {
  totalPaid: number;
  totalPending: number;
}

export function ParticipantWithdrawalDialog({
  participantId,
  participantName,
  consortiumId,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const [withdrawalType, setWithdrawalType] = useState<"money" | "product">("product");
  const [shouldExtinguish, setShouldExtinguish] = useState(false);

  // Buscar configurações do consórcio
  const { data: settings } = useQuery({
    queryKey: ["consortium-settings", consortiumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_settings")
        .select("*")
        .eq("consortium_id", consortiumId)
        .maybeSingle();
      if (error) throw error;
      return (data || {
        grace_period_days: 5,
        penalty_money_pct: 10,
        penalty_product_pct: 5,
        rebalance_mode: "manual",
      }) as ConsortiumSettings;
    },
    enabled: open,
  });

  // Buscar pagamentos do participante
  const { data: paymentSummary } = useQuery({
    queryKey: ["participant-payment-summary", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortium_payments")
        .select("amount, is_paid")
        .eq("participant_id", participantId);
      if (error) throw error;

      const totalPaid = data.filter((p) => p.is_paid).reduce((sum, p) => sum + Number(p.amount), 0);
      const totalPending = data.filter((p) => !p.is_paid).reduce((sum, p) => sum + Number(p.amount), 0);

      return { totalPaid, totalPending } as PaymentSummary;
    },
    enabled: open,
  });

  const penaltyPct = withdrawalType === "money" 
    ? (settings?.penalty_money_pct || 10) 
    : (settings?.penalty_product_pct || 5);
  
  const penaltyAmount = ((paymentSummary?.totalPaid || 0) * penaltyPct) / 100;
  const finalBalance = (paymentSummary?.totalPaid || 0) - penaltyAmount;

  interface WithdrawalResult {
    success: boolean;
    error?: string;
    total_paid: number;
    penalty_amount: number;
    final_balance: number;
    withdrawal_type: string;
  }

  const withdrawalMutation = useMutation({
    mutationFn: async (): Promise<WithdrawalResult> => {
      // 1. Processar a desistência usando a função do banco
      const { data: result, error } = await supabase.rpc("process_consortium_withdrawal", {
        _participant_id: participantId,
        _withdrawal_type: withdrawalType,
        _penalty_pct: penaltyPct,
      });

      if (error) throw error;
      
      const typedResult = result as unknown as WithdrawalResult;
      if (!typedResult.success) throw new Error(typedResult.error || "Unknown error");

      // 2. Se deve extinguir a cota e o modo é automático, rebalancear
      if (shouldExtinguish && settings?.rebalance_mode === "auto_distribute") {
        const remainingUnpaid = paymentSummary?.totalPending || 0;
        
        if (remainingUnpaid > 0) {
          const { error: rebalanceError } = await supabase.rpc("rebalance_consortium_installments", {
            _consortium_id: consortiumId,
            _withdrawn_participant_id: participantId,
            _remaining_unpaid: remainingUnpaid,
          });

          if (rebalanceError) {
            console.error("Rebalance error:", rebalanceError);
            // Não falha a operação principal, apenas loga o erro
          }
        }
      }

      return typedResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["consortium-participants", consortiumId] });
      queryClient.invalidateQueries({ queryKey: ["consortium-payments"] });
      onOpenChange(false);

      if (withdrawalType === "money") {
        toast.success(
          `Desistência processada! Valor a devolver: R$ ${result.final_balance.toFixed(2)} (multa: R$ ${result.penalty_amount.toFixed(2)})`
        );
      } else {
        toast.success(
          `Desistência processada! Saldo disponível para produtos: R$ ${result.final_balance.toFixed(2)}`
        );
      }
    },
    onError: (error) => {
      toast.error("Erro ao processar desistência: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Encerrar Cota
          </DialogTitle>
          <DialogDescription>
            Processando desistência de <strong>{participantName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo Financeiro */}
          <Card className="bg-muted">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total já pago:</span>
                <span className="font-medium">R$ {(paymentSummary?.totalPaid || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Parcelas pendentes:</span>
                <span className="font-medium">R$ {(paymentSummary?.totalPending || 0).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tipo de Devolução */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Tipo de Devolução</Label>
            <RadioGroup
              value={withdrawalType}
              onValueChange={(v) => setWithdrawalType(v as "money" | "product")}
              className="grid gap-3"
            >
              <label
                htmlFor="money"
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  withdrawalType === "money"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="money" id="money" />
                <DollarSign className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium">Devolução em Dinheiro</p>
                  <p className="text-xs text-muted-foreground">
                    Multa de {settings?.penalty_money_pct || 10}%
                  </p>
                </div>
              </label>

              <label
                htmlFor="product"
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  withdrawalType === "product"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="product" id="product" />
                <ShoppingBag className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Converter em Crédito para Roupas</p>
                  <p className="text-xs text-muted-foreground">
                    Multa de {settings?.penalty_product_pct || 5}% (recomendado)
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Cálculo da Multa */}
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">Cálculo</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Valor pago:</span>
                  <span>R$ {(paymentSummary?.totalPaid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Multa ({penaltyPct}%):</span>
                  <span>- R$ {penaltyAmount.toFixed(2)}</span>
                </div>
                <hr className="my-2 border-destructive/20" />
                <div className="flex justify-between font-bold text-lg">
                  <span>{withdrawalType === "money" ? "A devolver:" : "Saldo final:"}</span>
                  <span className={withdrawalType === "product" ? "text-primary" : "text-green-500"}>
                    R$ {finalBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opção de Extinção de Cota */}
          {settings?.rebalance_mode === "auto_distribute" && (paymentSummary?.totalPending || 0) > 0 && (
            <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
              <input
                type="checkbox"
                checked={shouldExtinguish}
                onChange={(e) => setShouldExtinguish(e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <span className="font-medium">Extinguir Cota (Rateio Automático)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {(paymentSummary?.totalPending || 0).toFixed(2)} será distribuído entre os demais participantes ativos
                </p>
              </div>
            </label>
          )}

          {/* Ações */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => withdrawalMutation.mutate()}
              disabled={withdrawalMutation.isPending}
              className="flex-1"
            >
              {withdrawalMutation.isPending ? "Processando..." : "Confirmar Desistência"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
