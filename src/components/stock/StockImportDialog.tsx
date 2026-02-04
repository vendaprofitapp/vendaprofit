import { useState, useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Upload, FileSpreadsheet, Camera, Loader2, Check, X, AlertCircle, Image as ImageIcon, Trash2, Edit, Link, FileText, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SupplierSelect } from "./SupplierSelect";
import { SupplierImageScraper } from "./SupplierImageScraper";
import { CategoryManager } from "@/components/products/CategoryManager";
import { ColorManager, Color, findMatchingColor } from "@/components/products/ColorManager";
import { ProductColorCombobox } from "./ProductColorCombobox";

const availableSizes = ["PP", "P", "M", "G", "GG", "XG", "XXG", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "Único"];

interface ProductVariant {
  color: string | null;
  size: string | null;
  quantity: number;
}

interface ColorImages {
  urls: string[];
  files: File[];
  previewUrls: string[];
}

interface ImportedProduct {
  name: string;
  original_name: string;
  size: string | null;
  color: string | null;
  cost_price: number;
  price: number;
  quantity: number;
  category: string;
  description: string;
  min_stock_level: number;
  selected: boolean;
  existingProduct: ExistingProduct | null;
  images: File[];
  imageUrls: string[];
  isEditing: boolean;
  hasErrors: boolean;
  variants: ProductVariant[];
  colorImages: { [color: string]: ColorImages };
}

interface ExistingProduct {
  id: string;
  name: string;
  stock_quantity: number;
}

interface StockImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

// Sub-component for editing product with variants

interface EditProductWithVariantsDialogProps {
  product: ImportedProduct;
  categories: { id: string; name: string }[];
  userColors: Color[];
  onClose: () => void;
  onUpdateProduct: (updates: Partial<ImportedProduct>) => void;
  onUpdateVariants: (variants: ProductVariant[]) => void;
  onUpdateColorImages: (colorImages: { [color: string]: ColorImages }) => void;
}

