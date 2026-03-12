import { useEffect, useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { ShieldCheck, Users, Search, Crown, Clock, CheckCircle, XCircle, Settings, MessageCircle, Percent, UserPlus, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { HubFeesManager } from "@/components/admin/HubFeesManager";
import { BackupSection } from "@/components/admin/BackupSection";
import { BotconversaAdminSection } from "@/components/admin/BotconversaAdminSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: "admin" | "user";
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  expires_at: string;
  product_count_limit: number | null;
  onboarding_completed: boolean;
  notes: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  trial: "Teste 5 Dias",
  basic_monthly: "Basic Mensal",
  basic_annual: "Basic Anual",
  premium_monthly: "Premium Mensal",
  premium_annual: "Premium Anual",
};

const PLAN_COLORS: Record<string, string> = {
  trial: "bg-orange-500/15 text-orange-600 border-orange-300",
  basic_monthly: "bg-blue-500/15 text-blue-600 border-blue-300",
  basic_annual: "bg-blue-600/15 text-blue-700 border-blue-400",
  premium_monthly: "bg-yellow-500/15 text-yellow-700 border-yellow-400",
  premium_annual: "bg-yellow-600/15 text-yellow-800 border-yellow-500",
};

function getPlanTier(planType: string) {
  if (planType === "trial") return "trial";
  if (planType.startsWith("basic")) return "basic";
  return "premium";
}

function PlanBadge({ planType }: { planType: string }) {
  const label = PLAN_LABELS[planType] ?? planType;
  const colorClass = PLAN_COLORS[planType] ?? "bg-muted text-muted-foreground";
  const tier = getPlanTier(planType);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
      {tier === "premium" && <Crown className="h-3 w-3" style={{ fill: "hsl(48 96% 53%)", color: "hsl(48 96% 53%)" }} />}
      {label}
    </span>
  );
}

function AdminFullAccessBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border-primary/30">
      <ShieldCheck className="h-3 w-3" />
      Acesso Total
    </span>
  );
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const now = new Date();
  const exp = new Date(expiresAt);
  const days = differenceInDays(exp, now);
  const expired = exp < now;

  if (expired) return (
    <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
      <XCircle className="h-3.5 w-3.5" /> Expirado
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
      <Clock className="h-3.5 w-3.5" /> Expira em {days}d
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle className="h-3.5 w-3.5" /> {format(exp, "dd/MM/yyyy", { locale: ptBR })}
    </span>
  );
}

