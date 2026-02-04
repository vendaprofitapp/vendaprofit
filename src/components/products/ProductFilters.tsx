import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Category } from "./CategoryManager";
import { Flame, Clock, Rocket, Lock } from "lucide-react";

export type StockStatusKey = "available" | "low" | "out";
export type MarketingStatusFilter = "opportunity" | "presale" | "launch" | "secret" | "all";

interface Supplier {
  id: string;
  name: string;
}

export interface ProductFiltersState {
  category: string;
  status: StockStatusKey | "all";
  supplier: string;
  color: string;
  size: string;
  minPrice: string;
  maxPrice: string;
  minStock: string;
  maxStock: string;
  marketingStatus: MarketingStatusFilter;
}

interface ProductFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProductFiltersState;
  onFiltersChange: (filters: ProductFiltersState) => void;
  categories: Category[];
  suppliers: Supplier[];
  colors: string[];
  sizes: string[];
}

export function ProductFilters({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  categories,
  suppliers,
  colors,
  sizes,
}: ProductFiltersProps) {
  const updateFilter = <K extends keyof ProductFiltersState>(
    key: K,
    value: ProductFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      category: "all",
      status: "all",
      supplier: "all",
      color: "all",
      size: "all",
      minPrice: "",
      maxPrice: "",
      minStock: "",
      maxStock: "",
      marketingStatus: "all",
    });
  };

  const hasActiveFilters =
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.supplier !== "all" ||
    filters.color !== "all" ||
    filters.size !== "all" ||
    filters.minPrice !== "" ||
    filters.maxPrice !== "" ||
    filters.minStock !== "" ||
    filters.maxStock !== "" ||
    filters.marketingStatus !== "all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
          <DialogDescription>
            Refine a lista de produtos por diversas propriedades
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto">
          {/* Categoria */}
          <div className="grid gap-2">
            <Label>Categoria</Label>
            <Select value={filters.category} onValueChange={(v) => updateFilter("category", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="grid gap-2">
            <Label>Status de Estoque</Label>
            <Select
              value={filters.status}
              onValueChange={(v) => updateFilter("status", v as StockStatusKey | "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponível</SelectItem>
                <SelectItem value="low">Baixo estoque</SelectItem>
                <SelectItem value="out">Esgotado</SelectItem>
              </SelectContent>
          </Select>
          </div>

          {/* Status de Marketing */}
          <div className="grid gap-2">
            <Label>Status de Marketing</Label>
            <Select
              value={filters.marketingStatus}
              onValueChange={(v) => updateFilter("marketingStatus", v as MarketingStatusFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="opportunity">
                  <span className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Oportunidade
                  </span>
                </SelectItem>
                <SelectItem value="presale">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-500" />
                    Pré-venda
                  </span>
                </SelectItem>
                <SelectItem value="launch">
                  <span className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-green-500" />
                    Lançamento
                  </span>
                </SelectItem>
                <SelectItem value="secret">
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-rose-500" />
                    Área Secreta
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fornecedor */}
          <div className="grid gap-2">
            <Label>Fornecedor</Label>
            <Select value={filters.supplier} onValueChange={(v) => updateFilter("supplier", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cor */}
          <div className="grid gap-2">
            <Label>Cor</Label>
            <Select value={filters.color} onValueChange={(v) => updateFilter("color", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {colors.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tamanho */}
          <div className="grid gap-2">
            <Label>Tamanho</Label>
            <Select value={filters.size} onValueChange={(v) => updateFilter("size", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {sizes.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Faixa de Preço */}
          <div className="grid gap-2">
            <Label>Faixa de Preço (R$)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={filters.minPrice}
                onChange={(e) => updateFilter("minPrice", e.target.value)}
              />
              <Input
                type="number"
                placeholder="Máx"
                value={filters.maxPrice}
                onChange={(e) => updateFilter("maxPrice", e.target.value)}
              />
            </div>
          </div>

          {/* Faixa de Estoque */}
          <div className="grid gap-2">
            <Label>Faixa de Estoque</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={filters.minStock}
                onChange={(e) => updateFilter("minStock", e.target.value)}
              />
              <Input
                type="number"
                placeholder="Máx"
                value={filters.maxStock}
                onChange={(e) => updateFilter("maxStock", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={clearFilters} disabled={!hasActiveFilters}>
            Limpar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
