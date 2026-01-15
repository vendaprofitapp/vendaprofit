import { useState, useRef, useEffect } from "react";
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
import { ColorManager } from "@/components/products/ColorManager";

const availableSizes = ["PP", "P", "M", "G", "GG", "XG", "XXG", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "Único"];

interface ProductVariant {
  color: string | null;
  size: string | null;
  quantity: number;
  sku: string | null;
}

interface ImportedProduct {
  name: string;
  original_name: string;
  sku: string | null;
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
}

interface ExistingProduct {
  id: string;
  name: string;
  sku: string | null;
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
  onClose: () => void;
  onUpdateProduct: (updates: Partial<ImportedProduct>) => void;
  onUpdateVariants: (variants: ProductVariant[]) => void;
  removeProductImage: (imgIdx: number) => void;
  handleProductImageUpload: (files: FileList | null) => void;
}

function EditProductWithVariantsDialog({
  product,
  categories,
  onClose,
  onUpdateProduct,
  onUpdateVariants,
  removeProductImage,
  handleProductImageUpload,
}: EditProductWithVariantsDialogProps) {
  const [expandedColors, setExpandedColors] = useState<{ [color: string]: boolean }>({});
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
      sku: product.sku,
    }];
  });

  // Keep parent in sync
  useEffect(() => {
    onUpdateVariants(localVariants);
  }, [localVariants]);

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
    setLocalVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number | null) => {
    setLocalVariants(prev => prev.map((v, i) => 
      i === index ? { ...v, [field]: value } : v
    ));
  };

  const toggleColorExpanded = (color: string) => {
    setExpandedColors(prev => ({ ...prev, [color]: !prev[color] }));
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
                              
                              <ColorManager
                                value={variant.color || ""}
                                onChange={(value) => updateVariant(index, "color", value || null)}
                                placeholder="Cor"
                              />
                              
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="Qtd"
                                className="w-16 sm:w-20"
                                value={variant.quantity || ""}
                                onChange={(e) => updateVariant(index, "quantity", parseInt(e.target.value) || 0)}
                              />
                              
                              <Input
                                placeholder="SKU"
                                className="flex-1 min-w-[80px]"
                                value={variant.sku || ""}
                                onChange={(e) => updateVariant(index, "sku", e.target.value || null)}
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

            <div className="grid gap-2">
              <Label>Fotos (máx. 3)</Label>
              <div className="flex gap-2 items-center flex-wrap">
                {product.imageUrls.map((url, imgIdx) => (
                  <div key={imgIdx} className="relative w-16 h-16">
                    <img 
                      src={url} 
                      alt={`Foto ${imgIdx + 1}`} 
                      className="w-full h-full object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removeProductImage(imgIdx)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {(product.images.length + product.imageUrls.length) < 3 && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleProductImageUpload(e.target.files)}
                      className="hidden"
                      id="edit-variant-image"
                    />
                    <label 
                      htmlFor="edit-variant-image"
                      className="w-16 h-16 border-2 border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                    >
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Supplier Image Scraper */}
            {(product.images.length + product.imageUrls.length) < 3 && (
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Buscar Fotos do Fornecedor
                </Label>
                <SupplierImageScraper
                  onImagesSelected={(urls) => {
                    const currentTotal = product.images.length + product.imageUrls.length;
                    const available = 3 - currentTotal;
                    const newUrls = urls.slice(0, available);
                    
                    onUpdateProduct({
                      imageUrls: [...product.imageUrls, ...newUrls].slice(0, 3)
                    });
                  }}
                  maxImages={3}
                  currentImageCount={product.images.length + product.imageUrls.length}
                />
              </div>
            )}
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

  // Fetch existing products and categories for duplicate detection
  useEffect(() => {
    if (user && open) {
      fetchExistingProducts();
      fetchCategories();
    }
  }, [user, open]);

  const fetchExistingProducts = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("products")
      .select("id, name, sku, stock_quantity")
      .eq("owner_id", user.id);
    
    setExistingProducts(data || []);
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

  const findDuplicate = (name: string, sku: string | null): ExistingProduct | null => {
    // Check by SKU first (more reliable)
    if (sku) {
      const skuMatch = existingProducts.find(p => 
        p.sku?.toLowerCase() === sku.toLowerCase()
      );
      if (skuMatch) return skuMatch;
    }
    
    // Check by name (case insensitive, trimmed)
    const nameMatch = existingProducts.find(p => 
      p.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    
    return nameMatch || null;
  };

  const checkProductErrors = (product: ImportedProduct): boolean => {
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
      const cleanName = p.name.toLowerCase().trim();
      const existing = productGroups.get(cleanName) || [];
      existing.push(p);
      productGroups.set(cleanName, existing);
    }

    console.log("Grupos de produtos:", Array.from(productGroups.entries()));

    const processed: ImportedProduct[] = [];

    for (const [groupName, items] of productGroups) {
      // Use the first item as the base product
      const baseItem = items[0];
      const existing = findDuplicate(baseItem.name, baseItem.sku);
      
      // Create variants from all items in the group
      // Always create variants if we have color OR size detected
      const variants: ProductVariant[] = items.map(item => ({
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        sku: item.sku,
      }));

      // Calculate total quantity
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      // Check if any variant has color or size
      const hasVariantInfo = variants.some(v => v.color || v.size);
      
      console.log(`Produto "${groupName}": ${items.length} item(s), hasVariantInfo: ${hasVariantInfo}, variants:`, variants);

      const product: ImportedProduct = {
        name: baseItem.name,
        original_name: items.map(i => i.original_name || i.name).join(", "),
        sku: baseItem.sku,
        // Always populate color/size from first variant
        size: variants[0]?.size || null,
        color: variants[0]?.color || null,
        cost_price: baseItem.cost_price,
        price: baseItem.price || 0,
        quantity: totalQuantity,
        category: baseItem.category || "",
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
      const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('codigo') || h.includes('código') || h.includes('ref'));
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
          sku: skuIdx >= 0 ? values[skuIdx] || null : null,
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

  const uploadProductImages = async (productId: string, images: File[]): Promise<string[]> => {
    if (!user || images.length === 0) return [];
    
    const urls: string[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${productId}/${i + 1}.${fileExt}`;
      
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

    // Create supplier if needed
    let finalSupplierId = supplierId === "none" ? null : supplierId;
    
    if (!finalSupplierId && supplierName.trim()) {
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

    let successCount = 0;
    let updateCount = 0;

    for (const product of selectedProducts) {
      if (product.existingProduct) {
        // Update existing product stock
        const newQuantity = product.existingProduct.stock_quantity + product.quantity;
        
        const { error } = await supabase
          .from("products")
          .update({ 
            stock_quantity: newQuantity,
            cost_price: product.cost_price || undefined,
            supplier_id: finalSupplierId,
          })
          .eq("id", product.existingProduct.id);
        
        if (!error) {
          // Upload images if any
          if (product.images.length > 0) {
            const urls = await uploadProductImages(product.existingProduct.id, product.images);
            if (urls.length > 0) {
              await supabase
                .from("products")
                .update({
                  image_url: urls[0] || null,
                  image_url_2: urls[1] || null,
                  image_url_3: urls[2] || null,
                })
                .eq("id", product.existingProduct.id);
            }
          }
          updateCount++;
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
            sku: product.sku,
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
            const variantsToInsert = product.variants.map(v => ({
              product_id: newProduct.id,
              color: v.color,
              size: v.size || "ÚNICO",
              stock_quantity: v.quantity,
              sku: v.sku,
            }));

            const { error: variantError } = await supabase
              .from("product_variants")
              .insert(variantsToInsert);

            if (variantError) {
              console.error("Error creating variants:", variantError);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  capture="environment"
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
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Fornecedor identificado:</span>
                <span className="ml-2 font-medium">{supplierName}</span>
              </div>
            )}
            
            <SupplierSelect value={supplierId} onChange={setSupplierId} />

            {hasDuplicates && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600">Produtos duplicados detectados</p>
                  <p className="text-muted-foreground">
                    Produtos marcados como "Já existe" terão apenas o estoque atualizado (somado).
                  </p>
                </div>
              </div>
            )}

            {hasProductsWithErrors && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Campos obrigatórios não preenchidos</p>
                  <p className="text-muted-foreground">
                    Clique em "Editar" para preencher Nome e Categoria dos produtos com erro.
                  </p>
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
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
                          {product.sku && (
                            <span className="text-xs text-muted-foreground block">{product.sku}</span>
                          )}
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
            removeProductImage={(imgIdx) => removeProductImage(editingIndex, imgIdx)}
            handleProductImageUpload={(files) => handleProductImageUpload(editingIndex, files)}
          />
        )}

        <DialogFooter>
          {step === "review" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === "review" && (
            <Button 
              onClick={handleImport} 
              disabled={loading || hasProductsWithErrors}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Importar {products.filter(p => p.selected).length} Produtos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
