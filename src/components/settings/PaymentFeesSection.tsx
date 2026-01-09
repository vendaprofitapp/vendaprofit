import { useState, useEffect } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface PaymentFee {
  payment_method: string;
  fee_percent: number;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "debito", label: "Cartão Débito" },
  { value: "credito", label: "Cartão Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "credito_1x", label: "Cartão Crédito 1x" },
  { value: "credito_2x", label: "Cartão Crédito 2x" },
  { value: "credito_3x", label: "Cartão Crédito 3x" },
  { value: "credito_4x", label: "Cartão Crédito 4x" },
  { value: "credito_5x", label: "Cartão Crédito 5x" },
  { value: "credito_6x", label: "Cartão Crédito 6x" },
  { value: "credito_8x", label: "Cartão Crédito 8x" },
  { value: "credito_10x", label: "Cartão Crédito 10x" },
  { value: "credito_12x", label: "Cartão Crédito 12x" },
];

interface PaymentFeesSectionProps {
  userId: string;
}

export function PaymentFeesSection({ userId }: PaymentFeesSectionProps) {
  const queryClient = useQueryClient();
  const [fees, setFees] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFees();
  }, [userId]);

  const fetchFees = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_fees")
        .select("payment_method, fee_percent")
        .eq("owner_id", userId);

      if (error) throw error;

      const feesMap: Record<string, string> = {};
      PAYMENT_METHODS.forEach((pm) => {
        const existing = data?.find((f) => f.payment_method === pm.value);
        feesMap[pm.value] = existing ? String(existing.fee_percent) : "0";
      });
      setFees(feesMap);
    } catch (error) {
      console.error("Error fetching fees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert all fees
      const upsertData = PAYMENT_METHODS.map((pm) => ({
        owner_id: userId,
        payment_method: pm.value,
        fee_percent: Number(fees[pm.value]) || 0,
      }));

      // Delete existing and insert new
      await supabase.from("payment_fees").delete().eq("owner_id", userId);
      
      const { error } = await supabase.from("payment_fees").insert(upsertData);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["payment-fees-report", userId] });
      toast({ title: "Taxas salvas com sucesso!" });
    } catch (error: any) {
      toast({ 
        title: "Erro ao salvar taxas", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const updateFee = (method: string, value: string) => {
    // Only allow numbers and decimal point
    const sanitized = value.replace(/[^0-9.,]/g, "").replace(",", ".");
    setFees((prev) => ({ ...prev, [method]: sanitized }));
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">
            Taxas por Forma de Pagamento
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure as taxas/impostos aplicados a cada forma de pagamento
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PAYMENT_METHODS.map((pm) => (
          <div key={pm.value} className="grid gap-2">
            <Label htmlFor={`fee-${pm.value}`}>{pm.label}</Label>
            <div className="relative">
              <Input
                id={`fee-${pm.value}`}
                type="text"
                inputMode="decimal"
                value={fees[pm.value] || "0"}
                onChange={(e) => updateFee(pm.value, e.target.value)}
                className="pr-8"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                %
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Taxas
        </Button>
      </div>
    </div>
  );
}
