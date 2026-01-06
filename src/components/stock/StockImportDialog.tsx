import { useState, useRef, useEffect } from "react";
import { Upload, FileSpreadsheet, Camera, Loader2, Check, X, AlertCircle, Image as ImageIcon, Trash2, Edit } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SupplierSelect } from "./SupplierSelect";

interface ImportedProduct {
  name: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  cost_price: number;
  price: number;
  quantity: number;
  category: string;
  selected: boolean;
  existingProduct: ExistingProduct | null;
  images: File[];
  imageUrls: string[];
  isEditing: boolean;
  hasErrors: boolean;
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

  const processProducts = (parsedProducts: Omit<ImportedProduct, "selected" | "existingProduct" | "images" | "imageUrls" | "isEditing" | "hasErrors">[]) => {
    const processed = parsedProducts.map(p => {
      const existing = findDuplicate(p.name, p.sku);
      const product: ImportedProduct = {
        ...p,
        selected: true,
        existingProduct: existing,
        images: [],
        imageUrls: [],
        isEditing: false,
        hasErrors: false,
      };
      product.hasErrors = checkProductErrors(product);
      return product;
    });
    
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
          sku: p.sku || null,
          size: p.size || null,
          color: p.color || null,
          cost_price: parseFloat(p.cost_price) || 0,
          price: parseFloat(p.price) || 0,
          quantity: parseInt(p.quantity) || 1,
          category: p.category || "",
        }));

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
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert({
            name: product.name.trim(),
            sku: product.sku,
            size: product.size,
            color: product.color,
            cost_price: product.cost_price,
            price: product.price,
            stock_quantity: product.quantity,
            category: product.category || "Outros",
            min_stock_level: 5,
            owner_id: user.id,
            supplier_id: finalSupplierId,
          })
          .select("id")
          .single();

        if (!error && newProduct) {
          // Upload images if any
          if (product.images.length > 0) {
            const urls = await uploadProductImages(newProduct.id, product.images);
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
                <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Foto da Nota Fiscal</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  A IA irá extrair automaticamente os dados dos produtos
                </p>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleInvoiceUpload}
                  className="hidden"
                />
                <Button onClick={() => imageInputRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                  {loading ? "Processando..." : "Tirar Foto / Carregar"}
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
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={!product.category ? "text-destructive" : "text-muted-foreground"}>
                          {product.category || "(obrigatório)"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.color || "-"} / {product.size || "-"}
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

        {/* Edit Product Dialog */}
        {editingIndex !== null && (
          <Dialog open={true} onOpenChange={() => setEditingIndex(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Produto</DialogTitle>
                <DialogDescription>Preencha ou corrija os dados do produto</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Nome *</Label>
                  <Input 
                    value={products[editingIndex].name}
                    onChange={(e) => updateProduct(editingIndex, { name: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>Categoria *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={products[editingIndex].category}
                    onChange={(e) => updateProduct(editingIndex, { category: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>SKU</Label>
                    <Input 
                      value={products[editingIndex].sku || ""}
                      onChange={(e) => updateProduct(editingIndex, { sku: e.target.value || null })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Quantidade</Label>
                    <Input 
                      type="number"
                      value={products[editingIndex].quantity}
                      onChange={(e) => updateProduct(editingIndex, { quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Cor</Label>
                    <Input 
                      value={products[editingIndex].color || ""}
                      onChange={(e) => updateProduct(editingIndex, { color: e.target.value || null })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tamanho</Label>
                    <Input 
                      value={products[editingIndex].size || ""}
                      onChange={(e) => updateProduct(editingIndex, { size: e.target.value || null })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Preço de Custo</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={products[editingIndex].cost_price}
                      onChange={(e) => updateProduct(editingIndex, { cost_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Preço de Venda</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={products[editingIndex].price}
                      onChange={(e) => updateProduct(editingIndex, { price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Fotos (máx. 3)</Label>
                  <div className="flex gap-2 items-center">
                    {products[editingIndex].imageUrls.map((url, imgIdx) => (
                      <div key={imgIdx} className="relative w-16 h-16">
                        <img 
                          src={url} 
                          alt={`Foto ${imgIdx + 1}`} 
                          className="w-full h-full object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={() => removeProductImage(editingIndex, imgIdx)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {products[editingIndex].images.length < 3 && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleProductImageUpload(editingIndex, e.target.files)}
                          className="hidden"
                          id={`edit-image-${editingIndex}`}
                        />
                        <label 
                          htmlFor={`edit-image-${editingIndex}`}
                          className="w-16 h-16 border-2 border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                        >
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingIndex(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
