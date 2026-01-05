import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Store, Bell, User, Shield } from "lucide-react";

export default function Settings() {
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
              <h3 className="text-lg font-semibold text-card-foreground">Dados da Loja</h3>
              <p className="text-sm text-muted-foreground">Informações básicas do estabelecimento</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="store-name">Nome da Loja</Label>
              <Input id="store-name" defaultValue="FitWear Store" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="store-email">Email</Label>
              <Input id="store-email" type="email" defaultValue="contato@fitwear.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="store-phone">Telefone</Label>
              <Input id="store-phone" defaultValue="(11) 99999-9999" />
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

        {/* User Settings */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <User className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Minha Conta</h3>
              <p className="text-sm text-muted-foreground">Dados do usuário administrador</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input id="user-name" defaultValue="Admin" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" defaultValue="admin@fitwear.com" />
            </div>
            <Button variant="outline" className="w-fit">
              Alterar Senha
            </Button>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl bg-card p-6 shadow-soft animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">Segurança</h3>
              <p className="text-sm text-muted-foreground">Configurações de acesso</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Autenticação em Dois Fatores</p>
                <p className="text-sm text-muted-foreground">Adicionar camada extra de segurança</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">Sessão Ativa</p>
                <p className="text-sm text-muted-foreground">Manter logado por 30 dias</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg">Salvar Alterações</Button>
        </div>
      </div>
    </MainLayout>
  );
}
