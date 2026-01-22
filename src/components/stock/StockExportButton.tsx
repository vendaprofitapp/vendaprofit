import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";

interface ProductVariant {
  id: string;
  size: string;
  color: string | null;
  stock_quantity: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  category_2: string | null;
  category_3: string | null;
  price: number;
  cost_price: number | null;
  size: string | null;
  color: string | null;
  stock_quantity: number;
  min_stock_level: number;
  is_active: boolean;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  supplier_id: string | null;
  sku?: string | null;
  product_variants?: ProductVariant[];
}

interface Supplier {
  id: string;
  name: string;
}

interface StockExportButtonProps {
  products: Product[];
  suppliers: Supplier[];
  activeFiltersCount: number;
}

export function StockExportButton({ products, suppliers, activeFiltersCount }: StockExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return "-";
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || "-";
  };

  const getStockStatus = (quantity: number, minLevel: number) => {
    if (quantity === 0) return "Esgotado";
    if (quantity <= minLevel) return "Baixo";
    return "Disponível";
  };

  const handleExport = async () => {
    if (products.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }

    setExporting(true);
    try {
      // Build rows - one row per product + one row per variant
      const rows: any[] = [];

      products.forEach((product) => {
        const hasVariants = product.product_variants && product.product_variants.length > 0;

        if (hasVariants) {
          // Export each variant as a separate row
          product.product_variants!.forEach((variant) => {
            rows.push({
              "Nome": product.name,
              "SKU": product.sku || "-",
              "Descrição": product.description || "-",
              "Categoria 1": product.category || "-",
              "Categoria 2": product.category_2 || "-",
              "Categoria 3": product.category_3 || "-",
              "Tamanho": variant.size || "-",
              "Cor": variant.color || "-",
              "Preço Venda (R$)": product.price.toFixed(2).replace(".", ","),
              "Preço Custo (R$)": product.cost_price ? product.cost_price.toFixed(2).replace(".", ",") : "-",
              "Estoque Variante": variant.stock_quantity,
              "Estoque Total Produto": product.stock_quantity,
              "Estoque Mínimo": product.min_stock_level,
              "Status": getStockStatus(variant.stock_quantity, product.min_stock_level),
              "Fornecedor": getSupplierName(product.supplier_id),
              "Ativo": product.is_active ? "Sim" : "Não",
              "Imagem 1": product.image_url || "-",
              "Imagem 2": product.image_url_2 || "-",
              "Imagem 3": product.image_url_3 || "-",
            });
          });
        } else {
          // Export product without variants
          rows.push({
            "Nome": product.name,
            "SKU": product.sku || "-",
            "Descrição": product.description || "-",
            "Categoria 1": product.category || "-",
            "Categoria 2": product.category_2 || "-",
            "Categoria 3": product.category_3 || "-",
            "Tamanho": product.size || "-",
            "Cor": product.color || "-",
            "Preço Venda (R$)": product.price.toFixed(2).replace(".", ","),
            "Preço Custo (R$)": product.cost_price ? product.cost_price.toFixed(2).replace(".", ",") : "-",
            "Estoque Variante": "-",
            "Estoque Total Produto": product.stock_quantity,
            "Estoque Mínimo": product.min_stock_level,
            "Status": getStockStatus(product.stock_quantity, product.min_stock_level),
            "Fornecedor": getSupplierName(product.supplier_id),
            "Ativo": product.is_active ? "Sim" : "Não",
            "Imagem 1": product.image_url || "-",
            "Imagem 2": product.image_url_2 || "-",
            "Imagem 3": product.image_url_3 || "-",
          });
        }
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Estoque");

      // Auto-size columns
      const maxWidth = 50;
      const colWidths = Object.keys(rows[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...rows.map((row) => String(row[key] || "").length)
        );
        return { wch: Math.min(maxLen + 2, maxWidth) };
      });
      worksheet["!cols"] = colWidths;

      // Generate filename with date and filter indicator
      const dateStr = format(new Date(), "yyyy-MM-dd_HH-mm");
      const filterSuffix = activeFiltersCount > 0 ? "_filtrado" : "";
      const filename = `estoque${filterSuffix}_${dateStr}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);
      
      toast.success(`Exportados ${rows.length} registros para ${filename}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar estoque");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting || products.length === 0}
    >
      <Download className="h-4 w-4 mr-2" />
      {exporting ? "Exportando..." : "Exportar XLS"}
      {activeFiltersCount > 0 && (
        <span className="ml-1 text-xs text-muted-foreground">
          ({products.length})
        </span>
      )}
    </Button>
  );
}
