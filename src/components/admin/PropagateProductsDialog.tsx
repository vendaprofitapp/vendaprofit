import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Search, Users, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PropagateProductsDialogProps {
  open: boolean;
  onClose: () => void;
  supplierName: string;
  supplierId: string;
  adminId: string;
}

interface UserInfo {
  userId: string;
  supplierId: string;
  fullName: string;
  email: string;
  storeName: string | null;
}

export function PropagateProductsDialog({
  open,
  onClose,
  supplierName,
  supplierId,
  adminId,
}: PropagateProductsDialogProps) {
  const [propagating, setPropagating] = useState(false);
  const [result, setResult] = useState<{ users: number; products: number } | null>(null);
  const [progress, setProgress] = useState("");

  // Mode & user selection
  const [mode, setMode] = useState<"all" | "select">("all");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");

  // Load users when dialog opens
  useEffect(() => {
    if (!open) {
      // Reset state on close
      setResult(null);
      setProgress("");
      setMode("all");
      setUsers([]);
      setSelectedUserIds(new Set());
      setUserSearch("");
      return;
    }
    loadUsers();
  }, [open]);

  const loadUsers = async () => {
    setLoadingUsers(true);

    // Find all suppliers with same name (excluding admin)
    const { data: allSuppliers, error: suppError } = await supabase
      .from("suppliers")
      .select("id, owner_id, name")
      .ilike("name", `%${supplierName}%`)
      .neq("owner_id", adminId);

    if (suppError || !allSuppliers?.length) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }

    // Unique owner IDs
    const ownerMap = new Map<string, string>();
    for (const s of allSuppliers) {
      if (!ownerMap.has(s.owner_id)) {
        ownerMap.set(s.owner_id, s.id);
      }
    }

    const ownerIds = Array.from(ownerMap.keys());

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, store_name")
      .in("id", ownerIds);

    const userList: UserInfo[] = (profiles || []).map((p) => ({
      userId: p.id,
      supplierId: ownerMap.get(p.id) || "",
      fullName: p.full_name || "Sem nome",
      email: p.email || "",
      storeName: p.store_name,
    }));

    userList.sort((a, b) => a.fullName.localeCompare(b.fullName));
    setUsers(userList);
    setSelectedUserIds(new Set(userList.map((u) => u.userId)));
    setLoadingUsers(false);
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.storeName || "").toLowerCase().includes(q)
    );
  });

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map((u) => u.userId)));
    }
  };

  const handlePropagate = async () => {
    setPropagating(true);
    setProgress("Buscando produtos do admin...");

    // 1. Get admin products for this supplier
    const { data: adminProducts, error: prodError } = await supabase
      .from("products")
      .select("name, description, category, price, cost_price, sku, size, color, image_url, image_url_2, image_url_3, category_2, category_3, video_url, main_category, subcategory, is_new_release, min_stock_level, model, color_label")
      .eq("owner_id", adminId)
      .eq("supplier_id", supplierId);

    if (prodError || !adminProducts?.length) {
      toast.error("Nenhum produto encontrado para este fornecedor");
      setPropagating(false);
      return;
    }

    // 2. Determine target users
    let targetUsers: Map<string, string>;

    if (mode === "all") {
      setProgress("Buscando usuários com este fornecedor...");
      const { data: allSuppliers, error: suppError } = await supabase
        .from("suppliers")
        .select("id, owner_id, name")
        .ilike("name", `%${supplierName}%`)
        .neq("owner_id", adminId);

      if (suppError || !allSuppliers?.length) {
        toast.info("Nenhum usuário possui este fornecedor");
        setPropagating(false);
        return;
      }

      targetUsers = new Map<string, string>();
      for (const s of allSuppliers) {
        if (!targetUsers.has(s.owner_id)) {
          targetUsers.set(s.owner_id, s.id);
        }
      }
    } else {
      // Selective mode - use selected users from loaded list
      if (selectedUserIds.size === 0) {
        toast.error("Selecione pelo menos um usuário");
        setPropagating(false);
        return;
      }
      targetUsers = new Map<string, string>();
      for (const u of users) {
        if (selectedUserIds.has(u.userId)) {
          targetUsers.set(u.userId, u.supplierId);
        }
      }
    }

    let totalPropagated = 0;
    let userCount = 0;

    for (const [userId, userSupplierId] of targetUsers) {
      setProgress(`Processando usuário ${++userCount}/${targetUsers.size}...`);

      const { data: existingProducts } = await supabase
        .from("products")
        .select("name")
        .eq("owner_id", userId)
        .eq("supplier_id", userSupplierId);

      const existingNames = new Set(
        (existingProducts || []).map((p) => p.name.toLowerCase())
      );

      const missing = adminProducts.filter(
        (p) => !existingNames.has(p.name.toLowerCase())
      );

      if (missing.length === 0) continue;

      const inserts = missing.map((p) => ({
        owner_id: userId,
        supplier_id: userSupplierId,
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        cost_price: p.cost_price,
        sku: p.sku,
        size: p.size,
        color: p.color,
        image_url: p.image_url,
        image_url_2: p.image_url_2,
        image_url_3: p.image_url_3,
        category_2: p.category_2,
        category_3: p.category_3,
        video_url: p.video_url,
        main_category: p.main_category,
        subcategory: p.subcategory,
        is_new_release: p.is_new_release,
        min_stock_level: p.min_stock_level || 0,
        model: p.model,
        color_label: p.color_label,
        stock_quantity: 0,
        is_active: true,
      }));

      const { error: insertError } = await supabase
        .from("products")
        .insert(inserts);

      if (!insertError) {
        totalPropagated += missing.length;
      }
    }

    setResult({ users: targetUsers.size, products: totalPropagated });
    setProgress("");
    toast.success(
      `${totalPropagated} produtos propagados para ${targetUsers.size} usuários!`
    );
    setPropagating(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Propagar Produtos — {supplierName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copiar produtos do catálogo master de{" "}
            <strong>{supplierName}</strong> para os usuários que possuem este
            fornecedor (inserindo apenas os que ainda não existem, com estoque 0).
          </p>

          {!result && (
            <>
              {/* Mode selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Destino</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as "all" | "select")}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="all" id="mode-all" />
                    <Label htmlFor="mode-all" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Todos os usuários</p>
                        <p className="text-xs text-muted-foreground">
                          Propagar para todos que possuem {supplierName}
                          {users.length > 0 && ` (${users.length} encontrados)`}
                        </p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="select" id="mode-select" />
                    <Label htmlFor="mode-select" className="flex items-center gap-2 cursor-pointer flex-1">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Escolher usuários</p>
                        <p className="text-xs text-muted-foreground">
                          Selecionar manualmente quais usuários receberão
                        </p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* User selection list */}
              {mode === "select" && (
                <div className="space-y-3 border rounded-lg p-3">
                  {loadingUsers ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando usuários...
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum usuário possui este fornecedor.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar usuário..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="pl-10 h-8 text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleAll}
                          className="text-xs whitespace-nowrap"
                        >
                          {selectedUserIds.size === users.length
                            ? "Desmarcar todos"
                            : "Selecionar todos"}
                        </Button>
                      </div>

                      <Badge variant="outline" className="text-xs">
                        {selectedUserIds.size} de {users.length} selecionados
                      </Badge>

                      <ScrollArea className="max-h-48">
                        <div className="space-y-1">
                          {filteredUsers.map((u) => (
                            <div
                              key={u.userId}
                              className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                              onClick={() => toggleUser(u.userId)}
                            >
                              <Checkbox
                                checked={selectedUserIds.has(u.userId)}
                                onCheckedChange={() => toggleUser(u.userId)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{u.fullName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {u.email}
                                  {u.storeName && ` · ${u.storeName}`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {progress && (
            <Badge variant="outline" className="text-xs">
              {progress}
            </Badge>
          )}

          {result && (
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-lg font-bold text-foreground">
                {result.products} produto(s) propagado(s)
              </p>
              <p className="text-sm text-muted-foreground">
                para {result.users} usuário(s)
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button
              onClick={handlePropagate}
              disabled={propagating || (mode === "select" && selectedUserIds.size === 0)}
            >
              {propagating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {propagating ? "Propagando..." : "Propagar Agora"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
