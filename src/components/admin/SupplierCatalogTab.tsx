import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Radar, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewProductsScanner } from "./NewProductsScanner";
import { PropagateProductsDialog } from "./PropagateProductsDialog";
import { ProductFormDialog } from "@/components/stock/ProductFormDialog";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price: number | null;
  model: string | null;
  image_url: string | null;
  stock_quantity: number;
  color: string | null;
  color_label: string | null;
  variantCount: number;
}

interface SupplierCatalogTabProps {
  supplierId: string;
  supplierName: string;
  supplierWebsite: string | null;
  supplierB2bUrl: string | null;
  adminId: string;
}

export function SupplierCatalogTab({
  supplierId,
  supplierName,
  supplierWebsite,
  supplierB2bUrl,
  adminId,
}: SupplierCatalogTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showPropagate, setShowPropagate] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, price, cost_price, model, image_url, stock_quantity, color, color_label, product_variants(id)")
      .eq("owner_id", adminId)
      .eq("supplier_id", supplierId)
      .order("name");

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const productsWithVariants: Product[] = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      cost_price: p.cost_price,
      model: p.model,
      image_url: p.image_url,
      stock_quantity: p.stock_quantity,
      color: p.color,
      color_label: p.color_label,
      variantCount: p.product_variants?.length || 0,
    }));

    setProducts(productsWithVariants);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [supplierId]);

  const handleProductClick = async (productId: string) => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (data) {
      setEditingProduct(data);
      setShowEditDialog(true);
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const siteUrl = supplierWebsite || supplierB2bUrl;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{supplierName}</CardTitle>
            <Badge variant="secondary">{products.length} peças</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {siteUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScanner(true)}
              >
                <Radar className="h-4 w-4 mr-1" />
                Buscar Novidades
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPropagate(true)}
            >
              <Send className="h-4 w-4 mr-1" />
              Propagar para Usuários
            </Button>
          </div>
        </div>
        <div className="relative w-full sm:w-64 mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Img</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Variantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => handleProductClick(p.id)}
                  >
                    <TableCell>
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.color_label || p.color || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.model || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.category}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {p.cost_price ? `R$ ${p.cost_price.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {p.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{p.variantCount}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {showScanner && siteUrl && (
        <NewProductsScanner
          open={showScanner}
          onClose={() => {
            setShowScanner(false);
            fetchProducts();
          }}
          supplierName={supplierName}
          supplierId={supplierId}
          siteUrl={siteUrl}
          adminId={adminId}
          existingProductNames={products.map((p) => p.name.toLowerCase())}
        />
      )}

      {showPropagate && (
        <PropagateProductsDialog
          open={showPropagate}
          onClose={() => setShowPropagate(false)}
          supplierName={supplierName}
          supplierId={supplierId}
          adminId={adminId}
        />
      )}

      {showEditDialog && editingProduct && (
        <ProductFormDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditingProduct(null);
          }}
          editingProduct={editingProduct}
          onSuccess={() => {
            setShowEditDialog(false);
            setEditingProduct(null);
            fetchProducts();
          }}
        />
      )}
    </Card>
  );
}
