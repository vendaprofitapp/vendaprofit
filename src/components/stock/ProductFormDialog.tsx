import { useRef, useState, useEffect } from "react";
import { Image as ImageIcon, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { CategoryManager } from "@/components/products/CategoryManager";
import { ColorManager } from "@/components/products/ColorManager";
import { SupplierImageScraper } from "@/components/stock/SupplierImageScraper";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  cost_price: number | null;
  sku: string | null;
  size: string | null;
  color: string | null;
  stock_quantity: number;
  min_stock_level: number;
  group_id: string | null;
  owner_id: string;
  is_active: boolean;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  supplier_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
}

interface ProductVariant {
  id?: string;
  size: string;
  color: string;
  sku: string;
  stock_quantity: number;
  image_url?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
}

// Structure to hold images per color
interface ColorImages {
  existingUrls: string[];
  newFiles: File[];
  newPreviewUrls: string[];
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  duplicatingProduct?: Product | null;
  onSuccess: () => void;
  initialProductName?: string;
}

const availableSizes = ["PP", "P", "M", "G", "GG", "XG", "XXG", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "Único"];

export function ProductFormDialog({ 
  open, 
  onOpenChange, 
  editingProduct,
  duplicatingProduct,
  onSuccess,
  initialProductName = ""
}: ProductFormDialogProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const imageInputRefs = useRef<{ [color: string]: HTMLInputElement | null }>({});
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [colorImages, setColorImages] = useState<{ [color: string]: ColorImages }>({});
  const [expandedColors, setExpandedColors] = useState<{ [color: string]: boolean }>({});
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    cost_price: "",
    min_stock_level: "5",
    supplier_id: ""
  });

  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user]);

  useEffect(() => {
    if (editingProduct) {
      setForm({
        name: editingProduct.name,
        description: editingProduct.description || "",
        category: editingProduct.category,
        price: editingProduct.price.toString(),
        cost_price: editingProduct.cost_price?.toString() || "",
        min_stock_level: editingProduct.min_stock_level.toString(),
        supplier_id: editingProduct.supplier_id || ""
      });
      
      // Fetch existing variants with images
      fetchProductVariants(editingProduct.id);
    } else if (duplicatingProduct) {
      setForm({
        name: duplicatingProduct.name,
        description: duplicatingProduct.description || "",
        category: duplicatingProduct.category,
        price: duplicatingProduct.price.toString(),
        cost_price: duplicatingProduct.cost_price?.toString() || "",
        min_stock_level: duplicatingProduct.min_stock_level.toString(),
        supplier_id: duplicatingProduct.supplier_id || ""
      });
      
      // Start with empty variants for duplicate
      setProductVariants([{ size: "", color: "", sku: "", stock_quantity: 0 }]);
      setColorImages({});
    } else {
      resetForm();
      if (initialProductName) {
        setForm(prev => ({ ...prev, name: initialProductName }));
      }
    }
  }, [editingProduct, duplicatingProduct, open, initialProductName]);

  const fetchProductVariants = async (productId: string) => {
    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("color", { ascending: true })
      .order("size", { ascending: true });
    
    if (!error && data && data.length > 0) {
      const variants = data.map(v => ({
        id: v.id,
        size: v.size,
        color: v.color || "",
        sku: v.sku || "",
        stock_quantity: v.stock_quantity,
        image_url: v.image_url,
        image_url_2: v.image_url_2,
        image_url_3: v.image_url_3
      }));
      setProductVariants(variants);
      
      // Build color images from variants
      const images: { [color: string]: ColorImages } = {};
      const expanded: { [color: string]: boolean } = {};
      
      variants.forEach(v => {
        if (v.color && !images[v.color]) {
          const existingUrls: string[] = [];
          if (v.image_url) existingUrls.push(v.image_url);
          if (v.image_url_2) existingUrls.push(v.image_url_2);
          if (v.image_url_3) existingUrls.push(v.image_url_3);
          
          images[v.color] = {
            existingUrls,
            newFiles: [],
            newPreviewUrls: []
          };
          expanded[v.color] = existingUrls.length > 0;
        }
      });
      
      setColorImages(images);
      setExpandedColors(expanded);
    } else {
      setProductVariants([{ size: "", color: "", sku: "", stock_quantity: 0 }]);
      setColorImages({});
    }
  };

  const fetchSuppliers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, cnpj")
      .eq("owner_id", user.id)
      .order("name");
    setSuppliers(data || []);
  };

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      category: "",
      price: "",
      cost_price: "",
      min_stock_level: "5",
      supplier_id: ""
    });
    // Clean up preview URLs
    Object.values(colorImages).forEach(ci => {
      ci.newPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    });
    setColorImages({});
    setExpandedColors({});
    setProductVariants([{ size: "", color: "", sku: "", stock_quantity: 0 }]);
  };

  const handleProductDataImport = (data: {
    name?: string;
    price?: number;
    description?: string;
    colors?: string[];
    sizes?: string[];
    category?: string;
  }) => {
    setForm(prev => ({
      ...prev,
      ...(data.name && { name: data.name }),
      ...(data.price && { price: data.price.toString() }),
      ...(data.description && { description: data.description }),
      ...(data.category && { category: data.category }),
    }));
    
    const sizes = data.sizes && data.sizes.length > 0 ? data.sizes : [""];
    const colors = data.colors && data.colors.length > 0 ? data.colors : [""];
    
    const newVariants: ProductVariant[] = [];
    sizes.forEach(size => {
      colors.forEach(color => {
        newVariants.push({
          size: size.toUpperCase(),
          color: color,
          sku: "",
          stock_quantity: 0
        });
      });
    });
    
    if (newVariants.length > 0) {
      setProductVariants(newVariants);
      // Initialize color images for new colors
      const newColorImages: { [color: string]: ColorImages } = {};
      colors.forEach(color => {
        if (color && !newColorImages[color]) {
          newColorImages[color] = { existingUrls: [], newFiles: [], newPreviewUrls: [] };
        }
      });
      setColorImages(prev => ({ ...prev, ...newColorImages }));
    }
  };

  // Get unique colors from variants
  const getUniqueColors = (): string[] => {
    const colors = new Set<string>();
    productVariants.forEach(v => {
      if (v.color) colors.add(v.color);
    });
    return Array.from(colors);
  };

  // Handle image upload for a specific color
  const handleColorImageUpload = (color: string, files: FileList | null) => {
    if (!files || !color) return;
    
    const currentImages = colorImages[color] || { existingUrls: [], newFiles: [], newPreviewUrls: [] };
    const totalCurrent = currentImages.existingUrls.length + currentImages.newFiles.length;
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
        existingUrls: currentImages.existingUrls,
        newFiles: [...currentImages.newFiles, ...newFiles],
        newPreviewUrls: [...currentImages.newPreviewUrls, ...newUrls]
      }
    }));
  };

  // Remove image from a color
  const removeColorImage = (color: string, index: number, isExisting: boolean) => {
    setColorImages(prev => {
      const current = prev[color];
      if (!current) return prev;
      
      if (isExisting) {
        return {
          ...prev,
          [color]: {
            ...current,
            existingUrls: current.existingUrls.filter((_, i) => i !== index)
          }
        };
      } else {
        URL.revokeObjectURL(current.newPreviewUrls[index]);
        return {
          ...prev,
          [color]: {
            ...current,
            newFiles: current.newFiles.filter((_, i) => i !== index),
            newPreviewUrls: current.newPreviewUrls.filter((_, i) => i !== index)
          }
        };
      }
    });
  };

  // Upload images for a color and return URLs
  const uploadColorImages = async (productId: string, color: string): Promise<string[]> => {
    if (!user) return [];
    
    const current = colorImages[color];
    if (!current) return [];
    
    const urls: string[] = [...current.existingUrls];
    
    for (let i = 0; i < current.newFiles.length; i++) {
      const file = current.newFiles[i];
      const fileExt = file.name.split('.').pop();
      const colorSlug = color.toLowerCase().replace(/\s+/g, '-');
      const fileName = `${user.id}/${productId}/${colorSlug}_${Date.now()}_${i + 1}.${fileExt}`;
      
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
    
    return urls.slice(0, 3);
  };

  // Variant handlers
  const addProductVariant = () => {
    setProductVariants(prev => [...prev, { size: "", color: "", sku: "", stock_quantity: 0 }]);
  };

  const removeProductVariant = (index: number) => {
    const variant = productVariants[index];
    setProductVariants(prev => prev.filter((_, i) => i !== index));
    
    // Check if this was the last variant with this color
    const remainingWithColor = productVariants.filter((v, i) => i !== index && v.color === variant.color);
    if (remainingWithColor.length === 0 && variant.color) {
      // Clean up images for this color
      const ci = colorImages[variant.color];
      if (ci) {
        ci.newPreviewUrls.forEach(url => URL.revokeObjectURL(url));
      }
      setColorImages(prev => {
        const { [variant.color]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const updateProductVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
    const oldVariant = productVariants[index];
    
    setProductVariants(prev => prev.map((v, i) => 
      i === index ? { ...v, [field]: value } : v
    ));
    
    // If color changed, initialize color images for new color
    if (field === 'color' && typeof value === 'string' && value !== oldVariant.color) {
      if (value && !colorImages[value]) {
        setColorImages(prev => ({
          ...prev,
          [value]: { existingUrls: [], newFiles: [], newPreviewUrls: [] }
        }));
      }
      
      // Check if old color still has variants
      const remainingWithOldColor = productVariants.filter((v, i) => i !== index && v.color === oldVariant.color);
      if (remainingWithOldColor.length === 0 && oldVariant.color) {
        const ci = colorImages[oldVariant.color];
        if (ci) {
          ci.newPreviewUrls.forEach(url => URL.revokeObjectURL(url));
        }
        setColorImages(prev => {
          const { [oldVariant.color]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  const toggleColorExpanded = (color: string) => {
    setExpandedColors(prev => ({ ...prev, [color]: !prev[color] }));
  };

  const totalStock = productVariants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }
    if (!form.category) {
      toast.error("Categoria é obrigatória");
      return;
    }
    
    const validVariants = productVariants.filter(v => v.size.trim() || v.color.trim());
    if (validVariants.length === 0) {
      toast.error("Adicione pelo menos uma variante com tamanho ou cor");
      return;
    }

    setSaving(true);

    const productData = {
      name: form.name,
      description: form.description || null,
      category: form.category,
      price: parseFloat(form.price) || 0,
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      sku: null,
      size: null,
      color: null,
      stock_quantity: totalStock,
      min_stock_level: parseInt(form.min_stock_level) || 5,
      supplier_id: form.supplier_id && form.supplier_id !== "none" ? form.supplier_id : null,
      owner_id: user.id,
      group_id: null,
      // Clear product-level images since they're now per-color
      image_url: null,
      image_url_2: null,
      image_url_3: null,
    };

    try {
      let productId: string;
      
      if (editingProduct) {
        productId = editingProduct.id;
        
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
        
        // Delete existing variants
        await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", productId);
        
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();

        if (error || !newProduct) throw error;
        productId = newProduct.id;
      }
      
      // Upload images for each color and prepare variants
      const colorImageUrls: { [color: string]: string[] } = {};
      const uniqueColors = getUniqueColors();
      
      for (const color of uniqueColors) {
        const urls = await uploadColorImages(productId, color);
        colorImageUrls[color] = urls;
      }
      
      // Insert all variants with their color's images
      const variantsToInsert = validVariants.map(v => {
        const urls = v.color ? (colorImageUrls[v.color] || []) : [];
        return {
          product_id: productId,
          size: v.size || "Único",
          color: v.color || null,
          sku: v.sku || null,
          stock_quantity: v.stock_quantity || 0,
          image_url: urls[0] || null,
          image_url_2: urls[1] || null,
          image_url_3: urls[2] || null
        };
      });
      
      if (variantsToInsert.length > 0) {
        const { error: variantError } = await supabase
          .from("product_variants")
          .insert(variantsToInsert);
        
        if (variantError) throw variantError;
      }

      // Update product with first color's first image as main image
      const firstColor = uniqueColors[0];
      const firstColorUrls = firstColor ? colorImageUrls[firstColor] : [];
      if (firstColorUrls.length > 0) {
        await supabase
          .from("products")
          .update({
            image_url: firstColorUrls[0] || null,
            image_url_2: firstColorUrls[1] || null,
            image_url_3: firstColorUrls[2] || null,
          })
          .eq("id", productId);
      }

      toast.success(editingProduct ? "Produto atualizado!" : "Produto criado!");
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(editingProduct ? "Erro ao atualizar produto" : "Erro ao criar produto");
    } finally {
      setSaving(false);
    }
  };

  const isMobileDevice = isMobile;
  const selectContentProps = isMobileDevice ? ({ portal: false } as const) : ({} as const);

  // Render image section for a color
  const renderColorImages = (color: string) => {
    const images = colorImages[color] || { existingUrls: [], newFiles: [], newPreviewUrls: [] };
    const totalColorImages = images.existingUrls.length + images.newPreviewUrls.length;
    
    return (
      <div className="pl-4 py-2 border-l-2 border-primary/20 mt-2">
        <div className="flex gap-2 items-center flex-wrap">
          {images.existingUrls.map((url, idx) => (
            <div key={`existing-${idx}`} className="relative w-14 h-14">
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
          
          {images.newPreviewUrls.map((url, idx) => (
            <div key={`new-${idx}`} className="relative w-14 h-14">
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
        <p className="text-xs text-muted-foreground mt-1">
          {totalColorImages}/3 fotos para esta cor
        </p>
      </div>
    );
  };

  // Group variants by color for display
  const variantsByColor = productVariants.reduce((acc, variant, index) => {
    const color = variant.color || "__no_color__";
    if (!acc[color]) acc[color] = [];
    acc[color].push({ variant, index });
    return acc;
  }, {} as { [color: string]: { variant: ProductVariant; index: number }[] });

  const formContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="col-span-1 sm:col-span-2 space-y-2">
        <Label>Nome *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nome do produto"
          autoComplete="off"
        />
      </div>
      <div className="col-span-1 sm:col-span-2 space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descrição do produto"
          className="min-h-[80px]"
        />
      </div>
      
      {/* Supplier Image Scraper */}
      <div className="col-span-1 sm:col-span-2">
        <SupplierImageScraper
          maxImages={3}
          currentImageCount={0}
          onImagesSelected={() => {}}
          onProductDataImport={handleProductDataImport}
        />
      </div>

      <div className="col-span-1 sm:col-span-2 space-y-2">
        <Label>Categoria *</Label>
        <CategoryManager
          value={form.category}
          onChange={(value) => setForm({ ...form, category: value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label>Preço de Venda *</Label>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          placeholder="0.00"
        />
      </div>
      <div className="space-y-2">
        <Label>Preço de Custo</Label>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.cost_price}
          onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
          placeholder="0.00"
        />
      </div>
      
      <div className="space-y-2">
        <Label>Estoque Mínimo</Label>
        <Input
          type="number"
          inputMode="numeric"
          value={form.min_stock_level}
          onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
          placeholder="5"
        />
      </div>
      
      {/* Variants Section grouped by Color */}
      <div className="col-span-1 sm:col-span-2 space-y-3">
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
                          value={variant.size}
                          onValueChange={(value) => updateProductVariant(index, "size", value)}
                        >
                          <SelectTrigger className="w-20 sm:w-24">
                            <SelectValue placeholder="Tam." />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} {...selectContentProps}>
                            {availableSizes.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <ColorManager
                          value={variant.color}
                          onChange={(value) => updateProductVariant(index, "color", value)}
                          placeholder="Cor"
                        />
                        
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="Qtd"
                          className="w-16 sm:w-20"
                          value={variant.stock_quantity || ""}
                          onChange={(e) => updateProductVariant(index, "stock_quantity", parseInt(e.target.value) || 0)}
                        />
                        
                        <Input
                          placeholder="SKU"
                          className="flex-1 min-w-[80px]"
                          value={variant.sku}
                          onChange={(e) => updateProductVariant(index, "sku", e.target.value)}
                        />
                        
                        {productVariants.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                            onClick={() => removeProductVariant(index)}
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
          onClick={addProductVariant}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Variante
        </Button>
      </div>
      
      <div className="col-span-1 sm:col-span-2 space-y-2">
        <Label>Fornecedor</Label>
        <Select
          value={form.supplier_id || "none"}
          onValueChange={(value) => setForm({ ...form, supplier_id: value === "none" ? "" : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um fornecedor" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} {...selectContentProps}>
            <SelectItem value="none">Nenhum</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const getDialogTitle = () => {
    if (editingProduct) return "Editar Produto";
    if (duplicatingProduct) return "Duplicar Produto";
    return "Novo Produto";
  };

  const getDialogDescription = () => {
    if (duplicatingProduct) return "Altere os dados para criar uma variação do produto";
    return "Preencha os dados do produto";
  };

  const FooterButtons = () => (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
        Cancelar
      </Button>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Salvando..." : editingProduct ? "Salvar" : duplicatingProduct ? "Criar Variação" : "Criar Produto"}
      </Button>
    </>
  );

  if (isMobileDevice) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{getDialogTitle()}</DrawerTitle>
            <DrawerDescription>
              {getDialogDescription()}
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1 px-4 overflow-y-auto max-h-[60vh]">
            <div className="pb-4">
              {formContent}
            </div>
          </ScrollArea>
          <DrawerFooter className="flex-row gap-2 pt-2">
            <FooterButtons />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            {getDialogDescription()}
          </DialogDescription>
        </DialogHeader>
        {formContent}
        <DialogFooter>
          <FooterButtons />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
