import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Users, ShoppingBag, Tag, Copy, Link2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BazarPermissionsTabProps {
  userId: string;
}

interface CustomerWithPermission {
  id: string;
  name: string;
  phone: string | null;
  total_spent: number;
  permission?: {
    id: string;
    can_sell: boolean;
    can_buy: boolean;
    bazar_token: string;
  };
}

export function BazarPermissionsTab({ userId }: BazarPermissionsTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Fetch customers with their bazar permissions
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["bazar-permissions", userId],
    queryFn: async () => {
      // Fetch customers
      const { data: custs, error: custErr } = await supabase
        .from("customers")
        .select("id, name, phone, total_spent")
        .eq("owner_id", userId)
        .order("name");
      if (custErr) throw custErr;

      // Fetch existing permissions
      const { data: perms, error: permErr } = await supabase
        .from("customer_bazar_permissions")
        .select("id, customer_id, can_sell, can_buy, bazar_token")
        .eq("owner_id", userId);
      if (permErr) throw permErr;

      const permMap = new Map(
        (perms || []).map((p: any) => [p.customer_id, { id: p.id, can_sell: p.can_sell, can_buy: p.can_buy, bazar_token: p.bazar_token }])
      );

      return (custs || []).map((c: any) => ({
        ...c,
        permission: permMap.get(c.id) || undefined,
      })) as CustomerWithPermission[];
    },
    enabled: !!userId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      customerId,
      field,
      value,
      existingPermId,
    }: {
      customerId: string;
      field: "can_sell" | "can_buy";
      value: boolean;
      existingPermId?: string;
    }) => {
      if (existingPermId) {
        const { error } = await supabase
          .from("customer_bazar_permissions")
          .update({ [field]: value })
          .eq("id", existingPermId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_bazar_permissions")
          .insert({
            customer_id: customerId,
            owner_id: userId,
            [field]: value,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bazar-permissions"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const handleToggle = (customer: CustomerWithPermission, field: "can_sell" | "can_buy", value: boolean) => {
    toggleMutation.mutate({
      customerId: customer.id,
      field,
      value,
      existingPermId: customer.permission?.id,
    });
  };

  const copyBazarLink = (token: string) => {
    const link = `${window.location.origin}/bazar/vender?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência!");
  };

  const filteredCustomers = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone || "").includes(q);
  });

  const activeCount = customers.filter((c) => c.permission?.can_sell || c.permission?.can_buy).length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{customers.length}</p>
            <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Com acesso ao Bazar</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{customers.filter((c) => c.permission?.can_sell).length}</p>
            <p className="text-xs text-muted-foreground">Podem vender</p>
          </CardContent>
        </Card>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Permissões por Cliente
          </CardTitle>
          <CardDescription>
            Libere individualmente quem pode vender e/ou comprar no Bazar VIP. Para clientes com permissão de venda, copie o link e envie por WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {customers.length === 0 ? "Nenhum cliente cadastrado. Cadastre clientes primeiro." : "Nenhum cliente encontrado."}
            </p>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Customer info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone || "Sem telefone"}</p>
                      {customer.total_spent > 0 && (
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          R$ {customer.total_spent.toFixed(0)} gasto
                        </Badge>
                      )}
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex flex-col items-center gap-0.5">
                        <Switch
                          checked={customer.permission?.can_sell ?? false}
                          onCheckedChange={(v) => handleToggle(customer, "can_sell", v)}
                          disabled={toggleMutation.isPending}
                        />
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Tag className="h-2.5 w-2.5" /> Vender
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-0.5">
                        <Switch
                          checked={customer.permission?.can_buy ?? false}
                          onCheckedChange={(v) => handleToggle(customer, "can_buy", v)}
                          disabled={toggleMutation.isPending}
                        />
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <ShoppingBag className="h-2.5 w-2.5" /> Comprar
                        </span>
                      </div>

                      {/* Copy link - only if can_sell and has token */}
                      {customer.permission?.can_sell && customer.permission?.bazar_token && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => copyBazarLink(customer.permission!.bazar_token)}
                          title="Copiar link de venda"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Link info */}
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <Link2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Como funciona o link de venda?</p>
            <p className="text-muted-foreground text-xs mt-1">
              Ao ativar "Vender" para um cliente, um link único é gerado. Copie e envie pelo WhatsApp. 
              O cliente acessa, se identifica pelo WhatsApp e cadastra os produtos que deseja vender. 
              Você receberá os itens na aba "Pendentes" para aprovação e precificação.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
