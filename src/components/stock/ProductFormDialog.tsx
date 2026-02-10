import { useRef, useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
 import { FixedCategorySelector } from "@/components/products/FixedCategorySelector";
import { ProductVideoUpload } from "@/components/stock/ProductVideoUpload";
import { MarketingStatusSelector, type MarketingStatus, type MarketingPrices } from "@/components/stock/MarketingStatusSelector";
import { ReorderableImageList } from "@/components/stock/ReorderableImageList";
import { UrlProductImporter } from "@/components/stock/UrlProductImporter";
import { SupplierImageScraper } from "@/components/stock/SupplierImageScraper";

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
  stock_quantity: number;
  min_stock_level: number;
  group_id: string | null;
  owner_id: string;
  is_active: boolean;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  supplier_id: string | null;
  video_url: string | null;
  model: string | null;
  color_label: string | null;
  custom_detail: string | null;
  main_category: string | null;
  subcategory: string | null;
  is_new_release: boolean;
}

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
}

interface ProductVariant {
  id?: string;
  size: string;
  stock_quantity: number;
  marketing_status?: MarketingStatus;
  marketing_prices?: MarketingPrices;
  marketing_delivery_days?: number | null;
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

const defaultSizes = ["PP", "P", "M", "G", "GG", "XG"];

const sizeOrder = ["PP", "P", "M", "G", "GG", "XG", "XXG", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "Único"];

const sortVariantsBySize = (variants: ProductVariant[]): ProductVariant[] => {
  return [...variants].sort((a, b) => {
    const indexA = sizeOrder.indexOf(a.size);
    const indexB = sizeOrder.indexOf(b.size);
    // If size not found in order, put it at the end
    const orderA = indexA === -1 ? 999 : indexA;
    const orderB = indexB === -1 ? 999 : indexB;
    return orderA - orderB;
  });
};

const createDefaultVariants = (): ProductVariant[] => 
  defaultSizes.map(size => ({ 
    size, 
    stock_quantity: 0, 
    marketing_status: null, 
    marketing_prices: null, 
    marketing_delivery_days: null 
  }));

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
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [originalVariantCount, setOriginalVariantCount] = useState(0);
  
