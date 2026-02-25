import { useState, useMemo } from "react";
import { UserPlus, Users, Copy, Check, X, Mail, Link2, Package, ChevronDown, ChevronUp, Percent, HelpCircle, FileText, Settings } from "lucide-react";
import { PartnershipProposalCard } from "./PartnershipProposalCard";
import { PartnershipRulesDialog } from "./PartnershipRulesDialog";
import { EditPartnershipRulesDialog } from "./EditPartnershipRulesDialog";
import { ProductPartnershipDialog } from "./ProductPartnershipDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface DirectInvite {
  id: string;
  inviter_id: string;
  invitee_email: string;
  invite_code: string;
  status: string;
  group_id: string | null;
  created_at: string;
  cost_split_ratio: number | null;
  profit_share_seller: number | null;
  profit_share_partner: number | null;
  owner_commission_percent: number | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  category_2?: string | null;
  category_3?: string | null;
  main_category?: string | null;
  subcategory?: string | null;
  stock_quantity: number;
  supplier_id?: string | null;
  color_label?: string | null;
  model?: string | null;
  is_new_release?: boolean | null;
  marketing_status?: string[] | null;
  min_stock_level?: number | null;
  product_variants?: { size: string; stock_quantity: number; marketing_status: string[] | null }[];
}

interface Supplier {
  id: string;
  name: string;
}

interface MainCategory {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
  main_category_id: string;
}

interface ProductPartnership {
  id: string;
  product_id: string;
  group_id: string;
}

interface PartnershipRule {
  id: string;
  group_id: string;
  seller_cost_percent: number;
  seller_profit_percent: number;
  owner_cost_percent: number;
  owner_profit_percent: number;
}

interface DirectPartner {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  groupId: string;
}