function EditProductWithVariantsDialog({
  product,
  categories,
  userColors,
  onClose,
  onUpdateProduct,
  onUpdateVariants,
  onUpdateColorImages,
}: EditProductWithVariantsDialogProps) {
  const imageInputRefs = useRef<{ [color: string]: HTMLInputElement | null }>({});
  const [expandedColors, setExpandedColors] = useState<{ [color: string]: boolean }>({});
  // Initialize colorImages from product.colorImages if available
  const [colorImages, setColorImages] = useState<{ [color: string]: ColorImages }>(() => {
    return product.colorImages || {};
  });
  
  const [localVariants, setLocalVariants] = useState<ProductVariant[]>(() => {
    // Initialize with existing variants or create one from product data
    if (product.variants.length > 0) {
      return product.variants;
    }
    // Create initial variant from product color/size/quantity
    return [{
      color: product.color,
      size: product.size,
      quantity: product.quantity,
    }];
  });

  // Keep parent in sync
  useEffect(() => {
    onUpdateVariants(localVariants);
  }, [localVariants]);

  // Sync color images with parent
  useEffect(() => {
    onUpdateColorImages(colorImages);
  }, [colorImages]);

  // Get unique colors from variants
  const getUniqueColors = (): string[] => {
    const colors = new Set<string>();
    localVariants.forEach(v => {
      if (v.color) colors.add(v.color);
    });
    return Array.from(colors);
  };

  // Group variants by color
  const variantsByColor = localVariants.reduce((acc, variant, index) => {
    const color = variant.color || "__no_color__";
    if (!acc[color]) acc[color] = [];
    acc[color].push({ variant, index });
    return acc;
  }, {} as { [color: string]: { variant: ProductVariant; index: number }[] });

  const totalStock = localVariants.reduce((sum, v) => sum + (v.quantity || 0), 0);

  const addVariant = () => {
    setLocalVariants(prev => [...prev, { color: null, size: null, quantity: 0, sku: null }]);
  };

  const removeVariant = (index: number) => {
    const variant = localVariants[index];
    setLocalVariants(prev => prev.filter((_, i) => i !== index));
    
    // Check if this was the last variant with this color
    const remainingWithColor = localVariants.filter((v, i) => i !== index && v.color === variant.color);
    if (remainingWithColor.length === 0 && variant.color) {
      // Clean up images for this color
      const ci = colorImages[variant.color];
      if (ci) {
        ci.previewUrls.forEach(url => URL.revokeObjectURL(url));
      }
      setColorImages(prev => {
        const { [variant.color!]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number | null) => {
    const oldVariant = localVariants[index];
    
    setLocalVariants(prev => prev.map((v, i) => 
      i === index ? { ...v, [field]: value } : v
    ));
    
    // If color changed, initialize color images for new color
    if (field === 'color' && typeof value === 'string' && value !== oldVariant.color) {
      if (value && !colorImages[value]) {
        setColorImages(prev => ({
          ...prev,
          [value]: { urls: [], files: [], previewUrls: [] }
        }));
      }
      
      // Check if old color still has variants
      const remainingWithOldColor = localVariants.filter((v, i) => i !== index && v.color === oldVariant.color);
      if (remainingWithOldColor.length === 0 && oldVariant.color) {
        const ci = colorImages[oldVariant.color];
        if (ci) {
          ci.previewUrls.forEach(url => URL.revokeObjectURL(url));
        }
        setColorImages(prev => {
          const { [oldVariant.color!]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  const toggleColorExpanded = (color: string) => {
    setExpandedColors(prev => ({ ...prev, [color]: !prev[color] }));
  };

  // Handle image upload for a specific color
  const handleColorImageUpload = (color: string, files: FileList | null) => {
    if (!files || !color) return;
    
    const currentImages = colorImages[color] || { urls: [], files: [], previewUrls: [] };
    const totalCurrent = currentImages.urls.length + currentImages.files.length;
    const available = 3 - totalCurrent;
    
    if (available <= 0) {
      toast.error("Máximo de 3 fotos por cor");
      return;
    }
    
    const newFiles = Array.from(files).slice(0, available);
    const newUrls = newFiles.map(file => URL.createObjectURL(file));
    
    setColorImages(prev => ({
      ...prev,
      [color]: {
        urls: currentImages.urls,
        files: [...currentImages.files, ...newFiles],
        previewUrls: [...currentImages.previewUrls, ...newUrls]
      }
    }));
  };

  // Remove image from a color
  const removeColorImage = (color: string, index: number, isUrl: boolean) => {
    setColorImages(prev => {
      const current = prev[color];
      if (!current) return prev;
      
      if (isUrl) {
        return {
          ...prev,
          [color]: {
            ...current,
            urls: current.urls.filter((_, i) => i !== index)
          }
        };
      } else {
        URL.revokeObjectURL(current.previewUrls[index]);
        return {
          ...prev,
          [color]: {
            ...current,
            files: current.files.filter((_, i) => i !== index),
            previewUrls: current.previewUrls.filter((_, i) => i !== index)
          }
        };
      }
    });
  };

  // Handle images from supplier scraper for a color
  const handleColorImagesFromSupplier = (color: string, urls: string[]) => {
    const currentImages = colorImages[color] || { urls: [], files: [], previewUrls: [] };
    const totalCurrent = currentImages.urls.length + currentImages.files.length;
    const available = 3 - totalCurrent;
    
    if (available <= 0) {
      toast.error("Máximo de 3 fotos por cor");
      return;
    }
    
    const urlsToAdd = urls.slice(0, available);
    
    setColorImages(prev => ({
      ...prev,
      [color]: {
        urls: [...currentImages.urls, ...urlsToAdd],
        files: currentImages.files,
        previewUrls: currentImages.previewUrls
      }
    }));
    
    toast.success(`${urlsToAdd.length} imagem(ns) adicionada(s) para ${color}`);
  };

  // Render images section for a color
  const renderColorImages = (color: string) => {
    const images = colorImages[color] || { urls: [], files: [], previewUrls: [] };
    const totalColorImages = images.urls.length + images.previewUrls.length;
    
    return (
      <div className="pl-4 py-2 border-l-2 border-primary/20 mt-2 space-y-3">
        {/* Supplier Import for this specific color */}
        <SupplierImageScraper
          maxImages={3}
          currentImageCount={totalColorImages}
          onImagesSelected={(urls) => handleColorImagesFromSupplier(color, urls)}
        />
        
        {/* Current images for this color */}
        <div className="flex gap-2 items-center flex-wrap">
          {images.urls.map((url, idx) => (
            <div key={`url-${idx}`} className="relative w-14 h-14">
              <img 
                src={url} 
                alt={`Foto ${idx + 1}`} 
                className="w-full h-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeColorImage(color, idx, true)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow-md"
              >
                ×
              </button>
            </div>
          ))}
          
          {images.previewUrls.map((url, idx) => (
            <div key={`preview-${idx}`} className="relative w-14 h-14">
              <img 
                src={url} 
                alt={`Nova foto ${idx + 1}`} 
                className="w-full h-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeColorImage(color, idx, false)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow-md"
              >
                ×
              </button>
            </div>
          ))}
          
          {totalColorImages < 3 && (
            <>
              <input
                ref={el => { imageInputRefs.current[color] = el; }}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleColorImageUpload(color, e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRefs.current[color]?.click()}
                className="w-14 h-14 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[8px] text-muted-foreground mt-0.5">Foto</span>
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {totalColorImages}/3 fotos para esta cor
        </p>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
          <DialogDescription>Preencha os dados e variantes do produto</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input 
                value={product.name}
                onChange={(e) => onUpdateProduct({ name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea 
                value={product.description || ""}
                onChange={(e) => onUpdateProduct({ description: e.target.value })}
                placeholder="Descrição do produto..."
                rows={2}
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Categoria *</Label>
              <CategoryManager
                value={product.category}
                onChange={(value) => onUpdateProduct({ category: value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Preço de Venda *</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={product.price}
                  onChange={(e) => onUpdateProduct({ price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Preço de Custo</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={product.cost_price}
                  onChange={(e) => onUpdateProduct({ cost_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Estoque Mínimo</Label>
              <Input 
                type="number"
                value={product.min_stock_level}
                onChange={(e) => onUpdateProduct({ min_stock_level: parseInt(e.target.value) || 5 })}
              />
            </div>

            {/* Variants Section grouped by Color */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Variantes por Cor *</Label>
                <span className="text-sm text-muted-foreground">
                  Total: {totalStock} un.
                </span>
              </div>
              
              <div className="space-y-4">
                {Object.entries(variantsByColor).map(([color, items]) => (
                  <Collapsible 
                    key={color} 
                    open={expandedColors[color] ?? true}
                    onOpenChange={() => toggleColorExpanded(color)}
                  >
                    <div className="border rounded-lg p-3 bg-muted/30">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {color === "__no_color__" ? "Sem cor definida" : color}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({items.length} variante{items.length > 1 ? 's' : ''})
                            </span>
                          </div>
                          {expandedColors[color] ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        {/* Images for this color */}
                        {color !== "__no_color__" && renderColorImages(color)}
                        
                        {/* Variants for this color */}
                        <div className="space-y-2 mt-3">
                          {items.map(({ variant, index }) => (
                            <div key={index} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                              <Select
                                value={variant.size || ""}
                                onValueChange={(value) => updateVariant(index, "size", value || null)}
                              >
                                <SelectTrigger className="w-20 sm:w-24">
                                  <SelectValue placeholder="Tam." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSizes.map((size) => (
                                    <SelectItem key={size} value={size}>
                                      {size}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              <div className="w-28 sm:w-32">
                                <ProductColorCombobox
                                  value={variant.color || ""}
                                  onChange={(value) => updateVariant(index, "color", value || null)}
                                  existingProductId={product.existingProduct?.id || null}
                                  userColors={userColors}
                                  placeholder="Cor"
                                />
                              </div>
                              
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="Qtd"
                                className="w-16 sm:w-20"
                                value={variant.quantity || ""}
                                onChange={(e) => updateVariant(index, "quantity", parseInt(e.target.value) || 0)}
                              />
                              
                              
                              {localVariants.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                                  onClick={() => removeVariant(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariant}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Variante
              </Button>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StockImportDialog({ open, onOpenChange, onImportComplete }: StockImportDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const productImageRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ImportedProduct[]>([]);
  const [existingProducts, setExistingProducts] = useState<ExistingProduct[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [step, setStep] = useState<"upload" | "review" | "edit">("upload");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [userColors, setUserColors] = useState<Color[]>([]);

  // Fetch existing products, categories and colors for duplicate detection
  useEffect(() => {
    if (user && open) {
      fetchExistingProducts();
      fetchCategories();
      fetchUserColors();
    }
  }, [user, open]);

  const fetchUserColors = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("colors")
      .select("id, name, hex_code, owner_id")
      .eq("owner_id", user.id);
    setUserColors(data || []);
  };

  // Normalize color name to match existing colors (case-insensitive)
  const normalizeColorToExisting = (colorName: string | null): string | null => {
    if (!colorName) return null;
    const matchingColor = findMatchingColor(colorName, userColors);
    return matchingColor ? matchingColor.name : colorName;
  };

  // Extended interface for existing products with category
  interface ExistingProductWithCategory extends ExistingProduct {
    category: string;
  }
  
  const [existingProductsFull, setExistingProductsFull] = useState<ExistingProductWithCategory[]>([]);

  const fetchExistingProducts = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("products")
      .select("id, name, stock_quantity, category")
      .eq("owner_id", user.id);
    
    // Also set for backward compatibility
    setExistingProducts(data?.map(p => ({ id: p.id, name: p.name, stock_quantity: p.stock_quantity })) || []);
    setExistingProductsFull(data || []);
  };

  const fetchCategories = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("categories")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("name");
    
    setCategories(data || []);
  };

  // Normalize name: lowercase, trim, collapse multiple spaces, and remove accents
  const normalizeName = (name: string) => 
    name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // Remove diacritical marks (accents)

  const findDuplicate = (name: string): ExistingProductWithCategory | null => {
    // Check by name (normalized - case insensitive, trimmed, no accents)
    const normalizedName = normalizeName(name);
    
    // First try exact match (after normalization)
    const exactMatch = existingProductsFull.find(p => 
      normalizeName(p.name) === normalizedName
    );
    
    if (exactMatch) return exactMatch;
    
    // Fallback: try "contains" match (one contains the other)
    const containsMatch = existingProductsFull.find(p => {
      const normalizedExisting = normalizeName(p.name);
      return normalizedExisting.includes(normalizedName) || normalizedName.includes(normalizedExisting);
    });
    
    return containsMatch || null;
  };

  const checkProductErrors = (product: ImportedProduct): boolean => {
    // Products matching existing ones don't need category
    if (product.existingProduct) return !product.name.trim();
    return !product.name.trim() || !product.category;
  };

  const resetState = () => {
    setProducts([]);
    setSupplierName("");
    setSupplierId("");
    setStep("upload");
    setLoading(false);
    setEditingIndex(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const processProducts = (parsedProducts: { name: string; original_name?: string; sku: string | null; size: string | null; color: string | null; cost_price: number; price?: number; quantity: number; category?: string }[]) => {
    // Expand items that contain multiple colors in a single line (e.g. "ROSA, NAVY BLUE E PRETA")
    const splitColors = (raw: string) => {
      const cleaned = raw
        .replace(/\s+e\s+/gi, ",")
        .replace(/\s+&\s+/g, ",")
        .replace(/\s+ou\s+/gi, ",")
        .replace(/\//g, ",");

      return cleaned
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        // remove duplicates while keeping order
        .filter((c, idx, arr) => arr.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === idx);
    };

    const expandedProducts = parsedProducts.flatMap((p) => {
      const colors = p.color ? splitColors(p.color) : [];
      if (colors.length <= 1) return [p];

      // Distribute quantity across colors (keeps total quantity the same)
      const base = Math.floor((p.quantity || 0) / colors.length);
      let remainder = (p.quantity || 0) - base * colors.length;

      return colors.map((color) => {
        const q = base + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        return { ...p, color, quantity: q };
      });
    }).filter((p) => (p.quantity || 0) > 0);

    console.log("Processando produtos (original):", parsedProducts);
    console.log("Processando produtos (expandido):", expandedProducts);
    
    // Group products by cleaned name to create variants
    const productGroups = new Map<string, typeof parsedProducts>();

    for (const p of expandedProducts) {
      const cleanName = normalizeName(p.name);
      const existing = productGroups.get(cleanName) || [];
      existing.push(p);
      productGroups.set(cleanName, existing);
    }

    console.log("Grupos de produtos:", Array.from(productGroups.entries()));

    const processed: ImportedProduct[] = [];

    for (const [groupName, items] of productGroups) {
      // Use the first item as the base product
      const baseItem = items[0];
      const existing = findDuplicate(baseItem.name);
      
      // Create variants from all items in the group
      // Always create variants if we have color OR size detected
      const variants: ProductVariant[] = items.map(item => ({
        color: normalizeColorToExisting(item.color),
        size: item.size,
        quantity: item.quantity,
      }));

      // Calculate total quantity
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      // Check if any variant has color or size
      const hasVariantInfo = variants.some(v => v.color || v.size);
      
      console.log(`Produto "${groupName}": ${items.length} item(s), hasVariantInfo: ${hasVariantInfo}, variants:`, variants);

      // Inherit category from existing product if available
      const inheritedCategory = existing?.category || baseItem.category || "";

      const product: ImportedProduct = {
        name: baseItem.name.trim().replace(/\s+/g, ' '), // Normalize name spaces
        original_name: items.map(i => i.original_name || i.name).join(", "),
        // Always populate color/size from first variant
        size: variants[0]?.size || null,
        color: variants[0]?.color || null,
        cost_price: baseItem.cost_price,
        price: baseItem.price || 0,
        quantity: totalQuantity,
        category: inheritedCategory,
        description: "",
        min_stock_level: 5,
        selected: true,
        existingProduct: existing,
        images: [],
        imageUrls: [],
        isEditing: false,
        hasErrors: false,
        // Store variants if more than 1 item OR if we have variant info
        variants: items.length > 1 ? variants : (hasVariantInfo ? variants : []),
        colorImages: {},
      };
      product.hasErrors = checkProductErrors(product);
      processed.push(product);
    }
    
    console.log("Produtos processados finais:", processed);
    setProducts(processed);
    setStep("review");
  };

  const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("Planilha vazia ou sem dados");
        setLoading(false);
        return;
      }

      const delimiter = text.includes('\t') ? '\t' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
      
      const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name') || h.includes('produto'));
      // SKU column removed - we no longer use SKU
      const sizeIdx = headers.findIndex(h => h.includes('tamanho') || h.includes('size') || h.includes('tam'));
      const colorIdx = headers.findIndex(h => h.includes('cor') || h.includes('color'));
      const costIdx = headers.findIndex(h => h.includes('custo') || h.includes('cost'));
      const priceIdx = headers.findIndex(h => h.includes('venda') || h.includes('price') || h.includes('preco') || h.includes('preço'));
      const qtyIdx = headers.findIndex(h => h.includes('qtd') || h.includes('quantidade') || h.includes('qty') || h.includes('quantity'));
      const categoryIdx = headers.findIndex(h => h.includes('categoria') || h.includes('category'));

      if (nameIdx === -1) {
        toast.error("Coluna 'Nome' não encontrada na planilha");
        setLoading(false);
        return;
      }

      const parsedProducts = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        const name = values[nameIdx];
        
        if (!name) continue;

        parsedProducts.push({
          name,
          size: sizeIdx >= 0 ? values[sizeIdx] || null : null,
          color: colorIdx >= 0 ? values[colorIdx] || null : null,
          cost_price: costIdx >= 0 ? parseFloat(values[costIdx]?.replace(',', '.')) || 0 : 0,
          price: priceIdx >= 0 ? parseFloat(values[priceIdx]?.replace(',', '.')) || 0 : 0,
          quantity: qtyIdx >= 0 ? parseInt(values[qtyIdx]) || 1 : 1,
          category: categoryIdx >= 0 ? values[categoryIdx] || "" : "",
        });
      }

      if (parsedProducts.length === 0) {
        toast.error("Nenhum produto encontrado na planilha");
        setLoading(false);
        return;
      }

      processProducts(parsedProducts);
      toast.success(`${parsedProducts.length} produtos encontrados`);
    } catch (error) {
      console.error("Error parsing spreadsheet:", error);
      toast.error("Erro ao processar planilha");
    }
    
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato inválido. Use imagem (JPG, PNG) ou PDF");
      return;
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 20MB");
      return;
    }

    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        const { data, error } = await supabase.functions.invoke('parse-invoice', {
          body: { imageBase64: base64, mimeType: file.type }
        });

        if (error || !data?.success) {
          toast.error(data?.error || "Erro ao processar nota fiscal");
          setLoading(false);
          return;
        }

        const invoiceData = data.data;
        
        if (invoiceData.supplier) {
          setSupplierName(invoiceData.supplier);
        }

        const parsedProducts = (invoiceData.products || []).map((p: any) => ({
          name: p.name || "Produto sem nome",
          original_name: p.original_name || p.name || "Produto sem nome",
          sku: p.sku || null,
          size: p.size || null,
          color: p.color || null,
          cost_price: parseFloat(p.cost_price) || 0,
          price: parseFloat(p.price) || 0,
          quantity: parseInt(p.quantity) || 1,
          category: p.category || "",
        }));
        
        console.log("Produtos parseados da IA:", parsedProducts);

        if (parsedProducts.length === 0) {
          toast.error("Nenhum produto identificado na nota fiscal");
          setLoading(false);
          return;
        }

        processProducts(parsedProducts);
        toast.success(`${parsedProducts.length} produtos identificados por IA`);
        setLoading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing invoice:", error);
      toast.error("Erro ao processar nota fiscal");
      setLoading(false);
    }
    
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleScrapedImages = (productIndex: number, urls: string[]) => {
    // Convert scraped URLs to image URLs for the product
    setProducts(prev => prev.map((p, i) => {
      if (i !== productIndex) return p;
      return {
        ...p,
        imageUrls: [...p.imageUrls, ...urls].slice(0, 3),
      };
    }));
  };

  const toggleProduct = (index: number) => {
    setProducts(prev => prev.map((p, i) => 
      i === index ? { ...p, selected: !p.selected } : p
    ));
  };

  const updateProduct = (index: number, updates: Partial<ImportedProduct>) => {
    setProducts(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const updated = { ...p, ...updates };
      
      // If name was changed, re-check for existing product
      if (updates.name !== undefined && updates.name !== p.name) {
        const existingMatch = findDuplicate(updates.name);
        updated.existingProduct = existingMatch;
        
        // If we found an existing product, inherit its category
        if (existingMatch && existingMatch.category) {
          updated.category = existingMatch.category;
        }
      }
      
      updated.hasErrors = checkProductErrors(updated);
      return updated;
    }));
  };

  const handleProductImageUpload = (index: number, files: FileList | null) => {
    if (!files) return;
    
    const newImages = Array.from(files).slice(0, 3 - products[index].images.length);
    const newUrls = newImages.map(file => URL.createObjectURL(file));
    
    setProducts(prev => prev.map((p, i) => {
      if (i !== index) return p;
      return {
        ...p,
        images: [...p.images, ...newImages].slice(0, 3),
        imageUrls: [...p.imageUrls, ...newUrls].slice(0, 3),
      };
    }));
  };

  const removeProductImage = (productIndex: number, imageIndex: number) => {
    setProducts(prev => prev.map((p, i) => {
      if (i !== productIndex) return p;
      const newImages = p.images.filter((_, idx) => idx !== imageIndex);
      const newUrls = p.imageUrls.filter((_, idx) => idx !== imageIndex);
      URL.revokeObjectURL(p.imageUrls[imageIndex]);
      return { ...p, images: newImages, imageUrls: newUrls };
    }));
  };

  const uploadProductImages = async (productId: string, images: File[], subfolder?: string): Promise<string[]> => {
    if (!user || images.length === 0) return [];
    
    const urls: string[] = [];
    const pathPrefix = subfolder 
      ? `${user.id}/${productId}/${subfolder}` 
      : `${user.id}/${productId}`;
    
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${pathPrefix}/${i + 1}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });
      
      if (!error) {
        const { data } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        urls.push(data.publicUrl);
      }
    }
    
    return urls;
  };

  const handleImport = async () => {
    if (!user) return;

    const selectedProducts = products.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    // Check for errors
    const productsWithErrors = selectedProducts.filter(p => p.hasErrors);
    if (productsWithErrors.length > 0) {
      toast.error(`${productsWithErrors.length} produto(s) com campos obrigatórios não preenchidos`);
      return;
    }

    setLoading(true);

    // Create supplier if needed (but first check if it already exists)
    let finalSupplierId = supplierId === "none" ? null : supplierId;
    
    if (!finalSupplierId && supplierName.trim()) {
      // Check if supplier with this name already exists
      const normalizedSupplierName = supplierName.trim().toLowerCase();
      const { data: existingSupplier } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("owner_id", user.id);
      
      const matchingSupplier = existingSupplier?.find(s => 
        s.name.toLowerCase().trim() === normalizedSupplierName
      );
      
      if (matchingSupplier) {
        // Use existing supplier
        finalSupplierId = matchingSupplier.id;
      } else {
        // Create new supplier
        const { data: newSupplier, error: supplierError } = await supabase
          .from("suppliers")
          .insert({
            name: supplierName.trim(),
            owner_id: user.id
          })
          .select("id")
          .single();

        if (!supplierError && newSupplier) {
          finalSupplierId = newSupplier.id;
        }
      }
    }

    let successCount = 0;
    let updateCount = 0;

    for (const product of selectedProducts) {
      if (product.existingProduct) {
        // Update existing product stock - need to handle variants properly
        const productId = product.existingProduct.id;
        
        // Check if this product has variants that we need to update
        if (product.variants.length > 0) {
          // Fetch existing variants for this product
          const { data: existingVariants } = await supabase
            .from("product_variants")
            .select("id, size, stock_quantity")
            .eq("product_id", productId);
          
          let variantUpdated = false;
          
          for (const variant of product.variants) {
            // Normalize for comparison
            const variantSize = (variant.size || '').toLowerCase().trim();
            
            // Find matching existing variant by size
            const matchingVariant = existingVariants?.find(ev => {
              const existingSize = (ev.size || '').toLowerCase().trim();
              return existingSize === variantSize;
            });
            
            if (matchingVariant) {
              // Update existing variant's stock
              const newVariantQty = matchingVariant.stock_quantity + variant.quantity;
              const { error: variantError } = await supabase
                .from("product_variants")
                .update({ stock_quantity: newVariantQty })
                .eq("id", matchingVariant.id);
              
              if (!variantError) {
                variantUpdated = true;
                console.log(`Variante atualizada: ${variant.size} de ${matchingVariant.stock_quantity} para ${newVariantQty}`);
              }
            } else {
              // Create new variant for this color/size combination
              // Get color images if available
              const colorUrls: string[] = [];
              if (variant.color && product.colorImages[variant.color]) {
                const colorData = product.colorImages[variant.color];
                // Upload files first
                if (colorData.files.length > 0) {
                  const uploaded = await uploadProductImages(productId, colorData.files, variant.color.replace(/\s+/g, '_'));
                  colorUrls.push(...uploaded);
                }
                colorUrls.push(...colorData.urls);
              }
              
              const { error: insertError } = await supabase
                .from("product_variants")
                .insert({
                  product_id: productId,
                  size: variant.size || "ÚNICO",
                  stock_quantity: variant.quantity,
                });
              
              if (!insertError) {
                variantUpdated = true;
                console.log(`Nova variante criada: ${variant.color}/${variant.size} com ${variant.quantity} unidades`);
              }
            }
          }
          
          // Also update the main product stock_quantity to reflect total
          if (variantUpdated) {
            // Recalculate total from all variants
            const { data: allVariants } = await supabase
              .from("product_variants")
              .select("stock_quantity")
              .eq("product_id", productId);
            
            const totalVariantStock = allVariants?.reduce((sum, v) => sum + (v.stock_quantity || 0), 0) || 0;
            
            await supabase
              .from("products")
              .update({ 
                stock_quantity: totalVariantStock,
                cost_price: product.cost_price || undefined,
                supplier_id: finalSupplierId,
              })
              .eq("id", productId);
            
            updateCount++;
          }
        } else {
          // No variants - update main product directly (old behavior)
          const newQuantity = product.existingProduct.stock_quantity + product.quantity;
          
          const { error } = await supabase
            .from("products")
            .update({ 
              stock_quantity: newQuantity,
              cost_price: product.cost_price || undefined,
              supplier_id: finalSupplierId,
            })
            .eq("id", productId);
          
          if (!error) {
            updateCount++;
          }
        }
        
        // Upload images if any (for main product)
        if (product.images.length > 0) {
          const urls = await uploadProductImages(productId, product.images);
          if (urls.length > 0) {
            await supabase
              .from("products")
              .update({
                image_url: urls[0] || null,
                image_url_2: urls[1] || null,
                image_url_3: urls[2] || null,
              })
              .eq("id", productId);
          }
        }
      } else {
        // Insert new product
        // Prepare image URLs (handle both uploaded files and external URLs)
        const allImageUrls = [...product.imageUrls];
        
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert({
            name: product.name.trim(),
            description: product.description || null,
            size: product.size,
            color: product.color,
            cost_price: product.cost_price,
            price: product.price,
            stock_quantity: product.quantity,
            category: product.category || "Outros",
            min_stock_level: product.min_stock_level || 5,
            owner_id: user.id,
            supplier_id: finalSupplierId,
            image_url: allImageUrls[0] || null,
            image_url_2: allImageUrls[1] || null,
            image_url_3: allImageUrls[2] || null,
          })
          .select("id")
          .single();

        if (!error && newProduct) {
          // Upload local images if any (and update URLs)
          if (product.images.length > 0) {
            const uploadedUrls = await uploadProductImages(newProduct.id, product.images);
            // Combine with existing external URLs, prioritizing uploaded ones
            const finalUrls = [...uploadedUrls, ...product.imageUrls].slice(0, 3);
            if (finalUrls.length > 0) {
              await supabase
                .from("products")
                .update({
                  image_url: finalUrls[0] || null,
                  image_url_2: finalUrls[1] || null,
                  image_url_3: finalUrls[2] || null,
                })
                .eq("id", newProduct.id);
            }
          }

          // Create variants if there are multiple
          if (product.variants.length > 0) {
            // First, upload color images and collect URLs by color
            const colorImageUrls: { [color: string]: string[] } = {};
            
            for (const [color, colorData] of Object.entries(product.colorImages)) {
              const uploadedUrls: string[] = [];
              
              // Upload file images for this color
              if (colorData.files.length > 0) {
                const uploaded = await uploadProductImages(newProduct.id, colorData.files, color.replace(/\s+/g, '_'));
                uploadedUrls.push(...uploaded);
              }
              
              // Add external URLs
              uploadedUrls.push(...colorData.urls);
              
              colorImageUrls[color] = uploadedUrls.slice(0, 3);
            }

            const variantsToInsert = product.variants.map(v => {
              const colorUrls = v.color ? (colorImageUrls[v.color] || []) : [];
              return {
                product_id: newProduct.id,
                color: v.color,
                size: v.size || "ÚNICO",
                stock_quantity: v.quantity,
                image_url: colorUrls[0] || null,
                image_url_2: colorUrls[1] || null,
                image_url_3: colorUrls[2] || null,
              };
            });

            const { error: variantError } = await supabase
              .from("product_variants")
              .insert(variantsToInsert);

            if (variantError) {
              console.error("Error creating variants:", variantError);
            }
            
            // Also use first variant's image as main product image if not set
            const firstColorWithImages = Object.values(colorImageUrls).find(urls => urls.length > 0);
            if (firstColorWithImages && firstColorWithImages.length > 0 && !product.imageUrls.length && !product.images.length) {
              await supabase
                .from("products")
                .update({
                  image_url: firstColorWithImages[0] || null,
                  image_url_2: firstColorWithImages[1] || null,
                  image_url_3: firstColorWithImages[2] || null,
                })
                .eq("id", newProduct.id);
            }
          }

          successCount++;
        }
      }
    }

    if (successCount > 0 || updateCount > 0) {
      const messages = [];
      if (successCount > 0) messages.push(`${successCount} produto(s) criado(s)`);
      if (updateCount > 0) messages.push(`${updateCount} estoque(s) atualizado(s)`);
      toast.success(messages.join(", "));
      handleClose();
      onImportComplete();
    } else {
      toast.error("Erro ao importar produtos");
    }

    setLoading(false);
  };

  const hasProductsWithErrors = products.some(p => p.selected && p.hasErrors);
  const hasDuplicates = products.some(p => p.existingProduct !== null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden w-[95vw] sm:w-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Importar Estoque</DialogTitle>
          <DialogDescription>
            Importe produtos via planilha ou foto de nota fiscal
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <Tabs defaultValue="spreadsheet" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="spreadsheet">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Planilha
              </TabsTrigger>
              <TabsTrigger value="invoice">
                <Camera className="h-4 w-4 mr-2" />
                Nota Fiscal (IA)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="spreadsheet" className="space-y-4 py-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Carregar Planilha</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Suporta CSV/TXT com colunas: Nome, SKU, Tamanho, Cor, Custo, Preço, Quantidade, Categoria
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleSpreadsheetUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Selecionar Arquivo
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="invoice" className="space-y-4 py-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <div className="flex justify-center gap-2 mb-4">
                  <Camera className="h-10 w-10 text-muted-foreground" />
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">Foto ou PDF da Nota Fiscal</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  A IA irá extrair automaticamente os dados dos produtos
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Suporta: JPG, PNG, PDF (máx. 20MB)
                </p>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleInvoiceUpload}
                  className="hidden"
                />
                <Button onClick={() => imageInputRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {loading ? "Processando..." : "Selecionar Arquivo"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4 py-4">
            {supplierName && (
              <div className="p-2 sm:p-3 bg-muted rounded-lg">
                <span className="text-xs sm:text-sm text-muted-foreground">Fornecedor:</span>
                <span className="ml-1 sm:ml-2 font-medium text-sm sm:text-base truncate">{supplierName}</span>
              </div>
            )}
            
            <SupplierSelect value={supplierId} onChange={setSupplierId} />

            {hasDuplicates && (
              <div className="p-2 sm:p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-medium text-amber-600">Duplicados detectados</p>
                  <p className="text-muted-foreground">
                    Itens "Existe" terão estoque atualizado.
                  </p>
                </div>
              </div>
            )}

            {hasProductsWithErrors && (
              <div className="p-2 sm:p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-medium text-destructive">Campos obrigatórios</p>
                  <p className="text-muted-foreground">
                    Clique em Editar para preencher.
                  </p>
                </div>
              </div>
            )}

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 max-w-full overflow-hidden">
              {products.map((product, idx) => (
                <div 
                  key={idx} 
                  className={`border rounded-lg p-3 ${!product.selected ? "opacity-50" : ""} ${product.hasErrors && product.selected ? "bg-destructive/5 border-destructive/30" : "bg-card"}`}
                >
                  {/* Header row: checkbox + name + badge + edit */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border"
                      onClick={() => toggleProduct(idx)}
                    >
                      {product.selected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold text-sm block truncate ${!product.name.trim() ? "text-destructive" : ""}`}>
                        {product.name || "(sem nome)"}
                      </span>
                      <span className={`text-xs ${!product.category ? "text-destructive" : "text-muted-foreground"}`}>
                        {product.category || "(categoria)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {product.existingProduct ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                          Existe
                        </Badge>
                      ) : product.hasErrors ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                          Erro
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
                          Novo
                        </Badge>
                      )}
                      <button
                        type="button"
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted"
                        onClick={() => setEditingIndex(idx)}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Variants info */}
                  {product.variants.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mb-2 line-clamp-1">
                      {product.variants.map(v => `${v.color || '?'}/${v.size || '?'}`).join(", ")}
                    </p>
                  )}

                  {/* Compact info row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-muted/50 rounded px-2 py-1 text-center">
                      <span className="text-[10px] text-muted-foreground">Custo </span>
                      <span className="font-medium text-xs">R$ {product.cost_price.toFixed(2)}</span>
                    </div>
                    <div className="bg-muted/50 rounded px-2 py-1 text-center">
                      <span className="text-[10px] text-muted-foreground">Qtd </span>
                      <span className="font-medium text-xs">{product.quantity}</span>
                    </div>
                    <div className="bg-muted/50 rounded px-2 py-1 text-center">
                      <span className="text-[10px] text-muted-foreground">Var </span>
                      <span className="font-medium text-xs">
                        {product.variants.length > 0 
                          ? product.variants.length
                          : `${product.color || "-"}/${product.size || "-"}`}
                      </span>
                    </div>

                    {/* Photo upload button inline */}
                    {product.imageUrls.length > 0 ? (
                      <div className="flex items-center gap-1 ml-auto">
                        {product.imageUrls.slice(0, 2).map((url, imgIdx) => (
                          <div key={imgIdx} className="relative w-8 h-8">
                            <img 
                              src={url} 
                              alt={`Foto ${imgIdx + 1}`} 
                              className="w-full h-full object-cover rounded border"
                            />
                            <button
                              type="button"
                              onClick={() => removeProductImage(idx, imgIdx)}
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] shadow-md"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {product.imageUrls.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{product.imageUrls.length - 2}</span>
                        )}
                      </div>
                    ) : product.images.length < 3 ? (
                      <div className="ml-auto">
                        <input
                          ref={(el) => productImageRefs.current[idx] = el}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleProductImageUpload(idx, e.target.files)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => productImageRefs.current[idx]?.click()}
                          className="w-8 h-8 border border-dashed border-border rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
                        >
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Cor/Tam</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Fotos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, idx) => (
                    <TableRow 
                      key={idx} 
                      className={`${!product.selected ? "opacity-50" : ""} ${product.hasErrors && product.selected ? "bg-destructive/5" : ""}`}
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleProduct(idx)}
                        >
                          {product.selected ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className={`font-medium ${!product.name.trim() ? "text-destructive" : ""}`}>
                            {product.name || "(sem nome)"}
                          </span>
                          {product.variants.length > 0 && (
                            <span className="text-xs text-muted-foreground block mt-1">
                              {product.variants.map(v => `${v.color || '?'}/${v.size || '?'}`).join(", ")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={!product.category ? "text-destructive" : "text-muted-foreground"}>
                          {product.category || "(obrigatório)"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.variants.length > 0 ? (
                          <span className="text-xs">
                            {product.variants.length} variantes
                          </span>
                        ) : (
                          <span>{product.color || "-"} / {product.size || "-"}</span>
                        )}
                      </TableCell>
                      <TableCell>R$ {product.cost_price.toFixed(2)}</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {product.imageUrls.map((url, imgIdx) => (
                            <div key={imgIdx} className="relative w-8 h-8">
                              <img 
                                src={url} 
                                alt={`Foto ${imgIdx + 1}`} 
                                className="w-full h-full object-cover rounded"
                              />
                              <button
                                type="button"
                                onClick={() => removeProductImage(idx, imgIdx)}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {product.images.length < 3 && (
                            <>
                              <input
                                ref={(el) => productImageRefs.current[idx] = el}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleProductImageUpload(idx, e.target.files)}
                                className="hidden"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => productImageRefs.current[idx]?.click()}
                              >
                                <ImageIcon className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.existingProduct ? (
                          <Badge variant="secondary" className="text-xs">
                            Já existe (+{product.quantity})
                          </Badge>
                        ) : product.hasErrors ? (
                          <Badge variant="destructive" className="text-xs">
                            Incompleto
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            Novo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingIndex(idx)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground">
              {products.filter(p => p.selected).length} de {products.length} produtos selecionados
              {products.filter(p => p.selected && p.existingProduct).length > 0 && (
                <span className="ml-2">
                  ({products.filter(p => p.selected && p.existingProduct).length} atualizações de estoque)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Edit Product Dialog with Variant Editor */}
        {editingIndex !== null && (
          <EditProductWithVariantsDialog
            product={products[editingIndex]}
            categories={categories}
            userColors={userColors}
            onClose={() => setEditingIndex(null)}
            onUpdateProduct={(updates) => updateProduct(editingIndex, updates)}
            onUpdateVariants={(variants) => {
              const totalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0);
              updateProduct(editingIndex, { 
                variants, 
                quantity: totalQuantity,
                // Update main color/size from first variant if available
                color: variants[0]?.color || null,
                size: variants[0]?.size || null,
              });
            }}
            onUpdateColorImages={(colorImages) => {
              // Store color images in product for later upload during import
              updateProduct(editingIndex, { colorImages });
            }}
          />
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          {step === "review" && (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setStep("upload")}>
              Voltar
            </Button>
          )}
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleClose}>
            Cancelar
          </Button>
          {step === "review" && (
            <Button 
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleImport} 
              disabled={loading || hasProductsWithErrors}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Importar {products.filter(p => p.selected).length}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
