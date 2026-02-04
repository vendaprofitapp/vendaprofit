import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomerFiltersState {
  categories: string[];
  sizes: string[];
  colors: string[];
}

interface CustomerFiltersProps {
  availableCategories: string[];
  availableSizes: string[];
  availableColors: string[];
  filters: CustomerFiltersState;
  onFiltersChange: (filters: CustomerFiltersState) => void;
  primaryColor: string;
}

export function CustomerFilters({
  availableCategories,
  availableSizes,
  availableColors,
  filters,
  onFiltersChange,
  primaryColor,
}: CustomerFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    sizes: true,
    colors: true,
  });

  const activeFiltersCount = 
    filters.categories.length + 
    filters.sizes.length + 
    filters.colors.length;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleFilter = (type: keyof CustomerFiltersState, value: string) => {
    const current = filters[type];
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    
    onFiltersChange({
      ...filters,
      [type]: newValues,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      categories: [],
      sizes: [],
      colors: [],
    });
  };

  const FilterSection = ({
    title,
    sectionKey,
    items,
    selected,
    onToggle,
  }: {
    title: string;
    sectionKey: string;
    items: string[];
    selected: string[];
    onToggle: (value: string) => void;
  }) => {
    const isExpanded = expandedSections[sectionKey];
    
    if (items.length === 0) return null;

    return (
      <div className="border-b border-gray-100 py-4">
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={() => toggleSection(sectionKey)}
        >
          <span className="font-medium text-gray-900">
            {title}
            {selected.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({selected.length})
              </span>
            )}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        
        {isExpanded && (
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map(item => {
              const isSelected = selected.includes(item);
              return (
                <button
                  key={item}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-all",
                    isSelected
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                  style={{
                    backgroundColor: isSelected ? primaryColor : undefined,
                  }}
                  onClick={() => onToggle(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full shrink-0"
        >
          <Filter className="h-4 w-4" />
          {activeFiltersCount > 0 && (
            <span
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-sm bg-white">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </span>
            {activeFiltersCount > 0 && (
              <button
                className="text-sm font-normal text-gray-500 hover:text-gray-700"
                onClick={clearAllFilters}
              >
                Limpar todos
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto max-h-[calc(100vh-180px)] pb-20">
          <FilterSection
            title="Categorias"
            sectionKey="categories"
            items={availableCategories}
            selected={filters.categories}
            onToggle={(value) => toggleFilter("categories", value)}
          />

          <FilterSection
            title="Tamanhos"
            sectionKey="sizes"
            items={availableSizes}
            selected={filters.sizes}
            onToggle={(value) => toggleFilter("sizes", value)}
          />

          <FilterSection
            title="Cores"
            sectionKey="colors"
            items={availableColors}
            selected={filters.colors}
            onToggle={(value) => toggleFilter("colors", value)}
          />
        </div>

        {/* Apply Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            className="w-full"
            style={{ backgroundColor: primaryColor }}
            onClick={() => setIsOpen(false)}
          >
            Ver resultados
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Active Filters Display Component - to be used separately
export function ActiveFiltersDisplay({
  filters,
  onFiltersChange,
  primaryColor,
}: {
  filters: CustomerFiltersState;
  onFiltersChange: (filters: CustomerFiltersState) => void;
  primaryColor: string;
}) {
  const activeFiltersCount = 
    filters.categories.length + 
    filters.sizes.length + 
    filters.colors.length;

  if (activeFiltersCount === 0) return null;

  const toggleFilter = (type: keyof CustomerFiltersState, value: string) => {
    const current = filters[type];
    const newValues = current.filter(v => v !== value);
    onFiltersChange({
      ...filters,
      [type]: newValues,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      categories: [],
      sizes: [],
      colors: [],
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 max-w-2xl mx-auto px-4">
      {filters.categories.map(cat => (
        <Badge
          key={`cat-${cat}`}
          variant="secondary"
          className="px-2 py-1 gap-1 cursor-pointer hover:bg-gray-200 text-xs"
          onClick={() => toggleFilter("categories", cat)}
        >
          {cat}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      {filters.sizes.map(size => (
        <Badge
          key={`size-${size}`}
          variant="secondary"
          className="px-2 py-1 gap-1 cursor-pointer hover:bg-gray-200 text-xs"
          onClick={() => toggleFilter("sizes", size)}
        >
          Tam: {size}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      {filters.colors.map(color => (
        <Badge
          key={`color-${color}`}
          variant="secondary"
          className="px-2 py-1 gap-1 cursor-pointer hover:bg-gray-200 text-xs"
          onClick={() => toggleFilter("colors", color)}
        >
          {color}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      <button
        className="text-xs text-gray-500 hover:text-gray-700 underline"
        onClick={clearAllFilters}
      >
        Limpar
      </button>
    </div>
  );
}
