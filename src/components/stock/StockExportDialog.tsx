import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

interface StockExportDialogProps {
  products: Product[];
  suppliers: Supplier[];
  activeFiltersCount: number;
}

interface ColumnOption {
  key: string;
  label: string;
  defaultSelected: boolean;
}

const AVAILABLE_COLUMNS: ColumnOption[] = [
  { key: "nome", label: "Nome", defaultSelected: true },
  { key: "cor", label: "Cor", defaultSelected: true },
  { key: "tamanho", label: "Tamanho", defaultSelected: true },
  { key: "estoque_variante", label: "Estoque Variante", defaultSelected: true },
  { key: "sku", label: "SKU", defaultSelected: false },
  { key: "descricao", label: "Descrição", defaultSelected: false },
  { key: "categoria_1", label: "Categoria 1", defaultSelected: false },
  { key: "categoria_2", label: "Categoria 2", defaultSelected: false },
  { key: "categoria_3", label: "Categoria 3", defaultSelected: false },
  { key: "preco_venda", label: "Preço Venda (R$)", defaultSelected: false },
  { key: "preco_custo", label: "Preço Custo (R$)", defaultSelected: false },
  { key: "estoque_total", label: "Estoque Total Produto", defaultSelected: false },
  { key: "estoque_minimo", label: "Estoque Mínimo", defaultSelected: false },
  { key: "status", label: "Status", defaultSelected: false },
  { key: "fornecedor", label: "Fornecedor", defaultSelected: false },
  { key: "ativo", label: "Ativo", defaultSelected: false },
  { key: "imagem_1", label: "Imagem 1", defaultSelected: false },
  { key: "imagem_2", label: "Imagem 2", defaultSelected: false },
  { key: "imagem_3", label: "Imagem 3", defaultSelected: false },
];

export function StockExportDialog({ products, suppliers, activeFiltersCount }: StockExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(AVAILABLE_COLUMNS.filter(c => c.defaultSelected).map(c => c.key))
  );

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

  const toggleColumn = (key: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedColumns(newSelected);
  };

  const selectAll = () => {
    setSelectedColumns(new Set(AVAILABLE_COLUMNS.map(c => c.key)));
  };

  const selectDefault = () => {
    setSelectedColumns(new Set(AVAILABLE_COLUMNS.filter(c => c.defaultSelected).map(c => c.key)));
  };

  const handleOpenDialog = () => {
    if (products.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }
    setOpen(true);
  };

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      toast.error("Selecione pelo menos uma coluna");
      return;
    }

    setExporting(true);
    try {
      const rows: any[] = [];

      products.forEach((product) => {
        const hasVariants = product.product_variants && product.product_variants.length > 0;

        const buildRow = (variant?: ProductVariant) => {
          const row: any = {};
          
          // Maintain column order based on AVAILABLE_COLUMNS
          AVAILABLE_COLUMNS.forEach((col) => {
            if (!selectedColumns.has(col.key)) return;
            
            switch (col.key) {
              case "nome":
                row["Nome"] = product.name;
                break;
              case "cor":
                row["Cor"] = variant?.color || product.color || "-";
                break;
              case "tamanho":
                row["Tamanho"] = variant?.size || product.size || "-";
                break;
              case "estoque_variante":
                row["Estoque Variante"] = variant ? variant.stock_quantity : "-";
                break;
              case "sku":
                row["SKU"] = product.sku || "-";
                break;
              case "descricao":
                row["Descrição"] = product.description || "-";
                break;
              case "categoria_1":
                row["Categoria 1"] = product.category || "-";
                break;
              case "categoria_2":
                row["Categoria 2"] = product.category_2 || "-";
                break;
              case "categoria_3":
                row["Categoria 3"] = product.category_3 || "-";
                break;
              case "preco_venda":
                row["Preço Venda (R$)"] = product.price.toFixed(2).replace(".", ",");
                break;
              case "preco_custo":
                row["Preço Custo (R$)"] = product.cost_price ? product.cost_price.toFixed(2).replace(".", ",") : "-";
                break;
              case "estoque_total":
                row["Estoque Total Produto"] = product.stock_quantity;
                break;
              case "estoque_minimo":
                row["Estoque Mínimo"] = product.min_stock_level;
                break;
              case "status":
                row["Status"] = getStockStatus(variant?.stock_quantity ?? product.stock_quantity, product.min_stock_level);
                break;
              case "fornecedor":
                row["Fornecedor"] = getSupplierName(product.supplier_id);
                break;
              case "ativo":
                row["Ativo"] = product.is_active ? "Sim" : "Não";
                break;
              case "imagem_1":
                row["Imagem 1"] = product.image_url || "-";
                break;
              case "imagem_2":
                row["Imagem 2"] = product.image_url_2 || "-";
                break;
              case "imagem_3":
                row["Imagem 3"] = product.image_url_3 || "-";
                break;
            }
          });
          
          return row;
        };

        if (hasVariants) {
          product.product_variants!.forEach((variant) => {
            rows.push(buildRow(variant));
          });
        } else {
          rows.push(buildRow());
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Estoque");

      const maxWidth = 50;
      const colWidths = Object.keys(rows[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...rows.map((row) => String(row[key] || "").length)
        );
        return { wch: Math.min(maxLen + 2, maxWidth) };
      });
      worksheet["!cols"] = colWidths;

      const dateStr = format(new Date(), "yyyy-MM-dd_HH-mm");
      const filterSuffix = activeFiltersCount > 0 ? "_filtrado" : "";
      const filename = `estoque${filterSuffix}_${dateStr}.xlsx`;

      XLSX.writeFile(workbook, filename);
      
      toast.success(`Exportados ${rows.length} registros para ${filename}`);
      setOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar estoque");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenDialog}
        disabled={products.length === 0}
      >
        <Download className="h-4 w-4 mr-2" />
        Exportar XLS
        {activeFiltersCount > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({products.length})
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Estoque</DialogTitle>
            <DialogDescription>
              Selecione as colunas que deseja incluir no relatório.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectDefault}>
                Padrão
              </Button>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Selecionar Todos
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
              {AVAILABLE_COLUMNS.map((column) => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.key}
                    checked={selectedColumns.has(column.key)}
                    onCheckedChange={() => toggleColumn(column.key)}
                  />
                  <Label
                    htmlFor={column.key}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {column.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={exporting || selectedColumns.size === 0}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exportando..." : "Exportar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