export function DirectPartnerships() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isAcceptOpen, setIsAcceptOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [acceptCode, setAcceptCode] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<DirectPartner | null>(null);
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [editRulesDialogOpen, setEditRulesDialogOpen] = useState(false);
  const [selectedPartnerForRules, setSelectedPartnerForRules] = useState<{
    partnerName: string;
    groupId: string;
  } | null>(null);
  
  // Partnership configuration state
  const [costSplitRatio, setCostSplitRatio] = useState<number>(50);
  const [profitShareWhenYouSell, setProfitShareWhenYouSell] = useState<number>(70);
  const [profitShareWhenPartnerSells, setProfitShareWhenPartnerSells] = useState<number>(30);
  const [thirdPartyCommissionPercent, setThirdPartyCommissionPercent] = useState<number>(20);
  const [profitValidationError, setProfitValidationError] = useState<string | null>(null);
  
  // Validate profit share values (both must be valid percentages)
  const validateProfitShares = () => {
    if (profitShareWhenYouSell < 0 || profitShareWhenYouSell > 100) {
      setProfitValidationError("Porcentagem deve estar entre 0% e 100%");
      return false;
    }
    if (profitShareWhenPartnerSells < 0 || profitShareWhenPartnerSells > 100) {
      setProfitValidationError("Porcentagem deve estar entre 0% e 100%");
      return false;
    }
    setProfitValidationError(null);
    return true;
  };
  
  // Reset partnership form
  const resetPartnershipForm = () => {
    setCostSplitRatio(50);
    setProfitShareWhenYouSell(70);
    setProfitShareWhenPartnerSells(30);
    setThirdPartyCommissionPercent(20);
    setProfitValidationError(null);
  };

  // Fetch user profile
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });

  // Fetch direct invites (sent and received)
  const { data: directInvites = [], isLoading: invitesLoading } = useQuery({
    queryKey: ["direct-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_partnership_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DirectInvite[];
    },
    enabled: !!user,
  });

  // Fetch all profiles
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

  // Fetch direct partnerships (groups with is_direct=true where user is member)
  const { data: directGroups = [] } = useQuery({
    queryKey: ["direct-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, groups!inner(id, name, is_direct, created_by, commission_percent, cost_split_ratio, profit_share_seller, profit_share_partner)")
        .eq("user_id", user?.id);
      if (error) throw error;
      // Filter for direct groups only
      return data?.filter((d: any) => d.groups?.is_direct) || [];
    },
    enabled: !!user,
  });

  // Helper to get group config for rules dialog
  const getGroupConfig = (groupId: string) => {
    const groupData = directGroups.find((d: any) => d.group_id === groupId);
    if (!groupData?.groups) {
      return {
        costSplitPercent: 50,
        profitShareSeller: 70,
        profitSharePartner: 30,
        thirdPartyCommission: 20,
      };
    }
    const g = groupData.groups;
    return {
      costSplitPercent: Math.round((g.cost_split_ratio ?? 0.5) * 100),
      profitShareSeller: Math.round((g.profit_share_seller ?? 0.7) * 100),
      profitSharePartner: Math.round((g.profit_share_partner ?? 0.3) * 100),
      thirdPartyCommission: Math.round((g.commission_percent ?? 0.2) * 100),
    };
  };

  // Fetch all members of direct groups
  const { data: directGroupMembers = [] } = useQuery({
    queryKey: ["direct-group-members", directGroups],
    queryFn: async () => {
      const groupIds = directGroups.map((d: any) => d.group_id);
      if (groupIds.length === 0) return [];
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, user_id")
        .in("group_id", groupIds);
      if (error) throw error;
      return data || [];
    },
    enabled: directGroups.length > 0,
  });

  // Fetch user's products (expanded for filters)
  const { data: products = [] } = useQuery({
    queryKey: ["user-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost_price, category, category_2, category_3, main_category, subcategory, stock_quantity, supplier_id, color_label, model, is_new_release, marketing_status, min_stock_level, product_variants(size, stock_quantity, marketing_status)")
        .eq("owner_id", user?.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  // Fetch suppliers for filter
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!user,
  });

  // Fetch main categories for filter
  const { data: mainCategories = [] } = useQuery({
    queryKey: ["main-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("main_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as MainCategory[];
    },
    enabled: !!user,
  });

  // Fetch subcategories for filter
  const { data: subcategories = [] } = useQuery({
    queryKey: ["subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("id, name, main_category_id")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Subcategory[];
    },
    enabled: !!user,
  });

  // Fetch product partnerships (scoped to my direct group ids to avoid 1000-row limit)
  const directGroupIds = directGroups.map((d: any) => d.group_id);
  const { data: productPartnerships = [] } = useQuery({
    queryKey: ["product-partnerships", directGroupIds.sort().join(",")],
    queryFn: async () => {
      if (directGroupIds.length === 0) return [];
      const { data, error } = await supabase
        .from("product_partnerships")
        .select("*")
        .in("group_id", directGroupIds);
      if (error) throw error;
      return data as ProductPartnership[];
    },
    enabled: !!user && directGroupIds.length > 0,
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

  // Helper to get rules for a group
  const getRulesForGroup = (groupId: string): PartnershipRule => {
    const rules = partnershipRules.find(r => r.group_id === groupId);
    return rules || {
      id: "",
      group_id: groupId,
      seller_cost_percent: 50,
      seller_profit_percent: 70,
      owner_cost_percent: 50,
      owner_profit_percent: 30,
    };
  };

  // Compute direct partners list
  const directPartners: DirectPartner[] = directGroups.map((dg: any) => {
    const groupId = dg.group_id;
    const members = directGroupMembers.filter((m) => m.group_id === groupId);
    const partnerMember = members.find((m) => m.user_id !== user?.id);
    const partnerProfile = profiles.find((p) => p.id === partnerMember?.user_id);
    return {
      partnerId: partnerMember?.user_id || "",
      partnerName: partnerProfile?.full_name || "Parceiro",
      partnerEmail: partnerProfile?.email || "",
      groupId,
    };
  }).filter((p) => p.partnerId);

  // Pending invites I sent
  const sentInvites = directInvites.filter(
    (i) => i.inviter_id === user?.id && i.status === "pending"
  );

  // Pending invites I received
  const receivedInvites = directInvites.filter(
    (i) => i.invitee_email === myProfile?.email && i.status === "pending"
  );

  // Send invite mutation
  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");

      // Check if email is valid and not self
      if (inviteEmail.toLowerCase() === myProfile?.email.toLowerCase()) {
        throw new Error("Você não pode convidar a si mesmo");
      }

      // Check if already has partnership with this email
      const existingPartner = directPartners.find(
        (p) => p.partnerEmail.toLowerCase() === inviteEmail.toLowerCase()
      );
      if (existingPartner) {
        throw new Error("Você já tem uma parceria direta com este usuário");
      }

      // Check if already has pending invite
      const existingInvite = sentInvites.find(
        (i) => i.invitee_email.toLowerCase() === inviteEmail.toLowerCase()
      );
      if (existingInvite) {
        throw new Error("Já existe um convite pendente para este email");
      }

      // Validate profit shares before creating invite
      if (!validateProfitShares()) {
        throw new Error("Porcentagens de lucro inválidas");
      }

      // Create the invite with partnership configuration
      // owner_commission_percent is used for THIRD-PARTY sales (Scenario C)
      const { data, error } = await supabase
        .from("direct_partnership_invites")
        .insert({
          inviter_id: user.id,
          invitee_email: inviteEmail.toLowerCase(),
          cost_split_ratio: costSplitRatio / 100,
          profit_share_seller: profitShareWhenYouSell / 100,
          profit_share_partner: profitShareWhenPartnerSells / 100,
          owner_commission_percent: thirdPartyCommissionPercent / 100, // Commission for third-party sales
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Convite enviado!",
        description: `Código: ${data.invite_code} - Compartilhe com seu parceiro`,
      });
      setIsInviteOpen(false);
      setInviteEmail("");
      resetPartnershipForm();
      queryClient.invalidateQueries({ queryKey: ["direct-invites"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar convite",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Accept invite mutation
  const acceptInviteMutation = useMutation({
    mutationFn: async (invite: DirectInvite) => {
      if (!user) throw new Error("Não autenticado");
      
      // Use values from invite (set by inviter) with fallbacks
      const inviteCostSplit = invite.cost_split_ratio ?? 0.5;
      const inviteProfitSeller = invite.profit_share_seller ?? 0.7;
      const inviteProfitPartner = invite.profit_share_partner ?? 0.3;
      const inviteThirdPartyCommission = invite.owner_commission_percent ?? 0.2;

      // Create a direct group for this partnership with values from invite
      // commission_percent is used for THIRD-PARTY sales (Scenario C)
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: `Parceria Direta`,
          description: null,
          created_by: user.id,
          is_direct: true,
          commission_percent: inviteThirdPartyCommission, // Used when third-party sells partnership stock
          cost_split_ratio: inviteCostSplit,
          profit_share_seller: inviteProfitSeller,
          profit_share_partner: inviteProfitPartner,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add the inviter (partner) to the group as member
      const { error: membersError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, user_id: invite.inviter_id, role: "member" });

      if (membersError) throw membersError;

      // Update invite status
      const { error: updateError } = await supabase
        .from("direct_partnership_invites")
        .update({ status: "accepted", group_id: group.id })
        .eq("id", invite.id);

      if (updateError) throw updateError;

      // Create partnership rules using values from invite (convert to percentage)
      await supabase.from("partnership_rules").insert({
        group_id: group.id,
        seller_cost_percent: inviteCostSplit * 100,
        seller_profit_percent: inviteProfitSeller * 100,
        owner_cost_percent: inviteCostSplit * 100,
        owner_profit_percent: inviteProfitPartner * 100,
      });

      return group;
    },
    onSuccess: () => {
      toast({ title: "Parceria aceita!", description: "Vocês agora são parceiros diretos" });
      resetPartnershipForm();
      queryClient.invalidateQueries({ queryKey: ["direct-invites"] });
      queryClient.invalidateQueries({ queryKey: ["direct-groups"] });
      queryClient.invalidateQueries({ queryKey: ["direct-group-members"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-memberships"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao aceitar convite", description: error.message, variant: "destructive" });
    },
  });

  // Reject invite mutation
  const rejectInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("direct_partnership_invites")
        .update({ status: "rejected" })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Convite recusado" });
      queryClient.invalidateQueries({ queryKey: ["direct-invites"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao recusar", description: error.message, variant: "destructive" });
    },
  });

  // Cancel invite mutation
  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("direct_partnership_invites")
        .delete()
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Convite cancelado" });
      queryClient.invalidateQueries({ queryKey: ["direct-invites"] });
    },
    onError: (error) => {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    },
  });

  // Accept invite by code mutation
  const acceptByCodeMutation = useMutation({
    mutationFn: async () => {
      if (!user || !myProfile) throw new Error("Não autenticado");

      // Find invite by code
      const { data: invite, error: findError } = await supabase
        .from("direct_partnership_invites")
        .select("*")
        .eq("invite_code", acceptCode.trim())
        .eq("status", "pending")
        .maybeSingle();

      if (findError) throw findError;
      if (!invite) throw new Error("Código inválido ou convite já usado");

      // Check if invite is for this user
      if (invite.invitee_email.toLowerCase() !== myProfile.email.toLowerCase()) {
        throw new Error("Este convite não é para você");
      }

      // Use accept mutation
      return acceptInviteMutation.mutateAsync(invite);
    },
    onSuccess: () => {
      setIsAcceptOpen(false);
      setAcceptCode("");
    },
    onError: (error) => {
      toast({ title: "Erro ao aceitar", description: error.message, variant: "destructive" });
    },
  });

  // Toggle product partnership
  const toggleProductMutation = useMutation({
    mutationFn: async ({
      productId,
      groupId,
      isEnabled,
    }: {
      productId: string;
      groupId: string;
      isEnabled: boolean;
    }) => {
      if (isEnabled) {
        const { error } = await supabase
          .from("product_partnerships")
          .delete()
          .eq("product_id", productId)
          .eq("group_id", groupId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_partnerships")
          .upsert(
            { product_id: productId, group_id: groupId },
            { onConflict: "product_id,group_id", ignoreDuplicates: true }
          );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-partnerships"], exact: false });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado!" });
  };

  const isProductInPartnership = (productId: string, groupId: string) => {
    return productPartnerships.some((pp) => pp.product_id === productId && pp.group_id === groupId);
  };

  const togglePartnerExpanded = (partnerId: string) => {
    setExpandedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
      }
      return next;
    });
  };

  const getInviterName = (inviterId: string) => {
    const profile = profiles.find((p) => p.id === inviterId);
    return profile?.full_name || "Usuário";
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sociedades Diretas (1-1)</h2>
          <p className="text-sm text-muted-foreground">
            Sociedades exclusivas entre você e outro vendedor
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAcceptOpen(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Usar Código
          </Button>
          <Button size="sm" onClick={() => setIsInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar Parceiro
          </Button>
        </div>
      </div>

      {/* Pending Invites Received */}
      {receivedInvites.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Convites Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {receivedInvites.map((invite) => {
              // Get values from invite with fallbacks
              const inviteCostSplit = Math.round((invite.cost_split_ratio ?? 0.5) * 100);
              const inviteProfitSeller = Math.round((invite.profit_share_seller ?? 0.7) * 100);
              const inviteProfitPartner = Math.round((invite.profit_share_partner ?? 0.3) * 100);
              const inviteOwnerCommission = Math.round((invite.owner_commission_percent ?? 0.2) * 100);
              
              return (
                <div key={invite.id} className="p-4 bg-background rounded-lg border space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserPlus className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{getInviterName(invite.inviter_id)}</p>
                      <p className="text-sm text-muted-foreground">
                        quer ser seu parceiro direto
                      </p>
                    </div>
                  </div>
                  
                  {/* Partnership Proposal Card */}
                  <PartnershipProposalCard
                    costSplitPercent={inviteCostSplit}
                    profitShareSeller={inviteProfitSeller}
                    profitSharePartner={inviteProfitPartner}
                    thirdPartyCommission={inviteOwnerCommission}
                    inviterName={getInviterName(invite.inviter_id)}
                  />
                  
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectInviteMutation.mutate(invite.id)}
                      disabled={rejectInviteMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Recusar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => acceptInviteMutation.mutate(invite)}
                      disabled={acceptInviteMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Aceitar Parceria
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Pending Invites Sent */}
      {sentInvites.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Convites Enviados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sentInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{invite.invitee_email}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    Código: <code className="bg-muted px-1 rounded">{invite.invite_code}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyInviteCode(invite.invite_code)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => cancelInviteMutation.mutate(invite.id)}
                  disabled={cancelInviteMutation.isPending}
                >
                  Cancelar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Partners */}
      {directPartners.length === 0 && sentInvites.length === 0 && receivedInvites.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma sociedade direta</h3>
            <p className="text-muted-foreground mb-4">
              Convide outro vendedor para criar uma sociedade exclusiva 1-1.
            </p>
            <Button onClick={() => setIsInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar Parceiro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {directPartners.map((partner) => {
            const isExpanded = expandedPartners.has(partner.partnerId);
            const partnerProducts = productPartnerships.filter(
              (pp) => pp.group_id === partner.groupId
            );
            
            // Get the rules for this partnership
            const rules = getRulesForGroup(partner.groupId);
            const costSplit = Number(rules.seller_cost_percent);
            const profitSeller = Number(rules.seller_profit_percent);
            const profitPartner = Number(rules.owner_profit_percent);

            return (
              <Card key={partner.groupId}>
                <Collapsible open={isExpanded} onOpenChange={() => togglePartnerExpanded(partner.partnerId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{partner.partnerName}</CardTitle>
                            <CardDescription>{partner.partnerEmail}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            {partnerProducts.length} produtos
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      {/* Financial Rules Summary */}
                      <div className="mt-3 flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 text-xs">
                                <Percent className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Regra:</span>
                                <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
                                  Custo {costSplit}/{100 - costSplit}
                                </Badge>
                                <span className="text-muted-foreground">|</span>
                                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                                  Lucro {profitSeller}/{profitPartner}
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium mb-1">Regras desta Parceria:</p>
                              <p className="text-xs">• Custo dividido: {costSplit}% / {100 - costSplit}%</p>
                              <p className="text-xs">• Lucro: {profitSeller}% vendedora / {profitPartner}% dona</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="border-t pt-4 space-y-4">
                        {/* View / Edit Rules Buttons */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedPartnerForRules({
                                partnerName: partner.partnerName,
                                groupId: partner.groupId,
                              });
                              setRulesDialogOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Ver Regras
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedPartnerForRules({
                                partnerName: partner.partnerName,
                                groupId: partner.groupId,
                              });
                              setEditRulesDialogOpen(true);
                            }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Editar Regras
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Seus produtos liberados para {partner.partnerName}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPartner(partner);
                              setIsProductsOpen(true);
                            }}
                          >
                            Gerenciar Produtos
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={(open) => {
        setIsInviteOpen(open);
        if (!open) resetPartnershipForm();
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convidar Parceiro Direto</DialogTitle>
            <DialogDescription>
              Configure as regras da parceria e envie um convite por email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email do Parceiro</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="parceiro@email.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O parceiro precisa ter uma conta no sistema com este email.
              </p>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Configuração da Parceria</p>
              
              <TooltipProvider>
                {/* Cost Split */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="invite-cost-split">Divisão de Custo</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Como o custo da peça é dividido entre vocês. Ex: 50/50 significa que cada uma recupera metade do custo investido</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="invite-cost-split"
                      type="number"
                      min={0}
                      max={100}
                      value={costSplitRatio}
                      onChange={(e) => setCostSplitRatio(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">% você / {100 - costSplitRatio}% sócia</span>
                  </div>
                </div>
                
                {/* Profit Share - When YOU sell */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="invite-profit-you-sell">Sua participação no lucro quando VOCÊ vende</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Quando você vende uma peça da parceria, qual % do lucro fica com você?</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="invite-profit-you-sell"
                      type="number"
                      min={0}
                      max={100}
                      value={profitShareWhenYouSell}
                      onChange={(e) => setProfitShareWhenYouSell(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">% para você (sócia fica com {100 - profitShareWhenYouSell}%)</span>
                  </div>
                </div>
                
                {/* Profit Share - When PARTNER sells */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="invite-profit-partner-sell">Sua participação no lucro quando o SÓCIO vende</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Quando sua sócia vende uma peça sua da parceria, qual % do lucro fica com você?</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="invite-profit-partner-sell"
                      type="number"
                      min={0}
                      max={100}
                      value={profitShareWhenPartnerSells}
                      onChange={(e) => setProfitShareWhenPartnerSells(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">% para você (sócia fica com {100 - profitShareWhenPartnerSells}%)</span>
                  </div>
                </div>
                
                {/* Third-Party Commission - NEW */}
                <div className="space-y-2 mb-4 border-t pt-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="invite-third-party-commission" className="text-sm font-medium">
                      Comissão da Parceria em Vendas de Terceiros (%)
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Este é o percentual de lucro que a sociedade recebe quando um membro do grupo (que não faz parte da parceria) vende um item de vocês.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quando um terceiro do grupo vende uma peça da parceria, qual % do lucro vai para a sociedade?
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      id="invite-third-party-commission"
                      type="number"
                      min={0}
                      max={100}
                      value={thirdPartyCommissionPercent}
                      onChange={(e) => setThirdPartyCommissionPercent(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">% para a sociedade (terceiro fica com {100 - thirdPartyCommissionPercent}%)</span>
                  </div>
                </div>
              </TooltipProvider>
              
              {profitValidationError && (
                <p className="text-sm text-destructive">{profitValidationError}</p>
              )}
              
              <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                <p className="text-xs font-medium">Resumo:</p>
                <p className="text-xs text-muted-foreground">
                  • Custo dividido: {costSplitRatio}% você / {100 - costSplitRatio}% sócia
                </p>
                <p className="text-xs text-muted-foreground">
                  • Quando você vende: {profitShareWhenYouSell}% lucro para você, {100 - profitShareWhenYouSell}% para sócia
                </p>
                <p className="text-xs text-muted-foreground">
                  • Quando sócia vende: {profitShareWhenPartnerSells}% lucro para você, {100 - profitShareWhenPartnerSells}% para sócia
                </p>
                <p className="text-xs text-muted-foreground">
                  • Venda por terceiro: Sociedade recebe custo + {thirdPartyCommissionPercent}% do lucro
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => sendInviteMutation.mutate()}
              disabled={!inviteEmail.trim() || sendInviteMutation.isPending || !!profitValidationError}
            >
              {sendInviteMutation.isPending ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept by Code Dialog */}
      <Dialog open={isAcceptOpen} onOpenChange={setIsAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceitar Convite por Código</DialogTitle>
            <DialogDescription>
              Digite o código de convite que você recebeu do seu parceiro.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="code">Código de Convite</Label>
            <Input
              id="code"
              value={acceptCode}
              onChange={(e) => setAcceptCode(e.target.value)}
              placeholder="Digite o código"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAcceptOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => acceptByCodeMutation.mutate()}
              disabled={!acceptCode.trim() || acceptByCodeMutation.isPending}
            >
              {acceptByCodeMutation.isPending ? "Aceitando..." : "Aceitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Products Dialog */}
      {selectedPartner && (
        <ProductPartnershipDialog
          open={isProductsOpen}
          onOpenChange={setIsProductsOpen}
          groupId={selectedPartner.groupId}
          groupName={selectedPartner.partnerName}
          products={products}
          productPartnerships={productPartnerships}
          suppliers={suppliers}
          mainCategories={mainCategories}
          subcategories={subcategories}
          showAutoShare={false}
        />
      )}

      {/* Partnership Rules Dialog */}
      {selectedPartnerForRules && (
        <PartnershipRulesDialog
          open={rulesDialogOpen}
          onOpenChange={setRulesDialogOpen}
          partnerName={selectedPartnerForRules.partnerName}
          {...getGroupConfig(selectedPartnerForRules.groupId)}
        />
      )}

      {/* Edit Partnership Rules Dialog */}
      {selectedPartnerForRules && (() => {
        const cfg = getGroupConfig(selectedPartnerForRules.groupId);
        return (
          <EditPartnershipRulesDialog
            open={editRulesDialogOpen}
            onOpenChange={setEditRulesDialogOpen}
            groupId={selectedPartnerForRules.groupId}
            partnerName={selectedPartnerForRules.partnerName}
            currentCostSplit={cfg.costSplitPercent}
            currentProfitSeller={cfg.profitShareSeller}
            currentProfitPartner={cfg.profitSharePartner}
            currentThirdParty={cfg.thirdPartyCommission}
          />
        );
      })()}
    </div>
  );
}
