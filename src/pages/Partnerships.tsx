import { useState } from "react";
import { Plus, Users, Settings2, Package, Trash2, Edit, Check, X, UserPlus, Copy, User } from "lucide-react";
import { ProductPartnershipDialog } from "@/components/partnerships/ProductPartnershipDialog";
import { MainLayout } from "@/components/layout/MainLayout";
import { DirectPartnerships } from "@/components/partnerships/DirectPartnerships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Group {
  id: string;
  name: string;
  description: string | null;
  invite_code: string | null;
  created_by: string;
  created_at: string;
  is_direct?: boolean;
  commission_percent?: number;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

interface PartnershipRule {
  id: string;
  group_id: string;
  seller_cost_percent: number;
  seller_profit_percent: number;
  owner_cost_percent: number;
  owner_profit_percent: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock_quantity: number;
}

interface ProductPartnership {
  id: string;
  product_id: string;
  group_id: string;
}

interface AutoShareSetting {
  group_id: string;
  owner_id: string;
  enabled: boolean;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export default function Partnerships() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  
  // Form states
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  
  // Rules form - For GROUPS: only owner commission matters
  const [ownerCommissionPercent, setOwnerCommissionPercent] = useState(20);

  // Fetch user's groups
  const { data: groupMemberships = [] } = useQuery({
    queryKey: ["group-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*")
        .eq("user_id", user?.id);
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!user,
  });

