import { useRef, useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
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
import { CategoryManager } from "@/components/products/CategoryManager";
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

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  duplicatingProduct?: Product | null;
  onSuccess: () => void;
  initialProductName?: string;
}

const sizes = ["PP", "P", "M", "G", "GG", "XG", "XXG"];

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
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productImages, setProductImages] = useState<File[]>([]);
  const [productImageUrls, setProductImageUrls] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [scrapedImageUrls, setScrapedImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    cost_price: "",
    sku: "",
    size: "",
    color: "",
    stock_quantity: "",
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
      // Editing existing product
      setForm({
        name: editingProduct.name,
        description: editingProduct.description || "",
        category: editingProduct.category,
        price: editingProduct.price.toString(),
        cost_price: editingProduct.cost_price?.toString() || "",
        sku: editingProduct.sku || "",
        size: editingProduct.size || "",
        color: editingProduct.color || "",
        stock_quantity: editingProduct.stock_quantity.toString(),
        min_stock_level: editingProduct.min_stock_level.toString(),
        supplier_id: editingProduct.supplier_id || ""
      });
      
      const existing: string[] = [];
      if (editingProduct.image_url) existing.push(editingProduct.image_url);
      if (editingProduct.image_url_2) existing.push(editingProduct.image_url_2);
      if (editingProduct.image_url_3) existing.push(editingProduct.image_url_3);
      setExistingImageUrls(existing);
    } else if (duplicatingProduct) {
      // Duplicating product - copy all data except images and start fresh stock
      setForm({
        name: duplicatingProduct.name,
        description: duplicatingProduct.description || "",
        category: duplicatingProduct.category,
        price: duplicatingProduct.price.toString(),
        cost_price: duplicatingProduct.cost_price?.toString() || "",
        sku: "", // Clear SKU for duplicate
        size: duplicatingProduct.size || "",
        color: duplicatingProduct.color || "",
        stock_quantity: "0", // Start with 0 stock for new variant
        min_stock_level: duplicatingProduct.min_stock_level.toString(),
        supplier_id: duplicatingProduct.supplier_id || ""
      });
      
      // Copy images from duplicated product
      const existing: string[] = [];
      if (duplicatingProduct.image_url) existing.push(duplicatingProduct.image_url);
      if (duplicatingProduct.image_url_2) existing.push(duplicatingProduct.image_url_2);
      if (duplicatingProduct.image_url_3) existing.push(duplicatingProduct.image_url_3);
      setExistingImageUrls(existing);
    } else {
      resetForm();
      // Apply initial product name from voice command
      if (initialProductName) {
        setForm(prev => ({ ...prev, name: initialProductName }));
      }
    }
  }, [editingProduct, duplicatingProduct, open, initialProductName]);

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
      sku: "",
      size: "",
      color: "",
      stock_quantity: "",
      min_stock_level: "5",
      supplier_id: ""
    });
    productImageUrls.forEach(url => URL.revokeObjectURL(url));
    setProductImages([]);
    setProductImageUrls([]);
    setExistingImageUrls([]);
    setScrapedImageUrls([]);
  };

  const handleScrapedImagesSelected = (urls: string[]) => {
    // Add scraped images up to the 3 image limit
    const totalExisting = existingImageUrls.length + productImageUrls.length + scrapedImageUrls.length;
    const available = 3 - totalExisting;
    const toAdd = urls.slice(0, available);
    setScrapedImageUrls(prev => [...prev, ...toAdd]);
  };

  const removeScrapedImage = (index: number) => {
    setScrapedImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    
    const totalImages = productImages.length + existingImageUrls.length;
    const newImages = Array.from(files).slice(0, 3 - totalImages);
    const newUrls = newImages.map(file => URL.createObjectURL(file));
    
    setProductImages(prev => [...prev, ...newImages].slice(0, 3 - existingImageUrls.length));
    setProductImageUrls(prev => [...prev, ...newUrls].slice(0, 3 - existingImageUrls.length));
  };

  const removeImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      URL.revokeObjectURL(productImageUrls[index]);
      setProductImages(prev => prev.filter((_, i) => i !== index));
      setProductImageUrls(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadProductImages = async (productId: string): Promise<string[]> => {
    if (!user || productImages.length === 0) return [];
    
    const urls: string[] = [];
    
    for (let i = 0; i < productImages.length; i++) {
      const file = productImages[i];
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
    
    return urls;
  };

  const totalImages = existingImageUrls.length + productImageUrls.length + scrapedImageUrls.length;

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

    setSaving(true);

    const productData = {
      name: form.name,
      description: form.description || null,
      category: form.category,
      price: parseFloat(form.price) || 0,
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      sku: form.sku || null,
      size: form.size || null,
      color: form.color || null,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      min_stock_level: parseInt(form.min_stock_level) || 5,
      supplier_id: form.supplier_id && form.supplier_id !== "none" ? form.supplier_id : null,
      owner_id: user.id,
      group_id: null,
    };

    try {
      if (editingProduct) {
        const allUrls = [...existingImageUrls, ...scrapedImageUrls];
        
        if (productImages.length > 0) {
          const newUrls = await uploadProductImages(editingProduct.id);
          allUrls.push(...newUrls);
        }

        const { error } = await supabase
          .from("products")
          .update({
            ...productData,
            image_url: allUrls[0] || null,
            image_url_2: allUrls[1] || null,
            image_url_3: allUrls[2] || null,
          })
          .eq("id", editingProduct.id);

        if (error) throw error;
        
        toast.success("Produto atualizado!");
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();

        if (error || !newProduct) throw error;
        
        if (productImages.length > 0) {
          const urls = await uploadProductImages(newProduct.id);
          if (urls.length > 0) {
            await supabase
              .from("products")
              .update({
                image_url: urls[0] || null,
                image_url_2: urls[1] || null,
                image_url_3: urls[2] || null,
              })
              .eq("id", newProduct.id);
          }
        }
        
        toast.success("Produto criado!");
      }

      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error) {
      toast.error(editingProduct ? "Erro ao atualizar produto" : "Erro ao criar produto");
    } finally {
      setSaving(false);
    }
  };

  

  // On iOS inside Drawer, portals can cause blank screen/glitches.
  // Render SelectContent inline on mobile.
  const selectContentProps = isMobile ? ({ portal: false } as const) : ({} as const);

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
      
      {/* Image Upload Section */}
      <div className="col-span-1 sm:col-span-2 space-y-2">
        <Label>Fotos do Produto (máx. 3)</Label>
        <div className="flex gap-3 items-center flex-wrap">
          {existingImageUrls.map((url, idx) => (
            <div key={`existing-${idx}`} className="relative w-16 h-16 sm:w-20 sm:h-20">
              <img 
                src={url} 
                alt={`Foto ${idx + 1}`} 
                className="w-full h-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeImage(idx, true)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md"
              >
                ×
              </button>
            </div>
          ))}

          {scrapedImageUrls.map((url, idx) => (
            <div key={`scraped-${idx}`} className="relative w-16 h-16 sm:w-20 sm:h-20">
              <img 
                src={url} 
                alt={`Foto do fornecedor ${idx + 1}`} 
                className="w-full h-full object-cover rounded-lg border border-primary/50"
              />
              <button
                type="button"
                onClick={() => removeScrapedImage(idx)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md"
              >
                ×
              </button>
            </div>
          ))}
          
          {productImageUrls.map((url, idx) => (
            <div key={`new-${idx}`} className="relative w-16 h-16 sm:w-20 sm:h-20">
              <img 
                src={url} 
                alt={`Nova foto ${idx + 1}`} 
                className="w-full h-full object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeImage(idx, false)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md"
              >
                ×
              </button>
            </div>
          ))}
          
          {totalImages < 3 && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageUpload(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                <span className="text-[10px] sm:text-xs text-muted-foreground mt-1">Adicionar</span>
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {totalImages}/3 fotos adicionadas
        </p>
        
        {/* Supplier Image Scraper */}
        <SupplierImageScraper
          maxImages={3}
          currentImageCount={totalImages}
          onImagesSelected={handleScrapedImagesSelected}
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
        <Label>SKU</Label>
        <Input
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          placeholder="Código do produto"
          autoComplete="off"
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
        <Label>Tamanho</Label>
        <Select
          value={form.size}
          onValueChange={(value) => setForm({ ...form, size: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} {...selectContentProps}>
            {sizes.map((size) => (
              <SelectItem key={size} value={size}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Cor</Label>
        <Input
          value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })}
          placeholder="Ex: Preto"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label>Quantidade em Estoque *</Label>
        <Input
          type="number"
          inputMode="numeric"
          value={form.stock_quantity}
          onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
          placeholder="0"
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

  if (isMobile) {
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
