import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Store, Bell, User, Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AISettingsSection } from "@/components/settings/AISettingsSection";
import { CustomPaymentMethodsSection } from "@/components/settings/CustomPaymentMethodsSection";
import { PaymentRemindersSection } from "@/components/settings/PaymentRemindersSection";

export default function Settings() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Fetch user profile with AI settings
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, preferred_ai_provider, gemini_api_key, openai_api_key")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { full_name?: string; phone?: string; store_name?: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({ title: "Dados atualizados com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar dados", description: error.message, variant: "destructive" });
    },
  });

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Preencha todos os campos de senha", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "A nova senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast({ title: "Senha alterada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveProfile = () => {
    const storeName = (document.getElementById("store-name") as HTMLInputElement)?.value;
    const userName = (document.getElementById("user-name") as HTMLInputElement)?.value;
    const phone = (document.getElementById("store-phone") as HTMLInputElement)?.value;
    
    updateProfileMutation.mutate({
      store_name: storeName,
      full_name: userName,
      phone: phone,
    });
  };

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as preferências do sistema</p>
      </div>

      <div className="grid gap-6 max-w-3xl">
        {/* Store Settings */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Dados da Loja ou Vendedora</h3>
              <p className="text-sm text-muted-foreground">Informações básicas do estabelecimento</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="store-name">Nome da Loja/Vendedora</Label>
              <Input id="store-name" defaultValue={profile?.store_name || ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="store-email">Email</Label>
              <Input id="store-email" type="email" value={user?.email || ""} disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="store-phone">Telefone</Label>
              <Input id="store-phone" defaultValue={profile?.phone || ""} placeholder="(11) 99999-9999" />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Bell className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Notificações</h3>
              <p className="text-sm text-muted-foreground">Configure alertas do sistema</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Alerta de Estoque Baixo</p>
                <p className="text-sm text-muted-foreground">Notificar quando produto estiver abaixo do mínimo</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Nova Venda</p>
                <p className="text-sm text-muted-foreground">Receber notificação a cada venda</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Relatório Diário</p>
                <p className="text-sm text-muted-foreground">Resumo de vendas por email</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        {/* Payment Reminders - Show pending deferred payments */}
        {user?.id && <PaymentRemindersSection userId={user.id} />}

        {/* Custom Payment Methods Settings */}
        {user?.id && <CustomPaymentMethodsSection userId={user.id} />}

        {/* AI Settings */}
        {user?.id && (
          <AISettingsSection 
            userId={user.id}
            profile={profile} 
            onUpdate={() => refetchProfile()} 
          />
        )}

        {/* User Settings */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <User className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Minha Conta</h3>
              <p className="text-sm text-muted-foreground">Dados do usuário</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Nome Completo</Label>
              <Input id="user-name" defaultValue={profile?.full_name || ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" value={user?.email || ""} disabled className="bg-muted" />
            </div>
          </div>
        </div>

        {/* Password Change */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Alterar Senha</h3>
              <p className="text-sm text-muted-foreground">Atualize sua senha de acesso</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-fit"
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar Senha
            </Button>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Segurança</h3>
              <p className="text-sm text-muted-foreground">Configurações de acesso</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Sessão Atual</p>
                <p className="text-sm text-muted-foreground">Logado como {user?.email}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={signOut}>
                Sair
              </Button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
