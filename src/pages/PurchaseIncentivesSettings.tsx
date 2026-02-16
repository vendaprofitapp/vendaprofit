import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CreditCard, Plus, Trash2, Gift, Truck, Star, Crown } from "lucide-react";
import { type PurchaseIncentivesConfig, type IncentiveTier, defaultIncentivesConfig } from "@/components/catalog/PurchaseIncentives";

export default function PurchaseIncentivesSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<PurchaseIncentivesConfig>(defaultIncentivesConfig);

  const { data: storeSettings, isLoading } = useQuery({
    queryKey: ["store-incentives-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("id, purchase_incentives_config")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (storeSettings?.purchase_incentives_config) {
      setConfig(storeSettings.purchase_incentives_config as unknown as PurchaseIncentivesConfig);
    }
  }, [storeSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!storeSettings?.id) throw new Error("Loja não encontrada");
      const { error } = await supabase
        .from("store_settings")
        .update({ purchase_incentives_config: JSON.parse(JSON.stringify(config)) })
        .eq("id", storeSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incentivos salvos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["store-incentives-settings"] });
    },
    onError: (error: any) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!storeSettings) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">
          Configure sua loja primeiro em "Minha Loja" antes de usar os incentivos.
        </div>
      </MainLayout>
    );
  }

  const emojiOptions = [
    { value: "truck", label: "🚚" },
    { value: "gift", label: "🎁" },
    { value: "star", label: "⭐" },
    { value: "crown", label: "👑" },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-emerald-500" />
            Incentivos de Compra
          </h1>
          <p className="text-muted-foreground">Configure parcelamento, desconto PIX e faixas de benefícios</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Toggle ativação */}
            <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  Ativar Incentivos de Compra
                </Label>
                <p className="text-sm text-muted-foreground">
                  Mostra parcelamento, PIX e barra de progresso no carrinho
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
              />
            </div>

            {config.enabled && (
              <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                {/* Parcelamento */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">💳 Parcelamento</Label>
                    <Switch
                      checked={config.installments.enabled}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        installments: { ...prev.installments, enabled: checked }
                      }))}
                    />
                  </div>
                  {config.installments.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Máx. parcelas</Label>
                        <Input
                          type="number" min={2} max={12}
                          value={config.installments.max_installments}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            installments: { ...prev.installments, max_installments: parseInt(e.target.value) || 3 }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Valor mín. por parcela (R$)</Label>
                        <Input
                          type="number" min={1}
                          value={config.installments.min_amount_per_installment}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            installments: { ...prev.installments, min_amount_per_installment: parseInt(e.target.value) || 30 }
                          }))}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <Checkbox
                          checked={config.installments.no_interest}
                          onCheckedChange={(checked) => setConfig(prev => ({
                            ...prev,
                            installments: { ...prev.installments, no_interest: !!checked }
                          }))}
                        />
                        <Label className="text-sm">Sem juros</Label>
                      </div>
                    </div>
                  )}
                </div>

                {/* PIX */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">💰 Desconto PIX</Label>
                    <Switch
                      checked={config.pix_discount.enabled}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        pix_discount: { ...prev.pix_discount, enabled: checked }
                      }))}
                    />
                  </div>
                  {config.pix_discount.enabled && (
                    <div className="space-y-2 max-w-xs">
                      <Label className="text-xs">Percentual de desconto (%)</Label>
                      <Input
                        type="number" min={1} max={30}
                        value={config.pix_discount.discount_percent}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          pix_discount: { ...prev.pix_discount, discount_percent: parseInt(e.target.value) || 5 }
                        }))}
                      />
                    </div>
                  )}
                </div>

                {/* Faixas */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <Label className="font-medium">🎁 Faixas de Benefícios</Label>
                  <p className="text-xs text-muted-foreground">
                    Configure faixas de valor do carrinho e os benefícios correspondentes
                  </p>
                  <div className="space-y-3">
                    {config.tiers.map((tier, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                        <select
                          value={tier.emoji}
                          onChange={(e) => {
                            const newTiers = [...config.tiers];
                            newTiers[index] = { ...newTiers[index], emoji: e.target.value };
                            setConfig(prev => ({ ...prev, tiers: newTiers }));
                          }}
                          className="w-16 h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {emojiOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <div className="flex-shrink-0 w-24">
                          <Input
                            type="number" min={1} placeholder="R$"
                            value={tier.min_value}
                            onChange={(e) => {
                              const newTiers = [...config.tiers];
                              newTiers[index] = { ...newTiers[index], min_value: parseInt(e.target.value) || 0 };
                              setConfig(prev => ({ ...prev, tiers: newTiers }));
                            }}
                            className="h-9"
                          />
                        </div>
                        <Input
                          placeholder="Benefício"
                          value={tier.benefit}
                          onChange={(e) => {
                            const newTiers = [...config.tiers];
                            newTiers[index] = { ...newTiers[index], benefit: e.target.value };
                            setConfig(prev => ({ ...prev, tiers: newTiers }));
                          }}
                          className="h-9 flex-1"
                        />
                        <Button
                          variant="ghost" size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => {
                            const newTiers = config.tiers.filter((_, i) => i !== index);
                            setConfig(prev => ({ ...prev, tiers: newTiers }));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      tiers: [...prev.tiers, { min_value: 0, benefit: "", emoji: "gift" }]
                    }))}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Faixa
                  </Button>
                </div>

                {/* Mensagens */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <Label className="font-medium">💬 Mensagens Personalizadas</Label>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Ao adicionar produto</Label>
                      <Input
                        value={config.messages.on_add}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          messages: { ...prev.messages, on_add: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Perto do frete grátis <span className="text-emerald-500">(use {"${remaining}"} para o valor restante)</span>
                      </Label>
                      <Input
                        value={config.messages.near_free_shipping}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          messages: { ...prev.messages, near_free_shipping: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Desbloqueou frete grátis</Label>
                      <Input
                        value={config.messages.unlocked_free_shipping}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          messages: { ...prev.messages, unlocked_free_shipping: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Desbloqueou brinde</Label>
                      <Input
                        value={config.messages.unlocked_gift}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          messages: { ...prev.messages, unlocked_gift: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar Incentivos"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
