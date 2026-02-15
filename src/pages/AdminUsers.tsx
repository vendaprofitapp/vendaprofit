import { useEffect, useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Users, Search } from "lucide-react";
import { BackupSection } from "@/components/admin/BackupSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

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

export default function AdminUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  // Check if current user is admin
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) {
        console.error(error);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(!!data);
      if (!data) {
        toast.error("Você não tem permissão para acessar esta página.");
        navigate("/");
      }
    }
    checkAdmin();
  }, [user, navigate]);

  // Fetch users and roles
  useEffect(() => {
    async function fetchData() {
      if (!isAdmin) return;
      setLoading(true);
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesRes.error) console.error(profilesRes.error);
      if (rolesRes.error) console.error(rolesRes.error);

      setProfiles((profilesRes.data as Profile[]) || []);
      setRoles((rolesRes.data as UserRole[]) || []);
      setLoading(false);
    }
    fetchData();
  }, [isAdmin]);

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    const lower = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.full_name.toLowerCase().includes(lower) ||
        p.email.toLowerCase().includes(lower)
    );
  }, [profiles, search]);

  const isUserAdmin = (userId: string) =>
    roles.some((r) => r.user_id === userId && r.role === "admin");

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (togglingUser) return;
    setTogglingUser(userId);

    if (currentlyAdmin) {
      // Remove admin
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) {
        toast.error("Erro ao remover admin");
        console.error(error);
      } else {
        setRoles((prev) => prev.filter((r) => !(r.user_id === userId && r.role === "admin")));
        toast.success("Papel de admin removido");
      }
    } else {
      // Add admin
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) {
        toast.error("Erro ao definir admin");
        console.error(error);
      } else {
        setRoles((prev) => [...prev, { user_id: userId, role: "admin" }]);
        toast.success("Usuário agora é admin");
      }
    }
    setTogglingUser(null);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Administração de Usuários
          </h1>
          <p className="text-muted-foreground">Gerencie permissões de usuários</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {profiles.length} usuário(s)
        </Badge>
      </div>

      {/* How users register section */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Como um novo usuário se cadastra?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Novos usuários podem se cadastrar acessando a página <strong>/auth</strong> e clicando em{" "}
            <strong>"Não tem conta? Cadastre-se"</strong>.
          </p>
          <p>
            Ao preencher nome, email e senha, a conta é criada automaticamente. Por padrão, usuários
            são registrados sem privilégios de administrador.
          </p>
          <p>
            Você (admin) pode conceder o papel de <strong>admin</strong> usando o botão abaixo.
          </p>
        </CardContent>
      </Card>

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Admin</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((p) => {
                  const admin = isUserAdmin(p.id);
                  const isSelf = p.id === user?.id;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell className="text-center">
                        {admin ? (
                          <Badge className="bg-primary/10 text-primary">Admin</Badge>
                        ) : (
                          <Badge variant="outline">Usuário</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground">Admin</span>
                          <Switch
                            checked={admin}
                            disabled={togglingUser === p.id || isSelf}
                            onCheckedChange={() => toggleAdmin(p.id, admin)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Backup Section */}
      <div className="mt-6">
        <BackupSection />
      </div>
    </MainLayout>
  );
}
