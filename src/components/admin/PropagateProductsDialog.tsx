import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PropagateProductsDialogProps {
  open: boolean;
  onClose: () => void;
  supplierName: string;
  supplierId: string;
  adminId: string;
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

    setProgress("Buscando usuários com este fornecedor...");

    // 2. Find all users who have this supplier (by name, ilike)
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

    // Group by user
    const userSuppliers = new Map<string, string>();
    for (const s of allSuppliers) {
      if (!userSuppliers.has(s.owner_id)) {
        userSuppliers.set(s.owner_id, s.id);
      }
    }

    let totalPropagated = 0;
    let userCount = 0;

    for (const [userId, userSupplierId] of userSuppliers) {
      setProgress(`Processando usuário ${++userCount}/${userSuppliers.size}...`);

      // Get existing product names for this user+supplier
      const { data: existingProducts } = await supabase
        .from("products")
        .select("name")
        .eq("owner_id", userId)
        .eq("supplier_id", userSupplierId);

      const existingNames = new Set(
        (existingProducts || []).map((p) => p.name.toLowerCase())
      );

      // Filter missing products
      const missing = adminProducts.filter(
        (p) => !existingNames.has(p.name.toLowerCase())
      );

      if (missing.length === 0) continue;

      // Insert missing products
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

    setResult({ users: userSuppliers.size, products: totalPropagated });
    setProgress("");
    toast.success(
      `${totalPropagated} produtos propagados para ${userSuppliers.size} usuários!`
    );
    setPropagating(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Propagar Produtos — {supplierName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta ação vai copiar todos os produtos do catálogo master de{" "}
            <strong>{supplierName}</strong> para todos os usuários que possuem
            este fornecedor, inserindo apenas os que ainda não existem (com
            estoque 0).
          </p>

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
            <Button onClick={handlePropagate} disabled={propagating}>
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
