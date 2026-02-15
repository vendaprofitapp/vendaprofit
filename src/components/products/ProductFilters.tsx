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
import { Flame, Clock, Rocket, Lock } from "lucide-react";

export type StockStatusKey = "available" | "low" | "out";
export type MarketingStatusFilter = "opportunity" | "presale" | "launch" | "secret" | "all";

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

export interface ProductFiltersState {
  mainCategory: string;
  subcategory: string;
  isNewRelease: string;
  status: StockStatusKey | "all";
  supplier: string;
  color: string;
  size: string;
  minPrice: string;
  maxPrice: string;
  minCost: string;
  maxCost: string;
  minStock: string;
  maxStock: string;
  marketingStatus: MarketingStatusFilter;
}

interface ProductFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProductFiltersState;
  onFiltersChange: (filters: ProductFiltersState) => void;
  mainCategories: MainCategory[];
  subcategories: Subcategory[];
  suppliers: Supplier[];
  colors: string[];
  sizes: string[];
}

export function ProductFilters({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  mainCategories,
  subcategories,
  suppliers,
  colors,
  sizes,
}: ProductFiltersProps) {
  // Defensive defaults for arrays
  const safeMainCategories = mainCategories || [];
  const safeSubcategories = subcategories || [];
  const safeSuppliers = suppliers || [];
  const safeColors = colors || [];
  const safeSizes = sizes || [];

  const updateFilter = <K extends keyof ProductFiltersState>(
    key: K,
    value: ProductFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      mainCategory: "all",
      subcategory: "all",
      isNewRelease: "all",
      status: "all",
      supplier: "all",
      color: "all",
      size: "all",
      minPrice: "",
      maxPrice: "",
      minCost: "",
      maxCost: "",
      minStock: "",
      maxStock: "",
      marketingStatus: "all",
    });
  };

  // Get subcategories for selected main category
  const selectedMainCat = safeMainCategories.find(c => c.name === filters.mainCategory);
  const availableSubcategories = selectedMainCat
    ? safeSubcategories.filter(s => s.main_category_id === selectedMainCat.id)
    : [];

  const hasActiveFilters =
    filters.mainCategory !== "all" ||
    filters.subcategory !== "all" ||
    filters.isNewRelease !== "all" ||
    filters.status !== "all" ||
    filters.supplier !== "all" ||
    filters.color !== "all" ||
    filters.size !== "all" ||
    filters.minPrice !== "" ||
    filters.maxPrice !== "" ||
    filters.minCost !== "" ||
    filters.maxCost !== "" ||
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
          {/* Lançamentos */}
          <div className="grid gap-2">
            <Label>Lançamentos</Label>
            <Select value={filters.isNewRelease} onValueChange={(v) => updateFilter("isNewRelease", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">🚀 Apenas Lançamentos</SelectItem>
                <SelectItem value="no">Sem Lançamentos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categoria Principal */}
          <div className="grid gap-2">
            <Label>Categoria Principal</Label>
            <Select value={filters.mainCategory} onValueChange={(v) => {
              onFiltersChange({ ...filters, mainCategory: v, subcategory: "all" });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {safeMainCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria */}
          {availableSubcategories.length > 0 && (
            <div className="grid gap-2">
              <Label>Subcategoria</Label>
              <Select value={filters.subcategory} onValueChange={(v) => updateFilter("subcategory", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {availableSubcategories.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                {safeSuppliers.map((s) => (
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
                {safeColors.map((c) => (
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
                {safeSizes.map((s) => (
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

          {/* Faixa de Preço de Custo */}
          <div className="grid gap-2">
            <Label>Faixa de Preço de Custo (R$)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={filters.minCost}
                onChange={(e) => updateFilter("minCost", e.target.value)}
              />
              <Input
                type="number"
                placeholder="Máx"
                value={filters.maxCost}
                onChange={(e) => updateFilter("maxCost", e.target.value)}
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
