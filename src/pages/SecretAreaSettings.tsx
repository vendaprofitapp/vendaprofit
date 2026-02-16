import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function SecretAreaSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(false);
  const [name, setName] = useState("Área VIP");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: storeSettings, isLoading } = useQuery({
    queryKey: ["store-secret-area-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("id, secret_area_active, secret_area_name, secret_area_password")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (storeSettings) {
      setActive(storeSettings.secret_area_active ?? false);
      setName(storeSettings.secret_area_name || "Área VIP");
      setPassword(storeSettings.secret_area_password || "");
    }
  }, [storeSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!storeSettings?.id) throw new Error("Loja não encontrada");
      const { error } = await supabase
        .from("store_settings")
        .update({
          secret_area_active: active,
          secret_area_name: name || null,
          secret_area_password: password || null,
        })
        .eq("id", storeSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Área Secreta salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["store-secret-area-settings"] });
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
          Configure sua loja primeiro em "Minha Loja" antes de usar a Área Secreta.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="h-6 w-6 text-rose-500" />
            Área Secreta / VIP
          </h1>
          <p className="text-muted-foreground">Crie uma área exclusiva para produtos especiais</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/20 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-rose-500" />
                  Ativar Área Secreta na Loja
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativada, um botão aparecerá na loja para acessar produtos exclusivos
                </p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            {active && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="secret_area_name" className="font-medium">Nome do Botão</Label>
                    <Input
                      id="secret_area_name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Área VIP"
                    />
                    <p className="text-xs text-muted-foreground">Ex: "Clube VIP", "Exclusivo", "Área Secreta"</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret_area_password" className="font-medium">Senha de Acesso</Label>
                    <div className="relative">
                      <Input
                        id="secret_area_password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Digite a senha..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Ex: VIP2024, EXCLUSIVO</p>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border">
                  <Label className="font-medium mb-3 block">Prévia do Botão</Label>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {name || "Área VIP"}
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">💡 Como funciona:</p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• Marque produtos como "Secreto" 🔒 no seletor de marketing (ao editar produto/variação)</li>
                    <li>• Produtos secretos ficam invisíveis na listagem principal da loja</li>
                    <li>• O cliente clica no botão, digita a senha e vê os produtos exclusivos</li>
                    <li>• Use para clientes VIP, promoções secretas ou lançamentos exclusivos</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar Área Secreta"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