  // Fetch groups (only non-direct ones for the group partnerships section)
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("is_direct", false);
      if (error) throw error;
      return data as Group[];
    },
    enabled: !!user,
  });

  // Fetch partnership rules
  const { data: partnershipRules = [] } = useQuery({
    queryKey: ["partnership-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partnership_rules")
        .select("*");
      if (error) throw error;
      return data as PartnershipRule[];
    },
    enabled: !!user,
  });

  // Fetch all group members
  const { data: allGroupMembers = [] } = useQuery({
    queryKey: ["all-group-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*");
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!user,
  });

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!user,
  });

  // Fetch user's products
  const { data: products = [] } = useQuery({
    queryKey: ["user-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, category, stock_quantity")
        .eq("owner_id", user?.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Fetch product partnerships (scoped to user's groups to avoid 1000-row limit)
  const groupIds = groupMemberships.map((m) => m.group_id);
  const { data: productPartnerships = [] } = useQuery({
    queryKey: ["product-partnerships", groupIds.sort().join(",")],
    queryFn: async () => {
      if (groupIds.length === 0) return [];
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("*")
        .in("group_id", groupIds);
      if (error) throw error;
      return data as ProductPartnership[];
    },
    enabled: !!user && groupIds.length > 0,
  });

  // Fetch auto-share settings
  const { data: autoShareSettings = [] } = useQuery({
    queryKey: ["auto-share-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partnership_auto_share")
        .select("*")
        .eq("owner_id", user?.id);
      if (error) throw error;
      return data as AutoShareSetting[];
    },
    enabled: !!user,
  });

  // User's groups with details
  const userGroups = groups.filter(g => 
    groupMemberships.some(m => m.group_id === g.id)
  );

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      
      // Insert group - trigger handles group_members automatically
      const { data, error } = await supabase
        .from("groups")
        .insert({
          name: newGroupName,
          description: newGroupDescription || null,
          created_by: user.id, // Required by types, but trigger will override
        })
        .select()
        .single();
      
      if (error) throw error;

      // Create default rules for the group
      const { error: rulesError } = await supabase
        .from("partnership_rules")
        .insert({
          group_id: data.id,
          seller_cost_percent: 50,
          seller_profit_percent: 70,
          owner_cost_percent: 50,
          owner_profit_percent: 30,
        });

      if (rulesError) console.error("Error creating rules:", rulesError);
      
      return data;
    },
    onSuccess: () => {
      toast({ title: "Parceria criada com sucesso!" });
      setIsCreateOpen(false);
      setNewGroupName("");
      setNewGroupDescription("");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["all-group-members"] });
      queryClient.invalidateQueries({ queryKey: ["partnership-rules"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar parceria", description: error.message, variant: "destructive" });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!user) throw new Error("Não autenticado");
      
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Parceria excluída com sucesso!" });
      setIsDeleteOpen(false);
      setSelectedGroup(null);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["all-group-members"] });
      queryClient.invalidateQueries({ queryKey: ["partnership-rules"] });
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir parceria", description: error.message, variant: "destructive" });
    },
  });

  // Join group mutation
  const joinGroupMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      
      // Find group by invite code
      const { data: group, error: findError } = await supabase
        .from("groups")
        .select("*")
        .eq("invite_code", joinCode.trim())
        .maybeSingle();
      
      if (findError) throw findError;
      if (!group) throw new Error("Código de convite inválido");

      // Check if already a member
      const existing = groupMemberships.find(m => m.group_id === group.id);
      if (existing) throw new Error("Você já é membro desta parceria");

      // Join the group
      const { error: joinError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: "member",
        });

      if (joinError) throw joinError;
      return group;
    },
    onSuccess: (group) => {
      toast({ title: "Você entrou na parceria!", description: `Bem-vindo(a) à ${group.name}` });
      setIsJoinOpen(false);
      setJoinCode("");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["all-group-members"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao entrar na parceria", description: error.message, variant: "destructive" });
    },
  });

  // Update group commission mutation (for GROUPS only)
  const updateCommissionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) throw new Error("Nenhum grupo selecionado");

      // Update the group's commission_percent directly
      const { error } = await supabase
        .from("groups")
        .update({
          commission_percent: ownerCommissionPercent / 100,
        })
        .eq("id", selectedGroup.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Comissão atualizada com sucesso!" });
      setIsRulesOpen(false);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar comissão", description: error.message, variant: "destructive" });
    },
  });

  // Toggle product partnership mutation
  const toggleProductPartnershipMutation = useMutation({
    mutationFn: async ({ productId, groupId, isEnabled }: { productId: string; groupId: string; isEnabled: boolean }) => {
      if (isEnabled) {
        // Remove partnership
        const { error } = await supabase
          .from("product_partnerships")
          .delete()
          .eq("product_id", productId)
          .eq("group_id", groupId);
        if (error) throw error;
      } else {
        // Add partnership - ignore duplicates (no UPDATE policy on this table)
        const { error } = await supabase
          .from("product_partnerships")
          .upsert(
            { product_id: productId, group_id: groupId },
            { onConflict: "product_id,group_id", ignoreDuplicates: true }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar produto", description: error.message, variant: "destructive" });
    },
  });

  // Toggle auto-share mutation (share all products at once)
  const toggleAutoShareMutation = useMutation({
    mutationFn: async ({ groupId, enabled }: { groupId: string; enabled: boolean }) => {
      const { error } = await supabase.rpc("set_partnership_auto_share", {
        _group_id: groupId,
        _enabled: enabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"] });
      queryClient.invalidateQueries({ queryKey: ["auto-share-settings"] });
      toast({ title: "Configuração atualizada!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar configuração", description: error.message, variant: "destructive" });
    },
  });

  const openRulesDialog = (group: Group & { commission_percent?: number }) => {
    setSelectedGroup(group);
    // For groups, we only care about commission_percent
    setOwnerCommissionPercent((group.commission_percent ?? 0.2) * 100);
    setIsRulesOpen(true);
  };

  const openProductsDialog = (group: Group) => {
    setSelectedGroup(group);
    setIsProductsOpen(true);
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado!" });
  };

  const getGroupMembers = (groupId: string) => {
    return allGroupMembers
      .filter(m => m.group_id === groupId)
      .map(m => {
        const profile = profiles.find(p => p.id === m.user_id);
        return { ...m, profile };
      });
  };

  const getUserRole = (groupId: string) => {
    const membership = groupMemberships.find(m => m.group_id === groupId);
    return membership?.role || "member";
  };

  const isProductInPartnership = (productId: string, groupId: string) => {
    return productPartnerships.some(pp => pp.product_id === productId && pp.group_id === groupId);
  };

  const getProductPartnershipsCount = (productId: string) => {
    return productPartnerships.filter(pp => pp.product_id === productId).length;
  };

  const isAutoShareEnabled = (groupId: string) => {
    return autoShareSettings.some(s => s.group_id === groupId && s.enabled);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parcerias</h1>
          <p className="text-muted-foreground">Gerencie suas parcerias e regras de divisão</p>
        </div>
      </div>

      {/* Tabs for Direct vs Group Partnerships */}
      <Tabs defaultValue="direct" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="direct" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Parcerias Diretas
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Grupos
          </TabsTrigger>
        </TabsList>

        {/* Direct Partnerships Tab */}
        <TabsContent value="direct">
          <DirectPartnerships />
        </TabsContent>

        {/* Group Partnerships Tab */}
        <TabsContent value="groups" className="space-y-6">
          {/* Groups Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Grupos de Parceria</h2>
              <p className="text-sm text-muted-foreground">Parcerias com múltiplos vendedores</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsJoinOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Entrar em Grupo
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Grupo
              </Button>
            </div>
          </div>

      {/* Partnerships Grid */}
      {groupsLoading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : userGroups.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma parceria encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Crie uma nova parceria ou entre em uma existente usando um código de convite.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setIsJoinOpen(true)}>
                Entrar com Código
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>
                Criar Parceria
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {userGroups.map((group) => {
            const members = getGroupMembers(group.id);
            const rules = partnershipRules.find(r => r.group_id === group.id);
            const role = getUserRole(group.id);
            const isAdmin = role === "owner" || role === "admin";
            const productsInPartnership = productPartnerships.filter(pp => pp.group_id === group.id).length;

            return (
              <Card key={group.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        {group.name}
                      </CardTitle>
                      {group.description && (
                        <CardDescription className="mt-1">{group.description}</CardDescription>
                      )}
                    </div>
                    <Badge variant={isAdmin ? "default" : "secondary"}>
                      {role === "owner" ? "Criador" : role === "admin" ? "Admin" : "Membro"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Members */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {members.length} membro{members.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {members.slice(0, 5).map((m) => (
                        <Badge key={m.id} variant="outline" className="text-xs">
                          {m.profile?.full_name || "Usuário"}
                        </Badge>
                      ))}
                      {members.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{members.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Rules Summary */}
                  {rules && (
                    <div className="bg-secondary/30 rounded-lg p-3 text-sm">
                      <p className="font-medium mb-1">Regras de Divisão:</p>
                      <p className="text-muted-foreground">
                        Quem vende: {rules.seller_cost_percent}% custo + {rules.seller_profit_percent}% lucro
                      </p>
                      <p className="text-muted-foreground">
                        Quem cede: {rules.owner_cost_percent}% custo + {rules.owner_profit_percent}% lucro
                      </p>
                    </div>
                  )}

                  {/* Products Count */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>{productsInPartnership} produtos liberados</span>
                  </div>

                  {/* Invite Code */}
                  {group.invite_code && (
                    <div className="flex items-center gap-2">
                      <Input 
                        value={group.invite_code} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyInviteCode(group.invite_code!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {isAdmin && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => openRulesDialog(group)}
                        >
                          <Settings2 className="h-4 w-4 mr-1" />
                          Regras
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedGroup(group);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => openProductsDialog(group)}
                    >
                      <Package className="h-4 w-4 mr-1" />
                      Produtos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Partnership Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Parceria</DialogTitle>
            <DialogDescription>
              Crie uma parceria e convide outras vendedoras usando o código de convite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Parceria</Label>
              <Input
                id="name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Parceria Fitness"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Descrição da parceria"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createGroupMutation.mutate()}
              disabled={!newGroupName.trim() || createGroupMutation.isPending}
            >
              {createGroupMutation.isPending ? "Criando..." : "Criar Parceria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Partnership Dialog */}
      <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrar em uma Parceria</DialogTitle>
            <DialogDescription>
              Digite o código de convite para entrar em uma parceria existente.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="code">Código de Convite</Label>
            <Input
              id="code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Digite o código"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJoinOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => joinGroupMutation.mutate()}
              disabled={!joinCode.trim() || joinGroupMutation.isPending}
            >
              {joinGroupMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules Dialog - For GROUPS: Only owner commission */}
      <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Comissão do Grupo - {selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              Configure a comissão que o proprietário da peça recebe quando um membro do grupo vende.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Explanation Card */}
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">Como funciona?</p>
              <p className="text-muted-foreground">
                Quando um membro do grupo vende uma peça de outro membro:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>O <strong>proprietário</strong> recebe o custo + comissão sobre o lucro</li>
                <li>O <strong>vendedor</strong> fica com o lucro restante</li>
              </ul>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <Label htmlFor="ownerCommission" className="text-sm font-medium">
                Comissão do Proprietário sobre o Lucro (%)
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                Quanto o dono da peça recebe do lucro quando outro membro vende
              </p>
              <Input
                id="ownerCommission"
                type="number"
                min={0}
                max={100}
                value={ownerCommissionPercent}
                onChange={(e) => setOwnerCommissionPercent(Number(e.target.value))}
                className="w-32"
              />
            </div>

            {/* Live Preview */}
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Simulação:</p>
              <p className="text-xs text-muted-foreground mb-3">
                Peça com custo R$50,00 vendida por R$100,00 (lucro R$50,00)
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-secondary/50 rounded p-3">
                  <p className="font-medium">Proprietário recebe</p>
                  <p className="text-lg font-bold text-primary">
                    R$ {(50 + (50 * ownerCommissionPercent / 100)).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    R$50 (custo) + R${(50 * ownerCommissionPercent / 100).toFixed(2)} ({ownerCommissionPercent}% lucro)
                  </p>
                </div>
                <div className="bg-primary/10 rounded p-3">
                  <p className="font-medium">Vendedor fica com</p>
                  <p className="text-lg font-bold">
                    R$ {(50 - (50 * ownerCommissionPercent / 100)).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {100 - ownerCommissionPercent}% do lucro
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRulesOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => updateCommissionMutation.mutate()}
              disabled={updateCommissionMutation.isPending}
            >
              {updateCommissionMutation.isPending ? "Salvando..." : "Salvar Comissão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Products Dialog */}
      {selectedGroup && (
        <ProductPartnershipDialog
          open={isProductsOpen}
          onOpenChange={setIsProductsOpen}
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          products={products}
          productPartnerships={productPartnerships}
          showAutoShare={true}
          isAutoShareEnabled={isAutoShareEnabled(selectedGroup.id)}
          onToggleAutoShare={() => {
            toggleAutoShareMutation.mutate({
              groupId: selectedGroup.id,
              enabled: !isAutoShareEnabled(selectedGroup.id),
            });
          }}
          isAutoSharePending={toggleAutoShareMutation.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Parceria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a parceria "{selectedGroup?.name}"? 
              Esta ação não pode ser desfeita. Todos os produtos liberados e regras serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (selectedGroup) {
                  deleteGroupMutation.mutate(selectedGroup.id);
                }
              }}
              disabled={deleteGroupMutation.isPending}
            >
              {deleteGroupMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
