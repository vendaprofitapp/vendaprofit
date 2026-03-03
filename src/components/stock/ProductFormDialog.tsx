import { useRef, useState, useEffect, useCallback } from "react";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProductInfoSection } from "@/components/stock/ProductInfoSection";
import { ProductMediaSection } from "@/components/stock/ProductMediaSection";
import { ProductVariantsSection, type ProductVariant } from "@/components/stock/ProductVariantsSection";
import type { MarketingStatus, MarketingPrices } from "@/components/stock/MarketingStatusSelector";

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

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  duplicatingProduct?: Product | null;
  onSuccess: () => void;
  initialProductName?: string;
}

const sizeOrder = ["2", "4", "6", "8", "10", "12", "14", "PP", "P", "M", "G", "GG", "XG", "XXG", "XXXG", "EG", "EGG", "EGGG", "Único", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "Pote 220 grs", "Pote 350 grs", "Pote 400 grs", "Pacote 500 grs", "Pacote 1 kg"];

const defaultSizes = ["PP", "P", "M", "G", "GG", "XG"];

const sortVariantsBySize = (variants: ProductVariant[]): ProductVariant[] => {
  return [...variants].sort((a, b) => {
    const indexA = sizeOrder.indexOf(a.size);
    const indexB = sizeOrder.indexOf(b.size);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
};

const createDefaultVariants = (): ProductVariant[] =>
  defaultSizes.map(size => ({
    size,
    stock_quantity: 0,
    marketing_status: null,
    marketing_prices: null,
    marketing_delivery_days: null,
  }));

const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
};

export function ProductFormDialog({
  open,
  onOpenChange,
  editingProduct,
  duplicatingProduct,
  onSuccess,
  initialProductName = "",
}: ProductFormDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { isTrial, productLimit } = usePlan();
  const [productCount, setProductCount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [originalVariantCount, setOriginalVariantCount] = useState(0);

  // Product-level images
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

  const defaultForm = {
    name: "",
    description: "",
    mainCategory: "",
    subcategory: "",
    isNewRelease: false,
    price: "",
    cost_price: "",
    min_stock_level: "5",
    supplier_id: "",
    b2b_product_url: "",
    video_url: null as string | null,
    model: "",
    color_label: "",
    custom_detail: "",
    weight_grams: "",
    width_cm: "",
    height_cm: "",
    length_cm: "",
  };

  // Only persist for new product creation (not edit/duplicate)
  const shouldPersist = !editingProduct && !duplicatingProduct;
  const persistKey = shouldPersist ? `stock_form_${user?.id || "anon"}` : `stock_form_noop_${Date.now()}`;

  const [form, setForm, clearFormPersistence] = useFormPersistence(persistKey, defaultForm);

  // --- React Query: suppliers with 5min staleTime ---
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-form", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, cnpj")
        .eq("owner_id", user.id)
        .order("name");
      return data || [];
    },
    enabled: !!user && open,
    staleTime: 5 * 60 * 1000,
  });

  // --- Product count for trial limit ---
  useEffect(() => {
    if (user && open) {
      supabase.from("products").select("id", { count: "exact", head: true }).eq("owner_id", user.id).then(({ count }) => {
        setProductCount(count ?? 0);
      });
    }
  }, [user, open]);

  // --- React Query: variants — staleTime=0 para sempre buscar dados frescos ao abrir o form ---
  const { data: fetchedVariants } = useQuery({
    queryKey: ["product-variants-form", editingProduct?.id],
    queryFn: async () => {
      if (!editingProduct) return null;
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, size, stock_quantity, marketing_status, marketing_prices, marketing_delivery_days")
        .eq("product_id", editingProduct.id)
        .order("size", { ascending: true });
      if (error || !data || data.length === 0) return null;
      return data.map(v => ({
        id: v.id,
        size: v.size,
        stock_quantity: v.stock_quantity,
        marketing_status: (v.marketing_status as MarketingStatus) || null,
        marketing_prices: (v as any).marketing_prices as MarketingPrices || null,
        marketing_delivery_days: v.marketing_delivery_days ? Number(v.marketing_delivery_days) : null,
      }));
    },
    enabled: !!editingProduct && open,
    staleTime: 0,
    gcTime: 0,
  });

  // Sync fetched variants into state
  useEffect(() => {
    if (fetchedVariants && editingProduct) {
      setProductVariants(sortVariantsBySize(fetchedVariants));
      setOriginalVariantCount(fetchedVariants.length);
    }
  }, [fetchedVariants, editingProduct]);

  // Initialize form from editing/duplicating product
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
        b2b_product_url: (editingProduct as any).b2b_product_url || "",
        video_url: editingProduct.video_url || null,
        model: editingProduct.model || "",
        color_label: editingProduct.color_label || "",
        custom_detail: editingProduct.custom_detail || "",
        weight_grams: (editingProduct as any).weight_grams?.toString() || "",
        width_cm: (editingProduct as any).width_cm?.toString() || "",
        height_cm: (editingProduct as any).height_cm?.toString() || "",
        length_cm: (editingProduct as any).length_cm?.toString() || "",
      });
      const urls: string[] = [];
      if (editingProduct.image_url) urls.push(editingProduct.image_url);
      if (editingProduct.image_url_2) urls.push(editingProduct.image_url_2);
      if (editingProduct.image_url_3) urls.push(editingProduct.image_url_3);
      setExistingImageUrls(urls);
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
        b2b_product_url: (duplicatingProduct as any).b2b_product_url || "",
        video_url: null,
        model: duplicatingProduct.model || "",
        color_label: duplicatingProduct.color_label || "",
        custom_detail: duplicatingProduct.custom_detail || "",
        weight_grams: "",
        width_cm: "",
        height_cm: "",
        length_cm: "",
      });
      setProductVariants(createDefaultVariants());
      setExistingImageUrls([]);
    } else {
      // New product: only reset if no persisted data exists
      const hasPersistedData = form.name || form.price || form.mainCategory || form.description;
      if (!hasPersistedData) {
        resetForm();
      }
      if (initialProductName && !form.name) {
        setForm(prev => ({ ...prev, name: initialProductName }));
      }
      // Initialize default variants if empty
      if (productVariants.length === 0) {
        setProductVariants(createDefaultVariants());
      }
    }
  }, [editingProduct, duplicatingProduct, open]);

  const resetForm = () => {
    setForm({
      name: "", description: "", mainCategory: "", subcategory: "", isNewRelease: false,
      price: "", cost_price: "", min_stock_level: "5", supplier_id: "", b2b_product_url: "",
      video_url: null, model: "", color_label: "", custom_detail: "",
      weight_grams: "", width_cm: "", height_cm: "", length_cm: "",
    });
    clearFormPersistence();
    newImagePreviews.forEach(url => URL.revokeObjectURL(url));
    setExistingImageUrls([]);
    setNewImageFiles([]);
    setNewImagePreviews([]);
    setProductVariants(createDefaultVariants());
    setOriginalVariantCount(0);
  };

  // --- Stable callbacks for sub-components ---
  const handleFormChange = useCallback((updates: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    setExistingImageUrls(prev => {
      setNewImageFiles(prevFiles => {
        const totalCurrent = prev.length + prevFiles.length;
        const available = 3 - totalCurrent;
        if (available <= 0) {
          toast.error("Máximo de 3 fotos");
          return prevFiles;
        }
        const filesToAdd = Array.from(files).slice(0, available);
        const newUrls = filesToAdd.map(file => URL.createObjectURL(file));
        setNewImagePreviews(prevPreviews => [...prevPreviews, ...newUrls]);
        return [...prevFiles, ...filesToAdd];
      });
      return prev;
    });
  }, []);

  const handleRemoveImage = useCallback((index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      setNewImagePreviews(prev => {
        URL.revokeObjectURL(prev[index]);
        return prev.filter((_, i) => i !== index);
      });
      setNewImageFiles(prev => prev.filter((_, i) => i !== index));
    }
  }, []);

  const handleImageReorder = useCallback((newExisting: string[], newPreviews: string[]) => {
    setExistingImageUrls(newExisting);
    setNewImagePreviews(newPreviews);
  }, []);

  const handleImagesFromSupplier = useCallback((urls: string[]) => {
    setExistingImageUrls(prev => {
      const available = 3 - prev.length;
      if (available <= 0) {
        toast.error("Máximo de 3 fotos");
        return prev;
      }
      const urlsToAdd = urls.slice(0, available);
      toast.success(`${urlsToAdd.length} imagem(ns) adicionada(s)`);
      return [...prev, ...urlsToAdd];
    });
  }, []);

  const handleVideoChange = useCallback((url: string | null) => {
    setForm(prev => ({ ...prev, video_url: url }));
  }, []);

  const handleAddVariant = useCallback(() => {
    setProductVariants(prev => [...prev, { size: "", stock_quantity: 0, marketing_status: null, marketing_prices: null, marketing_delivery_days: null }]);
  }, []);

  const handleRemoveVariant = useCallback((index: number) => {
    setProductVariants(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateVariant = useCallback((index: number, field: keyof ProductVariant, value: any) => {
    let updates: Partial<ProductVariant> = { [field]: value };
    if (field === 'marketing_status' && value === null) {
      updates.marketing_prices = null;
      updates.marketing_delivery_days = null;
    }
    setProductVariants(prev => {
      const updated = prev.map((v, i) => i === index ? { ...v, ...updates } : v);
      return field === 'size' ? sortVariantsBySize(updated) : updated;
    });
  }, []);

  const handleImportedData = useCallback((data: {
    name?: string; description?: string; price?: number; costPrice?: number;
    model?: string; colorLabel?: string; customDetail?: string; images?: string[]; category?: string;
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
    if (data.images && data.images.length > 0) {
      setExistingImageUrls(prev => {
        const available = 3 - prev.length;
        return [...prev, ...data.images!.slice(0, available)].slice(0, 3);
      });
    }
  }, []);

  // --- Upload with compression ---
  const uploadImages = async (productId: string): Promise<string[]> => {
    if (!user) return [];
    const urls: string[] = [...existingImageUrls];

    for (let i = 0; i < newImageFiles.length; i++) {
      const file = newImageFiles[i];
      let fileToUpload: File = file;

      // Compress image before upload
      try {
        fileToUpload = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
      } catch (err) {
        console.warn("Image compression failed, uploading original:", err);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${productId}/${Date.now()}_${i + 1}.${fileExt}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, fileToUpload, { upsert: true });

      if (!error) {
        const { data } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        urls.push(data.publicUrl);
      }
    }

    return urls.slice(0, 3);
  };

  const totalStock = productVariants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
  const totalImages = existingImageUrls.length + newImagePreviews.length;

  const handleSave = async () => {
    if (!user) return;

    if (!editingProduct && isTrial && productLimit !== null && productCount >= productLimit) {
      toast.error(
        `Limite do trial atingido! Você pode cadastrar no máximo ${productLimit} produtos no plano de teste. Assine um plano para continuar.`,
        { duration: 6000 }
      );
      return;
    }

    if (!form.name.trim()) { toast.error("Nome do produto é obrigatório"); return; }
    if (!form.mainCategory) { toast.error("Categoria principal é obrigatória"); return; }

    const normalizedVariants = productVariants
      .map(v => ({ ...v, size: (v.size || "").trim() }))
      .filter(v => Boolean(v.size));

    if (normalizedVariants.length === 0) { toast.error("Adicione pelo menos uma variante com tamanho"); return; }

    setSaving(true);

    try {
      let productId: string;
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
        b2b_product_url: form.b2b_product_url?.trim() || null,
        owner_id: user.id,
        group_id: null,
        video_url: form.video_url || null,
        model: form.model || null,
        color_label: form.color_label || null,
        custom_detail: form.custom_detail || null,
        image_url: imageUrls[0] || null,
        image_url_2: imageUrls[1] || null,
        image_url_3: imageUrls[2] || null,
        weight_grams: form.weight_grams ? parseInt(form.weight_grams) : null,
        width_cm: form.width_cm ? parseInt(form.width_cm) : null,
        height_cm: form.height_cm ? parseInt(form.height_cm) : null,
        length_cm: form.length_cm ? parseInt(form.length_cm) : null,
      } as any;

      if (editingProduct) {
        productId = editingProduct.id;
        const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { data: newProduct, error } = await supabase.from("products").insert(productData).select("id").single();
        if (error || !newProduct) throw error;
        productId = newProduct.id;
      }

      // Deduplicate variants by size
      const variantMap = new Map<string, ProductVariant>();
      normalizedVariants.forEach(v => {
        const existing = variantMap.get(v.size);
        if (existing) {
          existing.stock_quantity = (existing.stock_quantity || 0) + (Number(v.stock_quantity) || 0);
          existing.marketing_status = v.marketing_status || existing.marketing_status;
          existing.marketing_prices = v.marketing_prices ?? existing.marketing_prices;
          existing.marketing_delivery_days = v.marketing_delivery_days ?? existing.marketing_delivery_days;
        } else {
          variantMap.set(v.size, {
            size: v.size, stock_quantity: Number(v.stock_quantity) || 0,
            marketing_status: v.marketing_status || null, marketing_prices: v.marketing_prices ?? null,
            marketing_delivery_days: v.marketing_delivery_days ?? null,
          });
        }
      });

      const variantsToUpsert = Array.from(variantMap.values()).map(v => {
        let marketingStatusArray: string[] | null = null;
        if (v.marketing_status && Array.isArray(v.marketing_status) && v.marketing_status.length > 0) {
          marketingStatusArray = v.marketing_status;
        }
        return {
          product_id: productId, size: v.size, stock_quantity: v.stock_quantity,
          marketing_status: marketingStatusArray, marketing_prices: v.marketing_prices,
          marketing_delivery_days: v.marketing_delivery_days,
        };
      });

      if (editingProduct) {
        const { data: existingVariants } = await supabase
          .from("product_variants").select("id, size").eq("product_id", productId);
        const existingMap = new Map<string, string>();
        (existingVariants || []).forEach(ev => existingMap.set(ev.size, ev.id));

        for (const variant of variantsToUpsert) {
          const existingId = existingMap.get(variant.size);
          if (existingId) {
            const { error: updateError } = await supabase.from("product_variants")
              .update({ stock_quantity: variant.stock_quantity, marketing_status: variant.marketing_status, marketing_prices: variant.marketing_prices, marketing_delivery_days: variant.marketing_delivery_days })
              .eq("id", existingId);
            if (updateError) throw updateError;
            existingMap.delete(variant.size);
          } else {
            const { error: insertError } = await supabase.from("product_variants").insert(variant);
            if (insertError) throw insertError;
          }
        }

        const shouldDeleteOrphans = variantsToUpsert.length > 0 || originalVariantCount === 0;
        if (shouldDeleteOrphans) {
          for (const [, variantId] of existingMap) {
            await supabase.from("product_variants").delete().eq("id", variantId);
          }
        }
      } else {
        if (variantsToUpsert.length > 0) {
          const { error: variantError } = await supabase.from("product_variants").insert(variantsToUpsert);
          if (variantError) throw variantError;
        }
      }

      toast.success(editingProduct ? "Produto atualizado!" : "Produto cadastrado!");
      // Invalida o cache das variantes para garantir dados frescos na próxima edição
      if (editingProduct) {
        queryClient.invalidateQueries({ queryKey: ["product-variants-form", editingProduct.id] });
      }
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

  const formContent = (
    <div className="space-y-4">
      <ProductInfoSection
        form={form}
        onFormChange={handleFormChange}
        suppliers={suppliers}
        isEditing={!!editingProduct}
        totalImages={totalImages}
        onImportedData={handleImportedData}
      />

      <ProductMediaSection
        existingImageUrls={existingImageUrls}
        newImagePreviews={newImagePreviews}
        totalImages={totalImages}
        videoUrl={form.video_url}
        onImageUpload={handleImageUpload}
        onImageReorder={handleImageReorder}
        onRemoveImage={handleRemoveImage}
        onImagesFromSupplier={handleImagesFromSupplier}
        onVideoChange={handleVideoChange}
      />

      <ProductVariantsSection
        variants={productVariants}
        totalStock={totalStock}
        onAddVariant={handleAddVariant}
        onRemoveVariant={handleRemoveVariant}
        onUpdateVariant={handleUpdateVariant}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95dvh] flex flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              {editingProduct ? "Editar Produto" : duplicatingProduct ? "Duplicar Produto" : "Novo Produto"}
            </DrawerTitle>
            <DrawerDescription>
              {editingProduct ? "Atualize as informações do produto" : "Preencha as informações do produto"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 min-h-0">
            {formContent}
          </div>
          <DrawerFooter className="shrink-0 border-t pt-4">
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