export default function AdminUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedSub, setSelectedSub] = useState<UserSubscription | null>(null);
  const [planForm, setPlanForm] = useState({
    plan_type: "premium_monthly",
    expires_at: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // New user dialog state
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ full_name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!data);
      if (!data) {
        toast.error("Você não tem permissão para acessar esta página.");
        navigate("/");
      }
    }
    checkAdmin();
  }, [user, navigate]);

  useEffect(() => {
    async function fetchData() {
      if (!isAdmin) return;
      setLoading(true);
      const [profilesRes, rolesRes, subsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_subscriptions").select("*"),
      ]);
      setProfiles((profilesRes.data as Profile[]) || []);
      setRoles((rolesRes.data as UserRole[]) || []);
      setSubscriptions((subsRes.data as UserSubscription[]) || []);
      setLoading(false);
    }
    fetchData();
  }, [isAdmin]);

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    const lower = search.toLowerCase();
    return profiles.filter(
      (p) => p.full_name.toLowerCase().includes(lower) || p.email.toLowerCase().includes(lower)
    );
  }, [profiles, search]);

  const isUserAdmin = (userId: string) => roles.some((r) => r.user_id === userId && r.role === "admin");
  const getSubscription = (userId: string) => subscriptions.find((s) => s.user_id === userId);

  // Summary counts
  const summary = useMemo(() => {
    const now = new Date();
    return subscriptions.reduce(
      (acc, s) => {
        const expired = new Date(s.expires_at) < now;
        if (expired) { acc.expired++; return acc; }
        if (s.plan_type === "trial") acc.trial++;
        else if (s.plan_type.startsWith("basic")) acc.basic++;
        else acc.premium++;
        return acc;
      },
      { trial: 0, basic: 0, premium: 0, expired: 0 }
    );
  }, [subscriptions]);

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (togglingUser) return;
    setTogglingUser(userId);
    if (currentlyAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) toast.error("Erro ao remover admin");
      else { setRoles((prev) => prev.filter((r) => !(r.user_id === userId && r.role === "admin"))); toast.success("Papel de admin removido"); }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) toast.error("Erro ao definir admin");
      else { setRoles((prev) => [...prev, { user_id: userId, role: "admin" }]); toast.success("Usuário agora é admin"); }
    }
    setTogglingUser(null);
  };

  const openDrawer = (profile: Profile) => {
    const sub = getSubscription(profile.id);
    setSelectedProfile(profile);
    setSelectedSub(sub ?? null);
    setPlanForm({
      plan_type: sub?.plan_type ?? "trial",
      expires_at: sub?.expires_at ? sub.expires_at.split("T")[0] : "",
      notes: sub?.notes ?? "",
    });
    setDrawerOpen(true);
  };

  const savePlan = async () => {
    if (!selectedProfile) return;
    setSaving(true);
    const expiresAt = planForm.expires_at ? new Date(planForm.expires_at + "T23:59:59").toISOString() : new Date().toISOString();

    const payload = {
      user_id: selectedProfile.id,
      plan_type: planForm.plan_type,
      status: "active",
      expires_at: expiresAt,
      product_count_limit: planForm.plan_type === "trial" ? 10 : null,
      onboarding_completed: selectedSub?.onboarding_completed ?? false,
      notes: planForm.notes || null,
    };

    let error: any;
    if (selectedSub) {
      ({ error } = await supabase.from("user_subscriptions").update(payload).eq("id", selectedSub.id));
    } else {
      ({ error } = await supabase.from("user_subscriptions").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar plano");
      console.error(error);
    } else {
      toast.success("Plano atualizado com sucesso!");
      // Refresh subscriptions
      const { data } = await supabase.from("user_subscriptions").select("*");
      setSubscriptions((data as UserSubscription[]) || []);
      setDrawerOpen(false);
    }
    setSaving(false);
  };

  const createNewUser = async () => {
    if (!newUserForm.email || !newUserForm.password) {
      toast.error("Email e senha são obrigatórios");
      return;
    }
    setCreatingUser(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: newUserForm.email.trim(),
        password: newUserForm.password,
        full_name: newUserForm.full_name.trim() || undefined,
      },
    });
    if (error || !data?.success) {
      toast.error(data?.error ?? "Erro ao criar usuário");
    } else {
      toast.success("Usuário criado com sucesso!");
      setNewUserOpen(false);
      setNewUserForm({ full_name: "", email: "", password: "" });
      // Refresh profiles list
      const { data: profilesData } = await supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false });
      setProfiles((profilesData as Profile[]) || []);
    }
    setCreatingUser(false);
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Administração de Usuários
          </h1>
          <p className="text-muted-foreground">Gerencie usuários e planos de assinatura</p>
        </div>
        <Badge variant="outline" className="text-xs">{profiles.length} usuário(s)</Badge>
      </div>
      {/* New user button */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setNewUserForm({ full_name: "", email: "", password: "" }); setNewUserOpen(true); }} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="hub-fees" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Taxas HUB
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Integrações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: profiles.length, icon: <Users className="h-4 w-4" />, color: "text-foreground" },
          { label: "Trials", value: summary.trial, icon: <Clock className="h-4 w-4" />, color: "text-orange-600" },
          { label: "Basic", value: summary.basic, icon: <CheckCircle className="h-4 w-4" />, color: "text-blue-600" },
          { label: "Premium", value: summary.premium, icon: <Crown className="h-4 w-4" />, color: "text-yellow-600" },
          { label: "Expirados", value: summary.expired, icon: <XCircle className="h-4 w-4" />, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`flex items-center gap-2 ${s.color} mb-1`}>{s.icon}<span className="text-xs font-medium">{s.label}</span></div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Usuários cadastrados</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filteredProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome / Email</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-center">Admin</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((p) => {
                    const admin = isUserAdmin(p.id);
                    const isSelf = p.id === user?.id;
                    const sub = getSubscription(p.id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {sub ? <PlanBadge planType={sub.plan_type} /> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {admin
                            ? <AdminFullAccessBadge />
                            : sub
                              ? <ExpiryBadge expiresAt={sub.expires_at} />
                              : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>

                        <TableCell className="text-center">
                          <Switch
                            checked={admin}
                            disabled={togglingUser === p.id || isSelf}
                            onCheckedChange={() => toggleAdmin(p.id, admin)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openDrawer(p)}>
                            <Settings className="h-3.5 w-3.5 mr-1" />
                            Plano
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup */}
      <div className="mt-6">
        <BackupSection />
      </div>
        </TabsContent>

        <TabsContent value="hub-fees">
          <HubFeesManager />
        </TabsContent>

        <TabsContent value="integrations">
          <div className="space-y-6">
            <BotconversaAdminSection />
          </div>
        </TabsContent>
      </Tabs>

      {/* Drawer Gerenciar Plano */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" style={{ fill: "hsl(48 96% 53%)", color: "hsl(48 96% 53%)" }} />
              Gerenciar Plano
            </DrawerTitle>
            <DrawerDescription>
              {selectedProfile?.full_name} — {selectedProfile?.email}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-4 max-w-lg mx-auto w-full">
            {/* Current plan info */}
            {selectedSub && (
              <div className="rounded-lg bg-muted/40 border p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Plano atual</p>
                  <PlanBadge planType={selectedSub.plan_type} />
                </div>
                <ExpiryBadge expiresAt={selectedSub.expires_at} />
              </div>
            )}

            {/* Plan type */}
            <div className="space-y-1.5">
              <Label>Tipo de Plano</Label>
              <Select value={planForm.plan_type} onValueChange={(v) => setPlanForm((f) => ({ ...f, plan_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Teste 5 Dias</SelectItem>
                  <SelectItem value="basic_monthly">Basic - PIX Mensal</SelectItem>
                  <SelectItem value="basic_annual">Basic - Anual</SelectItem>
                  <SelectItem value="premium_monthly">Premium - PIX Mensal</SelectItem>
                  <SelectItem value="premium_annual">Premium - Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Expiry date */}
            <div className="space-y-1.5">
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={planForm.expires_at}
                onChange={(e) => setPlanForm((f) => ({ ...f, expires_at: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                placeholder="Notas internas sobre o plano..."
                value={planForm.notes}
                onChange={(e) => setPlanForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DrawerFooter className="max-w-lg mx-auto w-full">
            <Button onClick={savePlan} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar Plano"}
            </Button>
            <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full">
              Cancelar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Dialog: Novo Usuário */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Criar Novo Usuário
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                placeholder="Nome do usuário"
                value={newUserForm.full_name}
                onChange={(e) => setNewUserForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewUserOpen(false)} disabled={creatingUser}>
              Cancelar
            </Button>
            <Button onClick={createNewUser} disabled={creatingUser}>
              {creatingUser ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