  // Product-level images
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    mainCategory: "",
    subcategory: "",
    isNewRelease: false,
    price: "",
    cost_price: "",
    min_stock_level: "5",
    supplier_id: "",
    video_url: "" as string | null,
    model: "",
    color_label: "",
    custom_detail: ""
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
        mainCategory: editingProduct.main_category || "",
        subcategory: editingProduct.subcategory || "",
        isNewRelease: editingProduct.is_new_release || false,
        price: editingProduct.price.toString(),
        cost_price: editingProduct.cost_price?.toString() || "",
        min_stock_level: editingProduct.min_stock_level.toString(),
        supplier_id: editingProduct.supplier_id || "",
        video_url: editingProduct.video_url || null,
        model: editingProduct.model || "",
        color_label: editingProduct.color_label || "",
        custom_detail: editingProduct.custom_detail || ""
      });
      
      // Load existing images
      const urls: string[] = [];
      if (editingProduct.image_url) urls.push(editingProduct.image_url);
      if (editingProduct.image_url_2) urls.push(editingProduct.image_url_2);
      if (editingProduct.image_url_3) urls.push(editingProduct.image_url_3);
      setExistingImageUrls(urls);
      
      fetchProductVariants(editingProduct.id);
    } else if (duplicatingProduct) {
      setForm({
        name: duplicatingProduct.name,
        description: duplicatingProduct.description || "",
        mainCategory: duplicatingProduct.main_category || "",
        subcategory: duplicatingProduct.subcategory || "",
        isNewRelease: false,
        price: duplicatingProduct.price.toString(),
        cost_price: duplicatingProduct.cost_price?.toString() || "",
        min_stock_level: duplicatingProduct.min_stock_level.toString(),
        supplier_id: duplicatingProduct.supplier_id || "",
        video_url: null,
        model: duplicatingProduct.model || "",
        color_label: duplicatingProduct.color_label || "",
        custom_detail: duplicatingProduct.custom_detail || ""
      });
      
      setProductVariants(createDefaultVariants());
      setExistingImageUrls([]);
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
      .select("id, size, stock_quantity, marketing_status, marketing_prices, marketing_delivery_days")
      .eq("product_id", productId)
      .order("size", { ascending: true });
    
    if (!error && data && data.length > 0) {
      const variants = data.map(v => ({
        id: v.id,
        size: v.size,
        stock_quantity: v.stock_quantity,
        marketing_status: (v.marketing_status as MarketingStatus) || null,
        marketing_prices: (v as any).marketing_prices as MarketingPrices || null,
        marketing_delivery_days: v.marketing_delivery_days ? Number(v.marketing_delivery_days) : null
      }));
      setProductVariants(sortVariantsBySize(variants));
      setOriginalVariantCount(variants.length);
    } else {
      setProductVariants(createDefaultVariants());
      setOriginalVariantCount(0);
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
      mainCategory: "",
      subcategory: "",
      isNewRelease: false,
      price: "",
      cost_price: "",
      min_stock_level: "5",
      supplier_id: "",
      video_url: null,
      model: "",
      color_label: "",
      custom_detail: ""
    });
    newImagePreviews.forEach(url => URL.revokeObjectURL(url));
    setExistingImageUrls([]);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    setProductVariants(createDefaultVariants());
    setOriginalVariantCount(0);
  };

  // Image handlers
  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    
    const totalCurrent = existingImageUrls.length + newImageFiles.length;
    const available = 3 - totalCurrent;
    
    if (available <= 0) {
      toast.error("Máximo de 3 fotos");
      return;
    }
    
    const filesToAdd = Array.from(files).slice(0, available);
    const newUrls = filesToAdd.map(file => URL.createObjectURL(file));
    
    setNewImageFiles(prev => [...prev, ...filesToAdd]);
    setNewImagePreviews(prev => [...prev, ...newUrls]);
  };

  const removeImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      URL.revokeObjectURL(newImagePreviews[index]);
      setNewImageFiles(prev => prev.filter((_, i) => i !== index));
      setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleImageReorder = (newExisting: string[], newPreviews: string[]) => {
    setExistingImageUrls(newExisting);
    // Reorder files to match previews - simplified version
    setNewImagePreviews(newPreviews);
  };

  const handleImagesFromSupplier = (urls: string[]) => {
    const totalCurrent = existingImageUrls.length + newImageFiles.length;
    const available = 3 - totalCurrent;
    
    if (available <= 0) {
      toast.error("Máximo de 3 fotos");
      return;
    }
    
    const urlsToAdd = urls.slice(0, available);
    setExistingImageUrls(prev => [...prev, ...urlsToAdd]);
    toast.success(`${urlsToAdd.length} imagem(ns) adicionada(s)`);
  };

  // Upload images and return URLs
  const uploadImages = async (productId: string): Promise<string[]> => {
    if (!user) return [];
    
    const urls: string[] = [...existingImageUrls];
    
    for (let i = 0; i < newImageFiles.length; i++) {
      const file = newImageFiles[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${productId}/${Date.now()}_${i + 1}.${fileExt}`;
      
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
    setProductVariants(prev => [...prev, { size: "", stock_quantity: 0, marketing_status: null, marketing_prices: null, marketing_delivery_days: null }]);
  };

  const removeProductVariant = (index: number) => {
    setProductVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateProductVariant = (index: number, field: keyof ProductVariant, value: any) => {
    let updates: Partial<ProductVariant> = { [field]: value };
    if (field === 'marketing_status' && value === null) {
      updates.marketing_prices = null;
      updates.marketing_delivery_days = null;
    }
    
    setProductVariants(prev => {
      const updated = prev.map((v, i) => 
        i === index ? { ...v, ...updates } : v
      );
      // Re-sort if size changed
      return field === 'size' ? sortVariantsBySize(updated) : updated;
    });
  };

  const totalStock = productVariants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }
    if (!form.mainCategory) {
      toast.error("Categoria principal é obrigatória");
      return;
    }
    
    // Normalize variants - only keep rows with size
    const normalizedVariants = productVariants
      .map((v) => ({
        ...v,
        size: (v.size || "").trim(),
      }))
      .filter((v) => Boolean(v.size));

    if (normalizedVariants.length === 0) {
      toast.error("Adicione pelo menos uma variante com tamanho");
      return;
    }

    setSaving(true);

    try {
      let productId: string;
      
      // Upload images first (for new products we need a temp ID)
      const tempId = editingProduct?.id || crypto.randomUUID();
      const imageUrls = await uploadImages(tempId);
      
      const productData = {
        name: form.name,
        description: form.description || null,
        category: form.mainCategory,
        category_2: form.subcategory || null,
        category_3: null,
        main_category: form.mainCategory,
        subcategory: form.subcategory || null,
        is_new_release: form.isNewRelease,
        price: parseFloat(form.price) || 0,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        sku: null,
        size: null,
        stock_quantity: totalStock,
        min_stock_level: parseInt(form.min_stock_level) || 5,
        supplier_id: form.supplier_id && form.supplier_id !== "none" ? form.supplier_id : null,
        owner_id: user.id,
        group_id: null,
        video_url: form.video_url || null,
        model: form.model || null,
        color_label: form.color_label || null,
        custom_detail: form.custom_detail || null,
        image_url: imageUrls[0] || null,
        image_url_2: imageUrls[1] || null,
        image_url_3: imageUrls[2] || null,
      };

      if (editingProduct) {
        productId = editingProduct.id;
        
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();

        if (error || !newProduct) throw error;
        productId = newProduct.id;
      }
      
      // Deduplicate variants by size
      const variantMap = new Map<string, ProductVariant>();
      normalizedVariants.forEach((v) => {
        const key = v.size;
        const existing = variantMap.get(key);
        if (existing) {
          existing.stock_quantity = (existing.stock_quantity || 0) + (Number(v.stock_quantity) || 0);
          existing.marketing_status = v.marketing_status || existing.marketing_status;
          existing.marketing_prices = v.marketing_prices ?? existing.marketing_prices;
          existing.marketing_delivery_days = v.marketing_delivery_days ?? existing.marketing_delivery_days;
        } else {
          variantMap.set(key, {
            size: v.size,
            stock_quantity: Number(v.stock_quantity) || 0,
            marketing_status: v.marketing_status || null,
            marketing_prices: v.marketing_prices ?? null,
            marketing_delivery_days: v.marketing_delivery_days ?? null,
          });
        }
      });

      const deduplicatedVariants = Array.from(variantMap.values());

      const variantsToUpsert = deduplicatedVariants.map((v) => {
        let marketingStatusArray: string[] | null = null;
        if (v.marketing_status) {
          if (Array.isArray(v.marketing_status)) {
            marketingStatusArray = v.marketing_status.length > 0 ? v.marketing_status : null;
          }
        }
        
        return {
          product_id: productId,
          size: v.size,
          stock_quantity: v.stock_quantity,
          marketing_status: marketingStatusArray,
          marketing_prices: v.marketing_prices,
          marketing_delivery_days: v.marketing_delivery_days,
        };
      });

      if (editingProduct) {
        // Fetch existing variants
        const { data: existingVariants } = await supabase
          .from("product_variants")
          .select("id, size")
          .eq("product_id", productId);

        const existingMap = new Map<string, string>();
        (existingVariants || []).forEach((ev) => {
          existingMap.set(ev.size, ev.id);
        });

        // Update or insert variants
        for (const variant of variantsToUpsert) {
          const existingId = existingMap.get(variant.size);

          if (existingId) {
            const { error: updateError } = await supabase
              .from("product_variants")
              .update({
                stock_quantity: variant.stock_quantity,
                marketing_status: variant.marketing_status,
                marketing_prices: variant.marketing_prices,
                marketing_delivery_days: variant.marketing_delivery_days,
              })
              .eq("id", existingId);

            if (updateError) throw updateError;
            existingMap.delete(variant.size);
          } else {
            const { error: insertError } = await supabase
              .from("product_variants")
              .insert(variant);

            if (insertError) throw insertError;
          }
        }

        // Delete orphan variants
        const shouldDeleteOrphans = variantsToUpsert.length > 0 || originalVariantCount === 0;
        
        if (shouldDeleteOrphans) {
          for (const [, variantId] of existingMap) {
            await supabase
              .from("product_variants")
              .delete()
              .eq("id", variantId);
          }
        }
      } else {
        // New product - insert all variants
        if (variantsToUpsert.length > 0) {
          const { error: variantError } = await supabase
            .from("product_variants")
            .insert(variantsToUpsert);
          
          if (variantError) throw variantError;
        }
      }

      toast.success(editingProduct ? "Produto atualizado!" : "Produto cadastrado!");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error("Erro ao salvar produto: " + (error.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const totalImages = existingImageUrls.length + newImagePreviews.length;

  const handleImportedData = (data: {
    name?: string;
    description?: string;
    price?: number;
    costPrice?: number;
    model?: string;
    colorLabel?: string;
    customDetail?: string;
    images?: string[];
    category?: string;
  }) => {
    setForm(prev => ({
      ...prev,
      name: data.name || prev.name,
      description: data.description || prev.description,
      price: data.price ? String(data.price) : prev.price,
      cost_price: data.costPrice ? String(data.costPrice) : prev.cost_price,
      model: data.model || prev.model,
      color_label: data.colorLabel || prev.color_label,
      custom_detail: data.customDetail || prev.custom_detail,
      mainCategory: data.category || prev.mainCategory,
    }));
    
    // Add images if provided
    if (data.images && data.images.length > 0) {
      const available = 3 - totalImages;
      const imagesToAdd = data.images.slice(0, available);
      if (imagesToAdd.length > 0) {
        setExistingImageUrls(prev => [...prev, ...imagesToAdd].slice(0, 3));
      }
    }
  };

  const formContent = (
    <div className="space-y-4">
      {/* Importação via URL do Fornecedor */}
      {!editingProduct && (
        <UrlProductImporter 
          onDataImported={handleImportedData} 
          maxImages={3}
          currentImageCount={totalImages}
        />
      )}

      {/* Nome do Produto */}
      <div className="space-y-2">
        <Label>Nome do Produto *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Top Carol Vermelho"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Inclua a cor no nome (ex: "Vestido Luna Preto")</p>
      </div>
      
      {/* Descrição */}
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descrição do produto"
          className="min-h-[80px]"
        />
      </div>

      {/* Categorias */}
      <div className="space-y-2">
        <FixedCategorySelector
          mainCategory={form.mainCategory}
          subcategory={form.subcategory}
          isNewRelease={form.isNewRelease}
          onMainCategoryChange={(value) => setForm(prev => ({ ...prev, mainCategory: value }))}
          onSubcategoryChange={(value) => setForm(prev => ({ ...prev, subcategory: value }))}
          onIsNewReleaseChange={(value) => setForm(prev => ({ ...prev, isNewRelease: value }))}
        />
      </div>
      
      {/* Campos de Filtro - 3 lado a lado no desktop */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Campos de Filtro (opcionais)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="Modelo (ex: Top Carol)"
          />
          <Input
            value={form.color_label}
            onChange={(e) => setForm({ ...form, color_label: e.target.value })}
            placeholder="Cor (ex: Vermelho)"
          />
          <Input
            value={form.custom_detail}
            onChange={(e) => setForm({ ...form, custom_detail: e.target.value })}
            placeholder="Detalhe (ex: Brilhante)"
          />
        </div>
      </div>
      
      {/* Preços e Configurações */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Preço Venda *</Label>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Preço Custo</Label>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={form.cost_price}
            onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estoque Mín.</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={form.min_stock_level}
            onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
            placeholder="5"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fornecedor</Label>
          <Select value={form.supplier_id} onValueChange={(value) => setForm({ ...form, supplier_id: value })}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Seção de Mídia */}
      <div className="space-y-4 pt-2 border-t">
        <h3 className="text-sm font-medium text-muted-foreground">Mídia do Produto</h3>
        
      {/* Fotos */}
        <div className="space-y-2">
          <Label>Fotos (até 3)</Label>
          
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleImageUpload(e.target.files)}
            className="hidden"
          />
          
          <ReorderableImageList
            existingUrls={existingImageUrls}
            newPreviewUrls={newImagePreviews}
            maxImages={3}
            onReorder={handleImageReorder}
            onRemove={removeImage}
            onAddClick={() => imageInputRef.current?.click()}
          />
          
          <p className="text-xs text-muted-foreground">{totalImages}/3 fotos</p>
          
          {/* Import photos from supplier URL - available for both new and editing */}
          {totalImages < 3 && (
            <SupplierImageScraper
              maxImages={3}
              currentImageCount={totalImages}
              onImagesSelected={handleImagesFromSupplier}
            />
          )}
        </div>
        
        {/* Vídeo */}
        <ProductVideoUpload
          value={form.video_url}
          onChange={(url) => setForm({ ...form, video_url: url })}
        />
      </div>
      
      {/* Seção de Variantes (Tamanhos) */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Variantes de Tamanho *</h3>
          <span className="text-sm font-medium text-primary">
            Total: {totalStock} un.
          </span>
        </div>
        
        <div className="space-y-2">
          {productVariants.map((variant, index) => (
            <div key={`${variant.size}-${index}`} className="flex gap-2 items-center p-2 border rounded-lg bg-muted/30">
              <Select
                value={variant.size}
                onValueChange={(value) => updateProductVariant(index, "size", value)}
              >
                <SelectTrigger className="w-20 sm:w-24 shrink-0">
                  <SelectValue placeholder="Tamanho" />
                </SelectTrigger>
                <SelectContent>
                  {availableSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Qtd"
                className="w-16 sm:w-20 shrink-0"
                value={variant.stock_quantity || ""}
                onChange={(e) => updateProductVariant(index, "stock_quantity", parseInt(e.target.value) || 0)}
              />
              
              <div className="flex-1 flex justify-center">
                <MarketingStatusSelector
                  value={variant.marketing_status || null}
                  onChange={(status) => updateProductVariant(index, "marketing_status", status)}
                  marketingPrices={variant.marketing_prices}
                  onMarketingPricesChange={(prices) => updateProductVariant(index, "marketing_prices", prices)}
                  compact
                />
              </div>
              
              {productVariants.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive"
                  onClick={() => removeProductVariant(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
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
          Adicionar Tamanho
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>
              {editingProduct ? "Editar Produto" : duplicatingProduct ? "Duplicar Produto" : "Novo Produto"}
            </DrawerTitle>
            <DrawerDescription>
              {editingProduct ? "Atualize as informações do produto" : "Preencha as informações do produto"}
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1 px-4 pb-4 max-h-[75dvh]">
            {formContent}
          </ScrollArea>
          <DrawerFooter className="border-t pt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Cancelar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? "Editar Produto" : duplicatingProduct ? "Duplicar Produto" : "Novo Produto"}
          </DialogTitle>
          <DialogDescription>
            {editingProduct ? "Atualize as informações do produto" : "Preencha as informações do produto"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          {formContent}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
